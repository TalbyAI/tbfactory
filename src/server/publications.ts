import { z } from 'zod';
import { randomUUID } from 'node:crypto';
import { authorization, authorized } from './authorization';
import { digest, fail, identifier, stable, text } from './contracts';
import { type Caller } from './auth';
import { type Factory, type Operation } from './factory';
import { type Row, type Transaction } from './store';
import { decisionUsable, executionCaller, scopeOf, type Run } from './reviews';
import { publicationDestination, type ProviderEffect } from './publication-provider';
import { itemDefinition } from './work-item-types';
import { activeShare, shareBinding } from './artifact-sharing';
import { confirmedContent } from './publication-content';

export const publicationActionSchema = z.strictObject({
  operationId: identifier,
  run: identifier,
  publication: identifier.optional(),
  decision: identifier.optional(),
  reference: identifier.optional(),
});
export const publicationConfirmationSchema = publicationActionSchema.extend({
  evidence: identifier,
  resolution: z.enum(['completed', 'not-published', 'retry']),
  reason: text,
  confirmedStopped: z.literal(true),
});
export type PublicationStatus =
  | 'queued'
  | 'waiting-approval'
  | 'dispatching'
  | 'uncertain'
  | 'failed'
  | 'blocked'
  | 'reconciliation-queued'
  | 'reconciling'
  | 'completed'
  | 'skipped'
  | 'not-published';
export type Publication = Row & {
  organization: string;
  workItem: string;
  run: string;
  data: {
    status: PublicationStatus;
    decision: string;
    report: string;
    destination: Record<string, any>;
    identity: Run['data']['identity'];
    content: string;
    reference?: string;
    contentVersion?: string;
    referenceBinding?: string;
    attempt: number;
    token: string;
    approval?: { actor: string; binding: string };
    evidence?: string;
    effect?: { id: string; contentDigest: string };
    effects?: ProviderEffect[];
    dispatchAuthorized?: boolean;
    error?: string;
    recoveryActor?: string;
  };
};
export const publicationId = (run: string, decision?: string) =>
  digest(decision ? stable(['publication-v2', run, decision]) : `publication-v1:${run}`);
export async function publicationForRun(tx: Transaction, run: Run) {
  const p = (await tx.get('external_activity', run.data.publication ?? publicationId(run.id))) as
    | Publication
    | undefined;
  if (p && (p.run !== run.id || p.organization !== run.organization || p.workItem !== run.workItem))
    fail(409, 'Publication run binding mismatch');
  return p;
}
export async function publicationMatches(tx: Transaction, p: Publication) {
  const facts = await tx.list(
    'fact',
    'organization = $organization AND workItem = $workItem AND kind = $kind',
    {
      organization: p.organization,
      workItem: p.workItem,
      kind: 'publication.evidence',
    },
  );
  const matches = new Map<string, ProviderEffect>();
  for (const fact of facts) {
    const evidence = fact.payload as any;
    if (evidence.activity !== p.id) continue;
    for (const effect of evidence.matches) matches.set(effect.id, effect);
  }
  return [...matches.values()];
}
export async function publicationCanBeCorrected(tx: Transaction, p?: Publication) {
  if (!p || p.data.status === 'skipped') return true;
  if (p.data.status !== 'not-published' || !p.data.evidence) return false;
  const fact = await tx.get('fact', p.data.evidence);
  const evidence = fact?.payload as any;
  return (
    fact?.kind === 'publication.evidence' &&
    evidence.activity === p.id &&
    evidence.attempt === p.data.attempt &&
    (evidence.complete === true ||
      (evidence.noDispatch === true && p.data.dispatchAuthorized === false)) &&
    !(await publicationMatches(tx, p)).length
  );
}
export const publicationView = (row: Row) => {
  const {
    content: _content,
    token: _token,
    dispatchAuthorized: _dispatchAuthorized,
    ...data
  } = row.data as Publication['data'];
  return { id: row.id, run: row.run, ...data };
};
export const publicationBinding = (p: Publication) =>
  digest(
    stable({
      activity: 'review.publish',
      organization: p.organization,
      workItem: p.workItem,
      run: p.run,
      decision: p.data.decision,
      report: p.data.report,
      destination: p.data.destination,
      identity: p.data.identity,
      contentDigest: digest(p.data.content),
      attempt: p.data.attempt,
      ...(p.data.reference
        ? {
            reference: p.data.reference,
            contentVersion: p.data.contentVersion,
            referenceBinding: p.data.referenceBinding,
          }
        : {}),
    }),
  );
export const publicationContent = (p: Publication) =>
  `${p.data.content}\n\n<!-- TBFactory publication ${p.id} attempt ${p.data.attempt} -->`;

export async function publicationState(
  tx: Transaction,
  p: Publication,
  status: PublicationStatus,
  changes: Partial<Publication['data']> = {},
) {
  const run = (await tx.get('workflow_run', p.run)) as Run;
  const item = (await tx.get('work_item', p.workItem))!;
  if ((item.activeRun as any)?.id !== p.run) fail(409, 'Publication ownership lost');
  const data = { ...p.data, ...changes, status };
  if (status === 'reconciliation-queued') {
    // Require a fresh provider observation after reconciliation is claimed, while
    // retaining live proof that this attempt never authorized a provider POST.
    // Installation recovery removes restored dispatch tracking before activation.
    data.evidence = undefined;
  }
  const updated = { ...p, data };
  const terminal = ['completed', 'skipped', 'not-published'].includes(status);
  const runStatus = terminal ? 'completed' : `publication-${status}`;
  await tx.put('external_activity', updated);
  await tx.put('workflow_run', {
    ...run,
    data: { ...run.data, status: runStatus, publication: p.id },
  });
  await tx.put('work_item', {
    ...item,
    activeRun: terminal
      ? undefined
      : { id: run.id, workflow: run.data.workflow, status: runStatus },
  });
  return updated;
}

export async function publicationReady(tx: Transaction, p: Publication) {
  const item = (await tx.get('work_item', p.workItem))!;
  const run = (await tx.get('workflow_run', p.run)) as Run;
  if ((item.activeRun as any)?.id !== run.id) fail(409, 'Publication ownership lost');
  if (
    ['requested', 'awaiting-publication-resolution'].includes(run.data.cancellation?.status ?? '')
  )
    fail(409, 'Workflow cancellation is pending');
  const fact = await tx.get('fact', p.data.decision);
  if (!fact || !(await decisionUsable(tx, item, run, fact)))
    fail(409, 'Current human Review Decision required');
  if (stable(await publicationDestination(tx, item)) !== stable(p.data.destination))
    fail(409, 'Publication destination changed');
  const caller = await executionCaller(tx, {
    ...run,
    data: { ...run.data, identity: p.data.identity },
  });
  const permission = await authorization(tx, caller, 'review.publish', scopeOf(item));
  if (p.data.reference) {
    await authorized(tx, caller, 'work-item.read', scopeOf(item));
    await authorized(tx, caller, 'artifact.read', scopeOf(item));
    const share = await activeShare(tx, item, p.data.reference);
    if (
      share.data.decision !== p.data.decision ||
      share.data.report !== p.data.report ||
      share.data.contentVersion !== p.data.contentVersion ||
      shareBinding(share) !== p.data.referenceBinding
    )
      fail(409, 'Report reference binding mismatch');
  }
  if (permission.requiresHuman) {
    const approval = p.data.approval;
    if (!approval || approval.binding !== publicationBinding(p))
      fail(403, 'Publication Approval required');
    await authorized(
      tx,
      { user: approval.actor, human: true },
      'approval.review-publish',
      scopeOf(item),
    );
  }
  return caller;
}

export async function publicationOperation(
  factory: Factory,
  tx: Transaction,
  caller: Caller,
  operation: Operation,
  input: any,
  item: Row,
) {
  const scope = scopeOf(item);
  await authorized(tx, caller, 'work-item.read', scope);
  await authorized(tx, caller, 'artifact.read', scope);
  const run = (await tx.get('workflow_run', input.run)) as Run | undefined;
  if (!run || run.organization !== item.organization || run.workItem !== item.id)
    fail(404, 'Resource not found');
  let p = await publicationForRun(tx, run);
  if (input.publication && input.publication !== p?.id)
    fail(409, 'Current publication Activity required');
  if (operation.action === 'publication.request') {
    if (!itemDefinition(item).approvalPoints.some((point) => point.id === 'review.publish'))
      fail(409, 'Publication unavailable for retained Work Item Type');
    const permission = await authorization(tx, caller, 'review.publish', scope);
    return factory.mutate(tx, caller, operation, input, async () => {
      if (input.decision && input.decision !== run.data.decision)
        fail(409, 'Current Review Decision required');
      if (p && p.data.decision === run.data.decision) return { publication: publicationView(p) };
      if (p && !(await publicationCanBeCorrected(tx, p)))
        fail(409, 'Previous publication prevents a new Activity');
      if (item.activeRun || run.data.status !== 'completed' || run.data.workflow !== 'review-v1')
        fail(409, 'Completed Review Workflow required');
      const decision = run.data.decision && (await tx.get('fact', run.data.decision));
      if (!decision || !(await decisionUsable(tx, item, run, decision)))
        fail(409, 'Current human Review Decision required');
      const report = (await tx.get('review_report', run.data.report!))!;
      let content = confirmedContent(report.data, decision);
      let reference:
        | { reference: string; contentVersion: string; referenceBinding: string }
        | undefined;
      if (item.publicationMode === 'report-reference' && content) {
        if (item.version !== 5 || !input.reference)
          fail(409, 'Explicit active report reference required');
        const share = await activeShare(tx, item, input.reference);
        if (
          share.data.decision !== decision.id ||
          share.data.report !== report.id ||
          share.data.run !== run.id
        )
          fail(409, 'Current report reference required');
        content = `[Confirmed Findings report](${share.data.url})`;
        reference = {
          reference: share.id,
          contentVersion: share.data.contentVersion,
          referenceBinding: shareBinding(share),
        };
      } else if (input.reference)
        fail(422, 'Report reference incompatible with publication mode or empty output');
      if (Buffer.byteLength(content) > 60000)
        fail(422, 'Confirmed publication exceeds provider content limit');
      const destination = await publicationDestination(tx, item);
      p = {
        id: publicationId(run.id, p ? decision.id : undefined),
        organization: run.organization,
        workItem: run.workItem,
        run: run.id,
        data: {
          status: 'queued',
          decision: decision.id,
          report: report.id,
          destination,
          content,
          ...reference,
          identity: {
            kind: 'user',
            user: caller.user,
            credential: caller.credential,
            activities: caller.activities,
          },
          attempt: 1,
          token: randomUUID(),
          dispatchAuthorized: false,
        },
      };
      await tx.create('external_activity', p);
      await tx.put('work_item', {
        ...item,
        activeRun: { id: run.id, workflow: run.data.workflow, status: 'publication-queued' },
      });
      p = await publicationState(tx, p, permission.requiresHuman ? 'waiting-approval' : 'queued');
      await factory.fact(tx, caller, item, 'publication.requested', {
        run: run.id,
        activity: p.id,
        decision: decision.id,
        report: report.id,
        destination,
        attempt: 1,
        contentDigest: digest(content),
        identity: p.data.identity,
        ...reference,
      });
      return { publication: publicationView(p) };
    });
  }
  if (!p) fail(404, 'Publication not found');
  if (operation.action === 'publication.approve') {
    if (!caller.human) fail(403, 'Human publication Approval required');
    await authorized(tx, caller, 'approval.review-publish', scope);
    return factory.mutate(tx, caller, operation, input, async () => {
      if (p!.data.status !== 'waiting-approval') fail(409, 'Publication is not awaiting Approval');
      const approval = { actor: caller.user, binding: publicationBinding(p!) };
      const approved = { ...p!, data: { ...p!.data, approval } };
      await publicationReady(tx, approved);
      const updated = await publicationState(tx, approved, 'queued');
      await factory.fact(tx, caller, item, 'activity.approved', {
        activity: 'review.publish',
        publication: p!.id,
        run: run.id,
        ...approval,
      });
      return { publication: publicationView(updated) };
    });
  }
  if (!caller.human) fail(403, 'Human publication recovery required');
  await authorized(tx, caller, 'review.recover', scope);
  return factory.mutate(tx, caller, operation, input, async () => {
    if ((item.activeRun as any)?.id !== run.id) fail(409, 'Publication ownership lost');
    if (
      !['uncertain', 'failed', 'blocked'].includes(p!.data.status) &&
      !(operation.action === 'publication.reconcile' && p!.data.status === 'waiting-approval')
    )
      fail(409, 'Publication execution is unresolved or recovery is already claimed');
    if (operation.action === 'publication.reconcile') {
      const updated = await publicationState(tx, p!, 'reconciliation-queued', {
        recoveryActor: caller.user,
      });
      await factory.fact(tx, caller, item, 'publication.reconciliation-requested', {
        run: run.id,
        activity: p!.id,
        attempt: p!.data.attempt,
      });
      return { publication: publicationView(updated) };
    }
    if (input.evidence !== p!.data.evidence) fail(409, 'Latest provider evidence required');
    const cancellationPending = ['requested', 'awaiting-publication-resolution'].includes(
      run.data.cancellation?.status ?? '',
    );
    if (cancellationPending && input.resolution === 'retry')
      fail(409, 'Resolve the cancellation before retrying publication');
    const evidence = await tx.get('fact', input.evidence);
    if (
      !evidence ||
      evidence.kind !== 'publication.evidence' ||
      (evidence.payload as any).activity !== p!.id ||
      (evidence.payload as any).attempt !== p!.data.attempt
    )
      fail(409, 'Provider evidence mismatch');
    const data = evidence.payload as any;
    const matches = await publicationMatches(tx, p!);
    if (['retry', 'not-published'].includes(input.resolution) && matches.length)
      fail(409, 'Provider evidence shows publication; a new attempt is prohibited');
    if (input.resolution === 'completed' && !matches.length)
      fail(409, 'Identified provider effect required for completion');
    const noDispatch = data.noDispatch === true && p!.data.dispatchAuthorized === false;
    if (
      ['retry', 'not-published'].includes(input.resolution) &&
      (data.complete !== true || data.unavailable === true) &&
      !(input.resolution === 'not-published' && noDispatch)
    )
      fail(409, 'Complete provider evidence required; publication remains unresolved');
    let updated: Publication;
    if (input.resolution === 'retry') {
      // A retry is a new, separately authorized attempt. Prior attempt Facts are immutable.
      const retry: Publication = {
        ...p!,
        data: {
          ...p!.data,
          attempt: p!.data.attempt + 1,
          token: randomUUID(),
          evidence: undefined,
          approval: undefined,
          dispatchAuthorized: false,
          identity: {
            kind: 'user' as const,
            user: caller.user,
            credential: caller.credential,
            activities: caller.activities,
          },
        },
      };
      const permission = await authorization(tx, caller, 'review.publish', scope);
      if (permission.requiresHuman) {
        await authorized(tx, caller, 'approval.review-publish', scope);
        retry.data.approval = { actor: caller.user, binding: publicationBinding(retry) };
      }
      await publicationReady(tx, retry);
      updated = await publicationState(tx, retry, 'queued', { error: undefined });
    } else {
      const effects = input.resolution === 'completed' ? matches : undefined;
      const effect = effects?.[0];
      updated = await publicationState(tx, p!, input.resolution, {
        effect,
        effects,
        error: undefined,
      });
      if (input.resolution === 'completed')
        await factory.fact(tx, caller, item, 'publication.completed', {
          run: run.id,
          activity: p!.id,
          attempt: p!.data.attempt,
          effect: effect ?? null,
          effects,
          userConfirmed: true,
        });
      if (cancellationPending && input.resolution === 'completed') {
        const current = (await tx.get('workflow_run', run.id)) as Run;
        const cancellation = {
          ...current.data.cancellation!,
          status: 'completed-before-stop' as const,
          confirmedAt: Date.now(),
          evidence: { providerOutcome: 'completed', evidence: input.evidence },
        };
        await tx.put('workflow_run', { ...current, data: { ...current.data, cancellation } });
        await factory.fact(tx, caller, item, 'workflow.cancellation-not-applied', {
          run: run.id,
          request: cancellation.request,
          reason: 'Publication was confirmed complete before cancellation could stop it',
          publication: p!.id,
          attempt: p!.data.attempt,
          evidence: input.evidence,
        });
      } else if (cancellationPending && input.resolution === 'not-published') {
        const current = (await tx.get('workflow_run', run.id)) as Run;
        const confirmedAt = Date.now();
        const cancellation = {
          ...current.data.cancellation!,
          status: 'confirmed' as const,
          confirmedAt,
          evidence: { providerOutcome: 'not-published', evidence: input.evidence },
        };
        await tx.put('workflow_run', {
          ...current,
          data: { ...current.data, status: 'cancelled', cancellation },
        });
        await factory.fact(tx, caller, item, 'workflow.cancellation-confirmed', {
          run: run.id,
          request: cancellation.request,
          publication: p!.id,
          attempt: p!.data.attempt,
          evidenceFact: input.evidence,
          confirmedStopped: true,
          evidence: cancellation.evidence,
        });
      }
    }
    await factory.fact(tx, caller, item, 'publication.recovery-decided', {
      run: run.id,
      activity: p!.id,
      attempt: p!.data.attempt,
      evidence: input.evidence,
      resolution: input.resolution,
      reason: input.reason,
      confirmedStopped: true,
    });
    return { publication: publicationView(updated) };
  });
}
