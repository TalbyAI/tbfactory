import { test } from 'node:test';
import assert from 'node:assert/strict';
import { reviewRuntime } from './support/review-runtime';
import { setPolicy } from '../src/server/operator';
import { provision } from '../src/server/provision';

const start = (r: Awaited<ReturnType<typeof reviewRuntime>>, path: string) =>
  r.f.request(`${path}/transition-requests`, {
    operationId: 'start',
    transition: 'request-review',
    version: 3,
    expectedState: 'registered',
    inputs: { reviewBrief: 'Review the repository' },
  });

async function waitRun(
  r: Awaited<ReturnType<typeof reviewRuntime>>,
  path: string,
  id: string,
  status: string,
) {
  const deadline = Date.now() + 30000;
  let view: any;
  do {
    view = (await r.f.request(`${path}/reviews`)).body;
    if (view.runs?.find((run: any) => run.id === id)?.status === status) return view;
    await new Promise((resolve) => setTimeout(resolve, 100));
  } while (Date.now() < deadline);
  assert.fail(`Run did not reach ${status}: ${JSON.stringify(view)}`);
}

test('A consolidated human Review Decision resumes the same run after restart without changing Factory state', async () => {
  const r = await reviewRuntime();
  try {
    r.behavior('report');
    const path = await r.createItem('decision');
    await r.startWorker();
    await start(r, path);
    const view = await r.wait(path, 'waiting-review');
    const report = view.reports[0];
    const run = view.runs.find((run: any) => run.status === 'waiting-review');
    await r.stopWorker();
    const input = {
      operationId: 'decision',
      run: run.id,
      reportVersion: report.version,
      reviewed: true,
      findings: [
        {
          finding: report.findings[0].id,
          decision: 'rejected',
          reason: 'Expected test configuration',
        },
      ],
    };
    const submitted = await r.f.request(`${path}/review-decisions`, input);
    assert.equal(submitted.status, 200);
    assert.equal(submitted.body.fact.kind, 'review.decision');
    assert.equal(submitted.body.fact.actor, r.f.alice.user.id);
    assert.deepEqual(submitted.body.fact.payload.findings, input.findings);
    assert.deepEqual((await r.f.request(`${path}/review-decisions`, input)).body, submitted.body);
    assert.ok((await r.f.request(path)).body.activeRun);
    await r.startWorker();
    const completed = await waitRun(r, path, run.id, 'completed');
    assert.equal(completed.runs.find((r: any) => r.id === run.id).status, 'completed');
    assert.equal(completed.decisions[0].usable, true);
    assert.deepEqual(completed.reports[0], report);
    assert.equal(r.requests.length, 1);
    assert.equal((await r.f.request(path)).body.state, 'registered');
    assert.equal((await r.f.request(path)).body.activeRun, undefined);
    const history = (await r.f.request(`${path}/facts`)).body.items;
    assert.equal(history.filter((f: any) => f.kind === 'review.decision').length, 1);
    assert.equal(history.filter((f: any) => f.kind === 'workflow.completed').length, 1);
    assert.equal(history.filter((f: any) => f.kind === 'activity.approved').length, 0);
  } finally {
    await r.close();
  }
});

test('Relevant updates require a replacement report and renewed human review while unrelated Facts preserve decisions', async () => {
  const r = await reviewRuntime();
  try {
    r.behavior('mixed');
    const path = await r.createItem('revalidation');
    await r.startWorker();
    await start(r, path);
    const first = await r.wait(path, 'waiting-review');
    const report = first.reports[0],
      run = first.runs.find((r: any) => r.status === 'waiting-review');
    await r.stopWorker();
    const input = {
      operationId: 'initial-decision',
      run: run.id,
      reportVersion: report.version,
      reviewed: true,
      findings: report.findings.map((f: any) => ({ finding: f.id, decision: 'confirmed' })),
    };
    const decision = await r.f.request(`${path}/review-decisions`, input);
    assert.equal(decision.status, 200);
    await r.f.request(`${path}/notes`, {
      operationId: 'unrelated-note',
      text: 'CI results are evidence only',
    });
    assert.equal((await r.f.request(`${path}/reviews`)).body.decisions[0].usable, true);
    await r.f.request(`${path}/review-facts`, {
      operationId: 'new-version',
      fields: { sourceCommit: r.head },
    });
    assert.equal((await r.f.request(`${path}/reviews`)).body.decisions[0].usable, false);
    await r.startWorker();
    await waitRun(r, path, run.id, 'waiting-revalidation');
    assert.equal(
      (
        await r.f.request(`${path}/review-decisions`, {
          ...input,
          operationId: 'stale-decision',
          replaces: decision.body.fact.id,
        })
      ).status,
      409,
    );
    assert.ok((await r.f.request(path)).body.activeRun);
    assert.equal(
      (await r.f.request(`${path}/review-supersession`, { operationId: 'supersede', run: run.id }))
        .status,
      200,
    );
    assert.equal(
      (
        await r.f.request(`${path}/transition-requests`, {
          operationId: 'rerun',
          transition: 'request-review',
          version: 3,
          expectedState: 'registered',
          inputs: { reviewBrief: 'Revalidate prior Findings' },
        })
      ).status,
      200,
    );
    const next = await r.wait(path, 'waiting-review');
    const nextReport = next.reports.find((r: any) => r.id !== report.id);
    const nextRun = next.runs.find((r: any) => r.status === 'waiting-review');
    assert.notEqual(nextReport.version, report.version);
    assert.deepEqual(
      next.reports.find((r: any) => r.id === report.id),
      report,
    );
    assert.equal(next.decisions[0].usable, false);
    assert.equal(
      (
        await r.f.request(`${path}/review-decisions`, {
          ...input,
          operationId: 'wrong-replacement-report',
          run: nextRun.id,
        })
      ).status,
      409,
    );
    const renewed = await r.f.request(`${path}/review-decisions`, {
      operationId: 'renewed',
      run: nextRun.id,
      reportVersion: nextReport.version,
      reviewed: true,
      findings: nextReport.findings.map((f: any) => ({ finding: f.id, decision: 'confirmed' })),
    });
    assert.equal(renewed.status, 200);
    await waitRun(r, path, nextRun.id, 'completed');
    const correction = await r.f.request(`${path}/review-decisions`, {
      operationId: 'correct-decision',
      run: nextRun.id,
      reportVersion: nextReport.version,
      reviewed: true,
      replaces: renewed.body.fact.id,
      findings: nextReport.findings.map((f: any) => ({
        finding: f.id,
        decision: 'rejected',
        reason: 'Further evidence disproves this proposal',
      })),
    });
    assert.equal(correction.status, 200);
    assert.equal(correction.body.fact.correctedFact, renewed.body.fact.id);
    const corrected = (await r.f.request(`${path}/reviews`)).body;
    assert.equal(corrected.decisions.filter((d: any) => d.usable).length, 1);
    assert.equal(corrected.decisions.find((d: any) => d.id === renewed.body.fact.id).usable, false);
    assert.deepEqual(
      corrected.decisions.find((d: any) => d.id === renewed.body.fact.id).payload.findings,
      renewed.body.fact.payload.findings,
    );
    assert.equal(r.requests.length, 2);
    assert.equal((await r.f.request(path)).body.state, 'registered');
  } finally {
    await r.close();
  }
});

test('An empty report requires explicit human review and current execution permission after submission', async () => {
  const r = await reviewRuntime();
  try {
    r.behavior('empty');
    const path = await r.createItem('empty-decision');
    await r.startWorker();
    await start(r, path);
    const view = await r.wait(path, 'waiting-review');
    const report = view.reports[0],
      run = view.runs.find((run: any) => run.status === 'waiting-review');
    await r.stopWorker();
    const input = {
      operationId: 'empty-reviewed',
      run: run.id,
      reportVersion: report.version,
      reviewed: true,
      findings: [],
    };
    const { reviewed: _, ...missingConfirmation } = input;
    assert.equal((await r.f.request(`${path}/review-decisions`, missingConfirmation)).status, 422);
    const reviewer = await r.f.login('reviewer');
    await provision(r.f.store, {
      organization: { id: 'alpha', name: 'Alpha' },
      projects: [],
      members: [
        {
          issuer: r.f.op.issuer,
          subject: 'reviewer',
          grants: ['work-item.read', 'artifact.read', 'approval.review-decide'].map((activity) => ({
            activity,
            scope: 'organization',
            scopeId: 'alpha',
            effect: 'allow',
          })),
        },
      ],
    });
    const submitted = await r.f.request(`${path}/review-decisions`, input, reviewer.token);
    assert.equal(submitted.status, 200);
    assert.equal(submitted.body.fact.actor, reviewer.user.id);
    const denial = await setPolicy(r.f.store, {
      organization: 'alpha',
      user: r.f.alice.user.id,
      activity: 'review.generate',
      scope: 'repository',
      scopeId: 'alpha-repo',
      effect: 'deny',
    });
    await r.startWorker();
    await waitRun(r, path, run.id, 'waiting-authorization');
    assert.ok((await r.f.request(path)).body.activeRun);
    await r.stopWorker();
    await r.startWorker();
    await waitRun(r, path, run.id, 'waiting-authorization');
    await r.f.request(`/api/organizations/alpha/policies/${denial.id}/remove`, {
      operationId: 'restore-execution',
    });
    const completed = await waitRun(r, path, run.id, 'completed');
    assert.equal(completed.decisions[0].usable, true);
    assert.equal(r.requests.length, 1);
    assert.equal((await r.f.request(path)).body.state, 'registered');
  } finally {
    await r.close();
  }
});

test('Generation Approval cannot be submitted or reused after relevant input versions change', async () => {
  const r = await reviewRuntime();
  try {
    r.behavior('report');
    const path = await r.createItem('approval-freshness');
    await setPolicy(r.f.store, {
      organization: 'alpha',
      user: r.f.alice.user.id,
      activity: 'review.generate',
      scope: 'organization',
      scopeId: 'alpha',
      effect: 'human',
    });
    await r.startWorker();
    await start(r, path);
    const pending = await r.wait(path, 'waiting-approval');
    const run = pending.runs.find((run: any) => run.status === 'waiting-approval');
    await r.stopWorker();
    await r.f.request(`${path}/review-facts`, {
      operationId: 'changed-branch',
      fields: { sourceBranch: 'renamed-feature' },
    });
    assert.equal(
      (await r.f.request(`${path}/review-approval`, { operationId: 'stale-approval', run: run.id }))
        .status,
      409,
    );
    assert.equal(r.requests.length, 0);
    assert.equal(
      (
        await r.f.request(`${path}/review-supersession`, {
          operationId: 'replace-stale-generation',
          run: run.id,
        })
      ).status,
      200,
    );
    await r.f.request(`${path}/transition-requests`, {
      operationId: 'replacement',
      transition: 'request-review',
      version: 3,
      expectedState: 'registered',
      inputs: { reviewBrief: 'Review current inputs' },
    });
    await r.startWorker();
    const next = await r.wait(path, 'waiting-approval');
    const nextRun = next.runs.find((run: any) => run.status === 'waiting-approval');
    assert.notEqual(nextRun.id, run.id);
    await r.stopWorker();
    const approval = await r.f.request(`${path}/review-approval`, {
      operationId: 'current-approval',
      run: nextRun.id,
    });
    assert.equal(approval.status, 200);
    await r.f.request(`${path}/review-facts`, {
      operationId: 'changed-before-dispatch',
      fields: { targetBranch: 'release' },
    });
    await r.startWorker();
    await waitRun(r, path, nextRun.id, 'stopped');
    assert.equal(r.requests.length, 0);
    assert.equal((await r.f.request(path)).body.activeRun, undefined);
    const history = (await r.f.request(`${path}/facts`)).body.items;
    const fact = history.find((f: any) => f.kind === 'activity.approved');
    assert.equal(fact.payload.activity, 'review.generate');
    assert.ok(fact.payload.relevantInputs.bindings.sourceBranch);
  } finally {
    await r.close();
  }
});

test('Only an authorized human can submit every Finding once with rejection reasons for the bound report version', async () => {
  const r = await reviewRuntime();
  try {
    r.behavior('mixed');
    const path = await r.createItem('mixed');
    await r.startWorker();
    await start(r, path);
    const view = await r.wait(path, 'waiting-review');
    await r.stopWorker();
    const report = view.reports[0],
      run = view.runs.find((run: any) => run.status === 'waiting-review');
    const findings = [
      { finding: report.findings[0].id, decision: 'confirmed' },
      { finding: report.findings[1].id, decision: 'rejected', reason: 'The value is intentional' },
    ];
    const input = {
      operationId: 'mixed-decision',
      run: run.id,
      reportVersion: report.version,
      reviewed: true,
      findings,
    };
    for (const [name, changes, status] of [
      ['incomplete', { findings: findings.slice(0, 1) }, 422],
      ['duplicate', { findings: [findings[0], findings[0]] }, 422],
      ['foreign-finding', { findings: [findings[0], { ...findings[1], finding: 'foreign' }] }, 422],
      [
        'no-reason',
        { findings: [findings[0], { finding: findings[1].finding, decision: 'rejected' }] },
        422,
      ],
      ['blank-reason', { findings: [findings[0], { ...findings[1], reason: ' ' }] }, 422],
      ['not-reviewed', { reviewed: false }, 422],
      ['wrong-report', { reportVersion: 'other-version' }, 409],
      ['wrong-run', { run: 'other-run' }, 404],
    ] as const)
      assert.equal(
        (await r.f.request(`${path}/review-decisions`, { ...input, ...changes, operationId: name }))
          .status,
        status,
        name,
      );
    const bob = await r.f.login('bob');
    assert.equal((await r.f.request(`${path}/review-decisions`, input, bob.token)).status, 404);
    assert.equal(
      (await r.f.request(path.replace('/alpha/', '/beta/') + '/review-decisions', input)).status,
      404,
    );
    const key = await r.f.request('/api/organizations/alpha/api-credentials', {
      operationId: 'decision-key',
      label: 'Cannot act as a human',
      activities: ['work-item.read', 'artifact.read', 'approval.review-decide'],
      expiresAt: Date.now() + 3600000,
    });
    assert.equal(
      (await r.f.request(`${path}/review-decisions`, input, key.body.token, true)).status,
      403,
    );
    const denial = await setPolicy(r.f.store, {
      organization: 'alpha',
      user: r.f.alice.user.id,
      activity: 'approval.review-decide',
      scope: 'repository',
      scopeId: 'alpha-repo',
      effect: 'deny',
    });
    assert.equal((await r.f.request(`${path}/review-decisions`, input)).status, 403);
    assert.equal(
      (
        await r.f.request(`/api/organizations/alpha/policies/${denial.id}/remove`, {
          operationId: 'restore-decision-authority',
        })
      ).status,
      200,
    );
    assert.equal((await r.f.request(`${path}/reviews`)).body.decisions.length, 0);
    const concurrent = await Promise.all(
      [input.operationId, 'competing-decision'].map((operationId) =>
        r.f.request(`${path}/review-decisions`, { ...input, operationId }),
      ),
    );
    assert.deepEqual(concurrent.map((r) => r.status).sort(), [200, 409]);
    const accepted = concurrent.find((r) => r.status === 200)!;
    assert.equal(accepted.status, 200);
    assert.deepEqual(accepted.body.fact.payload.findings, findings);
    const types = (await r.f.request('/api/organizations/alpha/work-item-types')).body.definitions;
    assert.ok(
      types
        .find((t: any) => t.version === 3)
        .approvalPoints.some(
          (p: any) => p.id === 'review.decide' && p.approvalActivity === 'approval.review-decide',
        ),
    );
  } finally {
    await r.close();
  }
});

test('A new report supersedes the prior decision even when its relevant input Facts are unchanged', async () => {
  const r = await reviewRuntime();
  try {
    r.behavior('report');
    const path = await r.createItem('report-version');
    await r.startWorker();
    await start(r, path);
    const view = await r.wait(path, 'waiting-review');
    const report = view.reports[0];
    const input = {
      operationId: 'first-decision',
      run: report.run,
      reportVersion: report.version,
      reviewed: true,
      findings: [{ finding: report.findings[0].id, decision: 'confirmed' }],
    };
    assert.equal((await r.f.request(`${path}/review-decisions`, input)).status, 200);
    await waitRun(r, path, report.run, 'completed');
    await r.f.request(`${path}/transition-requests`, {
      operationId: 'same-inputs-rerun',
      transition: 'request-review',
      version: 3,
      expectedState: 'registered',
      inputs: { reviewBrief: 'Second assessment' },
    });
    const next = await r.wait(path, 'waiting-review');
    assert.equal(next.reports.length, 2);
    assert.equal(next.decisions[0].usable, false);
    assert.equal(next.reportStatus.find((s: any) => s.report === report.id).current, false);
  } finally {
    await r.close();
  }
});
