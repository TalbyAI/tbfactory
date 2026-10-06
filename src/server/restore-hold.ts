import { readFile } from 'node:fs/promises';
import { mkdir } from 'node:fs/promises';
import { join, resolve } from 'node:path';
import { z } from 'zod';
import { atomicWrite } from './durable-files';

const heldRunSchema = z.strictObject({
  workflow: z.string().min(1),
  status: z.string().min(1),
  disposition: z.enum(['pending', 'hold', 'resume', 'reconcile']),
});

const restoreHoldSchema = z.strictObject({
  format: z.literal(1),
  bundle: z.string().min(1),
  createdAt: z.number().int().nonnegative(),
  activatedAt: z.number().int().nonnegative().nullable(),
  runs: z.record(z.string(), heldRunSchema),
});

export type RestoreHold = z.infer<typeof restoreHoldSchema>;

export function restoreHoldPath(workerDirectory: string) {
  return join(resolve(workerDirectory), 'restore-hold.json');
}

export async function readRestoreHold(workerDirectory: string) {
  try {
    const value: unknown = JSON.parse(await readFile(restoreHoldPath(workerDirectory), 'utf8'));
    return restoreHoldSchema.parse(value);
  } catch (error: any) {
    if (error?.code === 'ENOENT') return undefined;
    throw new Error('Recovery hold is invalid; worker remains stopped');
  }
}

export async function writeRestoreHold(workerDirectory: string, hold: RestoreHold) {
  await mkdir(resolve(workerDirectory), { recursive: true, mode: 0o700 });
  await atomicWrite(restoreHoldPath(workerDirectory), JSON.stringify(hold));
}
