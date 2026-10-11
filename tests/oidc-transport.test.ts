import { test } from 'node:test';
import assert from 'node:assert/strict';
import { Authentication, type OidcConfig } from '../src/server/auth.ts';
import { type Store } from '../src/server/store.ts';

const config: OidcConfig = {
  issuer: 'https://identity.example.test',
  clientId: 'factory',
  clientSecret: 'test-only-secret',
  callback: 'http://localhost:3001/auth/callback',
  allowLoopbackHttp: true,
};

test('HTTPS OIDC discovery permits an explicitly enabled HTTP localhost callback', async (t) => {
  const discovery = t.mock.method(globalThis, 'fetch', async () =>
    Response.json({
      issuer: config.issuer,
      authorization_endpoint: `${config.issuer}/authorize`,
      token_endpoint: `${config.issuer}/token`,
      jwks_uri: `${config.issuer}/jwks`,
      response_types_supported: ['code'],
      subject_types_supported: ['public'],
      id_token_signing_alg_values_supported: ['RS256'],
    }),
  );
  await assert.doesNotReject(Authentication.create({} as Store, config));
  assert.equal(discovery.mock.callCount(), 1);
});

test('OIDC transport rejects insecure remote URLs and unsupported protocols before discovery', async (t) => {
  const discovery = t.mock.method(globalThis, 'fetch', async () => {
    throw new Error('Discovery must not run for invalid transport');
  });
  for (const change of [
    { allowLoopbackHttp: false },
    { callback: 'http://factory.example.test/auth/callback' },
    { callback: 'http://localhost.attacker.test/auth/callback' },
    { issuer: 'http://identity.example.test' },
    { issuer: 'ftp://localhost', callback: 'http://localhost:3001/auth/callback' },
    { issuer: 'http://localhost:18081', callback: 'ftp://localhost/auth/callback' },
  ]) {
    await assert.rejects(Authentication.create({} as Store, { ...config, ...change }), /HTTPS/);
  }
  assert.equal(discovery.mock.callCount(), 0);
});
