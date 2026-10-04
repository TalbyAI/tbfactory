import { test } from 'node:test';
import assert from 'node:assert/strict';
import { fixture } from './support/factory.ts';
import { Surreal } from 'surrealdb';
import { provision } from '../src/server/provision.ts';

test('Default deny, inherited Team grants, and stale Approval hold across lifecycle cycles', async () => {
  const f = await fixture();
  try {
    const path = await reviewItem(f);
    const reviewer = await f.login('reviewer');
    await provision(f.store, {
      organization: { id: 'alpha', name: 'Alpha' },
      projects: [],
      members: [
        {
          issuer: f.op.issuer,
          subject: 'reviewer',
          grants: [
            {
              activity: 'work-item.read',
              scope: 'organization',
              scopeId: 'alpha',
              effect: 'allow',
            },
          ],
        },
      ],
    });
    const base = '/api/organizations/alpha';
    const input = {
      operationId: 'denied',
      transition: 'prepare-review',
      expectedState: 'registered',
      version: 2,
      inputs: { reviewBrief: 'Inherited grant' },
    };
    assert.equal(
      (await f.request(`${path}/transition-requests`, input, reviewer.token)).status,
      403,
    );
    const team = await f.request(`${base}/teams`, {
      operationId: 'team',
      name: 'Across Projects',
      members: [reviewer.user.id],
    });
    await f.request(`${base}/policies`, {
      operationId: 'team-grant',
      team: team.body.team.id,
      activity: 'transition.prepare-review',
      scope: 'organization',
      scopeId: 'alpha',
      effect: 'allow',
    });
    await f.request(`${base}/policies`, {
      operationId: 'team-human',
      team: team.body.team.id,
      activity: 'transition.prepare-review',
      scope: 'team',
      scopeId: team.body.team.id,
      effect: 'human',
    });
    const pending = await f.request(`${path}/transition-requests`, input, reviewer.token);
    assert.equal(pending.body.completed, false);
    const requestPath = `${path}/transition-requests/${pending.body.request.id}`;
    assert.equal(
      (
        await f.request(
          `${requestPath}/approve`,
          { operationId: 'no-approval-grant' },
          reviewer.token,
        )
      ).status,
      403,
    );
    await f.request(`${requestPath}/approve`, { operationId: 'operator-approval' });
    const moved = await f.request(`${path}/transition-requests`, {
      ...input,
      operationId: 'operator-prepare',
    });
    await f.request(`${path}/transition-requests`, {
      operationId: 'operator-withdraw',
      transition: 'withdraw-review',
      expectedState: 'ready-for-review',
      version: 2,
      inputs: { reason: 'Lifecycle cycled', readinessFact: moved.body.fact.id },
    });
    assert.equal((await f.request(path)).body.state, 'registered');
    assert.equal(
      (await f.request(`${requestPath}/execute`, { operationId: 'stale-approval' }, reviewer.token))
        .status,
      409,
    );
    assert.equal(
      (await f.request(`${base}/board?type=pull-request-review`, undefined, reviewer.token)).body
        .items[0].transitions[0].requiresApproval,
      true,
    );
    await f.request(`${base}/teams/${team.body.team.id}`, {
      operationId: 'remove-member',
      name: 'Across Projects',
      members: [],
    });
    assert.equal(
      (
        await f.request(
          `${path}/transition-requests`,
          { ...input, operationId: 'removed-member' },
          reviewer.token,
        )
      ).status,
      403,
    );
  } finally {
    await f.close();
  }
});

test('A retained successful finalization can be reopened, while fabricated and superseded Facts cannot', async () => {
  const f = await fixture();
  try {
    const path = await reviewItem(f);
    const id = path.split('/').at(-1)!;
    // Seed the external future Workflow boundary; observe reopening only through public operations.
    await f.store.transaction(async (tx) => {
      const item = (await tx.get('work_item', id))!;
      await tx.put('work_item', { ...item, state: 'completed', transitionSequence: 1 });
      await tx.create('fact', {
        id: 'finalized',
        organization: 'alpha',
        workItem: id,
        kind: 'state.transition',
        actor: f.alice.user.id,
        recordedAt: Date.now(),
        payload: {
          transition: 'finalize-review',
          from: 'ready-for-review',
          to: 'completed',
          version: 2,
          sequence: 1,
        },
      });
    });
    const input = {
      operationId: 'reopen',
      transition: 'reopen-review',
      expectedState: 'completed',
      version: 2,
      inputs: {
        reason: 'New code',
        reviewBrief: 'Recheck security',
        finalizationFact: 'finalized',
      },
    };
    assert.equal(
      (
        await f.request(`${path}/transition-requests`, {
          ...input,
          inputs: { ...input.inputs, finalizationFact: 'invented' },
        })
      ).status,
      409,
    );
    const reopened = await f.request(`${path}/transition-requests`, input);
    assert.equal(reopened.status, 200);
    assert.equal(reopened.body.workItem.state, 'ready-for-review');
    assert.equal(
      (
        await f.request(`${path}/transition-requests`, {
          operationId: 'withdraw-reopened',
          transition: 'withdraw-review',
          expectedState: 'ready-for-review',
          version: 2,
          inputs: { reason: 'Revise', readinessFact: reopened.body.fact.id },
        })
      ).status,
      200,
    );
  } finally {
    await f.close();
  }
});

test('Interrupted transition persistence rolls back state and history; concurrent retry records one successful transition', async () => {
  const f = await fixture();
  const database = new Surreal();
  try {
    const path = await reviewItem(f);
    await database.connect(f.config.url);
    await database.signin({ username: f.config.username, password: f.config.password });
    await database.use({ namespace: f.config.namespace, database: f.config.database });
    await database.query(
      `DEFINE EVENT interrupt_transition ON fact WHEN $event = 'CREATE' AND $after.kind = 'state.transition' THEN { THROW 'Injected persistence interruption'; };`,
    );
    const input = {
      operationId: 'atomic',
      transition: 'prepare-review',
      expectedState: 'registered',
      version: 2,
      inputs: { reviewBrief: 'Atomic review' },
    };
    assert.equal((await f.request(`${path}/transition-requests`, input)).status, 500);
    assert.equal((await f.request(path)).body.state, 'registered');
    assert.deepEqual((await f.request(`${path}/transition-requests`)).body.items, []);
    assert.equal((await f.request(`${path}/facts`)).body.items.length, 1);
    await database.query('REMOVE EVENT interrupt_transition ON fact;');
    const responses = await Promise.all(
      Array.from({ length: 6 }, () => f.request(`${path}/transition-requests`, input)),
    );
    assert.ok(responses.every((response) => response.status === 200));
    assert.ok(responses.every((response) => response.body.fact.id === responses[0].body.fact.id));
    assert.equal(
      (await f.request(`${path}/facts`)).body.items.filter(
        (fact: any) => fact.kind === 'state.transition',
      ).length,
      1,
    );
    assert.equal(
      (await f.request(`${path}/transition-requests`, { ...input, operationId: 'competitor' }))
        .status,
      409,
    );
  } finally {
    await database.close();
    await f.close();
  }
});

test('Bearer requests wait for browser Approval; stale requests and active runs cannot execute, and Workflows stay unavailable', async () => {
  const f = await fixture();
  try {
    const path = await reviewItem(f);
    const base = '/api/organizations/alpha';
    const human = await f.request(`${base}/policies`, {
      operationId: 'human',
      user: f.alice.user.id,
      activity: 'transition.prepare-review',
      scope: 'organization',
      scopeId: 'alpha',
      effect: 'human',
    });
    const credential = await f.request(`${base}/api-credentials`, {
      operationId: 'api',
      label: 'Execution',
      activities: ['transition.prepare-review', 'approval.prepare-review'],
      expiresAt: Date.now() + 3600000,
    });
    const input = {
      operationId: 'bearer',
      transition: 'prepare-review',
      expectedState: 'registered',
      version: 2,
      inputs: { reviewBrief: 'Approval bound to token' },
    };
    const pending = await f.request(
      `${path}/transition-requests`,
      input,
      credential.body.token,
      true,
    );
    assert.equal(pending.status, 200);
    assert.equal(pending.body.completed, false);
    const requestPath = `${path}/transition-requests/${pending.body.request.id}`;
    assert.equal(
      (
        await f.request(
          `${requestPath}/approve`,
          { operationId: 'api-approval' },
          credential.body.token,
          true,
        )
      ).status,
      403,
    );
    assert.equal(
      (await f.request(`${requestPath}/approve`, { operationId: 'browser-approval' })).status,
      200,
    );
    assert.equal(
      (await f.request(`${requestPath}/execute`, { operationId: 'switch-identity' })).status,
      403,
    );
    assert.equal(
      (
        await f.request(
          `${requestPath}/execute`,
          { operationId: 'api-execution' },
          credential.body.token,
          true,
        )
      ).status,
      200,
    );
    assert.equal(
      (
        await f.request(`${path}/transition-requests`, {
          operationId: 'workflow',
          transition: 'request-review',
          expectedState: 'ready-for-review',
          version: 2,
          inputs: { reviewBrief: 'Run review' },
        })
      ).status,
      409,
    );
    const board = await f.request(`${base}/board?type=pull-request-review`);
    assert.equal(board.body.items[0].workflowRun, null);
    assert.equal(
      board.body.items[0].transitions.find((t: any) => t.id === 'request-review').reason,
      'Workflow not installed',
    );
    await f.request(`${base}/policies/${human.body.policy.id}/remove`, {
      operationId: 'remove-human',
    });
    const readiness = (await f.request(`${path}/facts`)).body.items.find(
      (fact: any) => fact.kind === 'state.transition',
    );
    await f.request(`${path}/transition-requests`, {
      operationId: 'withdraw',
      transition: 'withdraw-review',
      expectedState: 'ready-for-review',
      version: 2,
      inputs: { reason: 'Restart', readinessFact: readiness.id },
    });
    await f.store.transaction(async (tx) => {
      const item = (await tx.get('work_item', path.split('/').at(-1)!))!;
      await tx.put('work_item', {
        ...item,
        activeRun: { id: 'retained-run', executionState: 'suspended' },
      });
    });
    assert.equal(
      (await f.request(`${path}/transition-requests`, { ...input, operationId: 'active-run' }))
        .status,
      409,
    );
    assert.equal(
      (
        await f.request(`${path}/notes`, {
          operationId: 'during-run',
          text: 'Facts remain available',
        })
      ).status,
      200,
    );
    assert.equal(
      (await f.request(`${base}/board?type=pull-request-review`)).body.items[0].workflowRun
        .executionState,
      'suspended',
    );
  } finally {
    await f.close();
  }
});

test('Activity-bound Approval is separate authority, cannot cross Organizations, and cannot preserve revoked execution permission', async () => {
  const f = await fixture();
  try {
    const path = await reviewItem(f);
    await f.bootstrap('beta', ['bob']);
    const bob = await f.login('bob');
    const base = '/api/organizations/alpha';
    await f.request(`${base}/policies`, {
      operationId: 'human',
      user: f.alice.user.id,
      activity: 'transition.prepare-review',
      scope: 'project',
      scopeId: 'alpha-project',
      effect: 'human',
    });
    const pending = await f.request(`${path}/transition-requests`, {
      operationId: 'pending',
      transition: 'prepare-review',
      expectedState: 'registered',
      version: 2,
      inputs: { reviewBrief: 'Human permission checkpoint' },
    });
    assert.equal(pending.status, 200);
    assert.equal(pending.body.completed, false);
    assert.equal(pending.body.request.status, 'pending-approval');
    assert.equal((await f.request(path)).body.state, 'registered');
    const requestPath = `${path}/transition-requests/${pending.body.request.id}`;
    assert.equal(
      (await f.request(`${requestPath}/execute`, { operationId: 'too-early' })).status,
      409,
    );
    assert.equal(
      (await f.request(`${requestPath}/approve`, { operationId: 'foreign' }, bob.token)).status,
      404,
    );
    const approvalDeny = await f.request(`${base}/policies`, {
      operationId: 'approval-deny',
      user: f.alice.user.id,
      activity: 'approval.prepare-review',
      scope: 'organization',
      scopeId: 'alpha',
      effect: 'deny',
    });
    assert.equal(
      (await f.request(`${requestPath}/approve`, { operationId: 'no-authority' })).status,
      403,
    );
    await f.request(`${base}/policies/${approvalDeny.body.policy.id}/remove`, {
      operationId: 'restore-approval',
    });
    assert.equal(
      (await f.request(`${requestPath}/approve`, { operationId: 'approve' })).status,
      200,
    );
    const executionDeny = await f.request(`${base}/policies`, {
      operationId: 'execution-deny',
      user: f.alice.user.id,
      activity: 'transition.prepare-review',
      scope: 'repository',
      scopeId: 'alpha-repo',
      effect: 'deny',
    });
    // This Work Item has no Repository; a Project prohibition is the applicable one.
    const applicableDeny = await f.request(`${base}/policies`, {
      operationId: 'project-deny',
      user: f.alice.user.id,
      activity: 'transition.prepare-review',
      scope: 'project',
      scopeId: 'alpha-project',
      effect: 'deny',
    });
    assert.equal(executionDeny.status, 200);
    assert.equal(
      (await f.request(`${requestPath}/execute`, { operationId: 'revoked' })).status,
      403,
    );
    assert.equal((await f.request(path)).body.state, 'registered');
    await f.request(`${base}/policies/${applicableDeny.body.policy.id}/remove`, {
      operationId: 'restore-execution',
    });
    await f.request(`${path}/notes`, {
      operationId: 'unrelated',
      text: 'Does not invalidate Approval',
    });
    const completed = await f.request(`${requestPath}/execute`, { operationId: 'execute' });
    assert.equal(completed.status, 200);
    assert.equal(completed.body.completed, true);
    assert.equal(completed.body.fact.payload.approval.actor, f.alice.user.id);
    assert.equal(
      (await f.request(`${requestPath}/execute`, { operationId: 'execute-again' })).body.fact.id,
      completed.body.fact.id,
    );
  } finally {
    await f.close();
  }
});

test('Every Team applies across Projects, prohibitions prevail, and foreign associations are rejected', async () => {
  const f = await fixture();
  try {
    const path = await reviewItem(f);
    await f.bootstrap('beta', ['bob']);
    const bob = await f.login('bob');
    const base = '/api/organizations/alpha';
    const team = await f.request(`${base}/teams`, {
      operationId: 'team',
      name: 'Reviewers',
      members: [f.alice.user.id],
    });
    assert.equal(team.status, 200);
    const other = await f.request(`${base}/teams`, {
      operationId: 'other',
      name: 'Restricted',
      members: [f.alice.user.id],
    });
    assert.equal(
      (
        await f.request(`${base}/teams`, {
          operationId: 'foreign',
          name: 'Foreign',
          members: [bob.user.id],
        })
      ).status,
      409,
    );
    assert.equal(
      (
        await f.request(`${base}/policies`, {
          operationId: 'foreign-policy',
          team: team.body.team.id,
          activity: 'transition.prepare-review',
          scope: 'project',
          scopeId: 'beta-project',
          effect: 'allow',
        })
      ).status,
      409,
    );
    const deny = await f.request(`${base}/policies`, {
      operationId: 'deny',
      team: other.body.team.id,
      activity: 'transition.prepare-review',
      scope: 'team',
      scopeId: other.body.team.id,
      effect: 'deny',
    });
    assert.equal(deny.status, 200);
    const input = {
      operationId: 'blocked',
      transition: 'prepare-review',
      expectedState: 'registered',
      version: 2,
      inputs: { reviewBrief: 'Review' },
    };
    assert.equal((await f.request(`${path}/transition-requests`, input)).status, 403);
    assert.equal(
      (await f.request(`${base}/policies/${deny.body.policy.id}/remove`, { operationId: 'remove' }))
        .status,
      200,
    );
    assert.equal((await f.request(`${path}/transition-requests`, input)).status, 200);
  } finally {
    await f.close();
  }
});

async function reviewItem(f: Awaited<ReturnType<typeof fixture>>) {
  await f.bootstrap('alpha');
  await f.request('/api/organizations/alpha/work-item-types', {
    operationId: 'v2',
    type: 'pull-request-review',
    version: 2,
    enabled: true,
  });
  const created = await f.request('/api/organizations/alpha/work-items', {
    operationId: 'item',
    project: 'alpha-project',
    title: 'Review',
    type: 'pull-request-review',
  });
  return `/api/organizations/alpha/work-items/${created.body.workItem.id}`;
}

test('Direct requests atomically complete, replay once, and require authoritative current prerequisite Facts', async () => {
  const f = await fixture();
  try {
    const path = await reviewItem(f);
    const input = {
      operationId: 'prepare',
      transition: 'prepare-review',
      expectedState: 'registered',
      version: 2,
      inputs: { reviewBrief: 'Inspect authorization' },
    };
    assert.equal(
      (await f.request(`${path}/transition-requests`, { ...input, inputs: {} })).status,
      422,
    );
    const prepared = await f.request(`${path}/transition-requests`, input);
    assert.equal(prepared.status, 200);
    assert.equal(prepared.body.accepted, true);
    assert.equal(prepared.body.completed, true);
    assert.equal(prepared.body.workItem.state, 'ready-for-review');
    assert.deepEqual((await f.request(`${path}/transition-requests`, input)).body, prepared.body);
    assert.equal(
      (
        await f.request(`${path}/transition-requests`, {
          ...input,
          inputs: { reviewBrief: 'Different' },
        })
      ).status,
      409,
    );
    const note = await f.request(`${path}/notes`, {
      operationId: 'note',
      text: 'Not confirmation',
    });
    const withdraw = {
      operationId: 'withdraw',
      transition: 'withdraw-review',
      expectedState: 'ready-for-review',
      version: 2,
      inputs: { reason: 'Revise brief', readinessFact: note.body.fact.id },
    };
    assert.equal((await f.request(`${path}/transition-requests`, withdraw)).status, 409);
    const withdrawn = await f.request(`${path}/transition-requests`, {
      ...withdraw,
      inputs: { ...withdraw.inputs, readinessFact: prepared.body.fact.id },
    });
    assert.equal(withdrawn.status, 200);
    assert.equal((await f.request(path)).body.state, 'registered');
    const facts = (await f.request(`${path}/facts`)).body.items;
    assert.equal(facts.filter((fact: any) => fact.kind === 'state.transition').length, 2);
  } finally {
    await f.close();
  }
});

test('Organization selection creates version 2 while retained version 1 board cards remain unchanged', async () => {
  const f = await fixture();
  try {
    await f.bootstrap('alpha');
    const base = '/api/organizations/alpha';
    const input = {
      operationId: 'old',
      project: 'alpha-project',
      title: 'Retained',
      type: 'pull-request-review',
    };
    const old = await f.request(`${base}/work-items`, input);
    assert.equal(old.body.workItem.version, 1);
    assert.equal(
      (
        await f.request(`${base}/work-item-types`, {
          operationId: 'select',
          type: 'pull-request-review',
          version: 2,
          enabled: true,
        })
      ).status,
      200,
    );
    const current = await f.request(`${base}/work-items`, { ...input, operationId: 'new' });
    assert.equal(current.body.workItem.version, 2);
    const board = await f.request(`${base}/board?type=pull-request-review`);
    assert.equal(board.status, 200);
    assert.deepEqual(
      board.body.items.find((i: any) => i.id === old.body.workItem.id).transitions,
      [],
    );
    assert.equal(
      board.body.items.find((i: any) => i.id === current.body.workItem.id).transitions[0].id,
      'prepare-review',
    );
    assert.equal(
      (
        await f.request(`${base}/work-item-types`, {
          operationId: 'code',
          type: 'pull-request-review',
          version: 2,
          enabled: true,
          code: 'execute()',
        })
      ).status,
      422,
    );
  } finally {
    await f.close();
  }
});
