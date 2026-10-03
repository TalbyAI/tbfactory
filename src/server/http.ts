import { ZodError } from 'zod';
import { FactoryError, fail } from './contracts';
import { type Factory, type Operation } from './factory';
import { type Authentication } from './auth';

export type Services = { auth: Authentication; factory: Factory; origin: string };
export const sessionCookie = '__Host-factory_session';
export function cookieValue(request: Request, name: string) {
  return request.headers.get('cookie')?.split(';').map(c => c.trim()).find(c => c.startsWith(`${name}=`))?.slice(name.length + 1);
}
export function browserMutation(request: Request, origin: string) {
  if (request.headers.get('origin') !== origin || request.headers.get('sec-fetch-site') === 'cross-site') fail(403, 'Browser request origin denied');
}
function route(url: URL, method: string): Operation {
  const p = url.pathname.split('/').filter(Boolean);
  const query = Object.fromEntries(url.searchParams);
  if (p.join('/') === 'api/organizations' && method === 'GET') return { action: 'organizations', query };
  if (p.join('/') === 'api/invitations/accept' && method === 'POST') return { action: 'invitation.accept' };
  if (p.join('/') === 'api/invitations/preview' && method === 'GET') return { action: 'invitation.preview', query };
  if (p[0] !== 'api' || p[1] !== 'organizations' || !p[2]) fail(404, 'Resource not found');
  const base = { organization: p[2], query };
  if (p.length === 4 && p[3] === 'projects' && method === 'GET') return { ...base, action: 'projects' };
  if (p[3] === 'api-credentials') {
    if (p.length === 4 && method === 'GET') return { ...base, action: 'credential.list' };
    if (p.length === 4 && method === 'POST') return { ...base, action: 'credential.issue' };
    if (p.length === 6 && p[5] === 'revoke' && method === 'POST') return { ...base, resource: p[4], action: 'credential.revoke' };
  }
  if (p[3] === 'invitations') {
    if (p.length === 4 && method === 'POST') return { ...base, action: 'invitation.issue' };
    if (p.length === 6 && p[5] === 'revoke' && method === 'POST') return { ...base, resource: p[4], action: 'invitation.revoke' };
  }
  if (p[3] === 'work-items') {
    if (p.length === 4 && method === 'GET') return { ...base, action: 'work-item.list' };
    if (p.length === 4 && method === 'POST') return { ...base, action: 'work-item.create' };
    if (p.length === 5 && method === 'GET') return { ...base, resource: p[4], action: 'work-item.read' };
    if (p.length === 6 && p[5] === 'facts' && method === 'GET') return { ...base, resource: p[4], action: 'history.read' };
    if (p.length === 6 && p[5] === 'notes' && method === 'POST') return { ...base, resource: p[4], action: 'note.append' };
    if (p.length === 6 && p[5] === 'corrections' && method === 'POST') return { ...base, resource: p[4], action: 'correction.append' };
    if (p.length === 6 && p[5] === 'references' && method === 'POST') return { ...base, resource: p[4], action: 'reference.append' };
  }
  fail(404, 'Resource not found');
}
export async function handleHttp(request: Request, services: Services): Promise<Response> {
  try {
    const url = new URL(request.url);
    const bearer = request.headers.get('authorization');
    if (bearer && !/^Bearer [A-Za-z0-9_-]{43}$/.test(bearer)) fail(401, 'Invalid authentication');
    const caller = await services.auth.authenticate(bearer?.slice(7) ?? cookieValue(request, sessionCookie), Boolean(bearer));
    if (!['GET', 'HEAD'].includes(request.method) && caller.human) browserMutation(request, services.origin);
    const operation = route(url, request.method);
    if (request.method === 'POST') {
      if (!request.headers.get('content-type')?.startsWith('application/json')) fail(422, 'Expected JSON input');
      const body = await request.text(); if (body.length > 65536) fail(422, 'Input too large');
      try { operation.input = JSON.parse(body); } catch { fail(422, 'Invalid JSON input'); }
    }
    const result = await services.factory.execute(caller, operation);
    return Response.json(result, { headers: { 'cache-control': 'no-store' } });
  } catch (error) { return errorResponse(error); }
}
export function errorResponse(error: unknown): Response {
  const status = error instanceof FactoryError ? error.status : error instanceof ZodError ? 422 : 500;
  return Response.json({ error: status === 500 ? 'Operation failed' : error instanceof ZodError ? 'Invalid input' : (error as Error).message }, { status, headers: { 'cache-control': 'no-store' } });
}
