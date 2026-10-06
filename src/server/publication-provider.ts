import { randomUUID } from 'node:crypto';
import { z } from 'zod';
import { digest, fail, identifier, stable, text } from './contracts';
import { type Row, type Store, type Transaction } from './store';
import { type OrganizationSecrets } from './secrets';
import { validateEndpoint } from './review-configuration';

export const publicationModeSchema = z.enum(['confirmed-content', 'report-reference']);
export async function initialPublicationMode(
  tx: Transaction,
  organization: string,
  repository: string | undefined,
  version: unknown,
  override?: string,
) {
  const configuration =
    repository &&
    ((await tx.get('publication_config', configurationId(organization, repository)))?.data as any);
  const mode = override ?? configuration?.defaultMode ?? 'confirmed-content';
  if (mode === 'report-reference' && version !== 5)
    fail(422, 'Report references require Work Item Type version 5');
  return mode;
}
const configurationSchema = z.strictObject({
  organization: identifier,
  repository: identifier,
  source: identifier,
  enabled: z.boolean(),
  credential: identifier,
  endpoint: z.url(),
  githubRepository: z
    .string()
    .regex(/^[A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+$/)
    .optional(),
  key: text.optional(),
  defaultMode: publicationModeSchema.default('confirmed-content'),
});
export const configurationId = (organization: string, repository: string) =>
  digest(stable([organization, repository]));
export const publicationPurpose = (credential: string) => `publication:${credential}`;
function configurationBinding(data: Record<string, any>) {
  const { version: _version, destinationVersion: _destinationVersion, ...binding } = data;
  return { ...binding, defaultMode: data.defaultMode ?? 'confirmed-content' };
}
function destinationBinding(data: Record<string, any>) {
  const { defaultMode: _defaultMode, ...binding } = configurationBinding(data);
  return binding;
}

export async function putPublicationConfiguration(
  store: Store,
  secrets: OrganizationSecrets,
  raw: unknown,
  allowedHosts: string[],
  allowLoopback = false,
) {
  const { key, ...input } = configurationSchema.parse(raw);
  const endpoint = await validateEndpoint(input.endpoint, allowedHosts, allowLoopback);
  if (endpoint.origin !== input.endpoint) fail(422, 'Publication endpoint must be an origin');
  return store.transaction(async (tx) => {
    const repository = await tx.get('repository', input.repository);
    const sources = await tx.list(
      'provider_source',
      'organization = $organization AND source = $source',
      input,
    );
    const source = sources[0];
    if (
      !repository ||
      repository.organization !== input.organization ||
      !source ||
      source.repository !== repository.id ||
      source.project !== repository.project
    )
      fail(422, 'Publication source ownership mismatch');
    const external = source.external as any;
    if ((external.provider === 'github') !== !!input.githubRepository)
      fail(422, 'GitHub repository name required only for GitHub');
    if (
      !allowLoopback &&
      endpoint.hostname !== (external.provider === 'github' ? 'api.github.com' : 'dev.azure.com')
    )
      fail(422, 'Publication provider endpoint mismatch');
    const id = configurationId(input.organization, input.repository);
    const prior = (await tx.get('publication_config', id))?.data as any;
    const binding = { ...input, external, sourceId: source.id };
    const version =
      prior && stable(configurationBinding(prior)) === stable(configurationBinding(binding))
        ? prior.version
        : randomUUID();
    const destinationVersion =
      prior && stable(destinationBinding(prior)) === stable(destinationBinding(binding))
        ? (prior.destinationVersion ?? prior.version)
        : version;
    // A write credential cannot silently acquire another provider/destination scope.
    for (const config of await tx.list(
      'publication_config',
      'organization = $organization',
      input,
    )) {
      const data = config.data as any;
      if (config.id !== id && data.credential === input.credential)
        fail(422, 'Publication credentials cannot be shared across destinations');
    }
    if (
      prior?.credential === input.credential &&
      (stable(prior.external) !== stable(external) ||
        prior.endpoint !== input.endpoint ||
        prior.githubRepository !== input.githubRepository)
    )
      fail(422, 'Use a new credential when rebinding a publication destination');
    if (key) await secrets.write(tx, input.organization, publicationPurpose(input.credential), key);
    else
      await secrets.readInTransaction(tx, input.organization, publicationPurpose(input.credential));
    const data = { ...binding, version, destinationVersion };
    await tx.put('publication_config', { id, organization: input.organization, data });
    await tx.create('audit', {
      id: randomUUID(),
      organization: input.organization,
      actor: 'operator',
      kind: 'publication.configured',
      resource: id,
      recordedAt: Date.now(),
      decision: data,
    });
    return data;
  });
}

export async function publicationDestination(tx: Transaction, item: Row) {
  const config = await tx.get(
    'publication_config',
    configurationId(String(item.organization), String(item.repository)),
  );
  const data = config?.data as any;
  const source = data && (await tx.get('provider_source', data.sourceId));
  if (
    !data?.enabled ||
    !source?.enabled ||
    source.organization !== item.organization ||
    source.project !== item.project ||
    source.repository !== item.repository ||
    stable(source.external) !== stable(data.external)
  )
    fail(409, 'Publication destination unavailable');
  const matches = await tx.list(
    'correspondence',
    'organization = $organization AND workItem = $workItem',
    { organization: item.organization, workItem: item.id },
  );
  if (matches.length !== 1) fail(409, 'Provider correspondence required for publication');
  const match = matches[0],
    external = data.external;
  const resource = JSON.parse(String(match.resource));
  if (
    match.repository !== item.repository ||
    match.project !== item.project ||
    match.type !== item.type ||
    resource[0] !== external.provider ||
    (external.provider === 'github'
      ? resource[1] !== external.repository
      : resource[1] !== external.collection || resource[2] !== external.repository)
  )
    fail(409, 'Publication correspondence mismatch');
  const number = resource.at(-1);
  if (!Number.isSafeInteger(number) || number < 1) fail(409, 'Invalid provider pull request');
  const path =
    external.provider === 'github'
      ? `/repos/${data.githubRepository}/issues/${number}/comments`
      : `/${encodeURIComponent(external.organization)}/${external.project}/_apis/git/repositories/${external.repository}/pullRequests/${number}/threads`;
  return {
    ...destinationBinding(data),
    version: data.destinationVersion ?? data.version,
    number,
    path,
  };
}

export class PublicationRejected extends Error {}
export class PublicationDispatchBlocked extends Error {}
export type ProviderEffect = { id: string; contentDigest: string };
const effect = (provider: string, value: any, content: string): ProviderEffect | undefined => {
  if (!Number.isSafeInteger(value?.id) || value.id < 1) return;
  const actual =
    provider === 'github'
      ? value.body
      : value.comments?.find((c: any) => c.content === content && !c.isDeleted)?.content;
  if (value.isDeleted || actual !== content) return;
  return { id: String(value.id), contentDigest: digest(actual) };
};
export class PublicationProvider {
  constructor(
    private readonly allowedHosts: string[],
    private readonly allowLoopback: boolean,
  ) {}
  private async verifyRepository(destination: any, key: string, signal?: AbortSignal) {
    const external = destination.external;
    const path =
      external.provider === 'github'
        ? `/repos/${destination.githubRepository}`
        : `/${encodeURIComponent(external.organization)}/${external.project}/_apis/git/repositories/${external.repository}`;
    const { value } = await this.request(
      { ...destination, path },
      key,
      'GET',
      undefined,
      1,
      undefined,
      signal,
    );
    if (
      String(value.id).toLowerCase() !== external.repository ||
      (external.provider !== 'github' &&
        String(value.project?.id).toLowerCase() !== external.project)
    )
      throw Error('Provider repository identity mismatch');
  }
  private async request(
    destination: any,
    key: string,
    method: 'GET' | 'POST',
    content?: string,
    page = 1,
    beforePost?: () => Promise<string>,
    signal?: AbortSignal,
  ) {
    await validateEndpoint(destination.endpoint, this.allowedHosts, this.allowLoopback);
    if (method === 'POST' && beforePost) key = await beforePost();
    const github = destination.external.provider === 'github';
    const query = github
      ? method === 'GET'
        ? `?per_page=100&page=${page}`
        : ''
      : '?api-version=7.1';
    const response = await fetch(`${destination.endpoint}${destination.path}${query}`, {
      method,
      redirect: 'error',
      signal: signal
        ? AbortSignal.any([signal, AbortSignal.timeout(15000)])
        : AbortSignal.timeout(15000),
      headers: {
        authorization: github
          ? `Bearer ${key}`
          : `Basic ${Buffer.from(`:${key}`).toString('base64')}`,
        'content-type': 'application/json',
        accept: 'application/json',
        ...(github ? { 'X-GitHub-Api-Version': '2022-11-28' } : {}),
      },
      ...(method === 'POST'
        ? {
            body: JSON.stringify(
              github
                ? { body: content }
                : { comments: [{ parentCommentId: 0, content, commentType: 1 }], status: 1 },
            ),
          }
        : {}),
    });
    if (!response.ok) {
      await response.body?.cancel();
      if (method === 'POST' && [400, 401, 403, 404, 422, 429].includes(response.status))
        throw new PublicationRejected(`Provider rejected publication (${response.status})`);
      throw Error('Provider outcome unavailable');
    }
    const value = await response.json();
    return { value, more: !!response.headers.get('link')?.includes('rel="next"') };
  }
  async publish(
    destination: any,
    key: string,
    content: string,
    beforePost: () => Promise<string>,
    signal?: AbortSignal,
  ) {
    await this.verifyRepository(destination, key, signal);
    const { value } = await this.request(destination, key, 'POST', content, 1, beforePost, signal);
    const result = effect(destination.external.provider, value, content);
    if (!result) throw Error('Provider success could not be confirmed');
    return result;
  }
  async evidence(destination: any, key: string, content: string) {
    const matches: ProviderEffect[] = [];
    try {
      await this.verifyRepository(destination, key);
      for (let page = 1; page <= 20; page++) {
        const { value, more } = await this.request(destination, key, 'GET', undefined, page);
        const values = destination.external.provider === 'github' ? value : value.value;
        if (!Array.isArray(values)) throw Error('Provider evidence unavailable');
        for (const candidate of values) {
          const result = effect(destination.external.provider, candidate, content);
          if (result) matches.push(result);
        }
        if (destination.external.provider !== 'github' || (!more && values.length < 100))
          return { matches, complete: true };
      }
      return { matches, complete: false };
    } catch {
      return { matches, complete: false, unavailable: true };
    }
  }
}
