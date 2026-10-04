# Operate the persistent shared installation

Status: ready-for-agent
Type: AFK
User stories covered: 41, 42, 50, 62, 65, 66, 67, 68

## Parent

[TBFactory MVP specification](../spec.md)

## What to build

Deliver a runnable shared server/container installation with separate TanStack Start web and Mastra worker processes, persistent Factory/Workflow/Artifact storage, and documented startup recovery and operational checks.

## Acceptance criteria

- [ ] Record deployment, startup recovery, persistent-volume, and operational contracts before implementation; use the validated Workflow storage provider while retaining SurrealDB as the primary Factory database.
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

### 2026-10-04 — Provider ingestion runtime verification

Extend Issue 04's built-web/database/ring recovery drill to real running and suspended
Workflow Runs once installed. Deliver observations from both providers before and
after worker/database restart; assert appended immutable Facts, unchanged Factory
state, retained ownership and no overlapping run. Include source credentials,
correspondence and delivery receipts in installation backups.
