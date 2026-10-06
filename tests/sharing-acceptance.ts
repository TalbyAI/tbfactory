import assert from 'node:assert/strict';
import { spawn, execFileSync, type ChildProcess } from 'node:child_process';
import { writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { publicationRuntime } from './support/publication-runtime';
import { selfHostedProvider, BrowserClient } from './support/provider';
import { provision, userId } from '../src/server/provision';
import { activities } from '../src/server/contracts';

const empty = process.argv.includes('--empty');
const f = await publicationRuntime('github', empty, true);
const provider = await selfHostedProvider();
const origin = 'http://localhost:3000';
await provision(f.r.f.store, {
  organization: { id: 'alpha', name: 'Alpha' },
  projects: [],
  members: [
    {
      issuer: provider.issuer,
      subject: 'alice',
      grants: activities.map((activity) => ({
        activity,
        scope: 'organization',
        scopeId: 'alpha',
        effect: 'allow',
      })),
    },
    {
      issuer: provider.issuer,
      subject: 'recipient',
      grants: [
        {
          activity: 'artifact.shared-read',
          scope: 'repository',
          scopeId: 'alpha-repo',
          effect: 'allow',
        },
      ],
    },
  ],
});
const env = {
  ...f.r.env,
  HOST: '127.0.0.1',
  PORT: '3000',
  FACTORY_ORIGIN: origin,
  FACTORY_OIDC_ISSUER: provider.issuer,
  FACTORY_OIDC_CLIENT_ID: 'factory',
  FACTORY_OIDC_CLIENT_SECRET: 'acceptance-provider-secret',
  FACTORY_TRUST_VERIFIED_EMAIL: 'true',
};
let web: ChildProcess | undefined;
let output = '';
async function startWeb() {
  web = spawn(process.execPath, ['.output/server/index.mjs'], {
    env,
    windowsHide: true,
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  web.stdout!.on('data', (b) => {
    output += b;
  });
  web.stderr!.on('data', (b) => {
    output += b;
  });
  for (let attempt = 0; attempt < 100; attempt++) {
    if (
      await fetch(origin)
        .then((r) => r.ok)
        .catch(() => false)
    )
      return;
    await new Promise((resolve) => setTimeout(resolve, 100));
  }
  throw Error(`Built application did not start: ${output.slice(-1500)}`);
}
async function stopWeb() {
  if (web && web.exitCode === null && web.signalCode === null) {
    const stopped = new Promise<void>((resolve) => web!.once('exit', () => resolve()));
    web.kill();
    await stopped;
  }
  web = undefined;
}
try {
  await startWeb();
  const browser = new BrowserClient(),
    recipient = new BrowserClient();
  await browser.login(origin, 'alice');
  await recipient.login(origin, 'recipient');
  if (empty) {
    await f.r.startWorker();
    assert.ok(
      process.argv.includes('--hold'),
      'The empty-report drill requires browser interaction',
    );
    console.log(JSON.stringify({ ready: true, origin, path: f.path, empty: true }));
    process.stdin.resume();
    await new Promise<void>((resolve) => process.stdin.once('data', () => resolve()));
    process.stdin.pause();
    const view = (await browser.json(origin, `${f.path}/reviews`)).body;
    assert.equal(view.publications.length, 1);
    assert.equal(view.publications[0].status, 'skipped');
    assert.equal(f.posts.length, 0);
    assert.equal((await browser.json(origin, `${f.path}/artifact-shares`)).body.shares.length, 0);
    console.log(
      JSON.stringify({ passed: true, checks: ['empty-output UI skip without share or POST'] }),
    );
  } else {
    const created = await browser.json(origin, `${f.path}/artifact-shares`, {
      operationId: 'built-share',
      run: f.run.id,
      decision: f.decision.id,
      recipients: [userId(provider.issuer, 'recipient'), userId(provider.issuer, 'alice')],
    });
    assert.equal(created.status, 200);
    const share = created.body.share,
      path = new URL(share.url).pathname;
    const first = await recipient.request(share.url),
      content = await first.text();
    assert.equal(first.status, 200);
    assert.equal(first.headers.get('cache-control'), 'no-store');
    assert.ok(content.includes(f.report.findings[0].title));
    for (const secret of [
      f.report.summary,
      f.report.findings[1].title,
      f.report.id,
      f.decision.id,
      'PRIVATE REJECTION REASON',
    ])
      assert.ok(!content.includes(secret));
    assert.equal((await fetch(share.url)).status, 401);
    for (const privatePath of [
      f.path,
      `${f.path}/reviews`,
      `${f.path}/facts`,
      `${f.path}/reviews/${f.report.id}/artifact`,
    ])
      assert.equal((await recipient.request(`${origin}${privatePath}`)).status, 403);
    assert.equal(
      (
        await browser.json(origin, `${f.path}/review-publications`, {
          operationId: 'built-publish',
          run: f.run.id,
          decision: f.decision.id,
          reference: share.id,
        })
      ).status,
      200,
    );
    await f.r.startWorker();
    await f.wait('completed');
    assert.equal(f.posts.length, 1);
    assert.ok(f.posts[0].body.body.includes(share.url));
    assert.ok(!f.posts[0].body.body.includes(f.report.findings[0].title));
    await stopWeb();
    await f.r.stopWorker();
    execFileSync('docker', ['restart', 'tbfactory-acceptance-db'], {
      windowsHide: true,
      stdio: 'pipe',
    });
    await startWeb();
    await f.r.startWorker();
    assert.equal(await (await recipient.request(share.url)).text(), content);
    const restored = (await browser.json(origin, `${f.path}/artifact-shares`)).body.shares.find(
      (s: any) => s.id === share.id,
    );
    assert.equal(restored.expiresAt, share.expiresAt);
    assert.equal(restored.contentVersion, share.contentVersion);
    assert.deepEqual(restored.recipients, share.recipients);
    assert.equal(f.posts.length, 1);
    if (process.argv.includes('--hold')) {
      console.log(
        JSON.stringify({
          ready: true,
          origin,
          path: f.path,
          share,
          recipient: userId(provider.issuer, 'alice'),
          directory: f.r.directory,
        }),
      );
      process.stdin.resume();
      await new Promise<void>((resolve) => process.stdin.once('data', () => resolve()));
      process.stdin.pause();
    }
    assert.equal(
      (
        await browser.json(origin, `${f.path}/artifact-shares/${share.id}/revoke`, {
          operationId: 'built-revoke',
        })
      ).status,
      200,
    );
    assert.equal((await recipient.request(share.url)).status, 403);
    await stopWeb();
    await f.r.stopWorker();
    await startWeb();
    await f.r.startWorker();
    assert.equal((await recipient.request(share.url)).status, 403);
    assert.equal(f.posts.length, 1);
    const evidenceFile = join(f.r.directory, 'sharing-acceptance.json');
    await writeFile(
      evidenceFile,
      JSON.stringify(
        {
          passed: true,
          checks: [
            'built HTTP explicit restricted share',
            'redacted content and independent recipient access',
            'reference-only GitHub provider effect',
            'web/database/worker restart retains content and restrictions',
            'authorized permanent revocation survives restart',
            'no completed publication replay',
          ],
          share,
          providerEffects: f.effects,
        },
        null,
        2,
      ),
    );
    console.log(JSON.stringify({ passed: true, evidenceFile }));
  }
} finally {
  await stopWeb();
  await provider.close();
  await f.close();
}
