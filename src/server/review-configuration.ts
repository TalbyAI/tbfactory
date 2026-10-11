import { randomUUID } from 'node:crypto';
import { lookup } from 'node:dns/promises';
import { isIP } from 'node:net';
import { z } from 'zod';
import { digest, fail, identifier, stable } from './contracts';
import { type Store } from './store';
import { type OrganizationSecrets } from './secrets';
import { membershipId } from './provision';

export const limitsSchema = z.strictObject({
  calls: z.number().int().min(1).max(10000).default(40),
  aiMs: z.number().int().min(1).max(86400000).default(600000),
  executionMs: z.number().int().min(1).max(86400000).default(1200000),
  subordinateAgents: z.number().int().min(0).max(16).default(4),
});
const aiSchema = z.strictObject({
  adapter: z.enum(['openrouter', 'openai-chat', 'openai-responses', 'anthropic']),
  url: z.url().max(2000),
  model: z.string().min(1).max(200),
  permittedModels: z
    .array(
      z.strictObject({
        id: z.string().min(1).max(200),
        tools: z.boolean(),
        reasoning: z.array(z.enum(['none', 'low', 'medium', 'high', 'max'])).default([]),
      }),
    )
    .min(1)
    .max(50),
  reasoningEffort: z.enum(['none', 'low', 'medium', 'high', 'max']).optional(),
  upstream: z.enum(['openai']).optional(),
});
export const reviewConfigSchema = z.strictObject({
  organization: identifier,
  enabled: z.boolean(),
  mode: z.enum(['organization', 'platform']),
  entitled: z.boolean().default(false),
  ai: aiSchema,
  key: z.string().min(1).max(10000).optional(),
  limits: limitsSchema.default({
    calls: 40,
    aiMs: 600000,
    executionMs: 1200000,
    subordinateAgents: 4,
  }),
  rules: z.strictObject({
    enabled: z.boolean().default(false),
    repositories: z.array(identifier).max(100),
    targetBranches: z.array(z.string().min(1).max(300)).max(100),
    includeDrafts: z.boolean().default(false),
  }),
});
export const repositoryAccessSchema = z.strictObject({
  organization: identifier,
  repository: identifier,
  credential: identifier,
  provider: z.enum(['github', 'azure-devops']),
  urls: z.array(z.url().max(2000)).min(1).max(100),
  key: z.string().min(1).max(10000).optional(),
  enabled: z.boolean(),
});
export function publicHost(host: string) {
  const h = host.replace(/^\[|\]$/g, '').toLowerCase();
  if (h === 'localhost' || h.endsWith('.localhost') || h.endsWith('.local')) return false;
  if (isIP(h) === 4) {
    const [a, b] = h.split('.').map(Number);
    return !(
      a === 0 ||
      a === 10 ||
      a === 127 ||
      (a === 169 && b === 254) ||
      (a === 172 && b >= 16 && b <= 31) ||
      (a === 192 && b === 168) ||
      a >= 224 ||
      (a === 100 && b >= 64 && b <= 127)
    );
  }
  if (isIP(h) === 6)
    return !(
      h === '::' ||
      h === '::1' ||
      h.startsWith('fc') ||
      h.startsWith('fd') ||
      h.startsWith('fe80') ||
      h.startsWith('::ffff:')
    );
  return true;
}
export async function validateEndpoint(
  value: string,
  allowedHosts: string[],
  allowLoopback = false,
) {
  const url = new URL(value);
  if (
    url.username ||
    url.password ||
    url.hash ||
    url.search ||
    !allowedHosts.includes(url.hostname)
  )
    fail(422, 'Endpoint is not installation-approved');
  const loopback =
    allowLoopback &&
    ['localhost', '127.0.0.1', '[::1]', 'host.docker.internal'].includes(url.hostname);
  if (
    !loopback &&
    (url.protocol !== 'https:' || (url.port && url.port !== '443') || !publicHost(url.hostname))
  )
    fail(422, 'Endpoint requires public HTTPS');
  if (!loopback) {
    const addresses = await lookup(url.hostname, { all: true });
    if (!addresses.length || addresses.some((a) => !publicHost(a.address)))
      fail(422, 'Endpoint address denied');
  }
  return url;
}
export const serviceUser = (organization: string) => `service_${digest(organization).slice(0, 32)}`;
export async function putReviewConfiguration(
  store: Store,
  secrets: OrganizationSecrets,
  raw: unknown,
  allowedHosts: string[],
  allowLoopback = false,
) {
  const { key, ...input } = reviewConfigSchema.parse(raw);
  await validateEndpoint(input.ai.url, allowedHosts, allowLoopback);
  const capability = input.ai.permittedModels.find((m) => m.id === input.ai.model);
  if (
    !capability?.tools ||
    (input.ai.reasoningEffort && !capability.reasoning.includes(input.ai.reasoningEffort))
  )
    fail(422, 'Selected model capability is not approved');
  if (
    input.ai.adapter === 'openrouter' &&
    (!input.ai.model.includes('/') || input.ai.upstream !== 'openai')
  )
    fail(422, 'OpenRouter requires explicit supported upstream');
  if (input.ai.adapter === 'anthropic' && input.ai.reasoningEffort)
    fail(422, 'Anthropic reasoning configuration is not supported by this adapter');
  return store.transaction(async (tx) => {
    if (!(await tx.get('organization', input.organization))) fail(404, 'Organization not found');
    for (const repository of input.rules.repositories)
      if ((await tx.get('repository', repository))?.organization !== input.organization)
        fail(404, 'Repository not found');
    const previous = await tx.get('review_config', input.organization);
    const credential = `${input.mode}:review-ai:${digest(stable([input.ai.adapter, input.ai.url]))}`;
    if (key) await secrets.write(tx, input.organization, credential, key);
    if (
      !key &&
      !(
        await tx.list('secret', 'organization = $organization AND purpose = $purpose', {
          organization: input.organization,
          purpose: credential,
        })
      ).length
    )
      fail(422, 'Provider API key required');
    const data = {
      ...input,
      credential,
      version: Number((previous?.data as any)?.version ?? 0) + 1,
    };
    await tx.put('ai_resource', {
      id: digest(stable([input.organization, credential])),
      organization: input.organization,
      data: {
        credential,
        enabled: input.enabled,
        mode: input.mode,
        adapter: input.ai.adapter,
        url: input.ai.url,
      },
    });
    await tx.put('review_config', {
      id: input.organization,
      organization: input.organization,
      data,
    });
    const user = serviceUser(input.organization);
    if (!(await tx.get('user', user)))
      await tx.create('user', {
        id: user,
        issuer: 'urn:tbfactory:service',
        subject: input.organization,
        verified: false,
        createdAt: Date.now(),
      });
    await tx.put('membership', {
      id: membershipId(user, input.organization),
      user,
      organization: input.organization,
      active: true,
    });
    await tx.create('audit', {
      id: randomUUID(),
      organization: input.organization,
      actor: 'operator',
      kind: 'review.configured',
      resource: input.organization,
      recordedAt: Date.now(),
      decision: { ...data, serviceIdentity: user },
    });
    return { ...data, serviceIdentity: user };
  });
}
export async function revokeReviewResource(store: Store, raw: unknown) {
  const input = z
    .strictObject({ organization: identifier, credential: z.string().min(1).max(200) })
    .parse(raw);
  return store.transaction(async (tx) => {
    const resource = await tx.get(
      'ai_resource',
      digest(stable([input.organization, input.credential])),
    );
    if (!resource || resource.organization !== input.organization)
      fail(404, 'AI resource not found');
    await tx.put('ai_resource', {
      ...resource,
      data: { ...(resource.data as object), enabled: false },
    });
    await tx.create('audit', {
      id: randomUUID(),
      organization: input.organization,
      actor: 'operator',
      kind: 'review-resource.revoked',
      resource: resource.id,
      recordedAt: Date.now(),
      decision: input,
    });
    return { revoked: true, credential: input.credential };
  });
}
export async function putRepositoryAccess(
  store: Store,
  secrets: OrganizationSecrets,
  raw: unknown,
  allowedHosts: string[],
  allowLoopback = false,
) {
  const { key, ...input } = repositoryAccessSchema.parse(raw);
  for (const url of input.urls) {
    const endpoint = await validateEndpoint(url, allowedHosts, allowLoopback);
    if (
      !allowLoopback &&
      !(
        (input.provider === 'github' &&
          endpoint.hostname === 'github.com' &&
          /^\/[A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+(?:\.git)?$/.test(endpoint.pathname)) ||
        (input.provider === 'azure-devops' &&
          endpoint.hostname === 'dev.azure.com' &&
          /^\/[^/]+\/[^/]+\/_git\/[^/]+$/.test(endpoint.pathname))
      )
    )
      fail(422, 'Repository provider URL mismatch');
  }
  return store.transaction(async (tx) => {
    if ((await tx.get('repository', input.repository))?.organization !== input.organization)
      fail(404, 'Repository not found');
    const existing = await tx.list('repository_access', 'organization = $organization', {
      organization: input.organization,
    });
    for (const access of existing)
      if (
        (access.data as any).credential === input.credential &&
        ((access.data as any).provider !== input.provider ||
          stable((access.data as any).urls) !== stable(input.urls))
      )
        fail(422, 'Shared Repository Access Credential scope mismatch');
    if (key) await secrets.write(tx, input.organization, `repository:${input.credential}`, key);
    if (
      !key &&
      !(
        await tx.list('secret', 'organization = $organization AND purpose = $purpose', {
          organization: input.organization,
          purpose: `repository:${input.credential}`,
        })
      ).length
    )
      fail(422, 'Repository read key required');
    await tx.put('repository_access', {
      id: input.repository,
      organization: input.organization,
      data: input,
    });
    await tx.create('audit', {
      id: randomUUID(),
      organization: input.organization,
      actor: 'operator',
      kind: 'repository-access.configured',
      resource: input.repository,
      recordedAt: Date.now(),
      decision: input,
    });
    return input;
  });
}
