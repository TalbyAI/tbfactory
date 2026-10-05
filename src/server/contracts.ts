import { createHash, randomBytes } from 'node:crypto';
import { z } from 'zod';

export const activities = [
  'organization.read',
  'project.read',
  'work-item.create',
  'work-item.read',
  'history.read',
  'note.append',
  'correction.append',
  'reference.append',
  'invitation.issue',
  'invitation.revoke',
  'credential.issue',
  'credential.revoke',
  'type.manage',
  'team.manage',
  'policy.manage',
  'transition.prepare-review',
  'transition.withdraw-review',
  'transition.request-review',
  'transition.finalize-review',
  'transition.reopen-review',
  'approval.prepare-review',
  'approval.withdraw-review',
  'approval.request-review',
  'approval.finalize-review',
  'approval.reopen-review',
  'review.facts',
  'review.generate',
  'review.supersede',
  'approval.review-generate',
  'workflow.read',
  'artifact.read',
  'repository.read',
] as const;
export const activitySchema = z.enum(activities);
export const identifier = z.string().regex(/^[a-zA-Z0-9_-]{1,128}$/);
export const text = z.string().trim().min(1).max(10000);
export const grantSchema = z.strictObject({
  activity: activitySchema,
  scope: z.enum(['organization', 'project', 'repository', 'team', 'user']),
  scopeId: identifier,
  effect: z.enum(['allow', 'deny', 'human']),
});
export const policySchema = grantSchema.extend({
  activity: z.union([
    activitySchema,
    z.string().refine((value) => {
      const [prefix, activity, effect, extra] = value.split(':');
      return (
        prefix === 'delegate' &&
        activitySchema.safeParse(activity).success &&
        ['allow', 'deny', 'human'].includes(effect) &&
        !extra
      );
    }),
  ]),
});
export type Grant = z.infer<typeof grantSchema>;
export const digest = (value: string) => createHash('sha256').update(value).digest('hex');
export const token = () => randomBytes(32).toString('base64url');
export const stable = (value: unknown): string =>
  Array.isArray(value)
    ? `[${value.map(stable).join(',')}]`
    : value && typeof value === 'object'
      ? `{${Object.entries(value)
          .sort(([a], [b]) => a.localeCompare(b))
          .map(([k, v]) => `${JSON.stringify(k)}:${stable(v)}`)
          .join(',')}}`
      : JSON.stringify(value);
export class FactoryError extends Error {
  constructor(
    readonly status: number,
    message: string,
  ) {
    super(message);
  }
}
export function fail(status: number, message: string): never {
  throw new FactoryError(status, message);
}
