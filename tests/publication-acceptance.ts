import assert from 'node:assert/strict';
import { execFileSync, spawn, type ChildProcess } from 'node:child_process';
import { writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { publicationRuntime } from './support/publication-runtime';
import { selfHostedProvider, BrowserClient } from './support/provider';
import { provision } from '../src/server/provision';
import { activities } from '../src/server/contracts';

const f = await publicationRuntime('github');
const provider = await selfHostedProvider();
const origin = 'http://localhost:3000';
await provision(f.r.f.store, {
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
  ...f.r.env,
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
  web = spawn(process.execPath, ['.output/server/index.mjs'], {
    env,
    windowsHide: true,
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  web.stdout!.on('data', (b) => {
    output += b;
  });
  web.stderr!.on('data', (b) => {
    output += b;
  });
  for (let attempt = 0; attempt < 100; attempt++) {
    if (
      await fetch(origin)
        .then((r) => r.ok)
        .catch(() => false)
    )
      return;
    await new Promise((resolve) => setTimeout(resolve, 100));
  }
  throw Error(`Built application did not start: ${output.slice(-1500)}`);
}
async function stopWeb() {
  if (web && web.exitCode === null && web.signalCode === null) {
    const stopped = new Promise<void>((resolve) => web!.once('exit', () => resolve()));
    web.kill();
    await stopped;
  }
  web = undefined;
}
try {
  await startWeb();
  const browser = new BrowserClient();
  await browser.login(origin, 'alice');
  f.behavior('lost');
  assert.equal(
    (
      await browser.json(origin, `${f.path}/review-publications`, {
        operationId: 'built-publication',
        run: f.run.id,
      })
    ).status,
    200,
  );
  await f.r.startWorker();
  await f.wait('uncertain');
  assert.equal(f.effects.length, 1);
  f.behavior('success');
  assert.equal(
    (
      await browser.json(origin, `${f.path}/publication-reconciliation`, {
        operationId: 'built-evidence',
        run: f.run.id,
      })
    ).status,
    200,
  );
  const uncertain = await f.wait('uncertain'),
    evidence = uncertain.publications[0].evidence;
  assert.ok(evidence);
  await stopWeb();
  await f.r.stopWorker();
  execFileSync('docker', ['restart', 'tbfactory-acceptance-db'], {
    windowsHide: true,
    stdio: 'pipe',
  });
  await startWeb();
  await f.r.startWorker();
  const restored = await browser.json(origin, `${f.path}/reviews`);
  assert.equal(restored.status, 200);
  assert.equal(restored.body.publications[0].evidence, evidence);
  assert.equal(restored.body.publications[0].status, 'uncertain');
  assert.equal(f.posts.length, 1);
  if (process.argv.includes('--hold')) {
    console.log(
      JSON.stringify({
        ready: true,
        origin,
        path: f.path,
        report: f.report.id,
        run: f.run.id,
        directory: f.r.directory,
      }),
    );
    await new Promise<void>((resolve) => {
      process.once('SIGINT', resolve);
      process.once('SIGTERM', resolve);
      process.on('message', (message) => {
        if (message === 'stop') resolve();
      });
    });
  } else {
    assert.equal(
      (
        await browser.json(origin, `${f.path}/publication-confirmation`, {
          operationId: 'built-confirmation',
          run: f.run.id,
          evidence,
          resolution: 'completed',
          reason: 'Verified persisted provider comment and stopped attempt',
          confirmedStopped: true,
        })
      ).status,
      200,
    );
    const completed = await browser.json(origin, f.path);
    assert.equal(completed.body.activeRun, undefined);
    assert.equal(completed.body.state, 'registered');
    assert.equal(f.posts.length, 1);
    const artifact = await browser.request(`${origin}${f.path}/reviews/${f.report.id}/artifact`);
    assert.equal(artifact.status, 200);
    const anonymous = await fetch(`${origin}${f.path}/reviews/${f.report.id}/artifact`);
    assert.equal(anonymous.status, 401);
    const evidenceFile = join(f.r.directory, 'publication-acceptance.json');
    await writeFile(
      evidenceFile,
      JSON.stringify(
        {
          passed: true,
          checks: [
            'built HTTP publication and provider lost response',
            'durable provider evidence',
            'web/database/worker restart without replay',
            'authorized User recovery and unchanged Factory state',
            'private authenticated Artifact',
          ],
          providerEffects: f.effects,
          history: (await browser.json(origin, `${f.path}/reviews`)).body.publicationHistory,
        },
        null,
        2,
      ),
    );
    console.log(JSON.stringify({ passed: true, evidenceFile }));
  }
} finally {
  await stopWeb();
  await provider.close();
  await f.close();
}
