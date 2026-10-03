# Execute authorized Transition Requests from the Kanban Board and API

Status: ready-for-human
Type: HITL
Assignee: Codex
State: open
User stories covered: 13, 14, 15, 16, 17, 18, 19, 40, 52, 53, 54, 55, 56, 57, 58, 64, 66

## Parent

[TBFactory MVP specification](../spec.md)

## What to build

Let Organizations select supported Work Item Types and let Users execute permitted direct Transition Requests from a type-specific Kanban Board or the public API. Deliver scoped policies, Teams, and activity-bound human Approval as part of this authorized transition path.

Human checkpoint: Agree and record the concrete review states, allowed State Transitions, Approval Points, input collection, confirmed prerequisites, rerun rules, and explicit migration behavior before dependent implementation. Record atomic state/history persistence and authorization contracts before implementing them.

## Acceptance criteria

- [ ] Organizations can select and configure available platform-owned types; customer-supplied executable definitions are not accepted. The board uses each Work Item's retained state-flow version.
- [ ] UI and API enforce the same transition rules, required inputs, confirmed prerequisite Facts, and authorization. Request acceptance is distinguishable from a completed State Transition.
- [ ] Without an active run, a permitted direct transition persists current Factory state and its State Transition Fact consistently. Rejection or interrupted persistence leaves neither a changed state nor a misleading successful-transition Fact.
- [ ] Organization operators can manage Teams across their Organization's Projects and Repositories and policies at Organization, Project, Repository, Team, and User scopes.
- [ ] Evaluate an explicit Execution Identity and every applicable Team: default deny, inherited grants, and prevailing explicit prohibitions. Invalid cross-Organization associations are rejected.
- [ ] Any applicable human-intervention requirement prevents automatic execution until a permitted activity-bound Approval. Approval requires separate authority and same-Organization Membership and cannot supply missing execution permission or override a prohibition.
- [ ] Recheck execution authorization immediately before the Activity proceeds; permission revoked after Approval prevents execution.
- [ ] Expose Factory state separately from Workflow Run execution state. Keep Workflow-backed requests unavailable until their Workflow is installed.
- [ ] Provide public API and board checks for allowed/rejected transitions, interrupted state/history persistence, conflicting Team policies, human intervention, cross-Organization Approval, and revoked execution permission.

## Blocked by

- [Issue 02: Create an authenticated, Organization-scoped Work Item](02-authenticated-organization-work-items.md)

## Comments

### 2026-10-03 — Human checkpoint proposal

Issue 02 is closed. Repository exploration confirmed that `pull-request-review` version 1 has only `registered` and no exposed State Transitions. The [authorized Transition Requests design proposal](../designs/authorized-transition-requests.md) records concrete version 2 states, direct and unavailable Workflow-backed requests, inputs and confirmed prerequisites, Approval Points, rerun and migration behavior, atomic persistence, restrictive authorization, and public API/board verification seams. These are proposals pending human agreement; dependent implementation has not started.
