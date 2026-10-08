import assert from 'node:assert/strict';
import { randomBytes, randomUUID } from 'node:crypto';
import { execFile } from 'node:child_process';
import { lstat, mkdir, readFile, readdir, rm, writeFile } from 'node:fs/promises';
import { resolve, join } from 'node:path';
import { test } from 'node:test';
import { promisify } from 'node:util';
import { KeyRing } from '../src/server/key-ring';
import {
  createBundle,
  createFreshNamespace,
  removeFreshNamespace,
} from '../src/server/installation-recovery';

const runFile = promisify(execFile);

test('a new installation with empty Artifact and workflow stores can be backed up and restored', async () => {
  const id = randomUUID().replaceAll('-', '');
  const directory = resolve('.runtime', `installation-empty-${id}`);
  const namespace = `recovery_${id}`;
  const targetNamespace = `restored_${id}`;
  const databaseUrl = process.env.FACTORY_TEST_DATABASE_URL ?? 'ws://127.0.0.1:18000/rpc';
  const sourceConfig = {
    url: databaseUrl,
    namespace,
    database: `factory_${id}`,
    username: 'root',
    password: 'acceptance-only',
  };
  const targetConfig = {
    ...sourceConfig,
    namespace: targetNamespace,
    database: `restored_${id}`,
  };
  const source = join(directory, 'source');
  const workerDirectory = join(source, 'worker');
  const artifactDirectory = join(source, 'artifacts');
  const ringDirectory = join(source, 'ring');
  const ringBackupDirectory = join(source, 'ring-backups');
  const recoveryDirectory = join(directory, 'recovery');
  const target = join(directory, 'target');
  const targetWorkerDirectory = join(target, 'worker');
  const targetArtifactDirectory = join(target, 'artifacts');
  const targetRingDirectory = join(target, 'ring');
  const targetRingBackupDirectory = join(target, 'ring-backups');
  const rootKeyFile = join(directory, 'root.key');
  const installation = `empty-${id}`;
  const environment = {
    FACTORY_DATABASE_URL: process.env.FACTORY_DATABASE_URL,
    FACTORY_DATABASE_NAMESPACE: process.env.FACTORY_DATABASE_NAMESPACE,
    FACTORY_DATABASE_NAME: process.env.FACTORY_DATABASE_NAME,
    FACTORY_DATABASE_USER: process.env.FACTORY_DATABASE_USER,
    FACTORY_DATABASE_PASSWORD: process.env.FACTORY_DATABASE_PASSWORD,
    FACTORY_ROOT_KEY_FILE: process.env.FACTORY_ROOT_KEY_FILE,
    FACTORY_ROOT_KEY_VERSION: process.env.FACTORY_ROOT_KEY_VERSION,
    FACTORY_INSTALLATION: process.env.FACTORY_INSTALLATION,
    FACTORY_RING_DIRECTORY: process.env.FACTORY_RING_DIRECTORY,
    FACTORY_RING_BACKUP_DIRECTORY: process.env.FACTORY_RING_BACKUP_DIRECTORY,
    FACTORY_WORKER_DIRECTORY: process.env.FACTORY_WORKER_DIRECTORY,
    FACTORY_ARTIFACT_DIRECTORY: process.env.FACTORY_ARTIFACT_DIRECTORY,
    FACTORY_RECOVERY_DIRECTORY: process.env.FACTORY_RECOVERY_DIRECTORY,
    FACTORY_SANDBOX_IMAGE: process.env.FACTORY_SANDBOX_IMAGE,
    FACTORY_APPROVED_ENDPOINT_HOSTS: process.env.FACTORY_APPROVED_ENDPOINT_HOSTS,
    FACTORY_ALLOW_LOOPBACK_HTTP: process.env.FACTORY_ALLOW_LOOPBACK_HTTP,
    FACTORY_WORKER_LIMITS: process.env.FACTORY_WORKER_LIMITS,
  };
  let sourceNamespaceCreated = false;
  let targetNamespaceCreated = false;

  try {
    await createFreshNamespace(sourceConfig);
    sourceNamespaceCreated = true;
    await mkdir(workerDirectory, { recursive: true, mode: 0o700 });
    await mkdir(artifactDirectory, { recursive: true, mode: 0o700 });
    await writeFile(join(workerDirectory, 'workflows.db'), Buffer.alloc(0), { flag: 'wx' });
    const rootKey = randomBytes(32);
    await writeFile(rootKeyFile, rootKey, { flag: 'wx', mode: 0o600 });
    const ring = new KeyRing({
      directory: ringDirectory,
      backupDirectory: ringBackupDirectory,
      rootKey,
      rootVersion: 'root-1',
      installation,
    });
    await ring.setup();

    Object.assign(process.env, {
      FACTORY_DATABASE_URL: sourceConfig.url,
      FACTORY_DATABASE_NAMESPACE: sourceConfig.namespace,
      FACTORY_DATABASE_NAME: sourceConfig.database,
      FACTORY_DATABASE_USER: sourceConfig.username,
      FACTORY_DATABASE_PASSWORD: sourceConfig.password,
      FACTORY_ROOT_KEY_FILE: rootKeyFile,
      FACTORY_ROOT_KEY_VERSION: 'root-1',
      FACTORY_INSTALLATION: installation,
      FACTORY_RING_DIRECTORY: ringDirectory,
      FACTORY_RING_BACKUP_DIRECTORY: ringBackupDirectory,
      FACTORY_WORKER_DIRECTORY: workerDirectory,
      FACTORY_ARTIFACT_DIRECTORY: artifactDirectory,
      FACTORY_RECOVERY_DIRECTORY: recoveryDirectory,
      FACTORY_SANDBOX_IMAGE: '',
      FACTORY_APPROVED_ENDPOINT_HOSTS: '',
      FACTORY_ALLOW_LOOPBACK_HTTP: 'false',
      FACTORY_WORKER_LIMITS: '{}',
    });

    const backup = await createBundle({
      recoveryDirectory,
      workerDirectory,
      artifactDirectory,
    });
    const workflowSnapshot = backup.manifest.files.find(
      (file) => file.path === 'worker/workflows.db',
    );
    assert.equal(workflowSnapshot?.bytes, 0, 'the empty workflow store is retained');

    await mkdir(target, { recursive: true, mode: 0o700 });
    Object.assign(process.env, {
      FACTORY_DATABASE_NAMESPACE: targetConfig.namespace,
      FACTORY_DATABASE_NAME: targetConfig.database,
      FACTORY_WORKER_DIRECTORY: targetWorkerDirectory,
      FACTORY_ARTIFACT_DIRECTORY: targetArtifactDirectory,
      FACTORY_RING_DIRECTORY: targetRingDirectory,
      FACTORY_RING_BACKUP_DIRECTORY: targetRingBackupDirectory,
    });
    const { stdout } = await runFile(
      process.execPath,
      ['--import', 'tsx', 'scripts/installation.ts', 'restore', backup.directory],
      {
        env: { ...process.env, FACTORY_MAINTENANCE: 'true' },
        windowsHide: true,
        timeout: 120_000,
      },
    );
    const restored = JSON.parse(stdout);
    targetNamespaceCreated = true;

    assert.equal(restored.namespace, targetNamespace);
    assert.ok((await lstat(join(backup.directory, 'artifacts'))).isDirectory());
    assert.deepEqual(await readdir(targetArtifactDirectory), []);
    assert.ok((await lstat(join(targetWorkerDirectory, 'workflows.db'))).isFile());
    assert.equal((await readFile(rootKeyFile)).length, 32);
  } finally {
    for (const [name, value] of Object.entries(environment)) {
      if (value === undefined) delete process.env[name];
      else process.env[name] = value;
    }
    if (targetNamespaceCreated) await removeFreshNamespace(targetConfig).catch(() => {});
    if (sourceNamespaceCreated) await removeFreshNamespace(sourceConfig).catch(() => {});
    await rm(directory, { recursive: true, force: true });
  }
});
