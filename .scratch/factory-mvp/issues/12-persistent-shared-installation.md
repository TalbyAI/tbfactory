# Operate the persistent shared installation

Status: ready-for-human
Type: HITL
Assignee: Codex
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
deployed operation or diagnose the historical ownership report. The remaining
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
- [ ] Complete applicable package checks on the accepted revision and record the
  results with the installation evidence. The suspended diagnostic in
  [Issue 17](17-diagnose-worker-ownership-recovery.md) has no claimed correction;
  preserve its ownership guard and historical report. This disposition does not
  replace the deployment restart and recovery checks above.
- [x] Prepare the requirement-to-evidence index in the
  [MVP specification](../spec.md#requirement-to-evidence-index). It records source
  links and distinguishes historical local evidence from pending installation
  acceptance.
- [ ] Revalidate the index against the accepted application revision, append the
  final installation acceptance record required by the
  [specification closure checklist](../spec.md#mvp-closure-checklist), and close
  this ticket and map only after all mandatory installation and recovery checks pass.

## Prepared deployment acceptance record

This record is prepared from the committed contract and historical local evidence.
It does not select an installation or report deployment acceptance. The operator
must fill the unresolved values with nonsecret evidence before closure.

### Selected Docker evaluation — 2026-10-07

The User selected Docker on the current PC for the MVP evaluation, including
SurrealDB and all other dependencies. The User is the installation operator.
Use a dedicated Docker volume for backup and restore verification, and SMTP4Dev
as the mock operator inbox. These choices supersede the unresolved selection
fields below; the remaining rows retain the earlier preparation context.

The [Docker evaluation contract](../designs/docker-evaluation.md) records the
implementation and verification plan. Same-host volume recovery is the selected
evaluation scope; independent recovery after host loss remains a prerequisite
before real deployment and is not claimed by this evaluation. Measure interruption
and restore time before agreeing their operational limits with the operator.

| Acceptance item | Recorded local value or contract | Required installation value / evidence |
| --- | --- | --- |
| Responsible operator | No operator is recorded. | Name the operator and record execution dates, accepted revision, and evidence location. |
| Host and deployment shape | Local exercise used separate native Node web/worker processes and Docker for SurrealDB and review sandboxes. Native Node is provisional. | Select the host and deployment shape; record runtime, supervision, network exposure, persistent paths, restricted access, startup order, and second-worker rejection. |
| Local database endpoint | Historical coordinator evidence records `ws://127.0.0.1:18012/rpc`, namespace `acceptance`; it is an ephemeral local test destination. | Record the chosen installation's nonsecret destination details and host/service restart evidence. |
| Recovery destination and access | Local recovery used a configurable same-host directory; the bundle excludes the separately held root key. | Name the independent protected destination and recovery access method, and prove retrieval after active-host loss using separately held compatible root-key material. |
| Backup and drill schedules | Commands exist for daily backup and monthly restore drill; local code retains all valid recovery points. | Record deployed scheduler configuration, at least 30 daily points, key-ring coverage, root-key version retention, and successful scheduled job evidence. |
| Alerts and operator response | Local status exposes backup/drill health and overdue state; no alert recipient or delivery is recorded. | Name the responsible recipient/operator, configure delivery, and record exercised failed and overdue backup/drill alerts. |
| Backup interruption | Temporary backup interruption is accepted for the MVP. The five-minute timeout applies per phase and is not a total interruption limit. | Measure complete backup and service interruption in the chosen environment; record the agreed maximum, maintenance window, service return, and response if exceeded or restart fails. |
| Recovery point objective | The documented daily-backup target is at most 24 hours. | Verify the deployed schedule and failure monitoring meet that target and record the recovery point. |
| Restore duration and recovery-time objective | Historical same-host restore drill evidence records `durationMs: 4989`; it is not a production measure. | Record the independent restore duration and agree the installation-specific recovery-time objective with the operator. |
| Existing-Run recovery | Local checks record retained identities, human waits, explicit restore-hold dispositions, and conservative provider recovery. | Exercise ordinary restart, interrupted-execution recovery, restore hold, ownership, cancellation, and provider reconciliation on the chosen installation; retain unknown AI calls without replay. |
| Ownership diagnostic | The first historical full-suite invocation reported one startup error; later repetitions and the final suite passed without a causal diagnosis or correction. [Issue 17](17-diagnose-worker-ownership-recovery.md) is open with `needs-info` status and `suspended` label. | Preserve all ownership protections. This diagnostic is not a current blocker; the installation-specific ownership and confirmed-stop checks above remain required. |

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

### User-directed Issue 17 suspension — 2026-10-07

The User directed that Issue 17 be suspended because the reported failure's
conditions cannot be reproduced. Issue 17 remains open with `Status: needs-info` and
the `suspended` label. Its cause remains unknown and no correction is claimed. It is
not a current blocker for Issue 12 or the MVP map. Keep the live-owner and
confirmed-stop protections. The deployment-specific restart, interrupted-run,
restore-hold, ownership, cancellation, and provider-reconciliation checks in this
ticket remain open and mandatory.

### Acceptance preparation — 2026-10-07

Prepared the [requirement-to-evidence index](../spec.md#requirement-to-evidence-index)
for all 70 User Stories and the accepted testing areas, and added the prepared
deployment acceptance record above. The index traces ticket metadata to existing
design, test, documentation, and evidence sources; this is traceability, not a
fresh product acceptance run. The responsible installation operator remains
unassigned, and the host, deployment shape, independent recovery destination,
alert route, interruption limit, and installation-specific recovery-time objective
remain pending. No product suite, deployment, or restore drill was rerun for this
documentation preparation. Markdown formatting, formatting checks, and local link
and heading-anchor checks passed. Issue 12 and the umbrella specification remain
open, with all deployment and recovery checks still mandatory.

### Docker evaluation implementation started — 2026-10-07

Codex is preparing and executing the User-selected container evaluation on the
current PC, on `integration/factory-mvp-acceptance`. The User remains the operator.
Containerization and operational scheduling are separate implementation increments
under this ticket. The active host, operator, backup target, and mock alert channel
are selected; execution evidence and measured limits are not yet accepted.
