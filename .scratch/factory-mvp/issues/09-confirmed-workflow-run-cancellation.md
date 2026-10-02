# Cancel a Workflow Run after a confirmed stop

Status: ready-for-agent
Type: AFK
User stories covered: 36, 39, 43, 44, 45

## Parent

[TBFactory MVP specification](../spec.md)

## What to build

Let an authorized User request cancellation of a running or suspended Workflow Run through UI/API. The worker confirms execution has stopped before releasing Work Item exclusivity.

## Acceptance criteria

- [ ] Record cancellation processing, confirmed-stop evidence, and restart recovery contracts before implementation.
- [ ] An authorized operation appends an immutable Cancellation Request Fact; UI/API distinguish the request from a confirmed stop.
- [ ] Cancellation handles active execution and human suspension, including recovery after a process restart.
- [ ] A recorded request alone cannot release exclusivity. A still-executing old run prevents both a replacement run and direct User/API transitions.
- [ ] Preserve Facts, Artifacts, decisions, and completed Activities after cancellation.
- [ ] If the accepted Work Item Type defines automatic cancellation, enforce its authorization rules and the same confirmed-stop invariant.
- [ ] Provide public-flow checks for execution/suspension cancellation, request-versus-stop visibility, competing starts/transitions, restart recovery, and preserved completed work.

## Blocked by

- [Issue 05: Generate a private report in a durable Review Workflow](05-durable-private-review-report.md)

