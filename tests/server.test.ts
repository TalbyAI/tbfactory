import { test } from 'node:test';
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { mkdtemp, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { randomBytes } from 'node:crypto';
import { fixture } from './support/factory.ts';
import { KeyRing } from '../src/server/key-ring.ts';

test('TanStack Start serves login UI and public operations using persistent shared domain contracts', {
  timeout: 45000,
}, async () => {
  const f = await fixture();
  const directory = await mkdtemp(join(tmpdir(), 'factory-server-'));
  const rootKey = randomBytes(32);
  const rootFile = join(directory, 'root');
  await writeFile(rootFile, rootKey);
  await new KeyRing({
    directory: join(directory, 'ring'),
    backupDirectory: join(directory, 'backup'),
    rootKey,
    installation: 'server-test',
    rootVersion: 'root-1',
  }).setup();
  const server = spawn(
    process.execPath,
    ['node_modules/vite/bin/vite.js', '--host', '127.0.0.1', '--port', '18300', '--strictPort'],
    {
      windowsHide: true,
      env: {
        ...process.env,
        FACTORY_DATABASE_URL: f.config.url,
        FACTORY_DATABASE_NAMESPACE: f.config.namespace,
        FACTORY_DATABASE_NAME: f.config.database,
        FACTORY_DATABASE_USER: f.config.username,
        FACTORY_DATABASE_PASSWORD: f.config.password,
        FACTORY_ORIGIN: 'http://localhost:18300',
        FACTORY_OIDC_ISSUER: f.op.issuer,
        FACTORY_OIDC_CLIENT_ID: 'factory',
        FACTORY_OIDC_CLIENT_SECRET: 'fixture-secret',
        FACTORY_ALLOW_LOOPBACK_HTTP: 'true',
        FACTORY_TRUST_VERIFIED_EMAIL: 'true',
        FACTORY_ROOT_KEY_FILE: rootFile,
        FACTORY_ROOT_KEY_VERSION: 'root-1',
        FACTORY_INSTALLATION: 'server-test',
        FACTORY_RING_DIRECTORY: join(directory, 'ring'),
        FACTORY_RING_BACKUP_DIRECTORY: join(directory, 'backup'),
      },
    },
  );
  let output = '';
  server.stdout.on('data', (b) => {
    output += b;
  });
  server.stderr.on('data', (b) => {
    output += b;
  });
  try {
    await f.bootstrap('alpha');
    await f.bootstrap('beta', ['bob']);
    let ready = false;
    for (let i = 0; i < 150; i++) {
      try {
        if ((await fetch('http://localhost:18300/')).ok) {
          ready = true;
          break;
        }
      } catch {}
      if (server.exitCode !== null) break;
      await new Promise((r) => setTimeout(r, 100));
    }
    assert.ok(ready, output.slice(-3000));
    assert.match(await (await fetch('http://localhost:18300/')).text(), /Sign in/);
    const headers = {
      cookie: `__Host-factory_session=${f.alice.token}`,
      origin: 'http://localhost:18300',
      'content-type': 'application/json',
    };
    const created = await fetch('http://localhost:18300/api/organizations/alpha/work-items', {
      method: 'POST',
      headers,
      body: JSON.stringify({
        operationId: 'server-create',
        project: 'alpha-project',
        title: 'Created through TanStack Start',
        type: 'pull-request-review',
      }),
    });
    assert.equal(created.status, 200, await created.clone().text());
    const item = (await created.json()).workItem;
    const history = await fetch(
      `http://localhost:18300/api/organizations/alpha/work-items/${item.id}/facts`,
      { headers },
    );
    assert.equal((await history.json()).items[0].kind, 'work-item.created');
    assert.equal(
      (await fetch('http://localhost:18300/api/organizations/beta/projects', { headers })).status,
      404,
    );
    assert.equal(
      (
        await fetch('http://localhost:18300/api/organizations/alpha/work-items', {
          method: 'POST',
          headers: { ...headers, origin: 'https://foreign.test' },
          body: '{}',
        })
      ).status,
      403,
    );
  } finally {
    server.kill();
    await f.close();
  }
});
