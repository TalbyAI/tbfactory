import { createHash, randomUUID } from 'node:crypto';
import { execFile, fork, type ChildProcess } from 'node:child_process';
import { createConnection, createServer, type Server, type Socket } from 'node:net';
import { lstat, mkdir, readFile, readdir, rm } from 'node:fs/promises';
import { dirname, join, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { promisify } from 'node:util';
import { atomicWrite } from '../src/server/durable-files';
import { recoverStaleControlSocket } from './installation-control-socket';
import { configuredRing, databaseConfig } from '../src/server/config';
import { OrganizationSecrets } from '../src/server/secrets';
import { connectStore } from '../src/server/store';
import {
  activateRestoreHold,
  createBundle,
  restoreBundle,
  setRestoreDisposition,
  surrealVersion,
  waitForSurreal,
  verifyBundle,
  removeFreshNamespace,
} from '../src/server/installation-recovery';
import { readRestoreHold } from '../src/server/restore-hold';

const runFile = promisify(execFile);

type Child = ChildProcess & {
  forcedShutdown?: boolean;
  storeClosed?: boolean;
  diagnosticTail?: string;
};
type StoredStatus = {
  backup?: {
    state: 'running' | 'succeeded' | 'failed';
    startedAt: number;
    completedAt?: number;
    bundle?: string;
    recoveryPointAt?: number;
    error?: string;
    lastSuccessful?: {
      completedAt: number;
      recoveryPointAt?: number;
      bundle?: string;
    };
  };
  drill?: {
    state: 'running' | 'succeeded' | 'failed';
    startedAt: number;
    completedAt?: number;
    bundle?: string;
    recoveryPointAt?: number;
    durationMs?: number;
    error?: string;
  };
  service?: { state: string; pid?: number; updatedAt: number };
};

const required = (name: string) => {
  const value = process.env[name];
  if (!value) throw new Error(`Missing deployment setting: ${name}`);
  return value;
};

function recoveryDirectory() {
  return resolve(required('FACTORY_RECOVERY_DIRECTORY'));
}

function statusPath() {
  return join(recoveryDirectory(), 'installation-status.json');
}

function controlAddress() {
  const installation = process.env.FACTORY_INSTALLATION ?? 'factory';
  if (process.platform === 'win32')
    return `\\\\.\\pipe\\tbfactory-${createHash('sha256').update(installation).digest('hex').slice(0, 24)}`;
  return join(recoveryDirectory(), '.installation.sock');
}

async function readStatus(): Promise<StoredStatus> {
  try {
    return JSON.parse(await readFile(statusPath(), 'utf8'));
  } catch (error: any) {
    if (error.code === 'ENOENT') return {};
    throw new Error('Installation status file is invalid');
  }
}

function backupAndDrillHealth(status: StoredStatus, now: number) {
  const lastSuccessfulBackup =
    status.backup?.state === 'succeeded'
      ? {
          recoveryPointAt:
            status.backup.recoveryPointAt ?? status.backup.lastSuccessful?.recoveryPointAt,
          completedAt: status.backup.completedAt ?? status.backup.lastSuccessful?.completedAt,
        }
      : status.backup?.lastSuccessful;
  const lastBackup = lastSuccessfulBackup?.recoveryPointAt ?? lastSuccessfulBackup?.completedAt;
  const lastDrill = status.drill?.state === 'succeeded' ? status.drill.completedAt : undefined;
  return {
    backup: {
      ...status.backup,
      overdue: !lastBackup || now - lastBackup > 24 * 60 * 60 * 1000,
    },
    drill: {
      ...status.drill,
      overdue: !lastDrill || now - lastDrill > 31 * 24 * 60 * 60 * 1000,
    },
  };
}

async function writeStatus(status: StoredStatus) {
  await mkdir(recoveryDirectory(), { recursive: true, mode: 0o700 });
  await atomicWrite(statusPath(), JSON.stringify(status, null, 2));
}

async function checkRingAndDatabase() {
  const config = databaseConfig();
  await waitForSurreal(config.url);
  await surrealVersion(config.url);
  const store = await connectStore(config);
  try {
    await new OrganizationSecrets(store, await configuredRing()).verify();
  } finally {
    await store.close();
  }
}

function applicationAddress() {
  const origin = new URL(required('FACTORY_ORIGIN'));
  const port = Number(process.env.FACTORY_PORT ?? (origin.port || '3000'));
  if (!Number.isInteger(port) || port < 1 || port > 65535)
    throw new Error('FACTORY_ORIGIN has an invalid port');
  return { origin: origin.origin, port, localOrigin: `http://127.0.0.1:${port}` };
}

async function waitWebReady(child: Child, origin: string, timeoutMs = 30_000, maintenance = false) {
  const deadline = Date.now() + timeoutMs;
  let lastStatus: number | undefined;
  while (Date.now() < deadline && child.exitCode === null && child.signalCode === null) {
    try {
      const response = await fetch(`${origin}/api/organizations`, {
        signal: AbortSignal.timeout(2_000),
      });
      lastStatus = response.status;
      if (maintenance ? response.status === 503 : response.status < 500) return;
    } catch {
      // Retry until the built server starts listening.
    }
    await new Promise((resolve) => setTimeout(resolve, 200));
  }
  throw new Error(
    `Built web process did not become ready (exit ${child.exitCode ?? 'running'}, signal ${child.signalCode ?? 'none'}, HTTP ${lastStatus ?? 'none'})`,
  );
}

function trackChild(child: Child) {
  child.forcedShutdown = false;
  child.storeClosed = false;
  child.on('message', (message: any) => {
    if (message?.type === 'forced-shutdown') child.forcedShutdown = true;
    if (message?.type === 'factory-store-closed') child.storeClosed = true;
  });
  return child;
}

function redactDiagnostic(value: string) {
  let sanitized = value;
  for (const name of ['FACTORY_DATABASE_PASSWORD', 'FACTORY_OIDC_CLIENT_SECRET']) {
    const secret = process.env[name];
    if (secret) sanitized = sanitized.replaceAll(secret, '[redacted]');
  }
  return sanitized
    .replace(/\b(Basic|Bearer)\s+\S+/gi, '$1 [redacted]')
    .replace(/(password|secret|token|authorization)\s*[:=]\s*[^\s,;]+/gi, '$1=[redacted]')
    .slice(-1_200);
}

async function waitChildMessage<T extends { type: string }>(
  child: Child,
  predicate: (message: T) => boolean,
  timeoutMs: number,
  failure: string,
) {
  return new Promise<T>((resolveMessage, reject) => {
    const timer = setTimeout(() => {
      child.off('message', receive);
      reject(new Error(failure));
    }, timeoutMs);
    const receive = (message: T) => {
      if (!predicate(message)) return;
      clearTimeout(timer);
      child.off('message', receive);
      resolveMessage(message);
    };
    child.on('message', receive);
    if (child.exitCode !== null || child.signalCode !== null) {
      clearTimeout(timer);
      child.off('message', receive);
      reject(new Error(failure));
    }
  });
}

async function waitChildExit(child: Child, timeoutMs: number, failure: string) {
  if (child.exitCode !== null || child.signalCode !== null)
    return { code: child.exitCode, signal: child.signalCode };
  return new Promise<{ code: number | null; signal: NodeJS.Signals | null }>(
    (resolveExit, reject) => {
      const timer = setTimeout(() => {
        child.off('exit', receive);
        reject(new Error(failure));
      }, timeoutMs);
      const receive = (code: number | null, signal: NodeJS.Signals | null) => {
        clearTimeout(timer);
        resolveExit({ code, signal });
      };
      child.once('exit', receive);
    },
  );
}

class InstallationRuntime {
  web?: Child;
  worker?: Child;
  server?: Server;
  webMaintenance = false;
  private stopping = false;
  private stoppedResolve?: () => void;
  private operation: Promise<unknown> = Promise.resolve();
  private readonly address = controlAddress();

  async start() {
    await mkdir(recoveryDirectory(), { recursive: true, mode: 0o700 });
    await recoverStaleControlSocket(this.address);
    await checkRingAndDatabase();
    await mkdir(resolve(required('FACTORY_ARTIFACT_DIRECTORY')), {
      recursive: true,
      mode: 0o700,
    });
    await this.startWeb();
    await this.startWorker();
    await this.listenControl();
    const status = await readStatus();
    await writeStatus({
      ...status,
      service: { state: 'running', pid: process.pid, updatedAt: Date.now() },
    });
  }

  private async startWeb() {
    if (this.web && this.web.exitCode === null && this.web.signalCode === null) return;
    const { port, localOrigin } = applicationAddress();
    const hold = await readRestoreHold(required('FACTORY_WORKER_DIRECTORY'));
    const maintenance = process.env.FACTORY_MAINTENANCE === 'true' || hold?.activatedAt === null;
    this.webMaintenance = maintenance;
    const output = resolve('.output/server/index.mjs');
    if (!(await lstat(output).catch(() => undefined))?.isFile())
      throw new Error('Built web server is missing; run npm run build first');
    const environment = {
      ...process.env,
      CI: '',
      TEST: '',
      HOST: process.env.FACTORY_BIND_HOST ?? '127.0.0.1',
      NITRO_HOST: process.env.FACTORY_BIND_HOST ?? '127.0.0.1',
      PORT: String(port),
      NITRO_PORT: String(port),
      FACTORY_MAINTENANCE: maintenance ? 'true' : 'false',
    };
    const child = trackChild(
      fork(output, [], {
        cwd: process.cwd(),
        execArgv: ['--import', pathToFileURL(resolve('scripts/web-stop-preload.mjs')).href],
        env: environment,
        stdio: ['ignore', 'ignore', 'pipe', 'ipc'],
        windowsHide: true,
      }) as Child,
    );
    child.stderr?.setEncoding('utf8');
    child.stderr?.on('data', (chunk) => {
      child.diagnosticTail = redactDiagnostic(`${child.diagnosticTail ?? ''}${chunk}`);
    });
    this.web = child;
    try {
      await waitWebReady(child, localOrigin, 30_000, maintenance);
    } catch (error) {
      const details = child.diagnosticTail;
      if (details) throw new Error(`${(error as Error).message}\n${details}`);
      throw error;
    }
  }

  private async startWorker() {
    if (this.worker && this.worker.exitCode === null && this.worker.signalCode === null) return;
    const child = trackChild(
      fork(resolve('scripts/worker.ts'), [], {
        cwd: process.cwd(),
        execArgv: ['--import', 'tsx'],
        env: process.env,
        stdio: ['ignore', 'ignore', 'pipe', 'ipc'],
        windowsHide: true,
      }) as Child,
    );
    child.stderr?.resume();
    this.worker = child;
    const ready = await waitChildMessage<any>(
      child,
      (message) => ['ready', 'maintenance', 'restore-hold'].includes(message?.type),
      30_000,
      'Worker startup did not finish',
    );
    if (ready.type !== 'ready') {
      await waitChildExit(child, 5_000, 'Maintenance worker did not exit cleanly');
      this.worker = undefined;
    }
  }

  private async listenControl() {
    await mkdir(recoveryDirectory(), { recursive: true, mode: 0o700 });
    const server = createServer((socket) => void this.handleSocket(socket));
    this.server = server;
    await new Promise<void>((resolveListen, reject) => {
      server.once('error', reject);
      server.listen(this.address, () => {
        server.off('error', reject);
        resolveListen();
      });
    });
  }

  private async handleSocket(socket: Socket) {
    let content = '';
    socket.setEncoding('utf8');
    socket.on('data', (chunk) => {
      content += chunk;
      if (content.length > 64_000) {
        socket.destroy();
        return;
      }
      const index = content.indexOf('\n');
      if (index < 0) return;
      socket.pause();
      void this.handleControl(content.slice(0, index))
        .then((value) => socket.end(`${JSON.stringify({ ok: true, value })}\n`))
        .catch((error) =>
          socket.end(`${JSON.stringify({ ok: false, error: safeMessage(error) })}\n`),
        );
    });
  }

  private async handleControl(content: string) {
    const command = JSON.parse(content) as { command?: string; confirm?: boolean };
    if (command.command === 'status') return this.status(true);
    if (command.command === 'backup') return this.enqueue(() => this.backup());
    if (command.command === 'drill') return this.enqueue(() => this.drill());
    if (command.command === 'activate')
      return this.enqueue(async () => {
        const value = await activateRestoreHold({
          workerDirectory: required('FACTORY_WORKER_DIRECTORY'),
          confirm: command.confirm === true,
        });
        if (this.webMaintenance)
          await this.stopWeb(Number(process.env.FACTORY_STOP_TIMEOUT_MS ?? 30_000));
        process.env.FACTORY_MAINTENANCE = 'false';
        if (!this.web) await this.startWeb();
        await this.startWorker();
        return value;
      });
    if (command.command === 'stop') {
      const value = await this.enqueue(async () => {
        await this.stopChildren();
        this.stopping = true;
        this.stoppedResolve?.();
        return { stopped: true };
      });
      return value;
    }
    throw new Error('Unknown installation command');
  }

  private enqueue<T>(action: () => Promise<T>): Promise<T> {
    const next = this.operation.then(action, action);
    this.operation = next.catch(() => undefined);
    return next;
  }

  async wait() {
    if (this.stopping) return;
    await new Promise<void>((resolveWait) => (this.stoppedResolve = resolveWait));
  }

  async status(connected: boolean) {
    const stored = await readStatus();
    const workerHold = await readRestoreHold(required('FACTORY_WORKER_DIRECTORY')).catch(
      () => undefined,
    );
    return {
      coordinator: connected ? 'running' : 'stopped',
      web: Boolean(this.web && this.web.exitCode === null && this.web.signalCode === null),
      worker: Boolean(
        this.worker && this.worker.exitCode === null && this.worker.signalCode === null,
      ),
      restoreHold: workerHold
        ? {
            activated: workerHold.activatedAt !== null,
            pendingRuns: Object.values(workerHold.runs).filter(
              (run) => run.disposition === 'pending',
            ).length,
          }
        : undefined,
      ...backupAndDrillHealth(stored, Date.now()),
    };
  }

  private async pauseAndDrain(timeoutMs: number) {
    const worker = this.worker;
    if (!worker || worker.exitCode !== null || worker.signalCode !== null)
      throw new Error('No active worker is available for a coordinated backup');
    const id = randomUUID();
    const response = waitChildMessage<any>(
      worker,
      (message) => message?.id === id,
      timeoutMs,
      'Worker dispatch drain timed out',
    );
    worker.send({ type: 'pause-dispatch', id });
    const result = await response;
    if (result.type !== 'dispatch-drained' || result.active !== 0 || result.tick !== false)
      throw new Error('Worker did not reach a clean dispatch drain');
  }

  private async stopWorker(timeoutMs: number) {
    const worker = this.worker;
    if (!worker) return;
    if (worker.exitCode === null && worker.signalCode === null) {
      worker.send('stop');
      const result = await waitChildExit(worker, timeoutMs, 'Worker graceful stop timed out');
      if (result.code !== 0 || result.signal)
        throw new Error('Worker did not exit cleanly after dispatch drain');
    }
    const store = await connectStore(databaseConfig());
    try {
      if ((await store.transaction((tx) => tx.list('worker_owner'))).length)
        throw new Error('Worker owner remains after process stop');
    } finally {
      await store.close();
    }
    if (
      await lstat(join(required('FACTORY_WORKER_DIRECTORY'), 'worker.lock')).catch(() => undefined)
    )
      throw new Error('Worker lock remains after process stop');
    this.worker = undefined;
  }

  private async stopWeb(timeoutMs: number) {
    const web = this.web;
    if (!web) return;
    if (web.exitCode !== null || web.signalCode !== null)
      throw new Error('Built web process exited before coordinated shutdown');
    if (web.exitCode === null && web.signalCode === null) {
      const closed = waitChildMessage<any>(
        web,
        (message) => message?.type === 'factory-store-closed',
        timeoutMs,
        'Built web Store close acknowledgement timed out',
      );
      web.send({ type: 'installation-stop' });
      await closed;
      await new Promise<void>((resolveDrain) => setImmediate(resolveDrain));
      web.send({ type: 'installation-exit', exitCode: web.forcedShutdown ? 1 : 0 });
      const result = await waitChildExit(web, timeoutMs, 'Built web graceful stop timed out');
      this.web = undefined;
      if (result.code !== 0 || result.signal || web.forcedShutdown || !web.storeClosed)
        throw new Error('Built web process did not complete a graceful Store close');
    }
    this.web = undefined;
  }

  private async stopChildren() {
    const timeoutMs = Number(process.env.FACTORY_STOP_TIMEOUT_MS ?? 30_000);
    if (this.worker) await this.pauseAndDrain(timeoutMs);
    if (this.worker) await this.stopWorker(timeoutMs);
    if (this.web) await this.stopWeb(timeoutMs);
  }

  private async backup() {
    const status = await readStatus();
    const startedAt = Date.now();
    const lastSuccessful =
      status.backup?.lastSuccessful ??
      (status.backup?.state === 'succeeded' && status.backup.completedAt !== undefined
        ? {
            completedAt: status.backup.completedAt,
            recoveryPointAt: status.backup.recoveryPointAt,
            bundle: status.backup.bundle,
          }
        : undefined);
    const backupStatus: NonNullable<StoredStatus['backup']> = {
      state: 'running',
      startedAt,
      ...(lastSuccessful ? { lastSuccessful } : {}),
    };
    await writeStatus({ ...status, backup: backupStatus });
    const timeoutMs = Number(process.env.FACTORY_BACKUP_TIMEOUT_MS ?? 300_000);
    let drained = false;
    let workerStopAttempted = false;
    let workerStopped = false;
    let webStopped = false;
    try {
      await this.pauseAndDrain(timeoutMs);
      drained = true;
      workerStopAttempted = true;
      await this.stopWorker(timeoutMs);
      workerStopped = true;
      await this.stopWeb(timeoutMs);
      webStopped = true;
      const bundle = await createBundle({
        recoveryDirectory: recoveryDirectory(),
        workerDirectory: required('FACTORY_WORKER_DIRECTORY'),
        artifactDirectory: required('FACTORY_ARTIFACT_DIRECTORY'),
        timeoutMs,
      });
      const completedAt = Date.now();
      await writeStatus({
        ...(await readStatus()),
        backup: {
          state: 'succeeded',
          startedAt,
          completedAt,
          bundle: bundle.directory,
          recoveryPointAt: bundle.manifest.recoveryPointAt,
          lastSuccessful: {
            completedAt,
            bundle: bundle.directory,
            recoveryPointAt: bundle.manifest.recoveryPointAt,
          },
        },
      });
      await this.startWeb();
      await this.startWorker();
      return { bundle: bundle.directory, recoveryPointAt: bundle.manifest.recoveryPointAt };
    } catch (error) {
      const completedAt = Date.now();
      await writeStatus({
        ...(await readStatus()),
        backup: {
          ...backupStatus,
          state: 'failed',
          completedAt,
          error: safeMessage(error),
        },
      });
      if (drained && workerStopped && webStopped) {
        await this.startWeb().catch(() => undefined);
        await this.startWorker().catch(() => undefined);
      } else if (!workerStopAttempted && this.worker && this.worker.exitCode === null) {
        const id = randomUUID();
        this.worker.send({ type: 'resume-dispatch', id });
      }
      throw error;
    }
  }

  private async drill() {
    const status = await readStatus();
    const previous = await readdir(recoveryDirectory(), { withFileTypes: true });
    const candidates: Array<{ directory: string; recoveryPointAt: number }> = [];
    for (const entry of previous) {
      if (!entry.isDirectory() || !entry.name.startsWith('recovery-')) continue;
      const directory = join(recoveryDirectory(), entry.name);
      try {
        const { manifest } = await verifyBundle(directory);
        candidates.push({ directory, recoveryPointAt: manifest.recoveryPointAt });
      } catch {
        // An invalid directory never qualifies as the latest recovery point.
      }
    }
    const bundle = candidates.sort((a, b) => b.recoveryPointAt - a.recoveryPointAt)[0];
    if (!bundle) throw new Error('No verified recovery point is available for the drill');
    const startedAt = Date.now();
    await writeStatus({
      ...status,
      drill: { state: 'running', startedAt, bundle: bundle.directory },
    });
    const id = randomUUID().replaceAll('-', '');
    const recovery = recoveryDirectory();
    const sandbox = join(dirname(recovery), `.factory-drill-${id}`);
    const env = { ...process.env };
    env.FACTORY_DATABASE_NAMESPACE = `drill_${id}`;
    env.FACTORY_DATABASE_NAME = `drill_${id}`;
    env.FACTORY_WORKER_DIRECTORY = join(sandbox, 'worker');
    env.FACTORY_ARTIFACT_DIRECTORY = join(sandbox, 'artifacts');
    env.FACTORY_RING_DIRECTORY = join(sandbox, 'ring');
    env.FACTORY_RING_BACKUP_DIRECTORY = join(sandbox, 'ring-backups');
    env.FACTORY_RECOVERY_DIRECTORY = join(sandbox, 'recovery');
    env.FACTORY_MAINTENANCE = 'true';
    let restored = false;
    let sandboxCreated = false;
    try {
      await mkdir(sandbox, { recursive: false, mode: 0o700 });
      sandboxCreated = true;
      const { stdout } = await runFile(
        process.execPath,
        ['--import', 'tsx', 'scripts/installation-drill-restore.ts', bundle.directory],
        {
          cwd: process.cwd(),
          env,
          windowsHide: true,
          timeout: Number(process.env.FACTORY_BACKUP_TIMEOUT_MS ?? 300_000),
          maxBuffer: 1_000_000,
        },
      );
      const result = JSON.parse(stdout) as { recoveryPointAt: number };
      restored = true;
      const hold = await readRestoreHold(env.FACTORY_WORKER_DIRECTORY);
      if (!hold || hold.activatedAt !== null)
        throw new Error('Restore drill did not create its durable activation hold');
      const completedAt = Date.now();
      await writeStatus({
        ...(await readStatus()),
        drill: {
          state: 'succeeded',
          startedAt,
          completedAt,
          durationMs: completedAt - startedAt,
          bundle: bundle.directory,
          recoveryPointAt: result.recoveryPointAt,
        },
      });
      await removeFreshNamespace({
        ...databaseConfig(),
        namespace: env.FACTORY_DATABASE_NAMESPACE!,
        database: env.FACTORY_DATABASE_NAME!,
      });
      await rm(sandbox, { recursive: true, force: false });
      sandboxCreated = false;
      return { durationMs: completedAt - startedAt, recoveryPointAt: result.recoveryPointAt };
    } catch (error) {
      await writeStatus({
        ...(await readStatus()),
        drill: {
          state: 'failed',
          startedAt,
          completedAt: Date.now(),
          bundle: bundle.directory,
          recoveryPointAt: bundle.recoveryPointAt,
          error: safeMessage(error),
        },
      });
      if (restored)
        await removeFreshNamespace({
          ...databaseConfig(),
          namespace: env.FACTORY_DATABASE_NAMESPACE!,
          database: env.FACTORY_DATABASE_NAME!,
        }).catch(() => {});
      if (sandboxCreated) await rm(sandbox, { recursive: true, force: true });
      throw error;
    }
  }

  async shutdown() {
    try {
      await this.stopChildren();
      this.server?.close();
      this.stopping = true;
      this.stoppedResolve?.();
      await writeStatus({
        ...(await readStatus()),
        service: { state: 'stopped', updatedAt: Date.now() },
      });
    } catch (error) {
      await writeStatus({
        ...(await readStatus()),
        service: { state: 'shutdown-failed', pid: process.pid, updatedAt: Date.now() },
      }).catch(() => {});
      throw error;
    }
  }
}

function safeMessage(error: unknown) {
  if (
    error instanceof Error &&
    error.message &&
    !/authorization|password|token|secret/i.test(error.message)
  )
    return error.message;
  return 'Installation operation failed; inspect protected service logs';
}

async function requestControl(command: Record<string, unknown>, timeoutMs = 310_000) {
  return new Promise<any>((resolveReply, reject) => {
    const socket = createConnection(controlAddress());
    let response = '';
    const timer = setTimeout(() => {
      socket.destroy();
      reject(new Error('Installation coordinator request timed out'));
    }, timeoutMs);
    socket.setEncoding('utf8');
    socket.on('connect', () => socket.write(`${JSON.stringify(command)}\n`));
    socket.on('data', (chunk) => {
      response += chunk;
      const end = response.indexOf('\n');
      if (end < 0) return;
      clearTimeout(timer);
      socket.end();
      try {
        const value = JSON.parse(response.slice(0, end));
        if (!value.ok) reject(new Error(value.error ?? 'Installation command failed'));
        else resolveReply(value.value);
      } catch (error) {
        reject(new Error('Installation coordinator returned an invalid response'));
      }
    });
    socket.on('error', () => {
      clearTimeout(timer);
      reject(new Error('Installation coordinator is not running'));
    });
  });
}

async function printStatus() {
  try {
    const live = await requestControl({ command: 'status' }, 2_000);
    console.log(JSON.stringify(live, null, 2));
    if (
      live.backup?.overdue ||
      live.drill?.overdue ||
      live.backup?.state === 'failed' ||
      live.drill?.state === 'failed'
    )
      process.exitCode = 1;
    return;
  } catch {
    const status = await readStatus();
    const value = {
      coordinator: 'stopped',
      ...backupAndDrillHealth(status, Date.now()),
    };
    console.log(JSON.stringify(value, null, 2));
    if (
      value.backup.overdue ||
      value.drill.overdue ||
      status.backup?.state === 'failed' ||
      status.drill?.state === 'failed'
    )
      process.exitCode = 1;
  }
}

async function runCoordinator() {
  const runtime = new InstallationRuntime();
  try {
    await runtime.start();
  } catch (error) {
    await runtime.shutdown().catch(() => {});
    throw error;
  }
  const shutdown = () => void runtime.shutdown().catch(() => {});
  process.once('SIGINT', shutdown);
  process.once('SIGTERM', shutdown);
  try {
    await runtime.wait();
  } finally {
    process.off('SIGINT', shutdown);
    process.off('SIGTERM', shutdown);
    await runtime.shutdown();
  }
}

async function requireMaintenance() {
  if (process.env.FACTORY_MAINTENANCE !== 'true')
    throw new Error('This restore operation requires FACTORY_MAINTENANCE=true');
  try {
    await requestControl({ command: 'status' }, 1_000);
    throw new Error('Stop the installation coordinator before this restore operation');
  } catch (error: any) {
    if (error.message !== 'Installation coordinator is not running') throw error;
  }
}

async function main() {
  const [command, ...args] = process.argv.slice(2);
  if (command === 'run') return runCoordinator();
  if (command === 'status') return printStatus();
  if (command === 'backup')
    return console.log(JSON.stringify(await requestControl({ command: 'backup' })));
  if (command === 'stop')
    return console.log(JSON.stringify(await requestControl({ command: 'stop' })));
  if (command === 'restore') {
    await requireMaintenance();
    const bundle = args[0];
    if (!bundle) throw new Error('Usage: installation restore <bundle-directory>');
    return console.log(JSON.stringify(await restoreBundle(bundle), null, 2));
  }
  if (command === 'drill')
    return console.log(JSON.stringify(await requestControl({ command: 'drill' }, 600_000)));
  if (command === 'activate') {
    const confirm = args.includes('--confirm-reconciled');
    try {
      const value = await requestControl({ command: 'activate', confirm }, 30_000);
      return console.log(JSON.stringify(value));
    } catch (error: any) {
      if (error.message !== 'Installation coordinator is not running') throw error;
    }
    await requireMaintenance();
    const value = await activateRestoreHold({
      workerDirectory: required('FACTORY_WORKER_DIRECTORY'),
      confirm,
    });
    return console.log(JSON.stringify(value));
  }
  if (command === 'recovery-list') {
    await requireMaintenance();
    const hold = await readRestoreHold(required('FACTORY_WORKER_DIRECTORY'));
    if (!hold) throw new Error('No restore hold is present');
    return console.log(JSON.stringify(hold, null, 2));
  }
  if (command === 'recovery-run') {
    await requireMaintenance();
    const [run, disposition] = args;
    if (!run || !['hold', 'resume', 'reconcile'].includes(disposition))
      throw new Error('Usage: installation recovery-run <run-id> hold|resume|reconcile');
    return console.log(
      JSON.stringify(
        await setRestoreDisposition(
          required('FACTORY_WORKER_DIRECTORY'),
          run,
          disposition as 'hold' | 'resume' | 'reconcile',
        ),
      ),
    );
  }
  throw new Error(
    'Usage: installation run|status|stop|backup|restore|drill|recovery-list|recovery-run|activate',
  );
}

main().catch((error) => {
  console.error(safeMessage(error));
  process.exitCode = 1;
});
