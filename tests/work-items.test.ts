import { test } from 'node:test';
import assert from 'node:assert/strict';
import { fixture } from './support/factory.ts';
import { connectStore } from '../src/server/store.ts';
import { Factory } from '../src/server/factory.ts';
import { handleHttp } from '../src/server/http.ts';
import { Surreal } from 'surrealdb';

test('public creation is atomic, Organization scoped, repeatable, and concurrent without duplicate Facts', async () => {
  const f = await fixture();
  try {
    assert.deepEqual((await f.request('/api/organizations')).body.items, []);
    await f.bootstrap('alpha');
    await f.bootstrap('beta', ['bob']);
    const path = '/api/organizations/alpha/work-items';
    const input = {
      operationId: 'create-1',
      project: 'alpha-project',
      repository: 'alpha-repo',
      title: 'Review without source',
      type: 'pull-request-review',
    };
    const created = await f.request(path, input);
    assert.equal(created.status, 200);
    assert.equal(created.body.workItem.state, 'registered');
    assert.equal(created.body.workItem.version, 1);
    const item = created.body.workItem.id;
    assert.deepEqual((await f.request(path, input)).body, created.body);
    assert.equal((await f.request(path, { ...input, title: 'Changed' })).status, 409);
    assert.equal(
      (await f.request(path, { ...input, operationId: 'bad-project', project: 'beta-project' }))
        .status,
      404,
    );
    assert.equal(
      (await f.request('/api/organizations/beta/work-items', { ...input, operationId: 'bad-org' }))
        .status,
      404,
    );
    assert.equal(
      (await f.request(path, { ...input, operationId: 'forged', state: 'completed' })).status,
      422,
    );
    const notePath = `${path}/${item}/notes`;
    const responses = await Promise.all(
      Array.from({ length: 8 }, () =>
        f.request(notePath, { operationId: 'note-1', text: 'Human note' }),
      ),
    );
    assert.ok(responses.every((r) => r.status === 200));
    assert.ok(responses.every((r) => r.body.fact.id === responses[0].body.fact.id));
    const history = await f.request(`${path}/${item}/facts`);
    assert.equal(history.body.items.length, 2);
    assert.deepEqual(
      history.body.items.map((x: any) => x.kind),
      ['work-item.created', 'manual.note'],
    );
    assert.equal(
      (await f.request(`${path}/${item}/facts`, { kind: 'state.transition' })).status,
      404,
    );
  } finally {
    await f.close();
  }
});

test('database interruption rolls back Work Item, initial Fact and receipt before a safe public retry', async () => {
  const f = await fixture();
  const operator = new Surreal();
  try {
    await f.bootstrap('alpha');
    await operator.connect(f.config.url);
    await operator.signin({ username: f.config.username, password: f.config.password });
    await operator.use({ namespace: f.config.namespace, database: f.config.database });
    // Inject failure at the external database boundary after the Work Item write.
    await operator.query(
      `DEFINE EVENT fail_initial ON fact WHEN $event = 'CREATE' AND $after.kind = 'work-item.created' THEN { THROW 'Injected transaction interruption'; };`,
    );
    const input = {
      operationId: 'interrupted',
      project: 'alpha-project',
      title: 'Atomic interruption',
      type: 'pull-request-review',
    };
    assert.equal((await f.request('/api/organizations/alpha/work-items', input)).status, 500);
    assert.deepEqual((await f.request('/api/organizations/alpha/work-items')).body.items, []);
    await operator.query('REMOVE EVENT fail_initial ON fact;');
    const retried = await f.request('/api/organizations/alpha/work-items', input);
    assert.equal(retried.status, 200);
    assert.equal((await f.request('/api/organizations/alpha/work-items')).body.items.length, 1);
    assert.equal(
      (await f.request(`/api/organizations/alpha/work-items/${retried.body.workItem.id}/facts`))
        .body.items.length,
      1,
    );
    assert.deepEqual(
      (await f.request('/api/organizations/alpha/work-items', input)).body,
      retried.body,
    );
  } finally {
    await operator.close();
    await f.close();
  }
});

test('manual corrections and references preserve source, actor, state, pagination, and history across connections', async () => {
  const f = await fixture();
  try {
    await f.bootstrap('alpha');
    const base = '/api/organizations/alpha/work-items';
    const created = await f.request(base, {
      operationId: 'create',
      project: 'alpha-project',
      title: 'History',
      type: 'pull-request-review',
    });
    const path = `${base}/${created.body.workItem.id}`;
    const original = (
      await f.request(`${path}/notes`, { operationId: 'note', text: 'Original observation' })
    ).body.fact;
    const corrected = await f.request(`${path}/corrections`, {
      operationId: 'correct',
      fact: original.id,
      text: 'Corrected interpretation',
    });
    assert.equal(corrected.status, 200);
    assert.equal(corrected.body.fact.correctedFact, original.id);
    assert.equal(corrected.body.fact.actor, f.alice.user.id);
    assert.equal(
      (
        await f.request(`${path}/references`, {
          operationId: 'ref',
          provider: 'github',
          locator: 'https://github.com/TalbyAI/tbfactory/pull/2',
        })
      ).status,
      200,
    );
    assert.equal(
      (
        await f.request(`${path}/references`, {
          operationId: 'bad-ref',
          provider: 'github',
          locator: 'javascript:alert(1)',
        })
      ).status,
      422,
    );
    assert.equal(
      (
        await f.request(`${path}/notes`, {
          operationId: 'forge',
          text: 'Fake',
          actor: 'someone',
          kind: 'provider.observation',
        })
      ).status,
      422,
    );
    assert.equal(
      (await f.request(`${path}/facts`, {}, f.alice.token, false, 'DELETE')).status,
      404,
    );
    const firstPage = await f.request(`${path}/facts?limit=2`);
    const secondPage = await f.request(`${path}/facts?limit=2&cursor=${firstPage.body.cursor}`);
    const facts = [...firstPage.body.items, ...secondPage.body.items];
    assert.equal(facts.length, 4);
    assert.deepEqual(facts[1], original);
    assert.equal((await f.request(path)).body.state, 'registered');
    const store = await connectStore(f.config);
    try {
      const response = await handleHttp(
        new Request(`http://localhost:3000${path}/facts`, {
          headers: { cookie: `__Host-factory_session=${f.alice.token}` },
        }),
        { auth: f.auth, factory: new Factory(store), origin: 'http://localhost:3000' },
      );
      assert.deepEqual((await response.json()).items, facts);
    } finally {
      await store.close();
    }
  } finally {
    await f.close();
  }
});
