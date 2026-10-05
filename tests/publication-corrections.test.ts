import { test } from 'node:test';
import assert from 'node:assert/strict';
import { publicationRuntime } from './support/publication-runtime';
import { setPolicy } from '../src/server/operator';

type Fixture = Awaited<ReturnType<typeof publicationRuntime>>;
async function correct(f: Fixture, rejected = false) {
  const view = await f.view();
  const run = view.runs.find((r: any) => r.id === f.run.id);
  return f.act('review-decisions', {
    reportVersion: f.report.id,
    replaces: run.decision,
    reviewed: true,
    findings: f.report.findings.map((finding: any) =>
      rejected
        ? { finding: finding.id, decision: 'rejected', reason: 'Correction after human review' }
        : { finding: finding.id, decision: 'confirmed' },
    ),
  });
}
async function reconcile(f: Fixture) {
  assert.equal((await f.act('publication-reconciliation')).status, 200);
  return f.wait('uncertain');
}
function confirm(f: Fixture, p: any, resolution: string) {
  return f.act('publication-confirmation', {
    evidence: p.evidence,
    resolution,
    reason: 'Verified provider outcome and stopped attempt',
    confirmedStopped: true,
  });
}

for (const provider of ['github', 'azure-devops'] as const) {
  test(`${provider}: unavailable evidence cannot resolve or retry a dispatched Activity`, async () => {
    const f = await publicationRuntime(provider);
    try {
      f.behavior('reject');
      assert.equal((await f.act('review-publications')).status, 200);
      await f.r.startWorker();
      await f.wait('failed');
      f.behavior('evidence-error');
      const p = (await reconcile(f)).publications[0];
      for (const resolution of ['completed', 'retry', 'not-published'])
        assert.equal((await confirm(f, p, resolution)).status, 409, resolution);
      assert.ok((await f.r.f.request(f.path)).body.activeRun);
      assert.equal(f.posts.length, 1);
      assert.equal((await correct(f)).status, 409);
      f.behavior('success');
      const complete = (await reconcile(f)).publications[0];
      assert.equal((await confirm(f, complete, 'completed')).status, 409);
      assert.equal((await confirm(f, complete, 'not-published')).status, 200);
    } finally {
      await f.close();
    }
  });

  test(`${provider}: skipped publication permits a corrected decision and a separately approved new Activity`, async () => {
    const f = await publicationRuntime(provider);
    try {
      assert.equal((await correct(f, true)).status, 200);
      assert.equal((await f.act('review-publications')).status, 200);
      await f.r.startWorker();
      const skipped = (await f.wait('completed')).publications[0];
      assert.equal(skipped.status, 'skipped');
      await f.r.stopWorker();
      const corrected = await correct(f);
      assert.equal(corrected.status, 200);
      assert.equal(f.posts.length, 0);
      assert.equal((await f.view()).publications.length, 1);
      await setPolicy(f.r.f.store, {
        organization: 'alpha',
        user: f.r.f.alice.user.id,
        activity: 'review.publish',
        scope: 'organization',
        scopeId: 'alpha',
        effect: 'human',
      });
      const requests = await Promise.all([
        f.act('review-publications'),
        f.act('review-publications'),
      ]);
      assert.ok(requests.every((r) => r.status === 200));
      assert.equal(requests[0].body.publication.id, requests[1].body.publication.id);
      const p = requests[0].body.publication;
      assert.notEqual(p.id, skipped.id);
      assert.equal(p.decision, corrected.body.fact.id);
      assert.equal(p.status, 'waiting-approval');
      assert.equal((await f.act('publication-approval', { publication: skipped.id })).status, 409);
      assert.equal((await f.act('publication-approval', { publication: p.id })).status, 200);
      await f.r.startWorker();
      const completed = await f.wait('completed');
      assert.equal(completed.publications.length, 2);
      assert.deepEqual(
        completed.publications.find((row: any) => row.id === skipped.id),
        skipped,
      );
      assert.equal(f.posts.length, 1);
      assert.equal(f.effects.length, 1);
      assert.equal(f.r.requests.length, 1);
      assert.equal((await correct(f)).status, 409);
      const current = completed.publications.find((row: any) => row.id === p.id);
      assert.equal(current.status, 'completed');
      assert.equal((await f.r.f.request(f.path)).body.activeRun, undefined);
      assert.equal((await f.r.f.request(f.path)).body.state, 'registered');
      await f.r.stopWorker();
      await f.r.startWorker();
      assert.equal((await f.act('review-publications')).body.publication.id, p.id);
      assert.equal(f.posts.length, 1);
    } finally {
      await f.close();
    }
  });

  test(`${provider}: confirmed nonpublication permits correction without changing the previous Activity`, async () => {
    const f = await publicationRuntime(provider);
    try {
      f.behavior('reject');
      assert.equal((await f.act('review-publications')).status, 200);
      await f.r.startWorker();
      await f.wait('failed');
      f.behavior('success');
      const p = (await reconcile(f)).publications[0];
      assert.equal((await confirm(f, p, 'not-published')).status, 200);
      await f.r.stopWorker();
      const old = (await f.view()).publications[0];
      assert.equal((await correct(f)).status, 200);
      const requested = await f.act('review-publications');
      assert.equal(requested.status, 200);
      assert.notEqual(requested.body.publication.id, old.id);
      await f.r.startWorker();
      const completed = await f.wait('completed');
      assert.deepEqual(
        completed.publications.find((row: any) => row.id === old.id),
        old,
      );
      assert.equal(f.posts.length, 2);
      assert.equal(f.effects.length, 1);
      assert.ok(completed.publicationHistory.some((fact: any) => fact.payload.activity === old.id));
    } finally {
      await f.close();
    }
  });

  test(`${provider}: positive evidence survives later unavailable and empty listings and retains multiple effects`, async () => {
    const f = await publicationRuntime(provider);
    try {
      f.behavior('lost');
      assert.equal((await f.act('review-publications')).status, 200);
      await f.r.startWorker();
      await f.wait('uncertain');
      f.behavior('duplicate-evidence');
      let view = await reconcile(f);
      let p = view.publications[0];
      assert.equal(
        view.publicationHistory.find((row: any) => row.id === p.evidence).payload.matches.length,
        2,
      );
      const positive = p.evidence;
      f.behavior('evidence-error');
      view = await reconcile(f);
      p = view.publications[0];
      assert.notEqual(p.evidence, positive);
      assert.equal(
        view.publicationHistory.find((row: any) => row.id === p.evidence).payload.matches.length,
        2,
      );
      for (const resolution of ['retry', 'not-published'])
        assert.equal((await confirm(f, p, resolution)).status, 409);
      f.behavior('empty-evidence');
      view = await reconcile(f);
      p = view.publications[0];
      assert.equal((await confirm(f, p, 'retry')).status, 409);
      assert.equal((await confirm(f, p, 'completed')).status, 200);
      const completed = (await f.view()).publications[0];
      assert.deepEqual(completed.effects.map((effect: any) => effect.id).sort(), ['1', '999']);
      assert.equal(f.posts.length, 1);
      assert.equal((await f.r.f.request(f.path)).body.activeRun, undefined);
    } finally {
      await f.close();
    }
  });

  test(`${provider}: durable local proof of no authorized POST permits stopping with unavailable provider evidence`, async () => {
    const f = await publicationRuntime(provider);
    try {
      assert.equal((await f.act('review-publications')).status, 200);
      await putBlock(f);
      await f.r.startWorker();
      await f.wait('blocked');
      f.behavior('evidence-error');
      const view = await reconcile(f),
        p = view.publications[0];
      const evidence = view.publicationHistory.find((row: any) => row.id === p.evidence).payload;
      assert.equal(evidence.noDispatch, true);
      assert.equal((await confirm(f, p, 'retry')).status, 409);
      assert.equal((await confirm(f, p, 'not-published')).status, 200);
      assert.equal(f.posts.length, 0);
      assert.equal((await correct(f)).status, 200);
    } finally {
      await f.close();
    }
  });

  test(`${provider}: a stopped retry blocked before POST records local proof for that attempt`, async () => {
    const f = await publicationRuntime(provider);
    try {
      f.behavior('reject');
      assert.equal((await f.act('review-publications')).status, 200);
      await f.r.startWorker();
      await f.wait('failed');
      f.behavior('success');
      const first = (await reconcile(f)).publications[0];
      await f.r.stopWorker();
      assert.equal((await confirm(f, first, 'retry')).status, 200);
      await putBlock(f);
      await f.r.startWorker();
      await f.wait('blocked');
      f.behavior('evidence-error');
      const view = await reconcile(f),
        p = view.publications[0];
      const evidence = view.publicationHistory.find((row: any) => row.id === p.evidence).payload;
      assert.equal(evidence.attempt, 2);
      assert.equal(evidence.noDispatch, true);
      assert.equal((await confirm(f, p, 'not-published')).status, 200);
      assert.equal(f.posts.length, 1);
    } finally {
      await f.close();
    }
  });

  test(`${provider}: missing provider credentials still persist local non-dispatch evidence`, async () => {
    const f = await publicationRuntime(provider);
    try {
      assert.equal((await f.act('review-publications')).status, 200);
      await f.r.f.store.transaction(async (tx) => {
        const secrets = await tx.list(
          'secret',
          'organization = $organization AND purpose = $purpose',
          {
            organization: 'alpha',
            purpose: 'publication:write-fixture',
          },
        );
        assert.equal(secrets.length, 1);
        await tx.remove('secret', secrets[0].id);
      });
      await f.r.startWorker();
      const blocked = await f.wait('blocked');
      const failures = blocked.publicationHistory.filter(
        (row: any) => row.kind === 'publication.blocked',
      );
      assert.equal(failures.length, 1);
      assert.deepEqual(failures[0].payload, {
        activity: blocked.publications[0].id,
        run: f.run.id,
        attempt: blocked.publications[0].attempt,
        reason: 'Publication credential unavailable',
      });
      const view = await reconcile(f),
        p = view.publications[0];
      assert.deepEqual(
        view.publicationHistory.find((row: any) => row.id === failures[0].id),
        failures[0],
      );
      assert.ok(p.evidence, 'Recovery must record unavailable evidence even without credentials');
      const evidence = view.publicationHistory.find((row: any) => row.id === p.evidence).payload;
      assert.equal(evidence.unavailable, true);
      assert.equal(evidence.noDispatch, true);
      assert.equal((await confirm(f, p, 'not-published')).status, 200);
      assert.equal(f.posts.length, 0);
    } finally {
      await f.close();
    }
  });
}

async function putBlock(f: Fixture) {
  return setPolicy(f.r.f.store, {
    organization: 'alpha',
    user: f.r.f.alice.user.id,
    activity: 'review.publish',
    scope: 'organization',
    scopeId: 'alpha',
    effect: 'deny',
  });
}

test('github: a later page failure preserves positive matches and permits identified completion', async () => {
  const f = await publicationRuntime('github');
  try {
    f.behavior('lost');
    assert.equal((await f.act('review-publications')).status, 200);
    await f.r.startWorker();
    await f.wait('uncertain');
    f.behavior('partial-evidence');
    const view = await reconcile(f),
      p = view.publications[0];
    const evidence = view.publicationHistory.find((row: any) => row.id === p.evidence).payload;
    assert.equal(evidence.complete, false);
    assert.equal(evidence.matches.length, 1);
    assert.equal((await confirm(f, p, 'retry')).status, 409);
    assert.equal((await confirm(f, p, 'completed')).status, 200);
    assert.equal((await f.view()).publications[0].effect.id, '1');
    assert.equal(f.posts.length, 1);
  } finally {
    await f.close();
  }
});

test('github: bounded incomplete listings without matches cannot authorize retry or nonpublication', async () => {
  const f = await publicationRuntime('github');
  try {
    f.behavior('reject');
    assert.equal((await f.act('review-publications')).status, 200);
    await f.r.startWorker();
    await f.wait('failed');
    f.behavior('incomplete-evidence');
    const view = await reconcile(f),
      p = view.publications[0];
    const evidence = view.publicationHistory.find((row: any) => row.id === p.evidence).payload;
    assert.equal(evidence.complete, false);
    assert.equal(evidence.matches.length, 0);
    for (const resolution of ['retry', 'not-published'])
      assert.equal((await confirm(f, p, resolution)).status, 409);
    assert.equal(f.posts.length, 1);
  } finally {
    await f.close();
  }
});

test('Publication correction eligibility is private to callers with Artifact access', async () => {
  const f = await publicationRuntime('github');
  try {
    f.behavior('reject');
    assert.equal((await f.act('review-publications')).status, 200);
    await f.r.startWorker();
    await f.wait('failed');
    f.behavior('success');
    const p = (await reconcile(f)).publications[0];
    assert.equal((await confirm(f, p, 'not-published')).status, 200);
    assert.equal((await f.view()).publications[0].correctionAllowed, true);
    const credential = await f.r.f.request('/api/organizations/alpha/api-credentials', {
      operationId: 'read-only-publication',
      label: 'Workflow status only',
      activities: ['work-item.read', 'workflow.read'],
      expiresAt: Date.now() + 60000,
    });
    assert.equal(credential.status, 200);
    const restricted = await f.r.f.request(
      `${f.path}/reviews`,
      undefined,
      credential.body.token,
      true,
    );
    assert.equal(restricted.status, 200);
    assert.equal(restricted.body.publications[0].correctionAllowed, false);
    assert.deepEqual(restricted.body.publicationHistory, []);
    assert.deepEqual(restricted.body.reports, []);
  } finally {
    await f.close();
  }
});
