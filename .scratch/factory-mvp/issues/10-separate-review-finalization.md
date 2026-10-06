# Finalize a Work Item through the Review Finalization Workflow

Status: ready-for-agent
Assignee: Codex
State: closed
Type: AFK
User stories covered: 13, 17, 18, 34, 35, 39

## Parent

[TBFactory MVP specification](../spec.md)

## What to build

Handle an authorized Transition Request by starting the distinct Review Finalization Workflow and performing the type's permitted lifecycle-ending State Transition. Keep review and publication completion separate from Work Item finalization.

## Acceptance criteria

- [x] Report generation, Review Decision, publication, and Review Workflow completion do not themselves finalize or change the Work Item.
- [x] Validate the agreed type's finalization inputs, confirmed prerequisite Facts, current authorization, and run exclusivity before finalization proceeds.
- [x] Only the owning Review Finalization Workflow performs its permitted State Transition while active.
- [x] Persist the lifecycle-ending current Factory state and State Transition Fact consistently; rejection or interrupted persistence cannot leave a misleading successful transition.
- [x] Expose finalization execution progress separately from Factory state through UI/API and preserve review/publication history.
- [x] Provide public-flow checks for successful finalization, missing prerequisites, denied authorization, competing runs, interrupted persistence, and review completion with unchanged Factory state.

## Blocked by

- [Issue 07: Publish confirmed Findings and reconcile uncertain outcomes](07-confirmed-publication-and-reconciliation.md)

## Comments

### Resolution — 2026-10-06

Delivered on `integration/factory-mvp` in `295e9fd`. Implementation evidence is recorded in [the finalization design contract](../designs/separate-review-finalization.md) and [the public-flow finalization tests](../../../tests/finalization.test.ts). Focused HTTP/Worker scenarios pass for independent finalization, retained publication prerequisites, same-report Approval binding, revoked execution and Approval authority across restart, cancellation ownership and terminal request history, safe nonpublication, stopped-run recovery, and rollback/retry after a real SurrealDB persistence interruption. `npm run format:check`, `npm run typecheck`, and `npm run build` pass.

The built publication/recovery fixture passed through web, worker, and database restart. In the native T3 browser, the protected Board request created a separate `review-finalization-v1` run while the worker was stopped. Factory state remained `ready-for-review`, the run was visibly queued, and competing Board actions were blocked. Starting the separate worker completed that same run, released ownership, and atomically recorded the `completed` Factory state and its own State Transition Fact. Board and review refresh exposed completed Factory state and finalization progress separately. Public HTTP checks confirmed unchanged report identifiers, Review Decisions and publication history. Local generated evidence is in `.runtime/review-67741ea6-d765-4c07-8a23-b4dbe8d67895/finalization-acceptance.json` and `browser-finalization.json`.
