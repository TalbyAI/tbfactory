import { randomUUID } from 'node:crypto';
import { Factory } from './factory';
import { digest, fail } from './contracts';
import { type Store, type Transaction } from './store';
import { type OrganizationSecrets } from './secrets';
import { authorized } from './authorization';
import { scopeOf, type Run } from './reviews';
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
  async process(run: string) {
    const claimed = await this.store.transaction(async (tx) => {
      const p = await this.current(tx, run);
      if (!['queued', 'reconciliation-queued'].includes(p.data.status)) return;
      const reconciliation = p.data.status === 'reconciliation-queued';
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
      effect = await this.provider.publish(p.data.destination, key!, content, () =>
        this.store.transaction(async (tx) => {
          const current = await this.owned(tx, p.id, p.data.token);
          if (current.data.status !== 'dispatching') fail(409, 'Publication ownership lost');
          try {
            await publicationReady(tx, current);
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
