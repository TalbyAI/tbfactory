# Execute authorized Transition Requests from the Kanban Board and API

Status: ready-for-agent
Type: HITL
Assignee: Codex
State: closed
User stories covered: 13, 14, 15, 16, 17, 18, 19, 40, 52, 53, 54, 55, 56, 57, 58, 64, 66

## Parent

[TBFactory MVP specification](../spec.md)

## What to build

Let Organizations select supported Work Item Types and let Users execute permitted direct Transition Requests from a type-specific Kanban Board or the public API. Deliver scoped policies, Teams, and activity-bound human Approval as part of this authorized transition path.

Human checkpoint: Agree and record the concrete review states, allowed State Transitions, Approval Points, input collection, confirmed prerequisites, rerun rules, and explicit migration behavior before dependent implementation. Record atomic state/history persistence and authorization contracts before implementing them.

## Acceptance criteria

- [x] Organizations can select and configure available platform-owned types; customer-supplied executable definitions are not accepted. The board uses each Work Item's retained state-flow version.
- [x] UI and API enforce the same transition rules, required inputs, confirmed prerequisite Facts, and authorization. Request acceptance is distinguishable from a completed State Transition.
- [x] Without an active run, a permitted direct transition persists current Factory state and its State Transition Fact consistently. Rejection or interrupted persistence leaves neither a changed state nor a misleading successful-transition Fact.
- [x] Organization operators can manage Teams across their Organization's Projects and Repositories and policies at Organization, Project, Repository, Team, and User scopes.
- [x] Evaluate an explicit Execution Identity and every applicable Team: default deny, inherited grants, and prevailing explicit prohibitions. Invalid cross-Organization associations are rejected.
- [x] Any applicable human-intervention requirement prevents automatic execution until a permitted activity-bound Approval. Approval requires separate authority and same-Organization Membership and cannot supply missing execution permission or override a prohibition.
- [x] Recheck execution authorization immediately before the Activity proceeds; permission revoked after Approval prevents execution.
- [x] Expose Factory state separately from Workflow Run execution state. Keep Workflow-backed requests unavailable until their Workflow is installed.
- [x] Provide public API and board checks for allowed/rejected transitions, interrupted state/history persistence, conflicting Team policies, human intervention, cross-Organization Approval, and revoked execution permission.

## Blocked by

- [Issue 02: Create an authenticated, Organization-scoped Work Item](02-authenticated-organization-work-items.md)

## Comments

### 2026-10-03 — Human checkpoint proposal

Issue 02 is closed. Repository exploration confirmed that `pull-request-review` version 1 has only `registered` and no exposed State Transitions. The [authorized Transition Requests design](../designs/authorized-transition-requests.md) records concrete version 2 states, direct and unavailable Workflow-backed requests, inputs and confirmed prerequisites, Approval Points, rerun and migration behavior, atomic persistence, restrictive authorization, and public API/board verification seams. At the time of this initial proposal, human agreement was pending and dependent implementation had not started.

### 2026-10-03 — Human checkpoint accepted

The User explicitly approved the linked design and API/board testing contracts and requested continued implementation. The design is now accepted, and implementation proceeded on `feature/authorized-transition-requests`. The same User may provide Approval when independently authorized; neither an Approval nor browser authentication grants missing execution permission.

### Resolution — 2026-10-03

Delivered retained platform definitions and Organization selection, the type-specific Kanban Board and shared public transition operations, atomic direct State Transitions, Organization-owned Teams and scoped restrictive policies, and durable activity-bound human Approval with current execution permission rechecks. Workflow-backed requests remain unavailable; explicit state-flow migration is specified for Issue 11 and does not happen on selection or deployment.

The [acceptance and review evidence](../evidence/authorized-transition-requests.md) records 24 passing tests, typecheck/build, 7 production acceptance groups including restart/restore, and real board checks for accepted/pending/completed requests, restrictive policies, interrupted persistence, and execution permission revoked after Approval. Both independent review axes have no unresolved findings. Issue 03 is closed.
