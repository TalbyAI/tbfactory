import { createServerFn } from '@tanstack/react-start';
import { z } from 'zod';

const pathSchema = z.string().regex(/^\/api\//).max(4000);
export const uiSession = createServerFn({ method: 'GET' }).handler(async () => {
  const { getRequest } = await import('@tanstack/react-start/server');
  const { getServices } = await import('./server/services');
  const { cookieValue, sessionCookie } = await import('./server/http');
  const services = await getServices();
  try {
    const caller = await services.auth.authenticate(cookieValue(getRequest(), sessionCookie));
    const user = await services.factory.store.transaction(tx => tx.get('user', caller.user));
    return { user: caller.user, name: String(user?.email ?? user?.subject) };
  } catch (error) { if ((error as { status: number }).status === 401) return null; throw error; }
});

export const uiRead = createServerFn({ method: 'GET' }).inputValidator(z.strictObject({ path: pathSchema })).handler(async ({ data }) => {
  const { getRequest } = await import('@tanstack/react-start/server');
  const { getServices } = await import('./server/services');
  const { handleHttp } = await import('./server/http');
  const services = await getServices();
  const response = await handleHttp(new Request(new URL(data.path, services.origin), { headers: { cookie: getRequest().headers.get('cookie') ?? '' } }), services);
  return { status: response.status, data: await response.json() };
});
export const uiWrite = createServerFn({ method: 'POST' }).inputValidator(z.strictObject({ path: pathSchema, body: z.record(z.string(), z.unknown()) })).handler(async ({ data }) => {
  const { getRequest } = await import('@tanstack/react-start/server');
  const { getServices } = await import('./server/services');
  const { handleHttp } = await import('./server/http');
  const services = await getServices();
  const headers = new Headers(getRequest().headers); headers.set('content-type', 'application/json'); headers.delete('authorization');
  const response = await handleHttp(new Request(new URL(data.path, services.origin), { method: 'POST', headers, body: JSON.stringify(data.body) }), services);
  return { status: response.status, data: await response.json() };
});
