import nodemailer from 'nodemailer';
import { execFile } from 'node:child_process';
import { mkdir, readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { promisify } from 'node:util';
import { atomicWrite } from '../src/server/durable-files';

const execute = promisify(execFile);
const dayMs = 24 * 60 * 60 * 1000;
const defaultRetryMs = 5 * 60 * 1000;

type Status = {
  coordinator: 'running' | 'stopped';
  backup: { state?: string; overdue: boolean; startedAt?: number; completedAt?: number };
  drill: { state?: string; overdue: boolean; startedAt?: number; completedAt?: number };
};

type IncidentRecord = {
  firstSeenAt: number;
  lastAttemptAt?: number;
  deliveredAt?: number;
  resolvedAt?: number;
  deliveryFailures?: number;
};

type JobReceipt = {
  state: 'running' | 'succeeded' | 'failed';
  startedAt: number;
  completedAt?: number;
};

type SchedulerState = {
  format: 1;
  lastCheckedAt?: number;
  jobs?: Partial<Record<'backup' | 'drill', JobReceipt>>;
  incidents: Record<string, IncidentRecord>;
};

type Incident = { key: string; title: string; observedAt?: number };

const incidentTitles: Record<string, string> = {
  'backup-failed': 'Backup failed',
  'backup-overdue': 'Backup recovery point is overdue',
  'drill-failed': 'Restore drill failed',
  'drill-overdue': 'Restore drill is overdue',
  'coordinator-unavailable': 'Installation coordinator is unavailable',
  'status-command-failed': 'Installation status could not be read',
  'status-invalid-json': 'Installation status response is invalid',
};

function required(name: string) {
  const value = process.env[name];
  if (!value) throw new Error(`Missing scheduler setting: ${name}`);
  return value;
}

function recoveryDirectory() {
  return required('FACTORY_RECOVERY_DIRECTORY');
}

function statePath() {
  return join(recoveryDirectory(), 'installation-scheduler-state.json');
}

async function readState(): Promise<SchedulerState> {
  try {
    const value = JSON.parse(await readFile(statePath(), 'utf8')) as SchedulerState;
    if (value.format !== 1 || !value.incidents || typeof value.incidents !== 'object')
      throw new Error('invalid');
    return value;
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') return { format: 1, incidents: {} };
    throw new Error('Scheduler state is invalid');
  }
}

async function writeState(state: SchedulerState) {
  await mkdir(recoveryDirectory(), { recursive: true, mode: 0o700 });
  await atomicWrite(statePath(), JSON.stringify(state, null, 2));
}

async function readInstallationStatus(): Promise<{ status: Status } | { incident: Incident }> {
  let stdout = '';
  try {
    const result = await execute(
      process.execPath,
      ['--import', 'tsx', 'scripts/installation.ts', 'status'],
      { cwd: process.cwd(), env: process.env, timeout: 5_000, maxBuffer: 1_000_000 },
    );
    stdout = result.stdout;
  } catch (error) {
    stdout = String((error as { stdout?: string }).stdout ?? '');
    if (!stdout.trim())
      return {
        incident: { key: 'status-command-failed', title: incidentTitles['status-command-failed'] },
      };
  }

  let value: unknown;
  try {
    value = JSON.parse(stdout);
  } catch {
    return {
      incident: { key: 'status-invalid-json', title: incidentTitles['status-invalid-json'] },
    };
  }
  if (
    !value ||
    typeof value !== 'object' ||
    !['running', 'stopped'].includes(String((value as any).coordinator)) ||
    typeof (value as any).backup?.overdue !== 'boolean' ||
    typeof (value as any).drill?.overdue !== 'boolean'
  )
    return {
      incident: { key: 'status-invalid-json', title: incidentTitles['status-invalid-json'] },
    };

  return { status: value as Status };
}

function incidentsFor(status: Status, now: number, state?: SchedulerState): Incident[] {
  const incidents: Incident[] = [];
  if (status.coordinator === 'stopped')
    incidents.push({
      key: 'coordinator-unavailable',
      title: incidentTitles['coordinator-unavailable'],
      observedAt: now,
    });
  if (latestJobState(status.backup, state?.jobs?.backup) === 'failed')
    incidents.push({
      key: 'backup-failed',
      title: incidentTitles['backup-failed'],
      observedAt: status.backup.completedAt ?? status.backup.startedAt,
    });
  if (status.backup.overdue)
    incidents.push({ key: 'backup-overdue', title: incidentTitles['backup-overdue'] });
  if (latestJobState(status.drill, state?.jobs?.drill) === 'failed')
    incidents.push({
      key: 'drill-failed',
      title: incidentTitles['drill-failed'],
      observedAt: status.drill.completedAt ?? status.drill.startedAt,
    });
  if (status.drill.overdue)
    incidents.push({ key: 'drill-overdue', title: incidentTitles['drill-overdue'] });
  return incidents;
}

function hasJobReceipt(job: 'backup' | 'drill', status: Status, state: SchedulerState) {
  const current = status[job];
  return Boolean(current.state || current.startedAt || current.completedAt || state.jobs?.[job]);
}

function mergeIncidents(...groups: Incident[][]) {
  return [...new Map(groups.flat().map((incident) => [incident.key, incident])).values()];
}

function intervalSetting(name: string, fallback: number) {
  const value = Number(process.env[name] ?? fallback);
  if (!Number.isSafeInteger(value) || value < 1)
    throw new Error(`${name} must be a positive number of milliseconds`);
  return value;
}

function drillDueAt(completedAt: number) {
  const date = new Date(completedAt);
  const year = date.getUTCFullYear();
  const month = date.getUTCMonth() + 1;
  const lastDay = new Date(Date.UTC(year, month + 1, 0)).getUTCDate();
  return Date.UTC(
    year,
    month,
    Math.min(date.getUTCDate(), lastDay),
    date.getUTCHours(),
    date.getUTCMinutes(),
    date.getUTCSeconds(),
    date.getUTCMilliseconds(),
  );
}

function latestAttempt(status: Status['backup'] | Status['drill'], receipt?: JobReceipt) {
  return (
    Math.max(
      status.startedAt ?? 0,
      status.completedAt ?? 0,
      receipt?.startedAt ?? 0,
      receipt?.completedAt ?? 0,
    ) || undefined
  );
}

function latestSuccessAt(status: Status['backup'] | Status['drill'], receipt?: JobReceipt) {
  const statusSuccess = status.state === 'succeeded' ? status.completedAt : undefined;
  const receiptSuccess = receipt?.state === 'succeeded' ? receipt.completedAt : undefined;
  return Math.max(statusSuccess ?? 0, receiptSuccess ?? 0) || undefined;
}

function latestJobState(status: Status['backup'] | Status['drill'], receipt?: JobReceipt) {
  const statusAt = status.completedAt ?? status.startedAt ?? 0;
  const receiptAt = receipt?.completedAt ?? receipt?.startedAt ?? 0;
  return receiptAt > statusAt ? receipt?.state : (status.state ?? receipt?.state);
}

function jobIsDue(job: 'backup' | 'drill', status: Status, state: SchedulerState, now: number) {
  const receipt = state.jobs?.[job];
  const current = status[job];
  const lastAttempt = latestAttempt(current, receipt);
  const latestState = latestJobState(current, receipt);
  const retryMs = intervalSetting('FACTORY_SCHEDULE_BACKUP_INTERVAL_MS', dayMs);
  if (latestState === 'running' || latestState === 'failed')
    return lastAttempt === undefined || now - lastAttempt >= retryMs;
  if (job === 'backup') return lastAttempt === undefined || now - lastAttempt >= retryMs;

  const recoveryPoint = latestSuccessAt(status.backup, state.jobs?.backup);
  if (recoveryPoint === undefined) return false;
  const drillSuccess = latestSuccessAt(status.drill, receipt);
  if (drillSuccess !== undefined) {
    const override = process.env.FACTORY_SCHEDULE_DRILL_INTERVAL_MS;
    const dueAt =
      override === undefined
        ? drillDueAt(drillSuccess)
        : drillSuccess + intervalSetting('FACTORY_SCHEDULE_DRILL_INTERVAL_MS', dayMs);
    return now >= dueAt;
  }
  if (lastAttempt !== undefined) return now - lastAttempt >= retryMs;
  return true;
}

async function runInstallationCommand(command: 'backup' | 'drill') {
  const timeout = command === 'backup' ? 315_000 : 605_000;
  await execute(process.execPath, ['--import', 'tsx', 'scripts/installation.ts', command], {
    cwd: process.cwd(),
    env: process.env,
    timeout,
    maxBuffer: 1_000_000,
  });
}

async function runJob(command: 'backup' | 'drill') {
  const startedAt = Date.now();
  const state = await readState();
  state.jobs ??= {};
  state.jobs[command] = { state: 'running', startedAt };
  await writeState(state);
  try {
    await runInstallationCommand(command);
    const completedAt = Date.now();
    const next = await readState();
    next.jobs ??= {};
    next.jobs[command] = { state: 'succeeded', startedAt, completedAt };
    await writeState(next);
    return { job: command, state: 'succeeded', completedAt };
  } catch {
    const completedAt = Date.now();
    const next = await readState();
    next.jobs ??= {};
    next.jobs[command] = { state: 'failed', startedAt, completedAt };
    await writeState(next);
    throw new Error(`Scheduled ${command} failed`);
  }
}

async function cycle() {
  let observation = await readInstallationStatus();
  if ('incident' in observation) {
    await updateAlerts([observation.incident]);
    return;
  }
  if (observation.status.coordinator === 'stopped') {
    await updateAlerts([
      {
        key: 'coordinator-unavailable',
        title: incidentTitles['coordinator-unavailable'],
      },
    ]);
    return;
  }

  let state = await readState();
  const initialStatus = observation.status;
  const priorIncidents = incidentsFor(initialStatus, Date.now(), state).filter((incident) => {
    if (incident.key === 'coordinator-unavailable') return true;
    const job = incident.key.startsWith('backup-') ? 'backup' : 'drill';
    return hasJobReceipt(job, initialStatus, state);
  });
  if (jobIsDue('backup', initialStatus, state, Date.now())) {
    try {
      await runJob('backup');
    } catch {
      // The public installation status and durable scheduler receipt record the failure.
    }
    observation = await readInstallationStatus();
    if ('incident' in observation) {
      await updateAlerts(mergeIncidents(priorIncidents, [observation.incident]));
      return;
    }
    if (observation.status.coordinator === 'stopped') {
      await updateAlerts(
        mergeIncidents(priorIncidents, [
          { key: 'coordinator-unavailable', title: incidentTitles['coordinator-unavailable'] },
        ]),
      );
      return;
    }
  }

  state = await readState();
  if (jobIsDue('drill', observation.status, state, Date.now())) {
    try {
      await runJob('drill');
    } catch {
      // The public installation status and durable scheduler receipt record the failure.
    }
  }

  observation = await readInstallationStatus();
  if ('incident' in observation) {
    await updateAlerts(mergeIncidents(priorIncidents, [observation.incident]));
    return;
  }
  const schedulerState = await readState();
  const incidents = incidentsFor(observation.status, Date.now(), schedulerState);
  await updateAlerts(mergeIncidents(priorIncidents, incidents));
}

async function runLoop() {
  const pollMs = intervalSetting('FACTORY_SCHEDULE_POLL_INTERVAL_MS', 60_000);
  let stopping = false;
  let wake = () => {};
  const stop = () => {
    stopping = true;
    wake();
  };
  process.once('SIGINT', stop);
  process.once('SIGTERM', stop);
  try {
    while (!stopping) {
      try {
        await cycle();
      } catch {
        console.error('Installation scheduler cycle failed');
      }
      if (!stopping)
        await new Promise<void>((resolve) => {
          const timer = setTimeout(resolve, pollMs);
          wake = () => {
            clearTimeout(timer);
            resolve();
          };
        });
    }
  } finally {
    process.off('SIGINT', stop);
    process.off('SIGTERM', stop);
  }
}

function smtpSettings() {
  const port = Number(required('FACTORY_SMTP_PORT'));
  if (!Number.isInteger(port) || port < 1 || port > 65535)
    throw new Error('FACTORY_SMTP_PORT must be a valid TCP port');
  const from = required('FACTORY_SMTP_FROM');
  const to = required('FACTORY_SMTP_TO');
  if (/[\r\n]/.test(from) || /[\r\n]/.test(to))
    throw new Error('SMTP addresses cannot contain line breaks');
  return { host: required('FACTORY_SMTP_HOST'), port, from, to };
}

async function deliver(incident: Incident, record: IncidentRecord) {
  const { host, port, from, to } = smtpSettings();
  const transporter = nodemailer.createTransport({
    host,
    port,
    secure: false,
    ignoreTLS: true,
    connectionTimeout: 10_000,
    greetingTimeout: 10_000,
    socketTimeout: 10_000,
  });
  try {
    await transporter.sendMail({
      from,
      to,
      subject: `[TBFactory] ${incident.title}`,
      text: [
        'TBFactory installation alert',
        '',
        `Incident: ${incident.title}`,
        `First observed: ${new Date(record.firstSeenAt).toISOString()}`,
        '',
        'Inspect current installation health with:',
        'node --import tsx scripts/installation.ts status',
      ].join('\n'),
    });
  } finally {
    transporter.close();
  }
}

function retryInterval() {
  const value = Number(process.env.FACTORY_SMTP_RETRY_MS ?? defaultRetryMs);
  if (!Number.isFinite(value) || value < 0)
    throw new Error('FACTORY_SMTP_RETRY_MS must be nonnegative');
  return value;
}

async function updateAlerts(incidents: Incident[], now = Date.now()) {
  const state = await readState();
  const active = new Set(incidents.map((incident) => incident.key));
  for (const [key, record] of Object.entries(state.incidents)) {
    if (!active.has(key) && !record.resolvedAt) record.resolvedAt = now;
  }

  const activeKeys = new Set(incidents.map((incident) => incident.key));
  for (const incident of incidents) {
    const existing = state.incidents[incident.key];
    const record: IncidentRecord =
      existing && (!existing.resolvedAt || !existing.deliveredAt)
        ? existing
        : { firstSeenAt: incident.observedAt ?? now };
    record.resolvedAt = undefined;
    state.incidents[incident.key] = record;
  }

  const pending = Object.entries(state.incidents)
    .filter(([key, record]) => record.resolvedAt && !record.deliveredAt && !activeKeys.has(key))
    .flatMap(([key, record]) =>
      incidentTitles[key]
        ? [{ key, title: incidentTitles[key], observedAt: record.firstSeenAt }]
        : [],
    );
  const attempted: string[] = [];
  for (const incident of mergeIncidents(incidents, pending)) {
    const record = state.incidents[incident.key];
    const due =
      !record.deliveredAt &&
      (record.lastAttemptAt === undefined || now - record.lastAttemptAt >= retryInterval());
    state.incidents[incident.key] = record;
    if (!due) continue;
    record.lastAttemptAt = now;
    attempted.push(incident.key);
    await writeState(state);
    try {
      await deliver(incident, record);
      record.deliveredAt = Date.now();
    } catch {
      record.deliveryFailures = (record.deliveryFailures ?? 0) + 1;
      console.error(`SMTP delivery for ${incident.key} failed; retry is pending.`);
    }
    await writeState(state);
  }
  state.lastCheckedAt = now;
  await writeState(state);
  return { active: incidents.map((incident) => incident.key), attempted };
}

async function checkOnce() {
  const observation = await readInstallationStatus();
  const state = await readState();
  const incidents =
    'incident' in observation
      ? [observation.incident]
      : incidentsFor(observation.status, Date.now(), state);
  const result = await updateAlerts(incidents);
  return {
    coordinator: 'status' in observation ? observation.status.coordinator : 'error',
    ...result,
  };
}

async function main() {
  const [command] = process.argv.slice(2);
  if (command === 'check') {
    console.log(JSON.stringify(await checkOnce()));
    return;
  }
  if (command === 'backup' || command === 'drill') {
    console.log(JSON.stringify(await runJob(command)));
    return;
  }
  if (command === 'run') return runLoop();
  if (command === 'run-once') return cycle();
  throw new Error('Usage: installation-schedule check|backup|drill|run-once|run');
}

main().catch(() => {
  console.error('Installation scheduler command failed');
  process.exitCode = 1;
});
