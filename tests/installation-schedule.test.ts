import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { spawn } from 'node:child_process';
import { mkdtemp, mkdir, rm } from 'node:fs/promises';
import { createServer, type Server } from 'node:net';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { test } from 'node:test';

type InstallationStatus = {
  coordinator: string;
  web?: boolean;
  worker?: boolean;
  restoreHold?: { activated: boolean; pendingRuns: number };
  backup: { state?: string; overdue: boolean; startedAt?: number; completedAt?: number };
  drill: { state?: string; overdue: boolean; startedAt?: number; completedAt?: number };
};

async function startCoordinator(
  recovery: string,
  installation: string,
  status: InstallationStatus,
  onOperation?: (command: string) => void | boolean | Promise<void | boolean>,
) {
  const operations: string[] = [];
  const address =
    process.platform === 'win32'
      ? `\\\\.\\pipe\\tbfactory-${createHash('sha256').update(installation).digest('hex').slice(0, 24)}`
      : join(recovery, '.installation.sock');
  const server = createServer((socket) => {
    let content = '';
    socket.setEncoding('utf8');
    socket.on('data', (chunk) => {
      content += chunk;
      const end = content.indexOf('\n');
      if (end < 0) return;
      const request = JSON.parse(content.slice(0, end)) as { command: string };
      if (request.command === 'status') {
        socket.end(`${JSON.stringify({ ok: true, value: status })}\n`);
        return;
      }
      operations.push(request.command);
      void Promise.resolve(onOperation?.(request.command)).then(
        (accepted) => {
          if (accepted === false)
            socket.end(`${JSON.stringify({ ok: false, error: 'Controlled operation failure' })}\n`);
          else
            socket.end(`${JSON.stringify({ ok: true, value: { completed: request.command } })}\n`);
        },
        () =>
          socket.end(`${JSON.stringify({ ok: false, error: 'Controlled operation failure' })}\n`),
      );
    });
  });
  await new Promise<void>((resolve, reject) => {
    server.once('error', reject);
    server.listen(address, () => {
      server.off('error', reject);
      resolve();
    });
  });
  return { address, operations, server };
}

async function startSmtp(rejectFirst = false) {
  const messages: string[] = [];
  let rejected = false;
  const server = createServer((socket) => {
    let input = '';
    let dataMode = false;
    let message = '';
    socket.write('220 smtp4dev ESMTP ready\r\n');
    socket.setEncoding('utf8');
    socket.on('data', (chunk) => {
      input += chunk;
      while (input.includes('\r\n')) {
        const end = input.indexOf('\r\n');
        const line = input.slice(0, end);
        input = input.slice(end + 2);
        if (dataMode) {
          if (line === '.') {
            dataMode = false;
            if (rejectFirst && !rejected) {
              rejected = true;
              socket.write('451 4.3.0 Try again later\r\n');
            } else {
              messages.push(message);
              socket.write('250 2.0.0 queued\r\n');
            }
            message = '';
          } else {
            message += `${line}\r\n`;
          }
          continue;
        }
        const command = line.toUpperCase();
        if (command.startsWith('EHLO') || command.startsWith('HELO'))
          socket.write('250 smtp4dev\r\n');
        else if (command.startsWith('MAIL FROM:') || command.startsWith('RCPT TO:'))
          socket.write('250 2.1.0 accepted\r\n');
        else if (command === 'DATA') {
          dataMode = true;
          socket.write('354 End data with <CR><LF>.<CR><LF>\r\n');
        } else if (command === 'QUIT') socket.end('221 2.0.0 bye\r\n');
        else socket.write('250 2.0.0 ok\r\n');
      }
    });
  });
  await new Promise<void>((resolve, reject) => {
    server.once('error', reject);
    server.listen(0, '127.0.0.1', () => {
      server.off('error', reject);
      resolve();
    });
  });
  const port = (server.address() as { port: number }).port;
  return { server, port, messages };
}

function decodePlainTextMessage(message: string) {
  return message.replace(/=\r\n/g, '');
}

async function runScheduler(args: string[], env: NodeJS.ProcessEnv) {
  const child = spawn(
    process.execPath,
    ['--import', 'tsx', 'scripts/installation-schedule.ts', ...args],
    {
      cwd: process.cwd(),
      env: { ...process.env, ...env },
      stdio: ['ignore', 'pipe', 'pipe'],
      windowsHide: true,
    },
  );
  let output = '';
  child.stdout.setEncoding('utf8').on('data', (part) => (output += part));
  child.stderr.setEncoding('utf8').on('data', (part) => (output += part));
  const code = await new Promise<number | null>((resolve, reject) => {
    const timer = setTimeout(() => {
      child.kill();
      reject(new Error(`Scheduler command timed out: ${output}`));
    }, 30_000);
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

async function runFactoryHealth(env: NodeJS.ProcessEnv) {
  const child = spawn(process.execPath, ['docker/evaluation/scripts/factory-health.mjs'], {
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
      reject(new Error(`Factory healthcheck timed out: ${output}`));
    }, 30_000);
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

function startSchedulerRun(env: NodeJS.ProcessEnv, command = 'run') {
  const child = spawn(
    process.execPath,
    ['--import', 'tsx', 'scripts/installation-schedule.ts', command],
    {
      cwd: process.cwd(),
      env: { ...process.env, ...env },
      stdio: ['ignore', 'pipe', 'pipe'],
      windowsHide: true,
    },
  );
  let output = '';
  child.stdout.setEncoding('utf8').on('data', (part) => (output += part));
  child.stderr.setEncoding('utf8').on('data', (part) => (output += part));
  const exited = new Promise<number | null>((resolve, reject) => {
    child.once('error', reject);
    child.once('exit', resolve);
  });
  return { child, exited, output: () => output };
}

async function waitUntil(ready: () => boolean, message: string) {
  const deadline = Date.now() + 15_000;
  while (!ready() && Date.now() < deadline) await new Promise((resolve) => setTimeout(resolve, 25));
  assert.ok(ready(), message);
}

async function closeServer(server: Server) {
  await new Promise<void>((resolve, reject) =>
    server.close((error) => (error ? reject(error) : resolve())),
  );
}

test('a failed backup sends one SMTP alert for the active incident and resolves cleanly', async () => {
  const directory = await mkdtemp(join(tmpdir(), 'factory-scheduler-alert-'));
  const recovery = join(directory, 'recovery');
  await mkdir(recovery);
  const installation = `scheduler-${process.pid}-${Date.now()}`;
  const now = Date.now();
  const status: InstallationStatus = {
    coordinator: 'running',
    backup: { state: 'failed', overdue: false, startedAt: now - 1000, completedAt: now },
    drill: { state: 'succeeded', overdue: false, startedAt: now - 2000, completedAt: now - 1500 },
  };
  let coordinator: Awaited<ReturnType<typeof startCoordinator>> | undefined;
  let smtp: Awaited<ReturnType<typeof startSmtp>> | undefined;
  try {
    coordinator = await startCoordinator(recovery, installation, status);
    smtp = await startSmtp();
    const env = {
      FACTORY_RECOVERY_DIRECTORY: recovery,
      FACTORY_INSTALLATION: installation,
      FACTORY_SMTP_HOST: '127.0.0.1',
      FACTORY_SMTP_PORT: String(smtp.port),
      FACTORY_SMTP_FROM: 'factory@example.test',
      FACTORY_SMTP_TO: 'operator@example.test',
      FACTORY_SMTP_RETRY_MS: '0',
    };
    await runScheduler(['check'], env);
    await runScheduler(['check'], env);
    assert.equal(smtp.messages.length, 1);
    assert.match(smtp.messages[0], /backup.*failed/i);
    assert.match(smtp.messages[0], /operator@example\.test/i);
    status.backup = {
      state: 'succeeded',
      overdue: false,
      startedAt: now + 100,
      completedAt: now + 200,
    };
    await runScheduler(['check'], env);
    status.backup = {
      state: 'failed',
      overdue: false,
      startedAt: now + 300,
      completedAt: now + 400,
    };
    await runScheduler(['check'], env);
    assert.equal(smtp.messages.length, 2);
  } finally {
    if (coordinator) await closeServer(coordinator.server);
    if (smtp) await closeServer(smtp.server);
    await rm(directory, { recursive: true, force: true });
  }
});

test('an SMTP rejection stays retryable until the message is accepted', async () => {
  const directory = await mkdtemp(join(tmpdir(), 'factory-scheduler-retry-'));
  const recovery = join(directory, 'recovery');
  await mkdir(recovery);
  const installation = `scheduler-${process.pid}-${Date.now()}`;
  const now = Date.now();
  const status: InstallationStatus = {
    coordinator: 'running',
    backup: { state: 'failed', overdue: false, startedAt: now - 1000, completedAt: now },
    drill: { state: 'succeeded', overdue: false, startedAt: now - 2000, completedAt: now - 1500 },
  };
  let coordinator: Awaited<ReturnType<typeof startCoordinator>> | undefined;
  let smtp: Awaited<ReturnType<typeof startSmtp>> | undefined;
  try {
    coordinator = await startCoordinator(recovery, installation, status);
    smtp = await startSmtp(true);
    const env = {
      FACTORY_RECOVERY_DIRECTORY: recovery,
      FACTORY_INSTALLATION: installation,
      FACTORY_SMTP_HOST: '127.0.0.1',
      FACTORY_SMTP_PORT: String(smtp.port),
      FACTORY_SMTP_FROM: 'factory@example.test',
      FACTORY_SMTP_TO: 'operator@example.test',
      FACTORY_SMTP_RETRY_MS: '0',
    };
    const rejected = await runScheduler(['check'], env);
    assert.equal(rejected.code, 0, rejected.output);
    assert.equal(smtp.messages.length, 0);
    status.backup = {
      state: 'succeeded',
      overdue: false,
      startedAt: now + 100,
      completedAt: now + 200,
    };
    const retried = await runScheduler(['check'], env);
    assert.equal(retried.code, 0, retried.output);
    assert.equal(smtp.messages.length, 1);
  } finally {
    if (coordinator) await closeServer(coordinator.server);
    if (smtp) await closeServer(smtp.server);
    await rm(directory, { recursive: true, force: true });
  }
});

test('the scheduler creates its first recovery point before the first monthly drill', async () => {
  const directory = await mkdtemp(join(tmpdir(), 'factory-scheduler-bootstrap-'));
  const recovery = join(directory, 'recovery');
  await mkdir(recovery);
  const installation = `scheduler-${process.pid}-${Date.now()}`;
  const status: InstallationStatus = {
    coordinator: 'running',
    backup: { overdue: true },
    drill: { overdue: true },
  };
  const coordinator = await startCoordinator(recovery, installation, status, (command) => {
    if (command === 'backup')
      status.backup = {
        state: 'succeeded',
        overdue: false,
        startedAt: Date.now(),
        completedAt: Date.now(),
      };
    if (command === 'drill')
      status.drill = {
        state: 'succeeded',
        overdue: false,
        startedAt: Date.now(),
        completedAt: Date.now(),
      };
  });
  const smtp = await startSmtp();
  const scheduler = startSchedulerRun(
    {
      FACTORY_RECOVERY_DIRECTORY: recovery,
      FACTORY_INSTALLATION: installation,
      FACTORY_SMTP_HOST: '127.0.0.1',
      FACTORY_SMTP_PORT: String(smtp.port),
      FACTORY_SMTP_FROM: 'factory@example.test',
      FACTORY_SMTP_TO: 'operator@example.test',
      FACTORY_SCHEDULE_BACKUP_INTERVAL_MS: '86400000',
      FACTORY_SCHEDULE_DRILL_INTERVAL_MS: '86400000',
      FACTORY_SCHEDULE_POLL_INTERVAL_MS: '100000',
    },
    'run-once',
  );
  try {
    await waitUntil(
      () => coordinator.operations.length === 2,
      `Expected backup then drill; got ${scheduler.output()}`,
    );
    assert.equal(await scheduler.exited, 0, scheduler.output());
    assert.deepEqual(coordinator.operations, ['backup', 'drill']);
    assert.equal(smtp.messages.length, 0);
  } finally {
    if (scheduler.child.exitCode === null && scheduler.child.signalCode === null)
      scheduler.child.kill();
    await closeServer(coordinator.server);
    await closeServer(smtp.server);
    await rm(directory, { recursive: true, force: true });
  }
});

test('a stopped coordinator sends a local alert without exposing status secrets', async () => {
  const directory = await mkdtemp(join(tmpdir(), 'factory-scheduler-coordinator-'));
  const recovery = join(directory, 'recovery');
  await mkdir(recovery);
  const installation = `scheduler-${process.pid}-${Date.now()}`;
  const status = {
    coordinator: 'stopped',
    backup: { state: 'succeeded', overdue: false, completedAt: Date.now() - 1000 },
    drill: { state: 'succeeded', overdue: false, completedAt: Date.now() - 1000 },
    databasePassword: 'must-not-appear-in-mail',
  } as InstallationStatus;
  let coordinator: Awaited<ReturnType<typeof startCoordinator>> | undefined;
  let smtp: Awaited<ReturnType<typeof startSmtp>> | undefined;
  try {
    coordinator = await startCoordinator(recovery, installation, status);
    smtp = await startSmtp();
    const result = await runScheduler(['check'], {
      FACTORY_RECOVERY_DIRECTORY: recovery,
      FACTORY_INSTALLATION: installation,
      FACTORY_SMTP_HOST: '127.0.0.1',
      FACTORY_SMTP_PORT: String(smtp.port),
      FACTORY_SMTP_FROM: 'factory@example.test',
      FACTORY_SMTP_TO: 'operator@example.test',
    });
    assert.equal(result.code, 0, result.output);
    assert.equal(smtp.messages.length, 1);
    assert.match(smtp.messages[0], /coordinator is unavailable/i);
    assert.doesNotMatch(smtp.messages[0], /must-not-appear-in-mail/);
  } finally {
    if (coordinator) await closeServer(coordinator.server);
    if (smtp) await closeServer(smtp.server);
    await rm(directory, { recursive: true, force: true });
  }
});

test('status checks send failure and overdue alerts for backup and restore drill receipts', async () => {
  const directory = await mkdtemp(join(tmpdir(), 'factory-scheduler-overdue-'));
  const recovery = join(directory, 'recovery');
  await mkdir(recovery);
  const installation = `scheduler-${process.pid}-${Date.now()}`;
  const status: InstallationStatus = {
    coordinator: 'running',
    backup: { state: 'failed', overdue: true, completedAt: Date.now() - 25 * 60 * 60 * 1000 },
    drill: {
      state: 'failed',
      overdue: true,
      completedAt: Date.now() - 32 * 24 * 60 * 60 * 1000,
    },
  };
  const coordinator = await startCoordinator(recovery, installation, status);
  const smtp = await startSmtp();
  try {
    const result = await runScheduler(['check'], {
      FACTORY_RECOVERY_DIRECTORY: recovery,
      FACTORY_INSTALLATION: installation,
      FACTORY_SMTP_HOST: '127.0.0.1',
      FACTORY_SMTP_PORT: String(smtp.port),
      FACTORY_SMTP_FROM: 'factory@example.test',
      FACTORY_SMTP_TO: 'operator@example.test',
    });
    assert.equal(result.code, 0, result.output);
    assert.equal(smtp.messages.length, 4);
    assert.ok(smtp.messages.some((message) => /backup failed/i.test(message)));
    assert.ok(smtp.messages.some((message) => /backup recovery point is overdue/i.test(message)));
    assert.ok(smtp.messages.some((message) => /restore drill failed/i.test(message)));
    assert.ok(smtp.messages.some((message) => /restore drill is overdue/i.test(message)));
  } finally {
    await closeServer(coordinator.server);
    await closeServer(smtp.server);
    await rm(directory, { recursive: true, force: true });
  }
});

test('a failed drill waits for its next scheduled retry instead of repeating immediately', async () => {
  const directory = await mkdtemp(join(tmpdir(), 'factory-scheduler-drill-retry-'));
  const recovery = join(directory, 'recovery');
  await mkdir(recovery);
  const installation = `scheduler-${process.pid}-${Date.now()}`;
  const now = Date.now();
  const status: InstallationStatus = {
    coordinator: 'running',
    backup: { state: 'succeeded', overdue: false, completedAt: now - 1000 },
    drill: {
      state: 'succeeded',
      overdue: true,
      completedAt: now - 33 * 24 * 60 * 60 * 1000,
    },
  };
  const coordinator = await startCoordinator(recovery, installation, status, (command) =>
    command === 'drill' ? false : undefined,
  );
  try {
    const failed = await runScheduler(['drill'], {
      FACTORY_RECOVERY_DIRECTORY: recovery,
      FACTORY_INSTALLATION: installation,
    });
    assert.equal(failed.code, 1, failed.output);
    assert.deepEqual(coordinator.operations, ['drill']);
    await runScheduler(['run-once'], {
      FACTORY_RECOVERY_DIRECTORY: recovery,
      FACTORY_INSTALLATION: installation,
    });
    assert.deepEqual(coordinator.operations, ['drill']);
  } finally {
    await closeServer(coordinator.server);
    await rm(directory, { recursive: true, force: true });
  }
});

test('a successful restore drill recurs on the next calendar month', async () => {
  const directory = await mkdtemp(join(tmpdir(), 'factory-scheduler-monthly-'));
  const recovery = join(directory, 'recovery');
  await mkdir(recovery);
  const installation = `scheduler-${process.pid}-${Date.now()}`;
  const now = new Date();
  const previousMonth = now.getUTCMonth() - 1;
  const lastDayPreviousMonth = new Date(
    Date.UTC(now.getUTCFullYear(), previousMonth + 1, 0),
  ).getUTCDate();
  const drillCompletedAt = Date.UTC(
    now.getUTCFullYear(),
    previousMonth,
    Math.min(now.getUTCDate(), lastDayPreviousMonth),
  );
  const status: InstallationStatus = {
    coordinator: 'running',
    backup: { state: 'succeeded', overdue: false, completedAt: now.getTime() - 1000 },
    drill: { state: 'succeeded', overdue: false, completedAt: drillCompletedAt },
  };
  const coordinator = await startCoordinator(recovery, installation, status, (command) => {
    if (command === 'drill')
      status.drill = {
        state: 'succeeded',
        overdue: false,
        startedAt: Date.now(),
        completedAt: Date.now(),
      };
  });
  try {
    await runScheduler(['run-once'], {
      FACTORY_RECOVERY_DIRECTORY: recovery,
      FACTORY_INSTALLATION: installation,
    });
    assert.deepEqual(coordinator.operations, ['drill']);
  } finally {
    await closeServer(coordinator.server);
    await rm(directory, { recursive: true, force: true });
  }
});

test('an existing overdue incident is emailed even when its scheduled job recovers', async () => {
  const directory = await mkdtemp(join(tmpdir(), 'factory-scheduler-recovery-alert-'));
  const recovery = join(directory, 'recovery');
  await mkdir(recovery);
  const installation = `scheduler-${process.pid}-${Date.now()}`;
  const now = Date.now();
  const status: InstallationStatus = {
    coordinator: 'running',
    backup: { state: 'succeeded', overdue: true, completedAt: now - 25 * 60 * 60 * 1000 },
    drill: { state: 'succeeded', overdue: false, completedAt: now - 2 * 60 * 60 * 1000 },
  };
  const coordinator = await startCoordinator(recovery, installation, status, (command) => {
    if (command === 'backup')
      status.backup = {
        state: 'succeeded',
        overdue: false,
        startedAt: Date.now(),
        completedAt: Date.now(),
      };
  });
  const smtp = await startSmtp();
  try {
    await runScheduler(['run-once'], {
      FACTORY_RECOVERY_DIRECTORY: recovery,
      FACTORY_INSTALLATION: installation,
      FACTORY_SMTP_HOST: '127.0.0.1',
      FACTORY_SMTP_PORT: String(smtp.port),
      FACTORY_SMTP_FROM: 'factory@example.test',
      FACTORY_SMTP_TO: 'operator@example.test',
    });
    assert.deepEqual(coordinator.operations, ['backup']);
    assert.equal(smtp.messages.length, 1);
    assert.match(smtp.messages[0], /backup recovery point is overdue/i);
  } finally {
    await closeServer(coordinator.server);
    await closeServer(smtp.server);
    await rm(directory, { recursive: true, force: true });
  }
});

test('a scheduled backup window alert is delivered before the backup completes and stays deduplicated', async () => {
  const directory = await mkdtemp(join(tmpdir(), 'factory-scheduler-backup-window-'));
  const recovery = join(directory, 'recovery');
  await mkdir(recovery);
  const installation = `scheduler-${process.pid}-${Date.now()}`;
  const status: InstallationStatus = {
    coordinator: 'running',
    backup: { overdue: false },
    drill: { state: 'succeeded', overdue: false, completedAt: Date.now() },
  };
  let releaseBackup = () => {};
  const heldBackup = new Promise<void>((resolve) => (releaseBackup = resolve));
  const coordinator = await startCoordinator(recovery, installation, status, async (command) => {
    if (command !== 'backup') return;
    const startedAt = Date.now();
    status.backup = { state: 'running', overdue: false, startedAt };
    await heldBackup;
    status.backup = {
      state: 'succeeded',
      overdue: false,
      startedAt,
      completedAt: Date.now(),
    };
  });
  const smtp = await startSmtp();
  const env = {
    FACTORY_RECOVERY_DIRECTORY: recovery,
    FACTORY_INSTALLATION: installation,
    FACTORY_BACKUP_MAX_TOTAL_MS: '1200',
    FACTORY_SCHEDULE_BACKUP_INTERVAL_MS: '86400000',
    FACTORY_SMTP_HOST: '127.0.0.1',
    FACTORY_SMTP_PORT: String(smtp.port),
    FACTORY_SMTP_FROM: 'factory@example.test',
    FACTORY_SMTP_TO: 'operator@example.test',
    FACTORY_SMTP_RETRY_MS: '0',
  };
  const scheduler = startSchedulerRun(env, 'run-once');
  try {
    await waitUntil(
      () => coordinator.operations.includes('backup'),
      `Expected a held backup operation; got ${scheduler.output()}`,
    );
    await waitUntil(
      () => smtp.messages.length === 1,
      `Expected the backup-window email before releasing the operation; got ${scheduler.output()}`,
    );
    assert.equal(scheduler.child.exitCode, null, 'The scheduler must keep awaiting the backup');
    const mail = decodePlainTextMessage(smtp.messages[0]);
    assert.match(mail, /backup.*maximum total duration/i);
    assert.match(mail, /still running/i);
    assert.match(mail, /coordinator, web, and worker health/i);

    releaseBackup();
    assert.equal(await scheduler.exited, 0, scheduler.output());
    const check = await runScheduler(['check'], env);
    assert.equal(check.code, 0, check.output);
    assert.match(check.output, /backup-window-exceeded/);
    assert.equal(
      smtp.messages.length,
      1,
      'A completed overlong receipt must not resend a delivered incident',
    );

    const shortBackupEnv = { ...env, FACTORY_BACKUP_MAX_TOTAL_MS: '30000' };
    const shortBackup = await runScheduler(['backup'], shortBackupEnv);
    assert.equal(shortBackup.code, 0, shortBackup.output);
    const resolved = await runScheduler(['check'], shortBackupEnv);
    assert.equal(resolved.code, 0, resolved.output);
    assert.doesNotMatch(resolved.output, /backup-window-exceeded/);
    assert.equal(smtp.messages.length, 1, 'A later in-window receipt resolves the incident');
  } finally {
    releaseBackup();
    if (scheduler.child.exitCode === null && scheduler.child.signalCode === null)
      await scheduler.exited;
    await closeServer(coordinator.server);
    await closeServer(smtp.server);
    await rm(directory, { recursive: true, force: true });
  }
});

test('a completed overlong backup receipt keeps an SMTP window alert retryable', async () => {
  const directory = await mkdtemp(join(tmpdir(), 'factory-scheduler-backup-window-retry-'));
  const recovery = join(directory, 'recovery');
  await mkdir(recovery);
  const installation = `scheduler-${process.pid}-${Date.now()}`;
  const status: InstallationStatus = {
    coordinator: 'running',
    backup: { overdue: false },
    drill: { state: 'succeeded', overdue: false, completedAt: Date.now() },
  };
  const coordinator = await startCoordinator(recovery, installation, status, async (command) => {
    if (command !== 'backup') return;
    const startedAt = Date.now();
    status.backup = { state: 'running', overdue: false, startedAt };
    await new Promise((resolve) => setTimeout(resolve, 350));
    status.backup = {
      state: 'succeeded',
      overdue: false,
      startedAt,
      completedAt: Date.now(),
    };
  });
  const smtp = await startSmtp(true);
  const env = {
    FACTORY_RECOVERY_DIRECTORY: recovery,
    FACTORY_INSTALLATION: installation,
    FACTORY_BACKUP_MAX_TOTAL_MS: '100',
    FACTORY_SMTP_HOST: '127.0.0.1',
    FACTORY_SMTP_PORT: String(smtp.port),
    FACTORY_SMTP_FROM: 'factory@example.test',
    FACTORY_SMTP_TO: 'operator@example.test',
    FACTORY_SMTP_RETRY_MS: '0',
  };
  try {
    const first = await runScheduler(['backup'], env);
    assert.equal(first.code, 0, first.output);
    assert.equal(smtp.messages.length, 0, 'The first SMTP attempt is rejected');

    const retried = await runScheduler(['check'], env);
    assert.equal(retried.code, 0, retried.output);
    assert.match(retried.output, /backup-window-exceeded/);
    assert.equal(smtp.messages.length, 1);
    assert.match(
      decodePlainTextMessage(smtp.messages[0]),
      /measured total backup duration upper bound: \d+ ms/i,
    );

    const deduplicated = await runScheduler(['check'], env);
    assert.equal(deduplicated.code, 0, deduplicated.output);
    assert.equal(smtp.messages.length, 1, 'A delivered retry must be deduplicated after restart');
  } finally {
    await closeServer(coordinator.server);
    await closeServer(smtp.server);
    await rm(directory, { recursive: true, force: true });
  }
});

test('an explicit child-service failure alerts except during backup or an unactivated restore hold', async () => {
  const directory = await mkdtemp(join(tmpdir(), 'factory-scheduler-child-service-'));
  const recovery = join(directory, 'recovery');
  await mkdir(recovery);
  const installation = `scheduler-${process.pid}-${Date.now()}`;
  const now = Date.now();
  const status: InstallationStatus = {
    coordinator: 'running',
    web: false,
    worker: true,
    backup: { state: 'succeeded', overdue: false, startedAt: now - 2000, completedAt: now - 1000 },
    drill: { state: 'succeeded', overdue: false, completedAt: now - 1000 },
  };
  const coordinator = await startCoordinator(recovery, installation, status);
  const smtp = await startSmtp();
  const env = {
    FACTORY_RECOVERY_DIRECTORY: recovery,
    FACTORY_INSTALLATION: installation,
    FACTORY_SMTP_HOST: '127.0.0.1',
    FACTORY_SMTP_PORT: String(smtp.port),
    FACTORY_SMTP_FROM: 'factory@example.test',
    FACTORY_SMTP_TO: 'operator@example.test',
    FACTORY_SMTP_RETRY_MS: '0',
  };
  try {
    const outage = await runScheduler(['check'], env);
    assert.equal(outage.code, 0, outage.output);
    assert.match(outage.output, /child-service-unavailable/);
    assert.equal(smtp.messages.length, 1);
    assert.match(smtp.messages[0], /web or worker service is unavailable/i);

    await runScheduler(['check'], env);
    assert.equal(smtp.messages.length, 1, 'An active child-service incident is deduplicated');

    status.backup.state = 'running';
    status.worker = false;
    const backup = await runScheduler(['check'], env);
    assert.equal(backup.code, 0, backup.output);
    assert.doesNotMatch(backup.output, /child-service-unavailable/);
    assert.equal(smtp.messages.length, 1);

    status.backup.state = 'succeeded';
    status.web = true;
    status.restoreHold = { activated: false, pendingRuns: 0 };
    const heldRestore = await runScheduler(['check'], env);
    assert.equal(heldRestore.code, 0, heldRestore.output);
    assert.doesNotMatch(heldRestore.output, /child-service-unavailable/);
    assert.equal(smtp.messages.length, 1);

    status.restoreHold.activated = true;
    const recoveredHold = await runScheduler(['check'], env);
    assert.equal(recoveredHold.code, 0, recoveredHold.output);
    assert.match(recoveredHold.output, /child-service-unavailable/);
    assert.equal(smtp.messages.length, 2, 'A resolved incident notifies again if it returns');
  } finally {
    await closeServer(coordinator.server);
    await closeServer(smtp.server);
    await rm(directory, { recursive: true, force: true });
  }
});

test('the Docker healthcheck ignores schedule failures and expected service stops', async () => {
  const directory = await mkdtemp(join(tmpdir(), 'factory-healthcheck-'));
  const recovery = join(directory, 'recovery');
  await mkdir(recovery);
  const installation = `health-${process.pid}-${Date.now()}`;
  const now = Date.now();
  const status: InstallationStatus = {
    coordinator: 'running',
    web: true,
    worker: true,
    backup: { state: 'failed', overdue: true, startedAt: now - 2000, completedAt: now - 1000 },
    drill: { state: 'failed', overdue: true, startedAt: now - 2000, completedAt: now - 1000 },
  };
  const coordinator = await startCoordinator(recovery, installation, status);
  const env = {
    FACTORY_RECOVERY_DIRECTORY: recovery,
    FACTORY_INSTALLATION: installation,
  };
  try {
    const overdue = await runFactoryHealth(env);
    assert.equal(overdue.code, 0, overdue.output);

    status.web = false;
    status.backup.state = 'succeeded';
    const unavailable = await runFactoryHealth(env);
    assert.equal(unavailable.code, 1, unavailable.output);

    status.worker = false;
    status.backup.state = 'running';
    const backup = await runFactoryHealth(env);
    assert.equal(backup.code, 0, backup.output);

    status.backup.state = 'succeeded';
    status.restoreHold = { activated: false, pendingRuns: 0 };
    const restoreHold = await runFactoryHealth(env);
    assert.equal(restoreHold.code, 0, restoreHold.output);
  } finally {
    await closeServer(coordinator.server);
    await rm(directory, { recursive: true, force: true });
  }
});

test('the optional backup total limit rejects a fractional duration before running a backup', async () => {
  const directory = await mkdtemp(join(tmpdir(), 'factory-scheduler-backup-window-setting-'));
  const recovery = join(directory, 'recovery');
  await mkdir(recovery);
  const installation = `scheduler-${process.pid}-${Date.now()}`;
  const status: InstallationStatus = {
    coordinator: 'running',
    backup: { state: 'succeeded', overdue: false, completedAt: Date.now() },
    drill: { state: 'succeeded', overdue: false, completedAt: Date.now() },
  };
  const coordinator = await startCoordinator(recovery, installation, status);
  try {
    const result = await runScheduler(['backup'], {
      FACTORY_RECOVERY_DIRECTORY: recovery,
      FACTORY_INSTALLATION: installation,
      FACTORY_BACKUP_MAX_TOTAL_MS: '1.5',
    });
    assert.equal(result.code, 1, result.output);
    assert.deepEqual(coordinator.operations, []);
  } finally {
    await closeServer(coordinator.server);
    await rm(directory, { recursive: true, force: true });
  }
});
