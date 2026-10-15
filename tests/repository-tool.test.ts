import { test } from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { mkdir, writeFile, unlink } from 'node:fs/promises';
import { join, resolve } from 'node:path';
import { randomUUID } from 'node:crypto';

test('Repository tools serialize large and escaped Git output within sandbox retention', async () => {
  const directory = resolve('.runtime', `repository-tool-${randomUUID()}`);
  await mkdir(directory, { recursive: true });
  const git = (args: string[]) =>
    execFileSync('git', args, { cwd: directory, encoding: 'utf8', windowsHide: true }).trim();
  git(['init', '-b', 'main']);
  git(['config', 'user.email', 'fixture@example.test']);
  git(['config', 'user.name', 'Fixture']);
  git(['config', 'core.autocrlf', 'false']);
  await writeFile(join(directory, 'large.ts'), 'base\n');
  git(['add', '.']);
  git(['commit', '-m', 'Base']);
  const base = git(['rev-parse', 'HEAD']);
  const content = `${'"\\\t🙂'.repeat(100)}\n`.repeat(500);
  await writeFile(join(directory, 'large.ts'), content);
  for (let i = 0; i < 600; i++)
    await writeFile(
      join(directory, `file-${String(i).padStart(4, '0')}-${'x'.repeat(60)}.ts`),
      'fixture\n',
    );
  git(['add', '.']);
  git(['commit', '-m', 'Large change']);
  const source = git(['rev-parse', 'HEAD']);
  for (const operation of ['files', 'diff', 'read', 'location']) {
    const encoded = Buffer.from(
      JSON.stringify({ operation, path: 'large.ts', base, source }),
    ).toString('base64url');
    const stdout = execFileSync(
      'docker',
      [
        'run',
        '--rm',
        '--network',
        'none',
        '--mount',
        `type=bind,source=${directory},target=/workspace/repository,readonly`,
        '--mount',
        `type=bind,source=${resolve('docker/repository-tool.mjs')},target=/opt/factory/repository-tool.mjs,readonly`,
        'tbfactory-review:local',
        'node',
        '/opt/factory/repository-tool.mjs',
        encoded,
      ],
      { encoding: 'utf8', windowsHide: true },
    );
    assert.ok(Buffer.byteLength(stdout) < 32768, `${operation} must fit retention`);
    const response = JSON.parse(stdout);
    if (operation === 'files' || operation === 'diff' || operation === 'read') {
      assert.equal(response.truncated, true);
      assert.ok(response.output.length > 0);
    } else if (operation === 'location') {
      assert.deepEqual(response.output, { lines: 501 });
      assert.equal(response.truncated, false);
    }
  }
});

test('Diff can inspect deleted tracked files while rejecting traversal and unmatched literal paths', async () => {
  const directory = resolve('.runtime', `repository-deleted-${randomUUID()}`);
  await mkdir(directory, { recursive: true });
  const git = (args: string[]) =>
    execFileSync('git', args, { cwd: directory, encoding: 'utf8', windowsHide: true }).trim();
  git(['init', '-b', 'main']);
  git(['config', 'user.email', 'fixture@example.test']);
  git(['config', 'user.name', 'Fixture']);
  git(['config', 'core.autocrlf', 'false']);
  await writeFile(join(directory, 'removed.ts'), 'export const value = 1;\n');
  git(['add', '.']);
  git(['commit', '-m', 'Base']);
  const base = git(['rev-parse', 'HEAD']);
  await unlink(join(directory, 'removed.ts'));
  git(['add', '.']);
  git(['commit', '-m', 'Delete tracked file']);
  const source = git(['rev-parse', 'HEAD']);
  const diff = (path: string) =>
    execFileSync(
      'docker',
      [
        'run',
        '--rm',
        '--network',
        'none',
        '--mount',
        `type=bind,source=${directory},target=/workspace/repository,readonly`,
        '--mount',
        `type=bind,source=${resolve('docker/repository-tool.mjs')},target=/opt/factory/repository-tool.mjs,readonly`,
        'tbfactory-review:local',
        'node',
        '/opt/factory/repository-tool.mjs',
        Buffer.from(JSON.stringify({ operation: 'diff', path, base, source })).toString(
          'base64url',
        ),
      ],
      { encoding: 'utf8', windowsHide: true, stdio: 'pipe' },
    );
  const result = JSON.parse(diff('removed.ts'));
  assert.match(result.output, /deleted file mode/);
  assert.match(result.output, /-export const value = 1;/);
  assert.equal(result.truncated, false);
  for (const path of ['../removed.ts', '/removed.ts', '.git/config', 'missing.ts', ':(glob)*'])
    assert.throws(() => diff(path));
});
