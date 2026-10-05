import { readFile } from 'node:fs/promises';
import { configuredRing, databaseConfig } from '../src/server/config';
import { connectStore } from '../src/server/store';
import { provision } from '../src/server/provision';
import { revokeMembership, setPolicy } from '../src/server/operator';
import { OrganizationSecrets } from '../src/server/secrets';
import { z } from 'zod';
import { identifier, text } from '../src/server/contracts';
import { putSource } from '../src/server/observations';
import { putPublicationConfiguration } from '../src/server/publication-provider';
import {
  putReviewConfiguration,
  putRepositoryAccess,
  revokeReviewResource,
} from '../src/server/review-configuration';

const [command, file] = process.argv.slice(2);
const store = await connectStore(databaseConfig());
try {
  const input = async () => JSON.parse(await readFile(file, 'utf8'));
  let result: unknown;
  if (command === 'provision') result = await provision(store, await input());
  else if (command === 'membership-revoke') result = await revokeMembership(store, await input());
  else if (command === 'policy-set') result = await setPolicy(store, await input());
  else if (command === 'worker-recover-lock' || command === 'workflow-recover') {
    const { recoverWorkerLock, recoverStoppedRun } = await import('../src/server/review-worker');
    if (!process.env.FACTORY_WORKER_DIRECTORY) throw Error('FACTORY_WORKER_DIRECTORY required');
    if (command === 'worker-recover-lock') {
      const recovery = z
        .strictObject({ confirmedPid: z.number().int().positive() })
        .parse(await input());
      result = await recoverWorkerLock(
        store,
        process.env.FACTORY_WORKER_DIRECTORY,
        recovery.confirmedPid,
      );
    } else {
      const recovery = z.strictObject({ run: identifier }).parse(await input());
      result = await recoverStoppedRun(
        store,
        process.env.FACTORY_WORKER_DIRECTORY,
        recovery.run,
        process.env.FACTORY_ARTIFACT_DIRECTORY,
      );
    }
  } else {
    const ring = await configuredRing();
    const secrets = new OrganizationSecrets(store, ring);
    const allowedHosts = (
      process.env.FACTORY_APPROVED_ENDPOINT_HOSTS ??
      'openrouter.ai,api.openai.com,api.anthropic.com,github.com,api.github.com,dev.azure.com'
    ).split(',');
    const allowLoopback = process.env.FACTORY_ALLOW_LOOPBACK_HTTP === 'true';
    if (command === 'source-put') result = await putSource(store, secrets, await input());
    else if (command === 'publication-configure')
      result = await putPublicationConfiguration(
        store,
        secrets,
        await input(),
        allowedHosts,
        allowLoopback,
      );
    else if (command === 'review-resource-revoke')
      result = await revokeReviewResource(store, await input());
    else if (command === 'review-configure')
      result = await putReviewConfiguration(
        store,
        secrets,
        await input(),
        allowedHosts,
        allowLoopback,
      );
    else if (command === 'repository-access')
      result = await putRepositoryAccess(
        store,
        secrets,
        await input(),
        allowedHosts,
        allowLoopback,
      );
    else if (command === 'ring-setup') result = await ring.setup(await secrets.requiredKeys());
    else if (command === 'ring-rotate') {
      await secrets.verify();
      result = await ring.rotate();
    } else if (command === 'ring-export') result = { protectedBackup: await ring.export() };
    else if (command === 'ring-restore') {
      if (process.env.FACTORY_MAINTENANCE !== 'true')
        throw new Error(
          'Restore requires FACTORY_MAINTENANCE=true and stopped web/worker processes',
        );
      result = await ring.restore(file, await secrets.requiredKeys());
      await secrets.verify();
    } else if (command === 'secret-check') result = await secrets.verify();
    else if (command === 'secret-put') {
      const secret = z
        .strictObject({ organization: identifier, purpose: text.max(200), value: text })
        .parse(await input());
      result = await secrets.put(secret.organization, secret.purpose, secret.value);
    } else throw new Error('Unknown operator command');
  }
  console.log(JSON.stringify(result));
} catch (error) {
  console.error(error instanceof z.ZodError ? 'Invalid operator input' : (error as Error).message);
  process.exitCode = 1;
} finally {
  await store.close();
}
