// Throwaway feasibility probe; no AI calls or real provider effects.
import assert from 'node:assert/strict';
import { appendFileSync, mkdirSync } from 'node:fs';
import { join } from 'node:path';
import { Mastra } from '@mastra/core/mastra';
import { createStep, createWorkflow } from '@mastra/core/workflows';
import { SurrealDBStore } from '@surrealdb/mastra-ai';
import { LibSQLStore } from '@mastra/libsql';
import { z } from 'zod';

const [provider, action, shape, runId, workItemId] = process.argv.slice(2);
assert(['surreal', 'libsql'].includes(provider));
assert(['init', 'start', 'inspect', 'resume', 'updates'].includes(action));
assert(['serial', 'parallel'].includes(shape));
assert.match(runId, /^[a-zA-Z0-9-]+$/);
const directory = process.env.PROBE_DATA;
assert(directory, 'PROBE_DATA is required');
mkdirSync(join(directory, 'effects'), { recursive: true });
const effect = (step) =>
  appendFileSync(
    join(directory, 'effects', `${runId}.jsonl`),
    JSON.stringify({ runId, workItemId, step, pid: process.pid }) + '\n',
  );

const storage =
  provider === 'surreal'
    ? new SurrealDBStore({
        id: 'prototype',
        url: process.env.SURREAL_URL,
        username: 'prototype',
        password: 'prototype',
        namespace: 'prototype',
        database: 'disposable',
      })
    : new LibSQLStore({
        id: 'prototype',
        url: `file:${join(directory, 'workflow.db').replaceAll('\\', '/')}`,
      });

const inputSchema = z.object({ workItemId: z.string() });
const outputSchema = z.object({ workItemId: z.string(), values: z.array(z.string()) });
const prepare = createStep({
  id: 'prepare',
  inputSchema,
  outputSchema,
  execute: async ({ inputData }) => {
    effect('prepare');
    return { ...inputData, values: ['prepared'] };
  },
});
const branches = ['left', 'right'].map((id) =>
  createStep({
    id,
    inputSchema: outputSchema,
    outputSchema,
    execute: async ({ inputData }) => {
      await new Promise((resolve) => setTimeout(resolve, 30));
      effect(id);
      return { ...inputData, values: [...inputData.values, id] };
    },
  }),
);
const gate = createStep({
  id: 'human-input',
  inputSchema:
    shape === 'parallel' ? z.object({ left: outputSchema, right: outputSchema }) : outputSchema,
  outputSchema: outputSchema.extend({ approved: z.boolean() }),
  resumeSchema: z.object({ approved: z.boolean() }),
  suspendSchema: z.object({ reason: z.string() }),
  execute: async ({ inputData, resumeData, suspend }) => {
    if (!resumeData) return await suspend({ reason: 'Waiting for human input' });
    const data =
      shape === 'parallel'
        ? {
            workItemId: inputData.left.workItemId,
            values: [inputData.left.values[0], inputData.left.values[1], inputData.right.values[1]],
          }
        : inputData;
    assert.equal(data.workItemId, workItemId);
    assert.deepEqual(
      data.values,
      shape === 'parallel' ? ['prepared', 'left', 'right'] : ['prepared'],
    );
    effect('publish');
    return { ...data, approved: resumeData.approved };
  },
});

let workflow = createWorkflow({
  id: `durability-${shape}-v1`,
  inputSchema,
  outputSchema: outputSchema.extend({ approved: z.boolean() }),
}).then(prepare);
if (shape === 'parallel') workflow = workflow.parallel(branches);
workflow = workflow.then(gate).commit();
new Mastra({ storage, workflows: { probe: workflow } });

try {
  await storage.init();
  let result;
  if (action === 'init') result = { initialized: true };
  if (action === 'inspect') result = await workflow.getWorkflowRunById(runId);
  if (action === 'start' || action === 'resume') {
    const run = await workflow.createRun({ runId, resourceId: workItemId });
    result =
      action === 'start'
        ? await run.start({ inputData: { workItemId } })
        : await run.resume({ step: 'human-input', resumeData: { approved: true } });
  }
  if (action === 'updates') {
    const run = await workflow.createRun({ runId, resourceId: workItemId });
    const started = await run.start({ inputData: { workItemId } });
    assert.equal(started.status, 'suspended');
    const store = await storage.getStore('workflows');
    // Exercise the advertised public concurrent-update contract without patching the adapter.
    const updates = await Promise.allSettled(
      ['left', 'right'].map((id) =>
        store.updateWorkflowResults({
          workflowName: workflow.id,
          runId,
          stepId: id,
          requestContext: {},
          result: {
            status: 'success',
            output: { workItemId, values: ['prepared', `updated-${id}`] },
          },
        }),
      ),
    );
    result = {
      updates: updates.map((update) =>
        update.status === 'fulfilled' ? update : { status: 'rejected', error: update.reason.stack },
      ),
      state: await workflow.getWorkflowRunById(runId),
    };
  }
  const message = { pid: process.pid, provider, action, shape, runId, workItemId, result };
  if (action === 'start') {
    // Parent kills this process after the suspended result; no graceful storage close.
    setInterval(() => {}, 1000);
    process.send(message);
  } else {
    await storage.close();
    process.send(message, () => process.disconnect());
  }
} catch (error) {
  console.error(error);
  process.exit(1);
}
