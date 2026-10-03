import { z } from 'zod';
import { digest, identifier, text, policySchema, fail } from './contracts';
import { type Store, type Transaction } from './store';

export const provisionSchema = z.strictObject({
  organization: z.strictObject({ id: identifier, name: text }),
  projects: z.array(z.strictObject({ id: identifier, name: text, repositories: z.array(z.strictObject({ id: identifier, name: text })).default([]) })),
  members: z.array(z.strictObject({ issuer: z.url(), subject: text, grants: z.array(policySchema) })),
});
export const userId = (issuer: string, subject: string) => digest(JSON.stringify([issuer, subject]));
export const membershipId = (user: string, organization: string) => digest(JSON.stringify([user, organization]));

export async function validateScope(tx: Transaction, organization: string, grant: { scope: string; scopeId: string }, user?: string) {
  if (grant.scope === 'organization' && grant.scopeId === organization) return;
  if (grant.scope === 'user' && (grant.scopeId === user || (await tx.get('membership', membershipId(grant.scopeId, organization)))?.active)) return;
  if ((grant.scope === 'project' || grant.scope === 'repository') && (await tx.get(grant.scope, grant.scopeId))?.organization === organization) return;
  if (grant.scope === 'team' && (await tx.get('team', grant.scopeId))?.organization === organization) return;
  fail(409, 'Invalid scope ownership');
}

export async function provision(store: Store, raw: unknown) {
  const input = provisionSchema.parse(raw);
  return store.transaction(async tx => {
    const organization = input.organization.id;
    await tx.put('organization', input.organization);
    for (const project of input.projects) {
      const existing = await tx.get('project', project.id);
      if (existing && existing.organization !== organization) fail(409, 'Invalid Project ownership');
      await tx.put('project', { id: project.id, name: project.name, organization });
      for (const repository of project.repositories) {
        const old = await tx.get('repository', repository.id);
        if (old && old.project !== project.id) fail(409, 'Invalid Repository ownership');
        await tx.put('repository', { ...repository, project: project.id, organization });
      }
    }
    for (const member of input.members) {
      const user = userId(member.issuer, member.subject);
      if (!(await tx.get('user', user))) await tx.create('user', { id: user, issuer: member.issuer, subject: member.subject, verified: false, createdAt: Date.now() });
      const previous = await tx.get('membership', membershipId(user, organization));
      // An old bootstrap file must not resurrect a revoked Membership.
      if (!previous) await tx.create('membership', { id: membershipId(user, organization), user, organization, active: true });
      if (previous && !previous.active) continue;
      for (const grant of member.grants) {
        await validateScope(tx, organization, grant, user);
        await tx.put('policy', { id: digest(JSON.stringify([organization, user, grant])), user, organization, ...grant });
      }
    }
    return input.organization;
  });
}
