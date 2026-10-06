import { restoreBundle } from '../src/server/installation-recovery';

async function main() {
  if (process.env.FACTORY_MAINTENANCE !== 'true')
    throw new Error('Isolated restore drill requires FACTORY_MAINTENANCE=true');
  const bundle = process.argv[2];
  if (!bundle) throw new Error('Usage: installation-drill-restore <bundle-directory>');
  console.log(JSON.stringify(await restoreBundle(bundle)));
}

main().catch((error) => {
  const message =
    error instanceof Error &&
    error.message &&
    !/authorization|password|token|secret/i.test(error.message)
      ? error.message
      : 'Isolated restore drill failed; inspect protected service logs';
  console.error(message);
  process.exitCode = 1;
});
