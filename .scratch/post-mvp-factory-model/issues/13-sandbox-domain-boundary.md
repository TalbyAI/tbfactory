# Decide whether Sandbox belongs in the Factory model

Status: ready-for-human
State: open
Type: HITL
Labels: wayfinder:grilling

## Parent

[Validate the extensible post-MVP Factory model](../spec.md)

## Question

Does Sandbox need a first-class Factory identity, history, ownership, and claim
contract, or should it remain a capability behind an execution adapter?

Compare both options using separate sandboxes for concurrent Branch work, immutable
review inputs, credential delivery, cleanup after crashes, and long human waits.
Distinguish the claimed external Branch from an isolated checkout and from a
specific worker process. Preserve the ability to use Mastra-provided capabilities
without coupling the whole domain to its concrete Sandbox API.

Resolve with the minimum responsibilities that the Factory must expose and the
prototype evidence required. Do not promote an infrastructure API into a domain
concept solely because it is available.

## Blocked by

- [Research Effect 4 and Mastra execution boundaries](03-effect4-and-mastra-boundaries.md)
- [Define Resource Claim identity, compatibility, and lifecycle](09-resource-claim-protocol.md)
- [Define Workflow, agent, step, and execution-adapter contracts](10-workflow-runtime-and-step-contracts.md)

## Comments

No work has been claimed or resolved.
