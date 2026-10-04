import { createHmac, randomBytes } from 'node:crypto';

export const githubRepository = '12345';
export const azureRepository = '11111111-1111-4111-8111-111111111111';
export const azureProject = '22222222-2222-4222-8222-222222222222';
export const azureCollection = '33333333-3333-4333-8333-333333333333';

export function sourceInput(
  provider: 'github' | 'azure-devops',
  organization = 'alpha',
  source: string = provider,
) {
  return {
    organization,
    project: `${organization}-project`,
    repository: `${organization}-repo`,
    source,
    type: 'pull-request-review',
    secret: randomBytes(32).toString('base64url'),
    enabled: true,
    external:
      provider === 'github'
        ? { provider, repository: githubRepository }
        : {
            provider,
            organization: 'example',
            collection: azureCollection,
            project: azureProject,
            repository: azureRepository,
          },
  };
}

export function observation(
  provider: 'github' | 'azure-devops',
  eventId = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
  number = 42,
) {
  const repo = { id: Number(githubRepository), full_name: 'example/code' };
  return provider === 'github'
    ? {
        action: 'opened',
        number,
        repository: repo,
        pull_request: {
          number,
          title: 'Review provider change',
          state: 'open',
          merged: false,
          head: { sha: 'a'.repeat(40) },
          base: { sha: 'b'.repeat(40), repo },
        },
      }
    : {
        id: eventId,
        eventType: 'git.pullrequest.created',
        publisherId: 'tfs',
        resource: {
          repository: { id: azureRepository, project: { id: azureProject } },
          pullRequestId: number,
          title: 'Review provider change',
          status: 'active',
          lastMergeSourceCommit: { commitId: 'a'.repeat(40) },
          lastMergeTargetCommit: { commitId: 'b'.repeat(40) },
        },
        resourceContainers: { collection: { id: azureCollection } },
      };
}

export function delivery(
  input: ReturnType<typeof sourceInput>,
  payload: unknown,
  eventId = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
  origin = 'http://localhost:3000',
) {
  const body = JSON.stringify(payload);
  const headers: Record<string, string> = { 'content-type': 'application/json' };
  if (input.external.provider === 'github') {
    headers['x-github-event'] = 'pull_request';
    headers['x-github-delivery'] = eventId;
    headers['x-hub-signature-256'] =
      `sha256=${createHmac('sha256', input.secret).update(body).digest('hex')}`;
  } else
    headers.authorization = `Basic ${Buffer.from(`factory:${input.secret}`).toString('base64')}`;
  return new Request(
    `${origin}/api/organizations/${input.organization}/sources/${input.source}/observations`,
    { method: 'POST', headers, body },
  );
}
