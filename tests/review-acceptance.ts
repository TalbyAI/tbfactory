import assert from 'node:assert/strict';
import { spawn, execFileSync, type ChildProcess } from 'node:child_process';
import { writeFile, access } from 'node:fs/promises';
import { join } from 'node:path';
import { reviewRuntime } from './support/review-runtime';
import { selfHostedProvider, BrowserClient } from './support/provider';
import { provision } from '../src/server/provision';
import { activities } from '../src/server/contracts';

const r = await reviewRuntime();
const provider = await selfHostedProvider();
const origin = 'http://localhost:3000';
await provision(r.f.store, {
  organization: { id: 'alpha', name: 'Alpha' },
  projects: [],
  members: [
    {
      issuer: provider.issuer,
      subject: 'alice',
      grants: activities.map((activity) => ({
        activity,
        scope: 'organization',
        scopeId: 'alpha',
        effect: 'allow',
      })),
    },
  ],
});
const env = {
  ...r.env,
  HOST: '127.0.0.1',
  PORT: '3000',
  FACTORY_ORIGIN: origin,
  FACTORY_OIDC_ISSUER: provider.issuer,
  FACTORY_OIDC_CLIENT_ID: 'factory',
  FACTORY_OIDC_CLIENT_SECRET: 'acceptance-provider-secret',
  FACTORY_TRUST_VERIFIED_EMAIL: 'true',
};
let web: ChildProcess | undefined;
let output = '';
async function startWeb() {
  web = spawn(process.execPath, ['.output/server/index.mjs'], { env, windowsHide: true });
  web.stdout!.on('data', (b) => (output += b));
  web.stderr!.on('data', (b) => (output += b));
  for (let i = 0; i < 100; i++) {
    try {
      if ((await fetch(origin)).ok) return;
    } catch {}
    if (web.exitCode !== null) break;
    await new Promise((r) => setTimeout(r, 100));
  }
  throw Error(`Web failed: ${output.slice(-2000)}`);
}
async function stopWeb() {
  if (web && web.exitCode === null) {
    web.kill();
    await new Promise<void>((resolve) => web!.once('exit', () => resolve()));
  }
  web = undefined;
}
try {
  await startWeb();
  await r.startWorker();
  const browser = new BrowserClient();
  await browser.login(origin, 'alice');
  const base = '/api/organizations/alpha';
  await browser.json(origin, `${base}/work-item-types`, {
    operationId: 'select',
    type: 'pull-request-review',
    version: 3,
    enabled: true,
  });
  const created = await browser.json(origin, `${base}/work-items`, {
    operationId: 'create',
    title: 'Private report acceptance',
    project: 'alpha-project',
    repository: 'alpha-repo',
    type: 'pull-request-review',
  });
  assert.equal(created.status, 200);
  const id = created.body.workItem.id,
    path = `${base}/work-items/${id}`;
  await browser.json(origin, `${path}/transition-requests`, {
    operationId: 'start',
    transition: 'request-review',
    expectedState: 'registered',
    version: 3,
    inputs: { reviewBrief: 'Explore repository differences and unchanged configuration' },
  });
  await r.wait(path, 'waiting-inputs');
  await r.stopWorker();
  await stopWeb();
  execFileSync('docker', ['restart', 'tbfactory-acceptance-db'], {
    windowsHide: true,
    stdio: 'pipe',
  });
  await startWeb();
  await r.startWorker();
  const intake = await browser.json(origin, `${path}/reviews`);
  assert.equal(intake.body.runs[0].status, 'waiting-inputs');
  await browser.json(origin, `${path}/review-facts`, {
    operationId: 'inputs',
    fields: {
      sourceBranch: 'feature',
      targetBranch: 'main',
      sourceCommit: r.head,
      targetCommit: r.target,
    },
  });
  const view = await r.wait(path, 'waiting-review');
  const report = view.reports[0];
  const count = r.requests.length;
  await r.stopWorker();
  await stopWeb();
  execFileSync('docker', ['restart', 'tbfactory-acceptance-db'], {
    windowsHide: true,
    stdio: 'pipe',
  });
  await startWeb();
  await r.startWorker();
  const recovered = await browser.json(origin, `${path}/reviews`);
  assert.equal(recovered.body.reports[0].id, report.id);
  assert.equal(r.requests.length, count);
  const artifact = await browser.request(`${origin}${path}/reviews/${report.id}/artifact`);
  assert.equal(artifact.status, 200);
  assert.match(await artifact.text(), /unchanged\.ts/);
  const evidence = {
    origin,
    url: `${origin}/?organization=alpha&workItem=${id}`,
    workItem: id,
    report: report.id,
    providerCalls: count,
    checks: [
      'Production HTTP intake and Fact resumption',
      'Web, worker and SurrealDB restarts preserve the same suspended run',
      'Completed AI calls are not repeated',
      'Private Markdown Artifact uses authenticated access',
      'Report generation preserves Factory state',
    ],
    directory: r.directory,
  };
  await writeFile(join(r.directory, 'acceptance.json'), JSON.stringify(evidence, null, 2));
  console.log(JSON.stringify(evidence));
  if (process.argv.includes('--hold'))
    await new Promise<void>((resolve) => {
      const finish = () => {
        clearInterval(timer);
        resolve();
      };
      const timer = setInterval(() => {
        void access(join(r.directory, 'stop'))
          .then(finish)
          .catch(() => {});
      }, 250);
      process.once('SIGINT', finish);
      process.once('SIGTERM', finish);
      process.on('message', (message) => {
        if (message === 'stop') finish();
      });
    });
} finally {
  await r.close();
  await stopWeb();
  await provider.close();
}
