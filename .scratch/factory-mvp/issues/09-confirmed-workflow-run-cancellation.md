# Cancel a Workflow Run after a confirmed stop

Status: ready-for-agent
Type: AFK
Assignee: Codex
State: closed
User stories covered: 36, 39, 43, 44, 45

## Parent

[TBFactory MVP specification](../spec.md)

## What to build

Let an authorized User request cancellation of a running or suspended Workflow Run through UI/API. The worker confirms execution has stopped before releasing Work Item exclusivity.

## Acceptance criteria

- [x] Record cancellation processing, confirmed-stop evidence, and restart recovery contracts before implementation.
- [x] An authorized operation appends an immutable Cancellation Request Fact; UI/API distinguish the request from a confirmed stop.
- [x] Cancellation handles active execution and human suspension, including recovery after a process restart.
- [x] A recorded request alone cannot release exclusivity. A still-executing old run prevents both a replacement run and direct User/API transitions.
- [x] Preserve Facts, Artifacts, decisions, and completed Activities after cancellation.
- [x] If the accepted Work Item Type defines automatic cancellation, enforce its authorization rules and the same confirmed-stop invariant. No current Work Item Type defines automatic cancellation.
- [x] Provide public-flow checks for execution/suspension cancellation, request-versus-stop visibility, competing starts/transitions, restart recovery, and preserved completed work.

## Blocked by

- [Issue 05: Generate a private report in a durable Review Workflow](05-durable-private-review-report.md)

## Comments

The confirmed-stop, publication uncertainty, and manual restart-recovery contract is recorded in [the cancellation design](../designs/confirmed-workflow-run-cancellation.md). The [durable review operations guide](../../../docs/operations/durable-private-reviews.md#workflow-run-cancellation) documents the request API, protected UI, and recovery procedure.

### Resolution — 2026-10-06

Delivered on `integration/factory-mvp` in `8130fc4`. Eight focused cancellation tests passed against the dedicated `FACTORY_TEST_DATABASE_URL` database, covering authenticated API requests, scoped API Credential policy, suspended intake, active AI cancellation, retained report Artifact and Facts, crash recovery, missing publication dispatch tracking, and an authorized provider request held after its effect. `npm run format:check`, `npm run typecheck`, and `npm run build` passed.

The built HTTP review acceptance passed with web, worker, and SurrealDB restarts and no repeated AI call. The native T3 browser drill signed in through the controlled external identity provider and used the protected cancellation button. The UI first displayed `requested` with ownership retained, then `confirmed` after refresh. Public HTTP checks confirmed released ownership, unchanged `registered` Factory state, the same report identifier and unchanged private Artifact bytes, and both immutable cancellation Facts. Local execution evidence is in `.runtime/review-deaa2447-c686-4296-8f5e-4093d6a3a8ac/acceptance.json` and `browser-cancellation.json`; these generated files are not repository documentation or a production provider guarantee.
