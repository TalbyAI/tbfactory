import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { test } from 'node:test';
import {
  configuredTestDatabaseContainer,
  restartTestDatabase,
} from './support/database-restart.ts';

const databaseUrl = process.env.FACTORY_TEST_DATABASE_URL ?? 'ws://127.0.0.1:18000/rpc';

function startedAt() {
  return execFileSync(
    'docker',
    ['inspect', '--format', '{{.State.StartedAt}}', configuredTestDatabaseContainer],
    { encoding: 'utf8', windowsHide: true },
  ).trim();
}

test('database restart rejects endpoint mismatches before mutation and waits for readiness', async () => {
  const targetStartedAt = startedAt();
  const mismatchedUrl = new URL(databaseUrl);
  mismatchedUrl.port = String(Number(mismatchedUrl.port) + 1);

  await assert.rejects(restartTestDatabase(mismatchedUrl.toString()), /does not publish/);
  assert.equal(startedAt(), targetStartedAt);

  await restartTestDatabase(databaseUrl);
  assert.notEqual(startedAt(), targetStartedAt);

  const endpoint = new URL(databaseUrl);
  const readyUrl = `${endpoint.protocol === 'wss:' ? 'https:' : 'http:'}//${endpoint.host}/ready`;
  const response = await fetch(readyUrl);
  assert.equal(response.status, 200);
});
