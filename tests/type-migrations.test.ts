import { test } from 'node:test';
import assert from 'node:assert/strict';
import { Surreal } from 'surrealdb';
import { fixture } from './support/factory.ts';
import { reviewRuntime } from './support/review-runtime.ts';
import { provision } from '../src/server/provision.ts';

const startReview = (r: Awaited<ReturnType<typeof reviewRuntime>>, path: string) =>
  r.f.request(`${path}/transition-requests`, {
    operationId: 'start-review',
    transition: 'request-review',
    expectedState: 'registered',
    version: 3,
    inputs: { reviewBrief: 'Inspect the retained version' },
  });

test('An explicit version-1 migration preserves state and replays its receipt', async () => {
  const f = await fixture();
  try {
    await f.bootstrap('alpha');
    const base = '/api/organizations/alpha';
    const created = await f.request(`${base}/work-items`, {
      operationId: 'create-retained',
      project: 'alpha-project',
      title: 'Retained version 1',
      type: 'pull-request-review',
    });
    const path = `${base}/work-items/${created.body.workItem.id}`;
    const request = {
      operationId: 'migrate-retained',
      expectedState: 'registered',
      expectedVersion: 1,
      targetVersion: 2,
      expectedTransitionSequence: 0,
    };

    const migrated = await f.request(`${path}/type-migrations`, request);

    assert.equal(migrated.status, 200);
    assert.equal(migrated.body.workItem.state, 'registered');
    assert.equal(migrated.body.workItem.version, 2);
    assert.equal(migrated.body.workItem.transitionSequence ?? 0, 0);
    assert.equal(migrated.body.fact.kind, 'work-item.type-migrated');
    assert.deepEqual((await f.request(`${path}/type-migrations`, request)).body, migrated.body);
    assert.equal(
      (
        await f.request(`${path}/type-migrations`, {
          ...request,
          expectedVersion: 2,
        })
      ).status,
      409,
    );

    const board = await f.request(`${base}/board?type=pull-request-review`);
    const card = board.body.items.find((item: any) => item.id === created.body.workItem.id);
    assert.equal(card.version, 2);
    assert.equal(card.state, 'registered');
    assert.equal(card.transitions[0].id, 'prepare-review');
  } finally {
    await f.close();
  }
});

test('A version-3 readiness migration preserves its prerequisite without making old decisions current', async () => {
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
      title: 'Ready version 3',
      type: 'pull-request-review',
    });
    const path = `${base}/work-items/${created.body.workItem.id}`;
    const prepared = await f.request(`${path}/transition-requests`, {
      operationId: 'prepare-v3',
      transition: 'prepare-review',
      expectedState: 'registered',
      version: 3,
      inputs: { reviewBrief: 'Retain the current lifecycle occurrence' },
    });
    const readinessFact = prepared.body.fact;
    const migration = await f.request(`${path}/type-migrations`, {
      operationId: 'migrate-v3-ready',
      expectedState: 'ready-for-review',
      expectedVersion: 3,
      targetVersion: 4,
      expectedTransitionSequence: 1,
    });

    assert.equal(migration.status, 200);
    assert.equal(migration.body.workItem.version, 4);
    assert.equal(migration.body.workItem.state, 'ready-for-review');
    assert.equal(migration.body.workItem.transitionSequence, 1);
    assert.equal(migration.body.fact.payload.readinessFact, readinessFact.id);
    const board = await f.request(`${base}/board?type=pull-request-review`);
    const card = board.body.items.find((item: any) => item.id === created.body.workItem.id);
    assert.equal(card.readinessFact, readinessFact.id);

    const withdrawn = await f.request(`${path}/transition-requests`, {
      operationId: 'withdraw-after-migration',
      transition: 'withdraw-review',
      expectedState: 'ready-for-review',
      version: 4,
      inputs: { reason: 'Revisit the review brief', readinessFact: readinessFact.id },
    });
    assert.equal(withdrawn.status, 200);
    assert.equal(withdrawn.body.workItem.state, 'registered');
    assert.equal(withdrawn.body.fact.payload.version, 4);
    const facts = (await f.request(`${path}/facts`)).body.items;
    assert.equal(facts.find((fact: any) => fact.id === readinessFact.id).payload.version, 3);
  } finally {
    await f.close();
  }
});

test('Only allowlisted state mappings migrate', async () => {
  const f = await fixture();
  try {
    await f.bootstrap('alpha');
    const base = '/api/organizations/alpha';
    await f.request(`${base}/work-item-types`, {
      operationId: 'select-v2',
      type: 'pull-request-review',
      version: 2,
      enabled: true,
    });
    const created = await f.request(`${base}/work-items`, {
      operationId: 'create-v2',
      project: 'alpha-project',
      title: 'Version 2 remains retained',
      type: 'pull-request-review',
    });
    const path = `${base}/work-items/${created.body.workItem.id}`;

    assert.equal(
      (
        await f.request(`${path}/type-migrations`, {
          operationId: 'reject-v2-to-v3',
          expectedState: 'registered',
          expectedVersion: 2,
          targetVersion: 3,
          expectedTransitionSequence: 0,
        })
      ).status,
      409,
    );
    assert.equal(
      (
        await f.request(`${path}/type-migrations`, {
          operationId: 'reject-stale-version',
          expectedState: 'registered',
          expectedVersion: 3,
          targetVersion: 4,
          expectedTransitionSequence: 0,
        })
      ).status,
      409,
    );
    assert.equal(
      (
        await f.request(`${path}/type-migrations`, {
          operationId: 'reject-extra-mapping',
          expectedState: 'registered',
          expectedVersion: 2,
          targetVersion: 3,
          expectedTransitionSequence: 0,
          mapping: 'registered',
        })
      ).status,
      422,
    );
    assert.equal((await f.request(path)).body.version, 2);
    assert.equal(
      (await f.request(`${path}/facts`)).body.items.some(
        (fact: any) => fact.kind === 'work-item.type-migrated',
      ),
      false,
    );

    await f.request('/api/organizations/alpha/work-item-types', {
      operationId: 'select-v5',
      type: 'pull-request-review',
      version: 5,
      enabled: true,
    });
    const versionFive = await f.request('/api/organizations/alpha/work-items', {
      operationId: 'create-v5',
      project: 'alpha-project',
      title: 'Version 5 remains unmigrated',
      type: 'pull-request-review',
    });
    const versionFivePath = `/api/organizations/alpha/work-items/${versionFive.body.workItem.id}`;
    for (const [operationId, targetVersion] of [
      ['reject-v5-to-v5', 5],
      ['reject-v5-to-v4', 4],
    ] as const)
      assert.equal(
        (
          await f.request(`${versionFivePath}/type-migrations`, {
            operationId,
            expectedState: 'registered',
            expectedVersion: 5,
            targetVersion,
            expectedTransitionSequence: 0,
          })
        ).status,
        409,
      );
    assert.equal((await f.request(versionFivePath)).body.version, 5);
  } finally {
    await f.close();
  }
});

test('Migration rejects a pending Approval and a Workflow Run with pending cancellation', async () => {
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
    const approvedItem = await f.request(`${base}/work-items`, {
      operationId: 'create-pending-approval',
      project: 'alpha-project',
      title: 'Pending Transition Request',
      type: 'pull-request-review',
    });
    const approvalPath = `${base}/work-items/${approvedItem.body.workItem.id}`;
    const humanPolicy = await f.request(`${base}/policies`, {
      operationId: 'require-human-review-request',
      user: f.alice.user.id,
      activity: 'transition.request-review',
      scope: 'organization',
      scopeId: 'alpha',
      effect: 'human',
    });
    assert.equal(humanPolicy.status, 200);
    const pending = await f.request(`${approvalPath}/transition-requests`, {
      operationId: 'pending-review-request',
      transition: 'request-review',
      expectedState: 'registered',
      version: 3,
      inputs: { reviewBrief: 'Wait for activity Approval' },
    });
    assert.equal(pending.body.request.status, 'pending-approval');
    assert.equal((await f.request(approvalPath)).body.activeRun, undefined);
    assert.equal(
      (
        await f.request(`${approvalPath}/type-migrations`, {
          operationId: 'blocked-by-pending-approval',
          expectedState: 'registered',
          expectedVersion: 3,
          targetVersion: 4,
          expectedTransitionSequence: 0,
        })
      ).status,
      409,
    );
    const approvalBoard = await f.request(`${base}/board?type=pull-request-review`);
    const waitingCard = approvalBoard.body.items.find(
      (item: any) => item.id === approvedItem.body.workItem.id,
    );
    assert.equal(waitingCard.migration.available, false);
    assert.equal(waitingCard.migration.reason, 'Pending Transition Request');
    assert.equal(
      (
        await f.request(`${base}/policies/${humanPolicy.body.policy.id}/remove`, {
          operationId: 'remove-human-review-request',
        })
      ).status,
      200,
    );

    const activeItem = await f.request(`${base}/work-items`, {
      operationId: 'create-cancel-pending',
      project: 'alpha-project',
      repository: 'alpha-repo',
      title: 'Cancellation request retains ownership',
      type: 'pull-request-review',
    });
    const activePath = `${base}/work-items/${activeItem.body.workItem.id}`;
    await f.request(`${activePath}/review-facts`, {
      operationId: 'supply-review-facts',
      fields: {
        sourceBranch: 'feature',
        targetBranch: 'main',
        sourceCommit: 'a'.repeat(40),
        targetCommit: 'b'.repeat(40),
      },
    });
    const accepted = await f.request(`${activePath}/transition-requests`, {
      operationId: 'start-owned-review',
      transition: 'request-review',
      expectedState: 'registered',
      version: 3,
      inputs: { reviewBrief: 'Acquire a Workflow Run' },
    });
    assert.equal(accepted.status, 200);
    const run = accepted.body.workflowRun;
    assert.equal(
      (
        await f.request(`${activePath}/workflow-cancellations`, {
          operationId: 'request-cancellation',
          run: run.id,
        })
      ).status,
      200,
    );
    const held = await f.request(activePath);
    assert.equal(held.body.activeRun.id, run.id);
    const runHistory = await f.request(`${activePath}/reviews`);
    assert.equal(runHistory.body.runs[0].cancellation.status, 'requested');
    assert.equal(
      (
        await f.request(`${activePath}/type-migrations`, {
          operationId: 'blocked-by-cancellation-pending',
          expectedState: 'registered',
          expectedVersion: 3,
          targetVersion: 4,
          expectedTransitionSequence: 0,
        })
      ).status,
      409,
    );
  } finally {
    await f.close();
  }
});

test('Migration uses current scoped authorization and hides cross-Organization items', async () => {
  const f = await fixture();
  try {
    await f.bootstrap('alpha');
    await f.bootstrap('beta');
    const base = '/api/organizations/alpha';
    const created = await f.request(`${base}/work-items`, {
      operationId: 'create-protected-migration',
      project: 'alpha-project',
      title: 'Protected version 1',
      type: 'pull-request-review',
    });
    const path = `${base}/work-items/${created.body.workItem.id}`;
    const restricted = await f.login('read-only-member');
    await provision(f.store, {
      organization: { id: 'alpha', name: 'Alpha' },
      projects: [],
      members: [
        {
          issuer: f.op.issuer,
          subject: 'read-only-member',
          grants: [
            {
              activity: 'work-item.read',
              scope: 'organization',
              scopeId: 'alpha',
              effect: 'allow',
            },
          ],
        },
      ],
    });
    const input = {
      operationId: 'unauthorized-migration',
      expectedState: 'registered',
      expectedVersion: 1,
      targetVersion: 2,
      expectedTransitionSequence: 0,
    };
    assert.equal((await f.request(`${path}/type-migrations`, input, restricted.token)).status, 403);
    assert.equal(
      (
        await f.request(
          `/api/organizations/beta/work-items/${created.body.workItem.id}/type-migrations`,
          input,
        )
      ).status,
      404,
    );
    assert.equal(
      (
        await f.request(`${base}/policies`, {
          operationId: 'deny-type-migration',
          user: f.alice.user.id,
          activity: 'work-item.migrate',
          scope: 'project',
          scopeId: 'alpha-project',
          effect: 'deny',
        })
      ).status,
      200,
    );
    assert.equal((await f.request(`${path}/type-migrations`, input)).status, 403);
    assert.equal((await f.request(path)).body.version, 1);
  } finally {
    await f.close();
  }
});

test('A SurrealDB interruption leaves migration state, history, and receipt retryable', async () => {
  const f = await fixture();
  const operator = new Surreal();
  let eventInstalled = false;
  try {
    await f.bootstrap('alpha');
    const created = await f.request('/api/organizations/alpha/work-items', {
      operationId: 'create-rollback-migration',
      project: 'alpha-project',
      title: 'Migration rollback',
      type: 'pull-request-review',
    });
    const path = `/api/organizations/alpha/work-items/${created.body.workItem.id}`;
    const input = {
      operationId: 'retry-after-migration-rollback',
      expectedState: 'registered',
      expectedVersion: 1,
      targetVersion: 2,
      expectedTransitionSequence: 0,
    };
    await operator.connect(f.config.url);
    await operator.signin({ username: f.config.username, password: f.config.password });
    await operator.use({ namespace: f.config.namespace, database: f.config.database });
    await operator.query(
      `DEFINE EVENT fail_type_migration ON fact WHEN $event = 'CREATE' AND $after.kind = 'work-item.type-migrated' THEN { THROW 'Injected migration transaction interruption'; };`,
    );
    eventInstalled = true;

    assert.equal((await f.request(`${path}/type-migrations`, input)).status, 500);
    assert.equal((await f.request(path)).body.version, 1);
    assert.equal(
      (await f.request(`${path}/facts`)).body.items.some(
        (fact: any) => fact.kind === 'work-item.type-migrated',
      ),
      false,
    );

    await operator.query('REMOVE EVENT fail_type_migration ON fact;');
    eventInstalled = false;
    const retried = await f.request(`${path}/type-migrations`, input);
    assert.equal(retried.status, 200);
    assert.equal(retried.body.workItem.version, 2);
    assert.equal(
      (await f.request(`${path}/type-migrations`, input)).body.fact.id,
      retried.body.fact.id,
    );
  } finally {
    if (eventInstalled)
      await operator.query('REMOVE EVENT fail_type_migration ON fact;').catch(() => {});
    await operator.close();
    await f.close();
  }
});

test('Concurrent migrations commit at most one state version and migration Fact', async () => {
  const f = await fixture();
  try {
    await f.bootstrap('alpha');
    const created = await f.request('/api/organizations/alpha/work-items', {
      operationId: 'create-concurrent-migration',
      project: 'alpha-project',
      title: 'Concurrent migration',
      type: 'pull-request-review',
    });
    const path = `/api/organizations/alpha/work-items/${created.body.workItem.id}`;
    const results = await Promise.all(
      ['migrate-a', 'migrate-b'].map((operationId) =>
        f.request(`${path}/type-migrations`, {
          operationId,
          expectedState: 'registered',
          expectedVersion: 1,
          targetVersion: 2,
          expectedTransitionSequence: 0,
        }),
      ),
    );
    assert.deepEqual(results.map((result) => result.status).sort(), [200, 409]);
    assert.equal((await f.request(path)).body.version, 2);
    assert.equal(
      (await f.request(`${path}/facts`)).body.items.filter(
        (fact: any) => fact.kind === 'work-item.type-migrated',
      ).length,
      1,
    );
  } finally {
    await f.close();
  }
});

test('Version-3 reports and Review Decisions become noncurrent after migration', async () => {
  const r = await reviewRuntime();
  try {
    const path = await r.createItem('version-currentness');
    const created = await r.f.request(path);
    const oldItem = created.body;
    await r.startWorker();
    assert.equal((await startReview(r, path)).status, 200);
    const waiting = await r.wait(path, 'waiting-review');
    const run = waiting.runs.find((candidate: any) => candidate.workflow === 'review-v1');
    const report = waiting.reports.find((candidate: any) => candidate.version === run.report);
    await r.stopWorker();

    const decision = await r.f.request(`${path}/review-decisions`, {
      operationId: 'review-version-3',
      run: run.id,
      reportVersion: report.version,
      reviewed: true,
      findings: report.findings.map((finding: any) => ({
        finding: finding.id,
        decision: 'confirmed',
      })),
    });
    assert.equal(decision.status, 200);
    await r.startWorker();
    await r.wait(path, 'completed');
    await r.stopWorker();
    assert.equal((await r.f.request(`${path}/reviews`)).body.decisions[0].usable, true);

    const base = '/api/organizations/alpha';
    assert.equal(
      (
        await r.f.request(`${base}/work-item-types`, {
          operationId: 'select-v4',
          type: 'pull-request-review',
          version: 4,
          enabled: true,
        })
      ).status,
      200,
    );
    const newItem = await r.f.request(`${base}/work-items`, {
      operationId: 'create-version-4',
      project: 'alpha-project',
      repository: 'alpha-repo',
      title: 'New version 4 Work Item',
      type: 'pull-request-review',
    });
    assert.equal(newItem.body.workItem.version, 4);
    assert.equal((await r.f.request(path)).body.version, 3);

    const migrated = await r.f.request(`${path}/type-migrations`, {
      operationId: 'migrate-reviewed-item',
      expectedState: 'registered',
      expectedVersion: 3,
      targetVersion: 4,
      expectedTransitionSequence: 0,
    });
    assert.equal(migrated.status, 200);
    const history = await r.f.request(`${path}/reviews`);
    assert.equal(history.body.reports[0].id, report.id);
    assert.equal(history.body.decisions[0].id, decision.body.fact.id);
    assert.equal(history.body.decisions[0].usable, false);
    assert.equal((await r.f.request(path)).body.version, 4);
    assert.equal(oldItem.version, 3);

    assert.equal(
      (
        await r.f.request(`${path}/review-publications`, {
          operationId: 'stale-publication',
          run: run.id,
        })
      ).status,
      409,
    );
    await r.startWorker();
    assert.equal(
      (
        await r.f.request(`${path}/transition-requests`, {
          operationId: 'fresh-v4-review',
          transition: 'request-review',
          expectedState: 'registered',
          version: 4,
          inputs: { reviewBrief: 'Generate a current version-4 report' },
        })
      ).status,
      200,
    );
    const fresh = await r.wait(path, 'waiting-review');
    const freshReport = fresh.reports.find((candidate: any) => candidate.id !== report.id);
    assert.ok(freshReport);
    const freshRun = fresh.runs.find((candidate: any) => candidate.report === freshReport.id);
    assert.equal(freshRun.inputs.typeVersion, 4);
    await r.stopWorker();
    const freshDecision = await r.f.request(`${path}/review-decisions`, {
      operationId: 'review-version-4',
      run: freshRun.id,
      reportVersion: freshReport.version,
      reviewed: true,
      findings: freshReport.findings.map((finding: any) => ({
        finding: finding.id,
        decision: 'confirmed',
      })),
    });
    assert.equal(freshDecision.status, 200);
  } finally {
    await r.close();
  }
});
