# Operate the persistent shared installation

Status: ready-for-human
Type: HITL
State: open
User stories covered: 41, 42, 50, 62, 65, 66, 67, 68

## Parent

[TBFactory MVP specification](../spec.md)

## What to build

Deliver a runnable shared server/container installation with separate TanStack Start web and Mastra worker processes, persistent Factory/Workflow/Artifact storage, and documented startup recovery and operational checks.

## Acceptance criteria

- [x] Record deployment, startup recovery, persistent-volume, and operational contracts before implementation; use the validated Workflow storage provider while retaining SurrealDB as the primary Factory database.
- [x] Operationalize the approved local scope of the [key-ring backup and recovery plan](../../../docs/operations/key-ring-backup.md): runnable daily database backup and monthly restore drill commands, at least 30-day retention, verified ring backups before new-key activation, a configurable protected recovery destination, separate root-key custody, failed/overdue backup monitoring, and restored encrypted Organization secrets. Independent off-host recovery access, deployed scheduling and alert routing, and the installation-specific destination and measured recovery-time objective remain required before real deployment.
- [x] Document installation and operation in English and exercise the public Factory flow with two Organizations, separate processes, real persistent stores, and controllable provider/AI boundaries.
- [x] Restart web, worker, and database around human waits and external Activities; retain run identities, outputs, completed effects, and required Workflow/state-flow definitions.
- [x] Verify Organization isolation, private and revoked Artifact access, AI configuration boundaries, continued Fact ingestion, cancellation ownership, and uncertain-publication recovery after restart.
- [x] Verify cancellation preserves already completed provider publication and Artifacts without allowing an overlapping run.
- [x] Include a small number of Kanban Board/UI scenarios confirming the same rules as the public API, including explicit finalization.
- [x] Provide the smallest runnable behavioral and operational checks covering the installation and the specification's restart/concurrency scenarios; do not introduce a separate speculative component-test framework or claim production provider exactly-once guarantees.

These checked items retain the delivered local evidence. They do not establish
deployed operation or resolve the unexplained ownership failure. The remaining
closure requirements below must be executed, not merely documented.

## Manual work and closure evidence

The installation operator must be named before deployment and record the chosen
environment, execution dates, application revision, results, and nonsecret evidence
under `Comments` or in a linked delivery report. Agent assistance may prepare
configuration and checks; the operator owns installation access, scheduling,
recovery custody, alert routing, and acceptance of measured operational limits.

- [ ] Choose the installation environment and deployment shape. Configure process
  supervision, startup order, persistent SurrealDB/LibSQL/Artifact/key-ring paths,
  and restricted access. Verify startup after a host/process restart and rejection
  of a second worker. Native Node is a provisional local implementation choice,
  not a User-selected production architecture.
- [ ] Configure an independent protected recovery destination and recovery access
  that remains available after losing the active host. Verify retrieval of a
  complete bundle and separately held compatible root-key material without relying
  on active installation paths or logging secrets.
- [ ] Install and exercise the daily backup schedule, monthly restore-drill
  schedule, and retention of at least 30 daily recovery points. Record scheduler
  configuration and actual successful job evidence, including key-ring coverage
  and retained root-key versions. Runnable commands alone do not satisfy this item.
- [ ] Configure an alert recipient and responsible operator. Exercise failed and
  overdue backup/drill conditions and verify delivery of the alerts, not only a
  status field or nonzero exit code.
- [ ] Agree a backup maintenance window. Measure complete backup duration and
  web/worker interruption through restored service availability in the chosen
  environment; agree and record the maximum total interruption before closure.
  Verify service return and document operator action and alerting when the limit
  is exceeded or shutdown/restart fails. The five-minute default backup timeout
  applies per phase and does not establish a total interruption limit.
- [ ] Execute an isolated restore using the independent recovery material and
  separate root-key custody. Record integrity checks, encrypted-secret recovery,
  two-Organization isolation, private/revoked Artifact access, and retained
  Workflow Run identities, outputs, definition versions, and human waits.
- [ ] Exercise ordinary restart and interrupted-execution recovery in the chosen
  environment. Verify exclusive ownership, continued Fact ingestion, cancellation
  completion, preservation of completed Activities, and provider reconciliation
  without blind replay. Keep unknown AI outcomes counted and unreplayed.
- [ ] Exercise the restore hold, explicit dispositions for existing nonterminal
  Workflow Runs, and activation after operator reconciliation. Record the accepted
  MVP limitation: pre-activation external observations do not automatically start
  new Review Workflows, and `recovery-list` does not enumerate observations lacking
  a Run. The later redesign is tracked in [Issue 18](18-redesign-durable-recovery.md).
- [ ] Record the actual recovery destination, recovery point, measured restore
  duration, and an agreed installation-specific recovery-time objective. Check the
  daily-backup recovery-point objective of at most 24 hours against scheduling and
  failure monitoring. Same-host drill timings are not deployment acceptance.
- [ ] Resolve [Issue 17](17-diagnose-worker-ownership-recovery.md), link its causal
  diagnosis and corrective verification, and complete applicable package checks
  on the accepted revision. Passing repetitions alone do not resolve that issue.
- [ ] Complete the requirement-to-evidence index and final acceptance summary
  required by the [specification closure checklist](../spec.md#mvp-closure-checklist).
  Link each mandatory requirement to its implementation ticket and evidence, then
  record joint ticket/map closure after the installation checks and other mandatory
  work pass. Deployment remains pending, so both remain open.

## Blocked by

- [Issue 08: Publish an explicitly shared, limited report Artifact](08-limited-report-artifact-sharing.md)
- [Issue 11: Retain definition versions and explicitly migrate Work Items](11-retained-versions-and-explicit-migration.md)
- [Issue 17: Diagnose worker ownership during crash recovery](17-diagnose-worker-ownership-recovery.md)

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

### Resolution — 2026-10-06

Historical local closure, superseded by the reopening agreement below.

Delivered the approved local installation increment on `integration/factory-mvp`:
separate built web and worker processes, a configurable complete recovery bundle,
graceful dispatch drain, durable restore hold and explicit per-run activation,
backup/drill health monitoring, and a verified isolated restore drill. The
[delivery evidence](../evidence/persistent-shared-installation.md) records the
public operational checks and native Kanban Board finalization. Cancellation and
migration Board checks are linked from the preceding ticket resolutions.

The [two-axis integration review](../evidence/integration-review.md) identified one
Low duplication judgement call and one P1 live publication recovery regression;
both were corrected and the existing two-provider regression passed afterward.
The final complete `npm test` invocation passed 179/179 with no failures, skips,
or cancellations. Build, typecheck, formatting, and diff checks passed. The full
test log is `.runtime/factory-mvp-final-tests-retry.log` in this workspace.

The first full invocation passed 178/179 with one worker-ownership startup error
in the GitHub crash-recovery test. Three isolated repetitions and the final full
invocation passed without changing the ownership guard; the original failure was
not reproduced and its cause was not established.

This closes the User-approved local scope. Real deployment remains pending:
independent protected recovery storage and access, host scheduling and alert
routing, and the installation-specific destination and measured production RTO
must be established before deployment. The same-host drill does not satisfy
off-host disaster recovery. Issue 16 remains explicitly deferred by User approval.

### Reopened after assumption review — 2026-10-07

The User confirmed reopening this ticket and requiring executed manual work and
recorded verification before closing it or the umbrella MVP specification. The
local implementation and historical checks remain delivered; they are not proof
of deployed scheduling, alert routing, independent recovery, or resolved ownership.

Native Node remains provisional for local verification. The earlier local-installation
approval did not select that architecture. Temporary backup interruption is accepted
for the MVP; its maximum will be agreed after measurement in the chosen environment
and before closure. The runtime and operational settings are still deployment work.

The User accepted conservative handling of pre-activation observations as an MVP
limitation and deferred the broader recovery redesign to Issue 18. Existing Workflow
Run durability, retained human waits, and manual recovery of interrupted execution
remain mandatory. The original ownership startup failure is tracked in Issue 17
and blocks recovery acceptance until causally diagnosed and corrected.
