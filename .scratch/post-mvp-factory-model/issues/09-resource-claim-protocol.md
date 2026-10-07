# Define Resource Claim identity, compatibility, and lifecycle

Status: ready-for-human
State: open
Type: HITL
Labels: wayfinder:grilling

## Parent

[Validate the extensible post-MVP Factory model](../spec.md)

## Question

What claim protocol realizes the agreed shared-reading and exclusive-modification
intentions, including exact Branch identity and durable Workflow Run ownership?

Specify keys and scopes, acquisition/release, conflict and waiting policy, claim
bundles, fairness, cancellation, worker failure, fencing, and uncertain outcomes.
Decide how an aspect claim on a Work Item relates to Branch access; independent
Branches in one Repository must remain usable concurrently. Multiple sandboxes
must not be mistaken for separate identities of the same claimed Branch.

Define read input versions and the behavior when an external provider changes the
Branch outside Factory coordination. Decide which Assertions audit claims and which
atomic mechanism grants them. Address paused human waits and intention changes.
Resolve with compatibility examples and failure traces; identify the replacement
required for ADR 0004 without changing MVP execution.

## Blocked by

- [Define shared element identity and the Assertion contract](01-element-identity-and-fact-contract.md)
- [Research durable shared-read and exclusive-write coordination](04-durable-resource-coordination.md)

## Comments

No work has been claimed or resolved.
