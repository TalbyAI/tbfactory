# Authorized Transition Requests implementation plan

**Goal:** Implement the accepted [Issue 03 design](authorized-transition-requests.md).

**Architecture:** Public HTTP and protected board operations share Factory transactions. Platform definitions remain versioned; SurrealDB holds Teams, policies, pending requests, Approval, state and immutable history.

**Constraints:** Keep version 1 unchanged; no customer executable definitions; no Workflow installation in this increment; English documentation; commit on the feature branch.

Execute inline with `superpowers:executing-plans`; use public API and board seams already approved by the User. Each implementation slice starts with a failing public behavior test and ends with a focused test and typecheck.

- [x] Version selection and retention: add `src/server/work-item-types.ts`, selection storage and routes; verify new version 2 creation and unchanged old cards in `tests/transitions.test.ts`.
- [x] Atomic direct transitions: add `src/server/transitions.ts`, request storage and routes; verify prepare/withdraw inputs, confirmed Fact references, state/history rollback and idempotency through public reads.
- [x] Teams and policies: add `src/server/organization-management.ts`; extend existing authorization and scope validation; verify inherited grants, conflicting Teams, default deny, and ownership through public management/transition operations.
- [x] Approval: persist activity-bound pending requests and Approval Facts; verify separate same-Organization authority, credential limits, current permission rechecks, stale state and run exclusion.
- [x] Board: add `src/transition-board.tsx`, integrate with `src/routes/index.tsx`; expose retained definitions, request status, inputs, Approval, execution and operator controls through existing UI server functions.
- [x] Verification: run `npm run typecheck`, focused `npx tsx --test tests/transitions.test.ts`, then `npm test`, `npm run build`, and `npm run acceptance`; inspect the board through the T3 preview and record evidence.
- [x] Review: two independent `code-review` axes against baseline `82f31fc6ee2fcdfe0fe6a4b136e1dd7c91f3aecc`; fix findings, close the ticket, update the parent map and commit the reviewed work.
