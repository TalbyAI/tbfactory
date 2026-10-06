import { createHash, randomUUID } from 'node:crypto';
import { copyFile, lstat, mkdir, readFile, readdir, rename, rm, writeFile } from 'node:fs/promises';
import { basename, dirname, isAbsolute, join, relative, resolve, sep } from 'node:path';
import { z } from 'zod';
import { Surreal } from 'surrealdb';
import { configuredRing, databaseConfig } from './config';
import { OrganizationSecrets } from './secrets';
import { connectStore, type Row, type Store, type Table } from './store';
import { stable } from './contracts';
import { ReviewArtifacts } from './review-artifacts';
import { ReviewWorker } from './review-worker';
import { limitsSchema } from './review-configuration';
import { readRestoreHold, writeRestoreHold, type RestoreHold } from './restore-hold';

const manifestSchema = z.strictObject({
  format: z.literal(1),
  installation: z.string().min(1),
  applicationRevision: z.string().min(1),
  surrealVersion: z.string().min(1),
  sourceNamespace: z.string().regex(/^[A-Za-z0-9_]+$/),
  sourceDatabase: z.string().regex(/^[A-Za-z0-9_]+$/),
  factoryDigest: z.string().regex(/^[a-f0-9]{64}$/),
  recoveryPointAt: z.number().int().nonnegative(),
  capturedAt: z.number().int().nonnegative(),
  keyRing: z.strictObject({
    installation: z.string().min(1),
    rootVersion: z.string().min(1),
    generation: z.number().int().positive(),
    keyIds: z.array(z.uuid()).min(1),
  }),
  files: z
    .array(
      z.strictObject({
        path: z.string().min(1),
        bytes: z.number().int().nonnegative(),
        sha256: z.string().regex(/^[a-f0-9]{64}$/),
      }),
    )
    .min(1),
});
export type RecoveryManifest = z.infer<typeof manifestSchema>;

const apiBase = (databaseUrl: string, endpoint: string) => {
  const url = new URL(databaseUrl);
  if (url.protocol === 'ws:') url.protocol = 'http:';
  else if (url.protocol === 'wss:') url.protocol = 'https:';
  if (!['http:', 'https:'].includes(url.protocol))
    throw new Error('Recovery database URL must use HTTP or WebSocket transport');
  url.pathname = `/${endpoint}`;
  url.search = '';
  url.hash = '';
  return url;
};

function databaseHeaders(username: string, password: string, namespace: string, database: string) {
  return {
    authorization: `Basic ${Buffer.from(`${username}:${password}`).toString('base64')}`,
    'surreal-ns': namespace,
    'surreal-db': database,
    accept: 'application/json',
  };
}

function safeName(value: string) {
  if (!/^[A-Za-z0-9_]+$/.test(value)) throw new Error('Unsafe installation database identifier');
  return value;
}

export async function waitForSurreal(url: string, timeoutMs = 30_000) {
  const endpoint = apiBase(url, 'ready');
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    try {
      const response = await fetch(endpoint, { signal: AbortSignal.timeout(2_000) });
      if (response.status === 200) return;
    } catch {
      // Readiness is retried until the bounded startup window ends.
    }
    await new Promise((resolve) => setTimeout(resolve, 250));
  }
  throw new Error('SurrealDB did not become ready');
}

export async function surrealVersion(url: string) {
  const response = await fetch(apiBase(url, 'version'), { signal: AbortSignal.timeout(5_000) });
  if (!response.ok) throw new Error('Unable to read the SurrealDB version');
  const version = (await response.text()).trim();
  if (!/^surrealdb-3\.3\./i.test(version))
    throw new Error('Installation requires the validated SurrealDB 3.3 HTTP export provider');
  return version;
}

export async function exportSurreal(config = databaseConfig(), timeoutMs = 120_000) {
  await waitForSurreal(config.url);
  await surrealVersion(config.url);
  const response = await fetch(apiBase(config.url, 'export'), {
    method: 'POST',
    headers: {
      ...databaseHeaders(config.username, config.password, config.namespace, config.database),
      'content-type': 'application/json',
    },
    body: JSON.stringify({
      users: false,
      accesses: false,
      params: true,
      functions: true,
      analyzers: true,
      versions: true,
      records: true,
    }),
    signal: AbortSignal.timeout(timeoutMs),
  });
  if (!response.ok) throw new Error('SurrealDB logical export failed');
  const bytes = Buffer.from(await response.arrayBuffer());
  if (!bytes.length) throw new Error('SurrealDB logical export was empty');
  return bytes;
}

function rewriteExportNamespace(sql: Buffer, namespace: string, database: string) {
  const content = sql.toString('utf8');
  const ns = content.replace(/^\s*USE\s+NS\s+[^;\r\n]+\s*;/gim, `USE NS ${namespace};`);
  const rewritten = ns.replace(/^\s*USE\s+DB\s+[^;\r\n]+\s*;/gim, `USE DB ${database};`);
  if (!rewritten.trim()) throw new Error('Recovery export is empty');
  return Buffer.from(rewritten, 'utf8');
}

async function queryRoot(url: string, username: string, password: string, query: string) {
  const db = new Surreal();
  try {
    await db.connect(url, { authentication: { username, password } });
    return await db.query(query);
  } catch {
    throw new Error('SurrealDB recovery administration request failed');
  } finally {
    await db.close().catch(() => {});
  }
}

export async function createFreshNamespace(config = databaseConfig()) {
  const [root] = (await queryRoot(config.url, config.username, config.password, 'INFO FOR ROOT')) as
    | [{ namespaces?: Record<string, string> }]
    | [];
  const namespace = safeName(config.namespace);
  const database = safeName(config.database);
  if (root?.namespaces?.[namespace])
    throw new Error('Restore target namespace already exists; choose a fresh isolated namespace');
  await queryRoot(config.url, config.username, config.password, `DEFINE NAMESPACE ${namespace}`);
  await queryRoot(
    config.url,
    config.username,
    config.password,
    `USE NS ${namespace}; DEFINE DATABASE ${database}`,
  );
}

export async function removeFreshNamespace(config = databaseConfig()) {
  if (!/^[A-Za-z0-9_]+$/.test(config.namespace))
    throw new Error('Unsafe isolated restore namespace');
  await queryRoot(
    config.url,
    config.username,
    config.password,
    `REMOVE NAMESPACE ${config.namespace}`,
  );
}

export async function importSurreal(sql: Buffer, config = databaseConfig(), timeoutMs = 120_000) {
  const response = await fetch(apiBase(config.url, 'import'), {
    method: 'POST',
    headers: {
      ...databaseHeaders(config.username, config.password, config.namespace, config.database),
      'content-type': 'application/octet-stream',
    },
    body: rewriteExportNamespace(sql, config.namespace, config.database),
    signal: AbortSignal.timeout(timeoutMs),
  });
  const body = await response.text();
  if (!response.ok) throw new Error('SurrealDB logical import failed; discard the isolated target');
  if (body.trim()) {
    let result: any;
    try {
      result = JSON.parse(body);
    } catch {
      throw new Error(
        'SurrealDB logical import returned an invalid response; discard the isolated target',
      );
    }
    const statements = Array.isArray(result)
      ? result
      : Array.isArray(result?.result)
        ? result.result
        : [];
    const failed = statements.findIndex((statement: any) => statement?.status === 'ERR');
    if (failed >= 0 || result?.error) {
      const kind =
        failed >= 0 &&
        typeof statements[failed]?.kind === 'string' &&
        /^[A-Za-z]+$/.test(statements[failed].kind)
          ? ` (${statements[failed].kind})`
          : '';
      throw new Error(
        `SurrealDB logical import reported statement errors${failed >= 0 ? ` at statement ${failed + 1}${kind}` : ''}; discard the isolated target`,
      );
    }
  }
}

function sha256(value: Buffer) {
  return createHash('sha256').update(value).digest('hex');
}

function normalizeRelative(path: string) {
  const normalized = path.replaceAll('\\', '/');
  if (
    normalized.startsWith('/') ||
    normalized.split('/').some((part) => !part || part === '.' || part === '..')
  )
    throw new Error('Recovery manifest contains an unsafe path');
  return normalized;
}

async function treeFiles(root: string, prefix: string, include: (relative: string) => boolean) {
  const rootInfo = await lstat(root);
  if (!rootInfo.isDirectory() || rootInfo.isSymbolicLink())
    throw new Error('Recovery input directory is missing or not a regular directory');
  const result: Array<{ source: string; path: string }> = [];
  const walk = async (directory: string) => {
    for (const entry of await readdir(directory, { withFileTypes: true })) {
      const source = join(directory, entry.name);
      const info = await lstat(source);
      const rel = normalizeRelative(relative(root, source));
      if (info.isSymbolicLink()) throw new Error('Recovery input contains a symbolic link');
      if (info.isDirectory()) await walk(source);
      else if (info.isFile() && include(rel))
        result.push({ source, path: prefix ? `${prefix}/${rel}` : rel });
      else if (!info.isFile() && !info.isDirectory())
        throw new Error('Recovery input contains an unsupported filesystem entry');
    }
  };
  await walk(root);
  return result;
}

async function copyInto(source: string, target: string) {
  await mkdir(dirname(target), { recursive: true, mode: 0o700 });
  await copyFile(source, target);
}

async function captureFileEntries(root: string) {
  const paths = await treeFiles(root, '', (rel) => rel !== 'manifest.json');
  const entries: RecoveryManifest['files'] = [];
  for (const item of paths) {
    const data = await readFile(item.source);
    entries.push({ path: item.path, bytes: data.length, sha256: sha256(data) });
  }
  return entries;
}

function within(path: string, directory: string) {
  const rel = relative(resolve(directory), resolve(path));
  return rel === '' || (!rel.startsWith(`..${sep}`) && rel !== '..' && !isAbsolute(rel));
}

export function assertRecoveryPath(recovery: string, activePaths: string[]) {
  if (!isAbsolute(recovery)) throw new Error('Recovery directory must be absolute');
  for (const active of activePaths) {
    if (
      !isAbsolute(active) ||
      resolve(recovery) === resolve(active) ||
      within(recovery, active) ||
      within(active, recovery)
    )
      throw new Error('Recovery directory must be outside every active installation path');
  }
}

export async function createBundle(options: {
  recoveryDirectory: string;
  workerDirectory: string;
  artifactDirectory: string;
  databaseUrl?: string;
  databaseNamespace?: string;
  databaseName?: string;
  timeoutMs?: number;
}) {
  const config = databaseConfig();
  const workerDirectory = resolve(options.workerDirectory);
  const artifactDirectory = resolve(options.artifactDirectory);
  const recoveryDirectory = resolve(options.recoveryDirectory);
  assertRecoveryPath(recoveryDirectory, [
    resolve(options.workerDirectory),
    resolve(options.artifactDirectory),
    resolve(process.env.FACTORY_RING_DIRECTORY ?? ''),
    resolve(process.env.FACTORY_RING_BACKUP_DIRECTORY ?? ''),
  ]);
  safeName(config.namespace);
  safeName(config.database);
  const lock = join(workerDirectory, 'worker.lock');
  try {
    await lstat(lock);
    throw new Error('Worker lock is present; backup requires a clean worker stop');
  } catch (error: any) {
    if (error.code !== 'ENOENT') throw error;
  }
  const store = await connectStore(config);
  let ringExport: string;
  let ringMetadata: {
    installation: string;
    rootVersion: string;
    generation: number;
    keyIds: string[];
  };
  let factoryDigest: string;
  try {
    if ((await store.transaction((tx) => tx.list('worker_owner'))).length)
      throw new Error('Worker owner is present; backup requires a clean worker stop');
    factoryDigest = await digestFactoryDatabase(store);
    const secrets = new OrganizationSecrets(store, await configuredRing());
    ringMetadata = await secrets.verify();
    ringExport = await (await configuredRing()).export();
  } finally {
    await store.close();
  }
  const recoveryPointAt = Date.now();
  const surreal = await exportSurreal(config, options.timeoutMs);
  const version = await surrealVersion(config.url);
  const ringBytes = await readFile(ringExport!);
  await readRestoreHold(workerDirectory);
  const runFiles = await treeFiles(
    workerDirectory,
    'worker',
    (path) => /^workflows\.db(?:[-.].*)?$/.test(path) || path === 'restore-hold.json',
  );
  if (!runFiles.some((file) => file.path === 'worker/workflows.db'))
    throw new Error('Persistent LibSQL workflow database is missing');
  const artifactFiles = await treeFiles(artifactDirectory, 'artifacts', () => true);
  if (within(ringExport!, recoveryDirectory) || within(recoveryDirectory, ringExport!))
    throw new Error('Recovery output path overlaps protected key-ring backup storage');

  await mkdir(recoveryDirectory, { recursive: true, mode: 0o700 });
  const id = randomUUID();
  const capturedAt = Date.now();
  const stage = join(recoveryDirectory, `.stage-${id}`);
  const completed = join(recoveryDirectory, `recovery-${capturedAt}-${id}`);
  await mkdir(stage, { recursive: false, mode: 0o700 });
  try {
    const databaseFile = join(stage, 'factory', 'export.surql');
    await mkdir(dirname(databaseFile), { recursive: true, mode: 0o700 });
    await writeFile(databaseFile, surreal, { flag: 'wx', mode: 0o600 });
    const ringFile = join(stage, 'key-ring', 'ring.json');
    await mkdir(dirname(ringFile), { recursive: true, mode: 0o700 });
    await writeFile(ringFile, ringBytes, { flag: 'wx', mode: 0o600 });
    for (const file of [...runFiles, ...artifactFiles])
      await copyInto(file.source, join(stage, file.path));
    const files = await captureFileEntries(stage);
    const manifest: RecoveryManifest = {
      format: 1,
      installation: process.env.FACTORY_INSTALLATION ?? 'unconfigured',
      applicationRevision: process.env.FACTORY_RELEASE ?? 'local',
      surrealVersion: version,
      sourceNamespace: config.namespace,
      sourceDatabase: config.database,
      factoryDigest: factoryDigest!,
      recoveryPointAt,
      capturedAt,
      keyRing: {
        installation: ringMetadata!.installation,
        rootVersion: ringMetadata!.rootVersion,
        generation: ringMetadata!.generation,
        keyIds: ringMetadata!.keyIds,
      },
      files,
    };
    const serialized = JSON.stringify(manifest, null, 2);
    manifestSchema.parse(JSON.parse(serialized));
    await writeFile(join(stage, 'manifest.json'), serialized, { flag: 'wx', mode: 0o600 });
    await rename(stage, completed);
    return { directory: completed, manifest };
  } catch (error) {
    await rm(stage, { recursive: true, force: true });
    throw error;
  }
}

export async function verifyBundle(directory: string) {
  const root = resolve(directory);
  const info = await lstat(root).catch(() => undefined);
  if (!info?.isDirectory() || info.isSymbolicLink()) throw new Error('Recovery bundle is missing');
  const manifest = manifestSchema.parse(
    JSON.parse(await readFile(join(root, 'manifest.json'), 'utf8')),
  );
  const listed = new Set<string>();
  for (const entry of manifest.files) {
    const path = normalizeRelative(entry.path);
    if (listed.has(path)) throw new Error('Recovery manifest contains duplicate files');
    listed.add(path);
    const target = join(root, ...path.split('/'));
    const fileInfo = await lstat(target).catch(() => undefined);
    if (!fileInfo?.isFile() || fileInfo.isSymbolicLink())
      throw new Error('Recovery bundle is missing a required regular file');
    const bytes = await readFile(target);
    if (bytes.length !== entry.bytes || sha256(bytes) !== entry.sha256)
      throw new Error('Recovery bundle integrity verification failed');
  }
  const actual = await treeFiles(root, '', (path) => path !== 'manifest.json');
  if (actual.length !== listed.size || actual.some((file) => !listed.has(file.path)))
    throw new Error('Recovery bundle contains unmanifested files');
  const ring = JSON.parse(await readFile(join(root, 'key-ring', 'ring.json'), 'utf8'));
  if (
    ring.metadata?.installation !== manifest.keyRing.installation ||
    ring.metadata?.rootVersion !== manifest.keyRing.rootVersion ||
    ring.metadata?.generation !== manifest.keyRing.generation ||
    JSON.stringify(ring.metadata?.keyIds) !== JSON.stringify(manifest.keyRing.keyIds)
  )
    throw new Error('Recovery key-ring manifest does not match its authenticated envelope');
  if (
    !listed.has('factory/export.surql') ||
    !listed.has('worker/workflows.db') ||
    !listed.has('key-ring/ring.json')
  )
    throw new Error('Recovery bundle omits required persistent data');
  if (listed.has('worker/restore-hold.json')) await readRestoreHold(join(root, 'worker'));
  return { root, manifest };
}

const terminalRunStatuses = new Set([
  'completed',
  'superseded',
  'stopped',
  'cancelled',
  'rejected',
]);

const factoryTables: Table[] = [
  'organization',
  'project',
  'repository',
  'user',
  'membership',
  'policy',
  'session',
  'login',
  'work_item',
  'fact',
  'receipt',
  'invitation',
  'credential',
  'audit',
  'secret',
  'type_selection',
  'transition_request',
  'team',
  'provider_source',
  'correspondence',
  'observation_delivery',
  'workflow_run',
  'review_report',
  'review_config',
  'repository_access',
  'agent_call',
  'notification',
  'worker_owner',
  'ai_resource',
  'publication_config',
  'publication_artifact',
  'artifact_share',
  'external_activity',
];

export async function digestFactoryDatabase(store: Store) {
  const rows = await store.transaction(async (tx) => {
    const result: Array<[Table, Row[]]> = [];
    for (const table of factoryTables) {
      const values = await tx.list(table);
      values.sort((a, b) => a.id.localeCompare(b.id));
      result.push([table, values]);
    }
    return result;
  });
  return sha256(Buffer.from(stable(rows)));
}

export async function convertRestoredPublications(store: Store) {
  await store.transaction(async (tx) => {
    const activities = await tx.list('external_activity');
    for (const raw of activities) {
      const activity = raw as Row & {
        run: string;
        workItem: string;
        organization: string;
        data: Record<string, any>;
      };
      const data = activity.data;
      const shouldReconcile = [
        'queued',
        'waiting-approval',
        'dispatching',
        'uncertain',
        'failed',
        'blocked',
        'reconciliation-queued',
        'reconciling',
      ].includes(data.status);
      if (!shouldReconcile) continue;
      const run = await tx.get('workflow_run', activity.run);
      const item = await tx.get('work_item', activity.workItem);
      if (
        !run ||
        !item ||
        run.organization !== activity.organization ||
        run.workItem !== activity.workItem
      )
        throw new Error('Recovery publication ownership could not be verified');
      if (item.activeRun && (item.activeRun as any).id !== run.id)
        throw new Error('Recovery publication conflicts with current Work Item ownership');
      const { dispatchAuthorized: _dispatchAuthorized, evidence: _evidence, ...retained } = data;
      const changed = {
        ...activity,
        data: {
          ...retained,
          status: 'uncertain',
          error: 'Restored publication requires fresh provider evidence',
          recoveryActor: undefined,
        },
      };
      const runDataSource = run.data as any;
      const cancellation = runDataSource.cancellation;
      const runData = {
        ...runDataSource,
        status: 'publication-uncertain',
        publication: activity.id,
        ...(cancellation &&
        !['requested', 'awaiting-publication-resolution'].includes(cancellation.status)
          ? {
              cancellation: {
                request: cancellation.request,
                status: 'awaiting-publication-resolution',
              },
            }
          : {}),
      };
      await tx.put('external_activity', changed);
      await tx.put('workflow_run', { ...run, data: runData });
      await tx.put('work_item', {
        ...item,
        activeRun: {
          id: run.id,
          workflow: runData.workflow,
          status: 'publication-uncertain',
        },
      });
    }
  });
}

export async function buildRestoreHold(store: Store, bundle: string, createdAt = Date.now()) {
  return store.transaction(async (tx) => {
    const runs = await tx.list('workflow_run');
    const pending: RestoreHold['runs'] = {};
    for (const run of runs) {
      const status = String((run.data as any).status);
      if (terminalRunStatuses.has(status)) continue;
      pending[run.id] = {
        workflow: String((run.data as any).workflow),
        status,
        disposition: 'pending',
      };
    }
    return { format: 1, bundle, createdAt, activatedAt: null, runs: pending } as RestoreHold;
  });
}

async function verifyRestoredArtifacts(store: Store, directory: string) {
  const artifacts = new ReviewArtifacts(directory);
  const records = await store.transaction(async (tx) => ({
    reports: await tx.list('review_report'),
    publications: await tx.list('publication_artifact'),
  }));
  for (const row of [...records.reports, ...records.publications]) {
    const content = row.data as any;
    if (content?.storageKey && content?.digest && typeof content?.size === 'number')
      await artifacts.verify(content);
  }
}

export async function restoreBundle(bundleDirectory: string) {
  const { root, manifest } = await verifyBundle(bundleDirectory);
  const config = databaseConfig();
  safeName(config.namespace);
  safeName(config.database);
  const workerValue = process.env.FACTORY_WORKER_DIRECTORY;
  const artifactValue = process.env.FACTORY_ARTIFACT_DIRECTORY;
  const ringValue = process.env.FACTORY_RING_DIRECTORY;
  const ringBackupValue = process.env.FACTORY_RING_BACKUP_DIRECTORY;
  const recoveryValue = process.env.FACTORY_RECOVERY_DIRECTORY;
  if (!workerValue || !artifactValue || !ringValue || !ringBackupValue || !recoveryValue)
    throw new Error('Restore requires new worker, Artifact, ring, ring-backup, and recovery paths');
  const workerDirectory = resolve(workerValue);
  const artifactDirectory = resolve(artifactValue);
  const ringDirectory = resolve(ringValue);
  const ringBackupDirectory = resolve(ringBackupValue);
  const recoveryDirectory = resolve(recoveryValue);
  assertRecoveryPath(recoveryDirectory, [
    workerDirectory,
    artifactDirectory,
    ringDirectory,
    ringBackupDirectory,
  ]);
  const destinations = [workerDirectory, artifactDirectory, ringDirectory, ringBackupDirectory];
  for (let index = 0; index < destinations.length; index++) {
    for (const other of destinations.slice(index + 1)) {
      if (within(destinations[index], other) || within(other, destinations[index]))
        throw new Error('Restore destination paths must be separate');
    }
  }
  for (const path of destinations) {
    if (await lstat(path).catch(() => undefined))
      throw new Error('Restore destination exists; use fresh isolated paths');
  }
  await waitForSurreal(config.url);
  let createdNamespace = false;
  const createdDirectories: string[] = [];
  try {
    await createFreshNamespace(config);
    createdNamespace = true;
    await mkdir(workerDirectory, { recursive: false, mode: 0o700 });
    createdDirectories.push(workerDirectory);
    await writeRestoreHold(workerDirectory, {
      format: 1,
      bundle: basename(root),
      createdAt: Date.now(),
      activatedAt: null,
      runs: {},
    });
    for (const file of await treeFiles(
      join(root, 'worker'),
      'worker',
      (path) => path !== 'restore-hold.json',
    )) {
      const path = file.path.slice('worker/'.length);
      await copyInto(file.source, join(workerDirectory, path));
    }
    await mkdir(artifactDirectory, { recursive: false, mode: 0o700 });
    createdDirectories.push(artifactDirectory);
    for (const file of await treeFiles(join(root, 'artifacts'), 'artifacts', () => true)) {
      const path = file.path.slice('artifacts/'.length);
      await copyInto(file.source, join(artifactDirectory, path));
    }
    const exported = await readFile(join(root, 'factory', 'export.surql'));
    await importSurreal(exported, config);
    const store = await connectStore(config);
    try {
      if ((await digestFactoryDatabase(store)) !== manifest.factoryDigest)
        throw new Error('SurrealDB import does not match the recovery manifest');
      if ((await store.transaction((tx) => tx.list('worker_owner'))).length)
        throw new Error('Recovery export contains a live worker owner');
      const ring = await configuredRing();
      const secrets = new OrganizationSecrets(store, ring);
      const requiredKeys = await secrets.requiredKeys();
      await mkdir(ringDirectory, { recursive: false, mode: 0o700 });
      createdDirectories.push(ringDirectory);
      await mkdir(ringBackupDirectory, { recursive: false, mode: 0o700 });
      createdDirectories.push(ringBackupDirectory);
      await ring.restore(join(root, 'key-ring', 'ring.json'), requiredKeys);
      await secrets.verify();
      await verifyRestoredArtifacts(store, artifactDirectory);
      await convertRestoredPublications(store);
      const hold = await buildRestoreHold(store, basename(root));
      const verifier = new ReviewWorker(store, secrets, {
        directory: workerDirectory,
        artifacts: artifactDirectory,
        image: process.env.FACTORY_SANDBOX_IMAGE ?? '',
        allowedHosts: (process.env.FACTORY_APPROVED_ENDPOINT_HOSTS ?? '').split(','),
        allowLoopback: process.env.FACTORY_ALLOW_LOOPBACK_HTTP === 'true',
        concurrency: 4,
        limits: limitsSchema.parse(JSON.parse(process.env.FACTORY_WORKER_LIMITS ?? '{}')),
        restoreHold: workerDirectory,
      });
      await verifier.verifyPersistentSnapshots(
        Object.entries(hold.runs).map(([id, run]) => ({
          id,
          workflow: run.workflow,
          status: run.status,
        })),
      );
      await writeRestoreHold(workerDirectory, hold);
      return {
        installation: manifest.installation,
        recoveryPointAt: manifest.recoveryPointAt,
        runsHeld: Object.keys(hold.runs).length,
        namespace: config.namespace,
        database: config.database,
      };
    } finally {
      await store.close();
    }
  } catch (error) {
    if (createdNamespace) await removeFreshNamespace(config).catch(() => {});
    await Promise.all(createdDirectories.map((path) => rm(path, { recursive: true, force: true })));
    throw error;
  }
}

export async function activateRestoreHold(options: { workerDirectory: string; confirm: boolean }) {
  if (!options.confirm) throw new Error('Activation requires --confirm-reconciled');
  const current = await readRestoreHold(options.workerDirectory);
  if (!current) throw new Error('No restore hold is present');
  if (current.activatedAt !== null) throw new Error('Restore hold is already activated');
  const unresolved = Object.entries(current.runs).filter(
    ([, run]) => run.disposition === 'pending',
  );
  if (unresolved.length)
    throw new Error(
      `Restore has ${unresolved.length} Workflow Runs without an explicit disposition`,
    );
  if (await lstat(join(resolve(options.workerDirectory), 'worker.lock')).catch(() => undefined))
    throw new Error('Restore activation refused while a worker lock remains');
  const config = databaseConfig();
  const store = await connectStore(config);
  try {
    if ((await store.transaction((tx) => tx.list('worker_owner'))).length)
      throw new Error('Restore activation refused while a worker owner remains');
    const secrets = new OrganizationSecrets(store, await configuredRing());
    await secrets.verify();
    const artifacts = await store.transaction(async (tx) => {
      const reports = await tx.list('review_report');
      const published = await tx.list('publication_artifact');
      return [...reports, ...published];
    });
    const content = new ReviewArtifacts(process.env.FACTORY_ARTIFACT_DIRECTORY ?? '');
    for (const row of artifacts) {
      const value = row.data as any;
      if (value?.storageKey && value?.digest && typeof value?.size === 'number')
        await content.verify(value);
    }
  } finally {
    await store.close();
  }
  const updated = { ...current, activatedAt: Date.now() };
  await writeRestoreHold(options.workerDirectory, updated);
  return { activatedAt: updated.activatedAt, runs: Object.keys(updated.runs).length };
}

export async function setRestoreDisposition(
  workerDirectory: string,
  runId: string,
  disposition: 'hold' | 'resume' | 'reconcile',
) {
  const current = await readRestoreHold(workerDirectory);
  if (!current || current.activatedAt !== null)
    throw new Error('Per-run restore disposition requires an unactivated restore hold');
  const run = current.runs[runId];
  if (!run) throw new Error('Workflow Run is not in this restore hold');
  if (disposition === 'resume') {
    if (run.status.startsWith('publication-') || run.status === 'running')
      throw new Error('Publication or interrupted work requires hold or read-only reconciliation');
  }
  if (disposition === 'reconcile') {
    const store = await connectStore(databaseConfig());
    try {
      const activity = await store.transaction(async (tx) => {
        const workflowRun = await tx.get('workflow_run', runId);
        const publication = workflowRun
          ? await tx.get('external_activity', String((workflowRun.data as any).publication ?? ''))
          : undefined;
        return { workflowRun, publication };
      });
      if (
        (activity.workflowRun?.data as any)?.status !== 'publication-uncertain' ||
        (activity.publication?.data as any)?.status !== 'uncertain' ||
        (activity.publication?.data as any)?.dispatchAuthorized === false ||
        (activity.publication?.data as any)?.evidence
      )
        throw new Error(
          'Only a restored uncertain publication can be dispositioned for reconciliation',
        );
    } finally {
      await store.close();
    }
  }
  current.runs[runId] = { ...run, disposition };
  await writeRestoreHold(workerDirectory, current);
  return { run: runId, disposition };
}
