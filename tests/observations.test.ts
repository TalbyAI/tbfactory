import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { randomBytes } from 'node:crypto';
import { Surreal } from 'surrealdb';
import { fixture } from './support/factory.ts';
import { KeyRing } from '../src/server/key-ring.ts';
import { OrganizationSecrets } from '../src/server/secrets.ts';
import { handleHttp } from '../src/server/http.ts';
import { sourceInput, observation, delivery } from './support/observations.ts';
import { putSource } from '../src/server/observations.ts';
import { provision } from '../src/server/provision.ts';

async function ingestionFixture() {
  const f = await fixture();
  await f.bootstrap('alpha');
  const directory = await mkdtemp(join(tmpdir(), 'factory-observations-'));
  const ring = new KeyRing({ directory: join(directory, 'ring'), backupDirectory: join(directory, 'backup'), rootKey: randomBytes(32), installation: 'observations', rootVersion: 'root-1' });
  await ring.setup();
  const secrets = new OrganizationSecrets(f.store, ring);
  async function receive(request: Request) {
    const response = await handleHttp(request, { auth: f.auth, factory: f.factory, origin: 'http://localhost:3000', secrets, allowLoopbackHttp: true });
    return { status: response.status, body: await response.json() as any };
  }
  return { ...f, secrets, receive };
}

test('Azure DevOps accepts provider GUID syntax and normalizes casing without imposing UUID version bits', async () => {
  const f = await ingestionFixture();
  try {
    const input = sourceInput('azure-devops');
    input.external = { provider: 'azure-devops', organization: 'example',
      collection: 'B1B1B1B1-CCCC-DDDD-EEEE-F2F2F2F2F2F2', project: 'D3D3D3D3-EEEE-FFFF-AAAA-B4B4B4B4B4B4', repository: 'C2C2C2C2-DDDD-EEEE-FFFF-A3A3A3A3A3A3' };
    await putSource(f.store, f.secrets, input);
    const payload = observation('azure-devops', 'A0A0A0A0-BBBB-CCCC-DDDD-E1E1E1E1E1E1') as any;
    payload.resource.repository.id = input.external.repository;
    payload.resource.repository.project.id = input.external.project;
    payload.resourceContainers.collection.id = input.external.collection;
    const result = await f.receive(delivery(input, payload)); assert.equal(result.status, 200);
    const history = (await f.request(`/api/organizations/alpha/work-items/${result.body.workItemId}/facts`)).body.items;
    const fact = history.find((entry: any) => entry.kind === 'external.observation');
    assert.equal(fact.payload.eventId, 'a0a0a0a0-bbbb-cccc-dddd-e1e1e1e1e1e1');
    assert.ok(fact.payload.locator.includes('c2c2c2c2-dddd-eeee-ffff-a3a3a3a3a3a3'));
    payload.id = payload.id.toLowerCase(); payload.resource.repository.id = payload.resource.repository.id.toLowerCase();
    assert.deepEqual((await f.receive(delivery(input, payload))).body, result.body);
  } finally { await f.close(); }
});

for (const provider of ['github', 'azure-devops'] as const) {
  test(`${provider}: distinct concurrent events share one correspondence and preserve every observation`, async () => {
    const f = await ingestionFixture();
    try {
      const input = sourceInput(provider); await putSource(f.store, f.secrets, input);
      const eventIds = ['00000000-0000-4000-8000-000000000001', '00000000-0000-4000-8000-000000000002',
        '00000000-0000-4000-8000-000000000003', '00000000-0000-4000-8000-000000000004'];
      const results = await Promise.all(eventIds.map(eventId => f.receive(delivery(input, observation(provider, eventId), eventId))));
      assert.ok(results.every(result => result.status === 200), JSON.stringify(results));
      assert.equal(new Set(results.map(result => result.body.workItemId)).size, 1);
      assert.equal(new Set(results.map(result => result.body.factId)).size, 4);
      const path = `/api/organizations/alpha/work-items/${results[0].body.workItemId}`;
      const facts = (await f.request(`${path}/facts`)).body.items;
      assert.equal(facts.length, 5);
      const actualIds = facts.filter((fact: any) => fact.kind === 'external.observation').map((fact: any) => fact.payload.eventId).sort();
      assert.deepEqual(actualIds, eventIds);
      assert.equal((await f.request(path)).body.state, 'registered');
    } finally { await f.close(); }
  });
  test(`${provider}: malformed, unsupported and tampered payloads cannot leave provider evidence`, async () => {
    const f = await ingestionFixture();
    try {
      const input = sourceInput(provider); await putSource(f.store, f.secrets, input);
      const tampered = delivery(input, observation(provider));
      const headers = new Headers(tampered.headers);
      const replacement = observation(provider) as any;
      if (provider === 'github') replacement.pull_request.title = 'Tampered';
      const altered = new Request(tampered.url, { method: 'POST', headers, body: JSON.stringify(replacement) });
      if (provider === 'github') assert.equal((await f.receive(altered)).status, 401);
      const incomplete = observation(provider) as any;
      if (provider === 'github') delete incomplete.pull_request.head; else delete incomplete.resource.lastMergeSourceCommit;
      assert.equal((await f.receive(delivery(input, incomplete))).status, 422);
      const unsupported = observation(provider) as any;
      if (provider === 'azure-devops') unsupported.eventType = 'git.push';
      const event = delivery(input, unsupported);
      if (provider === 'github') event.headers.set('x-github-event', 'issues');
      assert.equal((await f.receive(event)).status, 422);
      if (provider === 'github') {
        const ping = delivery(input, { zen: 'Signed ping' }); ping.headers.set('x-github-event', 'ping');
        assert.deepEqual((await f.receive(ping)).body, { acknowledged: true });
      }
      const invalidJson = delivery(input, observation(provider));
      invalidJson.headers.set('content-type', 'text/plain');
      assert.equal((await f.receive(invalidJson)).status, 422);
      const invalidMediaType = delivery(input, observation(provider));
      invalidMediaType.headers.set('content-type', 'application/jsonp');
      assert.equal((await f.receive(invalidMediaType)).status, 422);
      assert.equal((await f.receive(delivery(input, { message: 'x'.repeat(1048577) }))).status, 422);
      assert.deepEqual((await f.request('/api/organizations/alpha/work-items')).body.items, []);
      await assert.rejects(putSource(f.store, f.secrets, { ...input, type: 'task' }));
    } finally { await f.close(); }
  });

  test(`${provider}: ingestion preserves a seeded future Workflow ownership boundary`, async () => {
    const f = await ingestionFixture();
    try {
      const input = sourceInput(provider); await putSource(f.store, f.secrets, input);
      const created = await f.receive(delivery(input, observation(provider)));
      const itemId = created.body.workItemId;
      // Seed the not-yet-installed worker boundary; this is not a real Workflow Run drill.
      for (const executionState of ['running', 'suspended']) {
        await f.store.transaction(async tx => {
          const item = (await tx.get('work_item', itemId))!;
          await tx.put('work_item', { ...item, activeRun: { id: 'future-run', executionState } });
        });
        const eventId = executionState === 'running' ? 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb' : 'cccccccc-cccc-4ccc-8ccc-cccccccccccc';
        assert.equal((await f.receive(delivery(input, observation(provider, eventId), eventId))).status, 200);
        const item = (await f.request(`/api/organizations/alpha/work-items/${itemId}`)).body;
        assert.deepEqual(item.activeRun, { id: 'future-run', executionState });
        assert.equal(item.state, 'registered');
      }
      assert.equal((await f.request(`/api/organizations/alpha/work-items/${itemId}/facts`)).body.items.length, 4);
    } finally { await f.close(); }
  });
  test(`${provider}: concurrent deliveries across hooks preserve one resource and detect event content conflicts`, async () => {
    const f = await ingestionFixture();
    try {
      const first = sourceInput(provider); const second = sourceInput(provider, 'alpha', `${provider}-second`);
      await putSource(f.store, f.secrets, first); await putSource(f.store, f.secrets, second);
      const initial = await Promise.all(Array.from({ length: 8 }, (_, index) => f.receive(delivery(index % 2 ? first : second, observation(provider)))));
      assert.ok(initial.every(result => result.status === 200), JSON.stringify(initial));
      assert.ok(initial.every(result => result.body.factId === initial[0].body.factId && result.body.workItemId === initial[0].body.workItemId));
      const item = initial[0].body.workItemId;
      const nextId = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';
      const next = observation(provider, nextId) as any;
      if (provider === 'github') { next.action = 'closed'; next.pull_request.state = 'closed'; next.pull_request.merged = true; }
      else { next.eventType = 'git.pullrequest.updated'; next.resource.status = 'completed'; }
      const updated = await Promise.all(Array.from({ length: 6 }, () => f.receive(delivery(first, next, nextId))));
      assert.ok(updated.every(result => result.status === 200 && result.body.factId === updated[0].body.factId));
      const changed = structuredClone(next);
      if (provider === 'github') changed.pull_request.title = 'Different content'; else changed.resource.title = 'Different content';
      assert.equal((await f.receive(delivery(first, changed, nextId))).status, 409);
      const metadata = { ...next, unrelatedEnvelopeMetadata: 'Not persisted' };
      assert.deepEqual((await f.receive(delivery(second, metadata, nextId))).body, updated[0].body);
      const history = (await f.request(`/api/organizations/alpha/work-items/${item}/facts`)).body.items;
      assert.equal(history.length, 3);
      assert.equal(history.filter((fact: any) => fact.kind === 'external.observation').length, 2);
      assert.equal((await f.request(`/api/organizations/alpha/work-items/${item}`)).body.state, 'registered');
      assert.equal((await f.request('/api/organizations/alpha/work-items')).body.items.length, 1);
    } finally { await f.close(); }
  });

  test(`${provider}: independent Organizations and secondary references cannot redirect correspondence`, async () => {
    const f = await ingestionFixture();
    try {
      await f.bootstrap('beta');
      const alpha = sourceInput(provider); const beta = sourceInput(provider, 'beta');
      await putSource(f.store, f.secrets, alpha); await putSource(f.store, f.secrets, beta);
      const manual = await f.request('/api/organizations/alpha/work-items', { operationId: 'manual', project: 'alpha-project', title: 'Secondary reference', type: 'pull-request-review' });
      const locator = provider === 'github' ? 'https://github.com/example/code/pull/42' : `https://dev.azure.com/example/${beta.external.provider === 'azure-devops' ? beta.external.project : ''}/_git/${beta.external.repository}/pullrequest/42`;
      assert.equal((await f.request(`/api/organizations/alpha/work-items/${manual.body.workItem.id}/references`, { operationId: 'reference', provider, locator })).status, 200);
      const one = await f.receive(delivery(alpha, observation(provider)));
      const two = await f.receive(delivery(beta, observation(provider)));
      assert.equal(one.status, 200); assert.equal(two.status, 200);
      assert.notEqual(one.body.workItemId, two.body.workItemId); assert.notEqual(one.body.workItemId, manual.body.workItem.id);
      assert.equal((await f.request(`/api/organizations/beta/work-items/${one.body.workItemId}/facts`)).status, 404);
      assert.equal((await f.request(`/api/organizations/alpha/work-items/${manual.body.workItem.id}/facts`)).body.items.length, 2);
      assert.equal((await f.request('/api/organizations/alpha/work-items')).body.items.length, 2);
      assert.equal((await f.request('/api/organizations/beta/work-items')).body.items.length, 1);
    } finally { await f.close(); }
  });

  test(`${provider}: bound provider and Factory ownership reject mismatches and secret reuse`, async () => {
    const f = await ingestionFixture();
    try {
      await f.bootstrap('beta');
      const input = sourceInput(provider); await putSource(f.store, f.secrets, input);
      await assert.rejects(putSource(f.store, f.secrets, { ...input, source: 'bad', project: 'beta-project' }), /not found/);
      await assert.rejects(putSource(f.store, f.secrets, { ...sourceInput(provider, 'beta'), secret: input.secret }), /unique/);
      await provision(f.store, { organization: { id: 'alpha', name: 'alpha' }, projects: [{ id: 'alpha-second', name: 'Second', repositories: [{ id: 'alpha-second-repo', name: 'Second' }] }], members: [] });
      await assert.rejects(putSource(f.store, f.secrets, { ...input, repository: 'alpha-second-repo' }), /ownership/);
      await assert.rejects(putSource(f.store, f.secrets, { ...input, project: 'alpha-second', repository: 'alpha-second-repo' }), /immutable/);
      const original = await f.receive(delivery(input, observation(provider))); assert.equal(original.status, 200);
      const conflictingScope = { ...sourceInput(provider, 'alpha', 'other'), project: 'alpha-second', repository: 'alpha-second-repo' };
      await putSource(f.store, f.secrets, conflictingScope);
      assert.equal((await f.receive(delivery(conflictingScope, observation(provider)))).status, 409);
      const wrong = observation(provider) as any;
      if (provider === 'github') wrong.repository.id++; else wrong.resource.repository.id = '44444444-4444-4444-8444-444444444444';
      assert.equal((await f.receive(delivery(input, wrong))).status, 409);
      if (provider === 'github') {
        const base = observation(provider) as any; base.pull_request.base.repo.id++;
        assert.equal((await f.receive(delivery(input, base))).status, 409);
      } else {
        const project = observation(provider) as any; project.resource.repository.project.id = '44444444-4444-4444-8444-444444444444';
        assert.equal((await f.receive(delivery(input, project))).status, 409);
        const collection = observation(provider) as any; collection.resourceContainers.collection.id = '44444444-4444-4444-8444-444444444444';
        assert.equal((await f.receive(delivery(input, collection))).status, 409);
      }
      assert.equal((await f.request(`/api/organizations/alpha/work-items/${original.body.workItemId}/facts`)).body.items.length, 2);
    } finally { await f.close(); }
  });

  test(`${provider}: provider updates preserve retained state/version and admit evidence for disabled selections`, async () => {
    const f = await ingestionFixture();
    try {
      const input = sourceInput(provider); await putSource(f.store, f.secrets, input);
      assert.equal((await f.request('/api/organizations/alpha/work-item-types', { operationId: 'type-2', type: 'pull-request-review', version: 2, enabled: true })).status, 200);
      const created = await f.receive(delivery(input, observation(provider)));
      const path = `/api/organizations/alpha/work-items/${created.body.workItemId}`;
      assert.equal((await f.request(`${path}/transition-requests`, { operationId: 'prepare', transition: 'prepare-review', expectedState: 'registered', version: 2, inputs: { reviewBrief: 'Inspect provider change' } })).status, 200);
      assert.equal((await f.request('/api/organizations/alpha/work-item-types', { operationId: 'disabled', type: 'pull-request-review', version: 1, enabled: false })).status, 200);
      const nextId = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';
      const next = observation(provider, nextId) as any;
      if (provider === 'github') { next.action = 'closed'; next.pull_request.state = 'closed'; next.pull_request.title = 'New provider title'; }
      else { next.eventType = 'git.pullrequest.updated'; next.resource.status = 'abandoned'; next.resource.title = 'New provider title'; }
      assert.equal((await f.receive(delivery(input, next, nextId))).status, 200);
      const item = (await f.request(path)).body;
      assert.equal(item.state, 'ready-for-review'); assert.equal(item.version, 2);
      assert.equal(item.title, 'Review provider change'); assert.equal(item.transitionSequence, 1);
      assert.equal((await f.receive(delivery(input, observation(provider, nextId, 43), nextId))).status, 409);
      const history = (await f.request(`${path}/facts`)).body.items;
      assert.equal(history.filter((fact: any) => fact.kind === 'external.observation').length, 2);
      assert.equal(history.filter((fact: any) => fact.kind === 'state.transition').length, 1);
    } finally { await f.close(); }
  });

  test(`${provider}: interrupted observation persistence rolls back creation and receipt before retry`, async () => {
    const f = await ingestionFixture(); const database = new Surreal();
    try {
      await database.connect(f.config.url, { authentication: { username: f.config.username, password: f.config.password } });
      await database.use({ namespace: f.config.namespace, database: f.config.database });
      const input = sourceInput(provider); await putSource(f.store, f.secrets, input);
      await database.query("DEFINE EVENT interrupt_observation ON fact WHEN $event = 'CREATE' AND $after.kind = 'external.observation' THEN { THROW 'Injected persistence interruption'; };");
      assert.equal((await f.receive(delivery(input, observation(provider)))).status, 500);
      assert.deepEqual((await f.request('/api/organizations/alpha/work-items')).body.items, []);
      await database.query('REMOVE EVENT interrupt_observation ON fact;');
      const recovered = await f.receive(delivery(input, observation(provider)));
      assert.equal(recovered.status, 200);
      assert.equal((await f.request(`/api/organizations/alpha/work-items/${recovered.body.workItemId}/facts`)).body.items.length, 2);
      assert.deepEqual((await f.receive(delivery(input, observation(provider)))).body, recovered.body);
    } finally { await database.close(); await f.close(); }
  });
  test(`${provider}: source authentication is isolated, rotatable and required even with a User session`, async () => {
    const f = await ingestionFixture();
    try {
      const { putSource } = await import('../src/server/observations.ts');
      const input = sourceInput(provider);
      const installed = await putSource(f.store, f.secrets, input);
      assert.equal(JSON.stringify(installed).includes(input.secret), false);
      await f.bootstrap('beta'); const beta = sourceInput(provider, 'beta');
      await putSource(f.store, f.secrets, beta);
      const sessionRequest = delivery(input, observation(provider));
      sessionRequest.headers.delete(provider === 'github' ? 'x-hub-signature-256' : 'authorization');
      sessionRequest.headers.set('cookie', `__Host-factory_session=${f.alice.token}`);
      assert.equal((await f.receive(sessionRequest)).status, 401);
      const invalid = delivery(input, observation(provider));
      invalid.headers.delete(provider === 'github' ? 'x-hub-signature-256' : 'authorization');
      assert.equal((await f.receive(invalid)).status, 401);
      assert.equal((await f.receive(delivery({ ...beta, secret: input.secret }, observation(provider)))).status, 401);
      const foreignHttp = delivery(input, observation(provider), undefined, 'http://untrusted.example');
      assert.equal((await f.receive(foreignHttp)).status, 403);
      const rotated = { ...input, secret: randomBytes(32).toString('base64url') };
      await putSource(f.store, f.secrets, rotated);
      assert.equal((await f.receive(delivery(input, observation(provider)))).status, 401);
      assert.equal((await f.receive(delivery(rotated, observation(provider)))).status, 200);
      await putSource(f.store, f.secrets, { ...rotated, enabled: false });
      assert.equal((await f.receive(delivery(rotated, observation(provider)))).status, 404);
    } finally { await f.close(); }
  });
  test(`${provider}: authenticated public delivery creates one correspondence and immutable observation`, async () => {
    const f = await ingestionFixture();
    try {
      const { putSource } = await import('../src/server/observations.ts');
      const input = sourceInput(provider);
      await putSource(f.store, f.secrets, input);
      const result = await f.receive(delivery(input, observation(provider)));
      assert.equal(result.status, 200);
      const item = (await f.request(`/api/organizations/alpha/work-items/${result.body.workItemId}`)).body;
      assert.equal(item.state, 'registered'); assert.equal(item.title, 'Review provider change');
      assert.equal(item.project, 'alpha-project'); assert.equal(item.repository, 'alpha-repo');
      const history = (await f.request(`/api/organizations/alpha/work-items/${item.id}/facts`)).body.items;
      assert.deepEqual(history.map((fact: any) => fact.kind), ['work-item.created', 'external.observation']);
      assert.equal(history[1].id, result.body.factId);
      assert.equal(history[1].payload.provider, provider);
      assert.equal(history[1].payload.head, 'a'.repeat(40));
      assert.equal((await f.receive(delivery(input, observation(provider)))).body.factId, result.body.factId);
      assert.equal((await f.request('/api/organizations/alpha/work-items')).body.items.length, 1);
    } finally { await f.close(); }
  });
}
