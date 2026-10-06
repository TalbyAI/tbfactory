import { randomUUID } from 'node:crypto';
import { createStep, createWorkflow } from '@mastra/core/workflows';
import { z } from 'zod';
import { authorization } from './authorization';
import { digest, fail, stable } from './contracts';
import { type Caller } from './auth';
import { type Factory } from './factory';
import { publicationCanBeCorrected, publicationForRun, type Publication } from './publications';
import {
  decisionUsable,
  executionCaller,
  reportCurrent,
  runView,
  scopeOf,
  type Run,
} from './reviews';
import { type Row, type Store, type Transaction } from './store';
import { supportsFinalization } from './work-item-types';

export type FinalizationEvidence = {
  reviewRun: string;
  report: string;
  decision: string;
  publication: string | null;
  publicationStatus: string | null;
};

function completeDecision(report: Row, decision: Row, reviewRun: Run) {
  const reportFindings = (report.data as any).findings;
  const payload = decision.payload as any;
  const submitted = payload.findings;
  if (
    payload.run !== reviewRun.id ||
    payload.reportVersion !== report.id ||
    payload.reviewed !== true ||
    payload.approvalPoint !== 'review.decide' ||
    !Array.isArray(reportFindings) ||
    !Array.isArray(submitted) ||
    submitted.length !== reportFindings.length
  )
    return false;
  const decisions = new Map<string, any>();
  for (const finding of submitted) {
    if (
      !finding ||
      typeof finding.finding !== 'string' ||
      decisions.has(finding.finding) ||
      !['confirmed', 'rejected'].includes(finding.decision) ||
      (finding.decision === 'rejected' && !String(finding.reason ?? '').trim())
    )
      return false;
    decisions.set(finding.finding, finding);
  }
  return reportFindings.every(
    (finding: any) => typeof finding.id === 'string' && decisions.has(finding.id),
  );
}

async function latestReport(tx: Transaction, item: Row) {
  const reports = await tx.list(
    'review_report',
    'organization = $organization AND workItem = $workItem',
    { organization: item.organization, workItem: item.id },
  );
  return reports.sort(
    (a, b) =>
      Number((b.data as any).createdAt) - Number((a.data as any).createdAt) ||
      b.id.localeCompare(a.id),
  )[0];
}

async function publicationOutcome(
  tx: Transaction,
  item: Row,
  reviewRun: Run,
  report: Row,
  decision: Row,
): Promise<{ publication: Publication; status: string }> {
  const publication = await publicationForRun(tx, reviewRun);
  if (!publication) fail(409, 'Confirmed publication outcome required');
  const data = publication.data as Publication['data'];
  if (
    publication.organization !== item.organization ||
    publication.workItem !== item.id ||
    publication.run !== reviewRun.id ||
    data.report !== report.id ||
    data.decision !== decision.id
  )
    fail(409, 'Publication outcome does not match the current report and Review Decision');

  const facts = await tx.list(
    'fact',
    'organization = $organization AND workItem = $workItem AND kind IN $kinds',
    {
      organization: item.organization,
      workItem: item.id,
      kinds: [
        'publication.completed',
        'publication.skipped',
        'publication.recovery-decided',
        'publication.cancelled-before-dispatch',
        'workflow.cancellation-confirmed',
      ],
    },
  );
  const activityFacts = facts.filter((fact) => (fact.payload as any).activity === publication.id);
  const confirmedFindings = ((decision.payload as any).findings as any[]).filter(
    (finding) => finding.decision === 'confirmed',
  );
  if (data.status === 'completed') {
    const completed = activityFacts.some(
      (fact) =>
        fact.kind === 'publication.completed' &&
        (fact.payload as any).run === reviewRun.id &&
        (fact.payload as any).attempt === data.attempt &&
        (!(fact.payload as any).decision || (fact.payload as any).decision === decision.id),
    );
    const recovery = activityFacts.some(
      (fact) =>
        fact.kind === 'publication.recovery-decided' &&
        (fact.payload as any).run === reviewRun.id &&
        (fact.payload as any).attempt === data.attempt &&
        (fact.payload as any).resolution === 'completed' &&
        (fact.payload as any).evidence === data.evidence,
    );
    const immutableCompletion = activityFacts.some(
      (fact) =>
        fact.kind === 'publication.completed' &&
        (fact.payload as any).run === reviewRun.id &&
        (fact.payload as any).attempt === data.attempt &&
        (fact.payload as any).userConfirmed === true,
    );
    if (!confirmedFindings.length || !completed || !(data.effect || data.effects?.length))
      fail(409, 'Completed publication evidence required for confirmed Findings');
    if (!((data.decision === decision.id && completed) || (recovery && immutableCompletion)))
      fail(409, 'Publication completion must bind the current Review Decision');
    return { publication, status: data.status };
  }
  if (data.status === 'skipped') {
    const skipped = activityFacts.some(
      (fact) =>
        fact.kind === 'publication.skipped' &&
        (fact.payload as any).run === reviewRun.id &&
        (fact.payload as any).decision === decision.id,
    );
    if (confirmedFindings.length || data.content || !skipped)
      fail(409, 'A skipped publication requires no confirmed Findings');
    return { publication, status: data.status };
  }
  if (data.status === 'not-published') {
    const recovery = activityFacts.some(
      (fact) =>
        fact.kind === 'publication.recovery-decided' &&
        (fact.payload as any).run === reviewRun.id &&
        (fact.payload as any).resolution === 'not-published' &&
        (fact.payload as any).evidence === data.evidence,
    );
    const cancellation = facts.some(
      (fact) =>
        fact.kind === 'publication.cancelled-before-dispatch' &&
        (fact.payload as any).run === reviewRun.id &&
        (fact.payload as any).activity === publication.id &&
        (fact.payload as any).attempt === data.attempt &&
        (fact.payload as any).evidence === data.evidence,
    );
    const cancellationConfirmed = facts.some(
      (fact) =>
        fact.kind === 'workflow.cancellation-confirmed' &&
        (fact.payload as any).run === reviewRun.id &&
        (fact.payload as any).publication === publication.id &&
        (fact.payload as any).attempt === data.attempt &&
        (fact.payload as any).evidenceFact === data.evidence &&
        (fact.payload as any).evidence?.providerOutcome === 'not-published',
    );
    const noDispatchEvidence = data.evidence ? await tx.get('fact', data.evidence) : undefined;
    const noDispatchPayload = noDispatchEvidence?.payload as any;
    const safelyCancelled =
      cancellation &&
      cancellationConfirmed &&
      noDispatchEvidence?.kind === 'publication.evidence' &&
      noDispatchPayload.activity === publication.id &&
      noDispatchPayload.run === reviewRun.id &&
      noDispatchPayload.attempt === data.attempt &&
      noDispatchPayload.noDispatch === true &&
      noDispatchPayload.cancelledBeforeDispatch === true &&
      noDispatchPayload.complete === true &&
      Array.isArray(noDispatchPayload.matches) &&
      noDispatchPayload.matches.length === 0;
    if (
      !confirmedFindings.length ||
      !(recovery || safelyCancelled) ||
      !(await publicationCanBeCorrected(tx, publication))
    )
      fail(409, 'Confirmed non-publication evidence required');
    return { publication, status: data.status };
  }
  fail(409, 'Confirmed publication outcome required');
}

export async function finalizationEvidence(
  tx: Transaction,
  item: Row,
  reportVersion: string,
): Promise<FinalizationEvidence> {
  if (!supportsFinalization(item.version))
    fail(409, 'Review Finalization Workflow unavailable for retained Work Item Type');
  const report = await tx.get('review_report', reportVersion);
  const latest = await latestReport(tx, item);
  if (
    !report ||
    report.id !== latest?.id ||
    report.organization !== item.organization ||
    report.workItem !== item.id ||
    (report.data as any).version !== report.id
  )
    fail(409, 'Current report version required');
  if (!(await reportCurrent(tx, item, report))) fail(409, 'Current report inputs required');

  const reviewRun = (await tx.get('workflow_run', String(report.run))) as Run | undefined;
  if (
    !reviewRun ||
    reviewRun.organization !== item.organization ||
    reviewRun.workItem !== item.id ||
    reviewRun.data.workflow !== 'review-v1' ||
    reviewRun.data.report !== report.id ||
    !reviewRun.data.decision
  )
    fail(409, 'Completed Review Workflow required');
  const completed = await tx.list(
    'fact',
    'organization = $organization AND workItem = $workItem AND kind = $kind',
    { organization: item.organization, workItem: item.id, kind: 'workflow.completed' },
  );
  if (
    !completed.some(
      (fact) =>
        (fact.payload as any).run === reviewRun.id &&
        (fact.payload as any).workflow === 'review-v1' &&
        (fact.payload as any).report === report.id,
    )
  )
    fail(409, 'Completed Review Workflow required');
  const decision = await tx.get('fact', reviewRun.data.decision);
  if (
    !decision ||
    !completeDecision(report, decision, reviewRun) ||
    !(await decisionUsable(tx, item, reviewRun, decision))
  )
    fail(409, 'Complete current human Review Decision required');

  const outcome = await publicationOutcome(tx, item, reviewRun, report, decision);
  return {
    reviewRun: reviewRun.id,
    report: report.id,
    decision: decision.id,
    publication: outcome.publication.id,
    publicationStatus: outcome.status,
  };
}

export async function finalizationAvailability(tx: Transaction, item: Row) {
  if (!supportsFinalization(item.version))
    return { reportVersion: undefined, reason: 'Workflow not installed' };
  const report = await latestReport(tx, item);
  if (!report) return { reportVersion: undefined, reason: 'Current report version required' };
  try {
    await finalizationEvidence(tx, item, report.id);
    return { reportVersion: report.id, reason: undefined };
  } catch (error: any) {
    if (error.status === 409) return { reportVersion: report.id, reason: error.message as string };
    throw error;
  }
}

export const transitionApprovalBinding = (request: Row) =>
  digest(
    stable({
      workItem: request.workItem,
      organization: request.organization,
      user: request.user,
      credential: request.credential,
      transition: request.transition,
      expectedState: request.expectedState,
      version: request.version,
      sequence: request.sequence,
      inputs: request.inputs,
      ...(request.transition === 'finalize-review'
        ? { finalizationEvidence: request.finalizationEvidence }
        : {}),
    }),
  );

type FinalizationAuthority = { authorized: boolean; requiresApproval: boolean };

async function currentAuthority(
  tx: Transaction,
  item: Row,
  run: Run,
  request: Row,
): Promise<FinalizationAuthority> {
  const caller = await executionCaller(tx, run);
  const permission = await authorization(tx, caller, 'transition.finalize-review', scopeOf(item));
  const approval = request.approval as { fact: string; actor: string; binding: string } | undefined;
  if (permission.requiresHuman && !approval) return { authorized: false, requiresApproval: true };
  if (!approval) return { authorized: true, requiresApproval: permission.requiresHuman };
  const binding = transitionApprovalBinding(request);
  if (approval.binding !== binding) fail(409, 'Activity-bound Approval required');
  const fact = await tx.get('fact', approval.fact);
  const payload = fact?.payload as any;
  if (
    fact?.kind !== 'activity.approved' ||
    payload.request !== request.id ||
    payload.activity !== 'transition.finalize-review' ||
    payload.binding !== binding
  )
    fail(409, 'Activity-bound Approval required');
  await authorization(
    tx,
    { user: approval.actor, human: true },
    'approval.finalize-review',
    scopeOf(item),
  );
  return { authorized: true, requiresApproval: permission.requiresHuman };
}

export async function finalizationAuthorizationReady(store: Store, run: Run, workerOwner: string) {
  return store.transaction(async (tx) => {
    const owner = (await tx.get('worker_owner', 'review'))?.data as any;
    if (owner?.owner !== workerOwner) return false;
    const currentRun = (await tx.get('workflow_run', run.id)) as Run | undefined;
    if (
      !currentRun ||
      currentRun.data.token !== run.data.token ||
      ['completed', 'rejected', 'cancelled', 'stopped', 'superseded'].includes(
        currentRun.data.status,
      )
    )
      return false;
    if (cancellationPending(currentRun)) return false;
    const item = await tx.get('work_item', currentRun.workItem);
    const request = currentRun.data.finalization?.request
      ? await tx.get('transition_request', currentRun.data.finalization.request)
      : undefined;
    if (!item || !request || (item.activeRun as any)?.id !== currentRun.id) return false;
    try {
      const authority = await currentAuthority(tx, item, currentRun, request);
      if (!authority.authorized && authority.requiresApproval) {
        await rejectFinalization(
          tx,
          item,
          request,
          currentRun,
          'Current transition policy requires a new Activity-bound Approval',
        );
        return false;
      }
      return true;
    } catch (error: any) {
      if ([403, 404].includes(error.status)) return false;
      throw error;
    }
  });
}

function workflowFact(
  item: Row,
  actor: string,
  kind: string,
  payload: Record<string, unknown>,
): Row {
  return {
    id: randomUUID(),
    organization: item.organization,
    workItem: item.id,
    kind,
    actor,
    recordedAt: Date.now(),
    payload,
  };
}

export async function acceptReviewFinalization(
  factory: Factory,
  tx: Transaction,
  caller: Caller,
  item: Row,
  request: Row,
) {
  if (item.activeRun) fail(409, 'An active Workflow Run owns this Work Item');
  const evidence = await finalizationEvidence(
    tx,
    item,
    String((request.inputs as any).reportVersion),
  );
  if (stable(request.finalizationEvidence) !== stable(evidence))
    fail(409, 'Finalization evidence changed; request a new Approval');
  const id = digest(`review-finalization-v1:${request.id}`);
  const existing = (await tx.get('workflow_run', id)) as Run | undefined;
  if (existing) {
    if (
      existing.organization !== item.organization ||
      existing.workItem !== item.id ||
      existing.data.finalization?.request !== request.id
    )
      fail(409, 'Finalization request binding mismatch');
    return {
      workflowRun: runView(existing),
      workItem: item,
      request: await tx.get('transition_request', request.id),
    };
  }
  const run: Run = {
    id,
    organization: String(item.organization),
    workItem: item.id,
    data: {
      workflow: 'review-finalization-v1',
      status: 'queued',
      token: randomUUID(),
      identity: {
        kind: 'user',
        user: String(request.user),
        credential: typeof request.credential === 'string' ? request.credential : undefined,
        activities: Array.isArray(request.activities)
          ? (request.activities as string[])
          : caller.activities,
      },
      brief: 'Finalize the current reviewed report',
      createdAt: Date.now(),
      report: evidence.report,
      decision: evidence.decision,
      publication: evidence.publication ?? undefined,
      finalization: {
        request: request.id,
        ...evidence,
        publication: evidence.publication,
        state: String(item.state),
        transitionSequence: Number(item.transitionSequence ?? 0),
        typeVersion: Number(item.version),
      },
      calls: 0,
      aiMs: 0,
      executionMs: 0,
    },
  };
  await tx.create('workflow_run', run);
  const updated = await tx.put('work_item', {
    ...item,
    activeRun: { id: run.id, workflow: run.data.workflow, status: run.data.status },
  });
  const updatedRequest = await tx.put('transition_request', {
    ...request,
    status: 'running',
    workflowRun: run.id,
    result: { workflowRun: run.id },
  });
  await factory.fact(tx, caller, item, 'workflow.accepted', {
    run: run.id,
    workflow: run.data.workflow,
    request: request.id,
    executionIdentity: run.data.identity,
    prerequisites: evidence,
  });
  return { workflowRun: runView(run), workItem: updated, request: updatedRequest };
}

async function rejectFinalization(
  tx: Transaction,
  item: Row,
  request: Row,
  run: Run,
  reason: string,
) {
  const currentRun = (await tx.get('workflow_run', run.id)) as Run | undefined;
  if (!currentRun || currentRun.data.token !== run.data.token)
    fail(409, 'Finalization Workflow execution changed');
  if (cancellationPending(currentRun))
    return { status: 'cancellation-pending' as const, run: currentRun };
  const currentItem = await tx.get('work_item', item.id);
  const currentRequest = await tx.get('transition_request', request.id);
  if (
    !currentItem ||
    !currentRequest ||
    (currentItem.activeRun as any)?.id !== currentRun.id ||
    currentRequest.workflowRun !== currentRun.id
  )
    fail(409, 'Finalization Workflow ownership lost');
  const data = { ...currentRun.data, status: 'rejected', error: reason };
  const updated = await tx.put('workflow_run', { ...currentRun, data });
  const workItem = await tx.put('work_item', { ...currentItem, activeRun: undefined });
  const result = { error: reason, workflowRun: currentRun.id, workItem };
  await tx.put('transition_request', { ...currentRequest, status: 'rejected', result });
  await tx.create(
    'fact',
    workflowFact(currentItem, currentRun.data.identity.user, 'workflow.rejected', {
      run: currentRun.id,
      workflow: currentRun.data.workflow,
      request: currentRequest.id,
      reason,
    }),
  );
  return { status: 'rejected' as const, run: updated };
}

const cancellationPending = (run: Run) =>
  !!run.data.cancellation &&
  ['requested', 'awaiting-publication-resolution'].includes(run.data.cancellation.status);

export async function completeReviewFinalization(store: Store, id: string, workerOwner: string) {
  return store.transaction(async (tx) => {
    const owner = (await tx.get('worker_owner', 'review'))?.data as any;
    if (owner?.owner !== workerOwner) fail(409, 'Worker ownership lost');
    const run = (await tx.get('workflow_run', id)) as Run | undefined;
    if (!run || run.data.workflow !== 'review-finalization-v1')
      fail(404, 'Finalization Workflow Run unavailable');
    if (['completed', 'rejected', 'stopped', 'superseded'].includes(run.data.status))
      return { status: run.data.status, run };
    if (cancellationPending(run)) return { status: 'cancellation-pending' as const, run };
    const item = await tx.get('work_item', run.workItem);
    const request = run.data.finalization?.request
      ? await tx.get('transition_request', run.data.finalization.request)
      : undefined;
    if (!item || !request || request.workflowRun !== run.id)
      fail(409, 'Finalization request ownership lost');
    if ((item.activeRun as any)?.id !== run.id || request.status !== 'running')
      fail(409, 'Finalization Workflow ownership lost');
    if (
      request.transition !== 'finalize-review' ||
      request.expectedState !== item.state ||
      request.version !== item.version ||
      request.sequence !== Number(item.transitionSequence ?? 0) ||
      request.user !== run.data.identity.user ||
      request.credential !== run.data.identity.credential
    )
      return rejectFinalization(
        tx,
        item,
        request,
        run,
        'Transition Request no longer matches Factory state or Execution Identity',
      );

    let executor: Caller;
    let authority: FinalizationAuthority;
    try {
      executor = await executionCaller(tx, run);
      authority = await currentAuthority(tx, item, run, request);
    } catch (error: any) {
      if (![401, 403, 404].includes(error.status)) throw error;
      const data = { ...run.data, status: 'waiting-authorization', error: error.message };
      await tx.put('workflow_run', { ...run, data });
      await tx.put('work_item', {
        ...item,
        activeRun: { id: run.id, workflow: run.data.workflow, status: data.status },
      });
      return { status: 'waiting-authorization' as const, run: { ...run, data } };
    }
    if (authority.requiresApproval && !authority.authorized)
      return rejectFinalization(
        tx,
        item,
        request,
        run,
        'Current transition policy requires Approval before finalization',
      );

    let evidence: FinalizationEvidence;
    try {
      evidence = await finalizationEvidence(
        tx,
        item,
        String((request.inputs as any).reportVersion),
      );
    } catch (error: any) {
      if (error.status !== 409) throw error;
      return rejectFinalization(tx, item, request, run, error.message);
    }
    const bound = run.data.finalization;
    if (
      !bound ||
      item.state !== bound.state ||
      Number(item.transitionSequence ?? 0) !== bound.transitionSequence ||
      Number(item.version) !== bound.typeVersion ||
      stable(evidence) !==
        stable({
          reviewRun: bound.reviewRun,
          report: bound.report,
          decision: bound.decision,
          publication: bound.publication,
          publicationStatus: bound.publicationStatus,
        })
    )
      return rejectFinalization(
        tx,
        item,
        request,
        run,
        'Finalization inputs changed; request a current review before finalizing',
      );

    // Cancellation can be requested while authority and evidence are being rechecked.
    const currentRun = (await tx.get('workflow_run', id)) as Run | undefined;
    if (!currentRun || currentRun.data.token !== run.data.token)
      fail(409, 'Finalization Workflow execution changed');
    if (cancellationPending(currentRun))
      return { status: 'cancellation-pending' as const, run: currentRun };

    const sequence = Number(item.transitionSequence ?? 0) + 1;
    const state = 'completed';
    const workItem = await tx.put('work_item', {
      ...item,
      state,
      transitionSequence: sequence,
      activeRun: undefined,
    });
    const fact = workflowFact(item, executor.user, 'state.transition', {
      request: request.id,
      run: run.id,
      transition: 'finalize-review',
      from: item.state,
      to: state,
      version: item.version,
      sequence,
      executionIdentity: run.data.identity,
      inputs: request.inputs,
      prerequisites: evidence,
      report: evidence.report,
      decision: evidence.decision,
      publication: evidence.publication,
      approval: request.approval ?? null,
    });
    await tx.create('fact', fact);
    const requestResult = { workItem, fact };
    await tx.put('transition_request', {
      ...request,
      status: 'completed',
      result: requestResult,
    });
    await tx.put('workflow_run', {
      ...run,
      data: { ...run.data, status: 'completed', error: undefined },
    });
    await tx.create(
      'fact',
      workflowFact(item, executor.user, 'workflow.completed', {
        run: run.id,
        workflow: run.data.workflow,
        transition: fact.id,
        report: evidence.report,
        decision: evidence.decision,
        publication: evidence.publication,
      }),
    );
    return { status: 'completed' as const, run: { ...run, data: { ...run.data, status: state } } };
  });
}

export function reviewFinalizationWorkflow(store: Store, workerOwner: string) {
  const schema = z.object({ run: z.string() });
  const finalize = createStep({
    id: 'finalize-review',
    inputSchema: schema,
    outputSchema: schema,
    resumeSchema: z.object({ recheck: z.boolean() }),
    suspendSchema: z.object({ reason: z.string() }),
    execute: async ({ inputData, suspend }) => {
      const result = await completeReviewFinalization(store, inputData.run, workerOwner);
      if (result.status === 'waiting-authorization')
        return suspend({ reason: 'Current execution or Approval authority required' });
      if (result.status === 'cancellation-pending')
        return suspend({ reason: 'Cancellation stop confirmation required' });
      return inputData;
    },
  });
  return createWorkflow({
    id: 'review-finalization-v1',
    inputSchema: schema,
    outputSchema: schema,
  })
    .then(finalize)
    .commit();
}
