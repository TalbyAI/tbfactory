import { test } from 'node:test';
import assert from 'node:assert/strict';
import { fixture } from './support/factory';
import { publicationRuntime } from './support/publication-runtime';
import { putPublicationConfiguration } from '../src/server/publication-provider';
import { setPolicy, revokeMembership } from '../src/server/operator';
import { provision } from '../src/server/provision';
import { handleHttp } from '../src/server/http';
import { writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { restartTestDatabase } from './support/database-restart';

for (const provider of ['github', 'azure-devops'] as const) {
  test(`${provider}: revocation committed during provider verification blocks POST and preserves recovery`, async () => {
    const f = await publicationRuntime(provider, false, true);
    try {
      const share = (
        await f.act('artifact-shares', {
          decision: f.decision.id,
          recipients: [f.r.f.alice.user.id],
        })
      ).body.share;
      assert.equal((await f.act('review-publications', { reference: share.id })).status, 200);
      f.holdRepository();
      await f.r.startWorker();
      const deadline = Date.now() + 15000;
      while (!f.repositoryEntered() && Date.now() < deadline)
        await new Promise((resolve) => setTimeout(resolve, 50));
      assert.ok(f.repositoryEntered());
      assert.equal(
        (
          await f.r.f.request(`${f.path}/artifact-shares/${share.id}/revoke`, {
            operationId: 'revoke-before-post',
          })
        ).status,
        200,
      );
      f.release();
      await f.wait('blocked');
      assert.equal(f.posts.length, 0);
      assert.equal((await f.r.download(new URL(share.url).pathname)).status, 403);
      assert.equal((await f.act('publication-reconciliation')).status, 200);
      const p = (await f.wait('uncertain')).publications[0];
      assert.equal(
        (
          await f.act('publication-confirmation', {
            evidence: p.evidence,
            resolution: 'not-published',
            reason: 'Revoked before authorized dispatch; stopped',
            confirmedStopped: true,
          })
        ).status,
        200,
      );
    } finally {
      await f.close();
    }
  });
  test(`${provider}: revoked uncertain reference still reconciles exact provider effects across restart without retry`, async () => {
    const f = await publicationRuntime(provider, false, true);
    try {
      const share = (
        await f.act('artifact-shares', {
          decision: f.decision.id,
          recipients: [f.r.f.alice.user.id],
        })
      ).body.share;
      const original = await f.r.download(new URL(share.url).pathname);
      const content = await original.text();
      f.behavior('lost');
      assert.equal((await f.act('review-publications', { reference: share.id })).status, 200);
      await f.r.startWorker();
      await f.wait('uncertain');
      assert.equal(f.posts.length, 1);
      await f.r.f.request(`${f.path}/artifact-shares/${share.id}/revoke`, {
        operationId: 'revoke-uncertain',
      });
      await f.r.stopWorker();
      await restartTestDatabase(f.r.f.config.url);
      await f.r.startWorker();
      const listing = (await f.r.f.request(`${f.path}/artifact-shares`)).body.shares;
      const restored = listing.find((s: any) => s.id === share.id);
      assert.equal(restored.status, 'revoked');
      assert.equal(restored.expiresAt, share.expiresAt);
      assert.equal(restored.contentVersion, share.contentVersion);
      assert.equal((await f.r.download(new URL(share.url).pathname)).status, 403);
      f.behavior('success');
      await f.act('publication-reconciliation');
      const p = (await f.wait('uncertain')).publications[0];
      assert.equal(
        (
          await f.act('publication-confirmation', {
            evidence: p.evidence,
            resolution: 'retry',
            reason: 'Must not repeat a positive effect',
            confirmedStopped: true,
          })
        ).status,
        409,
      );
      assert.equal(
        (
          await f.act('publication-confirmation', {
            evidence: p.evidence,
            resolution: 'completed',
            reason: 'Verified exact retained provider comment',
            confirmedStopped: true,
          })
        ).status,
        200,
      );
      assert.equal(f.posts.length, 1);
      const renewed = (
        await f.act('artifact-shares', {
          decision: f.decision.id,
          recipients: [f.r.f.alice.user.id],
        })
      ).body.share;
      assert.notEqual(renewed.id, share.id);
      assert.equal(renewed.contentVersion, share.contentVersion);
      assert.equal(await (await f.r.download(new URL(renewed.url).pathname)).text(), content);
      await writeFile(join(f.r.directory, 'artifacts', renewed.contentVersion), 'corrupted');
      assert.equal((await f.r.download(new URL(renewed.url).pathname)).status, 503);
    } finally {
      await f.close();
    }
  });
  test(`${provider}: empty confirmed output creates neither a share nor provider comment`, async () => {
    const f = await publicationRuntime(provider, true, true);
    try {
      const result = await f.act('artifact-shares', {
        decision: f.decision.id,
        recipients: [f.r.f.alice.user.id],
      });
      assert.equal(result.status, 200);
      assert.equal(result.body.share, null);
      assert.equal((await f.r.f.request(`${f.path}/artifact-shares`)).body.shares.length, 0);
      assert.equal((await f.act('review-publications')).status, 200);
      await f.r.startWorker();
      assert.equal((await f.wait('completed')).publications[0].status, 'skipped');
      assert.equal(f.posts.length, 0);
    } finally {
      await f.close();
    }
  });
}

test('Named recipients read only shared content; limits, expiry, Membership and prohibitions fail closed', async () => {
  const f = await publicationRuntime('github', false, true);
  try {
    const bob = await f.r.f.login('bob');
    await provision(f.r.f.store, {
      organization: { id: 'alpha', name: 'Alpha' },
      projects: [],
      members: [
        {
          issuer: f.r.f.op.issuer,
          subject: 'bob',
          grants: [
            {
              activity: 'artifact.shared-read',
              scope: 'repository',
              scopeId: 'alpha-repo',
              effect: 'allow',
            },
          ],
        },
      ],
    });
    const input = { decision: f.decision.id, recipients: [bob.user.id] };
    for (const invalid of [
      [],
      Array(51).fill(bob.user.id),
      [bob.user.id, bob.user.id],
      ['unknown-user'],
    ])
      assert.equal((await f.act('artifact-shares', { ...input, recipients: invalid })).status, 422);
    for (const expiresAt of [Date.now() - 1, Date.now() + 31 * 86400000])
      assert.equal((await f.act('artifact-shares', { ...input, expiresAt })).status, 422);
    const share = (await f.act('artifact-shares', input)).body.share;
    const path = new URL(share.url).pathname;
    assert.equal((await f.r.download(path, bob.token)).status, 200);
    assert.equal((await f.r.download(path)).status, 403);
    assert.equal((await f.r.download(path, '')).status, 401);
    assert.equal((await f.r.f.request(f.path, undefined, bob.token)).status, 403);
    assert.equal((await f.r.f.request(`${f.path}/reviews`, undefined, bob.token)).status, 403);
    assert.equal((await f.r.f.request(`${f.path}/facts`, undefined, bob.token)).status, 403);
    assert.equal(
      (await f.r.download(`${f.path}/reviews/${f.report.id}/artifact`, bob.token)).status,
      403,
    );
    const beta = await f.r.f.login('charlie');
    await f.r.f.bootstrap('beta', ['charlie']);
    assert.equal((await f.r.download(path, beta.token)).status, 404);
    const credential = await f.r.f.request('/api/organizations/alpha/api-credentials', {
      operationId: 'read-credential',
      label: 'reader',
      activities: ['artifact.shared-read'],
      expiresAt: Date.now() + 60000,
    });
    const api = await handleHttp(
      new Request(share.url, { headers: { authorization: `Bearer ${credential.body.token}` } }),
      {
        auth: f.r.f.auth,
        factory: f.r.f.factory,
        origin: 'http://localhost:3000',
        artifacts: f.r.f.factory.sharing.artifacts,
      },
    );
    assert.equal(api.status, 403);
    await setPolicy(f.r.f.store, {
      organization: 'alpha',
      user: bob.user.id,
      activity: 'artifact.shared-read',
      scope: 'repository',
      scopeId: 'alpha-repo',
      effect: 'deny',
    });
    assert.equal((await f.r.download(path, bob.token)).status, 403);
    await revokeMembership(f.r.f.store, { organization: 'alpha', user: bob.user.id });
    assert.equal((await f.r.download(path, bob.token)).status, 404);
    const expired = (
      await f.act('artifact-shares', {
        decision: f.decision.id,
        recipients: [f.r.f.alice.user.id],
        expiresAt: Date.now() + 1500,
      })
    ).body.share;
    await new Promise((resolve) => setTimeout(resolve, 1600));
    assert.equal((await f.r.download(new URL(expired.url).pathname)).status, 403);
    const listing = await f.r.f.request(`${f.path}/artifact-shares`);
    assert.equal(listing.body.shares.find((s: any) => s.id === expired.id).status, 'expired');
  } finally {
    await f.close();
  }
});

test('Sharing and revocation require separate scoped execution and input-bound human Approval', async () => {
  const f = await publicationRuntime('github', false, true);
  try {
    const input = { decision: f.decision.id, recipients: [f.r.f.alice.user.id] };
    const deny = await setPolicy(f.r.f.store, {
      organization: 'alpha',
      user: f.r.f.alice.user.id,
      activity: 'artifact.share',
      scope: 'repository',
      scopeId: 'alpha-repo',
      effect: 'deny',
    });
    assert.equal((await f.act('artifact-shares', input)).status, 403);
    await f.r.f.request(`/api/organizations/alpha/policies/${deny.id}/remove`, {
      operationId: 'remove-share-deny',
    });
    await setPolicy(f.r.f.store, {
      organization: 'alpha',
      user: f.r.f.alice.user.id,
      activity: 'artifact.share',
      scope: 'organization',
      scopeId: 'alpha',
      effect: 'human',
    });
    const pending = (await f.act('artifact-shares', input)).body.share;
    assert.equal(pending.status, 'waiting-approval');
    assert.equal((await f.r.download(new URL(pending.url).pathname)).status, 403);
    const approve = `artifact-shares/${pending.id}/approve`;
    assert.equal((await f.act(approve)).status, 422);
    const post = (endpoint: string, body: Record<string, unknown> = {}) =>
      f.r.f.request(`${f.path}/artifact-shares/${pending.id}/${endpoint}`, {
        operationId: crypto.randomUUID(),
        ...body,
      });
    assert.equal((await post('approve')).status, 200);
    assert.equal((await f.r.download(new URL(pending.url).pathname)).status, 200);
    await setPolicy(f.r.f.store, {
      organization: 'alpha',
      user: f.r.f.alice.user.id,
      activity: 'artifact.revoke',
      scope: 'repository',
      scopeId: 'alpha-repo',
      effect: 'human',
    });
    const revocation = await post('revoke');
    assert.equal(revocation.body.status, 'waiting-approval');
    assert.equal((await f.r.download(new URL(pending.url).pathname)).status, 200);
    assert.equal((await post('revoke-approve', { request: 'stale-request' })).status, 409);
    const results = await Promise.all([
      post('revoke-approve', { request: revocation.body.share.revocation.request }),
      post('revoke-approve', { request: revocation.body.share.revocation.request }),
    ]);
    assert.ok(results.every((r) => r.status === 200));
    assert.equal((await f.r.download(new URL(pending.url).pathname)).status, 403);
    assert.equal((await post('approve')).status, 409);
  } finally {
    await f.close();
  }
});

for (const provider of ['github', 'azure-devops'] as const) {
  test(`${provider}: publishes only an explicitly authorized immutable reference and retains the initial mode`, async () => {
    const f = await publicationRuntime(provider, false, true);
    try {
      assert.equal((await f.act('review-publications')).status, 409);
      const share = (
        await f.act('artifact-shares', {
          decision: f.decision.id,
          recipients: [f.r.f.alice.user.id],
        })
      ).body.share;
      await putPublicationConfiguration(
        f.r.f.store,
        f.r.secrets,
        { ...f.config, defaultMode: 'confirmed-content' },
        ['127.0.0.1'],
        true,
      );
      const publication = await f.act('review-publications', { reference: share.id });
      assert.equal(publication.status, 200);
      assert.equal(publication.body.publication.contentVersion, share.contentVersion);
      await f.r.startWorker();
      await f.wait('completed');
      const content = f.posts[0].body.body ?? f.posts[0].body.comments[0].content;
      assert.ok(content.includes(share.url));
      assert.ok(content.includes('TBFactory publication'));
      for (const privateValue of [
        f.report.summary,
        ...f.report.findings.map((finding: any) => finding.title),
        f.report.id,
        f.decision.id,
      ])
        assert.ok(!content.includes(privateValue));
      assert.equal((await f.r.f.request(f.path)).body.publicationMode, 'report-reference');
    } finally {
      await f.close();
    }
  });
}

test('Explicit sharing creates immutable confirmed-only content and requires independent share authority', async () => {
  const f = await publicationRuntime('github', false, true);
  try {
    const result = await f.act('artifact-shares', {
      decision: f.decision.id,
      recipients: [f.r.f.alice.user.id],
    });
    assert.equal(result.status, 200);
    const share = result.body.share;
    assert.equal(share.status, 'active');
    assert.equal(share.expiresAt - share.createdAt, 7 * 86400000);
    const response = await f.r.download(share.url.replace('http://localhost:3000', ''));
    assert.equal(response.status, 200);
    const content = await response.text();
    assert.ok(content.includes(f.report.findings[0].title));
    for (const secret of [
      f.report.summary,
      f.report.findings[1].title,
      'PRIVATE REJECTION REASON',
      f.report.id,
      f.decision.id,
    ])
      assert.ok(!content.includes(secret));
    assert.equal(response.headers.get('cache-control'), 'no-store');
    assert.equal(f.posts.length, 0);
  } finally {
    await f.close();
  }
});

test('Version 5 adds sharing Approval Points and rejects reference mode on retained definitions', async () => {
  const f = await fixture();
  try {
    await f.bootstrap('alpha');
    const base = '/api/organizations/alpha';
    const before = (await f.request(`${base}/work-item-types`)).body.definitions;
    assert.equal(
      (
        await f.request(`${base}/work-item-types`, {
          operationId: 'v5',
          type: 'pull-request-review',
          version: 5,
          enabled: true,
        })
      ).status,
      200,
    );
    const after = (await f.request(`${base}/work-item-types`)).body.definitions;
    assert.deepEqual(after.slice(0, 4), before.slice(0, 4));
    assert.ok(after[4].approvalPoints.some((p: any) => p.id === 'artifact.share'));
    assert.ok(after[4].approvalPoints.some((p: any) => p.id === 'artifact.revoke'));
    const input = {
      operationId: 'new',
      project: 'alpha-project',
      repository: 'alpha-repo',
      title: 'Reference review',
      type: 'pull-request-review',
      publicationMode: 'report-reference',
    };
    const created = await f.request(`${base}/work-items`, input);
    assert.equal(created.status, 200);
    assert.equal(created.body.workItem.publicationMode, 'report-reference');
    await f.request(`${base}/work-item-types`, {
      operationId: 'v4',
      type: 'pull-request-review',
      version: 4,
      enabled: true,
    });
    assert.equal(
      (await f.request(`${base}/work-items`, { ...input, operationId: 'incompatible' })).status,
      422,
    );
  } finally {
    await f.close();
  }
});
