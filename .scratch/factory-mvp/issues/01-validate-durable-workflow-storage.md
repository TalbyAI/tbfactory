# Validate durable Workflow storage within one working day

Status: ready-for-agent
Type: AFK
Labels: wayfinder:task
Assignee: Codex
State: closed
User stories covered: 69, 70

## Parent

[TBFactory MVP specification](../spec.md)

## What to build

Evaluate the existing Mastra-SurrealDB adapter in an isolated, one-working-day prototype. Record a concrete Workflow storage decision based on observed behavior. SurrealDB remains the primary Factory database regardless of the result.

## Acceptance criteria

- [x] Record mutually compatible pinned Node.js, Mastra, adapter, and SurrealDB versions, executed checks, failures, and actual effort. Use a disposable database with persistent storage.
- [x] Complete a step, suspend a Workflow Run for human input, terminate the application process, and load/resume the same run in a fresh process. Verify retained outputs and no repetition of completed work.
- [x] Repeat suspend/resume across a SurrealDB restart using the same persistent data.
- [x] Verify retained results for parallel steps within one run and concurrent runs for different Work Items.
- [x] Use recorded simulated external effects to verify replay behavior; do not claim this proves exactly-once production provider effects.
- [x] Adopt the candidate only if the required checks pass within one working day. Otherwise select a Mastra-supported provider, record the failed criterion and selected compatible dependencies, and exclude substantial custom adapter development.

## Blocked by

None - can start immediately

## Comments

### Work started — 2026-10-02

Claimed by Codex. This is the executable storage-feasibility investigation authorized by the parent specification, bounded to one working day. Prototype code, dependencies, commands, persistent scratch data, and evidence will stay in `prototypes/durable-workflow-storage/`. No production Factory implementation or substantial adapter development is included.

### Resolution — 2026-10-02

**Select Mastra's LibSQL provider for Workflow storage, backed by a persistent local file volume.** SurrealDB remains the primary Factory database. Reject the evaluated SurrealDB adapter for this MVP because its public concurrent incremental-result update contract failed; no custom adapter repair is included.

The tested dependency set is Node.js **24.14.1**, npm **11.17.0**, `@mastra/core` **1.74.0**, candidate `@surrealdb/mastra-ai` **1.0.0-beta.2**, selected `@mastra/libsql` **1.25.0**, and Zod **4.6.5**, with SurrealDB server **3.3.0** pinned by image digest. The candidate's declared peers admit these versions, but runtime contract validation failed. The selected Mastra/LibSQL pair passed runtime validation. The [lockfile](../../../prototypes/durable-workflow-storage/package-lock.json) records all transitive versions, including SurrealDB SDK **2.0.9** and LibSQL client **0.18.0**.

| Check group | SurrealDB candidate | LibSQL |
| --- | --- | --- |
| Storage initialization | Pass | Pass |
| Complete work, suspend, terminate process, fresh-process load/resume | Pass | Pass |
| SurrealDB restart against the same persistent RocksDB volume | Pass | Not applicable: embedded database reopens in fresh processes |
| Parallel-step outputs retained across suspension/restart, ten runs | Pass | Pass |
| Four concurrent processes for different Work Items | Pass | Pass |
| Public concurrent incremental step-result updates retained after reload | **Fail** | Pass |

**Failed concurrency criterion:** concurrent `updateWorkflowResults` calls for two sibling steps produced an unhandled SurrealDB `TransactionConflict: Resource busy`. In the final observation one call rejected; the other fulfilled, but its changed output was absent from subsequently loaded public Workflow state. Source inspection explains the stale output: this adapter writes `snapshot.results`, whereas the pinned Mastra contract uses `snapshot.context`. Default-engine full-snapshot checks passed and are not misreported as failures. The incremental contract failure was reproduced twice; losing a sibling through a last-write-wins race and missing compare-and-set enforcement remain source concerns, not separately executed claims.

Completed work and simulated publication were checked through an unconditional append-only effect ledger before and after resume. No completed simulated step was repeated in the successful recovery cases. This does **not** establish exactly-once production GitHub/Azure DevOps effects or safe retry of an uncertain in-flight Activity.

**Evidence and commands:** [prototype instructions and evaluation history](../../../prototypes/durable-workflow-storage/README.md), [primary-source investigation](../../../prototypes/durable-workflow-storage/research.md), and [final executed report](../../../prototypes/durable-workflow-storage/evidence/cd3afef2-c6dc-4043-9874-0b9583f0826f.json). Run `npm ci` and `npm run check` from `prototypes/durable-workflow-storage/`. The final invocation exited zero because the conditional evaluation validated and selected LibSQL; it records the candidate failure explicitly. Earlier reports include the corrected Docker ephemeral-port mistake, which was an infrastructure failure rather than an adapter failure.

**Actual effort:** claimed at **11:21:18 UTC**; final evaluation completed at **11:35:33 UTC** on 2026-10-02, a measured **14 minutes 15 seconds** from claim through executable evaluation. Source review ran concurrently; orientation before the claim was not timed. Resolution writing and review added approximately ten minutes. The investigation finished within the one-working-day timebox.

**Context pointer:** branch `prototype/validate-durable-workflow-storage`, asset directory `prototypes/durable-workflow-storage/`. Keep this throwaway prototype outside production dependencies. Existing tickets already own worker coordination, Workflow version retention, cancellation, publication reconciliation, and deployment; no additional ticket or production implementation is needed to close this feasibility question.
