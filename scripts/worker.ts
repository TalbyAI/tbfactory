import { connectStore } from '../src/server/store';
import { configuredRing, databaseConfig } from '../src/server/config';
import { OrganizationSecrets } from '../src/server/secrets';
import { ReviewWorker } from '../src/server/review-worker';
import { limitsSchema } from '../src/server/review-configuration';
import { readRestoreHold } from '../src/server/restore-hold';

const required = (name: string) => {
  const value = process.env[name];
  if (!value) throw Error(`Missing deployment setting: ${name}`);
  return value;
};
async function main() {
  if (process.env.FACTORY_MAINTENANCE === 'true') {
    process.send?.({ type: 'maintenance' });
    process.disconnect?.();
    return;
  }
  const directory = required('FACTORY_WORKER_DIRECTORY');
  const restoreHold = await readRestoreHold(directory);
  if (restoreHold && restoreHold.activatedAt === null) {
    process.send?.({ type: 'restore-hold' });
    process.disconnect?.();
    return;
  }
  const store = await connectStore(databaseConfig());
  const secrets = new OrganizationSecrets(store, await configuredRing());
  await secrets.verify();
  const worker = new ReviewWorker(store, secrets, {
    directory,
    artifacts: required('FACTORY_ARTIFACT_DIRECTORY'),
    image: required('FACTORY_SANDBOX_IMAGE'),
    allowedHosts: (
      process.env.FACTORY_APPROVED_ENDPOINT_HOSTS ??
      'openrouter.ai,api.openai.com,api.anthropic.com,github.com,api.github.com,dev.azure.com'
    ).split(','),
    allowLoopback: process.env.FACTORY_ALLOW_LOOPBACK_HTTP === 'true',
    concurrency: 4,
    limits: limitsSchema.parse(JSON.parse(process.env.FACTORY_WORKER_LIMITS ?? '{}')),
    restoreHold: directory,
  });
  let stopping = false;
  const stop = () => {
    stopping = true;
  };
  process.on('SIGINT', stop);
  process.on('SIGTERM', stop);
  process.on('message', (message) => {
    if (message === 'stop') stop();
    else if (
      message &&
      typeof message === 'object' &&
      'type' in message &&
      message.type === 'pause-dispatch' &&
      'id' in message &&
      typeof message.id === 'string'
    ) {
      worker.pauseDispatch();
      void worker.waitForDispatchDrain().then(
        (drain) => process.send?.({ type: 'dispatch-drained', id: message.id, ...drain }),
        () => process.send?.({ type: 'dispatch-drain-failed', id: message.id }),
      );
    } else if (
      message &&
      typeof message === 'object' &&
      'type' in message &&
      message.type === 'resume-dispatch' &&
      'id' in message &&
      typeof message.id === 'string'
    ) {
      worker.resumeDispatch();
      process.send?.({ type: 'dispatch-resumed', id: message.id });
    }
  });
  try {
    await worker.start();
    process.send?.({ type: 'ready' });
    while (!stopping) {
      await worker.tick();
      await new Promise((resolve) => setTimeout(resolve, 100));
    }
  } finally {
    await worker.close();
    await store.close();
    process.disconnect?.();
  }
}

await main();
