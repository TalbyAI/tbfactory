import { randomUUID } from 'node:crypto';
import { z } from 'zod';
import { digest, fail, grantSchema, identifier, token, type Grant } from './contracts';
import { type Caller } from './auth';
import { type Factory, type Operation } from './factory';
import { type Row, type Transaction } from './store';
import { authorized, type Scope } from './authorization';
import { membershipId, validateScope } from './provision';

export const invitationIssue = z.strictObject({ operationId: identifier, email: z.email().max(320), grants: z.array(grantSchema).min(1).max(50) });
export const invitationAccept = z.strictObject({ operationId: identifier, token: z.string().regex(/^[A-Za-z0-9_-]{43}$/) });
export const invitationPreview = invitationAccept.omit({ operationId: true });
export function invitationMetadata(row: Row) {
  const { digest: _digest, ...metadata } = row;
  return metadata;
}
async function delegate(tx: Transaction, caller: Caller, organization: string, grants: Grant[]) {
  await authorized(tx, caller, 'invitation.issue', { organization });
  for (const grant of grants) {
    await validateScope(tx, organization, grant);
    let scope: Scope = { organization };
    if (grant.scope === 'project') scope.project = grant.scopeId;
    if (grant.scope === 'repository') {
      const repository = (await tx.get('repository', grant.scopeId))!;
      scope = { organization, project: String(repository.project), repository: repository.id };
    }
    await authorized(tx, caller, grant.activity, scope);
    await authorized(tx, caller, `delegate:${grant.activity}:${grant.effect}`, scope);
  }
}
async function audit(tx: Transaction, organization: string, actor: string, kind: string, resource: string, decision: Record<string, unknown>) {
  await tx.create('audit', { id: randomUUID(), organization, actor, kind, resource, decision, recordedAt: Date.now() });
}
export async function invitationOperation(factory: Factory, tx: Transaction, caller: Caller, operation: Operation, input: any, days: number) {
  if (operation.action === 'invitation.accept' || operation.action === 'invitation.preview') {
    if (!caller.human) fail(403, 'Browser confirmation required');
    const invitation = await tx.get('invitation', digest(input.token));
    if (!invitation) fail(404, 'Resource not found');
    const organization = String(invitation.organization);
    if (operation.action === 'invitation.preview') {
      if (invitation.revoked || Number(invitation.expiresAt) <= Date.now()) fail(409, 'Invitation unavailable');
      return { organization: await tx.get('organization', organization), invitation: invitationMetadata(invitation) };
    }
    const user = (await tx.get('user', caller.user))!;
    if (!user.verified || user.email !== invitation.email) fail(403, 'Verified invited email required');
    const action = { ...operation, organization };
    return factory.mutate(tx, caller, action, input, async () => {
      const membership = await tx.get('membership', membershipId(caller.user, organization));
      if (invitation.consumedBy) {
        if (invitation.consumedBy !== caller.user) fail(409, 'Invitation already consumed');
        // Do not reapply grants or resurrect a subsequently revoked Membership.
        return { membership, activated: true };
      }
      if (invitation.revoked || Number(invitation.expiresAt) <= Date.now()) fail(409, 'Invitation unavailable');
      if (membership?.active) fail(409, 'Already a member');
      if (membership?.revokedAt !== undefined && Number(invitation.issuedAt) <= Number(membership.revokedAt)) fail(409, 'Invitation predates Membership revocation');
      const issuer: Caller = { user: String(invitation.issuer), human: true };
      await delegate(tx, issuer, organization, invitation.grants as Grant[]);
      const active = await tx.put('membership', { id: membershipId(caller.user, organization), user: caller.user, organization, active: true, revokedAt: membership?.revokedAt });
      // Reactivation installs only the newly agreed initial grants.
      for (const policy of await tx.list('policy', 'organization = $organization AND user = $user', { organization, user: caller.user })) await tx.remove('policy', policy.id);
      for (const grant of invitation.grants as Grant[]) await tx.create('policy', { id: randomUUID(), organization, user: caller.user, ...grant });
      await tx.put('invitation', { ...invitation, consumedBy: caller.user, consumedAt: Date.now() });
      await audit(tx, organization, caller.user, 'invitation.accepted', invitation.id, { issuer: invitation.issuer, email: invitation.email, grants: invitation.grants });
      return { membership: active, activated: true };
    });
  }
  const organization = operation.organization!;
  await authorized(tx, caller, operation.action, { organization });
  if (operation.action === 'invitation.revoke') {
    const invitation = await tx.get('invitation', operation.resource!);
    if (!invitation || invitation.organization !== organization) fail(404, 'Resource not found');
    return factory.mutate(tx, caller, operation, input, async () => {
      await tx.put('invitation', { ...invitation, revoked: true });
      await audit(tx, organization, caller.user, 'invitation.revoked', invitation.id, {});
      return { invitation: invitationMetadata({ ...invitation, revoked: true }) };
    });
  }
  await delegate(tx, caller, organization, input.grants);
  let oneTime: string | undefined;
  const result = await factory.mutate(tx, caller, operation, input, async () => {
    oneTime = token();
    const invitation = await tx.create('invitation', { id: digest(oneTime), organization, email: input.email, grants: input.grants, issuer: caller.user, digest: digest(oneTime), issuedAt: Date.now(), expiresAt: Date.now() + days * 86400000, revoked: false });
    await audit(tx, organization, caller.user, 'invitation.issued', invitation.id, { email: input.email, grants: input.grants });
    return { invitation: invitationMetadata(invitation), secretUnavailable: true };
  });
  return oneTime ? { ...result, token: oneTime, secretUnavailable: false } : result;
}
