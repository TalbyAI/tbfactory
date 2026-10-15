import { Mastra } from '@mastra/core/mastra';
import { createStep, createWorkflow } from '@mastra/core/workflows';
import { LibSQLStore } from '@mastra/libsql';
import { z } from 'zod';
import { randomUUID } from 'node:crypto';
import { mkdir, open, readFile, unlink } from 'node:fs/promises';
import { join, resolve } from 'node:path';
import { hostname } from 'node:os';
import { authorization } from './authorization';
import { digest, fail, stable } from './contracts';
import { type Store, type Transaction } from './store';
import { Factory } from './factory';
import { type OrganizationSecrets } from './secrets';
import { ReviewArtifacts, reportMarkdown, reportSchema } from './review-artifacts';
import { ReviewAgent } from './review-agent';
import { RepositorySandbox, confirmSandboxStopped, validateSandboxImage } from './review-sandbox';
import { limitsSchema, serviceUser } from './review-configuration';
import {
  acceptIntake,
  executionCaller,
  generationApproved,
  scopeOf,
  refreshNotification,
  relevantFacts,
  type Run,
  reportView,
  decisionUsable,
} from './reviews';
import { transitionOperation } from './transitions';
import { PublicationWorker } from './publication-worker';
import { supportsReview } from './work-item-types';
import { finalizationAuthorizationReady, reviewFinalizationWorkflow } from './review-finalization';
import { readRestoreHold } from './restore-hold';

export type WorkerSettings = {
  directory: string;
  artifacts: string;
  image: string;
  allowedHosts: string[];
  allowLoopback: boolean;
  concurrency: number;
  limits: z.infer<typeof limitsSchema>;
  restoreHold?: string;
};

async function terminalizeFinalizationRequest(
  tx: Transaction,
  run: Run,
  cancellationRequest: string,
) {
  if (run.data.workflow !== 'review-finalization-v1') return;
  const requestId = run.data.finalization?.request;
  const request = requestId ? await tx.get('transition_request', requestId) : undefined;
  if (
    !request ||
    request.organization !== run.organization ||
    request.workItem !== run.workItem ||
    request.transition !== 'finalize-review' ||
    request.workflowRun !== run.id
  )
    fail(409, 'Finalization Transition Request ownership lost during cancellation');
  if (request.status === 'cancelled') return;
  if (request.status !== 'running')
    fail(409, 'Finalization Transition Request is not running during cancellation');
  await tx.put('transition_request', {
    ...request,
    status: 'cancelled',
    error: 'Workflow Run cancellation confirmed',
    result: { workflowRun: run.id, cancellationRequest },
  });
}

function finalizationWorkflowFailure(result: unknown) {
  const steps =
    result && typeof result === 'object' && 'steps' in result && result.steps
      ? Object.entries(result.steps)
      : [];
  const failedStep = steps.find(([, step]) => (step as any)?.status === 'failed')?.[0];
  return `Finalization Workflow step ${failedStep ?? 'finalize-review'} failed`;
}

export class ReviewWorker {
  private storage!: LibSQLStore;
  private readonly workflows: Record<string, ReturnType<typeof createWorkflow>>;
  private readonly running = new Map<string, Promise<void>>();
  private readonly controllers = new Map<string, AbortController>();
  private stopping = false;
  private dispatchPaused = false;
  private tickInFlight?: Promise<void>;
  private ownsLock = false;
  private readonly owner = randomUUID();
  private readonly lock: string;
  private restoreHold = undefined as Awaited<ReturnType<typeof readRestoreHold>>;
  readonly artifacts: ReviewArtifacts;
  private readonly publications: PublicationWorker;
  constructor(
    readonly store: Store,
    readonly secrets: OrganizationSecrets,
    readonly settings: WorkerSettings,
  ) {
    this.lock = join(resolve(settings.directory), 'worker.lock');
    this.artifacts = new ReviewArtifacts(settings.artifacts);
    this.publications = new PublicationWorker(
      store,
      secrets,
      this.owner,
      settings.allowedHosts,
      settings.allowLoopback,
      this.artifacts,
    );
    const schema = z.object({ run: z.string() });
    const intake = createStep({
      id: 'required-facts',
      inputSchema: schema,
      outputSchema: schema,
      resumeSchema: z.object({ recheck: z.boolean() }),
      suspendSchema: z.object({ fields: z.array(z.string()) }),
      execute: async ({ inputData, suspend }) => {
        const inputs = await this.store.transaction(async (tx) => {
          const run = (await tx.get('workflow_run', inputData.run)) as Run;
          const item = (await tx.get('work_item', run.workItem))!;
          const inputs = await refreshNotification(tx, item, run);
          inputs.missing = await this.intakeMissing(tx, run);
          if (inputs.missing.length)
            await tx.put('notification', {
              id: run.id,
              organization: item.organization,
              workItem: item.id,
              data: {
                run: run.id,
                fields: inputs.missing,
                resolved: false,
                message: `Missing review prerequisites: ${inputs.missing.join(', ')}`,
              },
            });
          return inputs;
        });
        if (inputs.missing.length) {
          await this.update(inputData.run, 'waiting-inputs');
          return suspend({ fields: inputs.missing });
        }
        return inputData;
      },
    });
    const handoff = createStep({
      id: 'handoff',
      inputSchema: schema,
      outputSchema: schema,
      execute: async ({ inputData }) => {
        await this.handoff(inputData.run);
        return inputData;
      },
    });
    const generate = createStep({
      id: 'generate-report',
      inputSchema: schema,
      outputSchema: schema,
      execute: async ({ inputData }) => {
        await this.generate(inputData.run);
        return inputData;
      },
    });
    const human = createStep({
      id: 'human-review',
      inputSchema: schema,
      outputSchema: schema,
      suspendSchema: z.object({ report: z.string() }),
      resumeSchema: z.object({ reviewed: z.boolean() }),
      execute: async ({ inputData, suspend }) => {
        const run = (await this.store.transaction((tx) =>
          tx.get('workflow_run', inputData.run),
        )) as Run;
        if (!run.data.report) fail(503, 'Completed report required');
        if (run.data.decision) {
          const accepted = await this.completeReview(run.id);
          if (accepted) return inputData;
          return suspend({ report: run.data.report });
        }
        await this.update(run.id, 'waiting-review');
        return suspend({ report: run.data.report });
      },
    });
    this.workflows = {
      'review-intake-v1': createWorkflow({
        id: 'review-intake-v1',
        inputSchema: schema,
        outputSchema: schema,
      })
        .then(intake)
        .then(handoff)
        .commit(),
      'review-v1': createWorkflow({ id: 'review-v1', inputSchema: schema, outputSchema: schema })
        .then(generate)
        .then(human)
        .commit(),
      'review-finalization-v1': reviewFinalizationWorkflow(this.store, this.owner),
    };
  }
  async verifyPersistentSnapshots(runs: Array<{ id: string; workflow: string; status: string }>) {
    this.storage = new LibSQLStore({
      id: 'factory-workflow-recovery-check',
      url: `file:${join(resolve(this.settings.directory), 'workflows.db').replaceAll('\\', '/')}`,
    });
    new Mastra({ storage: this.storage, workflows: this.workflows, logger: false });
    await this.storage.init();
    try {
      for (const run of runs) {
        const workflow = this.workflows[run.workflow];
        if (!workflow) throw Error('Retained Workflow definition unavailable');
        const snapshot = await workflow.getWorkflowRunById(run.id);
        const suspended = ['waiting-inputs', 'waiting-review', 'waiting-revalidation'].includes(
          run.status,
        );
        if (suspended && snapshot?.status !== 'suspended')
          throw Error('Retained human-wait Workflow snapshot is unavailable or not suspended');
        if (run.status.startsWith('publication-') && !snapshot)
          throw Error('Retained publication Workflow snapshot is unavailable');
        if (snapshot && !['suspended', 'success', 'failed'].includes(snapshot.status))
          throw Error('Retained Workflow snapshot is in an unsafe execution state');
      }
    } finally {
      await this.storage.close();
    }
  }
  private async completeReview(id: string) {
    return this.store.transaction(async (tx) => {
      const run = (await tx.get('workflow_run', id)) as Run;
      const item = (await tx.get('work_item', run.workItem))!;
      if ((item.activeRun as any)?.id !== run.id) fail(409, 'Review ownership lost');
      if (this.cancellationPending(run)) return false;
      const decision = run.data.decision && (await tx.get('fact', run.data.decision));
      if (!decision || !(await decisionUsable(tx, item, run, decision))) {
        const status = 'waiting-revalidation';
        await tx.put('workflow_run', {
          ...run,
          data: {
            ...run.data,
            status,
            error: 'Relevant inputs changed; renewed human review required',
          },
        });
        await tx.put('work_item', {
          ...item,
          activeRun: { id, workflow: run.data.workflow, status },
        });
        return false;
      }
      let caller;
      try {
        caller = await executionCaller(tx, run);
        const transition = await authorization(
          tx,
          caller,
          'transition.request-review',
          scopeOf(item),
        );
        const generation = await authorization(tx, caller, 'review.generate', scopeOf(item));
        if (
          (transition.requiresHuman && !run.data.requestApproval) ||
          (generation.requiresHuman && !generationApproved(run))
        )
          fail(403, 'Activity-bound Approval required; supersede and request renewed Approval');
      } catch (error: any) {
        if (![403, 404].includes(error.status)) throw error;
        const status = 'waiting-authorization';
        await tx.put('workflow_run', {
          ...run,
          data: { ...run.data, status, error: error.message },
        });
        await tx.put('work_item', {
          ...item,
          activeRun: { id, workflow: run.data.workflow, status },
        });
        return false;
      }
      await tx.put('workflow_run', {
        ...run,
        data: { ...run.data, status: 'completed', error: undefined },
      });
      await tx.put('work_item', { ...item, activeRun: undefined });
      const factId = digest(`review-completed:${id}`);
      if (!(await tx.get('fact', factId)))
        await tx.create('fact', {
          id: factId,
          organization: run.organization,
          workItem: run.workItem,
          actor: caller.user,
          kind: 'workflow.completed',
          recordedAt: Date.now(),
          payload: {
            run: id,
            workflow: run.data.workflow,
            report: run.data.report,
            decision: decision.id,
            publication: false,
          },
        });
      return true;
    });
  }
  private async intakeMissing(tx: Transaction, run: Run) {
    const item = (await tx.get('work_item', run.workItem))!;
    const inputs = await relevantFacts(tx, item);
    if (inputs.missing.length) return inputs.missing;
    const config = (await tx.get('review_config', run.organization))?.data as any;
    const access = (await tx.get('repository_access', String(item.repository)))?.data as any;
    if (!config?.enabled) inputs.missing.push('AI configuration');
    if (!access?.enabled) inputs.missing.push('Repository Access Credential');
    if (config?.mode === 'platform' && !config.entitled)
      inputs.missing.push('Platform AI entitlement');
    if (
      run.data.identity.kind === 'service' &&
      config &&
      (!config.rules.enabled ||
        !config.rules.repositories.includes(item.repository) ||
        (config.rules.targetBranches.length &&
          !config.rules.targetBranches.includes(inputs.fields.targetBranch)) ||
        (inputs.fields.draft && !config.rules.includeDrafts))
    )
      inputs.missing.push('Automatic review eligibility');
    return inputs.missing;
  }
  async start() {
    this.restoreHold = await readRestoreHold(this.settings.restoreHold ?? this.settings.directory);
    if (this.restoreHold && this.restoreHold.activatedAt === null)
      throw Error('Restore hold is not activated; worker dispatch remains disabled');
    validateSandboxImage(this.settings.image);
    await mkdir(this.settings.directory, { recursive: true });
    try {
      await this.store.transaction(async (tx) => {
        if (await tx.get('worker_owner', 'review'))
          throw Error(
            'Installation worker already owns database; recover its stopped process first',
          );
        await tx.create('worker_owner', {
          id: 'review',
          data: {
            owner: this.owner,
            pid: process.pid,
            host: hostname(),
            directory: resolve(this.settings.directory),
          },
        });
      });
      const lock = await open(this.lock, 'wx', 0o600).catch(() => {
        throw Error('Worker volume locked; verify prior process stopped and use worker recovery');
      });
      this.ownsLock = true;
      try {
        await lock.writeFile(JSON.stringify({ pid: process.pid, createdAt: Date.now() }));
        await lock.sync();
      } finally {
        await lock.close();
      }
      this.storage = new LibSQLStore({
        id: 'factory-workflows',
        url: `file:${join(resolve(this.settings.directory), 'workflows.db').replaceAll('\\', '/')}`,
      });
      new Mastra({ storage: this.storage, workflows: this.workflows, logger: false });
      await this.storage.init();
      const runs = (await this.store.transaction((tx) => tx.list('workflow_run'))) as Run[];
      for (const run of runs) {
        if (this.heldByRestore(run.id)) continue;
        if (
          ['completed', 'superseded', 'stopped', 'cancelled', 'rejected'].includes(run.data.status)
        )
          continue;
        if (run.data.status.startsWith('publication-')) {
          await this.publications.recoverInterrupted(run.id);
          continue;
        }
        const workflow = this.workflows[run.data.workflow];
        if (!workflow || run.data.status === 'running') {
          await this.update(
            run.id,
            'recovery-required',
            'Interrupted execution requires confirmed-stop recovery',
          );
          continue;
        }
        if (
          [
            'waiting-inputs',
            'waiting-review',
            'review-submitted',
            'waiting-revalidation',
            'waiting-authorization',
          ].includes(run.data.status)
        ) {
          if (run.data.report) {
            try {
              const sourceRun = run.data.finalization?.reviewRun ?? run.id;
              const report = await this.store.transaction((tx) =>
                tx.get('review_report', run.data.report!),
              );
              if (
                !report ||
                report.run !== sourceRun ||
                report.organization !== run.organization ||
                report.workItem !== run.workItem
              )
                throw Error('Retained report metadata mismatch');
              await this.artifacts.verify(report.data as any);
            } catch {
              await this.update(
                run.id,
                'recovery-required',
                'Retained report content unavailable or damaged',
              );
              continue;
            }
          }
          const snapshot = await workflow.getWorkflowRunById(run.id);
          if (!snapshot || snapshot.status !== 'suspended')
            await this.update(
              run.id,
              'recovery-required',
              'Suspended Workflow snapshot unavailable',
            );
        }
      }
    } catch (e) {
      await this.storage?.close().catch(() => {});
      await this.releaseOwner();
      if (this.ownsLock) await unlink(this.lock);
      this.ownsLock = false;
      throw e;
    }
  }
  private async releaseOwner() {
    await this.store.transaction(async (tx) => {
      if (
        (await tx.get('worker_owner', 'review'))?.data &&
        ((await tx.get('worker_owner', 'review'))!.data as any).owner === this.owner
      )
        await tx.remove('worker_owner', 'review');
    });
  }
  private cancellationPending(run: Run) {
    return ['requested', 'awaiting-publication-resolution'].includes(
      run.data.cancellation?.status ?? '',
    );
  }
  /** Finalization calls this after its Workflow step returns cancellation-pending. */
  async confirmRequestedCancellation(id: string, executionStopped = false) {
    let run = (await this.store.transaction((tx) => tx.get('workflow_run', id))) as Run | undefined;
    if (!run || !this.cancellationPending(run)) return true;
    if (!executionStopped && this.running.has(id)) {
      this.controllers.get(id)?.abort(new Error('Workflow cancellation requested'));
      return false;
    }
    if (!executionStopped && run.data.status === 'recovery-required') return false;
    if (
      [
        'waiting-inputs',
        'waiting-review',
        'review-submitted',
        'waiting-revalidation',
        'waiting-authorization',
      ].includes(run.data.status)
    ) {
      try {
        const workflow = this.workflows[run.data.workflow];
        const snapshot = workflow && (await workflow.getWorkflowRunById(id));
        if (!snapshot || snapshot.status !== 'suspended')
          throw Error('Suspended snapshot unavailable');
      } catch {
        await this.update(
          id,
          'recovery-required',
          'Suspended Workflow snapshot unavailable for cancellation',
        );
        return false;
      }
    }
    if (run.data.status.startsWith('publication-')) {
      const outcome = await this.publications.cancelRequested(id);
      return outcome === 'confirmed' || outcome === 'completed-before-stop';
    }
    let sandboxStopped = false;
    try {
      if (
        run.data.workflow !== 'review-intake-v1' &&
        (run.data.sandbox ||
          ['running', 'recovery-required'].includes(run.data.status) ||
          run.data.report)
      ) {
        await confirmSandboxStopped(run);
        sandboxStopped = true;
      }
    } catch {
      await this.update(
        id,
        'recovery-required',
        'Cancellation is waiting for confirmed execution stop',
      );
      return false;
    }
    return this.store.transaction(async (tx) => {
      if (((await tx.get('worker_owner', 'review'))?.data as any)?.owner !== this.owner)
        fail(409, 'Worker ownership lost');
      const current = (await tx.get('workflow_run', id)) as Run;
      if (!this.cancellationPending(current)) return true;
      if (current.data.status.startsWith('publication-')) return false;
      const item = await tx.get('work_item', current.workItem);
      if (!item || (item.activeRun as any)?.id !== id) fail(409, 'Cancellation ownership lost');
      const cancellation = {
        ...current.data.cancellation!,
        status: 'confirmed' as const,
        confirmedAt: Date.now(),
        evidence: { executionStopped: true, sandboxStopped },
      };
      await tx.put('workflow_run', {
        ...current,
        data: {
          ...current.data,
          status: 'cancelled',
          cancellation,
          executionMs:
            current.data.executionMs +
            (current.data.activeSince ? Date.now() - current.data.activeSince : 0),
          activeSince: undefined,
          error: undefined,
        },
      });
      await terminalizeFinalizationRequest(tx, current, cancellation.request);
      await tx.put('work_item', { ...item, activeRun: undefined });
      const factId = digest(`workflow-cancellation-confirmed:${id}:${cancellation.request}`);
      if (!(await tx.get('fact', factId)))
        await tx.create('fact', {
          id: factId,
          organization: current.organization,
          workItem: current.workItem,
          actor: 'worker',
          kind: 'workflow.cancellation-confirmed',
          recordedAt: cancellation.confirmedAt,
          payload: {
            run: id,
            request: cancellation.request,
            confirmedStopped: true,
            evidence: cancellation.evidence,
          },
        });
      return true;
    });
  }
  private async update(id: string, status: string, error?: string) {
    return this.store.transaction(async (tx) => {
      if (((await tx.get('worker_owner', 'review'))?.data as any)?.owner !== this.owner)
        fail(409, 'Worker ownership lost');
      const run = (await tx.get('workflow_run', id)) as Run;
      if (['completed', 'superseded', 'stopped', 'cancelled', 'rejected'].includes(run.data.status))
        return run;
      if (this.cancellationPending(run) && status !== 'recovery-required') return run;
      const data = { ...run.data, status, ...(error ? { error } : {}) };
      const updated = { ...run, data };
      await tx.put('workflow_run', updated);
      const item = await tx.get('work_item', run.workItem);
      if (item && (item.activeRun as any)?.id === id)
        await tx.put('work_item', { ...item, activeRun: { id, workflow: data.workflow, status } });
      return updated;
    });
  }
  private async handoff(id: string) {
    await this.store.transaction(async (tx) => {
      const intake = (await tx.get('workflow_run', id)) as Run;
      if (intake.data.handoff) return;
      if (this.cancellationPending(intake)) return;
      const item = (await tx.get('work_item', intake.workItem))!;
      if ((item.activeRun as any)?.id !== id) fail(409, 'Intake ownership lost');
      const inputs = await relevantFacts(tx, item);
      if (inputs.missing.length) fail(409, 'Review inputs incomplete');
      const config = (await tx.get('review_config', intake.organization))?.data as any;
      const access = (await tx.get('repository_access', String(item.repository)))?.data as any;
      if (!config?.enabled || !access?.enabled || (config.mode === 'platform' && !config.entitled))
        fail(409, 'Review resource prerequisites unavailable');
      if (
        intake.data.identity.kind === 'service' &&
        (!config.rules.enabled ||
          !config.rules.repositories.includes(item.repository) ||
          (config.rules.targetBranches.length &&
            !config.rules.targetBranches.includes(inputs.fields.targetBranch)) ||
          (inputs.fields.draft && !config.rules.includeDrafts))
      )
        fail(409, 'Automatic review preconditions are not satisfied');
      const caller = await executionCaller(tx, intake);
      const transition = await authorization(
        tx,
        caller,
        'transition.request-review',
        scopeOf(item),
      );
      if (transition.requiresHuman && !intake.data.requestApproval)
        fail(403, 'Transition Approval required');
      const generate = await authorization(tx, caller, 'review.generate', scopeOf(item));
      const repository = await authorization(tx, caller, 'repository.read', scopeOf(item));
      if (repository.requiresHuman)
        fail(403, 'Repository access requires operator policy resolution');
      const installationLimits = this.settings.limits as Record<string, number>;
      const effectiveLimits = Object.fromEntries(
        Object.entries(config.limits).map(([name, value]) => [
          name,
          Math.min(Number(value), installationLimits[name]),
        ]),
      );
      const retained = { ...config, limits: effectiveLimits, access: { ...access } };
      const eligibilityId = digest(stable([intake.id, inputs.bindings, config.version]));
      await tx.create('fact', {
        id: eligibilityId,
        organization: item.organization,
        workItem: item.id,
        actor: caller.user,
        kind: 'review.eligible',
        recordedAt: Date.now(),
        payload: {
          intake: id,
          inputs: inputs.bindings,
          configurationVersion: config.version,
          executionIdentity: intake.data.identity,
        },
      });
      const review: Run = {
        id: digest(`review:${id}`),
        organization: intake.organization,
        workItem: intake.workItem,
        data: {
          ...intake.data,
          workflow: 'review-v1',
          status: generate.requiresHuman ? 'waiting-approval' : 'queued',
          error: undefined,
          token: randomUUID(),
          inputs: {
            fields: inputs.fields,
            bindings: inputs.bindings,
            repository: item.repository,
            eligibilityFact: eligibilityId,
            typeVersion: item.version,
          },
          config: retained,
          createdAt: Date.now(),
          calls: 0,
          aiMs: 0,
          executionMs: 0,
        },
      };
      await tx.create('workflow_run', review);
      if (inputs.cause) {
        const receiptId = digest(
          stable(['automatic-review-v1', item.id, inputs.cause.id, config.version]),
        );
        const receipts = await tx.list(
          'receipt',
          'organization = $organization AND operation = $operation AND clientId = $clientId',
          {
            organization: item.organization,
            operation: 'automatic-review-v1',
            clientId: inputs.cause.id,
          },
        );
        if (!receipts.length)
          await tx.create('receipt', {
            id: receiptId,
            organization: item.organization,
            user: caller.user,
            operation: 'automatic-review-v1',
            clientId: inputs.cause.id,
            digest: receiptId,
            result: { workflowRun: review.id },
          });
      }
      await tx.put('workflow_run', {
        ...intake,
        data: { ...intake.data, status: 'completed', handoff: review.id },
      });
      await tx.put('work_item', {
        ...item,
        activeRun: { id: review.id, workflow: review.data.workflow, status: review.data.status },
      });
      await tx.create('fact', {
        id: randomUUID(),
        organization: item.organization,
        workItem: item.id,
        actor: caller.user,
        kind: 'workflow.handoff',
        recordedAt: Date.now(),
        payload: {
          from: id,
          to: review.id,
          eligibilityFact: eligibilityId,
          executionIdentity: review.data.identity,
        },
      });
    });
  }
  private async generate(id: string) {
    let run = await this.store.transaction(async (tx) => {
      const run = (await tx.get('workflow_run', id)) as Run;
      if (this.cancellationPending(run)) return run;
      if (run.data.report) return run;
      if (run.data.status !== 'queued') fail(409, 'Workflow cannot dispatch');
      const updated = { ...run, data: { ...run.data, status: 'running', activeSince: Date.now() } };
      await tx.put('workflow_run', updated);
      return updated;
    });
    if (this.cancellationPending(run) || run.data.report) return;
    if (run.data.preparedReport) {
      try {
        await this.publishPrepared(run);
        return;
      } catch (e) {
        await this.update(id, 'recovery-required', 'Prepared report reconciliation failed');
        throw e;
      }
    }
    const controller = this.controllers.get(id) ?? new AbortController();
    let sandbox: RepositorySandbox | undefined;
    let agent: ReviewAgent | undefined;
    let timeout: ReturnType<typeof setTimeout> | undefined;
    try {
      sandbox = new RepositorySandbox(run, this.settings.image);
      timeout = setTimeout(
        () => controller.abort(new Error('Execution time limit exhausted')),
        Math.max(1, run.data.config!.limits.executionMs - run.data.executionMs),
      );
      agent = new ReviewAgent(
        this.store,
        this.secrets,
        run,
        sandbox,
        this.settings.allowedHosts,
        this.settings.allowLoopback,
        controller.signal,
      );
      await this.store.transaction((tx) => agent!.check(tx));
      const provenance = await sandbox.prepare(
        run.data.config!.access,
        this.secrets,
        this.settings.allowedHosts,
        this.settings.allowLoopback,
        controller.signal,
        async () => {
          await this.store.transaction((tx) => agent!.check(tx));
        },
      );
      await this.store.transaction(async (tx) => {
        const current = (await tx.get('workflow_run', id)) as Run;
        await tx.put('workflow_run', {
          ...current,
          data: { ...current.data, sandbox: provenance },
        });
      });
      const prior = await this.store.transaction(async (tx) =>
        (
          await tx.list('review_report', 'organization = $organization AND workItem = $workItem', {
            organization: run.organization,
            workItem: run.workItem,
          })
        ).map(reportView),
      );
      const report = reportSchema.parse(
        JSON.parse((await agent.generate(prior)).replace(/^```(?:json)?\s*|\s*```$/g, '')),
      );
      const previousIds = new Set(prior.flatMap((r) => (r as any).findings.map((f: any) => f.id)));
      for (const finding of report.findings) {
        if (
          Boolean(finding.previousFinding) !== Boolean(finding.assessment) ||
          (finding.previousFinding && !previousIds.has(finding.previousFinding))
        )
          fail(422, 'Invalid previous Finding relationship');
        if (finding.location) {
          const location = await sandbox.tool({
            operation: 'location',
            path: finding.location.path,
          });
          if (finding.location.line > location.lines)
            fail(422, 'Finding location is outside the bound checkout');
        }
      }
      if (controller.signal.aborted) throw controller.signal.reason;
      await agent.drain();
      await agent.assertComplete();
      await sandbox.stop();
      const reportId = digest(`report:${run.id}`);
      await this.store.transaction(async (tx) => {
        const current = await agent!.check(tx);
        const data = {
          ...report,
          findings: report.findings.map((f, index) => ({
            ...f,
            id: digest(stable([reportId, index])),
            status: 'proposed',
          })),
          version: reportId,
          relevantInputs: { ...run.data.inputs, checkout: provenance },
          workflowVersion: run.data.workflow,
          createdAt: Date.now(),
        };
        await tx.put('workflow_run', {
          ...current,
          data: {
            ...current.data,
            preparedReport: data,
          },
        });
      });
      run = (await this.store.transaction((tx) => tx.get('workflow_run', id))) as Run;
      await this.publishPrepared(run);
    } catch (error) {
      controller.abort();
      await agent?.drain();
      const stopped = await (sandbox ? sandbox.stop() : confirmSandboxStopped(run))
        .then(() => true)
        .catch(() => false);
      const currentBeforeRecovery = (await this.store.transaction((tx) =>
        tx.get('workflow_run', id),
      )) as Run;
      if (this.cancellationPending(currentBeforeRecovery)) {
        if (!stopped)
          await this.update(
            id,
            'recovery-required',
            'Cancellation is waiting for confirmed execution stop',
          );
        throw error;
      }
      await this.store.transaction(async (tx) => {
        const current = (await tx.get('workflow_run', id)) as Run;
        if (this.cancellationPending(current)) return;
        const data = {
          ...current.data,
          status: stopped && !current.data.preparedReport ? 'stopped' : 'recovery-required',
          error: (error as Error).message,
          executionMs:
            current.data.executionMs + Date.now() - Number(current.data.activeSince ?? Date.now()),
          activeSince: undefined,
        };
        await tx.put('workflow_run', { ...current, data });
        const item = await tx.get('work_item', current.workItem);
        if (item && (item.activeRun as any)?.id === id)
          await tx.put('work_item', {
            ...item,
            activeRun:
              data.status === 'stopped'
                ? undefined
                : { id, workflow: current.data.workflow, status: data.status },
          });
      });
      throw error;
    } finally {
      clearTimeout(timeout);
    }
  }
  private async publishPrepared(run: Run) {
    const data = run.data.preparedReport!;
    const artifact = await this.artifacts.write(
      digest(`artifact:${run.id}`),
      reportMarkdown({ summary: data.summary, findings: data.findings }),
    );
    await this.store.transaction(async (tx) => {
      const current = (await tx.get('workflow_run', run.id)) as Run;
      const item = await tx.get('work_item', run.workItem);
      if (!item || (item.activeRun as any)?.id !== run.id || current.data.token !== run.data.token)
        fail(409, 'Report attachment ownership lost');
      if (!(await tx.get('review_report', String(data.version))))
        await tx.create('review_report', {
          id: String(data.version),
          organization: run.organization,
          workItem: run.workItem,
          run: run.id,
          data: { ...data, ...artifact },
        });
      await tx.put('workflow_run', {
        ...current,
        data: {
          ...current.data,
          report: String(data.version),
          preparedReport: undefined,
          executionMs:
            current.data.executionMs + Date.now() - Number(current.data.activeSince ?? Date.now()),
          activeSince: undefined,
        },
      });
      const factId = digest(`report-fact:${run.id}`);
      if (!(await tx.get('fact', factId)))
        await tx.create('fact', {
          id: factId,
          organization: run.organization,
          workItem: run.workItem,
          actor: run.data.identity.user,
          kind: 'review.report-generated',
          recordedAt: Date.now(),
          payload: {
            run: run.id,
            report: data.version,
            inputs: run.data.inputs,
            executionIdentity: run.data.identity,
          },
        });
    });
  }
  private async automaticStarts() {
    const factory = new Factory(this.store);
    await this.store.transaction(async (tx) => {
      const configs = await tx.list('review_config');
      for (const record of configs) {
        const config = record.data as any;
        const items = await tx.list('work_item', 'organization = $organization', {
          organization: record.organization,
        });
        for (const item of items) {
          if (
            !supportsReview(item.version) ||
            item.activeRun ||
            !['registered', 'ready-for-review'].includes(String(item.state))
          )
            continue;
          const facts = await relevantFacts(tx, item);
          if (!facts.cause) continue;
          const cause = facts.cause;
          if (
            cause.kind === 'external.observation' &&
            this.restoreHold?.activatedAt !== null &&
            this.restoreHold?.activatedAt !== undefined &&
            Number(cause.recordedAt) <= this.restoreHold.activatedAt
          )
            continue;
          if (cause.kind !== 'external.observation' && !config.enabled) continue;
          if (cause.kind !== 'external.observation' && !config.rules.enabled) continue;
          if (
            cause.kind === 'external.observation' &&
            ![
              'opened',
              'synchronize',
              'reopened',
              'git.pullrequest.created',
              'git.pullrequest.updated',
            ].includes(String((cause.payload as any).event))
          )
            continue;
          if (
            cause.kind !== 'external.observation' &&
            (!config.rules.repositories.includes(item.repository) ||
              (facts.fields.targetBranch &&
                config.rules.targetBranches.length &&
                !config.rules.targetBranches.includes(facts.fields.targetBranch)) ||
              (facts.fields.draft && !config.rules.includeDrafts))
          )
            continue;
          const receiptId = digest(
            stable(['automatic-review-v1', item.id, cause.id, config.version]),
          );
          const receipts = await tx.list(
            'receipt',
            'organization = $organization AND operation = $operation AND clientId = $clientId',
            {
              organization: item.organization,
              operation: 'automatic-review-v1',
              clientId: cause.id,
            },
          );
          if (receipts.length) continue;
          const caller = {
            user: serviceUser(String(record.organization)),
            human: false,
            service: true,
            organization: String(record.organization),
          };
          try {
            const permission = await authorization(
              tx,
              caller,
              'transition.request-review',
              scopeOf(item),
            );
            if (permission.requiresHuman) continue;
          } catch (e: any) {
            if ([403, 404].includes(e.status)) continue;
            throw e;
          }
          const input = {
            operationId: receiptId,
            transition: 'request-review',
            expectedState: item.state,
            version: item.version,
            inputs: { reviewBrief: 'Review the observed repository change' },
          };
          await transitionOperation(
            factory,
            tx,
            caller,
            {
              action: 'transition.request',
              organization: String(item.organization),
              resource: item.id,
            },
            input,
            item,
            scopeOf(item),
            { limit: 30 },
          );
          await tx.create('receipt', {
            id: receiptId,
            organization: item.organization,
            user: caller.user,
            operation: 'automatic-review-v1',
            clientId: cause.id,
            digest: receiptId,
            result: { accepted: true },
          });
        }
      }
    });
  }
  pauseDispatch() {
    this.dispatchPaused = true;
  }
  resumeDispatch() {
    if (!this.stopping) this.dispatchPaused = false;
  }
  async waitForDispatchDrain() {
    this.dispatchPaused = true;
    while (this.tickInFlight || this.running.size) {
      const pending = [...(this.tickInFlight ? [this.tickInFlight] : []), ...this.running.values()];
      await Promise.allSettled(pending);
    }
    return { active: this.running.size, tick: Boolean(this.tickInFlight) };
  }
  async tick() {
    if (this.stopping || this.dispatchPaused || this.tickInFlight) return;
    const tick = this.tickCycle();
    this.tickInFlight = tick;
    try {
      await tick;
    } finally {
      if (this.tickInFlight === tick) this.tickInFlight = undefined;
    }
  }
  private async tickCycle() {
    if (this.stopping || this.dispatchPaused) return;
    this.restoreHold = await readRestoreHold(this.settings.restoreHold ?? this.settings.directory);
    await this.store.transaction(async (tx) => {
      if (((await tx.get('worker_owner', 'review'))?.data as any)?.owner !== this.owner)
        fail(409, 'Worker ownership lost');
    });
    const requested = (await this.store.transaction((tx) => tx.list('workflow_run'))) as Run[];
    if (this.dispatchPaused || this.stopping) return;
    for (const run of requested) {
      if (this.dispatchPaused || this.stopping) return;
      if (!this.heldByRestore(run.id) && this.cancellationPending(run))
        await this.confirmRequestedCancellation(run.id);
    }
    if (this.stopping || this.dispatchPaused || this.restoreHold?.activatedAt === null) return;
    await this.automaticStarts();
    if (this.stopping || this.dispatchPaused) return;
    const runs = (await this.store.transaction((tx) => tx.list('workflow_run'))) as Run[];
    for (const run of runs) {
      if (this.stopping || this.dispatchPaused) return;
      if (this.running.size >= this.settings.concurrency) break;
      if (
        this.running.has(run.id) ||
        this.heldByRestore(run.id) ||
        ![
          'queued',
          'waiting-inputs',
          'waiting-prerequisites',
          'review-submitted',
          'waiting-authorization',
          'publication-queued',
          'publication-reconciliation-queued',
        ].includes(run.data.status)
      )
        continue;
      if (run.data.status === 'waiting-inputs') {
        const missing = await this.store.transaction(async (tx) => {
          const missing = await this.intakeMissing(tx, run);
          const notification = await tx.get('notification', run.id);
          if (stable((notification?.data as any)?.fields ?? []) !== stable(missing))
            await tx.put('notification', {
              id: run.id,
              organization: run.organization,
              workItem: run.workItem,
              data: {
                run: run.id,
                fields: missing,
                resolved: missing.length === 0,
                message: missing.length
                  ? `Missing review prerequisites: ${missing.join(', ')}`
                  : 'Review prerequisites supplied',
              },
            });
          return missing;
        });
        if (missing.length) continue;
      }
      if (this.stopping || this.dispatchPaused) return;
      if (run.data.status === 'waiting-authorization') {
        if (run.data.workflow === 'review-finalization-v1') {
          if (!(await finalizationAuthorizationReady(this.store, run, this.owner))) continue;
        } else {
          const ready = await this.store.transaction(async (tx) => {
            const item = await tx.get('work_item', run.workItem);
            if (!item) return false;
            try {
              const caller = await executionCaller(tx, run);
              const transition = await authorization(
                tx,
                caller,
                'transition.request-review',
                scopeOf(item),
              );
              const generation = await authorization(tx, caller, 'review.generate', scopeOf(item));
              return !(
                (transition.requiresHuman && !run.data.requestApproval) ||
                (generation.requiresHuman && !generationApproved(run))
              );
            } catch (error: any) {
              if ([403, 404].includes(error.status)) return false;
              throw error;
            }
          });
          if (!ready) continue;
        }
      }
      if (this.stopping || this.dispatchPaused) return;
      const task = this.execute(run)
        .catch(async (error) => {
          if (run.data.status.startsWith('publication-')) return;
          const current = (await this.store.transaction((tx) =>
            tx.get('workflow_run', run.id),
          )) as Run;
          if (
            ![
              'completed',
              'superseded',
              'stopped',
              'cancelled',
              'rejected',
              'recovery-required',
            ].includes(current.data.status)
          )
            await this.update(run.id, 'waiting-prerequisites', (error as Error).message);
        })
        .finally(async () => {
          this.running.delete(run.id);
          this.controllers.delete(run.id);
          const current = (await this.store.transaction((tx) => tx.get('workflow_run', run.id))) as
            | Run
            | undefined;
          if (current && this.cancellationPending(current))
            await this.confirmRequestedCancellation(run.id, true);
        });
      this.running.set(run.id, task);
    }
  }
  private heldByRestore(id: string) {
    const disposition = this.restoreHold?.runs[id]?.disposition;
    return Boolean(disposition && !['resume', 'reconcile'].includes(disposition));
  }
  private async execute(run: Run) {
    const controller = new AbortController();
    this.controllers.set(run.id, controller);
    const current = (await this.store.transaction((tx) => tx.get('workflow_run', run.id))) as Run;
    if (run.data.status.startsWith('publication-')) {
      await this.publications.process(run.id, controller.signal);
      return;
    }
    if (this.cancellationPending(current)) return;
    const workflow = this.workflows[run.data.workflow];
    if (!workflow) {
      await this.update(run.id, 'recovery-required', 'Retained Workflow definition unavailable');
      return;
    }
    const snapshot = await workflow.getWorkflowRunById(run.id);
    const runtime = await workflow.createRun({ runId: run.id, resourceId: run.workItem });
    if (snapshot?.status === 'suspended' && run.data.workflow === 'review-intake-v1') {
      const result = await runtime.resume({
        step: 'required-facts',
        resumeData: { recheck: true },
      });
      if (result.status === 'failed')
        throw Error('Intake handoff failed; prerequisites require recheck');
    } else if (
      snapshot?.status === 'suspended' &&
      run.data.workflow === 'review-v1' &&
      run.data.decision
    ) {
      const result = await runtime.resume({ step: 'human-review', resumeData: { reviewed: true } });
      if (result.status === 'failed')
        throw Error('Review continuation requires authorization recheck');
    } else if (snapshot?.status === 'suspended' && run.data.workflow === 'review-finalization-v1') {
      const result = await runtime.resume({
        step: 'finalize-review',
        resumeData: { recheck: true },
      });
      if (result.status === 'failed') throw Error(finalizationWorkflowFailure(result));
    } else {
      const result = await runtime.start({ inputData: { run: run.id } });
      if (result.status === 'failed')
        throw Error(
          run.data.workflow === 'review-finalization-v1'
            ? finalizationWorkflowFailure(result)
            : 'Workflow failed; inspect execution evidence',
        );
    }
  }
  async close() {
    if (!this.ownsLock) return;
    this.stopping = true;
    for (const controller of this.controllers.values())
      controller.abort(new Error('Worker stopping'));
    await Promise.allSettled(this.running.values());
    await this.storage.close();
    await this.releaseOwner();
    await unlink(this.lock);
    this.ownsLock = false;
  }
}

/** Operator-only: requires independent verification that the lock's process stopped. */
export async function recoverWorkerLock(store: Store, directory: string, confirmedPid: number) {
  const path = join(resolve(directory), 'worker.lock');
  let lock: { pid: number } | undefined;
  try {
    lock = JSON.parse(await readFile(path, 'utf8'));
  } catch (e: any) {
    if (e.code !== 'ENOENT' && !(e instanceof SyntaxError)) throw e;
  }
  if (lock && lock.pid !== confirmedPid) throw Error('Recovery process identity mismatch');
  try {
    process.kill(confirmedPid, 0);
    throw Error('Previous worker is still running');
  } catch (e: any) {
    if (e.code !== 'ESRCH') throw e;
  }
  await store.transaction(async (tx) => {
    const owner = await tx.get('worker_owner', 'review');
    if (!owner && !lock)
      throw Error('Worker identity unavailable; restore verified ownership evidence');
    if (owner) {
      const data = owner.data as any;
      if (
        data.pid !== confirmedPid ||
        data.host !== hostname() ||
        data.directory !== resolve(directory)
      )
        throw Error('Database worker identity mismatch; recover on its original host and volume');
      await tx.remove('worker_owner', 'review');
    }
  });
  await unlink(path).catch((e: any) => {
    if (e.code !== 'ENOENT') throw e;
  });
  return { recovered: true, previousPid: confirmedPid };
}

export async function recoverStoppedRun(
  store: Store,
  directory: string,
  id: string,
  artifactDirectory?: string,
) {
  if (await store.transaction((tx) => tx.get('worker_owner', 'review')))
    throw Error('Stop installation worker before run recovery');
  try {
    await readFile(join(resolve(directory), 'worker.lock'));
    throw Error('Stop and recover the worker lock before run recovery');
  } catch (e: any) {
    if (e.code !== 'ENOENT') throw e;
  }
  const run = (await store.transaction((tx) => tx.get('workflow_run', id))) as Run | undefined;
  if (!run || !['recovery-required', 'running'].includes(run.data.status))
    throw Error('Run does not require stopped-execution recovery');
  await confirmSandboxStopped(run);
  if (!['review-intake-v1', 'review-v1', 'review-finalization-v1'].includes(run.data.workflow))
    throw Error('Retained Workflow definition unavailable');
  if (run.data.report) {
    if (!artifactDirectory)
      throw Error('Artifact directory required to reconcile completed report');
    const report = await store.transaction((tx) => tx.get('review_report', run.data.report!));
    const sourceRun = run.data.finalization?.reviewRun ?? run.id;
    if (
      !report ||
      report.run !== sourceRun ||
      report.organization !== run.organization ||
      report.workItem !== run.workItem
    )
      throw Error('Retained report metadata mismatch');
    await new ReviewArtifacts(artifactDirectory).verify(report.data as any);
  }
  return store.transaction(async (tx) => {
    if (await tx.get('worker_owner', 'review')) fail(409, 'Worker restarted during run recovery');
    const current = (await tx.get('workflow_run', id)) as Run;
    if (current.data.token !== run.data.token) fail(409, 'Recovery ownership changed');
    const calls = await tx.list('agent_call', 'run = $run', { run: id });
    let aiMs = current.data.aiMs;
    let uncertain = calls.some((call) => (call.data as any).outcome === 'uncertain');
    for (const call of calls)
      if ((call.data as any).outcome === 'reserved') {
        uncertain = true;
        const endedAt = Date.now(),
          elapsed = endedAt - (call.data as any).startedAt;
        aiMs += elapsed;
        await tx.put('agent_call', {
          ...call,
          data: {
            ...(call.data as object),
            outcome: 'uncertain',
            endedAt,
            elapsed,
            tokens: null,
            cost: null,
          },
        });
      }
    const cancellationPending =
      current.data.cancellation &&
      ['requested', 'awaiting-publication-resolution'].includes(current.data.cancellation.status);
    const confirmedAt = Date.now();
    const data = {
      ...current.data,
      status: cancellationPending ? 'cancelled' : !uncertain ? 'queued' : 'stopped',
      delegations: 0,
      aiMs,
      executionMs:
        current.data.executionMs +
        (current.data.activeSince ? Date.now() - current.data.activeSince : 0),
      activeSince: undefined,
      error: 'Interrupted execution confirmed stopped; uncertain model calls were not replayed',
      ...(cancellationPending
        ? {
            cancellation: {
              ...current.data.cancellation!,
              status: 'confirmed' as const,
              confirmedAt,
              evidence: { executionStopped: true, sandboxStopped: true, uncertainCalls: uncertain },
            },
          }
        : {}),
    };
    await tx.put('workflow_run', { ...current, data });
    if (cancellationPending)
      await terminalizeFinalizationRequest(tx, current, data.cancellation!.request);
    const item = await tx.get('work_item', current.workItem);
    if (item && (item.activeRun as any)?.id === id)
      await tx.put('work_item', {
        ...item,
        activeRun:
          data.status === 'queued' ? { id, workflow: data.workflow, status: 'queued' } : undefined,
      });
    if (cancellationPending) {
      const factId = digest(`workflow-cancellation-confirmed:${id}:${data.cancellation!.request}`);
      if (!(await tx.get('fact', factId)))
        await tx.create('fact', {
          id: factId,
          organization: current.organization,
          workItem: current.workItem,
          actor: 'operator',
          kind: 'workflow.cancellation-confirmed',
          recordedAt: confirmedAt,
          payload: {
            run: id,
            request: data.cancellation!.request,
            confirmedStopped: true,
            evidence: data.cancellation!.evidence,
          },
        });
    }
    await tx.create('audit', {
      id: randomUUID(),
      organization: current.organization,
      actor: 'operator',
      kind: 'workflow.stopped-recovery',
      resource: id,
      recordedAt: Date.now(),
      decision: { confirmedStopped: true, calls: current.data.calls, aiMs },
    });
    return { run: id, status: data.status, calls: current.data.calls };
  });
}
