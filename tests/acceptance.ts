import assert from 'node:assert/strict';
import { execFileSync, spawn, type ChildProcess } from 'node:child_process';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { resolve, join } from 'node:path';
import { randomBytes, randomUUID } from 'node:crypto';
import { connectStore } from '../src/server/store';
import { provision } from '../src/server/provision';
import { activities } from '../src/server/contracts';
import { KeyRing } from '../src/server/key-ring';
import { OrganizationSecrets } from '../src/server/secrets';
import { selfHostedProvider, BrowserClient } from './support/provider';

const origin = 'http://localhost:3000';
const directory = resolve('.runtime', `acceptance-${Date.now()}`); await mkdir(directory, { recursive: true });
const provider = await selfHostedProvider();
const database = `acceptance_${randomUUID().replaceAll('-', '')}`;
const config = { url: 'ws://127.0.0.1:18000/rpc', namespace: 'acceptance', database, username: 'root', password: 'acceptance-only' };
let store = await connectStore(config);
const rootKey = randomBytes(32), rootFile = join(directory, 'root.key'); await writeFile(rootFile, rootKey, { mode: 0o600 });
const ringConfig = { directory: join(directory, 'ring'), backupDirectory: join(directory, 'recovery-test-destination'), rootKey, installation: 'acceptance', rootVersion: 'root-1' };
const ring = new KeyRing(ringConfig); await ring.setup();
const env = { ...process.env, HOST: '127.0.0.1', PORT: '3000', FACTORY_ORIGIN: origin,
  FACTORY_DATABASE_URL: config.url, FACTORY_DATABASE_NAMESPACE: config.namespace, FACTORY_DATABASE_NAME: config.database, FACTORY_DATABASE_USER: config.username, FACTORY_DATABASE_PASSWORD: config.password,
  FACTORY_OIDC_ISSUER: provider.issuer, FACTORY_OIDC_CLIENT_ID: 'factory', FACTORY_OIDC_CLIENT_SECRET: 'acceptance-provider-secret', FACTORY_ALLOW_LOOPBACK_HTTP: 'true', FACTORY_TRUST_VERIFIED_EMAIL: 'true',
  FACTORY_ROOT_KEY_FILE: rootFile, FACTORY_ROOT_KEY_VERSION: 'root-1', FACTORY_INSTALLATION: 'acceptance', FACTORY_RING_DIRECTORY: ringConfig.directory, FACTORY_RING_BACKUP_DIRECTORY: ringConfig.backupDirectory,
};
let web: ChildProcess;
let output = '';
async function startWeb() {
  web = spawn(process.execPath, ['.output/server/index.mjs'], { env, windowsHide: true });
  web.stdout!.on('data', b => { output += b; }); web.stderr!.on('data', b => { output += b; });
  for (let i = 0; i < 100; i++) {
    try { if ((await fetch(origin)).ok) return; } catch {}
    if (web.exitCode !== null) break;
    await new Promise(r => setTimeout(r, 100));
  }
  throw new Error(`Production server did not start: ${output.slice(-2000)}`);
}
async function stopWeb() { if (web && web.exitCode === null && web.signalCode === null && !web.killed) { web.kill(); await new Promise<void>(r => web.once('exit', () => r())); } }
const results: string[] = [];
try {
  for (const [organization, subjects] of [['alpha', ['alice']], ['beta', ['alice', 'bob']]] as const) {
    await provision(store, { organization: { id: organization, name: organization }, projects: [{ id: `${organization}-project`, name: `${organization} Project`, repositories: [{ id: `${organization}-repo`, name: `${organization} Repository` }] }], members: subjects.map(subject => ({ issuer: provider.issuer, subject, grants: [...activities.map(activity => ({ activity, scope: 'organization', scopeId: organization, effect: 'allow' })), ...activities.map(activity => ({ activity: `delegate:${activity}:allow`, scope: 'organization', scopeId: organization, effect: 'allow' }))] })) });
  }
  await startWeb();
  const alice = new BrowserClient(); const bob = new BrowserClient(); const newcomer = new BrowserClient();
  await alice.login(origin, 'alice'); await bob.login(origin, 'bob'); await newcomer.login(origin, 'newcomer');
  assert.equal((await alice.json(origin, '/api/organizations')).body.items.length, 2);
  assert.equal((await bob.json(origin, '/api/organizations')).body.items.length, 1);
  assert.equal((await newcomer.json(origin, '/api/organizations')).body.items.length, 0);
  results.push('Self-hosted certified OIDC login; two independent Memberships; authenticated no-access User');
  const invited = await alice.json(origin, '/api/organizations/alpha/invitations', { operationId: 'invite-newcomer', email: 'newcomer@example.test', grants: ['organization.read', 'project.read', 'work-item.read', 'history.read'].map(activity => ({ activity, scope: 'organization', scopeId: 'alpha', effect: 'allow' })) });
  assert.equal(invited.status, 200);
  assert.equal((await newcomer.json(origin, `/api/invitations/preview?token=${invited.body.token}`)).status, 200);
  assert.equal((await newcomer.json(origin, '/api/organizations')).body.items.length, 0);
  assert.equal((await newcomer.json(origin, '/api/invitations/accept', { operationId: 'accept-newcomer', token: invited.body.token })).status, 200);
  assert.equal((await newcomer.json(origin, '/api/organizations')).body.items.length, 1);
  results.push('Actual UserInfo verified contact; explicit Invitation preview/accept without GET activation');
  const base = '/api/organizations/alpha/work-items';
  const input = { operationId: 'acceptance-create', project: 'alpha-project', repository: 'alpha-repo', title: 'Persistent acceptance Work Item', type: 'pull-request-review' };
  const created = await alice.json(origin, base, input); assert.equal(created.status, 200);
  const item = created.body.workItem.id; const path = `${base}/${item}`;
  const notes = await Promise.all(Array.from({ length: 8 }, () => alice.json(origin, `${path}/notes`, { operationId: 'concurrent-note', text: 'Original' })));
  assert.ok(notes.every(r => r.status === 200 && r.body.fact.id === notes[0].body.fact.id));
  await alice.json(origin, `${path}/corrections`, { operationId: 'correction', fact: notes[0].body.fact.id, text: 'Correction' });
  assert.equal((await alice.json(origin, `${path}/facts`)).body.items.length, 3);
  assert.equal((await bob.json(origin, path)).status, 404);
  assert.equal((await alice.json(origin, base, { ...input, operationId: 'wrong', project: 'beta-project' })).status, 404);
  results.push('Production HTTP create/history/correction; concurrency receipts; cross-Organization isolation');
  const issued = await alice.json(origin, '/api/organizations/alpha/api-credentials', { operationId: 'api', label: 'Acceptance API', activities: ['work-item.read', 'history.read'], expiresAt: Date.now() + 3600000 });
  assert.equal(issued.status, 200);
  assert.equal((await alice.json(origin, path, undefined, issued.body.token)).status, 200);
  assert.equal((await alice.json(origin, '/api/organizations/beta/projects', undefined, issued.body.token)).status, 404);
  await new OrganizationSecrets(store, ring).put('alpha', 'provider', 'alpha-provider-secret');
  const olderRing = await ring.export();
  await ring.rotate();
  await new OrganizationSecrets(store, ring).put('beta', 'provider', 'beta-provider-secret');
  const compatibleRing = await ring.export();
  await stopWeb(); await store.close();
  execFileSync('docker', ['restart', 'tbfactory-acceptance-db'], { windowsHide: true, stdio: 'pipe' });
  for (let i = 0; i < 100; i++) { try { if ((await fetch('http://127.0.0.1:18000/health')).ok) break; } catch {} await new Promise(r => setTimeout(r, 100)); }
  store = await connectStore(config); await startWeb();
  assert.deepEqual((await alice.json(origin, base, input)).body, created.body);
  assert.equal((await alice.json(origin, `${path}/facts`, undefined, issued.body.token)).body.items.length, 3);
  assert.equal((await new OrganizationSecrets(store, new KeyRing(ringConfig)).verify()).secrets, 2);
  results.push('Web process and persistent SurrealDB restart retain Users, Memberships, history, receipts, API credential and encrypted secrets');
  await stopWeb();
  const exported = execFileSync('docker', ['exec', 'tbfactory-acceptance-db', '/surreal', 'export', '--log', 'none', '--namespace', config.namespace, '--database', config.database, '--user', 'root', '--pass', 'acceptance-only'], { windowsHide: true, maxBuffer: 10 * 1024 * 1024 });
  const databaseBackup = join(directory, 'database.surql'); await writeFile(databaseBackup, exported, { mode: 0o600 });
  const restoredConfig = { ...config, database: `${database}_restored` };
  const restoredStore = await connectStore(restoredConfig);
  try {
    const response = await fetch('http://127.0.0.1:18000/import', { method: 'POST', headers: { authorization: `Basic ${Buffer.from('root:acceptance-only').toString('base64')}`, 'surreal-ns': restoredConfig.namespace, 'surreal-db': restoredConfig.database, accept: 'application/json' }, body: exported });
    assert.equal(response.status, 200, await response.text());
    const restoredRing = new KeyRing({ ...ringConfig, directory: join(directory, 'restored-ring') });
    const secrets = new OrganizationSecrets(restoredStore, restoredRing);
    await assert.rejects(restoredRing.restore(olderRing, await secrets.requiredKeys()), /recovery/i);
    await restoredRing.restore(compatibleRing, await secrets.requiredKeys());
    assert.equal((await secrets.verify()).secrets, 2);
    assert.equal(await secrets.read('alpha', 'provider'), 'alpha-provider-secret');
    assert.equal(await secrets.read('beta', 'provider'), 'beta-provider-secret');
    env.FACTORY_DATABASE_NAME = restoredConfig.database; env.FACTORY_RING_DIRECTORY = join(directory, 'restored-ring');
    await startWeb();
    assert.equal((await alice.json(origin, `${path}/facts`)).body.items.length, 3);
    assert.equal((await bob.json(origin, path)).status, 404);
    assert.equal((await alice.json(origin, path, undefined, issued.body.token)).status, 200);
    assert.equal((await alice.json(origin, `/api/organizations/alpha/api-credentials/${issued.body.credential.id}/revoke`, { operationId: 'revoke-restored' })).status, 200);
    assert.equal((await alice.json(origin, path, undefined, issued.body.token)).status, 401);
    results.push('Consistent SurrealDB export/import into isolated database; compatible ring manual restore; both key versions decrypt; cross-Organization isolation and revocation after restore');
    await writeFile(join(directory, 'results.json'), JSON.stringify({ checkedAt: new Date().toISOString(), database: restoredConfig.database, item, results }, null, 2));
    console.log(JSON.stringify({ passed: results.length, results, evidence: join(directory, 'results.json') }, null, 2));
    if (process.argv.includes('--serve')) {
      console.log('Acceptance application remains available at http://localhost:3000. The local test identity provider accepts any login/password; use alice for two Organizations or newcomer for no access.');
      await new Promise<void>(resolve => { process.once('SIGINT', resolve); process.once('SIGTERM', resolve); });
    }
  } finally { await restoredStore.close(); }
} catch (error) { console.error('Acceptance failure:', error); throw error; }
finally { await stopWeb(); await store.close(); await provider.close(); }
