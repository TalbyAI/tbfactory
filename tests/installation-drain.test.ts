import assert from 'node:assert/strict';
import { test } from 'node:test';
import { reviewRuntime } from './support/review-runtime';
import { setPolicy } from '../src/server/operator';
import { serviceUser } from '../src/server/review-configuration';
import { ingestObservation, putSource } from '../src/server/observations';
import { delivery, observation, sourceInput } from './support/observations';
import { mkdir, writeFile } from 'node:fs/promises';
import { join } from 'node:path';

async function waitFor(condition: () => boolean, message: string, timeout = 15000) {
  const deadline = Date.now() + timeout;
  while (Date.now() < deadline) {
    if (condition()) return;
    await new Promise((resolve) => setTimeout(resolve, 25));
  }
  throw Error(message);
}

test('worker dispatch pause drains active AI work naturally and holds queued work until resumed', async () => {
  const runtime = await reviewRuntime();
  try {
    runtime.behavior('delay', 700);
    const first = await runtime.createItem('backup-drain-active');
    const second = await runtime.createItem('backup-drain-queued');
    await runtime.startWorker();
    const requestReview = (path: string, operationId: string) =>
      runtime.f.request(`${path}/transition-requests`, {
        operationId,
        transition: 'request-review',
        expectedState: 'registered',
        version: 3,
        inputs: { reviewBrief: 'Check the retained repository inputs' },
      });

    await requestReview(first, 'backup-drain-first');
    await waitFor(() => runtime.requests.length > 0, 'First AI request did not start');
    const pause = runtime.pauseWorker();
    const drain = await pause;
    assert.equal(drain.active, 0);
    assert.equal(drain.tick, false);
    await runtime.wait(first, 'waiting-review');

    const callsAtPause = runtime.requests.length;
    await requestReview(second, 'backup-drain-second');
    await new Promise((resolve) => setTimeout(resolve, 500));
    assert.equal(runtime.requests.length, callsAtPause);

    await runtime.resumeWorker();
    await runtime.wait(second, 'waiting-review');
    assert.ok(runtime.requests.length > callsAtPause);
  } finally {
    await runtime.close();
  }
});

test('restore activation skips old provider observations and accepts new observations', async () => {
  const runtime = await reviewRuntime();
  try {
    for (const activity of ['transition.request-review', 'review.generate', 'repository.read'])
      await setPolicy(runtime.f.store, {
        organization: 'alpha',
        user: serviceUser('alpha'),
        activity,
        scope: 'organization',
        scopeId: 'alpha',
        effect: 'allow',
      });
    await runtime.f.request('/api/organizations/alpha/work-item-types', {
      operationId: 'restore-hold-select',
      type: 'pull-request-review',
      version: 3,
      enabled: true,
    });
    const source = sourceInput('github', 'alpha', 'restore-hold-source');
    await putSource(runtime.f.store, runtime.secrets, source);
    const oldPayload = observation('github', 'restore-hold-old-event', 44) as any;
    oldPayload.pull_request.head.sha = runtime.head;
    oldPayload.pull_request.base.sha = runtime.target;
    const old: any = await ingestObservation(
      runtime.f.store,
      runtime.secrets,
      delivery(source, oldPayload, 'restore-hold-old-event'),
      'alpha',
      source.source,
    );
    const activatedAt = Date.now();
    await mkdir(runtime.env.FACTORY_WORKER_DIRECTORY!, { recursive: true });
    await writeFile(
      join(runtime.env.FACTORY_WORKER_DIRECTORY!, 'restore-hold.json'),
      JSON.stringify({
        format: 1,
        bundle: 'test-restore-point',
        createdAt: activatedAt,
        activatedAt,
        runs: {},
      }),
    );
    runtime.behavior('delay');
    await runtime.startWorker();
    const itemPath = `/api/organizations/alpha/work-items/${old.workItemId}`;
    await new Promise((resolve) => setTimeout(resolve, 500));
    assert.deepEqual((await runtime.f.request(`${itemPath}/reviews`)).body.runs, []);
    assert.equal(runtime.requests.length, 0);

    const newPayload = observation('github', 'restore-hold-new-event', 44) as any;
    newPayload.pull_request.head.sha = runtime.head;
    newPayload.pull_request.base.sha = runtime.target;
    await ingestObservation(
      runtime.f.store,
      runtime.secrets,
      delivery(source, newPayload, 'restore-hold-new-event'),
      'alpha',
      source.source,
    );
    const resumed = await runtime.wait(itemPath, 'waiting-inputs');
    assert.equal(resumed.runs.length, 1);
    assert.equal(resumed.runs[0].workflow, 'review-intake-v1');
    assert.equal(runtime.requests.length, 0);
  } finally {
    await runtime.close();
  }
});
