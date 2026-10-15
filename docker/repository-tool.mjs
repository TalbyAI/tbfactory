import { execFileSync } from 'node:child_process';
import { realpathSync, readFileSync, statSync } from 'node:fs';
import { resolve } from 'node:path';

// Fixed installation code; repository contents never supply executable tools.
const input = JSON.parse(Buffer.from(process.argv[2], 'base64url').toString());
const root = '/workspace/repository';
const pathName = (name) => {
  if (
    typeof name !== 'string' ||
    !name ||
    name.startsWith('/') ||
    name.includes('\\') ||
    name.split('/').some((p) => !p || p === '.' || p === '..' || p === '.git')
  )
    throw Error('Repository path denied');
  return name;
};
const path = (name) => {
  const actual = realpathSync(resolve(root, pathName(name)));
  if (!actual.startsWith(`${root}/`) || !statSync(actual).isFile())
    throw Error('Repository path denied');
  return actual;
};
const git = (args) =>
  execFileSync(
    'git',
    [
      '-c',
      'core.hooksPath=/dev/null',
      '-c',
      'core.fsmonitor=false',
      '-c',
      'diff.external=',
      '-c',
      'core.pager=cat',
      '--literal-pathspecs',
      ...args,
    ],
    {
      cwd: root,
      timeout: 10000,
      maxBuffer: 16 * 1024 * 1024,
      encoding: 'utf8',
      env: {
        PATH: process.env.PATH,
        HOME: '/tmp',
        GIT_CONFIG_NOSYSTEM: '1',
        GIT_TERMINAL_PROMPT: '0',
      },
    },
  );
let output;
if (input.operation === 'read' || input.operation === 'location') {
  const actual = path(input.path);
  if (statSync(actual).size > 1024 * 1024) throw Error('File exceeds tool size limit');
  const content = readFileSync(actual, 'utf8');
  if (content.includes('\0')) throw Error('Binary file denied');
  if (input.operation === 'location') output = { lines: content.split('\n').length };
  else {
    const lines = content.split('\n');
    const start = Math.max(1, Math.floor(input.start ?? 1));
    const count = Math.min(200, Math.max(1, Math.floor(input.count ?? 100)));
    output = lines
      .slice(start - 1, start - 1 + count)
      .map((line, i) => `${start + i}: ${line}`)
      .join('\n')
      .slice(0, 16000);
  }
} else if (input.operation === 'search') {
  if (typeof input.query !== 'string' || input.query.length > 200)
    throw Error('Search query denied');
  try {
    output = git(['grep', '-n', '-I', '-F', '--', input.query]);
  } catch (e) {
    if (e.status === 1) output = 'No matches';
    else throw Error('Search output exceeds bounds or search failed');
  }
} else if (input.operation === 'files') output = git(['ls-files']);
else if (input.operation === 'history')
  output = git(['log', '--no-decorate', '--format=%h %s', '-20', `${input.base}..${input.source}`]);
else if (input.operation === 'changes')
  output = git([
    'diff',
    '--no-ext-diff',
    '--no-textconv',
    '--stat',
    input.base,
    input.source,
    '--',
  ]);
else if (input.operation === 'diff') {
  const name = pathName(input.path);
  if (
    ![input.base, input.source].some(
      (ref) => git(['ls-tree', '--format=%(objecttype)', ref, '--', name]).trim() === 'blob',
    )
  )
    throw Error('Repository path denied');
  output = git(['diff', '--no-ext-diff', '--no-textconv', input.base, input.source, '--', name]);
} else throw Error('Repository operation denied');
let truncated = false;
while (Buffer.byteLength(JSON.stringify({ output, truncated })) > 24000) {
  output = output.slice(0, Math.floor(output.length * 0.8));
  truncated = true;
}
console.log(JSON.stringify({ output, truncated }));
