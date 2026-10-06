import { randomUUID } from 'node:crypto';
import { z } from 'zod';
import { type Caller } from './auth';
import { authorization, authorized, currentCaller, visible } from './authorization';
import { digest, fail, identifier, stable } from './contracts';
import { type Factory, type Operation } from './factory';
import { membershipId } from './provision';
import { confirmedContent } from './publication-content';
import { type ReviewArtifacts } from './review-artifacts';
import { decisionUsable, scopeOf, type Run } from './reviews';
import { type Row, type Store, type Transaction } from './store';

const day = 86400000;
export const shareCreationSchema = z
  .strictObject({
    operationId: identifier,
    run: identifier,
    decision: identifier,
    recipients: z
      .array(identifier)
      .min(1)
      .max(50)
      .refine((ids) => new Set(ids).size === ids.length),
    expiresAt: z.number().int().positive().optional(),
    expiresInDays: z.number().int().min(1).max(30).optional(),
  })
  .refine((input) => input.expiresAt === undefined || input.expiresInDays === undefined);
export const shareActionSchema = z.strictObject({
  operationId: identifier,
  request: identifier.optional(),
});
export type Share = Row & {
  organization: string;
  workItem: string;
  data: {
    contentVersion: string;
    run: string;
    report: string;
    decision: string;
    recipients: string[];
    createdAt: number;
    expiresAt: number;
    creator: string;
    url: string;
    status: 'active' | 'waiting-approval' | 'revoked';
    revokedAt?: number;
    approval?: { actor: string; binding: string };
    revocation?: { request: string; actor: string; binding: string };
    dispatches?: number;
  };
};
export const shareStatus = (share: Share) =>
  share.data.status === 'revoked'
    ? 'revoked'
    : Date.now() >= share.data.expiresAt
      ? 'expired'
      : share.data.status;
export const shareView = (share: Share) => ({
  id: share.id,
  ...share.data,
  status: shareStatus(share),
});
export const shareBinding = (share: Share) =>
  digest(
    stable({
      reference: share.id,
      organization: share.organization,
      workItem: share.workItem,
      contentVersion: share.data.contentVersion,
      report: share.data.report,
      decision: share.data.decision,
      run: share.data.run,
      recipients: share.data.recipients,
      expiresAt: share.data.expiresAt,
      creator: share.data.creator,
      url: share.data.url,
    }),
  );
async function recipientsCurrent(tx: Transaction, share: Share) {
  for (const user of share.data.recipients) {
    const membership = await tx.get('membership', membershipId(user, share.organization));
    if (!membership?.active) fail(422, 'Recipients require current Organization Membership');
  }
}
async function currentDecision(tx: Transaction, item: Row, runId: string, decisionId: string) {
  const run = (await tx.get('workflow_run', runId)) as Run | undefined;
  const decision = await tx.get('fact', decisionId);
  if (!decision || !(await decisionUsable(tx, item, run, decision)))
    fail(409, 'Current human Review Decision required');
  return { run: run!, decision };
}
async function shareAuthority(tx: Transaction, item: Row, share: Share) {
  const creator = { user: share.data.creator, human: true };
  await authorized(tx, creator, 'work-item.read', scopeOf(item));
  await authorized(tx, creator, 'artifact.read', scopeOf(item));
  const permission = await authorization(tx, creator, 'artifact.share', scopeOf(item));
  if (permission.requiresHuman) {
    const approval = share.data.approval;
    if (!approval || approval.binding !== shareBinding(share))
      fail(403, 'Sharing Approval required');
    await authorized(
      tx,
      { user: approval.actor, human: true },
      'approval.artifact-share',
      scopeOf(item),
    );
  }
}
export async function activeShare(tx: Transaction, item: Row, reference: string) {
  const share = (await tx.get('artifact_share', reference)) as Share | undefined;
  if (!share || share.organization !== item.organization || share.workItem !== item.id)
    fail(404, 'Resource not found');
  if (shareStatus(share) !== 'active') fail(409, 'Active report reference required');
  return share;
}
export async function sharingOperation(
  factory: Factory,
  tx: Transaction,
  caller: Caller,
  operation: Operation,
  input: any,
  item: Row,
) {
  if (!caller.human) fail(403, 'Authenticated human sharing operation required');
  const scope = scopeOf(item);
  await authorized(tx, caller, 'work-item.read', scope);
  if (operation.action === 'sharing.list') {
    await authorized(tx, caller, 'artifact.read', scope);
    const shares = await tx.list(
      'artifact_share',
      'organization = $organization AND workItem = $workItem',
      { organization: item.organization, workItem: item.id },
    );
    const publications = await tx.list(
      'external_activity',
      'organization = $organization AND workItem = $workItem',
      { organization: item.organization, workItem: item.id },
    );
    return {
      shares: shares.map((s) => ({
        ...shareView(s as Share),
        publications: publications
          .filter((p) => (p.data as any).reference === s.id)
          .map((p) => ({
            id: p.id,
            status: (p.data as any).status,
            attempt: (p.data as any).attempt,
          })),
      })),
    };
  }
  if (operation.action === 'sharing.create') {
    if (item.version !== 5) fail(409, 'Sharing requires Work Item Type version 5');
    await authorized(tx, caller, 'artifact.read', scope);
    const permission = await authorization(tx, caller, 'artifact.share', scope);
    return factory.mutate(tx, caller, operation, input, async () => {
      const { run, decision } = await currentDecision(tx, item, input.run, input.decision);
      const report = (await tx.get('review_report', run.data.report!))!;
      const content = confirmedContent(report.data, decision);
      const now = Date.now(),
        expiresAt = input.expiresAt ?? now + (input.expiresInDays ?? 7) * day;
      if (expiresAt <= now || expiresAt > now + 30 * day)
        fail(422, 'Expiry must be in the next 30 days');
      const contentVersion = digest(
        stable(['publication-artifact-v1', item.id, report.id, decision.id]),
      );
      if (!factory.sharing.artifacts || !factory.sharing.origin)
        fail(503, 'Artifact sharing unavailable');
      const id = randomUUID();
      const share: Share = {
        id,
        organization: String(item.organization),
        workItem: item.id,
        data: {
          contentVersion,
          run: run.id,
          report: report.id,
          decision: decision.id,
          recipients: [...input.recipients].sort(),
          createdAt: now,
          expiresAt,
          creator: caller.user,
          url: `${factory.sharing.origin}/api/shared-reports/${id}`,
          status: permission.requiresHuman ? 'waiting-approval' : 'active',
        },
      };
      await recipientsCurrent(tx, share);
      if (!content) return { share: null, reason: 'No confirmed Findings' };
      const metadata = await factory.sharing.artifacts.write(contentVersion, content);
      if (!(await tx.get('publication_artifact', contentVersion)))
        await tx.create('publication_artifact', {
          id: contentVersion,
          organization: item.organization,
          workItem: item.id,
          data: { ...metadata, report: report.id, decision: decision.id },
        });
      await tx.create('artifact_share', share);
      await factory.fact(tx, caller, item, 'artifact.share-requested', {
        reference: id,
        binding: shareBinding(share),
        contentVersion,
        recipients: share.data.recipients,
        expiresAt,
        status: share.data.status,
      });
      return { share: shareView(share) };
    });
  }
  const share = (await tx.get('artifact_share', operation.request!)) as Share | undefined;
  if (!share || share.organization !== item.organization || share.workItem !== item.id)
    fail(404, 'Resource not found');
  const approval = operation.action.endsWith('approve');
  const revoke = operation.action.startsWith('sharing.revoke');
  if (!revoke) await authorized(tx, caller, 'artifact.read', scope);
  const activity = revoke ? 'artifact.revoke' : 'artifact.share';
  const permission = approval ? undefined : await authorization(tx, caller, activity, scope);
  if (approval)
    await authorized(
      tx,
      caller,
      revoke ? 'approval.artifact-revoke' : 'approval.artifact-share',
      scope,
    );
  return factory.mutate(tx, caller, operation, input, async () => {
    if (!revoke) {
      if (shareStatus(share) !== 'waiting-approval')
        fail(409, 'Reference is not awaiting Sharing Approval');
      await currentDecision(tx, item, share.data.run, share.data.decision);
      await recipientsCurrent(tx, share);
      share.data.approval = { actor: caller.user, binding: shareBinding(share) };
      await shareAuthority(tx, item, share);
      if (!factory.sharing.artifacts) fail(503, 'Artifact storage unavailable');
      const artifact = (await tx.get('publication_artifact', share.data.contentVersion))!;
      await factory.sharing.artifacts.verify(artifact.data as any);
      share.data.status = 'active';
    } else {
      if (share.data.status === 'revoked') return { share: shareView(share) };
      if (approval) {
        const request = share.data.revocation;
        if (
          !request ||
          request.request !== input.request ||
          request.binding !== shareBinding(share)
        )
          fail(409, 'Current revocation request required');
        await authorized(tx, { user: request.actor, human: true }, 'work-item.read', scope);
        await authorization(tx, { user: request.actor, human: true }, 'artifact.revoke', scope);
      } else if (permission!.requiresHuman) {
        share.data.revocation = {
          request: randomUUID(),
          actor: caller.user,
          binding: shareBinding(share),
        };
        await tx.put('artifact_share', share);
        await factory.fact(tx, caller, item, 'artifact.revocation-requested', {
          reference: share.id,
          ...share.data.revocation,
        });
        return { share: shareView(share), status: 'waiting-approval' };
      }
      share.data.status = 'revoked';
      share.data.revokedAt = Date.now();
    }
    await tx.put('artifact_share', share);
    await factory.fact(tx, caller, item, revoke ? 'artifact.revoked' : 'artifact.share-approved', {
      reference: share.id,
      binding: shareBinding(share),
      ...(revoke ? { request: share.data.revocation?.request } : share.data.approval),
    });
    return { share: shareView(share) };
  });
}
export async function readSharedArtifact(
  store: Store,
  artifacts: ReviewArtifacts,
  caller: Caller,
  reference: string,
) {
  identifier.parse(reference);
  const artifact = await store.transaction(async (tx) => {
    await currentCaller(tx, caller);
    if (!caller.human) fail(403, 'Authenticated human recipient required');
    const share = (await tx.get('artifact_share', reference)) as Share | undefined;
    if (!share) fail(404, 'Resource not found');
    await visible(tx, caller, share.organization);
    if (!share.data.recipients.includes(caller.user)) fail(403, 'Named recipient required');
    const item = (await tx.get('work_item', share.workItem))!;
    await authorized(tx, caller, 'artifact.shared-read', scopeOf(item));
    if (shareStatus(share) !== 'active') fail(403, 'Report reference is not active');
    const artifact = await tx.get('publication_artifact', share.data.contentVersion);
    if (
      !artifact ||
      artifact.organization !== share.organization ||
      artifact.workItem !== share.workItem
    )
      fail(503, 'Artifact content unavailable');
    return artifact.data as any;
  });
  return artifacts.verify(artifact);
}
