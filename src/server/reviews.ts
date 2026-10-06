import { randomUUID } from 'node:crypto';
import { z } from 'zod';
import { authorization, authorized, visible } from './authorization';
import { digest, fail, identifier, stable, text } from './contracts';
import { type Caller } from './auth';
import { type Factory, type Operation } from './factory';
import { type Row, type Transaction } from './store';
import {
  publicationCanBeCorrected,
  publicationForRun,
  publicationView,
  type Publication,
} from './publications';
import { supportsReview } from './work-item-types';

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
export const reviewDecisionSchema = z.strictObject({
  operationId: identifier,
  run: identifier,
  reportVersion: identifier,
  reviewed: z.literal(true),
  findings: z
    .array(
      z.discriminatedUnion('decision', [
        z.strictObject({ finding: identifier, decision: z.literal('confirmed') }),
        z.strictObject({ finding: identifier, decision: z.literal('rejected'), reason: text }),
      ]),
    )
    .max(100),
  replaces: identifier.optional(),
});
export type RunData = {
  workflow: 'review-intake-v1' | 'review-v1';
  status: string;
  token: string;
  identity: { kind: 'user' | 'service'; user: string; credential?: string; activities?: string[] };
  brief: string;
  createdAt: number;
  inputs?: Record<string, any>;
  config?: Record<string, any>;
  approval?: { actor: string; binding: string; bindingVersion?: 1 | 2 };
  requestApproval?: unknown;
  cancellation?: {
    request: string;
    status: 'requested' | 'awaiting-publication-resolution' | 'confirmed' | 'completed-before-stop';
    requestedAt: number;
    confirmedAt?: number;
    evidence?: Record<string, unknown>;
  };
  report?: string;
  decision?: string;
  handoff?: string;
  publication?: string;
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
  if (!supportsReview(item.version))
    fail(409, 'Installed Review Workflow requires Work Item Type version 3, 4 or 5');
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
export const approvalBinding = (run: Run, version: 1 | 2 = 2) =>
  digest(
    stable({
      ...(version === 2
        ? { activity: 'review.generate', organization: run.organization, workItem: run.workItem }
        : {}),
      run: run.id,
      identity: run.data.identity,
      inputs: run.data.inputs,
      config: run.data.config,
    }),
  );

export function generationApproved(run: Run) {
  const approval = run.data.approval;
  if (!approval) return false;
  // Approvals persisted before binding versioning retain the original review-v1 formula.
  const version = approval.bindingVersion ?? 1;
  return (version === 1 || version === 2) && approval.binding === approvalBinding(run, version);
}

// Only the Workflow's declared inputs participate; unrelated Facts are admissible.
export async function reviewInputsCurrent(tx: Transaction, item: Row, inputs: Record<string, any>) {
  const current = await relevantFacts(tx, item);
  return (
    !current.missing.length &&
    item.repository === inputs.repository &&
    item.version === inputs.typeVersion &&
    stable(current.bindings) === stable(inputs.bindings) &&
    stable(current.fields) === stable(inputs.fields)
  );
}

export async function reportCurrent(tx: Transaction, item: Row, report: Row) {
  const reports = await tx.list(
    'review_report',
    'organization = $organization AND workItem = $workItem',
    { organization: item.organization, workItem: item.id },
  );
  const latest = reports.sort(
    (a, b) =>
      Number((b.data as any).createdAt) - Number((a.data as any).createdAt) ||
      b.id.localeCompare(a.id),
  )[0];
  return (
    latest?.id === report.id &&
    (await reviewInputsCurrent(tx, item, (report.data as any).relevantInputs))
  );
}

export async function decisionUsable(tx: Transaction, item: Row, run: Run | undefined, fact: Row) {
  const payload = fact.payload as any;
  const report = run?.data.report && (await tx.get('review_report', run.data.report));
  return (
    !!run &&
    !!report &&
    fact.kind === 'review.decision' &&
    fact.organization === item.organization &&
    fact.workItem === item.id &&
    payload.run === run.id &&
    payload.reportVersion === run.data.report &&
    run.data.decision === fact.id &&
    !['superseded', 'stopped', 'rejected'].includes(run.data.status) &&
    (await reportCurrent(tx, item, report))
  );
}

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
    const permitted = await authorized(tx, caller, 'artifact.read', scope)
      .then(() => true)
      .catch((e) => {
        if (e.status !== 403) throw e;
        return false;
      });
    const calls = await tx.list('agent_call', 'organization = $organization AND run IN $runs', {
      organization: item.organization,
      runs: runs.map((run) => run.id),
    });
    const decisions = await tx.list(
      'fact',
      'organization = $organization AND workItem = $workItem AND kind = $kind',
      { organization: item.organization, workItem: item.id, kind: 'review.decision' },
    );
    return {
      runs: runs.map(runView),
      publicationHistory: permitted
        ? (
            await tx.list('fact', 'organization = $organization AND workItem = $workItem', {
              organization: item.organization,
              workItem: item.id,
            })
          )
            .filter((fact) => String(fact.kind).startsWith('publication.'))
            .sort((a, b) => Number(a.recordedAt) - Number(b.recordedAt) || a.id.localeCompare(b.id))
        : [],
      publications: await Promise.all(
        (
          await tx.list(
            'external_activity',
            'organization = $organization AND workItem = $workItem',
            { organization: item.organization, workItem: item.id },
          )
        ).map(async (row) => ({
          ...publicationView(row),
          correctionAllowed: permitted && (await publicationCanBeCorrected(tx, row as Publication)),
        })),
      ),
      runStatus: await Promise.all(
        runs
          .filter((run) => (run.data as RunData).inputs)
          .map(async (run) => ({
            run: run.id,
            current: await reviewInputsCurrent(tx, item, (run.data as RunData).inputs!),
          })),
      ),
      reports: permitted ? reports.map(reportView) : [],
      reportStatus: permitted
        ? await Promise.all(
            reports.map(async (report) => ({
              report: report.id,
              current: await reportCurrent(tx, item, report),
            })),
          )
        : [],
      decisions: permitted
        ? await Promise.all(
            decisions.map(async (fact) => ({
              ...fact,
              usable: await decisionUsable(
                tx,
                item,
                runs.find((r) => r.id === (fact.payload as any).run) as Run,
                fact,
              ),
            })),
          )
        : [],
      consumption: calls.map((call) => {
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
  if (operation.action === 'review.cancel') {
    await authorized(tx, caller, 'workflow.cancel', scope);
    return factory.mutate(tx, caller, operation, input, async () => {
      if ((item.activeRun as any)?.id !== run.id)
        fail(409, 'Workflow Run no longer owns this Work Item');
      if (['completed', 'superseded', 'stopped', 'cancelled', 'rejected'].includes(run.data.status))
        fail(409, 'Workflow Run is already stopped');
      if (run.data.cancellation)
        fail(409, 'A Cancellation Request already exists for this Workflow Run');
      const fact = await factory.fact(tx, caller, item, 'workflow.cancellation-requested', {
        run: run.id,
        workflow: run.data.workflow,
        statusAtRequest: run.data.status,
        publication: run.data.publication ?? null,
      });
      const updated = {
        ...run,
        data: {
          ...run.data,
          cancellation: {
            request: fact.id,
            status: 'requested' as const,
            requestedAt: fact.recordedAt,
          },
        },
      };
      await tx.put('workflow_run', updated);
      return { workflowRun: runView(updated) };
    });
  }
  if (operation.action === 'review.decide') {
    if (!(await publicationCanBeCorrected(tx, await publicationForRun(tx, run))))
      fail(409, 'Publication already binds this Review Decision');
    if (!caller.human) fail(403, 'Human Review Decision required');
    await authorized(tx, caller, 'approval.review-decide', scope);
    await authorized(tx, caller, 'artifact.read', scope);
    return factory.mutate(tx, caller, operation, input, async () => {
      if (
        !['waiting-review', 'waiting-revalidation', 'completed'].includes(run.data.status) ||
        (run.data.status !== 'completed' && (item.activeRun as any)?.id !== run.id) ||
        (run.data.status === 'completed' && item.activeRun)
      )
        fail(409, 'Run is not available for human review');
      const report = await tx.get('review_report', input.reportVersion);
      if (
        !report ||
        report.organization !== item.organization ||
        report.workItem !== item.id ||
        report.run !== run.id ||
        run.data.report !== input.reportVersion ||
        (report.data as any).version !== input.reportVersion
      )
        fail(409, 'Review Decision report version mismatch');
      const data = report.data as any;
      if (!(await reportCurrent(tx, item, report)))
        fail(409, 'Relevant inputs changed; supersede this review and request a new report');
      const ids = new Set(input.findings.map((f: any) => f.finding));
      if (
        ids.size !== input.findings.length ||
        ids.size !== data.findings.length ||
        data.findings.some((f: any) => !ids.has(f.id))
      )
        fail(422, 'A decision for every Finding in this report version is required');
      if (input.replaces !== run.data.decision)
        fail(409, 'Review Decision replacement must identify the latest decision');
      const fact = await factory.fact(
        tx,
        caller,
        item,
        'review.decision',
        {
          run: run.id,
          reportVersion: input.reportVersion,
          approvalPoint: 'review.decide',
          relevantInputs: data.relevantInputs,
          reviewed: true,
          findings: input.findings,
          replaces: input.replaces ?? null,
        },
        input.replaces,
      );
      const status = run.data.status === 'completed' ? 'completed' : 'review-submitted';
      await tx.put('workflow_run', { ...run, data: { ...run.data, decision: fact.id, status } });
      if (item.activeRun)
        await tx.put('work_item', {
          ...item,
          activeRun: { id: run.id, workflow: run.data.workflow, status },
        });
      return { fact };
    });
  }
  if (operation.action === 'review.approve') {
    if (!caller.human) fail(403, 'Browser Approval required');
    await authorized(tx, caller, 'approval.review-generate', scope);
    return factory.mutate(tx, caller, operation, input, async () => {
      if (run.data.status !== 'waiting-approval') fail(409, 'Run is not awaiting Approval');
      if (!(await reviewInputsCurrent(tx, item, run.data.inputs!)))
        fail(409, 'Relevant inputs changed; supersede this review and request a new report');
      const approval = {
        actor: caller.user,
        binding: approvalBinding(run),
        bindingVersion: 2 as const,
      };
      await factory.fact(tx, caller, item, 'activity.approved', {
        run: run.id,
        activity: 'review.generate',
        relevantInputs: run.data.inputs,
        ...approval,
      });
      await tx.put('workflow_run', { ...run, data: { ...run.data, approval, status: 'queued' } });
      return { approved: true };
    });
  }
  if (operation.action === 'review.supersede') {
    await authorized(tx, caller, 'review.supersede', scope);
    return factory.mutate(tx, caller, operation, input, async () => {
      if (
        ![
          'waiting-review',
          'waiting-approval',
          'waiting-revalidation',
          'waiting-authorization',
        ].includes(run.data.status) ||
        (item.activeRun as any)?.id !== run.id
      )
        fail(409, 'Only a stopped human-review wait can be superseded');
      // These waits have no active model/tool execution; report waits follow container stop.
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
