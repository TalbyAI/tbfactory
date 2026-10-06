import { execFileSync } from 'node:child_process';
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { handleHttp } from '../src/server/http.ts';
import { putSource } from '../src/server/observations.ts';
import { serviceUser } from '../src/server/review-configuration.ts';
import { setPolicy } from '../src/server/operator.ts';
import { reviewRuntime } from './support/review-runtime.ts';
import { delivery, observation, sourceInput } from './support/observations.ts';

const installationDatabase =
  process.env.FACTORY_TEST_DATABASE_CONTAINER ?? 'tbfactory-acceptance-db';
const delay = (milliseconds: number) => new Promise((resolve) => setTimeout(resolve, milliseconds));

async function eventually<T>(
  description: string,
  read: () => Promise<T>,
  satisfied: (value: T) => boolean,
  timeout = 30000,
) {
  const deadline = Date.now() + timeout;
  let latest: T | undefined;
  while (Date.now() < deadline) {
    try {
      latest = await read();
      if (satisfied(latest)) return latest;
    } catch {
      // The process or database may still be starting.
    }
    await delay(50);
  }
  throw Error(`${description} did not become ready: ${JSON.stringify(latest)}`);
}

function reviewRun(view: any) {
  return view.runs.find((run: any) => run.workflow === 'review-v1');
}

async function receive(r: Awaited<ReturnType<typeof reviewRuntime>>, request: Request) {
  const response = await handleHttp(request, {
    auth: r.f.auth,
    factory: r.f.factory,
    origin: 'http://localhost:3000',
    allowLoopbackHttp: true,
    secrets: r.secrets,
  });
  return { status: response.status, body: (await response.json()) as any };
}

async function restartOwnedDatabase(r: Awaited<ReturnType<typeof reviewRuntime>>) {
  const databaseUrl = new URL(r.f.config.url);
  const portMappings = JSON.parse(
    execFileSync(
      'docker',
      ['inspect', '--format', '{{json .NetworkSettings.Ports}}', installationDatabase],
      { encoding: 'utf8', windowsHide: true },
    ),
  )['8000/tcp'] as { HostIp: string; HostPort: string }[] | undefined;
  assert.ok(
    portMappings?.some(
      (mapping) =>
        Number(mapping.HostPort) === Number(databaseUrl.port) &&
        (mapping.HostIp === databaseUrl.hostname ||
          mapping.HostIp === '0.0.0.0' ||
          mapping.HostIp === '::'),
    ),
    `${installationDatabase} does not map SurrealDB to ${databaseUrl.origin}`,
  );
  const inspected = execFileSync(
    'docker',
    ['inspect', '--format', '{{.Name}}', installationDatabase],
    {
      encoding: 'utf8',
      windowsHide: true,
    },
  ).trim();
  assert.equal(inspected, `/${installationDatabase}`);
  execFileSync('docker', ['restart', installationDatabase], {
    encoding: 'utf8',
    windowsHide: true,
    stdio: 'pipe',
  });
  await eventually(
    'persistent Factory database',
    () => r.f.request('/api/organizations/alpha/work-items'),
    (response) => response.status === 200,
  );
}

for (const provider of ['github', 'azure-devops'] as const) {
  test(`${provider}: authenticated observations remain append-only around a real worker and database restart`, {
    timeout: 180000,
  }, async () => {
    const r = await reviewRuntime();
    try {
      r.behavior('delay', 5000);
      await r.configure({ rules: { ...r.configInput.rules, enabled: true } });
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
      assert.equal(
        (
          await r.f.request('/api/organizations/alpha/work-item-types', {
            operationId: `select-${provider}`,
            type: 'pull-request-review',
            version: 3,
            enabled: true,
          })
        ).status,
        200,
      );

      const source = sourceInput(provider, 'alpha', `${provider}-installation`);
      await putSource(r.f.store, r.secrets, source);
      const firstEvent =
        provider === 'github'
          ? 'installation-observations-initial'
          : '44444444-4444-4444-8444-444444444444';
      const firstPayload = observation(provider, firstEvent, 42) as any;
      if (provider === 'github') {
        firstPayload.pull_request.head.sha = r.head;
        firstPayload.pull_request.head.ref = 'feature';
        firstPayload.pull_request.base.sha = r.target;
        firstPayload.pull_request.base.ref = 'main';
      } else {
        firstPayload.resource.lastMergeSourceCommit.commitId = r.head;
        firstPayload.resource.lastMergeTargetCommit.commitId = r.target;
        firstPayload.resource.sourceRefName = 'refs/heads/feature';
        firstPayload.resource.targetRefName = 'refs/heads/main';
      }

      await r.startWorker();
      const imported = await receive(r, delivery(source, firstPayload, firstEvent));
      assert.equal(imported.status, 200, JSON.stringify(imported));
      const path = `/api/organizations/alpha/work-items/${imported.body.workItemId}`;
      const firstFact = await eventually(
        'provider-created Fact',
        async () => (await r.f.request(`${path}/facts`)).body.items,
        (facts) => facts.some((fact: any) => fact.id === imported.body.factId),
      ).then((facts) => facts.find((fact: any) => fact.id === imported.body.factId));
      assert.equal(firstFact.kind, 'external.observation');

      const running = await eventually(
        'real Review Workflow Run and held AI request',
        async () => (await r.f.request(`${path}/reviews`)).body,
        (view) => reviewRun(view)?.status === 'running' && r.requests.length === 1,
      );
      const runningReview = reviewRun(running);
      const runningItem = (await r.f.request(path)).body;
      assert.equal(runningReview.id, runningItem.activeRun.id);
      assert.equal(runningItem.state, 'registered');
      assert.equal(runningItem.version, 3);
      assert.equal(
        (
          await r.f.request(`${path}/transition-requests`, {
            operationId: `blocked-during-running-${provider}`,
            transition: 'request-review',
            expectedState: 'registered',
            version: 3,
            inputs: { reviewBrief: 'Do not overlap the owning run' },
          })
        ).status,
        409,
      );

      const replayWhileRunning = await receive(r, delivery(source, firstPayload, firstEvent));
      assert.equal(replayWhileRunning.status, 200);
      assert.deepEqual(replayWhileRunning.body, imported.body);
      const factsWhileRunning = (await r.f.request(`${path}/facts`)).body.items;
      assert.equal(
        factsWhileRunning.filter((fact: any) => fact.kind === 'external.observation').length,
        1,
      );
      assert.deepEqual(
        factsWhileRunning.find((fact: any) => fact.id === firstFact.id),
        firstFact,
      );
      assert.equal((await r.f.request(path)).body.activeRun.id, runningReview.id);

      const suspended = await r.wait(path, 'waiting-review');
      const reportId = suspended.reports[0].id;
      const originalReview = reviewRun(suspended);
      assert.equal(originalReview.id, runningReview.id);
      assert.equal(originalReview.report, reportId);
      assert.equal(originalReview.calls, 1);
      assert.equal(
        suspended.runStatus.find((entry: any) => entry.run === runningReview.id).current,
        true,
      );
      assert.equal(
        suspended.reportStatus.find((entry: any) => entry.report === reportId).current,
        true,
      );
      const suspendedItem = (await r.f.request(path)).body;
      assert.equal(suspendedItem.activeRun.id, runningReview.id);
      assert.equal(suspendedItem.state, runningItem.state);
      assert.equal(suspendedItem.version, runningItem.version);
      const callsBeforeRestart = r.requests.length;

      await r.stopWorker();
      await restartOwnedDatabase(r);
      await r.startWorker();
      const recovered = await eventually(
        'same suspended Review Workflow Run after restart',
        async () => (await r.f.request(`${path}/reviews`)).body,
        (view) =>
          reviewRun(view)?.id === runningReview.id && reviewRun(view)?.status === 'waiting-review',
      );
      assert.equal(recovered.reports[0].id, reportId);
      assert.equal((await r.f.request(path)).body.activeRun.id, runningReview.id);
      assert.equal(r.requests.length, callsBeforeRestart);

      const duplicateAfterRestart = await receive(r, delivery(source, firstPayload, firstEvent));
      assert.equal(duplicateAfterRestart.status, 200);
      assert.deepEqual(duplicateAfterRestart.body, imported.body);
      assert.deepEqual(
        (await r.f.request(`${path}/facts`)).body.items.find(
          (fact: any) => fact.id === firstFact.id,
        ),
        firstFact,
      );

      const laterEvent =
        provider === 'github'
          ? 'installation-observations-after-restart'
          : '55555555-5555-4555-8555-555555555555';
      const laterPayload = structuredClone(firstPayload);
      if (provider === 'github') {
        laterPayload.action = 'synchronize';
        laterPayload.pull_request.head.sha = 'c'.repeat(40);
      } else {
        laterPayload.id = laterEvent;
        laterPayload.eventType = 'git.pullrequest.updated';
        laterPayload.resource.lastMergeSourceCommit.commitId = 'c'.repeat(40);
      }
      const later = await receive(r, delivery(source, laterPayload, laterEvent));
      assert.equal(later.status, 200, JSON.stringify(later));
      assert.equal(later.body.workItemId, imported.body.workItemId);
      const duplicateLater = await receive(r, delivery(source, laterPayload, laterEvent));
      assert.equal(duplicateLater.status, 200);
      assert.deepEqual(duplicateLater.body, later.body);

      const afterObservation = (await r.f.request(`${path}/reviews`)).body;
      const currentReview = reviewRun(afterObservation);
      assert.equal(currentReview.id, runningReview.id);
      assert.equal(currentReview.report, reportId);
      assert.ok(['waiting-review', 'waiting-revalidation'].includes(currentReview.status));
      assert.equal(afterObservation.reports[0].id, reportId);
      assert.equal(afterObservation.currentInputs.sourceCommit, 'c'.repeat(40));
      assert.equal(afterObservation.reports[0].relevantInputs.checkout.sourceCommit, r.head);
      assert.equal(
        afterObservation.runStatus.find((entry: any) => entry.run === runningReview.id).current,
        false,
      );
      assert.equal(
        afterObservation.reportStatus.find((entry: any) => entry.report === reportId).current,
        false,
      );
      assert.equal(r.requests.length, callsBeforeRestart);
      const finalItem = (await r.f.request(path)).body;
      assert.equal(finalItem.activeRun.id, runningReview.id);
      assert.equal(finalItem.state, runningItem.state);
      assert.equal(finalItem.version, runningItem.version);
      assert.equal(
        (
          await r.f.request(`${path}/transition-requests`, {
            operationId: `blocked-after-restart-${provider}`,
            transition: 'request-review',
            expectedState: 'registered',
            version: 3,
            inputs: { reviewBrief: 'The recovered run still owns this item' },
          })
        ).status,
        409,
      );
      const finalFacts = (await r.f.request(`${path}/facts`)).body.items;
      const externalFacts = finalFacts.filter((fact: any) => fact.kind === 'external.observation');
      assert.equal(externalFacts.length, 2);
      assert.deepEqual(
        externalFacts.find((fact: any) => fact.id === firstFact.id),
        firstFact,
      );
      assert.equal(
        externalFacts.find((fact: any) => fact.id === later.body.factId).payload.head,
        'c'.repeat(40),
      );
    } finally {
      await r.close();
    }
  });
}
