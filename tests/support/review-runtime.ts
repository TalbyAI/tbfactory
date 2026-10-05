import { spawn, execFileSync, type ChildProcess } from 'node:child_process';
import { createServer } from 'node:http';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { join, resolve } from 'node:path';
import { randomBytes, randomUUID } from 'node:crypto';
import { KeyRing } from '../../src/server/key-ring';
import { OrganizationSecrets } from '../../src/server/secrets';
import { putReviewConfiguration, putRepositoryAccess } from '../../src/server/review-configuration';
import { fixture } from './factory';
import { ReviewArtifacts } from '../../src/server/review-artifacts';
import { handleHttp } from '../../src/server/http';

export async function reviewRuntime() {
  const f = await fixture();
  await f.bootstrap('alpha');
  await f.bootstrap('beta', ['alice', 'bob']);
  const directory = resolve('.runtime', `review-${randomUUID()}`);
  await mkdir(directory, { recursive: true });
  const source = join(directory, 'source');
  await mkdir(source);
  const git = (args: string[], cwd = source) =>
    execFileSync('git', args, {
      cwd,
      encoding: 'utf8',
      windowsHide: true,
      stdio: ['ignore', 'pipe', 'pipe'],
    }).trim();
  git(['init', '-b', 'main']);
  git(['config', 'user.email', 'fixture@example.test']);
  git(['config', 'user.name', 'Fixture']);
  await writeFile(join(source, 'unchanged.ts'), 'export const token = "public-example";\n');
  await writeFile(join(source, 'changed.ts'), 'export const value = 1;\n');
  git(['add', '.']);
  git(['commit', '-m', 'Base']);
  const target = git(['rev-parse', 'HEAD']);
  git(['checkout', '-b', 'feature']);
  await writeFile(join(source, 'changed.ts'), 'export const value = 2;\n');
  git(['add', '.']);
  git(['commit', '-m', 'Source']);
  const head = git(['rev-parse', 'HEAD']);
  git(['clone', '--bare', source, join(directory, 'repository.git')]);
  git(['update-server-info'], join(directory, 'repository.git'));
  const requests: any[] = [];
  let behavior: 'report' | 'tools' | 'delay' | 'disconnect' | 'delegate' | 'empty' | 'mixed' =
    'tools';
  let delay = 0;
  const server = createServer(async (req, res) => {
    if (req.url?.startsWith('/repository.git/')) {
      try {
        const pathname = new URL(req.url, 'http://fixture').pathname;
        const path = resolve(directory, `.${pathname}`);
        if (
          !path.startsWith(join(directory, 'repository.git') + '\\') &&
          !path.startsWith(join(directory, 'repository.git') + '/')
        )
          throw Error();
        const data = await readFile(path);
        res.writeHead(200, {
          'content-type': pathname.endsWith('/info/refs')
            ? 'text/plain'
            : 'application/octet-stream',
        });
        res.end(data);
      } catch {
        res.writeHead(404);
        res.end();
      }
      return;
    }
    const parts: Buffer[] = [];
    for await (const part of req) parts.push(Buffer.from(part));
    const body = JSON.parse(Buffer.concat(parts).toString());
    requests.push({ body, key: req.headers.authorization });
    if (behavior === 'disconnect') {
      req.socket.destroy();
      return;
    }
    if (delay) await new Promise((r) => setTimeout(r, delay));
    const messages = body.messages ?? [];
    const subordinate = messages.some(
      (m: any) => typeof m.content === 'string' && m.content.includes('concise evidence'),
    );
    const hasTools = messages.some((m: any) => m.role === 'tool');
    const toolCalls =
      !hasTools && behavior === 'tools'
        ? [
            {
              id: 'read-unchanged',
              type: 'function',
              function: { name: 'read', arguments: JSON.stringify({ path: 'unchanged.ts' }) },
            },
            {
              id: 'inspect-changes',
              type: 'function',
              function: { name: 'changes', arguments: '{}' },
            },
          ]
        : !hasTools && behavior === 'delegate' && !subordinate
          ? [
              {
                id: 'delegate-a',
                type: 'function',
                function: {
                  name: 'delegate',
                  arguments: JSON.stringify({ question: 'Inspect unchanged.ts' }),
                },
              },
              {
                id: 'delegate-b',
                type: 'function',
                function: {
                  name: 'delegate',
                  arguments: JSON.stringify({ question: 'Inspect changed.ts' }),
                },
              },
            ]
          : null;
    const previous = JSON.parse(messages.find((m: any) => m.role === 'user')?.content ?? '{}')
      .previousReports?.[0]?.findings?.[0];
    const text = subordinate
      ? 'The unchanged file is relevant.'
      : JSON.stringify({
          summary: 'Review completed with repository evidence',
          findings:
            behavior === 'empty'
              ? []
              : [
                  {
                    title: 'Review unchanged configuration',
                    severity: 'medium',
                    explanation: 'The source change relies on this unchanged configuration.',
                    location: { path: 'unchanged.ts', line: 1 },
                    ...(previous ? { previousFinding: previous.id, assessment: 'enriched' } : {}),
                  },
                  ...(behavior === 'mixed'
                    ? [
                        {
                          title: 'Review changed value',
                          severity: 'low',
                          explanation: 'The changed value needs human assessment.',
                          location: { path: 'changed.ts', line: 1 },
                        },
                      ]
                    : []),
                ],
        });
    if (!body.stream) {
      res.writeHead(200, { 'content-type': 'application/json' });
      res.end(
        JSON.stringify({
          id: 'fixture-response',
          object: 'chat.completion',
          created: 1,
          model: body.model,
          choices: [
            {
              index: 0,
              message: toolCalls
                ? { role: 'assistant', content: null, tool_calls: toolCalls }
                : { role: 'assistant', content: text },
              finish_reason: toolCalls ? 'tool_calls' : 'stop',
            },
          ],
          usage: {
            prompt_tokens: 12,
            completion_tokens: 20,
            total_tokens: 32,
            ...(body.model.startsWith('openai/') ? { cost: 0.0001 } : {}),
          },
        }),
      );
      return;
    }
    res.writeHead(200, { 'content-type': 'text/event-stream' });
    const delta = toolCalls
      ? { role: 'assistant', tool_calls: toolCalls.map((c, index) => ({ ...c, index })) }
      : { role: 'assistant', content: text };
    res.write(
      `data: ${JSON.stringify({ id: 'fixture-response', object: 'chat.completion.chunk', created: 1, model: body.model, choices: [{ index: 0, delta, finish_reason: null }] })}\n\n`,
    );
    res.write(
      `data: ${JSON.stringify({ id: 'fixture-response', object: 'chat.completion.chunk', created: 1, model: body.model, choices: [{ index: 0, delta: {}, finish_reason: toolCalls ? 'tool_calls' : 'stop' }], usage: { prompt_tokens: 12, completion_tokens: 20, total_tokens: 32 } })}\n\n`,
    );
    res.end('data: [DONE]\n\n');
  });
  await new Promise<void>((r) => server.listen(0, '0.0.0.0', r));
  const port = (server.address() as any).port;
  const root = randomBytes(32);
  const rootFile = join(directory, 'root.key');
  await writeFile(rootFile, root);
  const ring = new KeyRing({
    directory: join(directory, 'ring'),
    backupDirectory: join(directory, 'backup'),
    rootKey: root,
    rootVersion: 'root-1',
    installation: 'review-test',
  });
  await ring.setup();
  const secrets = new OrganizationSecrets(f.store, ring);
  const artifacts = new ReviewArtifacts(join(directory, 'artifacts'));
  const configInput = {
    organization: 'alpha',
    enabled: true,
    mode: 'organization' as const,
    entitled: false,
    key: 'fixture-ai-key',
    ai: {
      adapter: 'openai-chat' as const,
      url: `http://127.0.0.1:${port}/v1`,
      model: 'fixture-model',
      permittedModels: [{ id: 'fixture-model', tools: true, reasoning: [] }],
    },
    limits: { calls: 40, aiMs: 600000, executionMs: 1200000, subordinateAgents: 4 },
    rules: {
      enabled: false,
      repositories: ['alpha-repo'],
      targetBranches: [],
      includeDrafts: false,
    },
  };
  await putReviewConfiguration(f.store, secrets, configInput, ['127.0.0.1'], true);
  await putRepositoryAccess(
    f.store,
    secrets,
    {
      organization: 'alpha',
      repository: 'alpha-repo',
      provider: 'github',
      credential: 'read-fixture',
      urls: [`http://host.docker.internal:${port}/repository.git`],
      key: 'fixture-git-key',
      enabled: true,
    },
    ['host.docker.internal'],
    true,
  );
  const image = execFileSync(
    'docker',
    ['image', 'inspect', 'tbfactory-review:local', '--format', '{{.Id}}'],
    { encoding: 'utf8', windowsHide: true },
  ).trim();
  const env = {
    ...process.env,
    FACTORY_DATABASE_URL: f.config.url,
    FACTORY_DATABASE_NAMESPACE: f.config.namespace,
    FACTORY_DATABASE_NAME: f.config.database,
    FACTORY_DATABASE_USER: f.config.username,
    FACTORY_DATABASE_PASSWORD: f.config.password,
    FACTORY_ROOT_KEY_FILE: rootFile,
    FACTORY_ROOT_KEY_VERSION: 'root-1',
    FACTORY_INSTALLATION: 'review-test',
    FACTORY_RING_DIRECTORY: join(directory, 'ring'),
    FACTORY_RING_BACKUP_DIRECTORY: join(directory, 'backup'),
    FACTORY_WORKER_DIRECTORY: join(directory, 'worker'),
    FACTORY_ARTIFACT_DIRECTORY: artifacts.directory,
    FACTORY_SANDBOX_IMAGE: image,
    FACTORY_APPROVED_ENDPOINT_HOSTS: '127.0.0.1,host.docker.internal',
    FACTORY_ALLOW_LOOPBACK_HTTP: 'true',
  };
  let worker: ChildProcess | undefined;
  let output = '';
  async function startWorker() {
    worker = spawn(process.execPath, ['--import', 'tsx', 'scripts/worker.ts'], {
      env,
      windowsHide: true,
      stdio: ['ignore', 'pipe', 'pipe', 'ipc'],
    });
    worker.stdout!.on('data', (b) => {
      output += b;
    });
    worker.stderr!.on('data', (b) => {
      output += b;
    });
    await new Promise<void>((resolve, reject) => {
      const timer = setTimeout(
        () => reject(Error(`Worker readiness timeout: ${output.slice(-1500)}`)),
        15000,
      );
      worker!.once('message', () => {
        clearTimeout(timer);
        resolve();
      });
      worker!.once('exit', (code) => {
        clearTimeout(timer);
        reject(Error(`Worker exited ${code}: ${output.slice(-2500)}`));
      });
    });
    return worker;
  }
  async function stopWorker() {
    if (worker && worker.exitCode === null && worker.signalCode === null) {
      worker.send('stop');
      await new Promise<void>((r) => worker!.once('exit', () => r()));
    }
    worker = undefined;
  }
  async function download(path: string, token = f.alice.token) {
    return handleHttp(
      new Request(`http://localhost:3000${path}`, {
        headers: { cookie: `__Host-factory_session=${token}` },
      }),
      { auth: f.auth, factory: f.factory, origin: 'http://localhost:3000', artifacts },
    );
  }
  async function createItem(suffix = 'review') {
    const base = '/api/organizations/alpha';
    await f.request(`${base}/work-item-types`, {
      operationId: `select-${suffix}`,
      type: 'pull-request-review',
      version: 3,
      enabled: true,
    });
    const created = await f.request(`${base}/work-items`, {
      operationId: `create-${suffix}`,
      project: 'alpha-project',
      repository: 'alpha-repo',
      title: suffix,
      type: 'pull-request-review',
    });
    const path = `${base}/work-items/${created.body.workItem.id}`;
    await f.request(`${path}/review-facts`, {
      operationId: `inputs-${suffix}`,
      fields: {
        sourceBranch: 'feature',
        targetBranch: 'main',
        sourceCommit: head,
        targetCommit: target,
      },
    });
    return path;
  }
  async function wait(path: string, status: string, timeout = 30000) {
    const deadline = Date.now() + timeout;
    let latest: any;
    while (Date.now() < deadline) {
      latest = await f.request(`${path}/reviews`);
      if (latest.body.runs?.some((r: any) => r.status === status)) return latest.body;
      await new Promise((r) => setTimeout(r, 100));
    }
    throw Error(
      `Review did not reach ${status}: ${JSON.stringify(latest)}\n${output.slice(-2500)}`,
    );
  }
  return {
    f,
    secrets,
    directory,
    env,
    head,
    target,
    requests,
    configInput,
    createItem,
    wait,
    startWorker,
    stopWorker,
    download,
    get worker() {
      return worker;
    },
    behavior: (value: typeof behavior, milliseconds = 0) => {
      behavior = value;
      delay = milliseconds;
    },
    configure: async (changes: Record<string, unknown>) =>
      putReviewConfiguration(f.store, secrets, { ...configInput, ...changes }, ['127.0.0.1'], true),
    close: async () => {
      await stopWorker();
      server.closeAllConnections();
      await new Promise<void>((r) => server.close(() => r()));
      await f.close();
    },
  };
}
