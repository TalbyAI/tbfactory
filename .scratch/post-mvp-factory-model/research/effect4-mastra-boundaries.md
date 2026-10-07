# Effect 4 and Mastra boundaries

Checked 2026-10-06. Bounded primary-source research for the post-MVP factory model. This records
published API claims and validation gaps; it makes no architecture decision and does not assign
durability ownership. “Workflow” and “Sandbox” below name library APIs, not new Factory terms.

## Findings

- Official Effect is **4.0.1**. Its core documents typed requirements, services/layers, schemas,
  errors, scopes, fibers, interruption, and concurrency.
- Effect 4 has a durable-cluster workflow API beyond its in-memory engine:
  ClusterWorkflowEngine uses sharding and persisted MessageStorage; SqlMessageStorage provides a
  SQL backend for those messages. These modules are marked **unstable**. Their API/source
  existence is documented; end-to-end crash recovery was not executed.
- The API evidence does not establish exactly-once external effects or SurrealDB compatibility.
  Effect Activity documentation warns that side effects before suspension may repeat.
- The repository pins @mastra/core **1.74.0** (also the npm current version on the check date).
  Mastra steps use Promise results and AbortSignal; current docs cover agent/tool steps, snapshots,
  suspend/resume, and provider-based sandboxes.
- Mastra WorkspaceSandbox is an execution capability, not a Factory Resource/Branch claim,
  authorization, or Fact-history contract. LocalSandbox runs on the host by default; isolation
  varies by configured local/remote provider.

## Exact versions and source identity

| Artifact | Evidence |
| --- | --- |
| Effect | [Registry metadata](https://registry.npmjs.org/effect/4.0.1), [tarball](https://registry.npmjs.org/effect/-/effect-4.0.1.tgz), integrity sha512-b1VlQG9g8fwxE5QnIZuPoOP/0MsqHJSRKxUijjoM80E5q95FXrX5yWtY5XI8G+GJsBQAVSDbLS458z9a++uVvw==; [official release](https://github.com/Effect-TS/effect/releases/tag/effect%404.0.1), source commit 460272d30457f4697d8b8c52cad41caccbcace08. |
| Mastra | [Registry metadata](https://registry.npmjs.org/@mastra%2fcore/1.74.0), [tarball](https://registry.npmjs.org/@mastra/core/-/core-1.74.0.tgz), integrity sha512-x3qnBlB4RsL4VLH1PgKNSJkGk3qCuIDNsZvR9Dv8mdfUwHTNS5BgZkeJoM1dWawGQA9aK9iYajgcWqaixyqnyw==; [release tag](https://github.com/mastra-ai/mastra/releases/tag/%40mastra%2Fcore%401.74.0), dated 2026-10-01. |
| Local package state | package.json, package-lock.json, and installed package report @mastra/core 1.74.0. Root package.json has no direct Effect dependency. Optional effect ^3.20.0 peer ranges in the lockfile belong to other packages and are not Effect 4 usage. |

Effect's v4 API reference identifies version 4.0.1. It explicitly labels Workflow, Activity,
WorkflowEngine, DurableDeferred, DurableQueue, ClusterWorkflowEngine, MessageStorage, and
SqlMessageStorage unstable. Do not infer equal stability for every export from the released
package version. See the [Workflow](https://effect.website/docs/v4/api/effect/workflow/Workflow),
[ClusterWorkflowEngine](https://effect.website/docs/v4/api/effect/cluster/ClusterWorkflowEngine),
and [SqlMessageStorage](https://effect.website/docs/v4/api/effect/cluster/SqlMessageStorage) API
pages.

## Effect 4 core surface

- Effect tracks success, typed error, and required services in its type. Context.Service declares
  service keys; Layer composes/provides implementations. This supports replaceable dependencies
  conceptually, but defines no Factory ports. [Services](https://effect.website/docs/v4/requirements-management/services)
  · [Layers](https://effect.website/docs/v4/requirements-management/layers)
- Schema handles decode/encode and typed validation issues. Expected failures are separate from
  defects and interruption in Cause. Adapters must select DTOs and map errors deliberately.
  [Schema](https://effect.website/docs/v4/schema/getting-started)
  · [Error channels](https://effect.website/docs/v4/error-management/two-error-types)
- Scope closes resources through finalizers. Fibers can be interrupted; Effect.all supports
  concurrency controls and structured concurrency. These are process/runtime mechanisms, not
  distributed Resource/Branch locks. [Scope](https://effect.website/docs/v4/resource-management/scope)
  · [Concurrency](https://effect.website/docs/v4/concurrency/basic-concurrency)
- Effect documents Promise wrapping with typed error conversion and interruptible callbacks that
  can receive AbortSignal/cleanup. This does not automatically connect Mastra cancellation to an
  Effect fiber or arbitrary Promise. [Creating Effects](https://effect.website/docs/v4/getting-started/creating-effects)

## Workflow persistence: documented versus unproved

- Workflow carries payload/success/error schemas and an idempotency key for execution IDs;
  DurableDeferred provides a named schema-encoded wait completed later by token. These APIs are
  unstable. [Workflow](https://effect.website/docs/v4/api/effect/workflow/Workflow)
  · [DurableDeferred](https://effect.website/docs/v4/api/effect/workflow/DurableDeferred)
- WorkflowEngine.layerMemory is explicitly in-memory and unsuitable for production durability.
  Separately, ClusterWorkflowEngine is documented as a durable implementation where executions,
  activities, deferred completions, resume, interrupts, and clock wakeups are persisted cluster
  entity messages. Its layer requires Sharding and MessageStorage. Both APIs are unstable.
  [WorkflowEngine](https://effect.website/docs/v4/api/effect/workflow/WorkflowEngine)
  · [ClusterWorkflowEngine](https://effect.website/docs/v4/api/effect/cluster/ClusterWorkflowEngine)
- Unstable SqlMessageStorage describes SQL persistence of cluster envelopes/replies, redelivery
  of unprocessed messages, request deduplication by primary key, and reply replay until ack. Its
  layer needs SqlClient, ShardingConfig, and Crypto; it does not supply a driver or prove
  SurrealDB compatibility. Exact source: [ClusterWorkflowEngine.ts](https://github.com/Effect-TS/effect/blob/460272d30457f4697d8b8c52cad41caccbcace08/packages/effect/src/cluster/ClusterWorkflowEngine.ts)
  · [SqlMessageStorage.ts](https://github.com/Effect-TS/effect/blob/460272d30457f4697d8b8c52cad41caccbcace08/packages/effect/src/cluster/SqlMessageStorage.ts).
- Activity memoizes completed results; its docs warn that replay after suspension can run the
  body again and repeat prior side effects, which should be idempotent.
  [Activity](https://effect.website/docs/v4/api/effect/workflow/Activity). Separately, unstable
  PersistedQueue explicitly guarantees at-least-once delivery, not workflow exactly-once.
  [PersistedQueue](https://effect.website/docs/v4/api/effect/persistence/PersistedQueue).

| Documented | Not established by this research |
| --- | --- |
| Cluster workflow state is represented by persisted messages; SQL message storage supports redelivery and deduplication. | Successful crash/restart/resume behavior in an executed deployment, including storage-driver compatibility. |
| Workflow/activity schemas and deferred tokens encode runtime inputs and results. | Atomic coupling to Factory Facts, authorization, or provider effects; exactly-once external operations. |

## Mastra 1.74.0 and Sandbox boundary

- Current [workflow docs](https://mastra.ai/docs/workflows/overview) describe createStep input/output
  schemas and business logic, createWorkflow composition, agents/tools, streaming, suspension, and
  resume. Built-in execution is the default; workflow runners such as Inngest are also described.
- Exact local 1.74.0 declarations make step execute Promise-based and provide AbortSignal;
  Agent.generate and Agent.stream are Promise surfaces too. Version-pinned [step.ts](https://github.com/mastra-ai/mastra/blob/%40mastra%2Fcore%401.74.0/packages/core/src/workflows/step.ts)
  and [agent.ts](https://github.com/mastra-ai/mastra/blob/%40mastra%2Fcore%401.74.0/packages/core/src/agent/agent.ts).
- Current [Snapshots](https://mastra.ai/docs/workflows/snapshots) docs describe serializable state
  with step statuses, completed outputs, path, suspended metadata, and retry counts; suspension
  persists to configured storage and resume reloads it. This does not prove an external effect and
  checkpoint write are atomic. [Suspend/resume](https://mastra.ai/docs/workflows/suspend-and-resume)
- WorkspaceSandbox optionally exposes command, file, process, network, or checkpoint capabilities;
  exact support varies by provider. Its abort/write surface permits races and partial writes, so
  cancellation is not rollback. Version-pinned [sandbox.ts](https://github.com/mastra-ai/mastra/blob/%40mastra%2Fcore%401.74.0/packages/core/src/workspace/sandbox/sandbox.ts).
- [Sandbox docs](https://mastra.ai/docs/sandbox/overview) state LocalSandbox runs on the application
  host with its permissions by default; native OS isolation can be configured. Remote/container
  providers have varying isolation, persistence, network, and mount behavior.
- [Workspace docs](https://mastra.ai/reference/workspace/workspace-class) allow a static sandbox or
  request-context resolver and cache key. This can scope provider selection; it does not enforce
  Factory Organization policy, Resource/Branch claims, or cleanup rules.

## Boundary and limits

**Inference, not adoption:** a future Effect core could expose typed ports and a Mastra step could
call an adapter that runs an Effect program and maps success, typed failure, and interruption to
Mastra's Promise result. Cancellation and error translation require explicit adapter code and
tests; neither runtime provides automatic cross-library semantics.

**Durability ownership remains unresolved.** Accepted [ADR 0004](../../../docs/adr/0004-serialized-durable-workflow-runs.md)
requires long-lived waits, restart recovery, no blind retries of uncertain provider effects, and
cancellation distinct from confirmed stop. [ADR 0007](../../../docs/adr/0007-platform-owned-versioned-definitions.md)
retains active Workflow Run definition versions; [ADR 0010](../../../docs/adr/0010-separate-web-and-workflow-execution.md)
assigns execution to a separate Mastra worker. Effect's cluster engine and Mastra snapshots
overlap run persistence, suspend/resume, interruption, and retry state. This research does not
choose an owner or establish atomic composition between those stores.

No SurrealDB SqlClient adapter, shared transaction, common run-ID contract, migration/version
policy, or crash-window behavior was verified. Persist only explicit schema-validated data across
runtime boundaries; do not treat fibers, service contexts, or Mastra snapshots as interchangeable.

## Minimal falsification tests

Not run; these are proposed checks only.

| Test | Assertion |
| --- | --- |
| Typed port from Mastra step | Compose Test/live Effect Layers in one typed port; call it through a Mastra createStep Promise adapter. Round-trip schemas and map expected typed failures. Fail if requirements cannot be provided or errors/defects collapse into ambiguous outcomes. |
| Cancellation bridge | Abort a Mastra step running a long Effect fiber and controlled sandbox command. Verify fiber interruption and provider signal observation; test abort/completion races and partial writes. |
| Restart and human resume | Separately test candidate runtimes with persistent storage: complete a step, suspend on schema-checked human/deferred data, stop process, start a new one, resume same ID, and assert completed work is not repeated. |
| Provider crash window and claims | Fake a provider acceptance then kill before checkpoint commit; require idempotency/reconciliation on restart. Concurrent same-Resource/Branch runs must obey Factory storage claims; different Branches must remain independent. |

Sources are official Effect v4 docs, official npm registry/tarballs, official Mastra docs, local manifests
and declarations, and the version-pinned source links above. No prototype, runtime test, or dependency
change was performed.
