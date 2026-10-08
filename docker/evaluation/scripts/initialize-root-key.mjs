import { randomBytes } from 'node:crypto';
import { mkdir, open, lstat } from 'node:fs/promises';
import { join } from 'node:path';

const directory = process.env.FACTORY_ROOT_DIRECTORY ?? '/run/factory-root';
const file = join(directory, 'factory-root.key');
await mkdir(directory, { recursive: true, mode: 0o700 });

try {
  const handle = await open(file, 'wx', 0o400);
  try {
    await handle.writeFile(randomBytes(32));
    await handle.sync();
  } finally {
    await handle.close();
  }
} catch (error) {
  if (error.code !== 'EEXIST') throw error;

  const info = await lstat(file);
  if (!info.isFile() || info.size !== 32 || (info.mode & 0o077) !== 0)
    throw new Error('Existing evaluation root key has invalid type, size, or permissions');
}

process.stdout.write('Evaluation root-key material is present and protected.\n');
