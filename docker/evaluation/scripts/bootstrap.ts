import { lstat, readdir } from 'node:fs/promises';
import { join } from 'node:path';
import { activities } from '../../../src/server/contracts.ts';
import { configuredRing, databaseConfig } from '../../../src/server/config.ts';
import { provision } from '../../../src/server/provision.ts';
import { connectStore } from '../../../src/server/store.ts';
import { OrganizationSecrets } from '../../../src/server/secrets.ts';
import { surrealVersion, waitForSurreal } from '../../../src/server/installation-recovery.ts';

const expectedIssuer = 'http://127.0.0.1:18081';
if (process.env.FACTORY_OIDC_ISSUER !== expectedIssuer)
  throw new Error(`Evaluation OIDC issuer must be ${expectedIssuer}`);

async function waitForOidc(timeoutMs = 60_000) {
  const endpoint = `${expectedIssuer}/.well-known/openid-configuration`;
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    try {
      const response = await fetch(endpoint, { signal: AbortSignal.timeout(2_000) });
      if (response.ok) {
        const metadata = (await response.json()) as { issuer?: string };
        if (metadata.issuer !== expectedIssuer)
          throw new Error('Evaluation OIDC issuer metadata does not match configuration');
        return;
      }
    } catch (error) {
      if (error instanceof Error && error.message.includes('issuer metadata')) throw error;
    }
    await new Promise((resolve) => setTimeout(resolve, 250));
  }
  throw new Error('Evaluation OIDC provider did not become ready');
}

const database = databaseConfig();
await waitForSurreal(database.url, 60_000);
const version = await surrealVersion(database.url);
await waitForOidc();

const store = await connectStore(database);
try {
  const ring = await configuredRing();
  const secrets = new OrganizationSecrets(store, ring);
  const ringFile = join(process.env.FACTORY_RING_DIRECTORY!, 'ring.json');
  const ringBackupDirectory = process.env.FACTORY_RING_BACKUP_DIRECTORY!;
  const installation = process.env.FACTORY_INSTALLATION!;
  const existingRing = await lstat(ringFile).catch((error) => {
    if (error.code === 'ENOENT') return undefined;
    throw error;
  });
  if (existingRing) await secrets.verify();
  else {
    const priorExports = (await readdir(ringBackupDirectory)).some(
      (name) => name.startsWith(`${installation}-g`) && name.endsWith('.json'),
    );
    if (priorExports)
      throw new Error('Active evaluation key ring is missing while protected exports remain');
    await ring.setup(await secrets.requiredKeys());
  }

  const organizations = [
    {
      organization: { id: 'alpha', name: 'Alpha evaluation organization' },
      projects: [
        {
          id: 'alpha-project',
          name: 'Alpha project',
          repositories: [{ id: 'alpha-repo', name: 'Alpha repository' }],
        },
      ],
    },
    {
      organization: { id: 'beta', name: 'Beta evaluation organization' },
      projects: [
        {
          id: 'beta-project',
          name: 'Beta project',
          repositories: [{ id: 'beta-repo', name: 'Beta repository' }],
        },
      ],
    },
  ];

  for (const definition of organizations) {
    const present = await store.transaction((tx) =>
      tx.get('organization', definition.organization.id),
    );
    if (present) continue;
    await provision(store, {
      ...definition,
      members: [
        {
          issuer: expectedIssuer,
          subject: 'alice',
          grants: activities.map((activity) => ({
            activity,
            scope: 'organization',
            scopeId: definition.organization.id,
            effect: 'allow',
          })),
        },
      ],
    });
  }

  process.stdout.write(
    `Evaluation bootstrap verified SurrealDB ${version}, protected key ring, and Organizations alpha/beta.\n`,
  );
} finally {
  await store.close();
}
