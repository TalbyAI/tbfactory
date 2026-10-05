import { test } from 'node:test';
import assert from 'node:assert/strict';
import { digest, stable } from '../src/server/contracts';
import { membershipId } from '../src/server/provision';
import { Factory } from '../src/server/factory';
import { ReviewAgent } from '../src/server/review-agent';
import { ReviewWorker } from '../src/server/review-worker';
import { generationApproved, reviewOperation, type Run } from '../src/server/reviews';
import { type Row, type Store, type Table, type Transaction } from '../src/server/store';
import { type OrganizationSecrets } from '../src/server/secrets';
import { type RepositorySandbox } from '../src/server/review-sandbox';

// Serialized Approvals from the two deployments, independent of the current binding helper.
function retainedApproval(run: Run, version: 1 | 2) {
  return {
    actor: 'alice',
    ...(version === 2 ? { bindingVersion: 2 as const } : {}),
    binding: digest(
      stable({
        ...(version === 2
          ? { activity: 'review.generate', organization: run.organization, workItem: run.workItem }
          : {}),
        run: run.id,
        identity: run.data.identity,
        inputs: run.data.inputs,
        config: run.data.config,
      }),
    ),
  };
}

function fixture(version: 1 | 2 = 1) {
  const rows = new Map<string, Row>();
  const put = async (table: Table, row: Row) => {
    rows.set(`${table}:${row.id}`, structuredClone(row));
    return row;
  };
  const tx = {
    get: async (table: Table, id: string) => structuredClone(rows.get(`${table}:${id}`)),
    list: async (table: Table, _where: string, bindings: Record<string, unknown> = {}) =>
      structuredClone(
        [...rows.entries()]
          .filter(([key]) => key.startsWith(`${table}:`))
          .map(([, row]) => row)
          .filter((row) =>
            Object.entries(bindings).every(([key, value]) => key === 'teams' || row[key] === value),
          ),
      ),
    put,
    create: async (table: Table, row: Row) => {
      assert.equal(rows.has(`${table}:${row.id}`), false);
      return put(table, row);
    },
  } as unknown as Transaction;
  const store = {
    transaction: async <T>(operation: (tx: Transaction) => Promise<T>) => operation(tx),
  } as Store;
  const fields = {
    sourceBranch: 'feature',
    targetBranch: 'main',
    sourceCommit: 'a'.repeat(40),
    targetCommit: 'b'.repeat(40),
  };
  const run: Run = {
    id: 'retained-run',
    organization: 'alpha',
    workItem: 'item',
    data: {
      workflow: 'review-v1',
      status: 'running',
      token: 'retained-token',
      identity: { kind: 'user', user: 'alice' },
      brief: 'Inspect the repository',
      createdAt: 1,
      calls: 0,
      aiMs: 0,
      executionMs: 0,
      inputs: {
        fields,
        bindings: Object.fromEntries(Object.keys(fields).map((key) => [key, 'inputs'])),
        repository: 'repo',
        typeVersion: 3,
      },
      config: {
        credential: 'ai-key',
        ai: { adapter: 'openai-chat', url: 'https://example.test/v1' },
        access: { credential: 'repo-key', provider: 'github', urls: ['https://example.test/repo'] },
        limits: { calls: 4, aiMs: 60000, executionMs: 60000, subordinateAgents: 0 },
      },
    },
  };
  run.data.approval = retainedApproval(run, version);
  const item = {
    id: run.workItem,
    organization: run.organization,
    project: 'project',
    repository: 'repo',
    version: 3,
    activeRun: { id: run.id, workflow: run.data.workflow, status: run.data.status },
  };
  void put('organization', { id: run.organization });
  void put('membership', { id: membershipId('alice', run.organization), active: true });
  void put('work_item', item);
  void put('workflow_run', run);
  void put('fact', {
    id: 'inputs',
    organization: run.organization,
    workItem: item.id,
    kind: 'review.inputs',
    recordedAt: 1,
    payload: { fields },
  });
  void put('fact', {
    id: 'approval',
    organization: run.organization,
    workItem: item.id,
    kind: 'activity.approved',
    recordedAt: 2,
    payload: { run: run.id, activity: 'review.generate', ...run.data.approval },
  });
  for (const activity of [
    'transition.request-review',
    'review.generate',
    'repository.read',
    'work-item.read',
    'approval.review-generate',
  ])
    void put('policy', {
      id: activity,
      organization: run.organization,
      user: 'alice',
      activity,
      scope: 'organization',
      scopeId: run.organization,
      effect: 'allow',
    });
  void put('policy', {
    id: 'human-generation',
    organization: run.organization,
    user: 'alice',
    activity: 'review.generate',
    scope: 'organization',
    scopeId: run.organization,
    effect: 'human',
  });
  void put('review_config', { id: run.organization, data: { enabled: true } });
  void put('repository_access', {
    id: 'repo',
    data: { enabled: true, ...run.data.config!.access },
  });
  void put('ai_resource', {
    id: digest(stable([run.organization, run.data.config!.credential])),
    data: { enabled: true, ...run.data.config!.ai },
  });
  const secrets = {} as OrganizationSecrets;
  const agent = new ReviewAgent(
    store,
    secrets,
    structuredClone(run),
    {} as RepositorySandbox,
    [],
    false,
    new AbortController().signal,
  );
  return { tx, store, run, item, agent, secrets, rows };
}

test('An unversioned generation Approval survives deployment without rewriting its Fact or run', async () => {
  const f = fixture();
  const retained = structuredClone([...f.rows]);
  assert.equal((await f.agent.check(f.tx)).id, f.run.id);
  assert.deepEqual([...f.rows], retained);
});

test('New generation Approvals persist the scoped binding version in the run and Fact', async () => {
  const f = fixture();
  f.run.data.status = 'waiting-approval';
  delete f.run.data.approval;
  await f.tx.put('workflow_run', f.run);
  await reviewOperation(
    new Factory(f.store),
    f.tx,
    { user: 'alice', human: true },
    { action: 'review.approve', organization: 'alpha', resource: f.item.id },
    { operationId: 'approve', run: f.run.id },
    f.item,
  );
  const approved = (await f.tx.get('workflow_run', f.run.id)) as Run;
  assert.deepEqual(approved.data.approval, retainedApproval(approved, 2));
  const facts = await f.tx.list('fact', 'kind = $kind', { kind: 'activity.approved' });
  assert.equal(facts.length, 2);
  assert.deepEqual(facts.find((fact) => fact.id !== 'approval')!.payload, {
    run: f.run.id,
    activity: 'review.generate',
    relevantInputs: f.run.data.inputs,
    ...approved.data.approval,
  });
});

test('Versioned Approvals fail closed on unknown versions and never fall back to the legacy digest', () => {
  const { run } = fixture(2);
  run.data.approval!.binding = retainedApproval(run, 1).binding;
  assert.equal(generationApproved(run), false);
  run.data.approval = retainedApproval(run, 2);
  Object.assign(run.data.approval, { bindingVersion: 99 });
  assert.equal(generationApproved(run), false);
  delete run.data.approval;
  assert.equal(generationApproved(run), false);
});

test('Scoped Approvals cannot be reused for another Organization or Work Item', () => {
  for (const field of ['organization', 'workItem'] as const) {
    const { run } = fixture(2);
    run[field] = 'another-scope';
    assert.equal(generationApproved(run), false);
  }
});

for (const version of [1, 2] as const) {
  test(`Generation accepts retained v${version} Approval and rejects changed inputs, configuration, identity and revoked authority`, async () => {
    const retained = fixture(version);
    assert.equal((await retained.agent.check(retained.tx)).id, 'retained-run');
    for (const change of ['inputs', 'config', 'identity', 'policy', 'resource'] as const) {
      const f = fixture(version);
      if (change === 'inputs') f.run.data.inputs!.fields.sourceCommit = 'c'.repeat(40);
      if (change === 'config') f.run.data.config!.credential = 'another-key';
      if (change === 'identity') f.run.data.identity.kind = 'service';
      if (change === 'policy') {
        const policy = (await f.tx.get('policy', 'review.generate'))!;
        await f.tx.put('policy', { ...policy, effect: 'deny' });
      }
      if (change === 'resource')
        await f.tx.put('repository_access', { id: 'repo', data: { enabled: false } });
      await f.tx.put('workflow_run', f.run);
      await assert.rejects(
        f.agent.check(f.tx),
        (error: any) => [403, 409].includes(error.status),
        change,
      );
    }
  });

  test(`Review completion preserves the original v${version} generation Approval after deployment`, async () => {
    const f = fixture(version);
    const original = await f.tx.get('fact', 'approval');
    f.run.data.status = 'review-submitted';
    f.run.data.report = 'report';
    f.run.data.decision = 'decision';
    await f.tx.put('workflow_run', f.run);
    await f.tx.put('review_report', {
      id: 'report',
      organization: 'alpha',
      workItem: 'item',
      run: f.run.id,
      data: { createdAt: 3, relevantInputs: f.run.data.inputs },
    });
    await f.tx.put('fact', {
      id: 'decision',
      organization: 'alpha',
      workItem: 'item',
      kind: 'review.decision',
      payload: { run: f.run.id, reportVersion: 'report' },
    });
    const worker = new ReviewWorker(f.store, f.secrets, {
      directory: '.runtime/unused-approval-test',
      artifacts: '.runtime/unused-approval-test',
      image: '',
      allowedHosts: [],
      allowLoopback: false,
      concurrency: 1,
      limits: f.run.data.config!.limits,
    });
    assert.equal(await worker['completeReview'](f.run.id), true);
    assert.equal(
      ((await f.tx.get('workflow_run', f.run.id))!.data as Run['data']).status,
      'completed',
    );
    assert.equal((await f.tx.get('work_item', 'item'))!.activeRun, undefined);
    assert.deepEqual(await f.tx.get('fact', 'approval'), original);
  });
}
