import { createServer } from 'node:http';
import { generateKeyPair, exportJWK, SignJWT } from 'jose';
import { createHash, randomUUID } from 'node:crypto';

// Controlled external OIDC boundary. The production application has no test login.
export async function startOidc(port = 0) {
  let issuer = `http://127.0.0.1:${port}`;
  const { privateKey, publicKey } = await generateKeyPair('RS256');
  const jwk = { ...await exportJWK(publicKey), kid: 'test', alg: 'RS256', use: 'sig' };
  let identity = { subject: 'alice', email: 'alice@example.test', verified: true };
  let fault = '';
  const codes = new Map<string, URLSearchParams>();
  const server = createServer(async (req, res) => {
    const url = new URL(req.url!, issuer);
    res.setHeader('content-type', 'application/json');
    if (url.pathname === '/.well-known/openid-configuration') {
      res.end(JSON.stringify({ issuer, authorization_endpoint: `${issuer}/authorize`, token_endpoint: `${issuer}/token`, userinfo_endpoint: `${issuer}/userinfo`, jwks_uri: `${issuer}/jwks`, response_types_supported: ['code'], subject_types_supported: ['public'], id_token_signing_alg_values_supported: ['RS256'], token_endpoint_auth_methods_supported: ['client_secret_post'], code_challenge_methods_supported: ['S256'] }));
    } else if (url.pathname === '/jwks') {
      res.end(JSON.stringify({ keys: [jwk] }));
    } else if (url.pathname === '/authorize') {
      const code = randomUUID(); codes.set(code, url.searchParams);
      const target = new URL(url.searchParams.get('redirect_uri')!);
      target.searchParams.set('code', code); target.searchParams.set('state', url.searchParams.get('state')!);
      res.writeHead(302, { location: target.href }); res.end();
    } else if (url.pathname === '/token') {
      let body = ''; for await (const chunk of req) body += chunk;
      const params = new URLSearchParams(body);
      const login = codes.get(params.get('code')!); codes.delete(params.get('code')!);
      if (!login || params.get('client_secret') !== 'fixture-secret' || createHash('sha256').update(params.get('code_verifier') || '').digest('base64url') !== login.get('code_challenge') || params.get('redirect_uri') !== login.get('redirect_uri')) {
        res.writeHead(400); res.end(JSON.stringify({ error: 'invalid_grant' })); return;
      }
      const idToken = await new SignJWT({ ...(['userinfo', 'userinfo-sub'].includes(fault) ? {} : { email: identity.email, email_verified: identity.verified }), nonce: fault === 'nonce' ? 'wrong' : login.get('nonce') })
        .setProtectedHeader({ alg: 'RS256', kid: 'test' }).setIssuer(fault === 'issuer' ? 'https://wrong.test' : issuer)
        .setAudience(fault === 'audience' ? 'wrong' : 'factory').setSubject(identity.subject)
        .setIssuedAt().setExpirationTime(fault === 'expired' ? Math.floor(Date.now() / 1000) - 3600 : '5m').sign(privateKey);
      res.end(JSON.stringify({ access_token: 'unused', token_type: 'Bearer', expires_in: 300, id_token: fault === 'signature' ? `${idToken.slice(0, -10)}AAAAAAAAAA` : idToken }));
    } else if (url.pathname === '/userinfo') {
      res.end(JSON.stringify({ sub: fault === 'userinfo-sub' ? 'wrong-subject' : identity.subject, email: identity.email, email_verified: identity.verified }));
    } else { res.writeHead(404); res.end('{}'); }
  });
  await new Promise<void>(resolve => server.listen(port, '127.0.0.1', resolve));
  issuer = `http://127.0.0.1:${(server.address() as { port: number }).port}`;
  return { issuer, identity: (next: typeof identity) => { identity = next; }, fault: (next: string) => { fault = next; }, close: () => new Promise<void>(resolve => server.close(() => resolve())) };
}
