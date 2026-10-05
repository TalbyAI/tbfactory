import { randomUUID } from 'node:crypto';
import { z } from 'zod';
import { digest, fail, identifier, stable } from './contracts';
import { authorization, authorized, type Scope } from './authorization';
import { page } from './factory';
import { itemDefinition, transitionIds, transitionInputs } from './work-item-types';
import { type Caller } from './auth';
import { type Factory, type Operation } from './factory';
import { type Row, type Transaction } from './store';
import { acceptIntake } from './reviews';

export const transitionRequestSchema = z
  .strictObject({
    operationId: identifier,
    transition: z.enum(transitionIds),
    expectedState: identifier,
    version: z.number().int().positive(),
    inputs: z.record(z.string(), z.unknown()),
  })
  .transform((input) => ({
    ...input,
    inputs: transitionInputs[input.transition].parse(input.inputs),
  }));
export const requestActionSchema = z.strictObject({ operationId: identifier });
export async function boardItem(tx: Transaction, caller: Caller, item: Row) {
  const scope = {
    organization: String(item.organization),
    project: String(item.project),
    repository: item.repository as string | undefined,
  };
  const facts = await tx.list(
    'fact',
    'organization = $organization AND workItem = $workItem AND kind = $kind',
    { organization: item.organization, workItem: item.id, kind: 'state.transition' },
  );
  const current = facts.find((fact) => (fact.payload as any).sequence === item.transitionSequence);
  const transitions = [];
  for (const transition of itemDefinition(item).transitions.filter((t) => t.from === item.state)) {
    let reason: string | null = item.activeRun
      ? 'Active Workflow Run'
      : transition.handling === 'workflow' &&
          !(item.version === 3 && transition.id === 'request-review')
        ? 'Workflow not installed'
        : null;
    let requiresApproval = false;
    try {
      requiresApproval = (await authorization(tx, caller, `transition.${transition.id}`, scope))
        .requiresHuman;
    } catch (error) {
      if ((error as { status: number }).status !== 403) throw error;
      reason = 'Activity denied';
    }
    if (!reason && transition.inputs.some((name) => name.endsWith('Fact')) && !current)
      reason = 'Confirmed prerequisite Fact required';
    transitions.push({ ...transition, available: !reason, reason, requiresApproval });
  }
  return {
    ...item,
    workflowRun: item.activeRun ?? null,
    readinessFact: current?.id ?? null,
    transitions,
  };
}
const approvalBinding = (request: Row) =>
  digest(
    stable({
      workItem: request.workItem,
      organization: request.organization,
      user: request.user,
      credential: request.credential,
      transition: request.transition,
      expectedState: request.expectedState,
      version: request.version,
      sequence: request.sequence,
      inputs: request.inputs,
    }),
  );

async function validateRequest(tx: Transaction, item: Row, request: Row) {
  const transition = itemDefinition(item).transitions.find(
    (t) => t.id === request.transition && t.from === item.state,
  );
  if (
    !transition ||
    transition.from !== item.state ||
    request.expectedState !== item.state ||
    request.version !== item.version ||
    request.sequence !== (item.transitionSequence ?? 0)
  )
    fail(409, 'Transition Request no longer matches Factory state');
  if (item.activeRun) fail(409, 'An active Workflow Run owns this Work Item');
  if (
    transition.handling === 'workflow' &&
    !(item.version === 3 && transition.id === 'request-review')
  )
    fail(409, 'Workflow not installed');
  const inputs = request.inputs as Record<string, string>;
  const prerequisite = inputs.readinessFact ?? inputs.finalizationFact;
  if (prerequisite) {
    const fact = await tx.get('fact', prerequisite);
    const payload = fact?.payload as Record<string, unknown> | undefined;
    const allowed =
      request.transition === 'withdraw-review'
        ? ['prepare-review', 'reopen-review']
        : ['finalize-review'];
    if (
      !fact ||
      fact.organization !== item.organization ||
      fact.workItem !== item.id ||
      fact.kind !== 'state.transition' ||
      !allowed.includes(String(payload?.transition)) ||
      payload?.to !== item.state ||
      payload?.sequence !== item.transitionSequence ||
      payload?.version !== item.version
    )
      fail(409, 'Confirmed prerequisite Fact required');
  }
  return transition;
}

async function complete(
  factory: Factory,
  tx: Transaction,
  caller: Caller,
  item: Row,
  request: Row,
) {
  const transition = await validateRequest(tx, item, request);
  if (transition.handling === 'workflow') {
    const result = await acceptIntake(
      factory,
      tx,
      caller,
      item,
      String((request.inputs as any).reviewBrief),
      request.approval,
    );
    const completed = await tx.put('transition_request', {
      ...request,
      status: 'completed',
      result,
    });
    return { accepted: true, completed: false, request: completed, ...result };
  }
  const sequence = Number(item.transitionSequence ?? 0) + 1;
  const workItem = await tx.put('work_item', {
    ...item,
    state: transition.to,
    transitionSequence: sequence,
  });
  const fact = await factory.fact(tx, caller, item, 'state.transition', {
    request: request.id,
    transition: transition.id,
    from: item.state,
    to: transition.to,
    version: item.version,
    sequence,
    executionIdentity: { kind: 'user', user: request.user, organization: item.organization },
    inputs: request.inputs,
    approval: request.approval ?? null,
  });
  const completed = await tx.put('transition_request', {
    ...request,
    status: 'completed',
    result: { workItem, fact },
  });
  return { accepted: true, completed: true, request: completed, workItem, fact };
}

export async function transitionOperation(
  factory: Factory,
  tx: Transaction,
  caller: Caller,
  operation: Operation,
  input: any,
  item: Row,
  scope: Scope,
  query: { limit: number; cursor?: string },
) {
  if (operation.action === 'transition.list') {
    await authorized(tx, caller, 'work-item.read', scope);
    return page(
      await tx.list('transition_request', 'organization = $organization AND workItem = $workItem', {
        organization: scope.organization,
        workItem: item.id,
      }),
      query,
    );
  }
  if (operation.action !== 'transition.request') {
    const request = await tx.get('transition_request', operation.request!);
    if (!request || request.organization !== scope.organization || request.workItem !== item.id)
      fail(404, 'Resource not found');
    if (operation.action === 'transition.approve') {
      if (!caller.human) fail(403, 'Browser Approval required');
      await authorized(tx, caller, `approval.${request.transition}`, scope);
      return factory.mutate(tx, caller, operation, input, async () => {
        await validateRequest(tx, item, request);
        if (!['pending-approval', 'approved'].includes(String(request.status)))
          fail(409, 'Request is not awaiting Approval');
        if (request.status === 'approved') return { request };
        const fact = await factory.fact(tx, caller, item, 'activity.approved', {
          request: request.id,
          activity: `transition.${request.transition}`,
          binding: approvalBinding(request),
          inputs: request.inputs,
          version: request.version,
          executionIdentity: {
            kind: 'user',
            user: request.user,
            organization: request.organization,
          },
        });
        const approval = { fact: fact.id, actor: caller.user, binding: approvalBinding(request) };
        return {
          request: await tx.put('transition_request', { ...request, status: 'approved', approval }),
          fact,
        };
      });
    }
    if (operation.action !== 'transition.execute') fail(404, 'Resource not found');
    if (
      request.user !== caller.user ||
      (request.credential && request.credential !== caller.credential)
    )
      fail(403, 'Original Execution Identity required');
    await authorization(tx, caller, `transition.${request.transition}`, scope);
    return factory.mutate(tx, caller, operation, input, async () => {
      if (request.status === 'completed')
        return { accepted: true, completed: true, request, ...(request.result as object) };
      const approval = request.approval as { binding: string } | undefined;
      if (
        request.status !== 'approved' ||
        !approval ||
        approval.binding !== approvalBinding(request)
      )
        fail(409, 'Activity-bound Approval required');
      // The permission check above is inside the same transaction as the state write.
      return complete(factory, tx, caller, item, request);
    });
  }
  const permission = await authorization(tx, caller, `transition.${input.transition}`, scope);
  return factory.mutate(tx, caller, operation, input, async () => {
    const request: Row = {
      id: randomUUID(),
      organization: scope.organization,
      workItem: item.id,
      user: caller.user,
      credential: caller.credential,
      transition: input.transition,
      expectedState: input.expectedState,
      version: input.version,
      sequence: item.transitionSequence ?? 0,
      inputs: input.inputs,
      status: permission.requiresHuman ? 'pending-approval' : 'accepted',
      createdAt: Date.now(),
    };
    await validateRequest(tx, item, request);
    await tx.create('transition_request', request);
    await factory.fact(tx, caller, item, 'transition.requested', {
      request: request.id,
      transition: request.transition,
      inputs: request.inputs,
      version: request.version,
    });
    return permission.requiresHuman
      ? { accepted: true, completed: false, request, workItem: item }
      : complete(factory, tx, caller, item, request);
  });
}
