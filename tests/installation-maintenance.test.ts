import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { test } from 'node:test';

async function runWorker(env: NodeJS.ProcessEnv) {
  const child = spawn(process.execPath, ['--import', 'tsx', 'scripts/worker.ts'], {
    cwd: process.cwd(),
    env: { ...process.env, ...env },
    stdio: ['ignore', 'pipe', 'pipe'],
    windowsHide: true,
  });
  let output = '';
  child.stdout.setEncoding('utf8').on('data', (part) => (output += part));
  child.stderr.setEncoding('utf8').on('data', (part) => (output += part));
  const code = await new Promise<number | null>((resolve, reject) => {
    const timer = setTimeout(() => {
      child.kill();
      reject(new Error(`Worker maintenance check timed out: ${output}`));
    }, 5000);
    child.once('error', (error) => {
      clearTimeout(timer);
      reject(error);
    });
    child.once('exit', (exitCode) => {
      clearTimeout(timer);
      resolve(exitCode);
    });
  });
  return { code, output };
}

test('maintenance mode prevents a directly started worker from connecting or claiming ownership', async () => {
  const directory = await mkdtemp(join(tmpdir(), 'factory-worker-maintenance-'));
  try {
    const result = await runWorker({
      FACTORY_MAINTENANCE: 'true',
      FACTORY_WORKER_DIRECTORY: join(directory, 'worker'),
    });
    assert.equal(result.code, 0, result.output);
    await assert.rejects(readFile(join(directory, 'worker', 'worker.lock')));
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
});

test('an unactivated restore hold prevents a directly started worker from claiming ownership', async () => {
  const directory = await mkdtemp(join(tmpdir(), 'factory-worker-restore-hold-'));
  const workerDirectory = join(directory, 'worker');
  await mkdir(workerDirectory, { recursive: true });
  await writeFile(
    join(workerDirectory, 'restore-hold.json'),
    JSON.stringify({
      format: 1,
      bundle: 'test-bundle',
      createdAt: Date.now(),
      activatedAt: null,
      runs: {},
    }),
  );
  try {
    const result = await runWorker({ FACTORY_WORKER_DIRECTORY: workerDirectory });
    assert.equal(result.code, 0, result.output);
    await assert.rejects(readFile(join(workerDirectory, 'worker.lock')));
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
});
