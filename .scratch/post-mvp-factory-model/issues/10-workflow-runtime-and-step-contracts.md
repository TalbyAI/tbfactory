# Define Workflow, agent, step, and execution-adapter contracts

Status: ready-for-human
State: open
Type: HITL
Labels: wayfinder:grilling

## Parent

[Validate the extensible post-MVP Factory model](../spec.md)

## Question

What does the Factory guarantee about a Workflow Run, and which responsibilities
belong to Effect 4, Factory orchestration, Mastra, or another execution adapter?

Define declarative control flow, deterministic steps, nondeterministic agents,
inputs/results, human waits, resume/retry, cancellation, claim ownership, budgets,
observability, and uncertain external effects. Specify how adapters expose tools
and integrations without bypassing execution authorization. A deterministic graph
must not imply deterministic agent output or exactly-once provider effects.

Decide reusable step/Workflow boundaries and version retention. Resolve with one
missing-input chain and one review run, including restart and revoked access.
Identify which abstraction must be proved before broader libraries are proposed.

## Blocked by

- [Research Effect 4 and Mastra execution boundaries](03-effect4-and-mastra-boundaries.md)
- [Define classification and Trigger activation semantics](08-classification-and-trigger-semantics.md)
- [Define Resource Claim identity, compatibility, and lifecycle](09-resource-claim-protocol.md)

## Comments

No work has been claimed or resolved.
