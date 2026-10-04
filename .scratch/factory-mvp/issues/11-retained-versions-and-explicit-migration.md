# Retain definition versions and explicitly migrate Work Items

Status: ready-for-agent
Type: AFK
User stories covered: 64, 65, 66

## Parent

[TBFactory MVP specification](../spec.md)

## What to build

Deploy updated platform-owned Workflows and Work Item Types while existing runs and Work Items continue under retained versions. Provide the explicit, authorized state-flow migration operation agreed for the review lifecycle.

## Acceptance criteria

- [ ] Record version-retention, migration validation, ownership, and persistence contracts before dependent implementation.
- [ ] Existing Workflow Runs resume under their original Workflow versions after deployment; definitions required by existing runs and Work Items remain available.
- [ ] Existing Work Items retain their state-flow version and corresponding board semantics until an explicit migration.
- [ ] An authorized migration validates the agreed mapping and prerequisites, records its outcome/history consistently, and respects active-run ownership.
- [ ] Organizations can select/configure available new definitions without supplying executable code or silently changing existing runs/items.
- [ ] Provide public-flow and board checks across deployment using a suspended old-version run, an old-version Work Item, new-version work, rejected migration, and successful explicit migration.

## Blocked by

- [Issue 09: Cancel a Workflow Run after a confirmed stop](09-confirmed-workflow-run-cancellation.md)
- [Issue 10: Finalize a Work Item through the Review Finalization Workflow](10-separate-review-finalization.md)
