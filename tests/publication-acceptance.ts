import assert from 'node:assert/strict';
import { execFileSync, spawn, type ChildProcess } from 'node:child_process';
import { writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { publicationRuntime } from './support/publication-runtime';
import { selfHostedProvider, BrowserClient } from './support/provider';
import { provision } from '../src/server/provision';
import { activities } from '../src/server/contracts';
import { setPolicy } from '../src/server/operator';

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
function currentPublication(view: any) {
  const run = view.runs.find((row: any) => row.id === f.run.id);
  return view.publications.find((row: any) => row.id === run.publication);
}
async function browserCheckpoint(stage: string) {
  if (!process.argv.includes(`--hold-${stage}`)) return;
  console.log(
    JSON.stringify({ ready: true, stage, origin, path: f.path, directory: f.r.directory }),
  );
  process.stdin.resume();
  await new Promise<void>((resolve) => process.stdin.once('data', () => resolve()));
  process.stdin.pause();
}
try {
  await startWeb();
  const browser = new BrowserClient();
  await browser.login(origin, 'alice');
  await setPolicy(f.r.f.store, {
    organization: 'alpha',
    user: f.r.f.alice.user.id,
    activity: 'review.publish',
    scope: 'organization',
    scopeId: 'alpha',
    effect: 'human',
  });
  const credential = await f.r.f.request('/api/organizations/alpha/api-credentials', {
    operationId: 'built-waiting-credential',
    label: 'Waiting publication requester',
    activities: ['work-item.read', 'artifact.read', 'review.publish'],
    expiresAt: Date.now() + 600000,
  });
  assert.equal(credential.status, 200);
  const waiting = await browser.json(
    origin,
    `${f.path}/review-publications`,
    {
      operationId: 'built-waiting-publication',
      run: f.run.id,
    },
    credential.body.token,
  );
  assert.equal(waiting.status, 200);
  assert.equal(waiting.body.publication.status, 'waiting-approval');
  assert.equal(
    (
      await f.r.f.request(
        `/api/organizations/alpha/api-credentials/${credential.body.credential.id}/revoke`,
        { operationId: 'built-revoke-waiting-credential' },
      )
    ).status,
    200,
  );
  assert.equal(
    (
      await browser.json(origin, `${f.path}/publication-approval`, {
        operationId: 'built-invalidated-approval',
        run: f.run.id,
        publication: waiting.body.publication.id,
      })
    ).status,
    403,
  );
  f.behavior('evidence-error');
  await f.r.startWorker();
  await browserCheckpoint('approval');
  // The optional checkpoint also permits exercising the same recovery in the UI.
  let stoppedWait = currentPublication(await f.view());
  if (stoppedWait.status === 'waiting-approval') {
    assert.equal(
      (
        await browser.json(origin, `${f.path}/publication-reconciliation`, {
          operationId: 'built-waiting-reconciliation',
          run: f.run.id,
          publication: stoppedWait.id,
        })
      ).status,
      200,
    );
    stoppedWait = currentPublication(await f.wait('uncertain'));
  }
  if (stoppedWait.status === 'uncertain') {
    assert.equal(
      (
        await browser.json(origin, `${f.path}/publication-confirmation`, {
          operationId: 'built-waiting-confirmation',
          run: f.run.id,
          publication: stoppedWait.id,
          evidence: stoppedWait.evidence,
          resolution: 'not-published',
          reason: 'Verified no authorized POST after requester credential revocation',
          confirmedStopped: true,
        })
      ).status,
      200,
    );
  }
  stoppedWait = currentPublication(await f.view());
  assert.equal(stoppedWait.status, 'not-published');
  const waitEvidence = (await f.view()).publicationHistory.find(
    (row: any) => row.id === stoppedWait.evidence,
  );
  assert.equal(waitEvidence.payload.noDispatch, true);
  assert.equal(waitEvidence.payload.unavailable, true);
  assert.equal((await browser.json(origin, f.path)).body.activeRun, undefined);
  assert.equal(f.posts.length, 0);
  await f.r.stopWorker();
  const renewed = await browser.json(origin, `${f.path}/review-decisions`, {
    operationId: 'built-decision-after-wait',
    run: f.run.id,
    reportVersion: f.report.id,
    replaces: f.decision.id,
    reviewed: true,
    findings: f.report.findings.map((finding: any, i: number) =>
      i === 0
        ? { finding: finding.id, decision: 'confirmed' }
        : { finding: finding.id, decision: 'rejected', reason: 'PRIVATE REJECTION REASON' },
    ),
  });
  assert.equal(renewed.status, 200);
  f.behavior('reject');
  assert.equal(
    (
      await browser.json(origin, `${f.path}/review-publications`, {
        operationId: 'built-initial-publication',
        run: f.run.id,
      })
    ).status,
    200,
  );
  await f.r.startWorker();
  await f.wait('failed');
  f.behavior('evidence-error');
  assert.equal(
    (
      await browser.json(origin, `${f.path}/publication-reconciliation`, {
        operationId: 'built-unavailable-evidence',
        run: f.run.id,
      })
    ).status,
    200,
  );
  const unavailable = currentPublication(await f.wait('uncertain'));
  for (const resolution of ['completed', 'retry', 'not-published']) {
    assert.equal(
      (
        await browser.json(origin, `${f.path}/publication-confirmation`, {
          operationId: `built-insufficient-${resolution}`,
          run: f.run.id,
          publication: unavailable.id,
          evidence: unavailable.evidence,
          resolution,
          reason: 'Cannot resolve without sufficient evidence',
          confirmedStopped: true,
        })
      ).status,
      409,
    );
  }
  await browserCheckpoint('insufficient');
  f.behavior('success');
  assert.equal(
    (
      await browser.json(origin, `${f.path}/publication-reconciliation`, {
        operationId: 'built-absence-evidence',
        run: f.run.id,
        publication: unavailable.id,
      })
    ).status,
    200,
  );
  const absent = currentPublication(await f.wait('uncertain'));
  assert.equal(
    (
      await browser.json(origin, `${f.path}/publication-confirmation`, {
        operationId: 'built-nonpublication',
        run: f.run.id,
        publication: absent.id,
        evidence: absent.evidence,
        resolution: 'not-published',
        reason: 'Verified complete listing and stopped rejected request',
        confirmedStopped: true,
      })
    ).status,
    200,
  );
  await f.r.stopWorker();
  await browserCheckpoint('correction');
  const correction = await browser.json(origin, `${f.path}/review-decisions`, {
    operationId: 'built-corrected-decision',
    run: f.run.id,
    reportVersion: f.report.id,
    replaces: renewed.body.fact.id,
    reviewed: true,
    findings: f.report.findings.map((finding: any) => ({
      finding: finding.id,
      decision: 'confirmed',
    })),
  });
  assert.equal(correction.status, 200);
  assert.equal(f.posts.length, 1);
  f.behavior('lost');
  const publication = await browser.json(origin, `${f.path}/review-publications`, {
    operationId: 'built-publication',
    run: f.run.id,
    decision: correction.body.fact.id,
  });
  assert.equal(publication.status, 200);
  assert.notEqual(publication.body.publication.id, absent.id);
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
    evidence = currentPublication(uncertain).evidence;
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
  assert.equal(currentPublication(restored.body).evidence, evidence);
  assert.equal(currentPublication(restored.body).status, 'uncertain');
  assert.equal(restored.body.publications.length, 3);
  assert.equal(
    restored.body.publications.find((row: any) => row.id === stoppedWait.id).status,
    'not-published',
  );
  assert.equal(
    restored.body.publications.find((row: any) => row.id === stoppedWait.id).evidence,
    stoppedWait.evidence,
  );
  assert.deepEqual(
    restored.body.publicationHistory.find((row: any) => row.id === waitEvidence.id),
    waitEvidence,
  );
  assert.equal(
    restored.body.publications.find((row: any) => row.id === absent.id).status,
    'not-published',
  );
  assert.equal(f.posts.length, 2);
  if (process.argv.includes('--hold-finalization')) {
    await f.r.stopWorker();
    const current = currentPublication(await f.view());
    const resolved = await browser.json(origin, `${f.path}/publication-confirmation`, {
      operationId: 'built-finalization-publication-confirmation',
      run: f.run.id,
      publication: current.id,
      evidence,
      resolution: 'completed',
      reason: 'Verified the persisted provider comment after restart',
      confirmedStopped: true,
    });
    assert.equal(resolved.status, 200);
    assert.equal(resolved.body.publication.status, 'completed');
    const prepared = await browser.json(origin, `${f.path}/transition-requests`, {
      operationId: 'built-finalization-prepare-review',
      transition: 'prepare-review',
      expectedState: 'registered',
      version: 4,
      inputs: { reviewBrief: 'Prepare the verified report for Factory finalization' },
    });
    assert.equal(prepared.status, 200);
    assert.equal(prepared.body.workItem.state, 'ready-for-review');
    const item = await browser.json(origin, f.path);
    assert.equal(item.body.activeRun, undefined);
    const board = await browser.json(
      origin,
      '/api/organizations/alpha/board?type=pull-request-review',
    );
    const action = board.body.items
      .find((candidate: any) => candidate.id === f.path.split('/').at(-1))
      .transitions.find((transition: any) => transition.id === 'finalize-review');
    assert.equal(action.available, true, JSON.stringify(action));
    assert.equal(action.currentReportVersion, f.report.id);
    const finalizationEvidence = {
      ready: true,
      stage: 'finalization',
      origin,
      path: f.path,
      report: f.report.id,
      decision: currentPublication(await f.view()).decision,
      publication: resolved.body.publication.id,
      transition: action,
      directory: f.r.directory,
    };
    const evidenceFile = join(f.r.directory, 'finalization-acceptance.json');
    await writeFile(evidenceFile, JSON.stringify(finalizationEvidence, null, 2));
    console.log(JSON.stringify({ ...finalizationEvidence, evidenceFile }));
    process.stdin.resume();
    await new Promise<void>((resolve) => {
      let buffered = '';
      let resuming = false;
      const finish = () => {
        process.stdin.off('data', onData);
        process.stdin.pause();
        resolve();
      };
      const onData = (chunk: Buffer | string) => {
        buffered += chunk.toString();
        const lines = buffered.split(/\r?\n/);
        buffered = lines.pop() ?? '';
        for (const line of lines.map((entry) => entry.trim())) {
          if (line === 'stop') finish();
          if (line === 'resume-worker' && !resuming) {
            resuming = true;
            void f.r
              .startWorker()
              .then(async () => {
                const reviews = await browser.json(origin, `${f.path}/reviews`);
                const run = reviews.body.runs.find(
                  (candidate: any) => candidate.workflow === 'review-finalization-v1',
                );
                console.log(JSON.stringify({ resumed: true, run: run?.id, status: run?.status }));
              })
              .catch((error) =>
                console.log(JSON.stringify({ resumed: false, error: (error as Error).message })),
              )
              .finally(() => {
                resuming = false;
              });
          }
        }
      };
      process.once('SIGINT', finish);
      process.once('SIGTERM', finish);
      process.on('message', (message) => {
        if (message === 'stop') finish();
      });
      process.stdin.on('data', onData);
    });
  } else if (process.argv.includes('--hold')) {
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
      process.stdin.resume();
      process.stdin.once('data', () => {
        process.stdin.pause();
        resolve();
      });
    });
  } else {
    assert.equal(
      (
        await browser.json(origin, `${f.path}/publication-confirmation`, {
          operationId: 'built-confirmation',
          run: f.run.id,
          publication: publication.body.publication.id,
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
    assert.equal(f.posts.length, 2);
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
            'Approval wait with revoked requester recovered without a POST',
            'built HTTP rejects insufficient completion, retry and nonpublication',
            'evidence-backed nonpublication and explicit corrected decision',
            'new decision-bound Activity preserves prior publication history',
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
