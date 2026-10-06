# Retained Versions and Explicit Work Item Migration

Issue: [11](../issues/11-retained-versions-and-explicit-migration.md).
Implementation contract under ADRs 0002–0007, 0009, the accepted [Transition
Requests design](authorized-transition-requests.md), and the approved publication
and report-sharing boundaries. It preserves the installed platform definitions
and does not add customer-authored code or a general migration framework.

## Retained definitions and selection

Keep the platform-owned Work Item Type definitions `pull-request-review` versions
1–5 and Workflow definitions `review-intake-v1`, `review-v1`, and
`review-finalization-v1` available to existing Work Items and Workflow Runs.
Persist each Workflow Run's selected Workflow identifier and its original inputs;
deployment and Work Item Type selection do not reinterpret or rewrite them.

Organization selection configures the type/version used for new Work Items only.
Existing Work Items retain their persisted version and matching Board states,
transitions, and Approval Points until a separate migration succeeds. Organizations
provide no executable Workflow or state-flow definition.

## Explicit migration request

Expose a protected public migration operation for one Work Item through the same
Factory transaction and authorization path as other operations, with a Board
action calling that operation. Require a caller-generated operation identifier,
expected Factory state, expected current type version, target type version, and
expected transition sequence. Authorize a separate Work Item-scoped
`work-item.migrate` Activity under current Organization, Project, Repository,
Team, and User policy. Default deny, explicit prohibition, credential Activity
limits, Membership, and Organization ownership remain in force. Human policy
requirements require an authorized human caller.

Apply only these fixed, state-compatible mappings:

| Current type version | Target type version | Current Factory state |
| --- | --- | --- |
| 1 | 2 | `registered` |
| 3 | 4 | `registered` or `ready-for-review` |

Reject every other mapping, including 2→3, every migration to version 5, and
version-3 `completed`. Version 3 has no installed Review Finalization Workflow;
therefore this contract does not infer that its `completed` state has equivalent
meaning in version 4 or waive the current review and publication prerequisites.

## Ownership, validation, and persistence

Validate in the same transaction that the Work Item belongs to the requested
Organization, its current state/version/transition sequence match all expected
values, and the allowlisted state mapping is valid. Reject if any `activeRun`
exists, including a run with pending cancellation. Also reject while any
Transition Request for the Work Item is nonterminal (pending Approval, approved,
accepted, or running); terminal completed, rejected, or cancelled requests do
not own the Work Item.

For `ready-for-review` version 3→4, preserve the latest successful readiness
State Transition Fact and its existing lifecycle sequence. Do not edit that Fact
or transfer any earlier Review Decision or Approval. Record immutable migration
provenance binding the migration Fact to the Work Item, old and new versions,
unchanged Factory state, unchanged transition sequence, and operation identifier.
Only that exact, current 3→4 provenance may validate the retained version-3
readiness Fact for the `withdraw-review` prerequisite. New State Transitions
continue to use version 4 and the normal current-sequence rule. This narrow
lifecycle provenance does not make an old report, Review Decision, Approval,
publication, or share current.

In one SurrealDB transaction, update the Work Item's type version, append the
immutable `work-item.type-migrated` Fact, and write the existing operation
receipt. Preserve the item's state, sequence, provider correspondence, Facts,
Workflow Runs, reports, Review Decisions, Approval Facts, Artifacts, and
publication or sharing history. A repeated operation identifier with identical
content returns the original result; changed content conflicts. A retry after
interrupted persistence either observes the committed migration and receipt or
leaves the previous item version with no migration Fact or receipt. A rejected
or rolled-back migration never writes partial state or history.

Changing version 3 to 4 changes a declared Review Workflow input. Existing
version-3 reports and Review Decisions remain immutable history but are no
longer current. The Work Item requires a fresh version-4 review and human Review
Decision before publication or finalization can proceed. No existing Approval is
transferred or rewritten.

## Public Board and verification seams

The public HTTP migration operation and protected Kanban Board are the behavior
seams. Board availability is advisory; the operation repeats authorization,
ownership, current state/version/sequence, pending-request, and mapping checks in
its transaction. Display retained version and Factory state independently from
Workflow execution state, and show successful migration history without changing
the Work Item's state or lifecycle sequence.

Verify migration authorization and cross-Organization isolation, Organization
selection affecting only new Work Items, both allowed mappings, unsupported and
stale mappings, active and cancellation-pending run exclusion, pending Transition
Request exclusion, same-state readiness provenance for `withdraw-review`, old
report/Decision invalidation, operation receipt replay/content mismatch, Board
visibility, and rollback after a real SurrealDB persistence failure. Retain a
suspended old-version Workflow Run across web, worker, and database restart and
verify it resumes under its original Workflow identifier without repeating
completed work. Keep provider and AI effects controlled at their system boundary.
