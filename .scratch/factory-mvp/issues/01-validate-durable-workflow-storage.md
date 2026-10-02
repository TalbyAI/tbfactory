# Validate durable Workflow storage within one working day

Status: ready-for-agent
Type: AFK
User stories covered: 69, 70

## Parent

[TBFactory MVP specification](../spec.md)

## What to build

Evaluate the existing Mastra-SurrealDB adapter in an isolated, one-working-day prototype. Record a concrete Workflow storage decision based on observed behavior. SurrealDB remains the primary Factory database regardless of the result.

## Acceptance criteria

- [ ] Record mutually compatible pinned Node.js, Mastra, adapter, and SurrealDB versions, executed checks, failures, and actual effort. Use a disposable database with persistent storage.
- [ ] Complete a step, suspend a Workflow Run for human input, terminate the application process, and load/resume the same run in a fresh process. Verify retained outputs and no repetition of completed work.
- [ ] Repeat suspend/resume across a SurrealDB restart using the same persistent data.
- [ ] Verify retained results for parallel steps within one run and concurrent runs for different Work Items.
- [ ] Use recorded simulated external effects to verify replay behavior; do not claim this proves exactly-once production provider effects.
- [ ] Adopt the candidate only if the required checks pass within one working day. Otherwise select a Mastra-supported provider, record the failed criterion and selected compatible dependencies, and exclude substantial custom adapter development.

## Blocked by

None - can start immediately

