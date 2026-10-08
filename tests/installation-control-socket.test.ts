import assert from 'node:assert/strict';
import { spawn, type ChildProcess } from 'node:child_process';
import { createConnection, createServer, type Server, type Socket } from 'node:net';
import { lstat, mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { test } from 'node:test';

function socketResponse(address: string) {
  return new Promise<string>((resolve, reject) => {
    const socket = createConnection(address);
    let response = '';
    socket.setEncoding('utf8');
    socket.on('data', (chunk) => {
      response += chunk;
      socket.end();
      resolve(response);
    });
    socket.once('error', reject);
  });
}

async function waitForSocket(address: string, child: ChildProcess) {
  const deadline = Date.now() + 5_000;
  let lastError: unknown;
  while (Date.now() < deadline && child.exitCode === null && child.signalCode === null) {
    try {
      if ((await socketResponse(address)).includes('active coordinator')) return;
    } catch (error) {
      lastError = error;
    }
    await new Promise((resolve) => setTimeout(resolve, 25));
  }
  throw new Error(`Control socket did not become active: ${lastError ?? child.exitCode}`);
}

function listen(server: Server, address: string) {
  return new Promise<void>((resolve, reject) => {
    server.once('error', reject);
    server.listen(address, () => {
      server.off('error', reject);
      resolve();
    });
  });
}

function close(server: Server | undefined) {
  if (!server?.listening) return Promise.resolve();
  return new Promise<void>((resolve, reject) =>
    server.close((error) => (error ? reject(error) : resolve())),
  );
}

test('a coordinator restart removes only a proven stale Unix socket and refuses a live one', {
  skip: process.platform !== 'linux',
}, async () => {
  const recovery = await mkdtemp(join(tmpdir(), 'factory-control-socket-'));
  const address = join(recovery, '.installation.sock');
  const workerDirectory = join(recovery, 'worker');
  const workerLock = join(workerDirectory, 'worker.lock');
  const workerOwner = join(workerDirectory, 'worker_owner');
  let previous: ChildProcess | undefined;
  let restarted: Server | undefined;
  try {
    const moduleUrl = new URL('../scripts/installation-control-socket.ts', import.meta.url);
    const recoveryModule = (await import(moduleUrl.href).catch(() => undefined)) as
      | { recoverStaleControlSocket?: (path: string) => Promise<void> }
      | undefined;
    if (typeof recoveryModule?.recoverStaleControlSocket !== 'function') {
      throw new Error(
        'coordinator startup must expose its stale Unix control socket recovery step',
      );
    }
    const recoverStaleControlSocket = recoveryModule.recoverStaleControlSocket;

    await mkdir(workerDirectory);
    await writeFile(workerLock, 'owner-lock-marker');
    await writeFile(workerOwner, 'database-owner-marker');
    previous = spawn(
      process.execPath,
      [
        '-e',
        "const net=require('node:net');const server=net.createServer((socket)=>socket.end('active coordinator'));server.listen(process.argv[1]);setInterval(()=>{},10000);",
        address,
      ],
      { stdio: 'ignore' },
    );
    await waitForSocket(address, previous);
    await assert.rejects(recoverStaleControlSocket(address), /active coordinator/i);
    assert.ok((await lstat(address)).isSocket(), 'a live coordinator socket remains in place');

    previous.kill('SIGKILL');
    await new Promise<void>((resolveExit) => previous!.once('exit', () => resolveExit()));
    assert.ok((await lstat(address)).isSocket(), 'SIGKILL leaves a stale Unix socket path');

    await recoverStaleControlSocket(address);
    await assert.rejects(lstat(address), { code: 'ENOENT' });

    restarted = createServer((socket: Socket) => socket.end('restarted coordinator'));
    await listen(restarted, address);
    assert.equal(await socketResponse(address), 'restarted coordinator');
    assert.equal(await readFile(workerLock, 'utf8'), 'owner-lock-marker');
    assert.equal(await readFile(workerOwner, 'utf8'), 'database-owner-marker');
  } finally {
    if (previous && previous.exitCode === null && previous.signalCode === null) {
      previous.kill('SIGKILL');
      await new Promise<void>((resolveExit) => previous!.once('exit', () => resolveExit()));
    }
    await close(restarted);
    await rm(recovery, { recursive: true, force: true });
  }
});
