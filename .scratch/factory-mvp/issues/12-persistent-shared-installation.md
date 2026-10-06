# Operate the persistent shared installation

Status: ready-for-agent
Type: AFK
Assignee: Codex
State: open
User stories covered: 41, 42, 50, 62, 65, 66, 67, 68

## Parent

[TBFactory MVP specification](../spec.md)

## What to build

Deliver a runnable shared server/container installation with separate TanStack Start web and Mastra worker processes, persistent Factory/Workflow/Artifact storage, and documented startup recovery and operational checks.

## Acceptance criteria

- [x] Record deployment, startup recovery, persistent-volume, and operational contracts before implementation; use the validated Workflow storage provider while retaining SurrealDB as the primary Factory database.
- [ ] Operationalize the accepted policy in the [key-ring backup and recovery plan](../../../docs/operations/key-ring-backup.md): daily database backups, at least 30-day retention, verified ring backups before new-key activation, and monthly restore drills. Configure independent protected recovery storage and separate root-key custody, wire backup monitoring, and demonstrate restore without losing access to encrypted Organization secrets. Record the installation-specific destination and measured recovery-time objective before deployment.
- [ ] Document installation and operation in English and exercise the public Factory flow with two Organizations, separate processes, real persistent stores, and controllable provider/AI boundaries.
- [ ] Restart web, worker, and database around human waits and external Activities; retain run identities, outputs, completed effects, and required Workflow/state-flow definitions.
- [ ] Verify Organization isolation, private and revoked Artifact access, AI configuration boundaries, continued Fact ingestion, cancellation ownership, and uncertain-publication recovery after restart.
- [ ] Verify cancellation preserves already completed provider publication and Artifacts without allowing an overlapping run.
- [ ] Include a small number of Kanban Board/UI scenarios confirming the same rules as the public API, including explicit finalization.
- [ ] Provide the smallest runnable behavioral and operational checks covering the installation and the specification's restart/concurrency scenarios; do not introduce a separate speculative component-test framework or claim production provider exactly-once guarantees.

## Blocked by

- [Issue 08: Publish an explicitly shared, limited report Artifact](08-limited-report-artifact-sharing.md)
- [Issue 11: Retain definition versions and explicitly migrate Work Items](11-retained-versions-and-explicit-migration.md)

## Comments

### 2026-10-06 — Approved local installation scope

The User selected a locally verifiable installation with a configurable recovery
destination, leaving real deployment pending. Verify the complete recovery bundle
and local restore procedure. A same-host verification destination does not establish
independent disaster recovery. The production recovery destination and measured
installation-specific recovery-time objective remain required before real deployment.

### 2026-10-04 — Provider ingestion runtime verification

Extend Issue 04's built-web/database/ring recovery drill to real running and suspended
Workflow Runs once installed. Deliver observations from both providers before and
after worker/database restart; assert appended immutable Facts, unchanged Factory
state, retained ownership and no overlapping run. Include source credentials,
correspondence and delivery receipts in installation backups.

### Implementation contract — 2026-10-06

The bounded installation and recovery contracts are recorded in the [persistent
shared installation design](../designs/persistent-shared-installation.md) and
[operations runbook](../../../docs/operations/persistent-shared-installation.md).
The selected local exercise uses native Node web and worker processes with Docker
for SurrealDB and review sandboxes. It preserves separately held root-key custody,
requires a durable restore hold with explicit per-run disposition, and leaves the
production recovery destination and measured recovery-time objective pending.

### 2026-10-06 — Local acceptance evidence (awaiting root validation)

The public coordinator test passed against the owned persistent SurrealDB service
(`ws://127.0.0.1:18012/rpc`, namespace `acceptance`): backup, fresh isolated
restore, forced maintenance hold, explicit activation, activated second-generation
backup, and isolated restore drill. It also verified two Organizations, encrypted
secret recovery, retained human wait and Workflow identity, completed provider
publication, revoked and cross-Organization Artifact denial, root-key exclusion,
and an active public Run whose backup timed out without producing a bundle. Active
AI work completed naturally before cancellation.

Executed checks:

- `node --import tsx --test tests/installation-coordinator.test.ts` — 1/1 passed.
- `node --import tsx --test tests/installation-drain.test.ts` — 2/2 passed.
- `node --import tsx --test tests/installation-maintenance.test.ts` — 2/2 passed.
- `node --import tsx --test tests/installation-observations.test.ts` — 2/2 passed
  for GitHub and Azure DevOps around a real worker and SurrealDB restart.
- `npm run build`, `npm run typecheck`, `npm run format:check`, and `git diff --check`
  passed.

The Issue remains open for root's final full-suite and Board UI checks. This local
exercise does not verify off-host disaster recovery or establish a production
recovery-time objective; destination and measured installation-specific RTO remain
pending real deployment.
