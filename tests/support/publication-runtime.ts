import { createServer } from 'node:http';
import { readFile, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import assert from 'node:assert/strict';
import { reviewRuntime } from './review-runtime';
import { sourceInput, observation, delivery } from './observations';
import { ingestObservation, putSource } from '../../src/server/observations';
import { putPublicationConfiguration } from '../../src/server/publication-provider';

export async function waitPublicationRun(
  r: Awaited<ReturnType<typeof reviewRuntime>>,
  path: string,
  run: string,
  status: string,
) {
  const deadline = Date.now() + 30000;
  let view: any;
  do {
    view = (await r.f.request(`${path}/reviews`)).body;
    if (view.runs.find((r: any) => r.id === run)?.status === status) return view;
    await new Promise((resolve) => setTimeout(resolve, 100));
  } while (Date.now() < deadline);
  assert.fail(`Run did not reach ${status}: ${JSON.stringify(view)}`);
}

export async function publicationRuntime(provider: 'github' | 'azure-devops', empty = false) {
  const r = await reviewRuntime();
  const effects: any[] = [],
    posts: any[] = [],
    reads: string[] = [];
  const effectsPath = join(r.directory, 'publication-effects.json');
  await writeFile(effectsPath, '[]');
  let behavior:
    | 'success'
    | 'reject'
    | 'lost'
    | 'malformed'
    | 'evidence-error'
    | 'partial-evidence'
    | 'empty-evidence'
    | 'duplicate-evidence'
    | 'incomplete-evidence'
    | 'slow' = 'success';
  let release: (() => void) | undefined;
  let holdRepository = false,
    repositoryEntered = false;
  const server = createServer(async (req, res) => {
    const chunks: Buffer[] = [];
    for await (const chunk of req) chunks.push(Buffer.from(chunk));
    if (req.method === 'GET') {
      if (holdRepository && !req.url?.includes('/comments') && !req.url?.includes('/threads')) {
        repositoryEntered = true;
        await new Promise<void>((resolve) => {
          release = resolve;
        });
      }
      reads.push(req.url!);
      if (behavior === 'evidence-error') {
        res.writeHead(503);
        res.end();
        return;
      }
      const recorded = JSON.parse(await readFile(effectsPath, 'utf8'));
      res.setHeader('content-type', 'application/json');
      if (req.url?.startsWith('/repos/example/code?')) {
        res.end(JSON.stringify({ id: 12345 }));
        return;
      }
      if (!req.url?.includes('/threads') && provider === 'azure-devops') {
        res.end(
          JSON.stringify({
            id: sourceInput(provider).external.repository,
            project: { id: '22222222-2222-4222-8222-222222222222' },
          }),
        );
        return;
      }
      if (behavior === 'partial-evidence' && req.url?.includes('page=2')) {
        res.writeHead(503);
        res.end();
        return;
      }
      if (behavior === 'partial-evidence' || behavior === 'incomplete-evidence')
        res.setHeader('link', '</comments?page=2>; rel="next"');
      const listed =
        behavior === 'empty-evidence'
          ? []
          : behavior === 'duplicate-evidence'
            ? [...recorded, { ...recorded[0], id: 999 }]
            : behavior === 'incomplete-evidence'
              ? Array.from({ length: 100 }, (_, i) => ({ id: i + 1000, body: 'Other comment' }))
              : recorded;
      res.end(JSON.stringify(provider === 'github' ? listed : { value: listed }));
      return;
    }
    const body = JSON.parse(Buffer.concat(chunks).toString());
    posts.push({ body, url: req.url, authorization: req.headers.authorization });
    if (behavior === 'reject') {
      res.writeHead(403);
      res.end();
      return;
    }
    const content = body.body ?? body.comments[0].content;
    const effect =
      provider === 'github'
        ? { id: effects.length + 1, body: content }
        : { id: effects.length + 1, comments: [{ content }] };
    effects.push(effect);
    await writeFile(effectsPath, JSON.stringify(effects));
    if (behavior === 'lost') {
      req.socket.destroy();
      return;
    }
    if (behavior === 'slow')
      await new Promise<void>((resolve) => {
        release = resolve;
      });
    res.writeHead(provider === 'github' ? 201 : 200, { 'content-type': 'application/json' });
    res.end(JSON.stringify(behavior === 'malformed' ? { id: effect.id } : effect));
  });
  await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
  try {
    await r.f.request('/api/organizations/alpha/work-item-types', {
      operationId: 'type',
      type: 'pull-request-review',
      version: 4,
      enabled: true,
    });
    const source = sourceInput(provider);
    await putSource(r.f.store, r.secrets, source);
    const payload: any = observation(provider);
    if (provider === 'github') {
      payload.pull_request.head = { sha: r.head, ref: 'feature' };
      payload.pull_request.base = { ...payload.pull_request.base, sha: r.target, ref: 'main' };
    } else {
      payload.resource.sourceRefName = 'refs/heads/feature';
      payload.resource.targetRefName = 'refs/heads/main';
      payload.resource.lastMergeSourceCommit.commitId = r.head;
      payload.resource.lastMergeTargetCommit.commitId = r.target;
    }
    const ingested: any = await ingestObservation(
      r.f.store,
      r.secrets,
      delivery(source, payload),
      'alpha',
      provider,
    );
    const path = `/api/organizations/alpha/work-items/${ingested.workItemId}`;
    r.behavior(empty ? 'empty' : 'mixed');
    assert.equal(
      (
        await r.f.request(`${path}/transition-requests`, {
          operationId: 'start',
          transition: 'request-review',
          version: 4,
          expectedState: 'registered',
          inputs: { reviewBrief: 'Review code' },
        })
      ).status,
      200,
    );
    await r.startWorker();
    const view = await r.wait(path, 'waiting-review');
    const report = view.reports[0],
      run = view.runs.find((run: any) => run.report === report.id);
    const decision = await r.f.request(`${path}/review-decisions`, {
      operationId: 'decision',
      run: run.id,
      reportVersion: report.id,
      reviewed: true,
      findings: report.findings.map((f: any, i: number) =>
        i === 0
          ? { finding: f.id, decision: 'confirmed' }
          : { finding: f.id, decision: 'rejected', reason: 'PRIVATE REJECTION REASON' },
      ),
    });
    assert.equal(decision.status, 200);
    await waitPublicationRun(r, path, run.id, 'completed');
    await r.stopWorker();
    const config = {
      organization: 'alpha',
      repository: 'alpha-repo',
      source: provider,
      enabled: true,
      credential: 'write-fixture',
      key: 'publication-secret',
      endpoint: `http://127.0.0.1:${(server.address() as any).port}`,
      ...(provider === 'github' ? { githubRepository: 'example/code' } : {}),
    };
    await putPublicationConfiguration(r.f.store, r.secrets, config, ['127.0.0.1'], true);
    let operation = 0;
    const act = (
      endpoint: string,
      body: Record<string, unknown> = {},
      secret?: string,
      bearer = false,
    ) =>
      r.f.request(
        `${path}/${endpoint}`,
        { operationId: `publication-${++operation}`, run: run.id, ...body },
        secret,
        bearer,
      );
    const viewPublication = async () => (await r.f.request(`${path}/reviews`)).body;
    const wait = async (status: string) =>
      waitPublicationRun(
        r,
        path,
        run.id,
        status === 'completed' ? status : `publication-${status}`,
      );
    return {
      r,
      path,
      run,
      report,
      decision: decision.body.fact,
      source,
      config,
      act,
      view: viewPublication,
      wait,
      effects,
      posts,
      reads,
      effectsPath,
      behavior: (value: typeof behavior) => {
        behavior = value;
      },
      release: () => {
        holdRepository = false;
        release?.();
      },
      holdRepository: () => {
        holdRepository = true;
      },
      repositoryEntered: () => repositoryEntered,
      close: async () => {
        release?.();
        server.closeAllConnections();
        await new Promise<void>((resolve) => server.close(() => resolve()));
        await r.close();
      },
    };
  } catch (error) {
    server.closeAllConnections();
    await new Promise<void>((resolve) => server.close(() => resolve()));
    await r.close();
    throw error;
  }
}
