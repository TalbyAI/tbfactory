import { test } from 'node:test';
import assert from 'node:assert/strict';
import { join } from 'node:path';
import { Surreal } from 'surrealdb';
import { publicationRuntime } from './support/publication-runtime';
import { fixture } from './support/factory';
import { setPolicy } from '../src/server/operator';
import { recoverStoppedRun } from '../src/server/review-worker';

const pause = (milliseconds: number) => new Promise((resolve) => setTimeout(resolve, milliseconds));

async function waitForState(
  runtime: Awaited<ReturnType<typeof publicationRuntime>>['r'],
  path: string,
  state: string,
) {
  const deadline = Date.now() + 15000;
  let latest: any;
  while (Date.now() < deadline) {
    latest = await runtime.f.request(path);
    if (latest.status === 200 && latest.body.state === state) return latest.body;
    await pause(100);
  }
  const reviews = await runtime.f.request(`${path}/reviews`);
  throw Error(
    `Work Item did not reach ${state}: ${JSON.stringify({ item: latest, runs: reviews.body.runs })}`,
  );
}

async function waitForPublication(
  runtime: Awaited<ReturnType<typeof publicationRuntime>>,
  status: string,
  decision?: string,
) {
  const deadline = Date.now() + 30000;
  let latest: any;
  while (Date.now() < deadline) {
    latest = await runtime.view();
    const publication = latest.publications.find(
      (candidate: any) =>
        candidate.run === runtime.run.id && (!decision || candidate.decision === decision),
    );
    if (publication?.status === status) return { view: latest, publication };
    await pause(100);
  }
  throw Error(`Publication did not reach ${status}: ${JSON.stringify(latest)}`);
}

async function waitForRunStatus(
  runtime: Awaited<ReturnType<typeof publicationRuntime>>,
  workflow: string,
  status: string,
) {
  const deadline = Date.now() + 15000;
  let latest: any;
  while (Date.now() < deadline) {
    latest = await runtime.view();
    const run = latest.runs.find((candidate: any) => candidate.workflow === workflow);
    if (run?.status === status) return run;
    await pause(100);
  }
  throw Error(`Workflow ${workflow} did not reach ${status}: ${JSON.stringify(latest?.runs)}`);
}

async function prepareFactoryFinalization(
  runtime: Awaited<ReturnType<typeof publicationRuntime>>,
  operationId: string,
) {
  const prepared = await runtime.r.f.request(`${runtime.path}/transition-requests`, {
    operationId,
    transition: 'prepare-review',
    expectedState: 'registered',
    version: 4,
    inputs: { reviewBrief: 'Prepare the Factory state for finalization.' },
  });
  assert.equal(prepared.status, 200, JSON.stringify(prepared.body));
  assert.equal(prepared.body.workItem.state, 'ready-for-review');
  return prepared;
}

test('A completed Review Workflow leaves Factory state unchanged until its distinct finalization Workflow runs', async () => {
  const runtime = await publicationRuntime('github');
  const { r } = runtime;
  try {
    assert.equal((await r.f.request(runtime.path)).body.state, 'registered');
    const prepared = await r.f.request(`${runtime.path}/transition-requests`, {
      operationId: 'prepare-finalization-review',
      transition: 'prepare-review',
      expectedState: 'registered',
      version: 4,
      inputs: { reviewBrief: 'Review and then finalize the current report.' },
    });
    assert.equal(prepared.status, 200);
    assert.equal(prepared.body.workItem.state, 'ready-for-review');

    const requested = await runtime.act('review-publications');
    assert.equal(requested.status, 200);
    await r.startWorker();
    const { publication } = await waitForPublication(runtime, 'completed');
    assert.equal(publication.status, 'completed');
    await r.stopWorker();
    assert.equal((await r.f.request(runtime.path)).body.state, 'ready-for-review');

    const board = await r.f.request('/api/organizations/alpha/board?type=pull-request-review');
    const finalizationTransition = board.body.items
      .find((item: any) => item.id === runtime.path.split('/').at(-1))
      .transitions.find((transition: any) => transition.id === 'finalize-review');
    assert.equal(finalizationTransition.available, true);
    assert.equal(finalizationTransition.currentReportVersion, runtime.report.id);
    const finalized = await r.f.request(`${runtime.path}/transition-requests`, {
      operationId: 'finalize-current-report',
      transition: 'finalize-review',
      expectedState: 'ready-for-review',
      version: 4,
      inputs: { reportVersion: runtime.report.id },
    });

    assert.equal(finalized.status, 200);
    assert.equal(finalized.body.completed, false);
    assert.equal(finalized.body.workItem.state, 'ready-for-review');
    assert.equal(finalized.body.workflowRun.workflow, 'review-finalization-v1');
    const replay = await r.f.request(`${runtime.path}/transition-requests`, {
      operationId: 'finalize-current-report',
      transition: 'finalize-review',
      expectedState: 'ready-for-review',
      version: 4,
      inputs: { reportVersion: runtime.report.id },
    });
    assert.equal(replay.body.workflowRun.id, finalized.body.workflowRun.id);
    const competing = await r.f.request(`${runtime.path}/transition-requests`, {
      operationId: 'competing-finalization',
      transition: 'finalize-review',
      expectedState: 'ready-for-review',
      version: 4,
      inputs: { reportVersion: runtime.report.id },
    });
    assert.equal(competing.status, 409);

    await r.startWorker();

    const completed = await waitForState(r, runtime.path, 'completed');
    assert.equal(completed.version, 4);
    const history = await r.f.request(`${runtime.path}/facts`);
    const transition = history.body.items.find(
      (fact: any) =>
        fact.kind === 'state.transition' && fact.payload.transition === 'finalize-review',
    );
    assert.ok(transition);
    assert.equal(transition.payload.report, runtime.report.id);
    assert.equal(transition.payload.decision, runtime.decision.id);
    assert.equal(transition.payload.publication, publication.id);

    const finalHistory = await r.f.request(`${runtime.path}/reviews`);
    assert.ok(
      finalHistory.body.runs.some(
        (run: any) => run.workflow === 'review-finalization-v1' && run.status === 'completed',
      ),
    );
    assert.ok(
      finalHistory.body.reports.some((candidate: any) => candidate.id === runtime.report.id),
    );
    assert.equal(
      finalHistory.body.runs.find((run: any) => run.workflow === 'review-finalization-v1').report,
      runtime.report.id,
    );
  } finally {
    await runtime.close();
  }
});

test('A pending finalization cancellation retains ownership through an authorization change until Worker confirmation', async () => {
  const runtime = await publicationRuntime('github');
  const { r } = runtime;
  let changedPolicyId: string | undefined;
  try {
    await prepareFactoryFinalization(runtime, 'prepare-cancellable-finalization');
    assert.equal((await runtime.act('review-publications')).status, 200);
    await r.startWorker();
    await waitForPublication(runtime, 'completed');
    await r.stopWorker();
    const currentItem = await r.f.request(runtime.path);

    const accepted = await r.f.request(`${runtime.path}/transition-requests`, {
      operationId: 'accept-cancellable-finalization',
      transition: 'finalize-review',
      expectedState: 'ready-for-review',
      version: 4,
      inputs: { reportVersion: runtime.report.id },
    });
    assert.equal(
      accepted.status,
      200,
      JSON.stringify({ accepted: accepted.body, item: currentItem.body }),
    );
    const run = accepted.body.workflowRun;
    const cancelled = await r.f.request(`${runtime.path}/workflow-cancellations`, {
      operationId: 'cancel-finalization-before-worker-start',
      run: run.id,
    });
    assert.equal(cancelled.status, 200);
    assert.equal(cancelled.body.workflowRun.cancellation.status, 'requested');
    const heldRequest = await r.f.request(`${runtime.path}/transition-requests`);
    assert.equal(
      heldRequest.body.items.find((request: any) => request.id === accepted.body.request.id).status,
      'running',
    );

    const changedPolicy = await setPolicy(r.f.store, {
      organization: 'alpha',
      user: r.f.alice.user.id,
      activity: 'transition.finalize-review',
      scope: 'organization',
      scopeId: 'alpha',
      effect: 'human',
    });
    changedPolicyId = changedPolicy.id;
    const held = await r.f.request(runtime.path);
    assert.equal(held.body.state, 'ready-for-review');
    assert.equal(held.body.activeRun.id, run.id);
    assert.equal(held.body.activeRun.status, run.status);
    const beforeFacts = await r.f.request(`${runtime.path}/facts`);
    assert.equal(
      beforeFacts.body.items.some(
        (fact: any) =>
          fact.kind === 'state.transition' && fact.payload.transition === 'finalize-review',
      ),
      false,
    );

    await r.startWorker();
    const confirmed = await waitForRunStatus(runtime, 'review-finalization-v1', 'cancelled');
    assert.equal(confirmed.id, run.id);
    assert.equal(confirmed.cancellation.status, 'confirmed');
    const cancelledRequest = await r.f.request(`${runtime.path}/transition-requests`);
    const finalizationRequest = cancelledRequest.body.items.find(
      (request: any) => request.id === accepted.body.request.id,
    );
    assert.equal(finalizationRequest.status, 'cancelled');
    assert.equal(finalizationRequest.workflowRun, run.id);
    assert.equal(finalizationRequest.result.workflowRun, run.id);
    const released = await r.f.request(runtime.path);
    assert.equal(released.body.state, 'ready-for-review');
    assert.equal(released.body.activeRun, undefined);
    const afterFacts = await r.f.request(`${runtime.path}/facts`);
    assert.ok(
      afterFacts.body.items.some(
        (fact: any) =>
          fact.kind === 'workflow.cancellation-confirmed' && fact.payload.run === run.id,
      ),
    );
    assert.equal(
      afterFacts.body.items.some(
        (fact: any) =>
          fact.kind === 'state.transition' && fact.payload.transition === 'finalize-review',
      ),
      false,
    );
  } finally {
    if (changedPolicyId)
      await r.f.store.transaction((tx: any) => tx.remove('policy', changedPolicyId));
    await runtime.close();
  }
});

test('A safely cancelled pre-dispatch publication provides a finalizable not-published outcome', async () => {
  const runtime = await publicationRuntime('github');
  const { r } = runtime;
  try {
    await prepareFactoryFinalization(runtime, 'prepare-safe-cancellation-finalization');
    const requested = await runtime.act('review-publications');
    assert.equal(requested.status, 200);
    assert.equal(requested.body.publication.status, 'queued');
    const cancellation = await r.f.request(`${runtime.path}/workflow-cancellations`, {
      operationId: 'cancel-before-publication-dispatch',
      run: runtime.run.id,
    });
    assert.equal(cancellation.status, 200);
    assert.equal(cancellation.body.workflowRun.cancellation.status, 'requested');

    await r.startWorker();
    await waitForPublication(runtime, 'not-published');
    const cancelledRun = await waitForRunStatus(runtime, runtime.run.workflow, 'cancelled');
    assert.equal(cancelledRun.cancellation.status, 'confirmed');
    await r.stopWorker();
    const item = await r.f.request(runtime.path);
    assert.equal(item.body.state, 'ready-for-review');
    assert.equal(item.body.activeRun, undefined);

    const view = await runtime.view();
    const publication = view.publications.find(
      (candidate: any) => candidate.run === runtime.run.id,
    );
    assert.equal(publication.status, 'not-published');
    const evidence = view.publicationHistory.find((fact: any) => fact.id === publication.evidence);
    assert.equal(evidence.payload.noDispatch, true);
    assert.equal(evidence.payload.cancelledBeforeDispatch, true);
    assert.deepEqual(evidence.payload.matches, []);
    assert.ok(
      view.publicationHistory.some(
        (fact: any) =>
          fact.kind === 'publication.cancelled-before-dispatch' &&
          fact.payload.run === runtime.run.id &&
          fact.payload.activity === publication.id &&
          fact.payload.attempt === publication.attempt &&
          fact.payload.evidence === publication.evidence,
      ),
    );
    const cancellationHistory = await r.f.request(`${runtime.path}/facts`);
    assert.ok(
      cancellationHistory.body.items.some(
        (fact: any) =>
          fact.kind === 'workflow.cancellation-confirmed' &&
          fact.payload.run === runtime.run.id &&
          fact.payload.publication === publication.id &&
          fact.payload.attempt === publication.attempt &&
          fact.payload.evidenceFact === publication.evidence,
      ),
    );

    const accepted = await r.f.request(`${runtime.path}/transition-requests`, {
      operationId: 'finalize-safely-cancelled-publication',
      transition: 'finalize-review',
      expectedState: 'ready-for-review',
      version: 4,
      inputs: { reportVersion: runtime.report.id },
    });
    assert.equal(accepted.status, 200, JSON.stringify(accepted.body));
    await r.startWorker();
    await waitForState(r, runtime.path, 'completed');
    const facts = await r.f.request(`${runtime.path}/facts`);
    const transition = facts.body.items.find(
      (fact: any) =>
        fact.kind === 'state.transition' && fact.payload.transition === 'finalize-review',
    );
    assert.equal(transition.payload.report, runtime.report.id);
    assert.equal(transition.payload.decision, runtime.decision.id);
    assert.equal(transition.payload.publication, publication.id);
  } finally {
    await runtime.close();
  }
});

test('A finalization Approval binds the current same-report Decision and publication outcome', async () => {
  const runtime = await publicationRuntime('github', true);
  const { r } = runtime;
  try {
    const prepared = await r.f.request(`${runtime.path}/transition-requests`, {
      operationId: 'prepare-empty-finalization',
      transition: 'prepare-review',
      expectedState: 'registered',
      version: 4,
      inputs: { reviewBrief: 'Review the empty report.' },
    });
    assert.equal(prepared.status, 200);

    assert.equal((await runtime.act('review-publications')).status, 200);
    await r.startWorker();
    const firstOutcome = await waitForPublication(runtime, 'skipped');
    assert.equal(firstOutcome.publication.decision, runtime.decision.id);
    await r.stopWorker();

    await setPolicy(r.f.store, {
      organization: 'alpha',
      user: r.f.alice.user.id,
      activity: 'transition.finalize-review',
      scope: 'organization',
      scopeId: 'alpha',
      effect: 'human',
    });
    const missingEvidence = await r.f.request(`${runtime.path}/transition-requests`, {
      operationId: 'missing-current-report',
      transition: 'finalize-review',
      expectedState: 'ready-for-review',
      version: 4,
      inputs: { reportVersion: 'a'.repeat(32) },
    });
    assert.equal(missingEvidence.status, 409);
    const pending = await r.f.request(`${runtime.path}/transition-requests`, {
      operationId: 'pending-finalization-approval',
      transition: 'finalize-review',
      expectedState: 'ready-for-review',
      version: 4,
      inputs: { reportVersion: runtime.report.id },
    });
    assert.equal(pending.status, 200);
    assert.equal(pending.body.request.status, 'pending-approval');
    assert.equal(pending.body.workItem.state, 'ready-for-review');

    const replacement = await r.f.request(`${runtime.path}/review-decisions`, {
      operationId: 'replace-decision-same-report',
      run: runtime.run.id,
      reportVersion: runtime.report.id,
      reviewed: true,
      findings: [],
      replaces: runtime.decision.id,
    });
    assert.equal(replacement.status, 200);
    const newDecision = replacement.body.fact;

    assert.equal((await runtime.act('review-publications')).status, 200);
    await r.startWorker();
    const resolved = await waitForPublication(runtime, 'skipped', newDecision.id);
    await r.stopWorker();
    assert.equal(resolved.publication.decision, newDecision.id);

    const oldApproval = await r.f.request(
      `${runtime.path}/transition-requests/${pending.body.request.id}/approve`,
      { operationId: 'reject-stale-finalization-approval' },
    );
    assert.equal(oldApproval.status, 409);
    assert.equal((await r.f.request(runtime.path)).body.state, 'ready-for-review');

    const deny = await setPolicy(r.f.store, {
      organization: 'alpha',
      user: r.f.alice.user.id,
      activity: 'transition.finalize-review',
      scope: 'organization',
      scopeId: 'alpha',
      effect: 'deny',
    });
    const denied = await r.f.request(`${runtime.path}/transition-requests`, {
      operationId: 'denied-finalization',
      transition: 'finalize-review',
      expectedState: 'ready-for-review',
      version: 4,
      inputs: { reportVersion: runtime.report.id },
    });
    assert.equal(denied.status, 403);
    await r.f.store.transaction((tx: any) => tx.remove('policy', deny.id));

    const current = await r.f.request(`${runtime.path}/transition-requests`, {
      operationId: 'current-finalization-approval',
      transition: 'finalize-review',
      expectedState: 'ready-for-review',
      version: 4,
      inputs: { reportVersion: runtime.report.id },
    });
    assert.equal(current.status, 200);
    const currentRequest = current.body.request;
    const currentApproval = await r.f.request(
      `${runtime.path}/transition-requests/${currentRequest.id}/approve`,
      {
        operationId: 'approve-current-finalization',
      },
    );
    assert.equal(currentApproval.status, 200);
    const executed = await r.f.request(
      `${runtime.path}/transition-requests/${currentRequest.id}/execute`,
      { operationId: 'execute-current-finalization' },
    );
    assert.equal(executed.status, 200);
    assert.equal(executed.body.workflowRun.workflow, 'review-finalization-v1');
    const competing = await r.f.request(`${runtime.path}/transition-requests`, {
      operationId: 'competing-approved-finalization',
      transition: 'finalize-review',
      expectedState: 'ready-for-review',
      version: 4,
      inputs: { reportVersion: runtime.report.id },
    });
    assert.equal(competing.status, 409);

    const finalizationRun = executed.body.workflowRun;
    const transitionDeny = await setPolicy(r.f.store, {
      organization: 'alpha',
      user: r.f.alice.user.id,
      activity: 'transition.finalize-review',
      scope: 'organization',
      scopeId: 'alpha',
      effect: 'deny',
    });
    await r.startWorker();
    const transitionRevoked = await waitForRunStatus(
      runtime,
      'review-finalization-v1',
      'waiting-authorization',
    );
    assert.equal(transitionRevoked.id, finalizationRun.id);
    let item = await r.f.request(runtime.path);
    assert.equal(item.body.state, 'ready-for-review');
    assert.equal(item.body.activeRun.id, finalizationRun.id);
    assert.equal(item.body.activeRun.status, 'waiting-authorization');
    await r.stopWorker();

    await r.startWorker();
    const restoredSnapshot = await waitForRunStatus(
      runtime,
      'review-finalization-v1',
      'waiting-authorization',
    );
    assert.equal(restoredSnapshot.id, finalizationRun.id);
    item = await r.f.request(runtime.path);
    assert.equal(item.body.activeRun.id, finalizationRun.id);
    assert.equal(item.body.activeRun.status, 'waiting-authorization');
    await r.stopWorker();
    await r.f.store.transaction((tx: any) => tx.remove('policy', transitionDeny.id));

    const approvalDeny = await setPolicy(r.f.store, {
      organization: 'alpha',
      user: r.f.alice.user.id,
      activity: 'approval.finalize-review',
      scope: 'organization',
      scopeId: 'alpha',
      effect: 'deny',
    });
    await r.startWorker();
    const approvalRevoked = await waitForRunStatus(
      runtime,
      'review-finalization-v1',
      'waiting-authorization',
    );
    assert.equal(approvalRevoked.id, finalizationRun.id);
    item = await r.f.request(runtime.path);
    assert.equal(item.body.state, 'ready-for-review');
    assert.equal(item.body.activeRun.id, finalizationRun.id);
    assert.equal(item.body.activeRun.status, 'waiting-authorization');
    await r.stopWorker();
    await r.f.store.transaction((tx: any) => tx.remove('policy', approvalDeny.id));

    await r.startWorker();
    await waitForState(r, runtime.path, 'completed');
    const finalRuns = await r.f.request(`${runtime.path}/reviews`);
    assert.equal(
      finalRuns.body.runs.find((run: any) => run.workflow === 'review-finalization-v1').id,
      finalizationRun.id,
    );
    const history = await r.f.request(`${runtime.path}/facts`);
    const transition = history.body.items.find(
      (fact: any) =>
        fact.kind === 'state.transition' && fact.payload.transition === 'finalize-review',
    );
    assert.equal(transition.payload.decision, newDecision.id);
    assert.equal(transition.payload.publication, resolved.publication.id);
  } finally {
    await runtime.close();
  }
});

test('A completed publication recovered from a lost provider response remains finalizable', async () => {
  const runtime = await publicationRuntime('github');
  const { r } = runtime;
  try {
    const prepared = await r.f.request(`${runtime.path}/transition-requests`, {
      operationId: 'prepare-recovered-finalization',
      transition: 'prepare-review',
      expectedState: 'registered',
      version: 4,
      inputs: { reviewBrief: 'Review and confirm the recovered publication.' },
    });
    assert.equal(prepared.status, 200);

    runtime.behavior('lost');
    assert.equal((await runtime.act('review-publications')).status, 200);
    await r.startWorker();
    await r.wait(runtime.path, 'publication-uncertain');
    runtime.behavior('success');
    assert.equal((await runtime.act('publication-reconciliation')).status, 200);
    const reconciled = await r.wait(runtime.path, 'publication-uncertain');
    const publication = reconciled.publications.find((item: any) => item.run === runtime.run.id);
    const completed = await runtime.act('publication-confirmation', {
      evidence: publication.evidence,
      resolution: 'completed',
      reason: 'Verified the existing provider comment after the lost response.',
      confirmedStopped: true,
    });
    assert.equal(completed.status, 200);
    assert.equal(completed.body.publication.status, 'completed');
    await r.stopWorker();

    await r.startWorker();
    const finalized = await r.f.request(`${runtime.path}/transition-requests`, {
      operationId: 'finalize-recovered-publication',
      transition: 'finalize-review',
      expectedState: 'ready-for-review',
      version: 4,
      inputs: { reportVersion: runtime.report.id },
    });
    assert.equal(finalized.status, 200);
    await waitForState(r, runtime.path, 'completed');
    const facts = await r.f.request(`${runtime.path}/facts`);
    const transition = facts.body.items.find(
      (fact: any) =>
        fact.kind === 'state.transition' && fact.payload.transition === 'finalize-review',
    );
    assert.equal(transition.payload.publication, completed.body.publication.id);
  } finally {
    await runtime.close();
  }
});

test('Finalization recovery verifies the report against its original Review Workflow', async () => {
  const runtime = await publicationRuntime('github');
  const { r } = runtime;
  try {
    await r.f.request(`${runtime.path}/transition-requests`, {
      operationId: 'prepare-recovery-finalization',
      transition: 'prepare-review',
      expectedState: 'registered',
      version: 4,
      inputs: { reviewBrief: 'Review before finalization recovery.' },
    });
    assert.equal((await runtime.act('review-publications')).status, 200);
    await r.startWorker();
    await waitForPublication(runtime, 'completed');
    await r.stopWorker();

    const accepted = await r.f.request(`${runtime.path}/transition-requests`, {
      operationId: 'accept-before-recovery',
      transition: 'finalize-review',
      expectedState: 'ready-for-review',
      version: 4,
      inputs: { reportVersion: runtime.report.id },
    });
    assert.equal(accepted.status, 200);
    const run = accepted.body.workflowRun;
    await r.f.store.transaction(async (tx: any) => {
      const current = await tx.get('workflow_run', run.id);
      await tx.put('workflow_run', { ...current, data: { ...current.data, status: 'running' } });
      const item = await tx.get('work_item', run.workItem);
      await tx.put('work_item', {
        ...item,
        activeRun: { id: run.id, workflow: current.data.workflow, status: 'running' },
      });
    });
    const recovered = await recoverStoppedRun(
      r.f.store,
      join(r.directory, 'worker'),
      run.id,
      join(r.directory, 'artifacts'),
    );
    assert.equal(recovered.status, 'queued');
    await r.startWorker();
    const item = await waitForState(r, runtime.path, 'completed');
    assert.equal(item.state, 'completed');
  } finally {
    await runtime.close();
  }
});

test('Stopped finalization cancellation terminates its Transition Request during operator recovery', async () => {
  const runtime = await publicationRuntime('github');
  const { r } = runtime;
  try {
    await prepareFactoryFinalization(runtime, 'prepare-recovery-cancellation');
    assert.equal((await runtime.act('review-publications')).status, 200);
    await r.startWorker();
    await waitForPublication(runtime, 'completed');
    await r.stopWorker();

    const accepted = await r.f.request(`${runtime.path}/transition-requests`, {
      operationId: 'accept-before-cancellation-recovery',
      transition: 'finalize-review',
      expectedState: 'ready-for-review',
      version: 4,
      inputs: { reportVersion: runtime.report.id },
    });
    assert.equal(accepted.status, 200);
    const run = accepted.body.workflowRun;
    await r.f.store.transaction(async (tx: any) => {
      const current = await tx.get('workflow_run', run.id);
      await tx.put('workflow_run', { ...current, data: { ...current.data, status: 'running' } });
      const item = await tx.get('work_item', run.workItem);
      await tx.put('work_item', {
        ...item,
        activeRun: { id: run.id, workflow: current.data.workflow, status: 'running' },
      });
    });
    const requested = await r.f.request(`${runtime.path}/workflow-cancellations`, {
      operationId: 'request-before-finalization-recovery',
      run: run.id,
    });
    assert.equal(requested.status, 200);

    const recovered = await recoverStoppedRun(
      r.f.store,
      join(r.directory, 'worker'),
      run.id,
      join(r.directory, 'artifacts'),
    );
    assert.equal(recovered.status, 'cancelled');
    const item = await r.f.request(runtime.path);
    assert.equal(item.body.state, 'ready-for-review');
    assert.equal(item.body.activeRun, undefined);
    const requests = await r.f.request(`${runtime.path}/transition-requests`);
    const finalizationRequest = requests.body.items.find(
      (request: any) => request.id === accepted.body.request.id,
    );
    assert.equal(finalizationRequest.status, 'cancelled');
    assert.equal(finalizationRequest.workflowRun, run.id);
    assert.equal(finalizationRequest.result.workflowRun, run.id);
    assert.match(finalizationRequest.error, /cancellation confirmed/i);
  } finally {
    await runtime.close();
  }
});

test('A database interruption rolls back finalization before public retry', async () => {
  const runtime = await publicationRuntime('github');
  const { r } = runtime;
  const operator = new Surreal();
  let eventInstalled = false;
  try {
    await r.f.request(`${runtime.path}/transition-requests`, {
      operationId: 'prepare-atomic-finalization',
      transition: 'prepare-review',
      expectedState: 'registered',
      version: 4,
      inputs: { reviewBrief: 'Review before an atomic finalization test.' },
    });
    assert.equal((await runtime.act('review-publications')).status, 200);
    await r.startWorker();
    await waitForPublication(runtime, 'completed');
    await r.stopWorker();

    const accepted = await r.f.request(`${runtime.path}/transition-requests`, {
      operationId: 'accept-atomic-finalization',
      transition: 'finalize-review',
      expectedState: 'ready-for-review',
      version: 4,
      inputs: { reportVersion: runtime.report.id },
    });
    assert.equal(accepted.status, 200);
    await operator.connect(r.f.config.url);
    await operator.signin({ username: r.f.config.username, password: r.f.config.password });
    await operator.use({ namespace: r.f.config.namespace, database: r.f.config.database });
    await operator.query(
      `DEFINE EVENT fail_finalization ON fact WHEN $event = 'CREATE' AND $after.kind = 'state.transition' AND $after.payload.transition = 'finalize-review' THEN { THROW 'Injected finalization transaction interruption'; };`,
    );
    eventInstalled = true;
    await r.startWorker();
    const failedRun = await waitForRunStatus(
      runtime,
      'review-finalization-v1',
      'waiting-prerequisites',
    );
    const item = await r.f.request(runtime.path);
    assert.equal(item.body.state, 'ready-for-review');
    assert.equal(item.body.activeRun.id, accepted.body.workflowRun.id);
    const facts = await r.f.request(`${runtime.path}/facts`);
    assert.equal(
      facts.body.items.some(
        (fact: any) =>
          fact.kind === 'state.transition' && fact.payload.transition === 'finalize-review',
      ),
      false,
    );
    const requests = await r.f.request(`${runtime.path}/transition-requests`);
    assert.equal(
      requests.body.items.find((request: any) => request.id === accepted.body.request.id).status,
      'running',
    );
    assert.equal(failedRun.workflow, 'review-finalization-v1');
    assert.match(failedRun.error, /finalize-review/);
    await operator.query('REMOVE EVENT fail_finalization ON fact;');
    eventInstalled = false;
    assert.equal((await waitForState(r, runtime.path, 'completed')).state, 'completed');
  } finally {
    if (eventInstalled)
      await operator.query('REMOVE EVENT fail_finalization ON fact;').catch(() => {});
    await operator.close();
    await runtime.close();
  }
});

test('Retained version 3 keeps its declared publication prerequisite but has no installed finalizer', async () => {
  const f = await fixture();
  try {
    await f.bootstrap('alpha');
    const base = '/api/organizations/alpha';
    await f.request(`${base}/work-item-types`, {
      operationId: 'select-v3',
      type: 'pull-request-review',
      version: 3,
      enabled: true,
    });
    const created = await f.request(`${base}/work-items`, {
      operationId: 'create-v3',
      project: 'alpha-project',
      title: 'Retained version three',
      type: 'pull-request-review',
    });
    const path = `${base}/work-items/${created.body.workItem.id}`;
    const transitionDefinition = (await f.request(`${base}/work-item-types`)).body.definitions
      .find((definition: any) => definition.version === 3)
      .transitions.find((transition: any) => transition.id === 'finalize-review');
    assert.ok(transitionDefinition.prerequisites.includes('Confirmed publication outcome'));
    await f.request(`${path}/transition-requests`, {
      operationId: 'prepare-v3',
      transition: 'prepare-review',
      expectedState: 'registered',
      version: 3,
      inputs: { reviewBrief: 'Retained semantics.' },
    });
    const board = await f.request(`${base}/board?type=pull-request-review`);
    const finalizer = board.body.items
      .find((item: any) => item.id === created.body.workItem.id)
      .transitions.find((transition: any) => transition.id === 'finalize-review');
    assert.equal(finalizer.available, false);
    assert.equal(finalizer.reason, 'Workflow not installed');
    const response = await f.request(`${path}/transition-requests`, {
      operationId: 'unavailable-v3-finalization',
      transition: 'finalize-review',
      expectedState: 'ready-for-review',
      version: 3,
      inputs: { reportVersion: 'a'.repeat(32) },
    });
    assert.equal(response.status, 409);
    assert.equal((await f.request(path)).body.state, 'ready-for-review');
  } finally {
    await f.close();
  }
});
