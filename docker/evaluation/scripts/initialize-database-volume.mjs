import { chmod, chown, lstat, readdir } from 'node:fs/promises';

const directory = '/data';
const surrealUid = 65532;
const surrealGid = 65532;
const info = await lstat(directory);
if (!info.isDirectory()) throw new Error('SurrealDB data path is not a directory');

const entries = await readdir(directory);
if (entries.length === 0) {
  await chown(directory, surrealUid, surrealGid);
  await chmod(directory, 0o700);
  process.stdout.write(
    'Initialized the evaluation SurrealDB volume for its non-root image user.\n',
  );
} else if (info.uid !== surrealUid || info.gid !== surrealGid) {
  throw new Error('Existing SurrealDB volume has unexpected ownership; refusing to change it');
} else {
  process.stdout.write('Verified existing SurrealDB volume ownership.\n');
}
