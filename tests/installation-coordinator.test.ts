import assert from 'node:assert/strict';
import { spawn, type ChildProcess } from 'node:child_process';
import { createServer } from 'node:net';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { test } from 'node:test';
import { cp, lstat, readFile, readdir, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { KeyRing } from '../src/server/key-ring';
import { OrganizationSecrets } from '../src/server/secrets';
import { connectStore } from '../src/server/store';
import { publicationRuntime } from './support/publication-runtime';

const runFile = promisify(execFile);

async function unusedPort() {
  const server = createServer();
  await new Promise<void>((resolve, reject) => {
    server.once('error', reject);
    server.listen(0, '127.0.0.1', resolve);
  });
  const port = (server.address() as { port: number }).port;
  await new Promise<void>((resolve, reject) =>
    server.close((error) => (error ? reject(error) : resolve())),
  );
  return port;
}

function childExit(child: ChildProcess, timeoutMs: number) {
  if (child.exitCode !== null || child.signalCode !== null)
    return Promise.resolve({ code: child.exitCode, signal: child.signalCode });
  return new Promise<{ code: number | null; signal: NodeJS.Signals | null }>((resolve, reject) => {
    const timer = setTimeout(
      () => reject(new Error('Installation coordinator did not exit')),
      timeoutMs,
    );
    child.once('exit', (code, signal) => {
      clearTimeout(timer);
      resolve({ code, signal });
    });
  });
}

async function cli(env: NodeJS.ProcessEnv, ...args: string[]) {
  const timeout = ['backup', 'restore', 'drill'].includes(args[0]) ? 180_000 : 30_000;
  const { stdout } = await runFile(
    process.execPath,
    ['--import', 'tsx', 'scripts/installation.ts', ...args],
    { env, windowsHide: true, timeout, maxBuffer: 4_000_000 },
  );
  return stdout.trim();
}

async function cliText(env: NodeJS.ProcessEnv, ...args: string[]) {
  try {
    return await cli(env, ...args);
  } catch (error: any) {
    if (typeof error.stdout === 'string' && error.stdout.trim()) return error.stdout.trim();
    throw error;
  }
}

async function publicApi(
  origin: string,
  token: string,
  path: string,
  body?: Record<string, unknown>,
) {
  const response = await fetch(`${origin}${path}`, {
    method: body ? 'POST' : 'GET',
    headers: {
      cookie: `__Host-factory_session=${token}`,
      origin,
      connection: 'close',
      ...(body ? { 'content-type': 'application/json' } : {}),
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  return { status: response.status, body: await response.json() };
}

test('built coordinator captures, restores, and drills a real suspended review', async () => {
  const runtime = await publicationRuntime('github', false, true);
  const targetNamespace = `restored_${Date.now().toString(36)}`;
  const env: NodeJS.ProcessEnv = { ...runtime.r.env };
  let coordinator: ChildProcess | undefined;
  let webPort = 0;
  let restoredPort = 0;
  let sourceAiCalls = 0;
  try {
    const shareReply = await runtime.act('artifact-shares', {
      decision: runtime.decision.id,
      recipients: [runtime.r.f.alice.user.id],
    });
    assert.equal(shareReply.status, 200);
    const share = shareReply.body.share;
    assert.ok(share);
    assert.equal((await runtime.act('review-publications', { reference: share.id })).status, 200);
    await runtime.r.startWorker();
    await runtime.wait('completed');
    assert.equal(runtime.posts.length, 1);
    await runtime.r.stopWorker();
    assert.equal(
      (
        await runtime.r.f.request(`${runtime.path}/artifact-shares/${share.id}/revoke`, {
          operationId: 'installation-revoke-completed-artifact',
        })
      ).status,
      200,
    );
    const betaSession = await runtime.r.f.login('bob');

    const sourcePath = runtime.path;
    const sourceWorkItem = sourcePath.split('/').at(-1)!;
    const currentItem = await runtime.r.f.request(sourcePath);
    await runtime.r.startWorker();
    await runtime.r.f.request(`${sourcePath}/transition-requests`, {
      operationId: 'start-installation-cancelled-review',
      transition: 'request-review',
      expectedState: currentItem.body.state,
      version: 5,
      inputs: { reviewBrief: 'Confirm a completed Activity before testing recovery ownership' },
    });
    let sourceReview = await runtime.r.wait(sourcePath, 'waiting-review');
    const cancelledRun = sourceReview.runs.find((run: any) => run.status === 'waiting-review');
    assert.ok(cancelledRun, 'the cancelled pre-dispatch review should reach its human wait');
    await runtime.r.stopWorker();
    const initialReport = sourceReview.reports.find(
      (report: any) => report.id === cancelledRun.report,
    );
    assert.ok(initialReport);
    const decision = await runtime.r.f.request(`${sourcePath}/review-decisions`, {
      operationId: 'decide-installation-cancelled-review',
      run: cancelledRun.id,
      reportVersion: initialReport.id,
      reviewed: true,
      findings: initialReport.findings.map((finding: any) => ({
        finding: finding.id,
        decision: 'confirmed',
      })),
    });
    assert.equal(decision.status, 200);
    await runtime.r.startWorker();
    const completedReviewBy = Date.now() + 30_000;
    while (Date.now() < completedReviewBy) {
      sourceReview = (await runtime.r.f.request(`${sourcePath}/reviews`)).body;
      if (
        sourceReview.runs.some(
          (run: any) => run.id === cancelledRun.id && run.status === 'completed',
        )
      )
        break;
      await new Promise((resolve) => setTimeout(resolve, 100));
    }
    assert.ok(
      sourceReview.runs.some(
        (run: any) => run.id === cancelledRun.id && run.status === 'completed',
      ),
      'the review workflow must finish before a publication request',
    );
    await runtime.r.stopWorker();
    const cancelledShareReply = await runtime.r.f.request(`${sourcePath}/artifact-shares`, {
      operationId: 'share-installation-cancelled-review',
      run: cancelledRun.id,
      decision: decision.body.fact.id,
      recipients: [runtime.r.f.alice.user.id],
    });
    assert.equal(cancelledShareReply.status, 200);
    assert.equal(
      (
        await runtime.r.f.request(`${sourcePath}/review-publications`, {
          operationId: 'queue-installation-cancelled-publication',
          run: cancelledRun.id,
          reference: cancelledShareReply.body.share.id,
        })
      ).status,
      200,
    );
    assert.equal(
      (
        await runtime.r.f.request(`${sourcePath}/workflow-cancellations`, {
          operationId: 'cancel-installation-before-dispatch',
          run: cancelledRun.id,
        })
      ).status,
      200,
    );
    await runtime.r.startWorker();
    sourceReview = await runtime.r.wait(sourcePath, 'cancelled');
    await runtime.r.stopWorker();
    const cancelledPublication = sourceReview.publications.find(
      (publication: any) => publication.run === cancelledRun.id,
    );
    assert.equal(cancelledPublication?.status, 'not-published');
    assert.equal(runtime.posts.length, 1, 'the cancelled queued publication has no provider POST');
    const cancelledItem = await runtime.r.f.request(sourcePath);
    assert.equal(
      (
        await runtime.r.f.request(`${sourcePath}/transition-requests`, {
          operationId: 'start-new-installation-recovery-review',
          transition: 'request-review',
          expectedState: cancelledItem.body.state,
          version: 5,
          inputs: { reviewBrief: 'Preserve the new owner after recovery' },
        })
      ).status,
      200,
    );
    await runtime.r.startWorker();
    sourceReview = await runtime.r.wait(sourcePath, 'waiting-review');
    const sourceRun = sourceReview.runs.find(
      (run: any) => run.id !== cancelledRun.id && run.status === 'waiting-review',
    );
    assert.ok(sourceRun, 'source review should be suspended at the human review step');
    await runtime.r.stopWorker();

    webPort = await unusedPort();
    restoredPort = await unusedPort();
    while (restoredPort === webPort) restoredPort = await unusedPort();
    const recovery = join(runtime.r.directory, 'recovery');
    Object.assign(env, {
      FACTORY_ORIGIN: `http://127.0.0.1:${webPort}`,
      FACTORY_PORT: String(webPort),
      FACTORY_OIDC_ISSUER: runtime.r.f.op.issuer,
      FACTORY_OIDC_CLIENT_ID: 'factory',
      FACTORY_OIDC_CLIENT_SECRET: 'fixture-secret',
      FACTORY_OIDC_AUTH_METHOD: 'client_secret_post',
      FACTORY_TRUST_VERIFIED_EMAIL: 'true',
      FACTORY_RECOVERY_DIRECTORY: recovery,
      FACTORY_MAINTENANCE: 'false',
      FACTORY_STOP_TIMEOUT_MS: '20000',
      FACTORY_BACKUP_TIMEOUT_MS: '10000',
    });

    coordinator = spawn(process.execPath, ['--import', 'tsx', 'scripts/installation.ts', 'run'], {
      env,
      windowsHide: true,
      stdio: ['ignore', 'pipe', 'pipe'],
    });
    let coordinatorOutput = '';
    coordinator.stdout?.on('data', (chunk) => (coordinatorOutput += chunk.toString()));
    coordinator.stderr?.on('data', (chunk) => (coordinatorOutput += chunk.toString()));
    const readyBy = Date.now() + 60_000;
    let ready = false;
    while (
      Date.now() < readyBy &&
      coordinator.exitCode === null &&
      coordinator.signalCode === null
    ) {
      try {
        const response = await fetch(`${env.FACTORY_ORIGIN}/api/organizations`, {
          signal: AbortSignal.timeout(1500),
          headers: { connection: 'close' },
        });
        await response.arrayBuffer();
        if (response.status < 500) {
          ready = true;
          break;
        }
      } catch {
        // The built server is still starting.
      }
      await new Promise((resolve) => setTimeout(resolve, 150));
    }
    assert.ok(ready, `built server did not become ready: ${coordinatorOutput.slice(-3000)}`);

    let controlReady = false;
    const controlBy = Date.now() + 30_000;
    while (
      Date.now() < controlBy &&
      coordinator.exitCode === null &&
      coordinator.signalCode === null
    ) {
      try {
        const status = JSON.parse(await cliText(env, 'status'));
        if (status.coordinator === 'running') {
          controlReady = true;
          break;
        }
      } catch {
        // The coordinator binds its control socket after both child processes are ready.
      }
      await new Promise((resolve) => setTimeout(resolve, 150));
    }
    assert.ok(
      controlReady,
      `coordinator control plane did not become ready: ${coordinatorOutput.slice(-3000)}`,
    );

    const initialStatus = JSON.parse(await cliText(env, 'status'));
    assert.equal(initialStatus.backup.overdue, true);
    assert.equal(initialStatus.drill.overdue, true);
    const backupReply = JSON.parse(
      await cli(env, 'backup').catch((error: any) => {
        throw new Error(`${error.stderr ?? error.message}\n${coordinatorOutput.slice(-3000)}`);
      }),
    );
    const bundle = backupReply.bundle as string;
    assert.ok(bundle);
    const manifest = JSON.parse(await readFile(join(bundle, 'manifest.json'), 'utf8'));
    assert.equal(manifest.installation, 'review-test');
    assert.ok(manifest.recoveryPointAt <= manifest.capturedAt);
    assert.ok(manifest.files.some((file: any) => file.path === 'worker/workflows.db'));
    assert.ok(manifest.files.some((file: any) => file.path.startsWith('artifacts/')));
    assert.equal(
      manifest.files.some((file: any) => /(^|\/)root(?:[-_.]?key)(?:[./]|$)/i.test(file.path)),
      false,
      'separately held root-key custody is never bundled',
    );
    assert.ok(
      coordinator.exitCode === null,
      'coordinator should restart web and worker after backup',
    );

    const status = JSON.parse(await cliText(env, 'status'));
    assert.equal(status.backup.state, 'succeeded');
    assert.equal(status.worker, true);
    assert.equal(status.web, true);
    sourceAiCalls = runtime.r.requests.length;

    await cli(env, 'stop');
    const stopped = await childExit(coordinator, 30_000);
    assert.equal(stopped.code, 0);
    coordinator = undefined;

    const corruptBundle = join(runtime.r.directory, 'corrupt-recovery-point');
    await cp(bundle, corruptBundle, { recursive: true, errorOnExist: true, force: false });
    await writeFile(join(corruptBundle, 'key-ring', 'ring.json'), '{}');
    const corruptEnv: NodeJS.ProcessEnv = {
      ...env,
      FACTORY_DATABASE_NAMESPACE: `corrupt_${Date.now().toString(36)}`,
      FACTORY_DATABASE_NAME: 'corrupt',
      FACTORY_WORKER_DIRECTORY: join(runtime.r.directory, 'corrupt-worker'),
      FACTORY_ARTIFACT_DIRECTORY: join(runtime.r.directory, 'corrupt-artifacts'),
      FACTORY_RING_DIRECTORY: join(runtime.r.directory, 'corrupt-ring'),
      FACTORY_RING_BACKUP_DIRECTORY: join(runtime.r.directory, 'corrupt-ring-backups'),
      FACTORY_RECOVERY_DIRECTORY: join(runtime.r.directory, 'corrupt-recovery-output'),
      FACTORY_MAINTENANCE: 'true',
    };
    await assert.rejects(cli(corruptEnv, 'restore', corruptBundle), (error: any) =>
      error.stderr?.includes('Recovery bundle integrity verification failed'),
    );
    await assert.rejects(lstat(corruptEnv.FACTORY_WORKER_DIRECTORY!));
    await assert.rejects(lstat(corruptEnv.FACTORY_RING_DIRECTORY!));

    Object.assign(env, {
      FACTORY_DATABASE_NAMESPACE: targetNamespace,
      FACTORY_DATABASE_NAME: 'restored',
      FACTORY_WORKER_DIRECTORY: join(runtime.r.directory, 'restored-worker'),
      FACTORY_ARTIFACT_DIRECTORY: join(runtime.r.directory, 'restored-artifacts'),
      FACTORY_RING_DIRECTORY: join(runtime.r.directory, 'restored-ring'),
      FACTORY_RING_BACKUP_DIRECTORY: join(runtime.r.directory, 'restored-ring-backups'),
      FACTORY_MAINTENANCE: 'true',
    });
    await cli(env, 'restore', bundle);
    const hold = JSON.parse(await cli(env, 'recovery-list'));
    assert.equal(hold.activatedAt, null);
    assert.equal(hold.runs[sourceRun.id].disposition, 'pending');

    Object.assign(env, {
      FACTORY_MAINTENANCE: 'false',
      FACTORY_ORIGIN: `http://127.0.0.1:${webPort}`,
      FACTORY_PORT: String(webPort),
    });
    coordinator = spawn(process.execPath, ['--import', 'tsx', 'scripts/installation.ts', 'run'], {
      env,
      windowsHide: true,
      stdio: ['ignore', 'pipe', 'pipe'],
    });
    let maintenanceOutput = '';
    coordinator.stdout?.on('data', (chunk) => (maintenanceOutput += chunk.toString()));
    coordinator.stderr?.on('data', (chunk) => (maintenanceOutput += chunk.toString()));
    let maintenanceStatus: number | undefined;
    const maintenanceBy = Date.now() + 60_000;
    while (
      Date.now() < maintenanceBy &&
      coordinator.exitCode === null &&
      coordinator.signalCode === null
    ) {
      try {
        const response = await fetch(`${env.FACTORY_ORIGIN}/api/organizations`, {
          signal: AbortSignal.timeout(1500),
          headers: { connection: 'close' },
        });
        await response.arrayBuffer();
        if (response.status === 503) {
          maintenanceStatus = response.status;
          break;
        }
      } catch {
        // The maintenance web child is still starting.
      }
      await new Promise((resolve) => setTimeout(resolve, 150));
    }
    assert.equal(
      maintenanceStatus,
      503,
      'an unactivated restore hold forces the public app into maintenance',
    );
    let heldStatus: any;
    const heldControlBy = Date.now() + 30_000;
    while (
      Date.now() < heldControlBy &&
      coordinator.exitCode === null &&
      coordinator.signalCode === null
    ) {
      try {
        heldStatus = JSON.parse(await cliText(env, 'status'));
        if (heldStatus.coordinator === 'running') break;
      } catch {
        // Wait for the control socket after the held worker exits.
      }
      await new Promise((resolve) => setTimeout(resolve, 150));
    }
    assert.equal(
      heldStatus?.coordinator,
      'running',
      `held coordinator did not start its control plane: ${maintenanceOutput.slice(-3000)}`,
    );
    assert.equal(
      heldStatus?.worker,
      false,
      'the held worker exits before claiming database ownership',
    );
    assert.equal(heldStatus?.restoreHold?.activated, false);
    assert.equal(
      runtime.r.requests.length,
      sourceAiCalls,
      'the held restore causes no extra AI provider calls',
    );
    await cli(env, 'stop');
    assert.equal((await childExit(coordinator, 30_000)).code, 0);
    coordinator = undefined;

    env.FACTORY_MAINTENANCE = 'true';
    await cli(env, 'recovery-run', sourceRun.id, 'resume');
    await cli(env, 'activate', '--confirm-reconciled');

    const store = await connectStore({
      url: env.FACTORY_DATABASE_URL!,
      namespace: targetNamespace,
      database: 'restored',
      username: env.FACTORY_DATABASE_USER!,
      password: env.FACTORY_DATABASE_PASSWORD!,
    });
    try {
      const restoredState = await store.transaction(async (tx) => ({
        restoredRun: await tx.get('workflow_run', sourceRun.id),
        cancelledRun: await tx.get('workflow_run', cancelledRun.id),
        completedRun: await tx.get('workflow_run', runtime.run.id),
        sourceItem: await tx.get('work_item', sourceWorkItem),
        organizations: await tx.list('organization'),
        alphaConfig: await tx.get('review_config', 'alpha'),
        activities: await tx.list(
          'external_activity',
          'organization = $organization AND workItem = $workItem',
          { organization: 'alpha', workItem: runtime.path.split('/').at(-1) },
        ),
        shares: await tx.list(
          'artifact_share',
          'organization = $organization AND workItem = $workItem',
          { organization: 'alpha', workItem: runtime.path.split('/').at(-1) },
        ),
        cancelledActivities: await tx.list(
          'external_activity',
          'organization = $organization AND workItem = $workItem',
          { organization: 'alpha', workItem: sourceWorkItem },
        ),
      }));
      assert.equal((restoredState.restoredRun?.data as any).status, 'waiting-review');
      assert.equal((restoredState.restoredRun?.data as any).report, sourceRun.report);
      assert.equal((restoredState.cancelledRun?.data as any).status, 'cancelled');
      assert.equal((restoredState.sourceItem?.activeRun as any)?.id, sourceRun.id);
      assert.ok(
        restoredState.cancelledActivities.some(
          (activity) => (activity.data as any).status === 'not-published',
        ),
      );
      assert.equal((restoredState.completedRun?.data as any).status, 'completed');
      assert.deepEqual(restoredState.organizations.map((organization) => organization.id).sort(), [
        'alpha',
        'beta',
      ]);
      assert.deepEqual(
        (restoredState.alphaConfig?.data as any).limits,
        runtime.r.configInput.limits,
      );
      assert.ok(
        restoredState.activities.some((activity) => (activity.data as any).status === 'completed'),
      );
      assert.ok(
        restoredState.shares.some(
          (artifactShare) => (artifactShare.data as any).status === 'revoked',
        ),
      );
      const restoredRing = new KeyRing({
        directory: env.FACTORY_RING_DIRECTORY!,
        backupDirectory: env.FACTORY_RING_BACKUP_DIRECTORY!,
        rootKey: await readFile(runtime.r.env.FACTORY_ROOT_KEY_FILE!),
        rootVersion: 'root-1',
        installation: 'review-test',
      });
      const secretCheck = await new OrganizationSecrets(store, restoredRing).verify();
      assert.ok(
        secretCheck.secrets >= 3,
        'restored key ring decrypts retained Organization secrets',
      );
    } finally {
      await store.close();
    }

    Object.assign(env, {
      FACTORY_MAINTENANCE: 'false',
      FACTORY_ORIGIN: `http://127.0.0.1:${restoredPort}`,
      FACTORY_PORT: String(restoredPort),
      FACTORY_RECOVERY_DIRECTORY: recovery,
    });
    let restoredOutput = '';
    coordinator = spawn(process.execPath, ['--import', 'tsx', 'scripts/installation.ts', 'run'], {
      env,
      windowsHide: true,
      stdio: ['ignore', 'pipe', 'pipe'],
    });
    coordinator.stdout?.on('data', (chunk) => (restoredOutput += chunk.toString()));
    coordinator.stderr?.on('data', (chunk) => (restoredOutput += chunk.toString()));
    let restoredReady = false;
    const restoredBy = Date.now() + 60_000;
    while (
      Date.now() < restoredBy &&
      coordinator.exitCode === null &&
      coordinator.signalCode === null
    ) {
      try {
        const response = await fetch(`${env.FACTORY_ORIGIN}/api/organizations`, {
          signal: AbortSignal.timeout(1500),
          headers: { connection: 'close' },
        });
        await response.arrayBuffer();
        if (response.status < 500) {
          restoredReady = true;
          break;
        }
      } catch {
        // The built server is still starting.
      }
      await new Promise((resolve) => setTimeout(resolve, 150));
    }
    assert.ok(restoredReady, 'restored built server should start after explicit activation');
    assert.ok(coordinator.exitCode === null);
    let restoredControlReady = false;
    let restoredControlError = '';
    const restoredControlBy = Date.now() + 30_000;
    while (
      Date.now() < restoredControlBy &&
      coordinator.exitCode === null &&
      coordinator.signalCode === null
    ) {
      try {
        const status = JSON.parse(await cliText(env, 'status'));
        if (status.coordinator === 'running') {
          restoredControlReady = true;
          break;
        }
      } catch (error: any) {
        restoredControlError = String(error.message ?? error).slice(0, 500);
        // The coordinator binds its control socket after both child processes are ready.
      }
      await new Promise((resolve) => setTimeout(resolve, 150));
    }
    const persistedStatus = await readFile(join(recovery, 'installation-status.json'), 'utf8')
      .then((text) => JSON.parse(text))
      .catch(() => ({}));
    assert.ok(
      restoredControlReady,
      `restored coordinator control plane did not become ready: child exit=${coordinator.exitCode}, signal=${coordinator.signalCode}, readiness record=${persistedStatus.service?.pid === coordinator.pid}, last control error=${restoredControlError}, output=${restoredOutput.slice(-3000)}`,
    );
    const revokedRead = await fetch(`${env.FACTORY_ORIGIN}${new URL(share.url).pathname}`, {
      headers: {
        cookie: `__Host-factory_session=${runtime.r.f.alice.token}`,
        connection: 'close',
      },
    });
    assert.equal(
      revokedRead.status,
      403,
      'the restored public route keeps a revoked share inaccessible',
    );
    const crossOrganizationRead = await fetch(
      `${env.FACTORY_ORIGIN}${runtime.path}/reviews/${runtime.report.id}/artifact`,
      {
        headers: {
          cookie: `__Host-factory_session=${betaSession.token}`,
          connection: 'close',
        },
      },
    );
    assert.ok(
      crossOrganizationRead.status === 403 || crossOrganizationRead.status === 404,
      'the restored public route denies a beta User access to a private alpha Artifact',
    );
    const activatedBackup = JSON.parse(await cli(env, 'backup'));
    const activatedManifest = JSON.parse(
      await readFile(join(activatedBackup.bundle, 'manifest.json'), 'utf8'),
    );
    assert.ok(
      activatedManifest.files.some((file: any) => file.path === 'worker/restore-hold.json'),
    );
    const capturedHold = JSON.parse(
      await readFile(join(activatedBackup.bundle, 'worker', 'restore-hold.json'), 'utf8'),
    );
    assert.ok(
      capturedHold.activatedAt,
      'a second-generation backup preserves the activated restore ledger',
    );
    const afterBackup = JSON.parse(await cliText(env, 'status'));
    assert.equal(afterBackup.backup.state, 'succeeded');
    assert.equal(afterBackup.worker, true);
    assert.equal(afterBackup.web, true);
    await cli(env, 'drill');
    const finalStatus = JSON.parse(await cliText(env, 'status'));
    assert.equal(finalStatus.drill.state, 'succeeded');
    assert.ok(finalStatus.drill.durationMs >= 0);
    assert.equal(
      runtime.posts.length,
      1,
      'the completed provider effect is not replayed after restore',
    );
    assert.equal(
      runtime.r.requests.length,
      sourceAiCalls,
      'restored old observations do not start new AI work',
    );

    const drainOrigin = env.FACTORY_ORIGIN!;
    const drainPathBase = '/api/organizations/alpha/work-items';
    const drainItem = await publicApi(drainOrigin, runtime.r.f.alice.token, drainPathBase, {
      operationId: 'create-installation-drain-check',
      project: 'alpha-project',
      repository: 'alpha-repo',
      title: 'installation-drain-check',
      type: 'pull-request-review',
    });
    assert.equal(drainItem.status, 200);
    const drainPath = `${drainPathBase}/${drainItem.body.workItem.id}`;
    assert.equal(
      (
        await publicApi(drainOrigin, runtime.r.f.alice.token, `${drainPath}/review-facts`, {
          operationId: 'inputs-installation-drain-check',
          fields: {
            sourceBranch: 'feature',
            targetBranch: 'main',
            sourceCommit: runtime.r.head,
            targetCommit: runtime.r.target,
          },
        })
      ).status,
      200,
    );
    runtime.r.behavior('delay', 30_000);
    const drainAiCalls = runtime.r.requests.length;
    assert.equal(
      (
        await publicApi(drainOrigin, runtime.r.f.alice.token, `${drainPath}/transition-requests`, {
          operationId: 'start-installation-drain-check',
          transition: 'request-review',
          expectedState: 'registered',
          version: 5,
          inputs: { reviewBrief: 'Exercise a provider call during coordinated backup' },
        })
      ).status,
      200,
    );
    const drainCallBy = Date.now() + 15_000;
    while (runtime.r.requests.length === drainAiCalls && Date.now() < drainCallBy)
      await new Promise((resolve) => setTimeout(resolve, 50));
    assert.ok(
      runtime.r.requests.length > drainAiCalls,
      `the actual worker starts a controlled AI call: ${await cliText(env, 'status')}`,
    );
    const runningReview = await publicApi(
      drainOrigin,
      runtime.r.f.alice.token,
      `${drainPath}/reviews`,
    );
    assert.ok(
      runningReview.body.runs?.some((run: any) => run.status === 'running'),
      'the public Run remains active while the backup attempts to drain',
    );
    const bundlesBeforeDrain = (await readdir(recovery))
      .filter((name) => name.startsWith('recovery-'))
      .sort();
    await assert.rejects(
      cli(env, 'backup'),
      (error: any) =>
        error.stderr?.includes('Worker dispatch drain timed out') ||
        error.message?.includes('Worker dispatch drain timed out'),
    );
    const timedOutStatus = JSON.parse(await cliText(env, 'status'));
    assert.equal(timedOutStatus.backup.state, 'failed');
    assert.equal(timedOutStatus.backup.overdue, true);
    assert.equal(timedOutStatus.backup.bundle, undefined);
    assert.equal(timedOutStatus.worker, true);
    assert.equal(timedOutStatus.web, true);
    assert.deepEqual(
      (await readdir(recovery)).filter((name) => name.startsWith('recovery-')).sort(),
      bundlesBeforeDrain,
      'a timed-out drain cannot create a recovery bundle',
    );
    runtime.r.behavior('tools');
    const drainReviewBy = Date.now() + 30_000;
    let drainReview: any;
    while (Date.now() < drainReviewBy) {
      drainReview = await publicApi(drainOrigin, runtime.r.f.alice.token, `${drainPath}/reviews`);
      if (drainReview.body.runs?.some((run: any) => run.status === 'waiting-review')) break;
      await new Promise((resolve) => setTimeout(resolve, 100));
    }
    const drainRun = drainReview.body.runs.find((run: any) => run.status === 'waiting-review');
    assert.ok(drainRun, 'the timed-out backup lets active AI work finish naturally');
    assert.equal(
      (
        await publicApi(
          drainOrigin,
          runtime.r.f.alice.token,
          `${drainPath}/workflow-cancellations`,
          {
            operationId: 'cancel-installation-drain-check',
            run: drainRun.id,
          },
        )
      ).status,
      200,
    );
    const cancelledBy = Date.now() + 15_000;
    let drainCancelled = false;
    while (Date.now() < cancelledBy) {
      const current = await publicApi(drainOrigin, runtime.r.f.alice.token, `${drainPath}/reviews`);
      if (
        current.body.runs?.some((run: any) => run.id === drainRun.id && run.status === 'cancelled')
      ) {
        drainCancelled = true;
        break;
      }
      await new Promise((resolve) => setTimeout(resolve, 100));
    }
    assert.equal(drainCancelled, true, 'the completed drain check can be cancelled normally');
    assert.equal(runtime.posts.length, 1, 'the backup timeout does not replay a provider effect');
    await cli(env, 'stop');
    assert.equal((await childExit(coordinator, 30_000)).code, 0);
    coordinator = undefined;

    assert.equal(
      await lstat(join(runtime.r.directory, 'restored-worker', 'restore-hold.json')).then(
        () => true,
      ),
      true,
    );
  } finally {
    if (coordinator && coordinator.exitCode === null && coordinator.signalCode === null) {
      try {
        await cli(env, 'stop');
        await childExit(coordinator, 15_000);
      } catch {
        coordinator.kill('SIGKILL');
        await childExit(coordinator, 5_000).catch(() => undefined);
      }
    }
    await runtime.close();
  }
});
