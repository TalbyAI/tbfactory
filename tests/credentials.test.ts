import { test } from 'node:test';
import assert from 'node:assert/strict';
import { fixture } from './support/factory.ts';
import { revokeMembership, setPolicy } from '../src/server/operator.ts';

test('API credentials return secrets once, narrow Activities and Organization, and respect current revocation', async () => {
  const f = await fixture();
  try {
    await f.bootstrap('alpha'); await f.bootstrap('beta');
    const input = { operationId: 'issue', label: 'Read alpha', activities: ['organization.read', 'project.read', 'work-item.read', 'history.read'], expiresAt: Date.now() + 3600000 };
    const issued = await f.request('/api/organizations/alpha/api-credentials', input);
    assert.equal(issued.status, 200); assert.ok(issued.body.token);
    const replay = await f.request('/api/organizations/alpha/api-credentials', input);
    assert.equal(replay.body.token, undefined); assert.equal(replay.body.secretUnavailable, true);
    assert.equal(replay.body.credential.id, issued.body.credential.id);
    assert.equal((await f.request('/api/organizations/beta/projects', undefined, issued.body.token, true)).status, 404);
    assert.equal((await f.request('/api/organizations/alpha/work-items', { operationId: 'blocked', project: 'alpha-project', title: 'Denied', type: 'pull-request-review' }, issued.body.token, true)).status, 403);
    assert.equal((await f.request('/api/organizations/alpha/api-credentials', { ...input, operationId: 'replace' }, issued.body.token, true)).status, 403);
    await setPolicy(f.store, { organization: 'alpha', user: f.alice.user.id, scope: 'organization', scopeId: 'alpha', activity: 'project.read', effect: 'deny' });
    assert.equal((await f.request('/api/organizations/alpha/projects', undefined, issued.body.token, true)).body.items.length, 0);
    assert.equal((await f.request(`/api/organizations/alpha/api-credentials/${issued.body.credential.id}/revoke`, { operationId: 'revoke' })).status, 200);
    assert.equal((await f.request('/api/organizations', undefined, issued.body.token, true)).status, 401);
    const next = await f.request('/api/organizations/alpha/api-credentials', { ...input, operationId: 'next', activities: ['organization.read'] });
    await revokeMembership(f.store, { organization: 'alpha', user: f.alice.user.id });
    assert.equal((await f.request('/api/organizations/alpha/projects')).status, 404);
    assert.equal((await f.request('/api/organizations/alpha/projects', undefined, next.body.token, true)).status, 404);
  } finally { await f.close(); }
});
