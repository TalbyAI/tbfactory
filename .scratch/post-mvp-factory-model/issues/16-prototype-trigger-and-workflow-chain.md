# Prototype classification, Trigger dispatch, and Workflow handoff

Status: ready-for-human
State: open
Type: HITL
Labels: wayfinder:prototype

## Parent

[Validate the extensible post-MVP Factory model](../spec.md)

## Question

Can an incomplete Work Item receive inputs, become eligible, and start the next
Workflow exactly as specified, while compatible processing proceeds independently?

Compose the selected rule/Trigger contract with a minimal execution adapter.
Record rule inputs/results, aspect ownership, Resource Claims, and workflow output
Assertions. Inject repeated events, a rule feedback loop, restart between eligibility
and dispatch, and cancellation or revoked authorization before an external effect.
Use fake AI/tool outputs where their content is irrelevant to the decision.

Link the isolated prototype and traces showing pending, eligible, claimed, and
started states. The User must assess the handoff and explainability; the resolution
identifies architectural gaps rather than declaring an entire scheduler complete.

## Blocked by

- [Define classification and Trigger activation semantics](08-classification-and-trigger-semantics.md)
- [Define Workflow, agent, step, and execution-adapter contracts](10-workflow-runtime-and-step-contracts.md)
- [Define inbound and outbound integration contracts](12-channels-and-external-correspondence.md)
- [Prototype Assertion history, SHACL validation, and projections](14-prototype-fact-history-and-projections.md)
- [Prototype concurrent Resource Claims and crash recovery](15-prototype-concurrent-resource-claims.md)

## Comments

No work has been claimed or resolved.
