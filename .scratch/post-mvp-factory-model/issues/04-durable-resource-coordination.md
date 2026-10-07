# Research durable shared-read and exclusive-write coordination

Status: ready-for-agent
State: closed
Type: AFK
Labels: wayfinder:research
Assignee: Codex research coordination

## Parent

[Validate the extensible post-MVP Factory model](../spec.md)

## Question

Which durable coordination mechanisms can enforce Workflow Run access intentions
on an exact Resource identity across races, crashes, human waits, and cancellation?

Use primary documentation/source for transactional conflict control, shared-read
and exclusive-write locking, leases, fencing, and idempotent acquisition. Inspect
SurrealDB as the current persistence candidate, explicitly separating documented
capability from a proved reader/writer-claim protocol. Address the case where the
old worker or an external write continues after a lease expires.

Compare a durable coordination record plus immutable audit Facts with granting
ownership by appending Facts alone. Explain what atomic condition would make each
sound; avoid treating immutable history as mutual exclusion. Include Branch keys,
different Branch independence, writer starvation, claim bundles/deadlocks, uncertain
external outcomes, and the minimum falsification tests. Do not adopt a protocol.

## Blocked by

None - can start immediately.

## Comments

### 2026-10-06 — Research claimed

Claimed by Codex research coordination during initial map charting. Research will use
primary sources and record its evidence in
[Research durable shared-read and exclusive-write coordination](../research/durable-resource-coordination.md).
Work takes place on `research/post-mvp-coordination` in the isolated worktree
`E:/talby/tbfactory-research-post-mvp-coordination`.
Research evidence does not approve downstream HITL decisions.

### Resolution — 2026-10-06

The [coordination evidence](../research/durable-resource-coordination.md) records
SurrealDB's documented transactional conflict primitives separately from a
Factory reader/writer claim protocol. Shared-resource arbitration requires a
common atomic conflict boundary; reading grant Facts and independently appending
another Fact does not establish exclusivity. An audit Fact can accompany a
committed grant, while a Fact-only approach requires a conditional atomic append.

Lease expiry does not stop an old worker. Fencing requires the protected recipient
to reject stale ownership, and Factory claims cannot impose that guarantee on an
external provider that does not cooperate. Fairness, claim bundles, exact Branch
keys, deployment durability, and uncertain provider outcomes require explicit
protocol decisions and falsification tests.

The research question is resolved. No protocol or database version is adopted,
and no coordination implementation was executed. The claim and persistence
decision tickets retain ownership of those choices.

Evidence is retained on `research/post-mvp-coordination` at commit
`d905e2192a20f6596a6aae2b3839a86c21f6b909` and copied into this effort. The isolated
worktree passed `npm run format:markdown` and `npm run format:check` before its
evidence-only commit.
