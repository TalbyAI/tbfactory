import { randomUUID } from 'node:crypto';
import { z } from 'zod';
import { fail, identifier, policySchema, text } from './contracts';
import { authorized } from './authorization';
import { membershipId, validateScope } from './provision';
import { page, type Factory, type Operation } from './factory';
import { type Caller } from './auth';
import { type Transaction } from './store';

export const teamSchema = z.strictObject({ operationId: identifier, name: text.max(200), members: z.array(identifier).max(1000) });
export const managedPolicySchema = z.strictObject({ operationId: identifier, user: identifier.optional(), team: identifier.optional(), ...policySchema.shape }).refine(input => Boolean(input.user) !== Boolean(input.team), 'Exactly one policy principal required');
export const removePolicySchema = z.strictObject({ operationId: identifier });
export async function managementOperation(factory: Factory, tx: Transaction, caller: Caller, operation: Operation, input: any, query: { limit: number; cursor?: string }) {
  const organization = operation.organization!;
  const teams = operation.action.startsWith('team.');
  await authorized(tx, caller, teams ? 'team.manage' : 'policy.manage', { organization });
  if (operation.action.endsWith('.list')) return page(await tx.list(teams ? 'team' : 'policy', 'organization = $organization', { organization }), query);
  return factory.mutate(tx, caller, operation, input, async () => {
    let result;
    let resource;
    if (teams) {
      resource = operation.resource ?? randomUUID();
      const existing = await tx.get('team', resource);
      if (operation.resource && (!existing || existing.organization !== organization)) fail(404, 'Resource not found');
      for (const user of input.members) if (!(await tx.get('membership', membershipId(user, organization)))?.active) fail(409, 'Team member has no active Organization Membership');
      result = { team: await tx.put('team', { id: resource, organization, name: input.name, members: [...new Set(input.members)] }) };
    } else if (operation.action === 'policy.remove') {
      const policy = await tx.get('policy', operation.resource!);
      if (!policy || policy.organization !== organization) fail(404, 'Resource not found');
      resource = policy.id;
      await tx.remove('policy', resource);
      result = { removed: true };
    } else {
      if (input.user && !(await tx.get('membership', membershipId(input.user, organization)))?.active) fail(409, 'Policy principal has no active Membership');
      if (input.team && (await tx.get('team', input.team))?.organization !== organization) fail(409, 'Invalid Team ownership');
      await validateScope(tx, organization, input, input.user);
      const { operationId: _operation, ...policy } = input;
      resource = randomUUID();
      result = { policy: await tx.create('policy', { id: resource, organization, ...policy, user: input.user ?? '' }) };
    }
    await tx.create('audit', { id: randomUUID(), organization, actor: caller.user, kind: operation.action, resource, recordedAt: Date.now(), decision: input });
    return result;
  });
}
