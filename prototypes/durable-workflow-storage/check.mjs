import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { resolve, join } from 'node:path';
import { randomUUID } from 'node:crypto';
import { setTimeout as delay } from 'node:timers/promises';

const startedAt = new Date();
assert.equal(process.version, 'v24.14.1', 'Use the pinned Node.js version in .node-version');
const session = randomUUID();
const data = resolve('.data', session);
mkdirSync(data, { recursive: true });
mkdirSync('evidence', { recursive: true });
const report = { startedAt: startedAt.toISOString(), session, node: process.version,
  dependencies: JSON.parse(readFileSync('package.json', 'utf8')).dependencies,
  npm: process.env.npm_config_user_agent,
  checks: [], observations: [], limitations: [
    'Simulated append-only effects; no exactly-once claim for production provider APIs.',
    'Resume after acknowledged suspension only; interrupted in-flight Activities remain a separate design.',
    'Concurrent runs use different Work Items; same-Work-Item ownership is not implemented here.'
  ] };
const compose = ['compose', '--project-name', `tf-storage-${session}`, '-f', 'compose.yaml'];
let surrealUrl;

function command(binary, args, timeout = 60000) {
  return new Promise((resolveResult, reject) => {
    const child = spawn(binary, args, { windowsHide: true });
    let stdout = '', stderr = '';
    const timer = setTimeout(() => child.kill('SIGKILL'), timeout);
    child.stdout.on('data', (chunk) => stdout += chunk);
    child.stderr.on('data', (chunk) => stderr += chunk);
    child.on('error', reject);
    child.on('close', (code) => {
      clearTimeout(timer);
      report.observations.push({ command: [binary, ...args], code, stdout, stderr });
      code === 0 ? resolveResult(stdout.trim()) : reject(new Error(`${binary} exited ${code}: ${stderr}`));
    });
  });
}

function worker(provider, action, shape, runId, workItemId) {
  return new Promise((resolveResult, reject) => {
    const child = spawn(process.execPath, ['worker.mjs', provider, action, shape, runId, workItemId], {
      windowsHide: true, stdio: ['ignore', 'pipe', 'pipe', 'ipc'],
      env: { ...process.env, PROBE_DATA: join(data, provider), SURREAL_URL: surrealUrl }
    });
    let message, stdout = '', stderr = '', killed = false;
    const timer = setTimeout(() => { child.kill('SIGKILL'); }, 60000);
    child.stdout.on('data', (chunk) => stdout += chunk);
    child.stderr.on('data', (chunk) => stderr += chunk);
    child.on('error', reject);
    child.on('message', (value) => {
      message = value;
      if (action === 'start') killed = child.kill('SIGKILL');
    });
    child.on('close', (code, signal) => {
      clearTimeout(timer);
      report.observations.push({ ...message, provider, action, shape, runId, code, signal, killed, stdout, stderr });
      if (!message || (action === 'start' ? !killed : code !== 0))
        reject(new Error(`${provider}/${action}/${shape} failed (${code}): ${stderr}`));
      else resolveResult(message);
    });
  });
}

function effects(provider, runId) {
  return readFileSync(join(data, provider, 'effects', `${runId}.jsonl`), 'utf8').trim()
    .split('\n').map((line) => JSON.parse(line));
}

function checkOutputs(result, shape, workItemId) {
  assert.deepEqual(result.steps.prepare.output, { workItemId, values: ['prepared'] });
  if (shape === 'parallel') for (const id of ['left', 'right'])
    assert.deepEqual(result.steps[id].output, { workItemId, values: ['prepared', id] });
}

async function cycle(provider, shape, restartDatabase = false) {
  const runId = randomUUID(), workItemId = `work-item-${randomUUID()}`;
  const expectedSteps = shape === 'parallel' ? ['prepare', 'left', 'right'] : ['prepare'];
  const started = await worker(provider, 'start', shape, runId, workItemId);
  assert.equal(started.result.status, 'suspended');
  const beforeEffects = effects(provider, runId);
  assert.deepEqual(beforeEffects.map((entry) => entry.step).sort(), [...expectedSteps].sort());
  if (restartDatabase) {
    const id = await command('docker', [...compose, 'ps', '-q', 'surreal']);
    const before = await command('docker', ['inspect', '--format', '{{.State.StartedAt}}', id]);
    await command('docker', [...compose, 'restart', 'surreal']);
    // Docker can assign a new ephemeral host port when the container restarts.
    surrealUrl = `ws://${await command('docker', [...compose, 'port', 'surreal', '8000'])}`;
    await ready();
    const after = await command('docker', ['inspect', '--format', '{{.State.StartedAt}}', id]);
    assert.notEqual(after, before);
  }
  const inspected = await worker(provider, 'inspect', shape, runId, workItemId);
  assert.notEqual(inspected.pid, started.pid);
  assert.equal(inspected.result.runId, runId);
  assert.equal(inspected.result.status, 'suspended');
  checkOutputs(inspected.result, shape, workItemId);
  const resumed = await worker(provider, 'resume', shape, runId, workItemId);
  assert.notEqual(resumed.pid, started.pid);
  assert.equal(resumed.result.status, 'success');
  assert.deepEqual(resumed.result.result, { workItemId,
    values: shape === 'parallel' ? ['prepared', 'left', 'right'] : ['prepared'], approved: true });
  const finished = await worker(provider, 'inspect', shape, runId, workItemId);
  assert.equal(finished.result.status, 'success');
  checkOutputs(finished.result, shape, workItemId);
  const afterEffects = effects(provider, runId);
  assert.deepEqual(afterEffects.map((entry) => entry.step).sort(), [...expectedSteps, 'publish'].sort());
  assert(afterEffects.every((entry) => entry.workItemId === workItemId && entry.runId === runId));
  report.observations.push({ provider, runId, workItemId, beforeEffects, afterEffects });
}

async function check(provider, name, run) {
  try { await run(); report.checks.push({ provider, name, passed: true }); }
  catch (error) { report.checks.push({ provider, name, passed: false, error: error.stack }); }
  console.log(JSON.stringify(report.checks.at(-1)));
}

async function ready() {
  const deadline = performance.now() + 10000;
  while (performance.now() < deadline) {
    const remaining = Math.ceil(deadline - performance.now());
    if (remaining <= 0) break;
    try {
      if ((await fetch(surrealUrl.replace('ws:', 'http:') + '/health', {
        signal: AbortSignal.timeout(Math.min(1000, remaining))
      })).ok) return;
    }
    catch { /* Container may still be starting. */ }
    await delay(Math.max(0, Math.min(100, deadline - performance.now())));
  }
  throw new Error('SurrealDB did not become healthy within 10 seconds');
}

try {
  await command('docker', [...compose, 'up', '-d']);
  const port = await command('docker', [...compose, 'port', 'surreal', '8000']);
  surrealUrl = `ws://${port}`;
  await ready();
  await command('docker', [...compose, 'exec', '-T', 'surreal', '/surreal', 'version']);
  for (const provider of ['surreal', 'libsql']) {
    await check(provider, 'initialize', () => worker(provider, 'init', 'serial', randomUUID(), 'initialization'));
    await check(provider, 'process restart and human resume', () => cycle(provider, 'serial'));
    if (provider === 'surreal')
      await check(provider, 'database restart and human resume', () => cycle(provider, 'serial', true));
    await check(provider, 'parallel outputs retained over process restart (10 runs)', async () => {
      for (let i = 0; i < 10; i++) await cycle(provider, 'parallel');
    });
    await check(provider, 'four concurrent processes with distinct Work Items', async () => {
      const results = await Promise.allSettled(Array.from({ length: 4 }, () => cycle(provider, 'parallel')));
      assert(results.every((result) => result.status === 'fulfilled'),
        JSON.stringify(results.map((result) => result.status === 'rejected' ? result.reason.stack : 'passed')));
    });
    await check(provider, 'public concurrent step updates visible after reload', async () => {
      const runId = randomUUID(), workItemId = `work-item-${randomUUID()}`;
      const updated = await worker(provider, 'updates', 'parallel', runId, workItemId);
      assert(updated.result.updates.every((update) => update.status === 'fulfilled'),
        JSON.stringify(updated.result.updates));
      const inspected = await worker(provider, 'inspect', 'parallel', runId, workItemId);
      for (const id of ['left', 'right']) assert.deepEqual(inspected.result.steps[id].output,
        { workItemId, values: ['prepared', `updated-${id}`] });
    });
  }
} catch (error) {
  report.setupError = error.stack;
} finally {
  try { await command('docker', [...compose, 'down', '--volumes']); }
  catch (error) { report.cleanupError = error.stack; }
  report.finishedAt = new Date().toISOString();
  report.elapsedSeconds = (Date.now() - startedAt.getTime()) / 1000;
  const passes = (provider) => report.checks.some((check) => check.provider === provider)
    && report.checks.filter((check) => check.provider === provider).every((check) => check.passed);
  report.selectedProvider = passes('surreal') ? 'surreal' : passes('libsql') ? 'libsql' : null;
  const path = join('evidence', `${session}.json`);
  writeFileSync(path, JSON.stringify(report) + '\n');
  console.log(`Evidence: ${path}`);
  console.log(`Selected Workflow storage: ${report.selectedProvider ?? 'none validated'}`);
  if (report.setupError || report.cleanupError || !report.selectedProvider) process.exitCode = 1;
}
