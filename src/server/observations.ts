import { createHmac, randomUUID, timingSafeEqual } from 'node:crypto';
import { z } from 'zod';
import { digest, fail, identifier, stable, text } from './contracts';
import { type Row, type Store, type Transaction } from './store';
import { type OrganizationSecrets } from './secrets';
import { definition, selection } from './work-item-types';

const guid = z.guid().transform((value) => value.toLowerCase());
const positive = z.number().int().positive().max(Number.MAX_SAFE_INTEGER);
const commit = z
  .string()
  .regex(/^[a-fA-F0-9]{40,64}$/)
  .transform((value) => value.toLowerCase());
const externalSchema = z.discriminatedUnion('provider', [
  z.strictObject({
    provider: z.literal('github'),
    repository: z
      .string()
      .regex(/^[1-9][0-9]*$/)
      .refine((value) => Number.isSafeInteger(Number(value))),
  }),
  z.strictObject({
    provider: z.literal('azure-devops'),
    organization: z.string().regex(/^[a-zA-Z0-9_-]{1,100}$/),
    collection: guid,
    project: guid,
    repository: guid,
  }),
]);
const sourceSchema = z.strictObject({
  organization: identifier,
  source: identifier,
  project: identifier,
  repository: identifier,
  type: z.literal('pull-request-review'),
  external: externalSchema,
  enabled: z.boolean(),
  secret: z
    .string()
    .min(32)
    .max(300)
    .regex(/^[A-Za-z0-9_-]+$/),
});
type External = z.infer<typeof externalSchema>;
type Source = {
  organization: string;
  source: string;
  project: string;
  repository: string;
  type: string;
  external: External;
};
const sourceId = (organization: string, source: string) => digest(stable([organization, source]));
const sourcePurpose = (source: string) => `source:${source}`;

async function ownership(tx: Transaction, source: Source) {
  if (!(await tx.get('organization', source.organization))) fail(404, 'Resource not found');
  const project = await tx.get('project', source.project);
  const repository = await tx.get('repository', source.repository);
  if (
    !project ||
    project.organization !== source.organization ||
    !repository ||
    repository.organization !== source.organization
  )
    fail(404, 'Resource not found');
  if (repository.project !== project.id) fail(409, 'Invalid Repository ownership');
}

/** Trusted operator command. Never exposes source credentials or their digests. */
export async function putSource(store: Store, secrets: OrganizationSecrets, raw: unknown) {
  const { secret, enabled, ...binding } = sourceSchema.parse(raw);
  const id = sourceId(binding.organization, binding.source);
  return store.transaction(async (tx) => {
    await ownership(tx, binding);
    const existing = await tx.get('provider_source', id);
    if (existing) {
      const { id: _id, enabled: _enabled, fingerprint: _fingerprint, ...previous } = existing;
      if (stable(previous) !== stable(binding)) fail(409, 'Source binding is immutable');
    }
    const fingerprint = digest(secret);
    if (
      (await tx.list('provider_source', 'fingerprint = $fingerprint', { fingerprint })).some(
        (other) => other.id !== id,
      )
    )
      fail(409, 'Source credential must be unique');
    await secrets.write(tx, binding.organization, sourcePurpose(binding.source), secret);
    await tx.put('provider_source', { id, ...binding, enabled, fingerprint });
    await tx.create('audit', {
      id: randomUUID(),
      organization: binding.organization,
      actor: 'operator',
      kind: 'source.configured',
      resource: id,
      recordedAt: Date.now(),
      decision: { ...binding, enabled },
    });
    return { ...binding, enabled };
  });
}

const githubRepository = z.object({
  id: positive,
  full_name: z.string().regex(/^[A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+$/),
});
const githubPayload = z.object({
  action: identifier,
  number: positive,
  repository: githubRepository,
  pull_request: z.object({
    number: positive,
    title: text.max(300),
    state: z.enum(['open', 'closed']),
    merged: z.boolean(),
    head: z.object({ sha: commit }),
    base: z.object({ sha: commit, repo: githubRepository }),
  }),
});
const azurePayload = z.object({
  id: guid,
  publisherId: z.literal('tfs'),
  eventType: z.enum([
    'git.pullrequest.created',
    'git.pullrequest.updated',
    'git.pullrequest.merged',
  ]),
  resourceContainers: z.object({ collection: z.object({ id: guid }) }),
  resource: z.object({
    repository: z.object({ id: guid, project: z.object({ id: guid }) }),
    pullRequestId: positive,
    title: text.max(300),
    status: z.enum(['active', 'completed', 'abandoned']),
    lastMergeSourceCommit: z.object({ commitId: commit }),
    lastMergeTargetCommit: z.object({ commitId: commit }),
  }),
});
type Observation = {
  provider: External['provider'];
  resource: string;
  eventId: string;
  event: string;
  title: string;
  state: string;
  head: string;
  base: string;
  locator: string;
  merged?: boolean;
};

function normalize(source: Source, request: Request, raw: unknown): Observation {
  const external = source.external;
  if (external.provider === 'github') {
    if (request.headers.get('x-github-event') !== 'pull_request')
      fail(422, 'Unsupported provider event');
    const eventId = identifier.parse(request.headers.get('x-github-delivery'));
    const payload = githubPayload.parse(raw);
    const pr = payload.pull_request;
    if (
      String(payload.repository.id) !== external.repository ||
      payload.repository.id !== pr.base.repo.id ||
      payload.number !== pr.number ||
      payload.repository.full_name.toLowerCase() !== pr.base.repo.full_name.toLowerCase()
    )
      fail(409, 'Provider resource mismatch');
    return {
      provider: 'github',
      resource: stable(['github', external.repository, pr.number]),
      eventId,
      event: payload.action,
      title: pr.title,
      state: pr.state,
      merged: pr.merged,
      head: pr.head.sha,
      base: pr.base.sha,
      locator: `https://github.com/${payload.repository.full_name}/pull/${pr.number}`,
    };
  }
  const payload = azurePayload.parse(raw);
  const pr = payload.resource;
  if (
    pr.repository.id !== external.repository ||
    pr.repository.project.id !== external.project ||
    payload.resourceContainers.collection.id !== external.collection
  )
    fail(409, 'Provider resource mismatch');
  return {
    provider: 'azure-devops',
    resource: stable(['azure-devops', external.collection, external.repository, pr.pullRequestId]),
    eventId: payload.id,
    event: payload.eventType,
    title: pr.title,
    state: pr.status,
    head: pr.lastMergeSourceCommit.commitId,
    base: pr.lastMergeTargetCommit.commitId,
    locator: `https://dev.azure.com/${external.organization}/${external.project}/_git/${external.repository}/pullrequest/${pr.pullRequestId}`,
  };
}

function authenticate(source: Source, request: Request, body: Buffer, secret: string) {
  if (source.external.provider === 'github') {
    const signature = request.headers.get('x-hub-signature-256');
    if (!signature || !/^sha256=[a-fA-F0-9]{64}$/.test(signature))
      fail(401, 'Invalid source authentication');
    const expected = createHmac('sha256', secret).update(body).digest();
    if (!timingSafeEqual(expected, Buffer.from(signature.slice(7), 'hex')))
      fail(401, 'Invalid source authentication');
  } else {
    const expected = Buffer.from(`Basic ${Buffer.from(`factory:${secret}`).toString('base64')}`);
    const supplied = Buffer.from(request.headers.get('authorization') ?? '');
    if (expected.length !== supplied.length || !timingSafeEqual(expected, supplied))
      fail(401, 'Invalid source authentication');
  }
}

async function requestBody(request: Request) {
  if (
    request.headers.get('content-type')?.split(';')[0].trim().toLowerCase() !== 'application/json'
  )
    fail(422, 'Expected JSON input');
  const reader = request.body?.getReader();
  if (!reader) fail(422, 'Expected JSON input');
  const chunks: Uint8Array[] = [];
  let size = 0;
  while (true) {
    const { value, done } = await reader.read();
    if (done) break;
    size += value.byteLength;
    if (size > 1048576) {
      await reader.cancel();
      fail(422, 'Input too large');
    }
    chunks.push(value);
  }
  return Buffer.concat(chunks);
}

/** Provider-authenticated ingestion; never executes a User Activity or Workflow. */
export async function ingestObservation(
  store: Store,
  secrets: OrganizationSecrets,
  request: Request,
  organization: string,
  sourceName: string,
) {
  identifier.parse(organization);
  identifier.parse(sourceName);
  const body = await requestBody(request);
  return store.transaction(async (tx) => {
    const record = await tx.get('provider_source', sourceId(organization, sourceName));
    if (!record || record.organization !== organization || !record.enabled)
      fail(404, 'Resource not found');
    const source = record as Row & Source;
    await ownership(tx, source);
    const secret = await secrets.readInTransaction(tx, organization, sourcePurpose(sourceName));
    authenticate(source, request, body, secret);
    let raw: unknown;
    try {
      raw = JSON.parse(new TextDecoder('utf-8', { fatal: true }).decode(body));
    } catch {
      fail(422, 'Invalid JSON input');
    }
    if (source.external.provider === 'github' && request.headers.get('x-github-event') === 'ping')
      return { acknowledged: true };
    const observation = normalize(source, request, raw);
    const key = [organization, source.type, observation.resource];
    const correspondenceId = digest(stable(key));
    const correspondence = await tx.get('correspondence', correspondenceId);
    if (
      correspondence &&
      (correspondence.project !== source.project || correspondence.repository !== source.repository)
    )
      fail(409, 'Provider resource already bound to another scope');
    const receiptId = digest(stable([...key, observation.eventId]));
    const receipt = await tx.get('observation_delivery', receiptId);
    const observationDigest = digest(stable(observation));
    if (receipt) {
      if (receipt.digest !== observationDigest) fail(409, 'Provider event content mismatch');
      return receipt.result;
    }
    let item = correspondence
      ? await tx.get('work_item', String(correspondence.workItem))
      : undefined;
    let recordedAt = Date.now();
    if (
      correspondence &&
      (!item ||
        item.organization !== organization ||
        item.type !== source.type ||
        item.project !== source.project ||
        item.repository !== source.repository)
    )
      fail(409, 'Invalid provider correspondence');
    if (!item) {
      const configured = await selection(tx, organization);
      if (!configured.enabled) fail(409, 'Work Item Type disabled for creation');
      const selected = definition(configured.type, configured.version);
      item = await tx.create('work_item', {
        id: randomUUID(),
        organization,
        project: source.project,
        repository: source.repository,
        type: source.type,
        title: observation.title,
        version: selected.version,
        state: 'registered',
        actor: `source:${record.id}`,
        createdAt: recordedAt,
      });
      await tx.create('fact', {
        id: randomUUID(),
        organization,
        workItem: item.id,
        kind: 'work-item.created',
        payload: { title: item.title, type: item.type, version: item.version, state: 'registered' },
        actor: `source:${record.id}`,
        recordedAt,
      });
      await tx.create('correspondence', {
        id: correspondenceId,
        organization,
        type: source.type,
        resource: observation.resource,
        project: source.project,
        repository: source.repository,
        workItem: item.id,
      });
      recordedAt++;
    }
    const fact = await tx.create('fact', {
      id: randomUUID(),
      organization,
      workItem: item.id,
      kind: 'external.observation',
      payload: observation,
      actor: `source:${record.id}`,
      recordedAt,
    });
    const result = { workItemId: item.id, factId: fact.id };
    await tx.create('observation_delivery', {
      id: receiptId,
      organization,
      type: source.type,
      resource: observation.resource,
      eventId: observation.eventId,
      digest: observationDigest,
      result,
    });
    return result;
  });
}
