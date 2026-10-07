# Research Effect 4 and Mastra execution boundaries

Status: ready-for-agent
State: closed
Type: AFK
Labels: wayfinder:research
Assignee: Codex research effect4

## Parent

[Validate the extensible post-MVP Factory model](../spec.md)

## Question

What is the verified current state of Effect 4, and how could an Effect-based
Factory core integrate with Mastra behind execution Ports and adapters?

Check official source and release documentation for exact versions and stability.
Investigate services/layers, schemas, typed errors, resource scopes, interruption,
concurrency, and available workflow/durability facilities specifically for v4;
separate v3 knowledge. Compare these responsibilities with Mastra steps, agents,
suspend/resume, snapshots, external-effect handling, and Sandbox APIs. Distinguish
current Mastra APIs from the repository's @mastra/core 1.74.0 pin.

Identify duplicate runtime responsibilities, Promise/Effect boundaries, interruption
and cancellation gaps, and a minimal integration experiment. State what documentation
cannot prove about recovery, exactly-once effects, or safe sandbox ownership.
Do not replace the requested Effect 4 direction or pick the architecture.

## Blocked by

None - can start immediately.

## Comments

### 2026-10-06 — Research claimed

Claimed by Codex research effect4 during initial map charting. Research will use
primary sources and record its evidence in
[Research Effect 4 and Mastra execution boundaries](../research/effect4-mastra-boundaries.md).
Work takes place on `research/post-mvp-effect4` in the isolated worktree
`E:/talby/tbfactory-research-post-mvp-effect4`.
Research evidence does not approve downstream HITL decisions.

### Resolution — 2026-10-06

The [versioned primary-source evidence](../research/effect4-mastra-boundaries.md)
checks Effect 4.0.1 and Mastra 1.74.0 separately from assumptions about runtime
interoperability. Effect supplies typed services, layers, schemas, errors, scopes,
and structured concurrency. Its cluster Workflow and SQL message-storage modules
exist but are marked unstable; their documented persistence facilities are not
an executed recovery proof or evidence of SurrealDB compatibility.

Mastra step execution crosses a Promise/AbortSignal boundary, and its Sandbox
capabilities depend on the configured provider. Neither runtime supplies the
Factory's claim, authorization, Fact-history, or definition-retention contract.
Durability ownership, interruption propagation, shared transactions, and uncertain
external effects remain explicit architectural and prototype questions.

The research is resolved without selecting an execution owner. No runtime
integration, restart test, prototype, or dependency change was performed.

Evidence is retained on `research/post-mvp-effect4` at commit
`cb6540ee72b75543632e2b789cc1b05811a9cb4e` and copied into this effort. The isolated
worktree passed `npm run format:markdown` and `npm run format:check`, and the
research's local ADR links were checked before its evidence-only commit.
