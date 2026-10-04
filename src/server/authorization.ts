import { fail } from './contracts';
import { membershipId } from './provision';
import { type Row, type Transaction } from './store';
import { type Caller } from './auth';

export type Scope = { organization: string; project?: string; repository?: string };
export async function currentCaller(tx: Transaction, caller: Caller) {
  const auth = await tx.get(
    caller.human ? 'session' : 'credential',
    (caller.session ?? caller.credential)!,
  );
  if (!auth || auth.user !== caller.user || Number(auth.expiresAt) <= Date.now() || auth.revoked)
    fail(401, 'Invalid authentication');
  if (
    !caller.human &&
    (auth.organization !== caller.organization ||
      JSON.stringify(auth.activities) !== JSON.stringify(caller.activities))
  )
    fail(401, 'Invalid authentication');
}
export async function visible(tx: Transaction, caller: Caller, organization: string) {
  if (caller.organization && caller.organization !== organization) fail(404, 'Resource not found');
  const membership = await tx.get('membership', membershipId(caller.user, organization));
  if (!membership?.active || !(await tx.get('organization', organization)))
    fail(404, 'Resource not found');
}
export function applicable(policy: Row, caller: Caller, scope: Scope, teams: string[] = []) {
  return (
    (policy.scope === 'organization' && policy.scopeId === scope.organization) ||
    (policy.scope === 'project' && policy.scopeId === scope.project) ||
    (policy.scope === 'repository' && policy.scopeId === scope.repository) ||
    (policy.scope === 'user' && policy.scopeId === caller.user) ||
    (policy.scope === 'team' && teams.includes(String(policy.scopeId)))
  );
}
export async function authorization(
  tx: Transaction,
  caller: Caller,
  activity: string,
  scope: Scope,
) {
  await visible(tx, caller, scope.organization);
  const credentialActivity = activity.startsWith('delegate:') ? 'invitation.issue' : activity;
  if (caller.activities && !caller.activities.includes(credentialActivity))
    fail(403, 'Activity denied');
  const teams = (
    await tx.list('team', 'organization = $organization AND $user IN members', {
      organization: scope.organization,
      user: caller.user,
    })
  ).map((team) => team.id);
  const policies = (
    await tx.list(
      'policy',
      'organization = $organization AND (user = $user OR team IN $teams) AND activity = $activity',
      { organization: scope.organization, user: caller.user, teams, activity },
    )
  ).filter((p) => applicable(p, caller, scope, teams));
  if (!policies.some((p) => p.effect === 'allow') || policies.some((p) => p.effect === 'deny'))
    fail(403, 'Activity denied');
  return { requiresHuman: policies.some((p) => p.effect === 'human') };
}
export async function authorized(tx: Transaction, caller: Caller, activity: string, scope: Scope) {
  const result = await authorization(tx, caller, activity, scope);
  if (result.requiresHuman && !caller.human) fail(403, 'Activity denied');
}
