import { createServer } from 'node:http';
import { randomBytes } from 'node:crypto';
import { Provider } from 'oidc-provider';
import { generateKeyPair, exportJWK } from 'jose';

// Actual OpenID Certified provider, hosted locally only for acceptance.
// Its development interactions are never included in the production application.
export async function selfHostedProvider(port = 18200, origin = 'http://localhost:3000') {
  const issuer = `http://127.0.0.1:${port}`;
  const { privateKey } = await generateKeyPair('RS256', { extractable: true });
  const provider = new Provider(issuer, {
    clients: [
      {
        client_id: 'factory',
        client_secret: 'acceptance-provider-secret',
        redirect_uris: [`${origin}/auth/callback`],
        response_types: ['code'],
        grant_types: ['authorization_code'],
        token_endpoint_auth_method: 'client_secret_post',
      },
    ],
    jwks: {
      keys: [{ ...(await exportJWK(privateKey)), kid: 'acceptance', alg: 'RS256', use: 'sig' }],
    },
    cookies: { keys: [randomBytes(32).toString('hex')] },
    claims: { email: ['email', 'email_verified'] },
    pkce: { required: () => true },
    findAccount: async (_ctx, id) => ({
      accountId: id,
      claims: async () => ({ sub: id, email: `${id}@example.test`, email_verified: true }),
    }),
  });
  const server = createServer(provider.callback());
  await new Promise<void>((resolve) => server.listen(port, '127.0.0.1', resolve));
  return {
    issuer,
    close: () =>
      new Promise<void>((resolve) => {
        server.closeAllConnections();
        server.close(() => resolve());
      }),
  };
}

export class BrowserClient {
  private cookies = new Map<string, Map<string, string>>();
  async request(url: string, options: RequestInit = {}) {
    const origin = new URL(url).origin;
    const headers = new Headers(options.headers);
    headers.set(
      'cookie',
      [...(this.cookies.get(origin) ?? new Map()).entries()]
        .map(([k, v]) => `${k}=${v}`)
        .join('; '),
    );
    const response = await fetch(url, { ...options, headers, redirect: 'manual' });
    const jar = this.cookies.get(origin) ?? new Map();
    for (const cookie of response.headers.getSetCookie()) {
      const first = cookie.split(';')[0];
      const split = first.indexOf('=');
      jar.set(first.slice(0, split), first.slice(split + 1));
    }
    this.cookies.set(origin, jar);
    return response;
  }
  async login(origin: string, subject: string) {
    let url = `${origin}/auth/login`;
    let options: RequestInit = {};
    for (let step = 0; step < 20; step++) {
      const response = await this.request(url, options);
      const location = response.headers.get('location');
      if (location) {
        url = new URL(location, url).href;
        options = {};
        continue;
      }
      const html = await response.text();
      if (new URL(url).origin === origin && response.ok) return;
      const action = html.match(/<form[^>]*action="([^"]+)"/);
      if (!action)
        throw new Error(`Self-hosted OIDC login failed: ${response.status} ${html.slice(0, 300)}`);
      const prompt = html.includes('name="login"') ? 'login' : 'consent';
      options = {
        method: 'POST',
        headers: {
          'content-type': 'application/x-www-form-urlencoded',
          origin: new URL(url).origin,
        },
        body: new URLSearchParams({ prompt, login: subject, password: 'acceptance-only' }),
      };
      url = new URL(action[1], url).href;
    }
    throw new Error('OIDC redirect limit exceeded');
  }
  async json(origin: string, path: string, body?: unknown, bearer?: string) {
    const response = await this.request(`${origin}${path}`, {
      method: body ? 'POST' : 'GET',
      headers: {
        origin,
        'content-type': 'application/json',
        ...(bearer ? { authorization: `Bearer ${bearer}` } : {}),
      },
      body: body ? JSON.stringify(body) : undefined,
    });
    return { status: response.status, body: (await response.json()) as any };
  }
}
