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
- [ ] Document installation and operation in English and exercise the public Factory flow with two Organizations, separate processes, real persistent stores, and controllable provider/AI boundaries.
- [ ] Restart web, worker, and database around human waits and external Activities; retain run identities, outputs, completed effects, and required Workflow/state-flow definitions.
- [ ] Verify Organization isolation, private and revoked Artifact access, AI configuration boundaries, continued Fact ingestion, cancellation ownership, and uncertain-publication recovery after restart.
- [ ] Verify cancellation preserves already completed provider publication and Artifacts without allowing an overlapping run.
- [ ] Include a small number of Kanban Board/UI scenarios confirming the same rules as the public API, including explicit finalization.
- [ ] Provide the smallest runnable behavioral and operational checks covering the installation and the specification's restart/concurrency scenarios; do not introduce a separate speculative component-test framework or claim production provider exactly-once guarantees.

## Blocked by

- [Issue 08: Publish an explicitly shared, limited report Artifact](08-limited-report-artifact-sharing.md)
- [Issue 11: Retain definition versions and explicitly migrate Work Items](11-retained-versions-and-explicit-migration.md)

