# Cancel a Workflow Run after a confirmed stop

Status: ready-for-agent
Type: AFK
Assignee: Codex
State: open
User stories covered: 36, 39, 43, 44, 45

## Parent

[TBFactory MVP specification](../spec.md)

## What to build

Let an authorized User request cancellation of a running or suspended Workflow Run through UI/API. The worker confirms execution has stopped before releasing Work Item exclusivity.

## Acceptance criteria

- [x] Record cancellation processing, confirmed-stop evidence, and restart recovery contracts before implementation.
- [ ] An authorized operation appends an immutable Cancellation Request Fact; UI/API distinguish the request from a confirmed stop.
- [x] Cancellation handles active execution and human suspension, including recovery after a process restart.
- [x] A recorded request alone cannot release exclusivity. A still-executing old run prevents both a replacement run and direct User/API transitions.
- [x] Preserve Facts, Artifacts, decisions, and completed Activities after cancellation.
- [x] If the accepted Work Item Type defines automatic cancellation, enforce its authorization rules and the same confirmed-stop invariant. No current Work Item Type defines automatic cancellation.
- [ ] Provide public-flow checks for execution/suspension cancellation, request-versus-stop visibility, competing starts/transitions, restart recovery, and preserved completed work.

## Blocked by

- [Issue 05: Generate a private report in a durable Review Workflow](05-durable-private-review-report.md)

## Comments

The confirmed-stop, publication uncertainty, and manual restart-recovery contract is recorded in [the cancellation design](../designs/confirmed-workflow-run-cancellation.md). The [durable review operations guide](../../../docs/operations/durable-private-reviews.md#workflow-run-cancellation) documents the request API, protected UI, and recovery procedure.

Eight focused cancellation tests passed against the dedicated `FACTORY_TEST_DATABASE_URL` database, covering authenticated API requests, scoped API Credential policy, suspended intake, active AI cancellation, retained report Artifact and Facts, crash recovery, missing publication dispatch tracking, and an authorized provider request held after its effect. `npm run format:check`, `npm run typecheck`, and `npm run build` passed. The remaining acceptance gate is the built/browser cancellation UI drill using `uiItems.cancellation` from `tests/review-acceptance.ts --hold`; State remains open for the root integration check.
