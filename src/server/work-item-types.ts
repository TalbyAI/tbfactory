import { z } from 'zod';
import { fail, identifier } from './contracts';
import { type Transaction, type Row } from './store';

export const transitionIds = ['prepare-review', 'withdraw-review', 'request-review', 'finalize-review', 'reopen-review'] as const;
export type TransitionId = typeof transitionIds[number];
export const selectionSchema = z.strictObject({ operationId: identifier, type: z.literal('pull-request-review'), version: z.union([z.literal(1), z.literal(2)]), enabled: z.boolean() });
export const transitionDefinitions = [
  { id: 'prepare-review', from: 'registered', to: 'ready-for-review', handling: 'direct', inputs: ['reviewBrief'] },
  { id: 'withdraw-review', from: 'ready-for-review', to: 'registered', handling: 'direct', inputs: ['reason', 'readinessFact'] },
  { id: 'request-review', from: 'ready-for-review', to: 'ready-for-review', handling: 'workflow', inputs: ['reviewBrief'] },
  { id: 'finalize-review', from: 'ready-for-review', to: 'completed', handling: 'workflow', inputs: ['reportVersion'] },
  { id: 'reopen-review', from: 'completed', to: 'ready-for-review', handling: 'direct', inputs: ['reason', 'reviewBrief', 'finalizationFact'] },
] as const;
export function definition(type: unknown, version: unknown) {
  if (type !== 'pull-request-review' || version !== 1 && version !== 2) fail(409, 'Retained Work Item Type unavailable');
  return { type: 'pull-request-review', version, states: version === 1 ? ['registered'] : ['registered', 'ready-for-review', 'completed'], transitions: version === 1 ? [] : transitionDefinitions };
}
export async function selection(tx: Transaction, organization: string) {
  return await tx.get('type_selection', organization) ?? { id: organization, organization, type: 'pull-request-review', version: 1, enabled: true };
}
export function itemDefinition(item: Row) { return definition(item.type, item.version); }
