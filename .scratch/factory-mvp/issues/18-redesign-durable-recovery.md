# Redesign durable recovery beyond the MVP

Status: needs-triage
Type: HITL
Labels: wayfinder:grilling
State: open

## Parent

[TBFactory MVP specification](../spec.md)

## Deferred scope

Design the final product's durable recovery and restart behavior, including existing
interrupted Workflow Runs and external observations that never produced a Run before
an older backup was restored. This is a post-MVP design follow-up, not a blocker for
MVP closure or authorization to implement automatic replay.

## Accepted MVP baseline

- Ordinary restart retains Workflow Run identity, completed results, definition
  versions, human waits, and exclusive ownership.
- Interrupted execution uses conservative manual recovery. Confirm the original
  process and sandbox stopped; preserve completed work and count uncertain AI
  calls without automatically repeating them. Publication uses provider evidence
  and required User confirmation rather than blind retries.
- Restored existing nonterminal Runs have explicit dispositions in the restore
  hold. Activation follows operator reconciliation.
- External observations recorded at or before restore activation do not
  automatically create new Review Workflows. Legitimate unexecuted starts may
  remain unperformed; `recovery-list` lists existing Runs, not those observations.
  This omission is an explicitly accepted MVP limitation.

These commitments remain governed by
[ADR 0004](../../../docs/adr/0004-serialized-durable-workflow-runs.md),
[ADR 0007](../../../docs/adr/0007-platform-owned-versioned-definitions.md), and the
[existing recovery procedure](../../../docs/operations/durable-private-reviews.md#consumption-and-recovery).
The historical ownership startup report is tracked separately in
[Issue 17](17-diagnose-worker-ownership-recovery.md), which is open and suspended
with `Status: needs-info` because its reporting conditions cannot currently be
reproduced. Its cause remains unknown and no correction is claimed. It is not a
current MVP blocker. Preserve ownership protections and complete Issue 12's
deployment-specific restart and recovery checks; this deferred redesign does not
replace or postpone them.

## Questions for the later design

- Distinguish ordinary restart, interrupted execution, and restoration of an older
  recovery point. Define what each can recover and which external evidence is needed.
- Define how to discover, display, and explicitly resolve restored observations
  lacking an automatic-start receipt or Workflow Run without losing immutable Facts.
- Specify restart and continuation for existing queued, running, suspended, and
  recovery-required Runs while retaining definition versions and single-run ownership.
- Define reconciliation of completed and uncertain AI/provider effects when the
  recovery point predates their local receipts. Do not infer exactly-once effects
  from Workflow snapshot durability.
- Decide operator responsibilities, safe automation boundaries, visible pending
  states, and verification scenarios before implementation. Record proposals
  separately from accepted decisions and identify any ADR changes explicitly.

## Comments

### Deferred by User approval — 2026-10-07

The User accepted the restored-observation limitation for the MVP and requested a
later redesign considering Workflow durability and restart of already executing
Runs. The User confirmed retaining the current MVP durability and conservative
manual-recovery commitments while deferring that broader redesign.
