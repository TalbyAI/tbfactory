import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { randomBytes, randomUUID } from 'node:crypto';
import { KeyRing } from '../src/server/key-ring.ts';
import { OrganizationSecrets } from '../src/server/secrets.ts';
import { connectStore } from '../src/server/store.ts';
import { provision } from '../src/server/provision.ts';

test('database-managed Organization secrets survive restart and restore, and reject missing key coverage', async () => {
  const directory = await mkdtemp(join(tmpdir(), 'factory-secrets-'));
  const config = { directory: join(directory, 'active'), backupDirectory: join(directory, 'backup'), rootKey: randomBytes(32), installation: 'secret-test', rootVersion: 'root-1' };
  const database = { url: 'ws://127.0.0.1:18000/rpc', namespace: 'test', database: `secrets_${randomUUID().replaceAll('-', '')}`, username: 'root', password: 'acceptance-only' };
  let store = await connectStore(database);
  try {
    await provision(store, { organization: { id: 'alpha', name: 'Alpha' }, projects: [], members: [] });
    await provision(store, { organization: { id: 'beta', name: 'Beta' }, projects: [], members: [] });
    const ring = new KeyRing(config); await ring.setup();
    const secrets = new OrganizationSecrets(store, ring);
    await secrets.put('alpha', 'provider', 'first-provider-secret');
    const olderBackup = await ring.export();
    await ring.rotate();
    await secrets.put('beta', 'provider', 'second-provider-secret');
    const backup = await ring.export();
    await store.close(); store = await connectStore(database);
    const restored = new KeyRing({ ...config, directory: join(directory, 'restored') });
    const restoredSecrets = new OrganizationSecrets(store, restored);
    await assert.rejects(restoredSecrets.verify(), /recovery/i);
    await assert.rejects(restored.restore(olderBackup, await restoredSecrets.requiredKeys()), /recovery/i);
    await restored.restore(backup, await restoredSecrets.requiredKeys());
    assert.equal((await restoredSecrets.verify()).secrets, 2);
    assert.equal(await restoredSecrets.read('alpha', 'provider'), 'first-provider-secret');
    assert.equal(await restoredSecrets.read('beta', 'provider'), 'second-provider-secret');
    await assert.rejects(restoredSecrets.read('beta', 'different'), /not found/i);
    await assert.rejects(restored.setup(await restoredSecrets.requiredKeys()), /recovery/i);
  } finally { await store.close(); }
});
