import { test } from 'node:test';
import assert from 'node:assert/strict';
import { fixture } from './support/factory.ts';
import { setPolicy, revokeMembership } from '../src/server/operator.ts';

test('Invitation issuance rejects user-scoped grants without creating Invitations or receipts', async () => {
  const f = await fixture();
  try {
    await f.bootstrap('alpha');
    await setPolicy(f.store, {
      activity: 'delegate:organization.read:allow',
      scope: 'organization',
      scopeId: 'alpha',
      effect: 'allow',
      user: f.alice.user.id,
      organization: 'alpha',
    });
    const input = {
      operationId: 'user-grant',
      email: 'bob@example.test',
      grants: [
        { activity: 'organization.read', scope: 'user', scopeId: f.alice.user.id, effect: 'allow' },
      ],
    };
    assert.equal((await f.request('/api/organizations/alpha/invitations', input)).status, 422);
    await f.store.transaction(async (tx) => {
      assert.equal(
        (await tx.list('invitation', 'organization = $organization', { organization: 'alpha' }))
          .length,
        0,
      );
      assert.equal(
        (await tx.list('receipt', 'organization = $organization', { organization: 'alpha' }))
          .length,
        0,
      );
    });
    const corrected = {
      ...input,
      grants: [{ ...input.grants[0], scope: 'organization', scopeId: 'alpha' }],
    };
    assert.equal((await f.request('/api/organizations/alpha/invitations', corrected)).status, 200);
  } finally {
    await f.close();
  }
});

test('Invitations require delegation and verified explicit acceptance, consume once, and never resurrect revoked access on retry', async () => {
  const f = await fixture();
  try {
    await f.bootstrap('alpha');
    const grants = ['organization.read', 'project.read', 'work-item.read', 'history.read'].map(
      (activity) => ({ activity, scope: 'organization', scopeId: 'alpha', effect: 'allow' }),
    );
    const input = { operationId: 'invite', email: 'bob@example.test', grants };
    assert.equal((await f.request('/api/organizations/alpha/invitations', input)).status, 403);
    for (const grant of grants)
      await setPolicy(f.store, {
        ...grant,
        activity: `delegate:${grant.activity}:allow`,
        user: f.alice.user.id,
        organization: 'alpha',
      });
    const invitation = await f.request('/api/organizations/alpha/invitations', input);
    assert.equal(invitation.status, 200);
    assert.ok(invitation.body.token);
    assert.equal(
      (await f.request('/api/organizations/alpha/invitations', input)).body.token,
      undefined,
    );
    const bob = await f.login('bob');
    const preview = await f.request(
      `/api/invitations/preview?token=${invitation.body.token}`,
      undefined,
      bob.token,
    );
    assert.equal(preview.status, 200);
    assert.equal(
      (await f.request('/api/organizations', undefined, bob.token)).body.items.length,
      0,
    );
    const accept = { operationId: 'accept', token: invitation.body.token };
    const accepted = await Promise.all(
      Array.from({ length: 6 }, () => f.request('/api/invitations/accept', accept, bob.token)),
    );
    assert.ok(accepted.every((r) => r.status === 200));
    assert.ok(accepted.every((r) => r.body.membership.id === accepted[0].body.membership.id));
    assert.equal(
      (await f.request('/api/organizations', undefined, bob.token)).body.items.length,
      1,
    );
    const changedContact = await f.login('bob', false, 'changed@example.test');
    assert.deepEqual(
      await f.request('/api/invitations/accept', accept, changedContact.token),
      accepted[0],
    );
    await revokeMembership(f.store, { organization: 'alpha', user: bob.user.id });
    assert.equal((await f.request('/api/invitations/accept', accept, bob.token)).status, 200);
    assert.equal(
      (await f.request('/api/organizations', undefined, bob.token)).body.items.length,
      0,
    );
    const stale = await f.request('/api/organizations/alpha/invitations', {
      ...input,
      operationId: 'new',
      email: 'charlie@example.test',
    });
    assert.equal(
      (
        await f.request(`/api/organizations/alpha/invitations/${stale.body.invitation.id}/revoke`, {
          operationId: 'revoke',
        })
      ).status,
      200,
    );
    const charlie = await f.login('charlie');
    assert.equal(
      (
        await f.request(
          '/api/invitations/accept',
          { operationId: 'bad', token: stale.body.token },
          charlie.token,
        )
      ).status,
      409,
    );
  } finally {
    await f.close();
  }
});

test('Invitation expiry and loss of delegation reject activation; another User cannot reuse a consumed link', async (context) => {
  const f = await fixture();
  try {
    await f.bootstrap('alpha');
    const grant = {
      activity: 'organization.read',
      scope: 'organization',
      scopeId: 'alpha',
      effect: 'allow',
    };
    const delegation = {
      ...grant,
      activity: 'delegate:organization.read:allow',
      user: f.alice.user.id,
      organization: 'alpha',
    };
    await setPolicy(f.store, delegation);
    const issue = (operationId: string, email: string) =>
      f.request('/api/organizations/alpha/invitations', { operationId, email, grants: [grant] });
    const expiring = await issue('expiring', 'bob@example.test');
    context.mock.timers.enable({ apis: ['Date'], now: Date.now() + 8 * 86400000 });
    const bob = await f.login('bob');
    assert.equal(
      (
        await f.request(
          '/api/invitations/accept',
          { operationId: 'expired', token: expiring.body.token },
          bob.token,
        )
      ).status,
      409,
    );
    assert.equal(
      (await f.request('/api/organizations', undefined, bob.token)).body.items.length,
      0,
    );
    context.mock.timers.reset();
    const invitation = await issue('consume', 'charlie@example.test');
    const charlie = await f.login('charlie');
    assert.equal(
      (
        await f.request(
          '/api/invitations/accept',
          { operationId: 'accept', token: invitation.body.token },
          charlie.token,
        )
      ).status,
      200,
    );
    const different = await f.login('different-subject', true, 'charlie@example.test');
    assert.equal(
      (
        await f.request(
          '/api/invitations/accept',
          { operationId: 'reuse', token: invitation.body.token },
          different.token,
        )
      ).status,
      409,
    );
    assert.equal(
      (await f.request('/api/organizations', undefined, different.token)).body.items.length,
      0,
    );
    const lostAuthority = await issue('lost-delegation', 'dave@example.test');
    const dave = await f.login('dave');
    await setPolicy(f.store, { ...delegation, effect: 'deny' });
    assert.equal(
      (
        await f.request(
          '/api/invitations/accept',
          { operationId: 'denied', token: lostAuthority.body.token },
          dave.token,
        )
      ).status,
      403,
    );
    assert.equal(
      (await f.request('/api/organizations', undefined, dave.token)).body.items.length,
      0,
    );
  } finally {
    context.mock.timers.reset();
    await f.close();
  }
});

test('Invalid recipient, lost issuer authority, existing Membership and stale Invitations have no access side effects', async () => {
  const f = await fixture();
  try {
    await f.bootstrap('alpha');
    const grant = {
      activity: 'organization.read',
      scope: 'organization',
      scopeId: 'alpha',
      effect: 'allow',
    };
    await setPolicy(f.store, {
      ...grant,
      activity: 'delegate:organization.read:allow',
      user: f.alice.user.id,
      organization: 'alpha',
    });
    const issue = async (email: string, operationId: string) =>
      f.request('/api/organizations/alpha/invitations', { operationId, email, grants: [grant] });
    const pending = await issue('bob@example.test', 'bob');
    const bob = await f.login('bob', false);
    assert.equal(
      (
        await f.request(
          '/api/invitations/accept',
          { operationId: 'unverified', token: pending.body.token },
          bob.token,
        )
      ).status,
      403,
    );
    const wrong = await f.login('other');
    assert.equal(
      (
        await f.request(
          '/api/invitations/accept',
          { operationId: 'wrong', token: pending.body.token },
          wrong.token,
        )
      ).status,
      403,
    );
    const verified = await f.login('bob');
    await f.bootstrap('alpha', ['alice', 'bob']);
    assert.equal(
      (
        await f.request(
          '/api/invitations/accept',
          { operationId: 'already-active', token: pending.body.token },
          verified.token,
        )
      ).status,
      409,
    );
    await revokeMembership(f.store, { organization: 'alpha', user: verified.user.id });
    assert.equal(
      (
        await f.request(
          '/api/invitations/accept',
          { operationId: 'stale', token: pending.body.token },
          verified.token,
        )
      ).status,
      409,
    );
    await new Promise((r) => setTimeout(r, 2));
    const recent = await issue('bob@example.test', 'new-bob');
    assert.equal(
      (
        await f.request(
          '/api/invitations/accept',
          { operationId: 'reactivate', token: recent.body.token },
          verified.token,
        )
      ).status,
      200,
    );
    const charlieInvitation = await issue('charlie@example.test', 'charlie');
    const charlie = await f.login('charlie');
    await revokeMembership(f.store, { organization: 'alpha', user: f.alice.user.id });
    assert.equal(
      (
        await f.request(
          '/api/invitations/accept',
          { operationId: 'lost-authority', token: charlieInvitation.body.token },
          charlie.token,
        )
      ).status,
      404,
    );
    assert.equal(
      (await f.request('/api/organizations', undefined, charlie.token)).body.items.length,
      0,
    );
  } finally {
    await f.close();
  }
});
