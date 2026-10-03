# Durable Workflow storage feasibility prototype

Throwaway investigation for [Validate durable Workflow storage within one working day](../../.scratch/factory-mvp/issues/01-validate-durable-workflow-storage.md). The ticket's resolution comment owns the storage decision. This directory can be deleted without affecting production code or other prototypes.

## Run

Requires Node.js **24.14.1**, npm **11.17.0**, and a running Docker engine with Linux containers and Docker Compose. Run every command from this directory:

```powershell
npm ci
npm run check
```

The checker creates a uniquely named disposable Compose project and RocksDB volume, publishes SurrealDB only on a random loopback port, and removes its own container and volume in `finally`. After a database restart it rediscovers the host port. LibSQL files and simulated-effect ledgers stay under ignored `.data/<session>/`. Each invocation writes an independent JSON report under `evidence/`.

Exit zero means that a provider was validated and selected by the conditional policy; it does **not** mean that every candidate check passed. Setup, cleanup, or failure of both providers produces a nonzero exit.

## Pinned environment

| Component | Executed version |
| --- | --- |
| Node.js | 24.14.1, Windows x64 |
| npm | 11.17.0 |
| Mastra core | 1.74.0 |
| Candidate adapter | `@surrealdb/mastra-ai` 1.0.0-beta.2 |
| Supported fallback | `@mastra/libsql` 1.25.0 |
| Zod | 4.6.5 |
| SurrealDB server | 3.3.0, Linux x64 container |
| SurrealDB JS SDK, locked transitively | 2.0.9 |
| LibSQL client, locked transitively | 0.18.0 |
| Docker engine / Compose | 29.5.3 / 5.1.4 |

`package-lock.json` pins the entire installed dependency graph. `compose.yaml` pins the official server image to `sha256:681c6c22c287421b5c7d99e0fde79b6e0d32c36c1ddeaab2762a1661cb04cd20`. The globally installed SurrealDB 2.3.5 executable was not used. Peer compatibility and primary-source references are in [research.md](research.md); declared peer compatibility alone is not runtime validation.

## Checks and evidence

The worker registers one versioned Workflow definition and uses Mastra's public `createRun`, `start`, `getWorkflowRunById`, and `resume` APIs. It completes a step, suspends for simulated human input, and remains alive until the parent terminates it without closing storage. Inspection and resumption each run in fresh Node.js processes. Run identifiers, process identifiers, step outputs, resumed output, and effect counts are asserted.

The parallel Workflow completes `prepare`, runs `left` and `right` simultaneously, then waits for human input. Ten independent runs check retained sibling outputs and no replay across process termination/resumption. Four parallel child processes repeat that flow against one shared store with distinct Work Items. A separate SurrealDB case restarts the same container against the same persistent RocksDB volume while its run is suspended. LibSQL's embedded database is closed and reopened by the fresh processes.

The additional storage-contract check calls the public `getStore('workflows').updateWorkflowResults` concurrently for `left` and `right`, then reads through public Workflow state operations. This exercises incremental updates, which the default engine's full-snapshot happy path did not exercise. No adapter method is patched or mocked.

Every simulated external effect appends an unconditional ledger entry. The checker compares entries before suspension and after resumption: completed steps occur once and simulated publication occurs once. Entries are copied into the JSON evidence, so the ignored data directory is not required to review those assertions.

| Evaluation report | Interpretation |
| --- | --- |
| [Initial invocation](evidence/14774df4-904f-41b3-97a0-9303a3dc76f5.json) | Infrastructure failure: stale random host port after Docker restart; subsequent candidate connection timeouts were not adapter failures. |
| [Corrected default-engine baseline](evidence/46509701-92af-4999-aa47-0e0e0eba35a1.json) | All default-engine restart, parallel, and distinct-Work-Item concurrency checks passed for both providers. |
| [Incremental-update failure reproduction](evidence/85b1104f-5352-43db-a998-44613866bef1.json) | Candidate threw `TransactionConflict`; LibSQL passed the same incremental-update check. |
| [Final evaluation](evidence/cd3afef2-c6dc-4043-9874-0b9583f0826f.json) | Candidate 5/6 groups passed; LibSQL 5/5 passed. Reports both settled update outcomes and reloaded public state. Checker exited zero and selected LibSQL. |

In the final candidate update observation, `left` was rejected with `TransactionConflict: Resource busy`; `right` fulfilled with `updated-right`, but reloaded Workflow state still exposed the previous `right` output. This supports the source finding that the adapter's incremental update writes `snapshot.results` while this Mastra version reads `snapshot.context`. The conflict and stale public output are observed failures; the hypothesized lost-update race and missing state compare-and-set guard in the source review were not separately proven by this prototype.

## Limits

This proves bounded checkpoint recovery and recorded simulated replay behavior for these pinned dependencies. It does not prove exactly-once GitHub/Azure DevOps effects, recovery during an uncertain in-flight Activity, real waits lasting days, a changed Workflow deployment, cancellation completion, or ownership enforcement for competing runs on the same Work Item. Those contracts remain with the existing implementation tickets. Scheduling/evented execution and atomic state compare-and-set were not evaluated. No production code, real AI calls, provider publication, or custom adapter development was added.
