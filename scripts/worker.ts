import { connectStore } from '../src/server/store';
import { configuredRing, databaseConfig } from '../src/server/config';
import { OrganizationSecrets } from '../src/server/secrets';
import { ReviewWorker } from '../src/server/review-worker';
import { limitsSchema } from '../src/server/review-configuration';

const required = (name: string) => {
  const value = process.env[name];
  if (!value) throw Error(`Missing deployment setting: ${name}`);
  return value;
};
const store = await connectStore(databaseConfig());
const secrets = new OrganizationSecrets(store, await configuredRing());
await secrets.verify();
const worker = new ReviewWorker(store, secrets, {
  directory: required('FACTORY_WORKER_DIRECTORY'),
  artifacts: required('FACTORY_ARTIFACT_DIRECTORY'),
  image: required('FACTORY_SANDBOX_IMAGE'),
  allowedHosts: (
    process.env.FACTORY_APPROVED_ENDPOINT_HOSTS ??
    'openrouter.ai,api.openai.com,api.anthropic.com,github.com,api.github.com,dev.azure.com'
  ).split(','),
  allowLoopback: process.env.FACTORY_ALLOW_LOOPBACK_HTTP === 'true',
  concurrency: 4,
  limits: limitsSchema.parse(JSON.parse(process.env.FACTORY_WORKER_LIMITS ?? '{}')),
});
let stopping = false;
const stop = () => {
  stopping = true;
};
process.on('SIGINT', stop);
process.on('SIGTERM', stop);
process.on('message', (message) => {
  if (message === 'stop') stop();
});
try {
  await worker.start();
  process.send?.({ ready: true });
  while (!stopping) {
    await worker.tick();
    await new Promise((resolve) => setTimeout(resolve, 100));
  }
} finally {
  await worker.close();
  await store.close();
  process.disconnect?.();
}
