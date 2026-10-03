import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs, { mkdtemp, readFile, writeFile, mkdir } from 'node:fs/promises';
import { syncBuiltinESMExports } from 'node:module';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { randomBytes } from 'node:crypto';
import { KeyRing } from '../src/server/key-ring.ts';

test('protected ring setup, rotation, restart and restore retain old keys and bind secrets to Organization and purpose', async () => {
  const directory = await mkdtemp(join(tmpdir(), 'factory-ring-'));
  const config = { directory: join(directory, 'active'), backupDirectory: join(directory, 'external-test-backup'), rootKey: randomBytes(32), installation: 'test-installation', rootVersion: 'root-1' };
  const ring = new KeyRing(config);
  await assert.rejects(ring.encrypt('alpha', 'provider', 'secret-a'), /recovery/i);
  await ring.setup();
  const old = await ring.encrypt('alpha', 'provider', 'secret-a');
  await assert.rejects(ring.decrypt('beta', 'provider', old), /recovery|decrypt/i);
  await assert.rejects(ring.decrypt('alpha', 'different', old), /recovery|decrypt/i);
  const firstBackup = await ring.export();
  await ring.rotate();
  const current = await ring.encrypt('beta', 'provider', 'secret-b');
  assert.notEqual(old.keyId, current.keyId);
  const otherProcess = new KeyRing(config);
  assert.equal(await otherProcess.decrypt('alpha', 'provider', old), 'secret-a');
  assert.equal(await otherProcess.decrypt('beta', 'provider', current), 'secret-b');
  const backup = await ring.export();
  assert.ok(!(await readFile(backup, 'utf8')).includes('secret-a'));
  const restored = new KeyRing({ ...config, directory: join(directory, 'restored') });
  await restored.restore(backup, [old.keyId, current.keyId]);
  assert.equal(await restored.decrypt('alpha', 'provider', old), 'secret-a');
  assert.equal(await restored.decrypt('beta', 'provider', current), 'secret-b');
  const older = new KeyRing({ ...config, directory: join(directory, 'older') });
  await older.restore(firstBackup, [old.keyId]);
  assert.equal(await older.decrypt('alpha', 'provider', old), 'secret-a');
  await assert.rejects(older.decrypt('beta', 'provider', current), /recovery/i);
  await assert.rejects(new KeyRing({ ...config, rootKey: randomBytes(32) }).encrypt('alpha', 'provider', 'x'), /recovery/i);
  await assert.rejects(new KeyRing({ ...config, installation: 'wrong' }).encrypt('alpha', 'provider', 'x'), /recovery/i);
  await assert.rejects(restored.restore(firstBackup, [old.keyId, current.keyId]), /recovery/i);
  const corrupt = join(directory, 'corrupt.json'); await writeFile(corrupt, '{}');
  await assert.rejects(restored.restore(corrupt, []), /recovery/i);
  const badBackup = join(directory, 'unusable'); await writeFile(badBackup, 'not a directory');
  const failed = new KeyRing({ ...config, backupDirectory: badBackup });
  await assert.rejects(failed.rotate());
  assert.equal((await ring.encrypt('beta', 'provider', 'still old')).keyId, current.keyId);
  await mkdir(config.directory, { recursive: true });
  await writeFile(join(config.directory, 'writer.lock'), 'operator must resolve');
  await assert.rejects(ring.rotate(), /writer/i);
  assert.equal(await readFile(join(config.directory, 'writer.lock'), 'utf8'), 'operator must resolve');
});

test('a failed writer close releases the lock so later key-ring operations can proceed', async context => {
  const directory = await mkdtemp(join(tmpdir(), 'factory-ring-close-'));
  const config = { directory: join(directory, 'active'), backupDirectory: join(directory, 'backup'), rootKey: randomBytes(32), installation: 'test-installation', rootVersion: 'root-1' };
  const ring = new KeyRing(config);
  await ring.setup();
  const lock = join(config.directory, 'writer.lock');
  const open = fs.open;
  context.mock.method(fs, 'open', async (...args: Parameters<typeof open>) => {
    const handle = await open(...args);
    if (args[0] === lock) {
      const close = handle.close.bind(handle);
      context.mock.method(handle, 'close', async () => { await close(); throw new Error('Injected writer close failure'); });
    }
    return handle;
  });
  syncBuiltinESMExports();
  try {
    await assert.rejects(ring.rotate(), /Injected writer close failure/);
    await assert.rejects(readFile(lock), { code: 'ENOENT' });
  } finally { context.mock.restoreAll(); syncBuiltinESMExports(); }
  await ring.rotate();
});
