# Finalize a Work Item through the Review Finalization Workflow

Status: ready-for-agent
Assignee: Codex
State: open
Type: AFK
User stories covered: 13, 17, 18, 34, 35, 39

## Parent

[TBFactory MVP specification](../spec.md)

## What to build

Handle an authorized Transition Request by starting the distinct Review Finalization Workflow and performing the type's permitted lifecycle-ending State Transition. Keep review and publication completion separate from Work Item finalization.

## Acceptance criteria

- [ ] Report generation, Review Decision, publication, and Review Workflow completion do not themselves finalize or change the Work Item.
- [ ] Validate the agreed type's finalization inputs, confirmed prerequisite Facts, current authorization, and run exclusivity before finalization proceeds.
- [ ] Only the owning Review Finalization Workflow performs its permitted State Transition while active.
- [ ] Persist the lifecycle-ending current Factory state and State Transition Fact consistently; rejection or interrupted persistence cannot leave a misleading successful transition.
- [ ] Expose finalization execution progress separately from Factory state through UI/API and preserve review/publication history.
- [ ] Provide public-flow checks for successful finalization, missing prerequisites, denied authorization, competing runs, interrupted persistence, and review completion with unchanged Factory state.

## Blocked by

- [Issue 07: Publish confirmed Findings and reconcile uncertain outcomes](07-confirmed-publication-and-reconciliation.md)

## Comments

Implementation evidence is recorded in [the finalization design contract](../designs/separate-review-finalization.md) and [the public-flow finalization tests](../../../tests/finalization.test.ts). Focused HTTP/Worker scenarios cover independent finalization, retained publication prerequisites, same-report Approval binding, authorization rechecks and restart, cancellation ownership, safe nonpublication, recovery, and atomic persistence failure. `npm run format:check`, `npm run typecheck`, and `npm run build` pass. Root's built UI/browser verification is still pending; keep this issue open until that check is recorded.
