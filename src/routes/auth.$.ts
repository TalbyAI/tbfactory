import { createFileRoute } from '@tanstack/react-router';
import { browserMutation, cookieValue, errorResponse, sessionCookie } from '../server/http';
import { getServices } from '../server/services';
import { fail } from '../server/contracts';

const loginCookie = '__Host-factory_login';
const cookie = (name: string, value: string, maxAge: number) => `${name}=${value}; Path=/; Secure; HttpOnly; SameSite=Lax; Max-Age=${maxAge}`;
async function handle({ request }: { request: Request }) {
  try {
    const services = await getServices(); const url = new URL(request.url);
    if (url.origin !== services.origin) fail(400, 'Invalid application origin');
    const headers = new Headers({ 'cache-control': 'no-store', 'referrer-policy': 'no-referrer' });
    if (url.pathname === '/auth/login' && request.method === 'GET') {
      const login = await services.auth.begin();
      headers.set('location', login.url); headers.append('set-cookie', cookie(loginCookie, login.cookie, 600));
      return new Response(null, { status: 302, headers });
    }
    if (url.pathname === '/auth/callback' && request.method === 'GET') {
      const session = await services.auth.complete(url, cookieValue(request, loginCookie));
      headers.set('location', '/'); headers.append('set-cookie', cookie(sessionCookie, session.token, 43200)); headers.append('set-cookie', cookie(loginCookie, '', 0));
      return new Response(null, { status: 302, headers });
    }
    if (url.pathname === '/auth/logout' && request.method === 'POST') {
      browserMutation(request, services.origin);
      await services.auth.logout(cookieValue(request, sessionCookie));
      headers.set('location', '/'); headers.append('set-cookie', cookie(sessionCookie, '', 0));
      return new Response(null, { status: 303, headers });
    }
    fail(404, 'Resource not found');
  } catch (error) { return errorResponse(error); }
}
export const Route = createFileRoute('/auth/$')({ server: { handlers: { GET: handle, POST: handle } } });
