import { createHash } from 'node:crypto';
import { createServer, type IncomingMessage, type ServerResponse } from 'node:http';
import { deflateSync } from 'node:zlib';
import { mkdir, open, readFile, rename } from 'node:fs/promises';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const alphaAiKey = 'docker-evaluation-alpha-ai-fixture-key';
const betaAiKey = 'docker-evaluation-beta-ai-fixture-key';
const repositoryKey = 'docker-evaluation-read-fixture-key';
const publicationKey = 'docker-evaluation-write-fixture-key';
const repositoryId = 12345;
const pullRequestNumber = 42;
const unchangedContent = "export const setting = 'unchanged';\n";

type Effect = { id: number; body: string; digest: string; createdAt: string };
type ReviewBoundaryOptions = { port?: number; host?: string; dataDirectory?: string };

function sha1(value: Buffer) {
  return createHash('sha1').update(value).digest('hex');
}

function gitObject(
  type: 'blob' | 'tree' | 'commit',
  content: Buffer,
  objects: Map<string, Buffer>,
) {
  const object = Buffer.concat([Buffer.from(`${type} ${content.length}\0`), content]);
  const oid = sha1(object);
  objects.set(`/repository.git/objects/${oid.slice(0, 2)}/${oid.slice(2)}`, deflateSync(object));
  return oid;
}

function gitTree(entries: { name: string; oid: string }[]) {
  const ordered = entries.toSorted((left, right) => left.name.localeCompare(right.name, 'en'));
  return Buffer.concat(
    ordered.flatMap(({ name, oid }) => [Buffer.from(`100644 ${name}\0`), Buffer.from(oid, 'hex')]),
  );
}

function fixtureRepository() {
  const objects = new Map<string, Buffer>();
  const priorChanged = gitObject('blob', Buffer.from('export const value = 0;\n'), objects);
  const nextChanged = gitObject('blob', Buffer.from('export const value = 1;\n'), objects);
  const unchanged = gitObject('blob', Buffer.from(unchangedContent), objects);
  const baseTree = gitObject(
    'tree',
    gitTree([
      { name: 'changed.ts', oid: priorChanged },
      { name: 'unchanged.ts', oid: unchanged },
    ]),
    objects,
  );
  const sourceTree = gitObject(
    'tree',
    gitTree([
      { name: 'changed.ts', oid: nextChanged },
      { name: 'unchanged.ts', oid: unchanged },
    ]),
    objects,
  );
  const identity =
    'author Docker Evaluation <docker-evaluation@example.test> 1700000000 +0000\n' +
    'committer Docker Evaluation <docker-evaluation@example.test> 1700000000 +0000\n\n';
  const targetCommit = gitObject(
    'commit',
    Buffer.from(`tree ${baseTree}\n${identity}Evaluation target base\n`),
    objects,
  );
  const sourceCommit = gitObject(
    'commit',
    Buffer.from(
      `tree ${sourceTree}\nparent ${targetCommit}\n${identity}Evaluation review change\n`,
    ),
    objects,
  );
  const refs = Buffer.from(
    `${sourceCommit}\trefs/heads/feature\n${targetCommit}\trefs/heads/main\n`,
  );
  const staticFiles = new Map<string, Buffer>([
    ['/repository.git/HEAD', Buffer.from('ref: refs/heads/main\n')],
    ['/repository.git/info/refs', refs],
    ['/repository.git/objects/info/packs', Buffer.alloc(0)],
  ]);
  return { objects, staticFiles, sourceCommit, targetCommit };
}

function json(response: ServerResponse, status: number, value: unknown) {
  response.writeHead(status, {
    'content-type': 'application/json; charset=utf-8',
    'cache-control': 'no-store',
  });
  response.end(JSON.stringify(value));
}

async function requestBody(request: IncomingMessage) {
  const chunks: Buffer[] = [];
  for await (const chunk of request) chunks.push(Buffer.from(chunk));
  return Buffer.concat(chunks).toString('utf8');
}

async function readEffects(path: string): Promise<Effect[]> {
  try {
    const decoded = JSON.parse(await readFile(path, 'utf8'));
    if (!Array.isArray(decoded)) throw Error('Invalid controlled effect journal');
    return decoded as Effect[];
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') return [];
    throw error;
  }
}

async function atomicWrite(path: string, value: unknown) {
  const temporary = `${path}.tmp`;
  const file = await open(temporary, 'w', 0o600);
  try {
    await file.writeFile(`${JSON.stringify(value, null, 2)}\n`);
    await file.sync();
  } finally {
    await file.close();
  }
  await rename(temporary, path);
  if (process.platform !== 'win32') {
    const directory = await open(dirname(path), 'r');
    try {
      await directory.sync();
    } finally {
      await directory.close();
    }
  }
}

function safeEffects(effects: Effect[]) {
  return effects.map(({ id, digest }) => ({ id, digest }));
}

function modelReply(
  model: string,
  choice: { role: string; content?: string | null; tool_calls?: unknown[] },
  reason: 'tool_calls' | 'stop',
) {
  return {
    id: 'docker-evaluation-response',
    object: 'chat.completion',
    created: 1,
    model,
    choices: [{ index: 0, message: choice, finish_reason: reason }],
    usage: { prompt_tokens: 20, completion_tokens: 40, total_tokens: 60 },
  };
}

export async function createReviewBoundary(options: ReviewBoundaryOptions = {}) {
  const host = options.host ?? '127.0.0.1';
  const directory = resolve(
    options.dataDirectory ??
      process.env.FACTORY_EVALUATION_DATA ??
      '.runtime/docker-evaluation-boundary',
  );
  await mkdir(directory, { recursive: true });
  const effectsPath = join(directory, 'github-effects.json');
  const git = fixtureRepository();
  const aiByOrganization = { alpha: 0, beta: 0 };
  let aiRequests = 0;
  let gitFetches = 0;
  let publicationEvidenceReads = 0;
  let readResultConfirmed = false;
  let changesResultConfirmed = false;
  let dropNextPublicationResponse = false;
  let writes = Promise.resolve();

  const server = createServer(async (request, response) => {
    try {
      const url = new URL(request.url ?? '/', `http://${request.headers.host ?? 'localhost'}`);
      const path = url.pathname;
      if (request.method === 'GET' && path === '/health') {
        json(response, 200, { ready: true });
        return;
      }
      if (request.method === 'GET' && path === '/metadata') {
        json(response, 200, {
          sourceCommit: git.sourceCommit,
          targetCommit: git.targetCommit,
          unchangedContent,
        });
        return;
      }
      if (request.method === 'GET' && path === '/summary') {
        const effects = await readEffects(effectsPath);
        json(response, 200, {
          gitFetches,
          aiRequests,
          aiByOrganization,
          publicationEvidenceReads,
          readResultConfirmed,
          changesResultConfirmed,
          effects: safeEffects(effects),
        });
        return;
      }
      if (
        request.method === 'POST' &&
        path === '/__evaluation/faults/drop-next-publication-response'
      ) {
        if (dropNextPublicationResponse) {
          json(response, 409, { error: { message: 'A response fault is already armed' } });
          return;
        }
        dropNextPublicationResponse = true;
        json(response, 200, { armed: true, remainingPosts: 1 });
        return;
      }
      if (request.method === 'GET' && path.startsWith('/repository.git/')) {
        const expectedRepositoryAuthorization = `Basic ${Buffer.from(`x-access-token:${repositoryKey}`).toString('base64')}`;
        if (request.headers.authorization !== expectedRepositoryAuthorization) {
          response.writeHead(401);
          response.end();
          return;
        }
        gitFetches++;
        const staticFile = git.staticFiles.get(path);
        const object = git.objects.get(path);
        const content = staticFile ?? object;
        if (!content) {
          response.writeHead(404);
          response.end();
          return;
        }
        response.writeHead(200, {
          'content-type': path.includes('/objects/') ? 'application/octet-stream' : 'text/plain',
          'cache-control': 'no-store',
          'content-length': content.length,
        });
        response.end(content);
        return;
      }
      if (request.method === 'POST' && path === '/v1/chat/completions') {
        const authorization = request.headers.authorization;
        const organization =
          authorization === `Bearer ${alphaAiKey}`
            ? 'alpha'
            : authorization === `Bearer ${betaAiKey}`
              ? 'beta'
              : undefined;
        if (!organization) {
          json(response, 401, { error: { message: 'Controlled evaluation credential denied' } });
          return;
        }
        const input = JSON.parse(await requestBody(request));
        const model = typeof input.model === 'string' ? input.model : 'docker-evaluation-model';
        const messages = Array.isArray(input.messages) ? input.messages : [];
        aiRequests++;
        aiByOrganization[organization]++;
        const toolResults = messages.filter((message: any) => message?.role === 'tool');
        if (toolResults.length) {
          const content = toolResults
            .map((message: any) => String(message.content ?? ''))
            .join('\n');
          readResultConfirmed ||= content.includes(unchangedContent.trim());
          changesResultConfirmed ||= content.includes('changed.ts');
          const expectedResults =
            content.includes(unchangedContent.trim()) && content.includes('changed.ts');
          if (!expectedResults) {
            json(response, 502, {
              error: { message: 'Expected repository exploration result missing' },
            });
            return;
          }
          json(
            response,
            200,
            modelReply(
              model,
              {
                role: 'assistant',
                content: JSON.stringify({
                  summary: 'Reviewed the changed value alongside the retained unchanged setting.',
                  findings: [
                    {
                      title: 'Review the unchanged setting',
                      severity: 'medium',
                      explanation:
                        'The changed code relies on the unchanged setting in this fixture.',
                      location: { path: 'unchanged.ts', line: 1 },
                    },
                  ],
                }),
              },
              'stop',
            ),
          );
          return;
        }
        json(
          response,
          200,
          modelReply(
            model,
            {
              role: 'assistant',
              content: null,
              tool_calls: [
                {
                  id: 'docker-evaluation-read-unchanged',
                  type: 'function',
                  function: { name: 'read', arguments: JSON.stringify({ path: 'unchanged.ts' }) },
                },
                {
                  id: 'docker-evaluation-changes',
                  type: 'function',
                  function: { name: 'changes', arguments: '{}' },
                },
              ],
            },
            'tool_calls',
          ),
        );
        return;
      }
      if (path === '/repos/example/code' && request.method === 'GET') {
        if (request.headers.authorization !== `Bearer ${publicationKey}`) {
          json(response, 401, { message: 'Controlled publication credential denied' });
          return;
        }
        json(response, 200, { id: repositoryId });
        return;
      }
      if (
        path === `/repos/example/code/issues/${pullRequestNumber}/comments` &&
        request.method === 'GET'
      ) {
        if (request.headers.authorization !== `Bearer ${publicationKey}`) {
          json(response, 401, { message: 'Controlled publication credential denied' });
          return;
        }
        await writes;
        publicationEvidenceReads++;
        const effects = await readEffects(effectsPath);
        json(
          response,
          200,
          effects.map(({ id, body }) => ({ id, body })),
        );
        return;
      }
      if (
        path === `/repos/example/code/issues/${pullRequestNumber}/comments` &&
        request.method === 'POST'
      ) {
        if (request.headers.authorization !== `Bearer ${publicationKey}`) {
          json(response, 401, { message: 'Controlled publication credential denied' });
          return;
        }
        const input = JSON.parse(await requestBody(request));
        if (typeof input.body !== 'string' || !input.body.trim()) {
          json(response, 422, { message: 'Comment body required' });
          return;
        }
        const dropResponse = dropNextPublicationResponse;
        dropNextPublicationResponse = false;
        const complete = writes.then(async () => {
          const effects = await readEffects(effectsPath);
          const effect: Effect = {
            id: effects.reduce((largest, row) => Math.max(largest, row.id), 0) + 1,
            body: input.body,
            digest: createHash('sha256').update(input.body).digest('hex'),
            createdAt: new Date().toISOString(),
          };
          await atomicWrite(effectsPath, [...effects, effect]);
          return effect;
        });
        writes = complete.then(
          () => undefined,
          () => undefined,
        );
        const effect = await complete;
        if (dropResponse) {
          response.destroy();
          return;
        }
        json(response, 201, { id: effect.id, body: effect.body });
        return;
      }
      response.writeHead(404);
      response.end();
    } catch {
      if (!response.headersSent)
        json(response, 500, { error: { message: 'Evaluation boundary request failed' } });
      else response.destroy();
    }
  });

  await new Promise<void>((resolveListen, rejectListen) => {
    server.once('error', rejectListen);
    server.listen(
      options.port ?? Number(process.env.FACTORY_EVALUATION_PORT ?? 18082),
      host,
      () => {
        server.off('error', rejectListen);
        resolveListen();
      },
    );
  });
  const address = server.address();
  if (!address || typeof address === 'string') throw Error('Evaluation boundary did not bind TCP');
  let closed = false;
  return {
    origin: `http://${host === '0.0.0.0' ? '127.0.0.1' : host}:${address.port}`,
    close: async () => {
      if (closed) return;
      closed = true;
      if (!server.listening) return;
      await new Promise<void>((resolveClose, rejectClose) => {
        server.close((error) => (error ? rejectClose(error) : resolveClose()));
        server.closeIdleConnections();
      });
    },
  };
}

const invokedAsScript =
  process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (invokedAsScript) {
  const port = Number(process.env.FACTORY_EVALUATION_PORT ?? 18082);
  const boundary = await createReviewBoundary({ port, host: '0.0.0.0' });
  console.log(JSON.stringify({ ready: true, port }));
  const stop = () => void boundary.close().then(() => process.exit(0));
  process.once('SIGINT', stop);
  process.once('SIGTERM', stop);
}
