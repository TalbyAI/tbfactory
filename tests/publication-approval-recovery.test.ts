import { test } from 'node:test';
import assert from 'node:assert/strict';
import { publicationRuntime } from './support/publication-runtime';
import { setPolicy } from '../src/server/operator';

type Fixture = Awaited<ReturnType<typeof publicationRuntime>>;
async function policy(f: Fixture, activity: string, effect: string) {
  return setPolicy(f.r.f.store, {
    organization: 'alpha',
    user: f.r.f.alice.user.id,
    activity,
    scope: 'organization',
    scopeId: 'alpha',
    effect,
  });
}
function confirm(f: Fixture, p: any, evidence = p.evidence) {
  return f.act('publication-confirmation', {
    publication: p.id,
    evidence,
    resolution: 'not-published',
    reason: 'Verified no authorized POST and stopped Approval wait',
    confirmedStopped: true,
  });
}

for (const provider of ['github', 'azure-devops'] as const) {
  test(`${provider}: revoked reconciliation authority records an immutable uncertain outcome`, async () => {
    const f = await publicationRuntime(provider);
    try {
      await policy(f, 'review.publish', 'human');
      const waiting = (await f.act('review-publications')).body.publication;
      assert.equal(waiting.status, 'waiting-approval');
      assert.equal((await f.act('publication-reconciliation')).status, 200);
      const denied = await policy(f, 'review.recover', 'deny');
      await f.r.startWorker();
      const view = await f.wait('uncertain');
      const failures = view.publicationHistory.filter(
        (row: any) => row.kind === 'publication.uncertain',
      );
      assert.equal(failures.length, 1);
      assert.deepEqual(failures[0].payload, {
        activity: waiting.id,
        run: f.run.id,
        attempt: waiting.attempt,
        reason: 'Recovery authority unavailable',
      });
      assert.equal(view.publications[0].evidence, undefined);
      assert.ok((await f.r.f.request(f.path)).body.activeRun);
      await f.r.stopWorker();
      await f.r.startWorker();
      assert.deepEqual((await f.view()).publicationHistory, view.publicationHistory);
      assert.equal(f.reads.length, 0);
      assert.equal(f.posts.length, 0);
      await f.r.f.store.transaction((tx) => tx.remove('policy', denied.id));
      assert.equal((await f.act('publication-reconciliation')).status, 200);
      const recovered = await f.wait('uncertain');
      assert.deepEqual(
        recovered.publicationHistory.find((row: any) => row.id === failures[0].id),
        failures[0],
      );
      assert.ok(recovered.publications[0].evidence);
      assert.equal((await confirm(f, recovered.publications[0])).status, 200);
      assert.equal(f.posts.length, 0);
    } finally {
      await f.close();
    }
  });

  for (const change of ['inputs', 'credential'] as const) {
    test(`${provider}: ${change} invalidated during Approval wait can recover without a POST`, async () => {
      const f = await publicationRuntime(provider);
      try {
        await policy(f, 'review.publish', 'human');
        const credential = await f.r.f.request('/api/organizations/alpha/api-credentials', {
          operationId: 'waiting-publication-credential',
          label: 'Publication requester',
          activities: ['work-item.read', 'artifact.read', 'review.publish', 'review.recover'],
          expiresAt: Date.now() + 600000,
        });
        assert.equal(credential.status, 200);
        const requested = await f.act('review-publications', {}, credential.body.token, true);
        assert.equal(requested.status, 200);
        const waiting = requested.body.publication;
        assert.equal(waiting.status, 'waiting-approval');
        const history = (await f.view()).publicationHistory;
        if (change === 'inputs') {
          assert.equal(
            (
              await f.r.f.request(`${f.path}/review-facts`, {
                operationId: 'changed-during-approval',
                fields: { sourceCommit: 'a'.repeat(40) },
              })
            ).status,
            200,
          );
        } else {
          assert.equal(
            (
              await f.r.f.request(
                `/api/organizations/alpha/api-credentials/${credential.body.credential.id}/revoke`,
                { operationId: 'revoke-during-approval' },
              )
            ).status,
            200,
          );
        }
        assert.equal(
          (await f.act('publication-approval', { publication: waiting.id })).status,
          change === 'inputs' ? 409 : 403,
        );
        assert.equal((await f.view()).publications[0].status, 'waiting-approval');
        assert.ok((await f.r.f.request(f.path)).body.activeRun);
        assert.equal((await f.act('review-supersession')).status, 409);
        if (change === 'inputs') {
          assert.equal(
            (await f.act('publication-reconciliation', {}, credential.body.token, true)).status,
            403,
          );
        }
        const denied = await policy(f, 'review.recover', 'deny');
        assert.equal((await f.act('publication-reconciliation')).status, 403);
        await f.r.f.store.transaction((tx) => tx.remove('policy', denied.id));
        await policy(f, 'review.publish', 'deny');
        assert.equal(
          (await f.act('publication-reconciliation', { publication: 'old-activity' })).status,
          409,
        );
        assert.equal((await confirm(f, waiting, 'missing-evidence')).status, 409);
        const claims = await Promise.all([
          f.act('publication-reconciliation', { publication: waiting.id }),
          f.act('publication-reconciliation', { publication: waiting.id }),
        ]);
        assert.deepEqual(claims.map((r) => r.status).sort(), [200, 409]);
        assert.equal((await f.act('publication-approval')).status, 409);
        assert.equal((await confirm(f, waiting, 'missing-evidence')).status, 409);
        // Starting a new process must preserve the recovery claim and never dispatch.
        f.behavior('evidence-error');
        await f.r.startWorker();
        const view = await f.wait('uncertain');
        const p = view.publications[0];
        const evidence = view.publicationHistory.find((row: any) => row.id === p.evidence);
        assert.equal(evidence.payload.noDispatch, true);
        assert.equal(evidence.payload.unavailable, true);
        assert.equal(evidence.payload.attempt, waiting.attempt);
        assert.equal(evidence.payload.activity, waiting.id);
        assert.equal((await confirm(f, p, 'stale-evidence')).status, 409);
        assert.equal(
          (
            await f.act('publication-confirmation', {
              evidence: p.evidence,
              resolution: 'retry',
              reason: 'Unavailable evidence cannot authorize retry',
              confirmedStopped: true,
            })
          ).status,
          409,
        );
        await policy(f, 'review.recover', 'deny');
        assert.equal((await confirm(f, p)).status, 403);
        await f.r.f.store.transaction((tx) => tx.remove('policy', denied.id));
        const confirmations = await Promise.all([confirm(f, p), confirm(f, p)]);
        assert.deepEqual(confirmations.map((r) => r.status).sort(), [200, 409]);
        const completed = await f.view();
        assert.equal(completed.publications[0].status, 'not-published');
        assert.equal(completed.publications[0].evidence, evidence.id);
        assert.equal((await f.r.f.request(f.path)).body.activeRun, undefined);
        assert.equal((await f.r.f.request(f.path)).body.state, 'registered');
        for (const fact of history)
          assert.deepEqual(
            completed.publicationHistory.find((row: any) => row.id === fact.id),
            fact,
          );
        assert.deepEqual(
          completed.publicationHistory.find((row: any) => row.id === evidence.id),
          evidence,
        );
        const decisions = completed.publicationHistory.filter(
          (row: any) => row.kind === 'publication.recovery-decided',
        );
        assert.equal(decisions.length, 1);
        assert.equal(
          decisions[0].payload.reason,
          'Verified no authorized POST and stopped Approval wait',
        );
        await f.r.stopWorker();
        await f.r.startWorker();
        assert.equal((await f.view()).publications[0].status, 'not-published');
        assert.equal(f.posts.length, 0);
        assert.equal(f.effects.length, 0);
        await f.r.stopWorker();
        // A fresh Review Workflow can acquire the Work Item again after safe recovery.
        assert.equal(
          (
            await f.r.f.request(`${f.path}/transition-requests`, {
              operationId: 'review-after-wait-recovery',
              transition: 'request-review',
              version: 4,
              expectedState: 'registered',
              inputs: { reviewBrief: 'Review after recovered Approval wait' },
            })
          ).status,
          200,
        );
        assert.notEqual((await f.r.f.request(f.path)).body.activeRun.id, f.run.id);
      } finally {
        await f.close();
      }
    });
  }

  test(`${provider}: Approval and recovery of a valid wait have a single winner`, async () => {
    const f = await publicationRuntime(provider);
    try {
      await policy(f, 'review.publish', 'human');
      const waiting = (await f.act('review-publications')).body.publication;
      assert.equal(waiting.status, 'waiting-approval');
      const [approval, recovery] = await Promise.all([
        f.act('publication-approval', { publication: waiting.id }),
        f.act('publication-reconciliation', { publication: waiting.id }),
      ]);
      assert.deepEqual([approval.status, recovery.status].sort(), [200, 409]);
      assert.ok((await f.r.f.request(f.path)).body.activeRun);
      await f.r.startWorker();
      if (recovery.status === 200) {
        const p = (await f.wait('uncertain')).publications[0];
        assert.equal((await f.act('publication-approval')).status, 409);
        assert.equal((await confirm(f, p)).status, 200);
        assert.equal(f.posts.length, 0);
      } else {
        await f.wait('completed');
        assert.equal(f.posts.length, 1);
        assert.equal((await f.act('publication-reconciliation')).status, 409);
      }
      assert.equal((await f.r.f.request(f.path)).body.activeRun, undefined);
    } finally {
      await f.close();
    }
  });

  test(`${provider}: retained Approval waits without dispatch tracking cannot infer local proof`, async () => {
    const f = await publicationRuntime(provider);
    try {
      await policy(f, 'review.publish', 'human');
      const waiting = (await f.act('review-publications')).body.publication;
      await f.r.f.store.transaction(async (tx) => {
        const p = (await tx.get('external_activity', waiting.id))!;
        const { dispatchAuthorized: _tracking, ...data } = p.data as any;
        await tx.put('external_activity', { ...p, data });
      });
      f.behavior('evidence-error');
      assert.equal((await f.act('publication-reconciliation')).status, 200);
      await f.r.startWorker();
      const view = await f.wait('uncertain');
      const p = view.publications[0];
      const evidence = view.publicationHistory.find((row: any) => row.id === p.evidence).payload;
      assert.equal(evidence.noDispatch, false);
      assert.equal((await confirm(f, p)).status, 409);
      assert.ok((await f.r.f.request(f.path)).body.activeRun);
      assert.equal(f.posts.length, 0);
    } finally {
      await f.close();
    }
  });
}
