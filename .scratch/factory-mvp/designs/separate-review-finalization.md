# Separate Review Finalization Workflow

Issue: [10](../issues/10-separate-review-finalization.md).
Implementation contract derived from the accepted transition, review-decision,
publication, sharing, and retained-version designs. This records implementation
choices for Issue 10 and does not change the accepted lifecycle or authorization
rules.

## Retained definitions and prerequisites

- Preserve Work Item Type definitions 1–5 and all their existing transitions and
  Approval Points. Do not add Approval Points or change their meanings.
- Install a distinct platform-owned `review-finalization-v1` Workflow for retained
  definitions 4 and 5. Definitions 1–3 keep their existing unavailable
  finalization prerequisite because they do not declare confirmed publication.
- Bind the Transition Request's `reportVersion` input to the current immutable
  report. Resolve the Review Workflow Run, complete human Review Decision, and any
  required publication record from Factory data; clients cannot provide or assert
  those prerequisite Facts.
- Resolve the original Review Workflow's immutable `workflow.completed` Fact by
  run and report. Later publication execution or cancellation status does not erase
  that completed review; the current complete human Review Decision is validated
  independently.
- Versions 4 and 5 require a terminal publication record bound to the same report,
  decision, Work Item, and Review Workflow Run. `completed` and explicitly
  confirmed `not-published` are resolved outcomes. A `not-published` outcome must
  have either immutable User recovery evidence or confirmed cancellation before
  provider dispatch, with matching publication, run, attempt, and evidence IDs.
  `skipped` is a resolved outcome only when the current human Review Decision
  confirms no Findings for publication. In-flight, failed, blocked, or uncertain
  publication is not resolved.
- A report must be the latest report for the Work Item and its declared review
  inputs must remain current. The Review Decision must be complete, human-authored,
  current, and tied to that report. Existing correction and supersession rules
  remain authoritative.

## Workflow ownership and execution

- Accept `finalize-review` only when its retained transition, expected state,
  definition version, current prerequisites, current execution permission, and
  run exclusivity validate. The Workflow Run receives a separate identity and
  `review-finalization-v1` version; it does not reuse or rewrite the Review
  Workflow Run.
- Persist the finalization Run, owning `activeRun`, accepted Transition Request,
  and acceptance Fact in the same Factory transaction. Capture the resolved
  report, decision, publication, and outcome in the Transition Request before any
  pending Approval. Include that snapshot in the `finalize-review` Approval digest
  and revalidate it when approving, executing, accepting, and completing. Other
  retained transition Approval bindings remain unchanged. Acceptance leaves
  Factory state unchanged. Existing request operation receipts make retries
  idempotent.
- Use the installation's existing separate Mastra worker and durable LibSQL
  Workflow storage. Finalization has no provider or AI side effects, so a stopped
  incomplete run can safely resume the same Workflow after existing confirmed-stop
  recovery.
- Immediately before completion, recheck ownership, retained type/state/sequence,
  latest current report, usable Review Decision, version-appropriate publication
  outcome, the original Execution Identity's current `transition.finalize-review`
  permission, and current authority for any recorded
  `approval.finalize-review` Approval.
- Recheck durable cancellation in the same completion transaction immediately
  before writing the State Transition. A pending cancellation leaves ownership in
  place and yields to the worker's confirmed-stop and publication-resolution flow.
- When stop is confirmed for a Finalization Workflow, atomically mark its bound
  running Transition Request `cancelled` with the Workflow Run and cancellation
  Fact references. Stopped-run recovery performs the same terminal update after
  confirming the execution stopped.
- In one SurrealDB transaction, persist the completed Transition Request, the
  Work Item's lifecycle-ending state, its successful `state.transition` Fact, the
  completed Workflow Run, and release of `activeRun`. Record the report, decision,
  publication outcome, Execution Identity, and Approval in transition history.
  Any rejection or interrupted transaction leaves the prior state and no
  successful State Transition Fact.
- If authorization is temporarily unavailable, retain ownership in a visible
  waiting state and resume the same durable Workflow after authority is restored.
  If report or other immutable prerequisites are no longer current, finish the
  attempt as visibly rejected, release ownership atomically, and leave Factory
  state unchanged so a new review can proceed.

## Public progress and verification

- The protected Transition Request API remains the request and execution seam.
  Existing Work Item reads and the type-specific Board expose the active
  finalization Workflow state separately from Factory state. Review history also
  lists the finalization Run while retaining Reports, Review Decisions, and
  publication history unchanged.
- The Board supplies the current report identifier from the protected review
  view; callers do not type or forge prerequisite Fact identifiers.
- Public-flow checks cover a successful finalization, missing or stale evidence,
  denied or revoked execution/Approval authority, competing active runs,
  atomic rollback, unchanged state after Review Workflow completion, retained v3
  unavailability, v4/v5 publication outcomes, and empty-publication `skipped`
  behavior.
- Exercise operations through the public Factory HTTP interface with persistent
  Factory and Workflow storage and a separate worker. Inject persistence failure
  at the database boundary and assert through Work Item and Fact reads.
