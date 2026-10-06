# Retain definition versions and explicitly migrate Work Items

Status: ready-for-agent
Type: AFK
Assignee: Codex
State: closed
User stories covered: 64, 65, 66

## Parent

[TBFactory MVP specification](../spec.md)

## What to build

Deploy updated platform-owned Workflows and Work Item Types while existing runs and Work Items continue under retained versions. Provide the explicit, authorized state-flow migration operation agreed for the review lifecycle.

## Acceptance criteria

- [x] Record version-retention, migration validation, ownership, and persistence contracts before dependent implementation.
- [x] Existing Workflow Runs resume under their original Workflow versions after deployment; definitions required by existing runs and Work Items remain available.
- [x] Existing Work Items retain their state-flow version and corresponding board semantics until an explicit migration.
- [x] Version-3 to version-4 migration invalidates the current report and Review Decision and requires a new review and human confirmation, unless the User explicitly approves a separate compatibility contract. Do not rewrite retained Workflow inputs, decisions, or Approval Facts to make them current.
- [x] An authorized migration validates the agreed mapping and prerequisites, records its outcome/history consistently, and respects active-run ownership.
- [x] Organizations can select/configure available new definitions without supplying executable code or silently changing existing runs/items.
- [x] Provide public-flow and board checks across deployment using a suspended old-version run, an old-version Work Item, new-version work, rejected migration, and successful explicit migration.

## Blocked by

- [Issue 09: Cancel a Workflow Run after a confirmed stop](09-confirmed-workflow-run-cancellation.md)
- [Issue 10: Finalize a Work Item through the Review Finalization Workflow](10-separate-review-finalization.md)

## Comments

### Approved publication compatibility boundary — 2026-10-05

The User approved publication being restricted to version 4 until this explicit
migration increment. Work Item Type version is a relevant Review Workflow input;
changing it invalidates existing reports and Review Decisions. Selecting version 4
only affects new Work Items and does not migrate existing provider correspondence.

### Implementation — 2026-10-06

The Issue 11 implementation contract is recorded in
[the retained-version and migration design](../designs/retained-versions-and-explicit-migration.md).
Public SurrealDB checks in [type-migrations.test.ts](../../../tests/type-migrations.test.ts)
cover the fixed 1→2 and 3→4 mappings, retained readiness provenance and subsequent
version-4 withdrawal, selection applying only to new Work Items, stale report and
Review Decision invalidation, fresh version-4 review and human Decision, default
and scoped authorization, cross-Organization isolation, pending Approval and
cancellation-pending Workflow ownership, operation receipt replay/content conflict,
concurrent requests, and database-interruption rollback/retry.

The built review acceptance now verifies a suspended `review-intake-v1` and
`review-v1` survive database restart under their original definitions, selection
creates a new version-4 Work Item while the existing Work Item remains version 3,
and explicit migration preserves the old report while invalidating its Decision.
It also holds a version-1 Work Item for the protected Board migration drill. The
root-owned built production and browser gate remains pending; the issue stays open
until that gate passes.

### Resolution — 2026-10-06

Delivered on `integration/factory-mvp` in `abcd88c`. Eight focused public migration
checks passed against persistent SurrealDB on the dedicated test destination.
Formatting, typecheck, build, and whitespace checks passed. The pre-migration
integration suite also passed all 164 checks, including retained Workflow recovery,
cancellation and separate finalization.

The built HTTP acceptance passed with web, worker and database restarts: the
suspended version-3 Work Item and original Workflow identities remained retained,
new selection created only new version-4 Work Items, and explicit migration
preserved historical reports and made their Review Decision noncurrent. The native
T3 browser signed in and migrated the held version-1 Board card to version 2. Public
reads verified unchanged `registered` state and transition sequence, exactly one
immutable migration Fact, and version-2 `prepare-review` availability. Generated
local evidence is retained in `.runtime/factory-mvp-migration/acceptance.json` and
`browser-migration.json`.
