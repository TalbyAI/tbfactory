import { test } from 'node:test';
import assert from 'node:assert/strict';
import { publicationRuntime } from './support/publication-runtime';
import { putPublicationConfiguration } from '../src/server/publication-provider';
import { provision } from '../src/server/provision';
import { revokeMembership, setPolicy } from '../src/server/operator';
import { execFileSync } from 'node:child_process';
import { connectStore } from '../src/server/store';
import { Factory } from '../src/server/factory';
import { Authentication } from '../src/server/auth';
import { handleHttp } from '../src/server/http';

test('Sharing durations are bounded and calculated from server time', async () => {
  const f = await publicationRuntime('github', false, true);
  try {
    const input = { decision: f.decision.id, recipients: [f.r.f.alice.user.id] };
    const result = await f.act('artifact-shares', { ...input, expiresInDays: 30 });
    assert.equal(result.status, 200);
    assert.equal(result.body.share.expiresAt - result.body.share.createdAt, 30 * 86400000);
    for (const expiry of [
      { expiresInDays: 0 },
      { expiresInDays: 31 },
      { expiresInDays: 7, expiresAt: Date.now() + 86400000 },
    ]) {
      assert.equal((await f.act('artifact-shares', { ...input, ...expiry })).status, 422);
    }
  } finally {
    await f.close();
  }
});

test('Corrected Review Decisions create new content versions without redirecting existing references', async () => {
  const f = await publicationRuntime('github', false, true);
  try {
    const share = (
      await f.act('artifact-shares', { decision: f.decision.id, recipients: [f.r.f.alice.user.id] })
    ).body.share;
    const content = await (await f.r.download(new URL(share.url).pathname)).text();
    const corrected = await f.act('review-decisions', {
      reportVersion: f.report.id,
      reviewed: true,
      replaces: f.decision.id,
      findings: f.report.findings.map((finding: any, i: number) =>
        i === 0
          ? { finding: finding.id, decision: 'rejected', reason: 'PRIVATE CORRECTION' }
          : { finding: finding.id, decision: 'confirmed' },
      ),
    });
    assert.equal(corrected.status, 200);
    assert.equal(
      (
        await f.act('artifact-shares', {
          decision: f.decision.id,
          recipients: [f.r.f.alice.user.id],
        })
      ).status,
      409,
    );
    assert.equal((await f.act('review-publications', { reference: share.id })).status, 409);
    const renewed = (
      await f.act('artifact-shares', {
        decision: corrected.body.fact.id,
        recipients: [f.r.f.alice.user.id],
      })
    ).body.share;
    assert.notEqual(renewed.contentVersion, share.contentVersion);
    assert.equal(await (await f.r.download(new URL(share.url).pathname)).text(), content);
    const updated = await (await f.r.download(new URL(renewed.url).pathname)).text();
    assert.ok(updated.includes(f.report.findings[1].title));
    assert.ok(!updated.includes(f.report.findings[0].title));
    assert.ok(!updated.includes('PRIVATE CORRECTION'));
  } finally {
    await f.close();
  }
});

test('Revocation honors current execution authority while remaining independent of creator, inputs and provider configuration', async () => {
  const f = await publicationRuntime('github', false, true);
  try {
    const share = (
      await f.act('artifact-shares', { decision: f.decision.id, recipients: [f.r.f.alice.user.id] })
    ).body.share;
    const bob = await f.r.f.login('bob');
    await provision(f.r.f.store, {
      organization: { id: 'alpha', name: 'Alpha' },
      projects: [],
      members: [
        {
          issuer: f.r.f.op.issuer,
          subject: 'bob',
          grants: ['work-item.read', 'artifact.revoke', 'approval.artifact-revoke'].map(
            (activity) => ({
              activity,
              scope: 'repository',
              scopeId: 'alpha-repo',
              effect: 'allow',
            }),
          ),
        },
      ],
    });
    await setPolicy(f.r.f.store, {
      organization: 'alpha',
      user: bob.user.id,
      activity: 'artifact.revoke',
      scope: 'organization',
      scopeId: 'alpha',
      effect: 'human',
    });
    const revoke = (input: Record<string, unknown>, approve = false) =>
      f.r.f.request(
        `${f.path}/artifact-shares/${share.id}/${approve ? 'revoke-approve' : 'revoke'}`,
        { operationId: crypto.randomUUID(), ...input },
        bob.token,
      );
    const pending = await revoke({});
    assert.equal(pending.body.status, 'waiting-approval');
    const deny = await setPolicy(f.r.f.store, {
      organization: 'alpha',
      user: bob.user.id,
      activity: 'artifact.revoke',
      scope: 'repository',
      scopeId: 'alpha-repo',
      effect: 'deny',
    });
    assert.equal(
      (await revoke({ request: pending.body.share.revocation.request }, true)).status,
      403,
    );
    await f.r.f.request(`/api/organizations/alpha/policies/${deny.id}/remove`, {
      operationId: 'remove-revoke-deny',
    });
    await f.r.f.request(`${f.path}/review-facts`, {
      operationId: 'stale-before-revoke',
      fields: { sourceCommit: 'a'.repeat(40) },
    });
    await putPublicationConfiguration(
      f.r.f.store,
      f.r.secrets,
      { ...f.config, enabled: false },
      ['127.0.0.1'],
      true,
    );
    await revokeMembership(f.r.f.store, { organization: 'alpha', user: f.r.f.alice.user.id });
    const result = await revoke({ request: pending.body.share.revocation.request }, true);
    assert.equal(result.status, 200);
    assert.equal(result.body.share.status, 'revoked');
  } finally {
    await f.close();
  }
});

test('Selected expiry survives web and database restart on the same persistent volumes', async () => {
  const f = await publicationRuntime('github', false, true);
  let restarted: Awaited<ReturnType<typeof connectStore>> | undefined;
  try {
    const share = (
      await f.act('artifact-shares', {
        decision: f.decision.id,
        recipients: [f.r.f.alice.user.id],
        expiresAt: Date.now() + 2500,
      })
    ).body.share;
    assert.equal((await f.r.download(new URL(share.url).pathname)).status, 200);
    execFileSync('docker', ['restart', 'tbfactory-acceptance-db'], {
      windowsHide: true,
      stdio: 'pipe',
    });
    restarted = await connectStore(f.r.f.config);
    const services = {
      factory: new Factory(restarted, undefined, f.r.f.factory.sharing),
      auth: await Authentication.create(restarted, f.r.f.oidcConfig),
      origin: 'http://localhost:3000',
      artifacts: f.r.f.factory.sharing.artifacts,
    };
    await new Promise((resolve) => setTimeout(resolve, Math.max(0, share.expiresAt - Date.now())));
    const headers = { cookie: `__Host-factory_session=${f.r.f.alice.token}` };
    assert.equal((await handleHttp(new Request(share.url, { headers }), services)).status, 403);
    const result = await handleHttp(
      new Request(`http://localhost:3000${f.path}/artifact-shares`, { headers }),
      services,
    );
    const retained = (await result.json()).shares.find((s: any) => s.id === share.id);
    assert.equal(retained.status, 'expired');
    assert.equal(retained.expiresAt, share.expiresAt);
    assert.equal(retained.contentVersion, share.contentVersion);
  } finally {
    await restarted?.close();
    await f.close();
  }
});

test('Changing only the Repository default after publication queues preserves its retained reference mode', async () => {
  const f = await publicationRuntime('github', false, true);
  try {
    const share = (
      await f.act('artifact-shares', { decision: f.decision.id, recipients: [f.r.f.alice.user.id] })
    ).body.share;
    assert.equal((await f.act('review-publications', { reference: share.id })).status, 200);
    await putPublicationConfiguration(
      f.r.f.store,
      f.r.secrets,
      { ...f.config, defaultMode: 'report-reference' },
      ['127.0.0.1'],
      true,
    );
    await f.r.startWorker();
    await f.wait('completed');
    assert.equal(f.posts.length, 1);
    assert.ok(f.posts[0].body.body.includes(share.url));
  } finally {
    await f.close();
  }
});
