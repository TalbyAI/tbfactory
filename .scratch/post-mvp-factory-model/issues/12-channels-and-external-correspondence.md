# Define inbound and outbound integration contracts

Status: ready-for-human
State: open
Type: HITL
Labels: wayfinder:grilling

## Parent

[Validate the extensible post-MVP Factory model](../spec.md)

## Question

How do Organization-configured channels create elements, append observations to
existing elements, and export authorized results through installed integrations?

Decide identity mapping, source namespaces, duplicate deliveries, ordering,
provenance, incomplete imports, correspondence conflicts, and relationships among
messages, pull requests, Repositories, and Branches. Distinguish creating a new
element from referencing or explicitly binding an existing one. Specify which
claim or authorization is required for export and how uncertain outcomes remain
visible. External events must not implicitly grant Factory execution authority.

Include an integration that performs several queries in a batch and offers their
results as one Assertion Bundle graph concerning several local Elements.
Distinguish group identity from upstream event/query identifiers and statement
provenance. Decide partial-query failure, source-time preservation, and repeated
delivery without assuming that grouping proves a simultaneous consistent snapshot.
Assertions have no global identities; any local names are for references inside
their own Bundle. Specify repeated-delivery and reused-Bundle-identity integrity
without introducing global per-Assertion deduplication or cross-Bundle assertion
references.
The agreed structure and terminology are recorded in
[Define shared element identity and the Assertion contract](01-element-identity-and-fact-contract.md).

Resolve with the message-origin scenario and an updated pull request; keep schema,
projection, Trigger, and provider transport responsibilities distinguishable.

## Blocked by

- [Define shared element identity and the Assertion contract](01-element-identity-and-fact-contract.md)
- [Define classification and Trigger activation semantics](08-classification-and-trigger-semantics.md)
- [Define Factory Plugin and declarative composition contracts](11-plugin-and-declarative-composition-contract.md)

## Comments

No work has been claimed or resolved.
