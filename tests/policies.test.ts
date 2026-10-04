import { test } from 'node:test';
import assert from 'node:assert/strict';
import { fixture } from './support/factory.ts';
import { provision } from '../src/server/provision.ts';
import { setPolicy } from '../src/server/operator.ts';

test('Ownership and applicable restrictive policies prevail for UI and API; no administrator bypass exists', async () => {
  const f = await fixture();
  try {
    await f.bootstrap('alpha');
    await provision(f.store, {
      organization: { id: 'alpha', name: 'Alpha' },
      projects: [
        {
          id: 'other-project',
          name: 'Other',
          repositories: [{ id: 'other-repo', name: 'Other repo' }],
        },
      ],
      members: [],
    });
    const input = {
      operationId: 'wrong-owner',
      project: 'alpha-project',
      repository: 'other-repo',
      title: 'Wrong owner',
      type: 'pull-request-review',
    };
    assert.equal((await f.request('/api/organizations/alpha/work-items', input)).status, 409);
    const credential = await f.request('/api/organizations/alpha/api-credentials', {
      operationId: 'token',
      label: 'Create',
      activities: ['work-item.create'],
      expiresAt: Date.now() + 3600000,
    });
    await setPolicy(f.store, {
      organization: 'alpha',
      user: f.alice.user.id,
      activity: 'work-item.create',
      effect: 'human',
      scope: 'project',
      scopeId: 'alpha-project',
    });
    const manual = await f.request('/api/organizations/alpha/work-items', {
      ...input,
      repository: 'alpha-repo',
      operationId: 'manual',
    });
    assert.equal(manual.status, 200);
    assert.equal(
      (
        await f.request(
          '/api/organizations/alpha/work-items',
          { ...input, repository: 'alpha-repo', operationId: 'automatic' },
          credential.body.token,
          true,
        )
      ).status,
      403,
    );
    await setPolicy(f.store, {
      organization: 'alpha',
      user: f.alice.user.id,
      activity: 'work-item.create',
      effect: 'deny',
      scope: 'repository',
      scopeId: 'alpha-repo',
    });
    assert.equal(
      (
        await f.request('/api/organizations/alpha/work-items', {
          ...input,
          repository: 'alpha-repo',
          operationId: 'denied',
        })
      ).status,
      403,
    );
    await assert.rejects(
      setPolicy(f.store, {
        organization: 'beta',
        user: f.alice.user.id,
        activity: 'work-item.create',
        effect: 'allow',
        scope: 'project',
        scopeId: 'alpha-project',
      }),
      /membership|ownership/i,
    );
  } finally {
    await f.close();
  }
});

test('Expired browser sessions and credentials fail immediately and configured lifetimes are bounded', async (context) => {
  const f = await fixture();
  try {
    await f.bootstrap('alpha');
    const input = {
      operationId: 'expires',
      label: 'Expiring',
      activities: ['organization.read'],
      expiresAt: Date.now() + 600000,
    };
    assert.equal(
      (
        await f.request('/api/organizations/alpha/api-credentials', {
          ...input,
          operationId: 'too-long',
          expiresAt: Date.now() + 91 * 86400000,
        })
      ).status,
      422,
    );
    const issued = await f.request('/api/organizations/alpha/api-credentials', input);
    assert.equal(issued.status, 200);
    context.mock.timers.enable({ apis: ['Date'], now: Date.now() + 1200000 });
    assert.equal(
      (await f.request('/api/organizations', undefined, issued.body.token, true)).status,
      401,
    );
    assert.equal((await f.request('/api/organizations')).status, 200);
    context.mock.timers.setTime(Date.now() + 13 * 3600000);
    assert.equal((await f.request('/api/organizations')).status, 401);
  } finally {
    context.mock.timers.reset();
    await f.close();
  }
});
