import { test } from 'node:test';
import assert from 'node:assert/strict';
import { connectStore } from '../src/server/store.ts';
import { provision } from '../src/server/provision.ts';

test('operator provisioning is idempotent and binds Repository ownership to its Project', async () => {
  const store = await connectStore({
    url: 'ws://127.0.0.1:18000/rpc',
    namespace: 'test',
    database: 'provision',
    username: 'root',
    password: 'acceptance-only',
  });
  try {
    const input = {
      organization: { id: 'alpha', name: 'Alpha' },
      projects: [
        { id: 'project-a', name: 'A', repositories: [{ id: 'repo-a', name: 'A repository' }] },
      ],
      members: [],
    };
    assert.deepEqual(await provision(store, input), await provision(store, input));
    await assert.rejects(
      provision(store, { ...input, organization: { id: 'beta', name: 'Beta' } }),
      /ownership/i,
    );
  } finally {
    await store.close();
  }
});
