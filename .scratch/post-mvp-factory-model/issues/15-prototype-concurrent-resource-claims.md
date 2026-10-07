# Prototype concurrent Resource Claims and crash recovery

Status: ready-for-human
State: open
Type: HITL
Labels: wayfinder:prototype

## Parent

[Validate the extensible post-MVP Factory model](../spec.md)

## Question

Can the proposed protocol enforce two shared Branch readers, exclude a writer,
and allow independent work on another Branch under races and worker failure?

Use separate execution processes and durable coordination, with simulated external
effects. Exercise simultaneous acquisition, a queued writer, claim-bundle failure,
cancellation, delayed stale workers, and restart. Demonstrate that a sandbox does
not bypass Branch identity, and that emitting audit Assertions alone is insufficient.
Include input-version behavior when the provider changes outside the Factory.

Link failure traces and executable evidence in an isolated prototype. The User
judges the claim semantics; a passing local experiment must not overclaim safe
coordination of arbitrary external providers.

## Blocked by

- [Research Effect 4 and Mastra execution boundaries](03-effect4-and-mastra-boundaries.md)
- [Define Resource Claim identity, compatibility, and lifecycle](09-resource-claim-protocol.md)
- [Define persistence Ports and atomic consistency boundaries](21-persistence-ports-and-atomic-boundaries.md)

## Comments

No work has been claimed or resolved.
