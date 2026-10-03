import { Authentication } from './auth';
import { Factory } from './factory';
import { connectStore } from './store';
import { applicationOrigin, configuredRing, databaseConfig, identityConfig, lifetimeSettings } from './config';
import { OrganizationSecrets } from './secrets';
import { fail } from './contracts';

let services: Promise<{ auth: Authentication; factory: Factory; origin: string }> | undefined;
export async function getServices() {
  if (process.env.FACTORY_MAINTENANCE === 'true') fail(503, 'Installation in recovery maintenance');
  services ??= (async () => {
    const store = await connectStore(databaseConfig());
    try {
      await new OrganizationSecrets(store, await configuredRing()).verify();
      return { auth: await Authentication.create(store, identityConfig()), factory: new Factory(store, lifetimeSettings()), origin: applicationOrigin() };
    } catch (error) { await store.close(); throw error; }
  })();
  try { return await services; } catch (error) { services = undefined; throw error; }
}
