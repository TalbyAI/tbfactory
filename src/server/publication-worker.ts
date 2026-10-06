import { randomUUID } from 'node:crypto';
import { Factory } from './factory';
import { digest, fail } from './contracts';
import { type Store, type Transaction } from './store';
import { type OrganizationSecrets } from './secrets';
import { authorized } from './authorization';
import { scopeOf, type Run } from './reviews';
import { activeShare } from './artifact-sharing';
import { type ReviewArtifacts } from './review-artifacts';
import {
  PublicationProvider,
  PublicationRejected,
  PublicationDispatchBlocked,
  publicationPurpose,
} from './publication-provider';
import {
  publicationContent,
  publicationForRun,
  publicationMatches,
  publicationReady,
  publicationState,
  type Publication,
} from './publications';

export class PublicationWorker {
  private readonly provider: PublicationProvider;
  private readonly factory: Factory;
  constructor(
    private readonly store: Store,
    private readonly secrets: OrganizationSecrets,
    private readonly owner: string,
    allowedHosts: string[],
    allowLoopback: boolean,
    private readonly artifacts?: ReviewArtifacts,
  ) {
    this.provider = new PublicationProvider(allowedHosts, allowLoopback);
    this.factory = new Factory(store);
  }
  private async owned(tx: Transaction, id: string, token?: string) {
    if (((await tx.get('worker_owner', 'review'))?.data as any)?.owner !== this.owner)
      fail(409, 'Worker ownership lost');
    const p = (await tx.get('external_activity', id)) as Publication;
    if (!p || (token && p.data.token !== token)) fail(409, 'Publication attempt ownership lost');
    return p;
  }
  private async current(tx: Transaction, run: string) {
    const row = (await tx.get('workflow_run', run)) as Run;
    const p = row && (await publicationForRun(tx, row));
    if (!p) fail(404, 'Publication not found');
    return this.owned(tx, p.id);
  }
  async recoverInterrupted(run: string) {
    await this.store.transaction(async (tx) => {
      const p = await this.current(tx, run);
      if (!['dispatching', 'reconciling'].includes(p.data.status)) return;
      await publicationState(tx, p, 'uncertain', {
        error: 'Interrupted provider operation; gather evidence and obtain User confirmation',
      });
      const item = (await tx.get('work_item', p.workItem))!;
      await this.factory.fact(
        tx,
        { user: 'worker', human: false },
        item,
        'publication.interrupted',
        { activity: p.id, run: p.run, attempt: p.data.attempt, previousStatus: p.data.status },
      );
    });
  }
  async cancelRequested(
    run: string,
  ): Promise<'confirmed' | 'awaiting' | 'completed-before-stop' | 'none'> {
    return this.store.transaction(async (tx) => {
      if (((await tx.get('worker_owner', 'review'))?.data as any)?.owner !== this.owner)
        fail(409, 'Worker ownership lost');
      const current = (await tx.get('workflow_run', run)) as Run;
      const cancellation = current.data.cancellation;
      if (
        !cancellation ||
        !['requested', 'awaiting-publication-resolution'].includes(cancellation.status)
      )
        return 'none';
      const p = await publicationForRun(tx, current);
      if (!p) return 'none';
      const item = (await tx.get('work_item', p.workItem))!;
      if (p.data.status === 'completed') {
        const updatedCancellation = {
          ...cancellation,
          status: 'completed-before-stop' as const,
          confirmedAt: Date.now(),
          evidence: { providerOutcome: 'completed' },
        };
        await tx.put('workflow_run', {
          ...current,
          data: { ...current.data, status: 'completed', cancellation: updatedCancellation },
        });
        if ((item.activeRun as any)?.id === run)
          await tx.put('work_item', { ...item, activeRun: undefined });
        await this.factory.fact(
          tx,
          { user: 'worker', human: false },
          item,
          'workflow.cancellation-not-applied',
          {
            run,
            request: cancellation.request,
            reason: 'Publication completed before the cancellation request could stop it',
            publication: p.id,
            attempt: p.data.attempt,
          },
        );
        return 'completed-before-stop';
      }
      if (p.data.dispatchAuthorized !== false) {
        await tx.put('workflow_run', {
          ...current,
          data: {
            ...current.data,
            cancellation: { ...cancellation, status: 'awaiting-publication-resolution' },
          },
        });
        return 'awaiting';
      }
      const evidence = await this.factory.fact(
        tx,
        { user: 'worker', human: false },
        item,
        'publication.evidence',
        {
          activity: p.id,
          run,
          attempt: p.data.attempt,
          contentDigest: digest(publicationContent(p)),
          matches: [],
          complete: true,
          noDispatch: p.data.dispatchAuthorized === false,
          cancelledBeforeDispatch: true,
        },
      );
      const status = p.data.status === 'skipped' ? 'skipped' : 'not-published';
      await publicationState(tx, p, status, { evidence: evidence.id, error: undefined });
      const confirmedAt = Date.now();
      await tx.put('workflow_run', {
        ...current,
        data: {
          ...current.data,
          status: 'cancelled',
          cancellation: {
            ...cancellation,
            status: 'confirmed',
            confirmedAt,
            evidence: { providerOutcome: 'not-published', evidence: evidence.id },
          },
        },
      });
      await this.factory.fact(
        tx,
        { user: 'worker', human: false },
        item,
        'publication.cancelled-before-dispatch',
        {
          run,
          activity: p.id,
          attempt: p.data.attempt,
          evidence: evidence.id,
        },
      );
      await this.factory.fact(
        tx,
        { user: 'worker', human: false },
        item,
        'workflow.cancellation-confirmed',
        {
          run,
          request: cancellation.request,
          publication: p.id,
          attempt: p.data.attempt,
          evidenceFact: evidence.id,
          confirmedStopped: true,
          evidence: { providerOutcome: 'not-published', evidence: evidence.id },
        },
      );
      return 'confirmed';
    });
  }
  async process(run: string, signal?: AbortSignal) {
    const claimed = await this.store.transaction(async (tx) => {
      const p = await this.current(tx, run);
      if (!['queued', 'reconciliation-queued'].includes(p.data.status)) return;
      const reconciliation = p.data.status === 'reconciliation-queued';
      const workflowRun = (await tx.get('workflow_run', run)) as Run;
      if (
        workflowRun.data.cancellation &&
        ['requested', 'awaiting-publication-resolution'].includes(
          workflowRun.data.cancellation.status,
        ) &&
        !reconciliation
      )
        return;
      const item = (await tx.get('work_item', p.workItem))!;
      if (reconciliation) {
        try {
          await authorized(
            tx,
            { user: p.data.recoveryActor!, human: true },
            'review.recover',
            scopeOf(item),
          );
        } catch {
          await publicationState(tx, p, 'uncertain', { error: 'Recovery authority unavailable' });
          await this.factory.fact(
            tx,
            { user: 'worker', human: false },
            item,
            'publication.uncertain',
            {
              activity: p.id,
              run: p.run,
              attempt: p.data.attempt,
              reason: 'Recovery authority unavailable',
            },
          );
          return;
        }
      }
      if (!reconciliation) {
        try {
          await publicationReady(tx, p);
        } catch (error: any) {
          if (![403, 404, 409].includes(error.status)) throw error;
          await publicationState(tx, p, 'blocked', { error: error.message });
          await this.factory.fact(
            tx,
            { user: 'worker', human: false },
            item,
            'publication.blocked',
            { activity: p.id, run: p.run, attempt: p.data.attempt, reason: error.message },
          );
          return;
        }
        if (!p.data.content) {
          await publicationState(tx, p, 'skipped');
          await this.factory.fact(
            tx,
            { user: p.data.identity.user, human: false },
            item,
            'publication.skipped',
            {
              activity: p.id,
              run: p.run,
              decision: p.data.decision,
              reason: 'No confirmed Findings',
            },
          );
          return;
        }
      }
      let key: string | undefined;
      try {
        key = await this.secrets.readInTransaction(
          tx,
          p.organization,
          publicationPurpose(p.data.destination.credential),
        );
      } catch {
        if (!reconciliation) {
          await publicationState(tx, p, 'blocked', {
            error: 'Publication credential unavailable',
          });
          await this.factory.fact(
            tx,
            { user: 'worker', human: false },
            item,
            'publication.blocked',
            {
              activity: p.id,
              run: p.run,
              attempt: p.data.attempt,
              reason: 'Publication credential unavailable',
            },
          );
          return;
        }
      }
      const updated = await publicationState(
        tx,
        p,
        reconciliation ? 'reconciling' : 'dispatching',
        { token: randomUUID(), error: undefined },
      );
      if (!reconciliation)
        await this.factory.fact(
          tx,
          { user: p.data.identity.user, human: false },
          item,
          'publication.dispatch-reserved',
          {
            activity: p.id,
            run: p.run,
            attempt: p.data.attempt,
            decision: p.data.decision,
            contentDigest: digest(publicationContent(p)),
            destination: p.data.destination,
          },
        );
      return { p: updated, key, reconciliation };
    });
    if (!claimed) return;
    const { p, key, reconciliation } = claimed;
    const content = publicationContent(p);
    // Provider effects must remain outside Store.transaction: conflict retries replay only local work.
    if (reconciliation) {
      let evidence: { matches: unknown[]; complete: boolean; unavailable?: boolean };
      try {
        if (!key) throw Error('Publication credential unavailable');
        evidence = await this.provider.evidence(p.data.destination, key, content);
      } catch {
        evidence = { matches: [], complete: false, unavailable: true };
      }
      await this.store.transaction(async (tx) => {
        const current = await this.owned(tx, p.id, p.data.token);
        if (current.data.status !== 'reconciling') fail(409, 'Reconciliation ownership lost');
        const item = (await tx.get('work_item', p.workItem))!;
        const matches = new Map(
          (await publicationMatches(tx, current)).map((effect) => [effect.id, effect]),
        );
        for (const effect of evidence.matches as { id: string; contentDigest: string }[])
          matches.set(effect.id, effect);
        const fact = await this.factory.fact(
          tx,
          { user: 'worker', human: false },
          item,
          'publication.evidence',
          {
            activity: p.id,
            run: p.run,
            attempt: p.data.attempt,
            contentDigest: digest(content),
            ...evidence,
            matches: [...matches.values()],
            noDispatch: current.data.dispatchAuthorized === false,
          },
        );
        await publicationState(tx, current, 'uncertain', {
          evidence: fact.id,
          error: evidence.unavailable
            ? 'Provider evidence unavailable; User confirmation required'
            : 'Provider evidence gathered; User confirmation required',
        });
      });
      return;
    }
    let effect;
    try {
      effect = await this.provider.publish(
        p.data.destination,
        key!,
        content,
        () =>
          this.store.transaction(async (tx) => {
            const current = await this.owned(tx, p.id, p.data.token);
            if (current.data.status !== 'dispatching') fail(409, 'Publication ownership lost');
            try {
              await publicationReady(tx, current);
              if (current.data.reference) {
                const item = (await tx.get('work_item', p.workItem))!;
                const share = await activeShare(tx, item, current.data.reference);
                const artifact = await tx.get('publication_artifact', share.data.contentVersion);
                if (!artifact || !this.artifacts) fail(503, 'Artifact content unavailable');
                await this.artifacts.verify(artifact.data as any);
                // Serialize dispatch authorization with revocation and activation.
                await tx.put('artifact_share', {
                  ...share,
                  data: { ...share.data, dispatches: (share.data.dispatches ?? 0) + 1 },
                });
              }
              const credential = await this.secrets.readInTransaction(
                tx,
                p.organization,
                publicationPurpose(p.data.destination.credential),
              );
              await tx.put('external_activity', {
                ...current,
                data: { ...current.data, dispatchAuthorized: true },
              });
              const item = (await tx.get('work_item', p.workItem))!;
              await this.factory.fact(
                tx,
                { user: p.data.identity.user, human: false },
                item,
                'publication.dispatch-authorized',
                { activity: p.id, run: p.run, attempt: p.data.attempt },
              );
              return credential;
            } catch {
              throw new PublicationDispatchBlocked(
                'Publication inputs, credentials or execution authority changed before dispatch',
              );
            }
          }),
        signal,
      );
    } catch (error) {
      await this.store.transaction(async (tx) => {
        const current = await this.owned(tx, p.id, p.data.token);
        if (current.data.status !== 'dispatching') fail(409, 'Publication ownership lost');
        const rejected = error instanceof PublicationRejected;
        const blocked = error instanceof PublicationDispatchBlocked;
        await publicationState(
          tx,
          current,
          blocked ? 'blocked' : rejected ? 'failed' : 'uncertain',
          {
            error:
              blocked || rejected
                ? error.message
                : 'Provider outcome uncertain; reconcile before recovery',
          },
        );
        const item = (await tx.get('work_item', p.workItem))!;
        await this.factory.fact(
          tx,
          { user: p.data.identity.user, human: false },
          item,
          blocked
            ? 'publication.blocked'
            : rejected
              ? 'publication.failed'
              : 'publication.uncertain',
          { activity: p.id, run: p.run, attempt: p.data.attempt },
        );
      });
      return;
    }
    await this.store.transaction(async (tx) => {
      const current = await this.owned(tx, p.id, p.data.token);
      if (current.data.status !== 'dispatching') fail(409, 'Publication ownership lost');
      const item = (await tx.get('work_item', p.workItem))!;
      await publicationState(tx, current, 'completed', { effect, effects: [effect] });
      const run = (await tx.get('workflow_run', p.run)) as Run;
      if (
        run.data.cancellation &&
        ['requested', 'awaiting-publication-resolution'].includes(run.data.cancellation.status)
      ) {
        const cancellation = {
          ...run.data.cancellation,
          status: 'completed-before-stop' as const,
          confirmedAt: Date.now(),
          evidence: { providerOutcome: 'completed', effect },
        };
        await tx.put('workflow_run', { ...run, data: { ...run.data, cancellation } });
        await this.factory.fact(
          tx,
          { user: 'worker', human: false },
          item,
          'workflow.cancellation-not-applied',
          {
            run: p.run,
            request: cancellation.request,
            reason: 'Publication completed before the cancellation request could stop it',
            publication: p.id,
            attempt: p.data.attempt,
            effect,
          },
        );
      }
      await this.factory.fact(
        tx,
        { user: p.data.identity.user, human: false },
        item,
        'publication.completed',
        { activity: p.id, run: p.run, attempt: p.data.attempt, decision: p.data.decision, effect },
      );
    });
  }
}
