# Authorized Transition Requests

Status: accepted by the User on 2026-10-03; human checkpoint for [Issue 03](../issues/03-authorized-transition-requests.md) resolved.

This proposal preserves the accepted foundations and ADRs 0003, 0004, 0005, 0006, 0007, and 0009. It defines the contracts needed for Issue 03; it does not install the later Review Workflow or Review Finalization Workflow.

## Approach and alternatives

Recommended: retain the existing platform-owned `pull-request-review` version 1 unchanged and introduce version 2 for the authorized lifecycle. Use the existing Factory transaction boundary for public API and board operations. Persist pending direct Transition Requests and activity-bound Approvals in SurrealDB.

Changing version 1 in place would silently reinterpret existing Work Items and contradict ADR 0007. Implementing the full review and finalization Workflows here would absorb Issues 05–10 and prevent the requested unavailable-Workflow behavior from being independently verified.

## Definitions and Organization selection

Version 1 retains its single `registered` state and has no transitions. Version 2 has `registered`, `ready-for-review`, and `completed` Factory states. These states express lifecycle, not whether a Workflow Run is running, suspended, failed, or finished.

Organizations select an available platform-owned type/version for new Work Items and may disable creation for that selection. Existing Organizations without an explicit selection retain the version 1 creation default. A selection change applies only to new Work Items. Both definitions remain deployed and readable. Configuration accepts only the selected version and creation-enabled flag; states, executable code, transition rules, Approval Point rules, and Workflow installation flags are not customer inputs.

The type-specific Kanban Board includes the retained version on each card and resolves states and available actions using that version. Mixed retained versions share state columns by state identifier; a version 1 card has no transition actions. Unknown retained definitions fail explicitly rather than using the latest version.

## Concrete lifecycle, inputs, and prerequisites

| Request identifier | Source | Result | Handling | Required inputs and confirmed prerequisites |
| --- | --- | --- | --- | --- |
| `prepare-review` | `registered` | `ready-for-review` | Direct | Nonempty `reviewBrief`, at most 10,000 characters |
| `withdraw-review` | `ready-for-review` | `registered` | Direct | Nonempty `reason`; `readinessFact` identifying the latest successful `prepare-review` or `reopen-review` State Transition Fact for this Work Item |
| `request-review` | `ready-for-review` | Unchanged | Review Workflow | `reviewBrief`; installed platform Review Workflow, unavailable in Issue 03 |
| `finalize-review` | `ready-for-review` | `completed` | Review Finalization Workflow | Current report version, complete human Review Decision, and confirmed publication outcome for that report; installed finalization Workflow, unavailable in Issue 03 |
| `reopen-review` | `completed` | `ready-for-review` | Direct | Nonempty `reason` and `reviewBrief`; `finalizationFact` identifying this Work Item's successful finalization State Transition Fact |

Prerequisite Fact identifiers are resolved and validated inside the execution transaction: same Organization and Work Item, authoritative successful State Transition kind, correct request and destination, and the current lifecycle occurrence. A note, correction, source observation, request Fact, or Approval Fact cannot substitute for a successful State Transition. Clients cannot supply confirmed evidence merely by setting a flag. For `withdraw-review`, the readiness Fact must still be the most recent State Transition into `ready-for-review`.

The board collects the required text and selects the applicable immutable prerequisite Fact. Missing or malformed input is rejected; missing, mismatched, or superseded prerequisites reject execution without a successful State Transition Fact.

A Review Workflow completes without changing Factory state. A later rerun creates a new request/run and report version, requires current inputs and permissions, and is allowed only after the preceding run has conclusively released exclusivity. Relevant report/input changes require renewed Review Decision and Approval; unrelated Facts do not invalidate them. Detailed report and publication record formats remain owned by Issues 05–07, and finalization execution by Issue 10. Neither Workflow can be enabled by Organization configuration in Issue 03.

## Transition Requests, Approval Points, and outcomes

Direct requests carry a caller-generated operation identifier, explicit transition identifier, expected current Factory state, retained state-flow version, and strict transition-specific inputs. The Execution Identity is the authenticated User, never a client-selected principal. Bearer credentials additionally retain their credential identity and maximum Activity scope.

Expose separate Activities for requesting/executing each transition and for approving that transition. Each direct definition declares an activity-bound Approval Point used when an applicable execution policy requires human intervention. An authenticated browser request is still subject to this Approval requirement; merely being human is not an Approval.

Without human intervention, a permitted direct request completes in one transaction. Return an outcome explicitly identifying the request as accepted and the State Transition as completed, with the resulting Work Item and successful State Transition Fact. With human intervention, return an accepted request in `pending-approval` status, with unchanged Factory state and no successful State Transition Fact. Waiting is durable and does not claim to be an active Workflow Run.

An authorized same-Organization human can approve the specific pending request through a browser session. Approval requires its own Activity permission and active Membership; API credentials cannot provide human Approval. The approver may also be the requester if they independently hold both authorities; this proposal introduces no mandatory second-person rule.

Approval records the request, Execution Identity, transition Activity, retained definition version, expected state, normalized inputs, and validated prerequisite Fact identifiers. Approval never executes the transition implicitly. A separate execute operation, performed by the original Execution Identity, revalidates its current authentication, credential bounds where applicable, active Membership, every applicable policy, prerequisites, current state, definition version, and run exclusivity immediately before writing state/history.

Approval cannot grant missing execution permission or override a prohibition. Relevant state/version/prerequisite/input changes invalidate the pending request; a fresh request and Approval are required. Unrelated notes and Facts preserve the request's validity. A request cannot be edited in place. Repeated identical operation identifiers return their prior result after current caller visibility/authorization checks; changed content conflicts. Re-execution of a completed request cannot duplicate a State Transition, even with a new operation identifier.

## Teams and scoped policies

Add Organization-owned Teams with a name and associated active Organization Members. Teams are not tied to one Project or Repository; all Teams associated with an Execution Identity are evaluated for any applicable scope.

Preserve existing per-User policies and add Team principals. A policy targets either a User or a Team and has an Organization, Project, Repository, Team, or User scope, an Activity, and an `allow`, `deny`, or `human` effect. A Team-scope policy applies when that Team is associated with the Execution Identity. User scope applies to that User. A Team-principal policy applies to each associated member. No applicable allow means deny; any applicable deny prevails; any applicable human requirement means Approval is needed for transition execution. Existing non-transition Activities keep their current human/browser rule.

Organization operators manage Team membership and install/remove policies through protected public operations and a minimal board-adjacent management UI. These operations require explicit Organization-scoped `team.manage` and `policy.manage` Activities. Policy management is explicit authority to change Organization permissions; it does not bypass denies on the management Activity itself. Record management changes in append-only Organization audit records, not Work Item Facts.

Validate principal, Team memberships, and every referenced scope in the same transaction. Cross-Organization User Membership, Team, Project, and Repository associations are rejected without writes. Removing a Team member or policy takes effect on the next authorization check; pending Approval does not freeze grants.

## Atomic persistence and exclusivity

Use the existing SurrealDB transaction/retry contract. Store the successful State Transition's immutable Fact, Work Item current state, completed request, and operation receipt in the same transaction. Pending requests and Approval Facts are separately atomic operations and do not imply transition completion. Any rejected request or interrupted completion transaction leaves the previous state, no successful State Transition Fact, and no successful completion receipt.

Check the expected state and retained version on every execution. Concurrent requests conflict or retry against current state; at most one may perform a given state change. The successful Fact records source/destination states, retained definition version, request identifier, Execution Identity, inputs, prerequisites, and Approval identifier when required.

Reserve a persisted active-run association on the Work Item, checked transactionally before direct execution. It covers running, suspended, waiting-for-Approval, and cancellation-requested-but-not-confirmed-stopped runs. Later Workflow ownership operations must acquire/release that same association transactionally with their authoritative run record. Issue 03 creates no Workflow Runs and exposes Workflow Run execution state separately as absent; it rejects direct execution for a retained active-run association. New notes/Facts remain admissible.

## Explicit migration behavior

No creation setting or deployment migrates existing Work Items. Version 1 remains read-only for transitions. Issue 11 owns the explicit migration operation: separately authorized, no active run, an allowlisted `registered` version 1 to `registered` version 2 mapping, and one atomic version update/migration Fact/receipt. Unsupported mappings, pending Transition Requests, missing prerequisites, and active runs reject migration. Pending Approvals are never transferable to another state-flow version.

## Public boundaries and UI

Expose protected routes under `/api/organizations/{organization}` for available Work Item Types and Organization selections, Teams and membership updates, scoped policy list/install/remove, a type-specific board, transition request creation/list/read, Approval, and execution. Use strict schemas and caller-generated operation identifiers for every mutation. Preserve the existing 401/403/404/409/422 error conventions and same-origin browser protections.

The board uses `uiRead`/`uiWrite` and the same HTTP/Factory contracts as bearer clients. Cards display Factory state, retained version, and Workflow Run execution state separately. Available actions identify unavailable Workflows, missing inputs/prerequisites, and pending Approval. Server validation remains authoritative even when the board was loaded before policy/state changes. Provide explicit Approval and execution controls and show request acceptance separately from completed State Transition history.

## Verification seams and completion

Use the public HTTP API, protected board/server-function boundary, and an actual browser for board behavior, as requested by the ticket and parent specification. Run integration tests against real SurrealDB; inject interrupted persistence only at the database boundary and observe outcomes through public Work Item/history reads. No tests of private transition helpers or mocked internal collaborators.

Implement vertical red/green slices for version selection/retention, direct completion and strict rejection, rollback and concurrent retry, Team-policy composition and cross-Organization rejection, pending Approval and separate authority, revoked permission and stale evidence, run exclusion, and unavailable Workflows. Include browser checks for allowed/rejected board actions, pending Approval, and state/history consistency. Run typechecking and focused test files throughout, then the complete suite and production build/acceptance checks at the end.

Review the final diff against both repository standards and Issue 03 using the `code-review` skill. Commit reviewed implementation on `feature/authorized-transition-requests`, never on `main`. Keep the issue open until implementation and public/board verification satisfy its acceptance criteria.
