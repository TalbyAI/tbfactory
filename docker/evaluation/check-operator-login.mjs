import assert from 'node:assert/strict';

const origin = process.env.FACTORY_EVALUATION_ORIGIN ?? 'http://127.0.0.1:18030';
const login = await fetch(`${origin}/auth/login`, { redirect: 'manual' });
assert.equal(login.status, 302, 'Factory should begin the public OIDC login flow');

const loginCookie = login.headers
  .getSetCookie()
  .find((value) => value.startsWith('__Host-factory_login='))
  ?.split(';', 1)[0];
assert.ok(loginCookie, 'Factory should set the OIDC login transaction cookie');

const authorization = await fetch(login.headers.get('location'), { redirect: 'manual' });
assert.equal(authorization.status, 302, 'Evaluation identity provider should authorize Alice');

const callback = await fetch(authorization.headers.get('location'), {
  headers: { cookie: loginCookie },
  redirect: 'manual',
});
assert.equal(callback.status, 302, 'Factory should complete the OIDC callback');
const sessionCookie = callback.headers
  .getSetCookie()
  .find((value) => value.startsWith('__Host-factory_session='))
  ?.split(';', 1)[0];
assert.ok(sessionCookie, 'Factory should create an authenticated Alice session');

const organizationsResponse = await fetch(`${origin}/api/organizations`, {
  headers: { cookie: sessionCookie },
});
assert.equal(organizationsResponse.status, 200, 'Alice should read her Organizations');
const organizations = (await organizationsResponse.json()).items;
assert.deepEqual(
  organizations.map(({ id }) => id).sort(),
  ['alpha', 'beta'],
  'Alice should have the two provisioned evaluation Organizations',
);

process.stdout.write(
  `${JSON.stringify({
    operator: 'alice@example.test',
    organizations: organizations
      .map(({ id, name }) => ({ id, name }))
      .sort((a, b) => a.id.localeCompare(b.id)),
  })}\n`,
);
