import { test } from 'node:test';
import assert from 'node:assert/strict';
import { fixture } from './support/factory.ts';
import { reviewRuntime } from './support/review-runtime.ts';
import { setPolicy } from '../src/server/operator.ts';
import { serviceUser } from '../src/server/review-configuration.ts';
import { recoverWorkerLock, recoverStoppedRun } from '../src/server/review-worker.ts';
import { join } from 'node:path';
import { execFileSync, spawn } from 'node:child_process';
import { writeFile, readFile, unlink } from 'node:fs/promises';
import { putSource } from '../src/server/observations.ts';
import { sourceInput, observation, delivery } from './support/observations.ts';
import { handleHttp } from '../src/server/http.ts';

test('Concurrent review requests retain exclusive intake ownership while new Facts remain admissible', async () => {
  const f = await fixture();
  try {
    await f.bootstrap('alpha');
    const base = '/api/organizations/alpha';
    const selection = await f.request(`${base}/work-item-types`, {
      operationId: 'select-review',
      type: 'pull-request-review',
      version: 3,
      enabled: true,
    });
    assert.equal(selection.status, 200);
    const created = await f.request(`${base}/work-items`, {
      operationId: 'create-review',
      project: 'alpha-project',
      repository: 'alpha-repo',
      title: 'Durable private review',
      type: 'pull-request-review',
    });
    const path = `${base}/work-items/${created.body.workItem.id}`;
    const results = await Promise.all(
      ['first', 'second'].map((operationId) =>
        f.request(`${path}/transition-requests`, {
          operationId,
          transition: 'request-review',
          version: 3,
          expectedState: 'registered',
          inputs: { reviewBrief: 'Inspect security' },
        }),
      ),
    );
    assert.deepEqual(results.map((r) => r.status).sort(), [200, 409]);
    const run = results.find((r) => r.status === 200)!.body.workflowRun;
    assert.equal(run.workflow, 'review-intake-v1');
    assert.equal((await f.request(path)).body.state, 'registered');
    assert.equal(
      (
        await f.request(`${path}/review-facts`, {
          operationId: 'facts',
          fields: { sourceBranch: 'feature', targetBranch: 'main' },
        })
      ).status,
      200,
    );
    const view = await f.request(`${path}/reviews`);
    assert.equal(view.status, 200);
    assert.equal(view.body.runs[0].id, run.id);
    assert.deepEqual(view.body.notifications[0].fields, ['sourceCommit', 'targetCommit']);
    assert.equal(
      (
        await f.request(`${path}/transition-requests`, {
          operationId: 'blocked-direct',
          transition: 'prepare-review',
          version: 3,
          expectedState: 'registered',
          inputs: { reviewBrief: 'Cannot bypass ownership' },
        })
      ).status,
      409,
    );
  } finally {
    await f.close();
  }
});

const startReview = (
  r: Awaited<ReturnType<typeof reviewRuntime>>,
  path: string,
  operationId = 'start',
) =>
  r.f.request(`${path}/transition-requests`, {
    operationId,
    transition: 'request-review',
    version: 3,
    expectedState: 'registered',
    inputs: { reviewBrief: 'Inspect repository code' },
  });

test('Imported pull requests keep exclusive incomplete intake across worker/database restart and accept observations during human review', async () => {
  const r = await reviewRuntime();
  try {
    const service = serviceUser('alpha');
    for (const activity of ['transition.request-review', 'review.generate', 'repository.read'])
      await setPolicy(r.f.store, {
        organization: 'alpha',
        user: service,
        activity,
        scope: 'organization',
        scopeId: 'alpha',
        effect: 'allow',
      });
    await r.f.request('/api/organizations/alpha/work-item-types', {
      operationId: 'select',
      type: 'pull-request-review',
      version: 3,
      enabled: true,
    });
    const source = sourceInput('github');
    await putSource(r.f.store, r.secrets, source);
    const payload = observation('github') as any;
    payload.pull_request.head.sha = r.head;
    payload.pull_request.base.sha = r.target;
    const ingest = async (payload: any, eventId: string) => {
      const response = await handleHttp(delivery(source, payload, eventId), {
        auth: r.f.auth,
        factory: r.f.factory,
        origin: 'http://localhost:3000',
        allowLoopbackHttp: true,
        secrets: r.secrets,
      });
      assert.equal(response.status, 200);
      return response.json() as Promise<any>;
    };
    const imported = await ingest(payload, 'initial-import');
    const path = `/api/organizations/alpha/work-items/${imported.workItemId}`;
    await r.startWorker();
    const intake = await r.wait(path, 'waiting-inputs');
    assert.deepEqual(intake.notifications[0].fields, ['sourceBranch', 'targetBranch']);
    assert.equal(r.requests.length, 0);
    await r.stopWorker();
    execFileSync('docker', ['restart', 'tbfactory-acceptance-db'], {
      windowsHide: true,
      stdio: 'pipe',
    });
    await r.startWorker();
    const resumed = await r.wait(path, 'waiting-inputs');
    assert.equal(resumed.runs[0].id, intake.runs[0].id);
    await r.f.request(`${path}/review-facts`, {
      operationId: 'branch-facts',
      fields: { sourceBranch: 'feature', targetBranch: 'main' },
    });
    const deadline = Date.now() + 10000;
    let notification: any;
    do {
      notification = (await r.f.request(`${path}/reviews`)).body;
      if (notification.notifications[0].fields.includes('Automatic review eligibility')) break;
      await new Promise((res) => setTimeout(res, 100));
    } while (Date.now() < deadline);
    assert.equal(notification.runs.length, 1);
    assert.equal(r.requests.length, 0);
    assert.deepEqual(notification.notifications[0].fields, ['Automatic review eligibility']);
    await r.configure({ rules: { ...r.configInput.rules, enabled: true } });
    const review = await r.wait(path, 'waiting-review');
    const calls = r.requests.length;
    payload.action = 'synchronize';
    payload.pull_request.head.sha = 'c'.repeat(40);
    await ingest(payload, 'later-commit');
    const current = (await r.f.request(`${path}/reviews`)).body;
    assert.equal(current.currentInputs.sourceCommit, 'c'.repeat(40));
    assert.equal(current.reports[0].relevantInputs.checkout.sourceCommit, r.head);
    assert.equal(current.runs.length, 2);
    assert.equal(r.requests.length, calls);
    await r.stopWorker();
    execFileSync('docker', ['restart', 'tbfactory-acceptance-db'], {
      windowsHide: true,
      stdio: 'pipe',
    });
    await r.startWorker();
    const recovered = await r.wait(path, 'waiting-review');
    assert.equal(recovered.reports[0].id, review.reports[0].id);
    assert.equal(r.requests.length, calls);
  } finally {
    await r.close();
  }
});

test('Generation Approval, current revocation and empty-report human waits remain distinct', async () => {
  const r = await reviewRuntime();
  try {
    r.behavior('empty');
    const path = await r.createItem();
    await setPolicy(r.f.store, {
      organization: 'alpha',
      user: r.f.alice.user.id,
      activity: 'review.generate',
      scope: 'organization',
      scopeId: 'alpha',
      effect: 'human',
    });
    await r.startWorker();
    await startReview(r, path);
    const pending = await r.wait(path, 'waiting-approval');
    assert.equal(r.requests.length, 0);
    const run = pending.runs.find((run: any) => run.status === 'waiting-approval');
    const credential = await r.f.request('/api/organizations/alpha/api-credentials', {
      operationId: 'key',
      label: 'Automation',
      activities: ['work-item.read', 'approval.review-generate'],
      expiresAt: Date.now() + 3600000,
    });
    assert.equal(
      (
        await r.f.request(
          `${path}/review-approval`,
          { operationId: 'api-approval', run: run.id },
          credential.body.token,
          true,
        )
      ).status,
      403,
    );
    assert.equal(
      (await r.f.request(`${path}/review-approval`, { operationId: 'human-approval', run: run.id }))
        .status,
      200,
    );
    const view = await r.wait(path, 'waiting-review');
    assert.deepEqual(view.reports[0].findings, []);
    assert.equal((await r.f.request(path)).body.activeRun.status, 'waiting-review');
    const second = await r.createItem('revoked');
    await startReview(r, second, 'second');
    const secondPending = await r.wait(second, 'waiting-approval');
    await r.configure({ enabled: false });
    await r.f.request(`${second}/review-approval`, {
      operationId: 'approved-before-recheck',
      run: secondPending.runs.find((run: any) => run.status === 'waiting-approval').id,
    });
    await r.wait(second, 'stopped');
    assert.equal(r.requests.length, 1);
  } finally {
    await r.close();
  }
});

test('Shared call limits and unknown AI outcomes never expose incomplete reports', async () => {
  const r = await reviewRuntime();
  try {
    await r.configure({ limits: { ...r.configInput.limits, calls: 1 } });
    const path = await r.createItem('limited');
    await r.startWorker();
    await startReview(r, path);
    const limited = await r.wait(path, 'stopped');
    assert.equal(limited.reports.length, 0);
    assert.equal(limited.consumption.length, 1);
    assert.equal(limited.consumption[0].outcome, 'completed');
    assert.equal(limited.runs.find((run: any) => run.workflow === 'review-v1').calls, 1);
    await r.configure({});
    r.behavior('disconnect');
    const unknown = await r.createItem('unknown');
    await startReview(r, unknown, 'unknown');
    const stopped = await r.wait(unknown, 'stopped');
    assert.equal(stopped.reports.length, 0);
    assert.equal(stopped.consumption[0].outcome, 'uncertain');
    assert.equal(stopped.consumption[0].cost, null);
    const requests = r.requests.length;
    await r.stopWorker();
    await r.startWorker();
    await r.wait(unknown, 'stopped');
    assert.equal(r.requests.length, requests);
  } finally {
    await r.close();
  }
});

test('AI and execution time limits stop visibly and subordinate calls share cumulative consumption', async () => {
  const r = await reviewRuntime();
  try {
    r.behavior('delay', 300);
    await r.configure({ limits: { ...r.configInput.limits, aiMs: 100 } });
    const ai = await r.createItem('ai-time');
    await r.startWorker();
    await startReview(r, ai);
    const stopped = await r.wait(ai, 'stopped');
    assert.equal(stopped.reports.length, 0);
    assert.equal(stopped.consumption[0].outcome, 'uncertain');
    await r.configure({ limits: { ...r.configInput.limits, executionMs: 5 } });
    const execution = await r.createItem('execution-time');
    await startReview(r, execution, 'execution');
    const failed = await r.wait(execution, 'stopped');
    assert.equal(failed.reports.length, 0);
    assert.equal(failed.consumption.length, 0);
    r.behavior('delegate', 100);
    await r.configure({ limits: { ...r.configInput.limits } });
    const delegated = await r.createItem('delegated');
    await startReview(r, delegated, 'delegate');
    const view = await r.wait(delegated, 'waiting-review');
    assert.equal(view.consumption.filter((c: any) => c.agent.startsWith('subordinate')).length, 2);
    assert.equal(view.runs.find((run: any) => run.workflow === 'review-v1').calls, 4);
    assert.ok(view.consumption.every((c: any) => c.elapsed >= 90));
  } finally {
    await r.close();
  }
});

test('Automatic Facts use Service Identity and explicit supersession preserves immutable reports', async () => {
  const r = await reviewRuntime();
  try {
    r.behavior('report');
    await r.configure({
      mode: 'platform',
      entitled: true,
      rules: { ...r.configInput.rules, enabled: true },
    });
    const service = serviceUser('alpha');
    for (const activity of ['transition.request-review', 'review.generate', 'repository.read'])
      await setPolicy(r.f.store, {
        organization: 'alpha',
        user: service,
        activity,
        scope: 'organization',
        scopeId: 'alpha',
        effect: 'allow',
      });
    const path = await r.createItem('automatic');
    await r.startWorker();
    const first = await r.wait(path, 'waiting-review');
    const firstRun = first.runs.find((run: any) => run.status === 'waiting-review');
    assert.equal(firstRun.identity.kind, 'service');
    assert.equal(firstRun.identity.user, service);
    await r.f.request(`${path}/review-facts`, {
      operationId: 'new-commit-facts',
      fields: { sourceCommit: r.head },
    });
    assert.equal((await r.f.request(`${path}/reviews`)).body.runs.length, 2);
    assert.equal(
      (
        await r.f.request(`${path}/review-supersession`, {
          operationId: 'supersede',
          run: firstRun.id,
        })
      ).status,
      200,
    );
    const deadline = Date.now() + 30000;
    let next: any;
    do {
      next = (await r.f.request(`${path}/reviews`)).body;
      if (next.reports.length === 2) break;
      await new Promise((res) => setTimeout(res, 100));
    } while (Date.now() < deadline);
    assert.equal(next.reports.length, 2);
    const report = next.reports.find((report: any) => report.id !== first.reports[0].id);
    assert.equal(report.findings[0].previousFinding, first.reports[0].findings[0].id);
    assert.equal(report.findings[0].assessment, 'enriched');
    assert.deepEqual(
      next.reports.find((report: any) => report.id === first.reports[0].id),
      first.reports[0],
    );
    assert.equal((await r.f.request(path)).body.state, 'registered');
  } finally {
    await r.close();
  }
});

test('A crashed worker retains ownership until an operator confirms stopped execution without replay', async () => {
  const r = await reviewRuntime();
  try {
    r.behavior('delay', 10000);
    const path = await r.createItem('crash');
    const worker = await r.startWorker();
    await startReview(r, path);
    const deadline = Date.now() + 20000;
    while (!r.requests.length && Date.now() < deadline)
      await new Promise((res) => setTimeout(res, 100));
    assert.equal(r.requests.length, 1);
    const pid = worker.pid!;
    worker.kill();
    await new Promise<void>((res) => worker.once('exit', () => res()));
    assert.ok((await r.f.request(path)).body.activeRun);
    await assert.rejects(r.startWorker(), /already owns database/);
    await writeFile(join(r.directory, 'worker', 'worker.lock'), '{');
    await recoverWorkerLock(r.f.store, join(r.directory, 'worker'), pid);
    const view = (await r.f.request(`${path}/reviews`)).body;
    const run = view.runs.find((run: any) => run.workflow === 'review-v1');
    await recoverStoppedRun(r.f.store, join(r.directory, 'worker'), run.id);
    const recovered = await r.wait(path, 'stopped');
    assert.equal(recovered.consumption[0].outcome, 'uncertain');
    assert.equal((await r.f.request(path)).body.activeRun, undefined);
    await r.startWorker();
    assert.equal(r.requests.length, 1);
  } finally {
    await r.close();
  }
});

test('A separate Mastra worker retains a private version-bound report across human-wait restarts', async () => {
  const r = await reviewRuntime();
  try {
    const path = await r.createItem();
    await r.startWorker();
    assert.equal(
      (
        await r.f.request(`${path}/transition-requests`, {
          operationId: 'start',
          transition: 'request-review',
          version: 3,
          expectedState: 'registered',
          inputs: { reviewBrief: 'Inspect relevant unchanged code' },
        })
      ).status,
      200,
    );
    const view = await r.wait(path, 'waiting-review');
    assert.equal(view.reports.length, 1);
    assert.equal(view.reports[0].findings[0].status, 'proposed');
    assert.equal(view.reports[0].relevantInputs.checkout.sourceCommit, r.head);
    assert.equal(view.reports[0].relevantInputs.checkout.baseline, r.target);
    assert.equal(view.reports[0].findings[0].location.path, 'unchanged.ts');
    assert.equal((await r.f.request(path)).body.state, 'registered');
    assert.equal(view.runs.filter((run: any) => run.workflow === 'review-v1')[0].calls, 2);
    const download = await r.download(`${path}/reviews/${view.reports[0].id}/artifact`);
    assert.equal(download.status, 200);
    assert.match(await download.text(), /unchanged\.ts:1/);
    const bob = await r.f.login('bob');
    assert.equal(
      (await r.download(`${path}/reviews/${view.reports[0].id}/artifact`, bob.token)).status,
      404,
    );
    const before = r.requests.length;
    await r.stopWorker();
    await r.startWorker();
    const recovered = await r.wait(path, 'waiting-review');
    assert.equal(recovered.reports[0].id, view.reports[0].id);
    assert.equal(r.requests.length, before);
  } finally {
    await r.close();
  }
});

test('Installation ownership rejects a second worker even on a different workflow volume', async () => {
  const r = await reviewRuntime();
  try {
    await r.startWorker();
    const other = spawn(process.execPath, ['--import', 'tsx', 'scripts/worker.ts'], {
      env: { ...r.env, FACTORY_WORKER_DIRECTORY: join(r.directory, 'other-worker') },
      windowsHide: true,
      stdio: ['ignore', 'pipe', 'pipe'],
    });
    let output = '';
    other.stderr.on('data', (b) => (output += b));
    const code = await new Promise<number | null>((res) => other.once('exit', res));
    assert.notEqual(code, 0);
    assert.match(output, /Installation worker already owns database/);
    const path = await r.createItem('sole-owner');
    await startReview(r, path);
    const view = await r.wait(path, 'waiting-review');
    assert.equal(view.reports.length, 1);
    assert.equal(r.requests.length, 2);
  } finally {
    await r.close();
  }
});

test('Active calls retain AI endpoint/model/credential configuration when future-run configuration changes', async () => {
  const r = await reviewRuntime();
  try {
    r.behavior('tools', 400);
    const path = await r.createItem('retained-ai');
    await r.startWorker();
    await startReview(r, path);
    const deadline = Date.now() + 20000;
    while (!r.requests.length && Date.now() < deadline)
      await new Promise((res) => setTimeout(res, 50));
    assert.equal(r.requests.length, 1);
    await r.configure({
      key: 'future-key',
      ai: {
        ...r.configInput.ai,
        url: r.configInput.ai.url + '/future',
        model: 'future-model',
        permittedModels: [{ id: 'future-model', tools: true, reasoning: [] }],
      },
    });
    await r.wait(path, 'waiting-review');
    assert.ok(
      r.requests.every(
        (req) => req.key === 'Bearer fixture-ai-key' && req.body.model === 'fixture-model',
      ),
    );
    const next = await r.createItem('future-ai');
    await startReview(r, next, 'future');
    await r.wait(next, 'waiting-review');
    assert.equal(r.requests.at(-1).body.model, 'future-model');
    assert.equal(r.requests.at(-1).key, 'Bearer future-key');
  } finally {
    await r.close();
  }
});

test('Stopped recovery publishes staged output without model replay and fails closed on damaged private content', async () => {
  const r = await reviewRuntime();
  try {
    r.behavior('report');
    const artifactDirectory = join(r.directory, 'artifacts');
    await writeFile(artifactDirectory, 'Unavailable persistent volume');
    const path = await r.createItem('publication-recovery');
    await r.startWorker();
    await startReview(r, path);
    const failed = await r.wait(path, 'recovery-required');
    assert.equal(failed.reports.length, 0);
    assert.equal(r.requests.length, 1);
    assert.ok((await r.f.request(path)).body.activeRun);
    const run = failed.runs.find((run: any) => run.workflow === 'review-v1');
    await r.stopWorker();
    await unlink(artifactDirectory);
    const reconciled = await recoverStoppedRun(
      r.f.store,
      join(r.directory, 'worker'),
      run.id,
      artifactDirectory,
    );
    assert.equal(reconciled.status, 'queued');
    await r.startWorker();
    const view = await r.wait(path, 'waiting-review');
    assert.equal(view.reports.length, 1);
    assert.equal(r.requests.length, 1);
    await r.stopWorker();
    const metadata = await r.f.store.transaction((tx) =>
      tx.get('review_report', view.reports[0].id),
    );
    const file = join(artifactDirectory, (metadata!.data as any).storageKey);
    const original = await readFile(file);
    await writeFile(file, 'Damaged content');
    await r.startWorker();
    await r.wait(path, 'recovery-required');
    assert.ok((await r.f.request(path)).body.activeRun);
    assert.equal((await r.download(`${path}/reviews/${view.reports[0].id}/artifact`)).status, 503);
    await r.stopWorker();
    await assert.rejects(
      recoverStoppedRun(r.f.store, join(r.directory, 'worker'), run.id, artifactDirectory),
      /integrity/,
    );
    await writeFile(file, original);
    await recoverStoppedRun(r.f.store, join(r.directory, 'worker'), run.id, artifactDirectory);
    await r.startWorker();
    const recovered = await r.wait(path, 'waiting-review');
    assert.equal(recovered.reports[0].id, view.reports[0].id);
    assert.equal(r.requests.length, 1);
  } finally {
    await r.close();
  }
});

test('Confirmed-stop recovery reuses completed parent/subordinate results from the pre-staging crash window', async () => {
  const r = await reviewRuntime();
  try {
    r.behavior('delegate');
    const artifacts = join(r.directory, 'artifacts');
    await writeFile(artifacts, 'Unavailable volume');
    const path = await r.createItem('completed-call-recovery');
    await r.startWorker();
    await startReview(r, path);
    const failed = await r.wait(path, 'recovery-required');
    const run = failed.runs.find((run: any) => run.workflow === 'review-v1');
    await r.stopWorker();
    // Restore the durable records that exist just before the validated output is staged.
    await r.f.store.transaction(async (tx) => {
      const row = await tx.get('workflow_run', run.id);
      await tx.put('workflow_run', {
        ...row!,
        data: { ...(row!.data as object), preparedReport: undefined, delegations: 4 },
      });
    });
    await unlink(artifacts);
    await recoverStoppedRun(r.f.store, join(r.directory, 'worker'), run.id, artifacts);
    await r.startWorker();
    const recovered = await r.wait(path, 'waiting-review');
    assert.equal(recovered.reports.length, 1);
    assert.equal(r.requests.length, 4);
    assert.equal(recovered.consumption.length, 4);
  } finally {
    await r.close();
  }
});

test('Confirmed-stop intake recovery keeps exclusive ownership and completes one durable handoff', async () => {
  const r = await reviewRuntime();
  try {
    const path = await r.createItem('intake-recovery');
    await r.configure({ enabled: false });
    await r.startWorker();
    await startReview(r, path);
    const pending = await r.wait(path, 'waiting-inputs');
    const intake = pending.runs[0];
    await r.stopWorker();
    await r.f.store.transaction(async (tx) => {
      const row = await tx.get('workflow_run', intake.id);
      await tx.put('workflow_run', {
        ...row!,
        data: { ...(row!.data as object), status: 'recovery-required' },
      });
    });
    const recovered = await recoverStoppedRun(r.f.store, join(r.directory, 'worker'), intake.id);
    assert.equal(recovered.status, 'queued');
    assert.equal((await r.f.request(path)).body.activeRun.id, intake.id);
    await r.configure({});
    await r.startWorker();
    const view = await r.wait(path, 'waiting-review');
    assert.equal(view.runs.length, 2);
    assert.equal(
      view.runs.find((run: any) => run.workflow === 'review-intake-v1').handoff,
      view.runs.find((run: any) => run.workflow === 'review-v1').id,
    );
    assert.equal(view.reports.length, 1);
  } finally {
    await r.close();
  }
});

test('OpenRouter enforces explicit upstream routing and retains reported cost', async () => {
  const r = await reviewRuntime();
  try {
    r.behavior('report');
    await r.configure({
      ai: {
        ...r.configInput.ai,
        adapter: 'openrouter',
        model: 'openai/fixture-model',
        upstream: 'openai',
        permittedModels: [{ id: 'openai/fixture-model', tools: true, reasoning: ['low'] }],
        reasoningEffort: 'low',
      },
    });
    const path = await r.createItem('openrouter');
    await r.startWorker();
    await startReview(r, path);
    const view = await r.wait(path, 'waiting-review');
    assert.deepEqual(r.requests[0].body.provider, {
      only: ['openai'],
      allow_fallbacks: false,
      require_parameters: true,
    });
    assert.deepEqual(r.requests[0].body.reasoning, { effort: 'low' });
    assert.equal(view.consumption[0].cost, 0.0001);
  } finally {
    await r.close();
  }
});
