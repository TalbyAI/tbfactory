import { readFile } from 'node:fs/promises';
import { configuredRing, databaseConfig } from '../src/server/config';
import { connectStore } from '../src/server/store';
import { provision } from '../src/server/provision';
import { revokeMembership, setPolicy } from '../src/server/operator';
import { OrganizationSecrets } from '../src/server/secrets';
import { z } from 'zod';
import { identifier, text } from '../src/server/contracts';
import { putSource } from '../src/server/observations';

const [command, file] = process.argv.slice(2);
const store = await connectStore(databaseConfig());
try {
  const input = async () => JSON.parse(await readFile(file, 'utf8'));
  let result: unknown;
  if (command === 'provision') result = await provision(store, await input());
  else if (command === 'membership-revoke') result = await revokeMembership(store, await input());
  else if (command === 'policy-set') result = await setPolicy(store, await input());
  else {
    const ring = await configuredRing();
    const secrets = new OrganizationSecrets(store, ring);
    if (command === 'source-put') result = await putSource(store, secrets, await input());
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
