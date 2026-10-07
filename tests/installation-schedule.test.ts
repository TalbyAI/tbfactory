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
  backup: { state?: string; overdue: boolean; startedAt?: number; completedAt?: number };
  drill: { state?: string; overdue: boolean; startedAt?: number; completedAt?: number };
};

async function startCoordinator(
  recovery: string,
  installation: string,
  status: InstallationStatus,
  onOperation?: (command: string) => void | boolean,
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
      if (request.command !== 'status') {
        operations.push(request.command);
        const accepted = onOperation?.(request.command) !== false;
        if (!accepted) {
          socket.end(`${JSON.stringify({ ok: false, error: 'Controlled operation failure' })}\n`);
          return;
        }
      }
      if (request.command === 'status')
        socket.end(`${JSON.stringify({ ok: true, value: status })}\n`);
      else socket.end(`${JSON.stringify({ ok: true, value: { completed: request.command } })}\n`);
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
