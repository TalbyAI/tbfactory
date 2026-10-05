import { randomUUID } from 'node:crypto';
import { z } from 'zod';
import { authorization, authorized, visible } from './authorization';
import { digest, fail, identifier, stable, text } from './contracts';
import { type Caller } from './auth';
import { type Factory, type Operation } from './factory';
import { type Row, type Transaction } from './store';

export const reviewFields = z.strictObject({
  sourceBranch: z.string().min(1).max(300).optional(),
  targetBranch: z.string().min(1).max(300).optional(),
  sourceCommit: z
    .string()
    .regex(/^(?:[a-f0-9]{40}|[a-f0-9]{64})$/)
    .optional(),
  targetCommit: z
    .string()
    .regex(/^(?:[a-f0-9]{40}|[a-f0-9]{64})$/)
    .optional(),
  sourceUrl: z.url().max(2000).optional(),
  draft: z.boolean().optional(),
});
export const reviewFactsSchema = z.strictObject({ operationId: identifier, fields: reviewFields });
export const reviewActionSchema = z.strictObject({ operationId: identifier, run: identifier });
export type RunData = {
  workflow: 'review-intake-v1' | 'review-v1';
  status: string;
  token: string;
  identity: { kind: 'user' | 'service'; user: string; credential?: string; activities?: string[] };
  brief: string;
  createdAt: number;
  inputs?: Record<string, any>;
  config?: Record<string, any>;
  approval?: { actor: string; binding: string };
  requestApproval?: unknown;
  report?: string;
  handoff?: string;
  error?: string;
  sandbox?: Record<string, any>;
  calls: number;
  aiMs: number;
  executionMs: number;
  activeSince?: number;
  delegations?: number;
  preparedReport?: Record<string, any>;
};
export type Run = Row & { organization: string; workItem: string; data: RunData };
export const runView = (run: Row) => {
  const {
    token: _token,
    config: _config,
    preparedReport: _prepared,
    ...data
  } = run.data as RunData;
  return { id: run.id, organization: run.organization, workItem: run.workItem, ...data };
};
export const scopeOf = (item: Row) => ({
  organization: String(item.organization),
  project: String(item.project),
  repository: item.repository as string | undefined,
});

export async function relevantFacts(tx: Transaction, item: Row) {
  const facts = (
    await tx.list('fact', 'organization = $organization AND workItem = $workItem', {
      organization: item.organization,
      workItem: item.id,
    })
  ).sort((a, b) => Number(a.recordedAt) - Number(b.recordedAt) || a.id.localeCompare(b.id));
  const fields: Record<string, any> = {};
  const bindings: Record<string, string> = {};
  for (const fact of facts) {
    const values =
      fact.kind === 'review.inputs'
        ? (fact.payload as any).fields
        : fact.kind === 'external.observation'
          ? {
              sourceBranch: (fact.payload as any).sourceBranch,
              targetBranch: (fact.payload as any).targetBranch,
              sourceCommit: (fact.payload as any).head,
              targetCommit: (fact.payload as any).base,
              sourceUrl: (fact.payload as any).sourceUrl,
              draft: (fact.payload as any).draft,
            }
          : {};
    for (const [name, value] of Object.entries(values))
      if (value !== undefined && value !== null) {
        fields[name] = value;
        bindings[name] = fact.id;
      }
  }
  const missing = ['sourceBranch', 'targetBranch', 'sourceCommit', 'targetCommit'].filter(
    (name) => !fields[name],
  );
  if (!item.repository) missing.unshift('Repository');
  return {
    fields,
    bindings,
    missing,
    cause: facts
      .filter((f) => ['review.inputs', 'external.observation'].includes(String(f.kind)))
      .at(-1),
  };
}

export async function refreshNotification(tx: Transaction, item: Row, run: Run) {
  const inputs = await relevantFacts(tx, item);
  await tx.put('notification', {
    id: run.id,
    organization: item.organization,
    workItem: item.id,
    data: {
      run: run.id,
      fields: inputs.missing,
      resolved: inputs.missing.length === 0,
      message: inputs.missing.length
        ? `Missing review fields: ${inputs.missing.join(', ')}`
        : 'Required review fields supplied',
    },
  });
  return inputs;
}
export async function acceptIntake(
  factory: Factory,
  tx: Transaction,
  caller: Caller,
  item: Row,
  brief: string,
  requestApproval?: unknown,
  kind: 'user' | 'service' = caller.service ? 'service' : 'user',
) {
  if (item.version !== 3) fail(409, 'Installed Review Workflow requires Work Item Type version 3');
  if (item.activeRun) fail(409, 'An active Workflow Run owns this Work Item');
  const run: Run = {
    id: randomUUID(),
    organization: String(item.organization),
    workItem: item.id,
    data: {
      workflow: 'review-intake-v1',
      status: 'queued',
      token: randomUUID(),
      identity: {
        kind,
        user: caller.user,
        credential: caller.credential,
        activities: caller.activities,
      },
      brief: text.parse(brief),
      createdAt: Date.now(),
      requestApproval,
      calls: 0,
      aiMs: 0,
      executionMs: 0,
    },
  };
  await tx.create('workflow_run', run);
  const updated = await tx.put('work_item', {
    ...item,
    activeRun: { id: run.id, workflow: run.data.workflow, status: run.data.status },
  });
  await refreshNotification(tx, updated, run);
  await factory.fact(tx, caller, item, 'workflow.accepted', {
    run: run.id,
    workflow: run.data.workflow,
    executionIdentity: run.data.identity,
  });
  return { workflowRun: runView(run), workItem: updated };
}
export async function executionCaller(tx: Transaction, run: Run): Promise<Caller> {
  const identity = run.data.identity;
  const caller: Caller = {
    user: identity.user,
    human: false,
    organization: run.organization,
    credential: identity.credential,
    activities: identity.activities,
  };
  await visible(tx, caller, run.organization);
  if (identity.credential) {
    const credential = await tx.get('credential', identity.credential);
    if (
      !credential ||
      credential.user !== identity.user ||
      credential.organization !== run.organization ||
      credential.revoked ||
      Number(credential.expiresAt) <= Date.now()
    )
      fail(403, 'Execution credential unavailable');
    caller.activities = credential.activities as string[];
  }
  return caller;
}
export const approvalBinding = (run: Run) =>
  digest(
    stable({
      run: run.id,
      identity: run.data.identity,
      inputs: run.data.inputs,
      config: run.data.config,
    }),
  );

export async function reviewOperation(
  factory: Factory,
  tx: Transaction,
  caller: Caller,
  operation: Operation,
  input: any,
  item: Row,
) {
  const scope = scopeOf(item);
  await authorized(tx, caller, 'work-item.read', scope);
  if (operation.action === 'review.list') {
    await authorized(tx, caller, 'workflow.read', scope);
    const runs = await tx.list(
      'workflow_run',
      'organization = $organization AND workItem = $workItem',
      { organization: item.organization, workItem: item.id },
    );
    const reports = await tx.list(
      'review_report',
      'organization = $organization AND workItem = $workItem',
      { organization: item.organization, workItem: item.id },
    );
    const notifications = await tx.list(
      'notification',
      'organization = $organization AND workItem = $workItem',
      { organization: item.organization, workItem: item.id },
    );
    const permitted = await authorization(tx, caller, 'artifact.read', scope)
      .then(() => true)
      .catch((e) => {
        if (e.status !== 403) throw e;
        return false;
      });
    const calls = await tx.list('agent_call', 'organization = $organization', {
      organization: item.organization,
    });
    const ids = new Set(runs.map((run) => run.id));
    return {
      runs: runs.map(runView),
      reports: permitted ? reports.map(reportView) : [],
      consumption: calls
        .filter((call) => ids.has(String(call.run)))
        .map((call) => {
          const { chunks: _chunks, result: _result, ...data } = call.data as any;
          return { id: call.id, run: call.run, ...data };
        }),
      notifications: notifications.map((n) => ({ id: n.id, ...(n.data as object) })),
      currentInputs: (await relevantFacts(tx, item)).fields,
    };
  }
  if (operation.action === 'review.facts') {
    await authorized(tx, caller, 'review.facts', scope);
    return factory.mutate(tx, caller, operation, input, async () => {
      const previous = await tx.list(
        'fact',
        'organization = $organization AND workItem = $workItem',
        { organization: item.organization, workItem: item.id },
      );
      const fact = await factory.fact(tx, caller, item, 'review.inputs', { fields: input.fields });
      // Strict causal order even when observations used a monotonic timestamp.
      await tx.put('fact', {
        ...fact,
        recordedAt: Math.max(Date.now(), ...previous.map((f) => Number(f.recordedAt) + 1)),
      });
      if (item.activeRun) {
        const run = (await tx.get('workflow_run', (item.activeRun as any).id)) as Run | undefined;
        if (run?.data.workflow === 'review-intake-v1') await refreshNotification(tx, item, run);
      }
      return { fact };
    });
  }
  const run = (await tx.get('workflow_run', input.run)) as Run | undefined;
  if (!run || run.organization !== item.organization || run.workItem !== item.id)
    fail(404, 'Resource not found');
  if (operation.action === 'review.approve') {
    if (!caller.human) fail(403, 'Browser Approval required');
    await authorized(tx, caller, 'approval.review-generate', scope);
    return factory.mutate(tx, caller, operation, input, async () => {
      if (run.data.status !== 'waiting-approval') fail(409, 'Run is not awaiting Approval');
      const approval = { actor: caller.user, binding: approvalBinding(run) };
      await factory.fact(tx, caller, item, 'activity.approved', {
        run: run.id,
        activity: 'review.generate',
        ...approval,
      });
      await tx.put('workflow_run', { ...run, data: { ...run.data, approval, status: 'queued' } });
      return { approved: true };
    });
  }
  if (operation.action === 'review.supersede') {
    await authorized(tx, caller, 'review.supersede', scope);
    return factory.mutate(tx, caller, operation, input, async () => {
      if (run.data.status !== 'waiting-review' || (item.activeRun as any)?.id !== run.id)
        fail(409, 'Only a stopped human-review wait can be superseded');
      // Worker enters waiting-review only after all model/tool work and container stop.
      await tx.put('workflow_run', { ...run, data: { ...run.data, status: 'superseded' } });
      await tx.put('work_item', { ...item, activeRun: undefined });
      await factory.fact(tx, caller, item, 'review.superseded', {
        run: run.id,
        report: run.data.report,
        publication: false,
      });
      return { superseded: true };
    });
  }
  fail(404, 'Resource not found');
}
export const reportView = (report: Row) => {
  const { storageKey: _storageKey, ...data } = report.data as Record<string, any>;
  return { id: report.id, run: report.run, ...data };
};
