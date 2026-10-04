import { z } from 'zod';
import { activitySchema, digest, fail, identifier, text, token } from './contracts';
import { authorized } from './authorization';
import { type Caller } from './auth';
import { type Factory, type Operation } from './factory';
import { type Transaction, type Row } from './store';

export const credentialIssue = z.strictObject({
  operationId: identifier,
  label: text.max(200),
  activities: z.array(activitySchema).min(1).max(12),
  expiresAt: z.number().int().positive(),
});
export const revocation = z.strictObject({ operationId: identifier });
export function credentialMetadata(row: Row) {
  const { digest: _digest, ...metadata } = row;
  return metadata;
}
export async function credentialOperation(
  factory: Factory,
  tx: Transaction,
  caller: Caller,
  operation: Operation,
  input: any,
  maximumDays: number,
) {
  if (!caller.human) fail(403, 'Browser confirmation required');
  const organization = operation.organization!;
  await authorized(tx, caller, operation.action, { organization });
  if (operation.action === 'credential.revoke') {
    const credential = await tx.get('credential', operation.resource!);
    if (!credential || credential.organization !== organization || credential.user !== caller.user)
      fail(404, 'Resource not found');
    return factory.mutate(tx, caller, operation, input, async () => {
      await tx.put('credential', { ...credential, revoked: true });
      return { credential: credentialMetadata({ ...credential, revoked: true }) };
    });
  }
  let oneTime: string | undefined;
  const result = await factory.mutate(tx, caller, operation, input, async () => {
    if (input.expiresAt <= Date.now() || input.expiresAt > Date.now() + maximumDays * 86400000)
      fail(422, 'Invalid credential lifetime');
    // A token cannot add authority. Require at least one currently authorized scope
    // for each Activity; every later use still checks the concrete resource scope.
    const projects = await tx.list('project', 'organization = $organization', { organization });
    const repositories = await tx.list('repository', 'organization = $organization', {
      organization,
    });
    for (const activity of input.activities) {
      let permitted = false;
      for (const scope of [
        { organization },
        ...projects.map((p) => ({ organization, project: p.id })),
        ...repositories.map((r) => ({
          organization,
          project: String(r.project),
          repository: r.id,
        })),
      ]) {
        try {
          await authorized(tx, caller, activity, scope);
          permitted = true;
          break;
        } catch (error) {
          if ((error as { status: number }).status !== 403) throw error;
        }
      }
      if (!permitted) fail(403, 'Activity denied');
    }
    oneTime = token();
    const credential = await tx.create('credential', {
      id: digest(oneTime),
      digest: digest(oneTime),
      organization,
      user: caller.user,
      label: input.label,
      activities: [...new Set(input.activities)],
      issuedAt: Date.now(),
      expiresAt: input.expiresAt,
      revoked: false,
    });
    return { credential: credentialMetadata(credential), secretUnavailable: true };
  });
  return oneTime ? { ...result, secretUnavailable: false, token: oneTime } : result;
}
