import { execFileSync } from 'node:child_process';

export const configuredTestDatabaseContainer =
  process.env.FACTORY_TEST_DATABASE_CONTAINER ?? 'tbfactory-acceptance-db';

const readyTimeout = 30000;
const delay = (milliseconds: number) => new Promise((resolve) => setTimeout(resolve, milliseconds));

export async function restartTestDatabase(databaseEndpoint: string) {
  const endpoint = new URL(databaseEndpoint);
  if (!['ws:', 'wss:', 'http:', 'https:'].includes(endpoint.protocol))
    throw new Error(`Unsupported test database URL protocol: ${endpoint.protocol}`);
  if (!endpoint.port) throw new Error(`Test database URL must include a port: ${databaseEndpoint}`);

  const inspection = execFileSync(
    'docker',
    [
      'inspect',
      '--format',
      '{{.Name}}|{{json .NetworkSettings.Ports}}',
      configuredTestDatabaseContainer,
    ],
    { encoding: 'utf8', windowsHide: true },
  ).trim();
  const separator = inspection.indexOf('|');
  const inspectedName = inspection.slice(0, separator);
  const portMappings = JSON.parse(inspection.slice(separator + 1)) as Record<
    string,
    { HostIp: string; HostPort: string }[] | null
  >;
  if (inspectedName !== `/${configuredTestDatabaseContainer}`)
    throw new Error(
      `Docker inspected ${inspectedName}; expected /${configuredTestDatabaseContainer}`,
    );

  const publishedDatabasePorts = portMappings['8000/tcp'] ?? [];
  const endpointIsPublished = publishedDatabasePorts.some(
    (mapping) =>
      Number(mapping.HostPort) === Number(endpoint.port) &&
      (mapping.HostIp === endpoint.hostname ||
        mapping.HostIp === '0.0.0.0' ||
        mapping.HostIp === '::' ||
        (endpoint.hostname === 'localhost' && ['127.0.0.1', '::1'].includes(mapping.HostIp))),
  );
  if (!endpointIsPublished)
    throw new Error(
      `${configuredTestDatabaseContainer} does not publish SurrealDB to ${endpoint.origin}`,
    );

  execFileSync('docker', ['restart', configuredTestDatabaseContainer], {
    encoding: 'utf8',
    windowsHide: true,
    stdio: 'pipe',
  });

  const readyProtocol =
    endpoint.protocol === 'wss:' || endpoint.protocol === 'https:' ? 'https:' : 'http:';
  const readyUrl = `${readyProtocol}//${endpoint.host}/ready`;
  const deadline = Date.now() + readyTimeout;
  let lastError: unknown;
  while (Date.now() < deadline) {
    try {
      const response = await fetch(readyUrl);
      if (response.ok) return;
    } catch (error) {
      lastError = error;
    }
    await delay(100);
  }
  throw new Error(`Test database did not become ready at ${readyUrl}`, { cause: lastError });
}
