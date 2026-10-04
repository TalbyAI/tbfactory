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
import { sourceInput, observation, delivery } from './support/observations';

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
const providerDeliveries: { input: ReturnType<typeof sourceInput>; result: { workItemId: string; factId: string } }[] = [];
async function receive(request: Request) {
  const response = await fetch(request);
  return { status: response.status, body: await response.json() as any };
}
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
  for (const providerName of ['github', 'azure-devops'] as const) {
    for (const organization of ['alpha', 'beta']) {
      const source = sourceInput(providerName, organization);
      const sourceFile = join(directory, `${organization}-${providerName}-source.json`);
      await writeFile(sourceFile, JSON.stringify(source), { mode: 0o600 });
      const installed = JSON.parse(execFileSync(process.execPath, ['--import', 'tsx', 'scripts/operator.ts', 'source-put', sourceFile], { env, windowsHide: true, encoding: 'utf8' }));
      assert.equal(installed.repository, source.repository);
      assert.equal(installed.enabled, true);
      assert.equal(installed.secret, undefined); assert.equal(installed.fingerprint, undefined);
      const attempts = await Promise.all(Array.from({ length: 4 }, () => receive(delivery(source, observation(providerName)))));
      assert.ok(attempts.every(attempt => attempt.status === 200 && attempt.body.factId === attempts[0].body.factId), JSON.stringify(attempts));
      providerDeliveries.push({ input: source, result: attempts[0].body });
      const facts = await alice.json(origin, `/api/organizations/${organization}/work-items/${attempts[0].body.workItemId}/facts`);
      assert.equal(facts.body.items.filter((fact: any) => fact.kind === 'external.observation').length, 1);
      assert.equal(JSON.stringify(facts.body).includes(source.secret), false);
    }
  }
  assert.equal(new Set(providerDeliveries.map(entry => entry.result.workItemId)).size, 4);
  results.push('Actual source-put operator CLI and production GitHub HMAC/Azure DevOps Basic routes: concurrent deduplication, independent Organizations and private credentials');
  const transitionBase = '/api/organizations/alpha';
  assert.equal((await alice.json(origin, `${transitionBase}/work-item-types`, { operationId: 'type-v2', type: 'pull-request-review', version: 2, enabled: true })).status, 200);
  const transitionItem = await alice.json(origin, base, { ...input, operationId: 'transition-item', title: 'Durable Approval Work Item' });
  assert.equal(transitionItem.body.workItem.version, 2);
  const transitionPath = `${base}/${transitionItem.body.workItem.id}`;
  const team = await alice.json(origin, `${transitionBase}/teams`, { operationId: 'transition-team', name: 'Review operators', members: [created.body.workItem.actor] });
  assert.equal(team.status, 200);
  assert.equal((await alice.json(origin, `${transitionBase}/policies`, { operationId: 'transition-human', team: team.body.team.id, activity: 'transition.prepare-review', scope: 'project', scopeId: 'alpha-project', effect: 'human' })).status, 200);
  const pending = await alice.json(origin, `${transitionPath}/transition-requests`, { operationId: 'durable-request', transition: 'prepare-review', expectedState: 'registered', version: 2, inputs: { reviewBrief: 'Verify durable authorization' } });
  assert.equal(pending.body.completed, false);
  const approvalPath = `${transitionPath}/transition-requests/${pending.body.request.id}`;
  assert.equal((await alice.json(origin, `${approvalPath}/approve`, { operationId: 'durable-approval' })).status, 200);
  assert.equal((await alice.json(origin, transitionPath)).body.state, 'registered');
  results.push('Production type selection, Teams, scoped human policy, pending request and separate activity-bound Approval');
  await new OrganizationSecrets(store, ring).put('alpha', 'provider', 'alpha-provider-secret');
  const olderRing = await ring.export();
  await ring.rotate();
  await new OrganizationSecrets(store, ring).put('beta', 'provider', 'beta-provider-secret');
  const compatibleRing = await ring.export();
  await stopWeb(); await store.close();
  execFileSync('docker', ['restart', 'tbfactory-acceptance-db'], { windowsHide: true, stdio: 'pipe' });
  for (let i = 0; i < 100; i++) { try { if ((await fetch('http://127.0.0.1:18000/health')).ok) break; } catch {} await new Promise(r => setTimeout(r, 100)); }
  store = await connectStore(config); await startWeb();
  for (const entry of providerDeliveries) {
    const providerName = entry.input.external.provider;
    assert.deepEqual((await receive(delivery(entry.input, observation(providerName)))).body, entry.result);
    const eventId = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';
    const update = observation(providerName, eventId) as any;
    if (providerName === 'github') { update.action = 'closed'; update.pull_request.state = 'closed'; update.pull_request.merged = true; }
    else { update.eventType = 'git.pullrequest.updated'; update.resource.status = 'completed'; }
    assert.equal((await receive(delivery(entry.input, update, eventId))).status, 200);
    const providerPath = `/api/organizations/${entry.input.organization}/work-items/${entry.result.workItemId}`;
    const retained = (await alice.json(origin, providerPath)).body;
    assert.equal(retained.state, 'registered'); assert.equal(retained.version, 1);
    assert.equal((await alice.json(origin, `${providerPath}/facts`)).body.items.length, 3);
  }
  results.push('Both providers retain correspondence, receipts and encrypted source authentication after web/database restart; later closed/completed observations preserve Factory state/version');
  assert.deepEqual((await alice.json(origin, base, input)).body, created.body);
  assert.equal((await alice.json(origin, `${path}/facts`, undefined, issued.body.token)).body.items.length, 3);
  const execution = await alice.json(origin, `${approvalPath}/execute`, { operationId: 'durable-execute' });
  assert.equal(execution.status, 200);
  assert.equal(execution.body.workItem.state, 'ready-for-review');
  assert.equal((await alice.json(origin, `${transitionPath}/facts`)).body.items.filter((fact: any) => fact.kind === 'state.transition').length, 1);
  const retainedBoard = await alice.json(origin, `${transitionBase}/board?type=pull-request-review`);
  assert.equal(retainedBoard.body.items.find((card: any) => card.id === item).version, 1);
  assert.deepEqual(retainedBoard.body.items.find((card: any) => card.id === item).transitions, []);
  results.push('Approved request survives web/database restart and completes once; retained version 1 board semantics remain unchanged');
  assert.equal((await new OrganizationSecrets(store, new KeyRing(ringConfig)).verify()).secrets, 6);
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
    assert.equal((await secrets.verify()).secrets, 6);
    assert.equal(await secrets.read('alpha', 'provider'), 'alpha-provider-secret');
    assert.equal(await secrets.read('beta', 'provider'), 'beta-provider-secret');
    env.FACTORY_DATABASE_NAME = restoredConfig.database; env.FACTORY_RING_DIRECTORY = join(directory, 'restored-ring');
    await startWeb();
    for (const entry of providerDeliveries) {
      assert.deepEqual((await receive(delivery(entry.input, observation(entry.input.external.provider)))).body, entry.result);
      const providerPath = `/api/organizations/${entry.input.organization}/work-items/${entry.result.workItemId}`;
      assert.equal((await alice.json(origin, `${providerPath}/facts`)).body.items.length, 3);
    }
    results.push('Both provider sources decrypt and deduplicate after database export/import and protected ring restoration');
    assert.equal((await alice.json(origin, `${path}/facts`)).body.items.length, 3);
    assert.equal((await bob.json(origin, path)).status, 404);
    assert.equal((await alice.json(origin, path, undefined, issued.body.token)).status, 200);
    assert.equal((await alice.json(origin, `/api/organizations/alpha/api-credentials/${issued.body.credential.id}/revoke`, { operationId: 'revoke-restored' })).status, 200);
    assert.equal((await alice.json(origin, path, undefined, issued.body.token)).status, 401);
    results.push('Consistent SurrealDB export/import into isolated database; compatible ring manual restore; both key versions decrypt; cross-Organization isolation and revocation after restore');
    await writeFile(join(directory, 'results.json'), JSON.stringify({ checkedAt: new Date().toISOString(), database: restoredConfig.database, item,
      providerWorkItems: providerDeliveries.map(entry => ({ organization: entry.input.organization, provider: entry.input.external.provider, ...entry.result })), results }, null, 2));
    console.log(JSON.stringify({ passed: results.length, results, evidence: join(directory, 'results.json') }, null, 2));
    if (process.argv.includes('--serve')) {
      console.log('Acceptance application remains available at http://localhost:3000. The local test identity provider accepts any login/password; use alice for two Organizations or newcomer for no access.');
      await new Promise<void>(resolve => { process.once('SIGINT', resolve); process.once('SIGTERM', resolve); });
    }
  } finally { await restoredStore.close(); }
} catch (error) { console.error('Acceptance failure:', error); throw error; }
finally { await stopWeb(); await store.close(); await provider.close(); }
