import { randomUUID } from 'node:crypto';
import { z } from 'zod';
import { authorization, authorized, type Scope } from './authorization';
import { fail, identifier } from './contracts';
import { type Factory, type Operation } from './factory';
import { type Caller } from './auth';
import { type Row, type Transaction } from './store';

export const typeMigrationSchema = z.strictObject({
  operationId: identifier,
  expectedState: identifier,
  expectedVersion: z.number().int().positive(),
  targetVersion: z.number().int().positive(),
  expectedTransitionSequence: z.number().int().nonnegative(),
});

const terminalRequestStatuses = new Set(['completed', 'rejected', 'cancelled']);

function migrationTarget(item: Row) {
  const version = Number(item.version);
  const state = String(item.state);
  if (version === 1 && state === 'registered') return 2;
  if (version === 3 && ['registered', 'ready-for-review'].includes(state)) return 4;
  return undefined;
}

async function hasPendingTransitionRequest(tx: Transaction, item: Row) {
  const requests = await tx.list(
    'transition_request',
    'organization = $organization AND workItem = $workItem',
    { organization: item.organization, workItem: item.id },
  );
  return requests.some((request) => !terminalRequestStatuses.has(String(request.status)));
}

async function currentReadinessFact(tx: Transaction, item: Row) {
  const sequence = Number(item.transitionSequence ?? 0);
  const facts = await tx.list(
    'fact',
    'organization = $organization AND workItem = $workItem AND kind = $kind',
    { organization: item.organization, workItem: item.id, kind: 'state.transition' },
  );
  return facts.find((fact) => {
    const payload = fact.payload as Record<string, unknown>;
    return (
      payload.sequence === sequence &&
      payload.version === 3 &&
      payload.to === 'ready-for-review' &&
      ['prepare-review', 'reopen-review'].includes(String(payload.transition))
    );
  });
}

export async function preservedReadinessAfterMigration(tx: Transaction, item: Row, fact: Row) {
  const payload = fact.payload as Record<string, unknown>;
  if (
    Number(item.version) !== 4 ||
    item.state !== 'ready-for-review' ||
    Number(payload.version) !== 3 ||
    payload.sequence !== Number(item.transitionSequence ?? 0) ||
    payload.to !== 'ready-for-review' ||
    !['prepare-review', 'reopen-review'].includes(String(payload.transition))
  )
    return false;
  const migrations = await tx.list(
    'fact',
    'organization = $organization AND workItem = $workItem AND kind = $kind',
    {
      organization: item.organization,
      workItem: item.id,
      kind: 'work-item.type-migrated',
    },
  );
  return migrations.some((migration) => {
    const binding = migration.payload as Record<string, unknown>;
    return (
      binding.fromVersion === 3 &&
      binding.toVersion === 4 &&
      binding.state === 'ready-for-review' &&
      binding.transitionSequence === Number(item.transitionSequence ?? 0) &&
      binding.readinessFact === fact.id
    );
  });
}

export async function migrationAvailability(
  tx: Transaction,
  caller: Caller,
  item: Row,
  scope: Scope,
) {
  const targetVersion = migrationTarget(item);
  if (targetVersion === undefined)
    return { targetVersion: null, available: false, requiresApproval: false, reason: null };
  let reason: string | null = item.activeRun ? 'Active Workflow Run' : null;
  if (!reason && (await hasPendingTransitionRequest(tx, item)))
    reason = 'Pending Transition Request';
  let requiresApproval = false;
  try {
    requiresApproval = (await authorization(tx, caller, 'work-item.migrate', scope)).requiresHuman;
  } catch (error) {
    if ((error as { status: number }).status !== 403) throw error;
    reason = 'Activity denied';
  }
  return { targetVersion, available: !reason, requiresApproval, reason };
}

export async function migrateWorkItem(
  factory: Factory,
  tx: Transaction,
  caller: Caller,
  operation: Operation,
  input: z.infer<typeof typeMigrationSchema>,
  item: Row,
  scope: Scope,
) {
  await authorized(tx, caller, 'work-item.migrate', scope);
  return factory.mutate(tx, caller, operation, input, async () => {
    const currentVersion = Number(item.version);
    const currentState = String(item.state);
    const sequence = Number(item.transitionSequence ?? 0);
    if (
      input.expectedState !== currentState ||
      input.expectedVersion !== currentVersion ||
      input.expectedTransitionSequence !== sequence
    )
      fail(409, 'Work Item state, version, or transition sequence changed');
    if (item.type !== 'pull-request-review') fail(409, 'Unsupported Work Item migration');
    if (item.activeRun) fail(409, 'An active Workflow Run owns this Work Item');
    if (await hasPendingTransitionRequest(tx, item))
      fail(409, 'A pending Transition Request owns this Work Item');
    const targetVersion = migrationTarget(item);
    if (targetVersion === undefined || targetVersion !== input.targetVersion)
      fail(409, 'Unsupported Work Item migration');

    const readiness =
      currentVersion === 3 && currentState === 'ready-for-review'
        ? await currentReadinessFact(tx, item)
        : undefined;
    if (currentState === 'ready-for-review' && !readiness)
      fail(409, 'Current successful readiness State Transition Fact required');

    const workItem = await tx.put('work_item', { ...item, version: targetVersion });
    const fact = await tx.create('fact', {
      id: randomUUID(),
      organization: item.organization,
      workItem: item.id,
      actor: caller.user,
      kind: 'work-item.type-migrated',
      recordedAt: Date.now(),
      payload: {
        operationId: input.operationId,
        fromVersion: currentVersion,
        toVersion: targetVersion,
        state: currentState,
        transitionSequence: sequence,
        readinessFact: readiness?.id ?? null,
      },
    });
    return { workItem, fact };
  });
}
