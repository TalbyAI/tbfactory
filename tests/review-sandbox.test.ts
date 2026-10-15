import { test } from 'node:test';
import assert from 'node:assert/strict';
import { RepositorySandbox } from '../src/server/review-sandbox.ts';
import { type Run } from '../src/server/reviews.ts';

test('Parallel repository tools share one sandbox command slot and a failed command releases it', async (t) => {
  const sandbox = new RepositorySandbox(
    {
      id: 'bounded-tools',
      organization: 'alpha',
      workItem: 'review',
      data: {
        workflow: 'review-v1',
        status: 'running',
        token: 'fixture',
        identity: { kind: 'user', user: 'alice' },
        brief: 'Inspect repository',
        createdAt: 1,
        calls: 0,
        aiMs: 0,
        executionMs: 0,
        inputs: { fields: { sourceCommit: 'a'.repeat(40) } },
      },
    } satisfies Run,
    `sha256:${'0'.repeat(64)}`,
  );
  let active = 0;
  let maximum = 0;
  let commands = 0;
  const commandsApi = sandbox.sandbox as {
    executeCommand: NonNullable<typeof sandbox.sandbox.executeCommand>;
  };
  t.mock.method(commandsApi, 'executeCommand', async () => {
    active++;
    maximum = Math.max(maximum, active);
    const first = commands++ === 0;
    await new Promise((resolve) => setTimeout(resolve, 10));
    active--;
    return {
      exitCode: first ? 1 : 0,
      stdout: JSON.stringify({ output: 'Repository evidence', truncated: false }),
      stderr: first ? 'Fixture failure' : '',
    };
  });
  const results = await Promise.allSettled(
    Array.from({ length: 8 }, () => sandbox.tool({ operation: 'search', query: 'value' })),
  );
  assert.equal(maximum, 1);
  assert.equal(commands, 8);
  assert.equal(results[0].status, 'rejected');
  for (const result of results.slice(1)) {
    assert.equal(result.status, 'fulfilled');
    if (result.status === 'fulfilled') assert.equal(result.value, 'Repository evidence');
  }
});
