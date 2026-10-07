import { test } from 'node:test';
import { recoverWorkerLock } from '../src/server/review-worker';
import { join } from 'node:path';
import assert from 'node:assert/strict';
import { publicationRuntime } from './support/publication-runtime';
import { setPolicy } from '../src/server/operator';
import { putPublicationConfiguration } from '../src/server/publication-provider';
import { putSource as configureSource } from '../src/server/observations';
import { fixture } from './support/factory';
import { restartTestDatabase } from './support/database-restart';

test('Cancellation of retained publication without dispatch tracking requires provider evidence and User resolution', async () => {
  const f = await publicationRuntime('github');
  try {
    await setPolicy(f.r.f.store, {
      organization: 'alpha',
      user: f.r.f.alice.user.id,
      activity: 'review.publish',
      scope: 'organization',
      scopeId: 'alpha',
      effect: 'human',
    });
    assert.equal((await f.act('review-publications')).status, 200);
    assert.equal((await f.view()).publications[0].status, 'waiting-approval');
    const publication = (await f.view()).publications[0];
    await f.r.f.store.transaction(async (tx) => {
      const current = (await tx.get('external_activity', publication.id))!;
      const data = { ...(current.data as any) };
      delete data.dispatchAuthorized;
      await tx.put('external_activity', { ...current, data });
    });
    const requested = await f.r.f.request(`${f.path}/workflow-cancellations`, {
      operationId: 'cancel-retained-publication',
      run: f.run.id,
    });
    assert.equal(requested.status, 200);
    await f.r.startWorker();
    const deadline = Date.now() + 5000;
    let view: any;
    do {
      view = await f.view();
      if (
        view.runs.find((run: any) => run.id === f.run.id)?.cancellation?.status ===
        'awaiting-publication-resolution'
      )
        break;
      await new Promise((resolve) => setTimeout(resolve, 50));
    } while (Date.now() < deadline);
    assert.equal(
      view.runs.find((run: any) => run.id === f.run.id).cancellation.status,
      'awaiting-publication-resolution',
    );
    assert.ok((await f.r.f.request(f.path)).body.activeRun);
    assert.equal((await f.act('publication-reconciliation')).status, 200);
    view = await f.wait('uncertain');
    const evidence = view.publications[0].evidence;
    assert.ok(evidence);
    assert.equal(
      view.publicationHistory.find((fact: any) => fact.id === evidence).payload.noDispatch,
      false,
    );
    assert.equal(
      (
        await f.act('publication-confirmation', {
          evidence,
          resolution: 'not-published',
          reason: 'Read-only provider evidence contains no matching effect',
          confirmedStopped: true,
        })
      ).status,
      200,
    );
    const resolved = await f.view();
    assert.equal(resolved.runs.find((run: any) => run.id === f.run.id).status, 'cancelled');
    assert.equal(
      resolved.runs.find((run: any) => run.id === f.run.id).cancellation.status,
      'confirmed',
    );
    assert.equal((await f.r.f.request(f.path)).body.activeRun, undefined);
    assert.equal(f.posts.length, 0);
  } finally {
    await f.close();
  }
});

test('Cancellation during an authorized provider request retains ownership until positive-effect reconciliation', async () => {
  const f = await publicationRuntime('github');
  try {
    f.behavior('slow');
    assert.equal((await f.act('review-publications')).status, 200);
    await f.r.startWorker();
    await f.wait('dispatching');
    const deadline = Date.now() + 5000;
    while (!f.effects.length && Date.now() < deadline)
      await new Promise((resolve) => setTimeout(resolve, 50));
    assert.equal(f.effects.length, 1);
    assert.equal(
      (
        await f.r.f.request(`${f.path}/workflow-cancellations`, {
          operationId: 'cancel-held-provider',
          run: f.run.id,
        })
      ).status,
      200,
    );
    const cancelDeadline = Date.now() + 5000;
    let view: any;
    do {
      view = await f.view();
      if (
        view.runs.find((run: any) => run.id === f.run.id)?.cancellation?.status ===
        'awaiting-publication-resolution'
      )
        break;
      await new Promise((resolve) => setTimeout(resolve, 50));
    } while (Date.now() < cancelDeadline);
    assert.equal(
      view.runs.find((run: any) => run.id === f.run.id).cancellation.status,
      'awaiting-publication-resolution',
    );
    assert.ok((await f.r.f.request(f.path)).body.activeRun);
    assert.equal(
      (
        await f.r.f.request(`${f.path}/transition-requests`, {
          operationId: 'replacement-before-provider-resolution',
          transition: 'request-review',
          expectedState: 'registered',
          version: 4,
          inputs: { reviewBrief: 'Cannot replace an unresolved provider call' },
        })
      ).status,
      409,
    );
    f.release();
    view = await f.wait('uncertain');
    assert.equal(view.publications[0].dispatchAuthorized, undefined);
    assert.equal(f.effects.length, 1);
    assert.equal((await f.act('publication-reconciliation')).status, 200);
    view = await f.wait('uncertain');
    const evidence = view.publications[0].evidence;
    assert.ok(evidence);
    assert.equal(
      view.publicationHistory.find((fact: any) => fact.id === evidence).payload.matches.length,
      1,
    );
    assert.equal(
      (
        await f.act('publication-confirmation', {
          evidence,
          resolution: 'completed',
          reason: 'Read-only provider evidence confirms the effect',
          confirmedStopped: true,
        })
      ).status,
      200,
    );
    view = await f.view();
    assert.equal(view.runs.find((run: any) => run.id === f.run.id).status, 'completed');
    assert.equal(
      view.runs.find((run: any) => run.id === f.run.id).cancellation.status,
      'completed-before-stop',
    );
    assert.equal(f.posts.length, 1);
    assert.equal(f.effects.length, 1);
    assert.equal((await f.r.f.request(f.path)).body.activeRun, undefined);
    const facts = await f.r.f.request(`${f.path}/facts`);
    assert.ok(
      facts.body.items.some((fact: any) => fact.kind === 'workflow.cancellation-not-applied'),
    );
  } finally {
    await f.close();
  }
});

test('Publication declares its Approval Point in version 4 without modifying retained Work Item Types', async () => {
  const f = await fixture();
  try {
    await f.bootstrap('alpha');
    const path = '/api/organizations/alpha';
    await f.request(`${path}/work-item-types`, {
      operationId: 'v3',
      type: 'pull-request-review',
      version: 3,
      enabled: true,
    });
    const legacyDefinitions = (await f.request(`${path}/work-item-types`)).body.definitions;
    const input = {
      operationId: 'old',
      project: 'alpha-project',
      repository: 'alpha-repo',
      title: 'Retained review',
      type: 'pull-request-review',
    };
    const old = (await f.request(`${path}/work-items`, input)).body.workItem;
    assert.equal(
      (
        await f.request(`${path}/work-item-types`, {
          operationId: 'v4',
          type: 'pull-request-review',
          version: 4,
          enabled: true,
        })
      ).status,
      200,
    );
    const definitions = (await f.request(`${path}/work-item-types`)).body.definitions;
    assert.deepEqual(definitions.slice(0, 3), legacyDefinitions.slice(0, 3));
    assert.deepEqual(
      definitions[3].approvalPoints.find((p: any) => p.id === 'review.publish'),
      {
        id: 'review.publish',
        executionActivity: 'review.publish',
        approvalActivity: 'approval.review-publish',
      },
    );
    assert.equal((await f.request(`${path}/work-items/${old.id}`)).body.version, 3);
    assert.equal(
      (await f.request(`${path}/work-items`, { ...input, operationId: 'new' })).body.workItem
        .version,
      4,
    );
  } finally {
    await f.close();
  }
});

for (const provider of ['github', 'azure-devops'] as const) {
  test(`${provider}: worker crash after provider success preserves dispatch reservation until confirmed-stop reconciliation`, async () => {
    const f = await publicationRuntime(provider);
    try {
      f.behavior('slow');
      assert.equal((await f.act('review-publications')).status, 200);
      await f.r.startWorker();
      const deadline = Date.now() + 15000;
      while (!f.effects.length && Date.now() < deadline)
        await new Promise((resolve) => setTimeout(resolve, 50));
      assert.equal(f.effects.length, 1);
      assert.equal((await f.view()).publications[0].status, 'dispatching');
      assert.equal((await f.act('publication-reconciliation')).status, 409);
      assert.equal(
        (
          await f.act('publication-confirmation', {
            evidence: 'absent',
            resolution: 'not-published',
            reason: 'Cannot release a running attempt',
            confirmedStopped: true,
          })
        ).status,
        409,
      );
      const worker = f.r.worker!,
        pid = worker.pid!;
      const stopped = new Promise<void>((resolve) => worker.once('exit', () => resolve()));
      worker.kill('SIGKILL');
      await stopped;
      await f.r.stopWorker();
      f.release();
      f.behavior('success');
      await recoverWorkerLock(f.r.f.store, join(f.r.directory, 'worker'), pid);
      await f.r.startWorker();
      await f.wait('uncertain');
      assert.equal(f.posts.length, 1);
      assert.equal((await f.act('publication-reconciliation')).status, 200);
      const view = await f.wait('uncertain');
      const evidence = view.publications[0].evidence;
      assert.equal(
        (
          await f.act('publication-confirmation', {
            evidence,
            resolution: 'completed',
            reason: 'Verified stopped worker and existing provider comment',
            confirmedStopped: true,
          })
        ).status,
        200,
      );
      assert.equal((await f.r.f.request(f.path)).body.activeRun, undefined);
      assert.equal(f.posts.length, 1);
    } finally {
      await f.close();
    }
  });
  test(`${provider}: explicit provider failure requires evidence and authorized retry with immutable attempt history`, async () => {
    const f = await publicationRuntime(provider);
    try {
      f.behavior('reject');
      assert.equal((await f.act('review-publications')).status, 200);
      await f.r.startWorker();
      await f.wait('failed');
      assert.equal(f.posts.length, 1);
      assert.equal(f.effects.length, 0);
      assert.equal((await f.act('review-publications')).status, 200);
      assert.equal(f.posts.length, 1);
      f.behavior('evidence-error');
      assert.equal((await f.act('publication-reconciliation')).status, 200);
      const missing = await f.wait('uncertain');
      const missingEvidence = missing.publications[0].evidence;
      assert.equal(
        missing.publicationHistory.find((e: any) => e.id === missingEvidence).payload.complete,
        false,
      );
      f.behavior('success');
      assert.equal((await f.act('publication-reconciliation')).status, 200);
      const view = await f.wait('uncertain'),
        p = view.publications[0];
      assert.notEqual(p.evidence, missingEvidence);
      assert.equal(
        (
          await f.act('publication-confirmation', {
            evidence: missingEvidence,
            resolution: 'retry',
            reason: 'Stale evidence',
            confirmedStopped: true,
          })
        ).status,
        409,
      );
      const deny = await setPolicy(f.r.f.store, {
        organization: 'alpha',
        user: f.r.f.alice.user.id,
        activity: 'review.publish',
        scope: 'repository',
        scopeId: 'alpha-repo',
        effect: 'deny',
      });
      assert.equal(
        (
          await f.act('publication-confirmation', {
            evidence: p.evidence,
            resolution: 'retry',
            reason: 'Retry checked failed attempt',
            confirmedStopped: true,
          })
        ).status,
        403,
      );
      assert.equal(
        (
          await f.r.f.request(`/api/organizations/alpha/policies/${deny.id}/remove`, {
            operationId: 'remove-denial',
          })
        ).status,
        200,
      );
      assert.equal(
        (
          await f.act('publication-confirmation', {
            evidence: p.evidence,
            resolution: 'retry',
            reason: 'Provider rejected request; verified no comment',
            confirmedStopped: true,
          })
        ).status,
        200,
      );
      await f.wait('completed');
      assert.equal(f.posts.length, 2);
      assert.equal(f.effects.length, 1);
      assert.ok(JSON.stringify(f.posts[1].body).includes('attempt 2'));
      const facts = (await f.view()).publicationHistory;
      assert.equal(facts.filter((e: any) => e.kind === 'publication.dispatch-reserved').length, 2);
      assert.equal(facts.filter((e: any) => e.kind === 'publication.failed').length, 1);
      assert.equal(facts.filter((e: any) => e.kind === 'publication.evidence').length, 2);
    } finally {
      await f.close();
    }
  });

  for (const change of ['inputs', 'permission', 'destination', 'source'] as const) {
    test(`${provider}: ${change} changes after authorization block dispatch with no provider effect`, async () => {
      const f = await publicationRuntime(provider);
      try {
        assert.equal((await f.act('review-publications')).status, 200);
        if (change === 'inputs')
          assert.equal(
            (
              await f.r.f.request(`${f.path}/review-facts`, {
                operationId: 'changed-inputs',
                fields: { sourceCommit: 'a'.repeat(40) },
              })
            ).status,
            200,
          );
        if (change === 'permission') {
          f.holdRepository();
          await f.r.startWorker();
          const deadline = Date.now() + 15000;
          while (!f.repositoryEntered() && Date.now() < deadline)
            await new Promise((resolve) => setTimeout(resolve, 50));
          assert.ok(f.repositoryEntered());
          await setPolicy(f.r.f.store, {
            organization: 'alpha',
            user: f.r.f.alice.user.id,
            activity: 'review.publish',
            scope: 'repository',
            scopeId: 'alpha-repo',
            effect: 'deny',
          });
          f.release();
        }
        if (change === 'destination')
          await putPublicationConfiguration(
            f.r.f.store,
            f.r.secrets,
            { ...f.config, enabled: false },
            ['127.0.0.1'],
            true,
          );
        if (change === 'source')
          await configureSource(f.r.f.store, f.r.secrets, { ...f.source, enabled: false });
        if (change !== 'permission') await f.r.startWorker();
        await f.wait('blocked');
        assert.equal(f.posts.length, 0);
        assert.ok((await f.r.f.request(f.path)).body.activeRun);
        assert.equal((await f.act('publication-reconciliation')).status, 200);
        const view = await f.wait('uncertain');
        assert.equal(
          (
            await f.act('publication-confirmation', {
              evidence: view.publications[0].evidence,
              resolution: 'not-published',
              reason: 'No dispatch; confirmed stopped',
              confirmedStopped: true,
            })
          ).status,
          200,
        );
        assert.equal((await f.r.f.request(f.path)).body.activeRun, undefined);
        assert.equal((await f.r.f.request(f.path)).body.state, 'registered');
      } finally {
        await f.close();
      }
    });
  }

  test(`${provider}: empty human-reviewed report records a durable skip without provider calls`, async () => {
    const f = await publicationRuntime(provider, true);
    try {
      assert.equal((await f.act('review-publications')).status, 200);
      await f.r.startWorker();
      const view = await f.wait('completed');
      assert.equal(view.publications[0].status, 'skipped');
      assert.equal(f.posts.length, 0);
      assert.equal(f.reads.length, 0);
      await f.r.stopWorker();
      await f.r.startWorker();
      assert.equal((await f.act('review-publications')).status, 200);
      assert.equal(f.posts.length, 0);
    } finally {
      await f.close();
    }
  });

  test(`${provider}: human-intervention Approval is separate and cannot grant revoked execution permission`, async () => {
    const f = await publicationRuntime(provider);
    try {
      await setPolicy(f.r.f.store, {
        organization: 'alpha',
        user: f.r.f.alice.user.id,
        activity: 'review.publish',
        scope: 'organization',
        scopeId: 'alpha',
        effect: 'human',
      });
      const credential = await f.r.f.request('/api/organizations/alpha/api-credentials', {
        operationId: 'credential',
        label: 'publication',
        activities: [
          'work-item.read',
          'artifact.read',
          'review.publish',
          'review.recover',
          'approval.review-publish',
        ],
        expiresAt: Date.now() + 60000,
      });
      assert.equal(credential.status, 200);
      assert.equal(
        (await f.act('review-publications', {}, credential.body.token, true)).status,
        200,
      );
      assert.equal((await f.view()).publications[0].status, 'waiting-approval');
      assert.equal(
        (await f.act('publication-approval', {}, credential.body.token, true)).status,
        403,
      );
      assert.equal((await f.act('publication-approval')).status, 200);
      await f.r.f.request(
        `/api/organizations/alpha/api-credentials/${credential.body.credential.id}/revoke`,
        { operationId: 'revoke' },
      );
      await f.r.startWorker();
      await f.wait('blocked');
      assert.equal(f.effects.length, 0);
      assert.equal(f.posts.length, 0);
      assert.ok((await f.r.f.request(f.path)).body.activeRun);
    } finally {
      await f.close();
    }
  });

  test(`${provider}: lost response retains ownership and competing evidence-based User recovery cannot repeat the effect`, async () => {
    const f = await publicationRuntime(provider);
    try {
      f.behavior('lost');
      assert.equal((await f.act('review-publications')).status, 200);
      await f.r.startWorker();
      await f.wait('uncertain');
      assert.equal(f.effects.length, 1);
      assert.ok((await f.r.f.request(f.path)).body.activeRun);
      assert.equal(
        (
          await f.act('publication-confirmation', {
            evidence: 'missing',
            resolution: 'completed',
            reason: 'Checked provider',
            confirmedStopped: true,
          })
        ).status,
        409,
      );
      assert.equal((await f.act('review-supersession')).status, 409);
      await f.r.stopWorker();
      await f.r.startWorker();
      assert.equal(f.posts.length, 1);
      f.behavior('success');
      const competing = await Promise.all([
        f.act('publication-reconciliation'),
        f.act('publication-reconciliation'),
      ]);
      assert.deepEqual(competing.map((r) => r.status).sort(), [200, 409]);
      const view = await f.wait('uncertain');
      const p = view.publications[0];
      const evidence = view.publicationHistory.find((e: any) => e.id === p.evidence);
      assert.equal(evidence.payload.matches.length, 1);
      assert.equal(
        (
          await f.act('publication-confirmation', {
            evidence: p.evidence,
            resolution: 'retry',
            reason: 'Retry despite matching effect',
            confirmedStopped: true,
          })
        ).status,
        409,
      );
      const recovery = await Promise.all(
        [0, 1].map(() =>
          f.act('publication-confirmation', {
            evidence: p.evidence,
            resolution: 'completed',
            reason: 'Verified provider comment and stopped attempt',
            confirmedStopped: true,
          }),
        ),
      );
      assert.deepEqual(recovery.map((r) => r.status).sort(), [200, 409]);
      assert.equal((await f.r.f.request(f.path)).body.activeRun, undefined);
      assert.equal((await f.view()).publications[0].effect.id, '1');
      await f.r.stopWorker();
      await f.r.startWorker();
      assert.equal(f.effects.length, 1);
      assert.equal(f.posts.length, 1);
      const history = (await f.view()).publicationHistory;
      assert.equal(history.filter((e: any) => e.kind === 'publication.completed').length, 1);
      assert.equal(history.filter((e: any) => e.kind === 'publication.recovery-decided').length, 1);
    } finally {
      await f.close();
    }
  });
}

for (const provider of ['github', 'azure-devops'] as const) {
  test(`${provider}: confirmed publication persists across worker and database restart and excludes private output`, async () => {
    const f = await publicationRuntime(provider);
    try {
      const rotation = await putPublicationConfiguration(
        f.r.f.store,
        f.r.secrets,
        { ...f.config, key: 'rotated-publication-secret' },
        ['127.0.0.1'],
        true,
      );
      const before = await f.act('review-publications');
      assert.equal(before.status, 200);
      assert.equal(before.body.publication.destination.version, rotation.version);
      await f.r.f.request(`${f.path}/notes`, {
        operationId: 'unrelated',
        text: 'Unrelated observation',
      });
      await f.r.startWorker();
      const view = await f.wait('completed');
      assert.equal(f.posts.length, 1);
      assert.equal(f.effects.length, 1);
      const content = JSON.stringify(f.posts[0].body);
      assert.ok(content.includes(f.report.findings[0].title));
      assert.ok(!content.includes(f.report.findings[1].title));
      assert.ok(!content.includes('PRIVATE REJECTION REASON'));
      assert.ok(!content.includes(f.report.summary));
      assert.ok(!content.includes('/artifact'));
      assert.equal(
        f.posts[0].authorization,
        provider === 'github'
          ? 'Bearer rotated-publication-secret'
          : `Basic ${Buffer.from(':rotated-publication-secret').toString('base64')}`,
      );
      assert.equal(view.publications[0].status, 'completed');
      assert.equal((await f.r.f.request(f.path)).body.state, 'registered');
      await f.r.stopWorker();
      await restartTestDatabase(f.r.f.config.url);
      await f.r.startWorker();
      assert.equal((await f.act('review-publications')).status, 200);
      assert.equal(f.effects.length, 1);
      const history = (await f.view()).publicationHistory;
      assert.equal(history.filter((e: any) => e.kind === 'publication.completed').length, 1);
      assert.ok(!JSON.stringify(view).includes('rotated-publication-secret'));
    } finally {
      await f.close();
    }
  });
}
