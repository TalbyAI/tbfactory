import { Authentication } from './auth';
import { Factory } from './factory';
import { connectStore } from './store';
import {
  applicationOrigin,
  configuredRing,
  databaseConfig,
  identityConfig,
  lifetimeSettings,
} from './config';
import { OrganizationSecrets } from './secrets';
import { fail } from './contracts';
import { ReviewArtifacts } from './review-artifacts';

let services:
  | Promise<{
      auth: Authentication;
      factory: Factory;
      origin: string;
      secrets: OrganizationSecrets;
      allowLoopbackHttp: boolean;
      artifacts?: ReviewArtifacts;
    }>
  | undefined;
export async function getServices() {
  if (process.env.FACTORY_MAINTENANCE === 'true') fail(503, 'Installation in recovery maintenance');
  services ??= (async () => {
    const store = await connectStore(databaseConfig());
    try {
      const secrets = new OrganizationSecrets(store, await configuredRing());
      await secrets.verify();
      return {
        auth: await Authentication.create(store, identityConfig()),
        factory: new Factory(store, lifetimeSettings()),
        origin: applicationOrigin(),
        secrets,
        allowLoopbackHttp: process.env.FACTORY_ALLOW_LOOPBACK_HTTP === 'true',
        artifacts: process.env.FACTORY_ARTIFACT_DIRECTORY
          ? new ReviewArtifacts(process.env.FACTORY_ARTIFACT_DIRECTORY)
          : undefined,
      };
    } catch (error) {
      await store.close();
      throw error;
    }
  })();
  try {
    return await services;
  } catch (error) {
    services = undefined;
    throw error;
  }
}
