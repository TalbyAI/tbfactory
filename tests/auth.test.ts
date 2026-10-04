import { test } from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { connectStore } from '../src/server/store.ts';
import { Authentication } from '../src/server/auth.ts';
import { startOidc } from './support/oidc.ts';

test('OIDC login maps exact identities, starts without access, and rejects substitution and replay', async () => {
  const op = await startOidc();
  const store = await connectStore({
    url: 'ws://127.0.0.1:18000/rpc',
    namespace: 'test',
    database: `auth_${randomUUID().replaceAll('-', '')}`,
    username: 'root',
    password: 'acceptance-only',
  });
  try {
    const auth = await Authentication.create(store, {
      issuer: op.issuer,
      clientId: 'factory',
      clientSecret: 'fixture-secret',
      callback: 'http://localhost:3000/auth/callback',
      allowLoopbackHttp: true,
    });
    async function login() {
      const begin = await auth.begin();
      assert.equal(new URL(begin.url).searchParams.get('prompt'), 'login');
      const response = await fetch(begin.url, { redirect: 'manual' });
      const callback = new URL(response.headers.get('location')!);
      const session = await auth.complete(callback, begin.cookie);
      return { session, callback, cookie: begin.cookie };
    }
    const first = await login();
    assert.equal((await login()).session.user.id, first.session.user.id);
    op.identity({ subject: 'different', email: 'alice@example.test', verified: true });
    assert.notEqual((await login()).session.user.id, first.session.user.id);
    await assert.rejects(auth.complete(first.callback, first.cookie), /login/i);
    for (const fault of ['nonce', 'issuer', 'audience', 'signature', 'expired', 'userinfo-sub']) {
      op.fault(fault);
      await assert.rejects(login(), /authentication/i);
    }
    op.fault('userinfo');
    assert.equal((await login()).session.user.email, 'alice@example.test');
    op.fault('');
    await auth.logout(first.session.token);
    await assert.rejects(auth.authenticate(first.session.token), /authentication/i);
    const previousUser = (await login()).session.user.id;
    op.authMethod('client_secret_basic');
    const basic = await Authentication.create(store, {
      issuer: op.issuer,
      clientId: 'factory',
      clientSecret: 'fixture-secret',
      clientAuthentication: 'client_secret_basic',
      callback: 'http://localhost:3000/auth/callback',
      allowLoopbackHttp: true,
    });
    const beginBasic = await basic.begin();
    const redirected = await fetch(beginBasic.url, { redirect: 'manual' });
    const completedBasic = await basic
      .complete(new URL(redirected.headers.get('location')!), beginBasic.cookie)
      .catch((error) => {
        assert.ok(op.checks().authenticated, JSON.stringify(op.checks()));
        throw error;
      });
    assert.equal(completedBasic.user.id, previousUser);
  } finally {
    await store.close();
    await op.close();
  }
});
