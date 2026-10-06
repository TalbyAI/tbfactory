import { ZodError } from 'zod';
import { FactoryError, fail } from './contracts';
import { type Factory, type Operation } from './factory';
import { type Authentication } from './auth';
import { type OrganizationSecrets } from './secrets';
import { ingestObservation } from './observations';
import { type ReviewArtifacts } from './review-artifacts';
import { readSharedArtifact } from './artifact-sharing';

export type Services = {
  auth: Authentication;
  factory: Factory;
  origin: string;
  secrets?: OrganizationSecrets;
  allowLoopbackHttp?: boolean;
  artifacts?: ReviewArtifacts;
};
export const sessionCookie = '__Host-factory_session';
export function cookieValue(request: Request, name: string) {
  return request.headers
    .get('cookie')
    ?.split(';')
    .map((c) => c.trim())
    .find((c) => c.startsWith(`${name}=`))
    ?.slice(name.length + 1);
}
export function browserMutation(request: Request, origin: string) {
  if (
    request.headers.get('origin') !== origin ||
    request.headers.get('sec-fetch-site') === 'cross-site'
  )
    fail(403, 'Browser request origin denied');
}
function route(url: URL, method: string): Operation {
  const p = url.pathname.split('/').filter(Boolean);
  const query = Object.fromEntries(url.searchParams);
  if (p.join('/') === 'api/organizations' && method === 'GET')
    return { action: 'organizations', query };
  if (p.join('/') === 'api/invitations/accept' && method === 'POST')
    return { action: 'invitation.accept' };
  if (p.join('/') === 'api/invitations/preview' && method === 'GET')
    return { action: 'invitation.preview', query };
  if (p[0] !== 'api' || p[1] !== 'organizations' || !p[2]) fail(404, 'Resource not found');
  const base = { organization: p[2], query };
  if (p[3] === 'teams') {
    if (p.length === 4 && ['GET', 'POST'].includes(method))
      return { ...base, action: method === 'GET' ? 'team.list' : 'team.manage' };
    if (p.length === 5 && method === 'POST')
      return { ...base, action: 'team.manage', resource: p[4] };
  }
  if (p[3] === 'policies') {
    if (p.length === 4 && ['GET', 'POST'].includes(method))
      return { ...base, action: method === 'GET' ? 'policy.list' : 'policy.manage' };
    if (p.length === 6 && p[5] === 'remove' && method === 'POST')
      return { ...base, action: 'policy.remove', resource: p[4] };
  }
  if (p.length === 4 && p[3] === 'work-item-types' && ['GET', 'POST'].includes(method))
    return { ...base, action: method === 'GET' ? 'type.list' : 'type.manage' };
  if (p.length === 4 && p[3] === 'board' && method === 'GET') return { ...base, action: 'board' };
  if (p.length === 4 && p[3] === 'projects' && method === 'GET')
    return { ...base, action: 'projects' };
  if (p[3] === 'api-credentials') {
    if (p.length === 4 && method === 'GET') return { ...base, action: 'credential.list' };
    if (p.length === 4 && method === 'POST') return { ...base, action: 'credential.issue' };
    if (p.length === 6 && p[5] === 'revoke' && method === 'POST')
      return { ...base, resource: p[4], action: 'credential.revoke' };
  }
  if (p[3] === 'invitations') {
    if (p.length === 4 && method === 'POST') return { ...base, action: 'invitation.issue' };
    if (p.length === 6 && p[5] === 'revoke' && method === 'POST')
      return { ...base, resource: p[4], action: 'invitation.revoke' };
  }
  if (p[3] === 'work-items') {
    if (p.length === 6 && p[5] === 'artifact-shares' && ['GET', 'POST'].includes(method))
      return {
        ...base,
        resource: p[4],
        action: method === 'GET' ? 'sharing.list' : 'sharing.create',
      };
    if (
      p.length === 8 &&
      p[5] === 'artifact-shares' &&
      ['approve', 'revoke', 'revoke-approve'].includes(p[7]) &&
      method === 'POST'
    )
      return { ...base, resource: p[4], request: p[6], action: `sharing.${p[7]}` };
    if (p.length === 6 && method === 'POST') {
      const publicationActions: Record<string, string> = {
        'review-publications': 'request',
        'publication-approval': 'approve',
        'publication-reconciliation': 'reconcile',
        'publication-confirmation': 'confirm',
      };
      if (publicationActions[p[5]])
        return { ...base, resource: p[4], action: `publication.${publicationActions[p[5]]}` };
    }
    if (p.length === 6 && p[5] === 'review-decisions' && method === 'POST')
      return { ...base, resource: p[4], action: 'review.decide' };
    if (p.length === 6 && p[5] === 'reviews' && method === 'GET')
      return { ...base, resource: p[4], action: 'review.list' };
    if (p.length === 6 && p[5] === 'review-facts' && method === 'POST')
      return { ...base, resource: p[4], action: 'review.facts' };
    if (p.length === 6 && p[5] === 'review-approval' && method === 'POST')
      return { ...base, resource: p[4], action: 'review.approve' };
    if (p.length === 6 && p[5] === 'review-supersession' && method === 'POST')
      return { ...base, resource: p[4], action: 'review.supersede' };
    if (p.length === 6 && p[5] === 'transition-requests' && ['GET', 'POST'].includes(method))
      return {
        ...base,
        resource: p[4],
        action: method === 'GET' ? 'transition.list' : 'transition.request',
      };
    if (
      p.length === 8 &&
      p[5] === 'transition-requests' &&
      ['approve', 'execute'].includes(p[7]) &&
      method === 'POST'
    )
      return { ...base, resource: p[4], request: p[6], action: `transition.${p[7]}` };
    if (p.length === 4 && method === 'GET') return { ...base, action: 'work-item.list' };
    if (p.length === 4 && method === 'POST') return { ...base, action: 'work-item.create' };
    if (p.length === 5 && method === 'GET')
      return { ...base, resource: p[4], action: 'work-item.read' };
    if (p.length === 6 && p[5] === 'facts' && method === 'GET')
      return { ...base, resource: p[4], action: 'history.read' };
    if (p.length === 6 && p[5] === 'notes' && method === 'POST')
      return { ...base, resource: p[4], action: 'note.append' };
    if (p.length === 6 && p[5] === 'corrections' && method === 'POST')
      return { ...base, resource: p[4], action: 'correction.append' };
    if (p.length === 6 && p[5] === 'references' && method === 'POST')
      return { ...base, resource: p[4], action: 'reference.append' };
  }
  fail(404, 'Resource not found');
}
export async function handleHttp(request: Request, services: Services): Promise<Response> {
  try {
    const url = new URL(request.url);
    const sourceRoute = /^\/api\/organizations\/([^/]+)\/sources\/([^/]+)\/observations$/.exec(
      url.pathname,
    );
    if (sourceRoute && request.method === 'POST') {
      const loopback =
        services.allowLoopbackHttp &&
        ['localhost', '127.0.0.1', '[::1]'].includes(url.hostname) &&
        url.origin === services.origin;
      if (url.protocol !== 'https:' && !loopback) fail(403, 'Source ingestion requires HTTPS');
      if (!services.secrets) fail(503, 'Source ingestion unavailable');
      return Response.json(
        await ingestObservation(
          services.factory.store,
          services.secrets,
          request,
          sourceRoute[1],
          sourceRoute[2],
        ),
        { headers: { 'cache-control': 'no-store' } },
      );
    }
    const bearer = request.headers.get('authorization');
    if (bearer && !/^Bearer [A-Za-z0-9_-]{43}$/.test(bearer)) fail(401, 'Invalid authentication');
    const caller = await services.auth.authenticate(
      bearer?.slice(7) ?? cookieValue(request, sessionCookie),
      Boolean(bearer),
    );
    if (!['GET', 'HEAD'].includes(request.method) && caller.human)
      browserMutation(request, services.origin);
    const sharedRoute = /^\/api\/shared-reports\/([^/]+)$/.exec(url.pathname);
    if (sharedRoute && request.method === 'GET') {
      if (!services.artifacts) fail(503, 'Artifact storage unavailable');
      const content = await readSharedArtifact(
        services.factory.store,
        services.artifacts,
        caller,
        sharedRoute[1],
      );
      return new Response(new Uint8Array(content), {
        headers: {
          'content-type': 'text/markdown; charset=utf-8',
          'content-disposition': 'attachment; filename="confirmed-findings.md"',
          'cache-control': 'no-store',
          'x-content-type-options': 'nosniff',
        },
      });
    }
    const artifactRoute =
      /^\/api\/organizations\/([^/]+)\/work-items\/([^/]+)\/reviews\/([^/]+)\/artifact$/.exec(
        url.pathname,
      );
    if (artifactRoute && request.method === 'GET') {
      if (!services.artifacts) fail(503, 'Artifact storage unavailable');
      const content = await services.artifacts.read(
        services.factory.store,
        caller,
        artifactRoute[1],
        artifactRoute[2],
        artifactRoute[3],
      );
      return new Response(new Uint8Array(content), {
        headers: {
          'content-type': 'text/markdown; charset=utf-8',
          'content-disposition': 'attachment; filename="private-review.md"',
          'cache-control': 'no-store',
          'x-content-type-options': 'nosniff',
        },
      });
    }
    const operation = route(url, request.method);
    if (request.method === 'POST') {
      if (!request.headers.get('content-type')?.startsWith('application/json'))
        fail(422, 'Expected JSON input');
      const body = await request.text();
      if (body.length > 65536) fail(422, 'Input too large');
      try {
        operation.input = JSON.parse(body);
      } catch {
        fail(422, 'Invalid JSON input');
      }
    }
    const result = await services.factory.execute(caller, operation);
    return Response.json(result, { headers: { 'cache-control': 'no-store' } });
  } catch (error) {
    return errorResponse(error);
  }
}
export function errorResponse(error: unknown): Response {
  const status =
    error instanceof FactoryError ? error.status : error instanceof ZodError ? 422 : 500;
  return Response.json(
    {
      error:
        status === 500
          ? 'Operation failed'
          : error instanceof ZodError
            ? 'Invalid input'
            : (error as Error).message,
    },
    { status, headers: { 'cache-control': 'no-store' } },
  );
}
