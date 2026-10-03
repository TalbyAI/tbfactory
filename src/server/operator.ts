import { randomUUID } from 'node:crypto';
import { z } from 'zod';
import { digest, identifier, policySchema, stable, fail } from './contracts';
import { membershipId, validateScope } from './provision';
import { type Store } from './store';

const member = z.strictObject({ organization: identifier, user: identifier });
export async function revokeMembership(store: Store, raw: unknown) {
  const input = member.parse(raw);
  return store.transaction(async tx => {
    const membership = await tx.get('membership', membershipId(input.user, input.organization));
    if (!membership) fail(404, 'Membership not found');
    if (membership.active) {
      await tx.put('membership', { ...membership, active: false, revokedAt: Date.now() });
      await tx.create('audit', { id: randomUUID(), organization: input.organization, actor: 'operator', kind: 'membership.revoked', resource: membership.id, recordedAt: Date.now(), decision: input });
    }
    return { revoked: true };
  });
}
export async function setPolicy(store: Store, raw: unknown) {
  const input = member.extend(policySchema.shape).parse(raw);
  return store.transaction(async tx => {
    if (!(await tx.get('membership', membershipId(input.user, input.organization)))?.active) fail(409, 'Policy principal has no active Membership');
    await validateScope(tx, input.organization, input, input.user);
    const result = await tx.put('policy', { id: digest(stable(input)), ...input });
    await tx.create('audit', { id: randomUUID(), organization: input.organization, actor: 'operator', kind: 'policy.installed', resource: result.id, recordedAt: Date.now(), decision: input });
    return result;
  });
}
