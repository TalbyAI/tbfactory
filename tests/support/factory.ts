import { randomUUID } from 'node:crypto';
import { connectStore } from '../../src/server/store.ts';
import { Authentication } from '../../src/server/auth.ts';
import { provision } from '../../src/server/provision.ts';
import { activities } from '../../src/server/contracts.ts';
import { Factory } from '../../src/server/factory.ts';
import { handleHttp } from '../../src/server/http.ts';
import { startOidc } from './oidc.ts';
import { ReviewArtifacts } from '../../src/server/review-artifacts';

export async function fixture(artifactDirectory?: string) {
  const op = await startOidc();
  const database = `factory_${randomUUID().replaceAll('-', '')}`;
  const config = {
    url: 'ws://127.0.0.1:18000/rpc',
    namespace: 'test',
    database,
    username: 'root',
    password: 'acceptance-only',
  };
  const store = await connectStore(config);
  const oidcConfig = {
    issuer: op.issuer,
    clientId: 'factory',
    clientSecret: 'fixture-secret',
    callback: 'http://localhost:3000/auth/callback',
    allowLoopbackHttp: true,
    trustVerifiedEmail: true,
  };
  const auth = await Authentication.create(store, oidcConfig);
  const artifacts = artifactDirectory ? new ReviewArtifacts(artifactDirectory) : undefined;
  const factory = new Factory(store, undefined, { artifacts, origin: 'http://localhost:3000' });
  async function login(subject = 'alice', verified = true, email = `${subject}@example.test`) {
    op.identity({ subject, email, verified });
    const begin = await auth.begin();
    const redirect = await fetch(begin.url, { redirect: 'manual' });
    return auth.complete(new URL(redirect.headers.get('location')!), begin.cookie);
  }
  const alice = await login();
  async function bootstrap(organization: string, subjects = ['alice']) {
    return provision(store, {
      organization: { id: organization, name: organization },
      projects: [
        {
          id: `${organization}-project`,
          name: 'Project',
          repositories: [{ id: `${organization}-repo`, name: 'Repository' }],
        },
      ],
      members: subjects.map((subject) => ({
        issuer: op.issuer,
        subject,
        grants: activities.map((activity) => ({
          activity,
          scope: 'organization',
          scopeId: organization,
          effect: 'allow',
        })),
      })),
    });
  }
  async function request(
    path: string,
    body?: unknown,
    secret = alice.token,
    bearer = false,
    method?: string,
  ) {
    const response = await handleHttp(
      new Request(`http://localhost:3000${path}`, {
        method: method ?? (body ? 'POST' : 'GET'),
        headers: {
          ...(bearer
            ? { authorization: `Bearer ${secret}` }
            : { cookie: `__Host-factory_session=${secret}` }),
          origin: 'http://localhost:3000',
          'content-type': 'application/json',
        },
        body: body ? JSON.stringify(body) : undefined,
      }),
      { auth, factory, origin: 'http://localhost:3000', artifacts },
    );
    return { status: response.status, body: (await response.json()) as any };
  }
  return {
    store,
    auth,
    factory,
    config,
    oidcConfig,
    alice,
    op,
    login,
    bootstrap,
    request,
    close: async () => {
      await store.close();
      await op.close();
    },
  };
}
