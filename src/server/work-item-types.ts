import { z } from 'zod';
import { fail, identifier, text } from './contracts';
import { type Transaction, type Row } from './store';

export const transitionIds = [
  'prepare-review',
  'withdraw-review',
  'request-review',
  'finalize-review',
  'reopen-review',
] as const;
export type TransitionId = (typeof transitionIds)[number];
export const selectionSchema = z.strictObject({
  operationId: identifier,
  type: z.literal('pull-request-review'),
  version: z.union([z.literal(1), z.literal(2), z.literal(3)]),
  enabled: z.boolean(),
});
export const transitionInputs = {
  'prepare-review': z.strictObject({ reviewBrief: text }),
  'withdraw-review': z.strictObject({ reason: text, readinessFact: identifier }),
  'request-review': z.strictObject({ reviewBrief: text }),
  'finalize-review': z.strictObject({ reportVersion: identifier }),
  'reopen-review': z.strictObject({
    reason: text,
    reviewBrief: text,
    finalizationFact: identifier,
  }),
};
const flow = [
  {
    id: 'prepare-review',
    from: 'registered',
    to: 'ready-for-review',
    handling: 'direct',
    prerequisites: [],
  },
  {
    id: 'withdraw-review',
    from: 'ready-for-review',
    to: 'registered',
    handling: 'direct',
    prerequisites: ['Current successful prepare/reopen State Transition Fact'],
  },
  {
    id: 'request-review',
    from: 'ready-for-review',
    to: 'ready-for-review',
    handling: 'workflow',
    prerequisites: ['Installed Review Workflow'],
  },
  {
    id: 'finalize-review',
    from: 'ready-for-review',
    to: 'completed',
    handling: 'workflow',
    prerequisites: [
      'Current report version',
      'Complete human Review Decision',
      'Confirmed publication outcome',
      'Installed Review Finalization Workflow',
    ],
  },
  {
    id: 'reopen-review',
    from: 'completed',
    to: 'ready-for-review',
    handling: 'direct',
    prerequisites: ['Current successful finalization State Transition Fact'],
  },
] as const;
export const transitionDefinitions = flow.map((transition) => ({
  ...transition,
  inputs: Object.keys(transitionInputs[transition.id].shape),
  approvalPoint: `transition.${transition.id}`,
}));
export function definition(type: unknown, version: unknown) {
  if (type !== 'pull-request-review' || ![1, 2, 3].includes(Number(version)))
    fail(409, 'Retained Work Item Type unavailable');
  return {
    type: 'pull-request-review',
    version,
    states: version === 1 ? ['registered'] : ['registered', 'ready-for-review', 'completed'],
    transitions:
      version === 1
        ? []
        : version === 2
          ? transitionDefinitions
          : [
              ...transitionDefinitions,
              {
                ...transitionDefinitions.find((t) => t.id === 'request-review')!,
                from: 'registered',
                to: 'registered',
              },
            ],
    approvalPoints:
      version === 1
        ? []
        : [
            ...transitionDefinitions.map((t) => ({
              id: t.approvalPoint,
              executionActivity: `transition.${t.id}`,
              approvalActivity: `approval.${t.id}`,
            })),
            ...(version === 3
              ? [
                  {
                    id: 'review.generate',
                    executionActivity: 'review.generate',
                    approvalActivity: 'approval.review-generate',
                  },
                  {
                    id: 'review.decide',
                    executionActivity: 'review.decide',
                    approvalActivity: 'approval.review-decide',
                  },
                ]
              : []),
          ],
  };
}
export async function selection(tx: Transaction, organization: string) {
  return (
    (await tx.get('type_selection', organization)) ?? {
      id: organization,
      organization,
      type: 'pull-request-review',
      version: 1,
      enabled: true,
    }
  );
}
export function itemDefinition(item: Row) {
  return definition(item.type, item.version);
}
