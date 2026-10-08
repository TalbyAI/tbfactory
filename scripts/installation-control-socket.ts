import { lstat, unlink } from 'node:fs/promises';
import { createConnection } from 'node:net';

function canConnect(address: string, timeoutMs = 1_000) {
  return new Promise<boolean>((resolveConnection, rejectConnection) => {
    const socket = createConnection(address);
    let settled = false;
    const timer = setTimeout(() => {
      finish(new Error('Could not verify whether the installation control socket is active'));
    }, timeoutMs);
    const finish = (error?: Error, connected = false) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      socket.destroy();
      if (error) rejectConnection(error);
      else resolveConnection(connected);
    };

    socket.once('connect', () => finish(undefined, true));
    socket.once('error', (error: NodeJS.ErrnoException) => {
      if (error.code === 'ECONNREFUSED' || error.code === 'ENOENT') finish();
      else finish(new Error('Could not verify whether the installation control socket is active'));
    });
  });
}

async function socketStat(address: string) {
  try {
    return await lstat(address);
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') return undefined;
    throw error;
  }
}

function sameSocket(
  left: Awaited<ReturnType<typeof lstat>>,
  right: Awaited<ReturnType<typeof lstat>>,
) {
  return left.dev === right.dev && left.ino === right.ino;
}

export async function recoverStaleControlSocket(address: string) {
  if (process.platform === 'win32') return;
  const initial = await socketStat(address);
  if (!initial) return;
  if (!initial.isSocket())
    throw new Error('Installation control path is not a Unix socket; refusing to remove it');
  if (await canConnect(address))
    throw new Error('An active coordinator owns the installation control socket');

  const current = await socketStat(address);
  if (!current) return;
  if (!current.isSocket() || !sameSocket(initial, current))
    throw new Error(
      'Installation control socket changed during stale checks; refusing to remove it',
    );
  if (await canConnect(address))
    throw new Error('An active coordinator owns the installation control socket');

  const confirmed = await socketStat(address);
  if (!confirmed) return;
  if (!confirmed.isSocket() || !sameSocket(initial, confirmed))
    throw new Error(
      'Installation control socket changed during stale checks; refusing to remove it',
    );
  await unlink(address);
}
