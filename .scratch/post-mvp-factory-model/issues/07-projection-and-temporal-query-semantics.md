# Define projection and temporal-query semantics

Status: ready-for-human
State: open
Type: HITL
Labels: wayfinder:grilling

## Parent

[Validate the extensible post-MVP Factory model](../spec.md)

## Question

How does a consumer obtain a specific, reproducible projection from immutable
Assertions, and how are different projections of one element kept intelligible?

Decide scalar selection, source authority, recording versus validity time,
out-of-order ingestion, defaults, unknown values, collection accumulation/removal,
corrections/retractions, derived properties, graph references, and historical views.
Specify which definition version and history boundary a projection uses. Keep
external state separate from Factory lifecycle state, and decide whether validated
State Transitions impose constraints beyond an arbitrary last-value reducer.

Resolve with concrete histories and expected projections, replay requirements,
and the boundary between projection semantics and storage/caching strategy.

Apply the resolved identity contract: only Assertion Bundles have cross-Bundle
identity; Assertion-local names cannot be correction targets in another Bundle.
Correction, retraction, and state-sequence interpretation use concrete predicates
and their Ontology-specific projection rules, without a generic Factory correction
operation. Use `[start, end)` intervals, distinguish unknown from unbounded time
limits, and preserve missing/unknown/empty distinctions in the example policies.

## Blocked by

- [Define shared element identity and the Assertion contract](01-element-identity-and-fact-contract.md)
- [Choose Ontology, SHACL, projection, and rule boundaries](06-ontology-validation-and-dsl-boundaries.md)

## Comments

No work has been claimed or resolved.
