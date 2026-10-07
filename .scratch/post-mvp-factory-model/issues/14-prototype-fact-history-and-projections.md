# Prototype Assertion history, SHACL validation, and projections

Status: ready-for-human
State: open
Type: HITL
Labels: wayfinder:prototype

## Parent

[Validate the extensible post-MVP Factory model](../spec.md)

## Question

Can a small isolated artifact make the proposed identity, Assertion, validation, and
projection contracts understandable and falsifiable on realistic histories?

Use a pull request with a nested comment, external state and Factory state,
conflicting sources, delayed observations, corrections, defaults, and collection
removal. Show at least two consumer projections and an as-of query, with explicit
SHACL validation reports at the chosen boundary. Replay the same history/version
and compare outputs. Preserve incomplete/invalid evidence according to the design.
Reuse the same local Assertion name in different identified Bundles and prove
their local references remain isolated. Round-trip statement metadata and
intra-Bundle references without inventing global Assertion identifiers. Demonstrate
correction using concrete domain predicates and a separately specified projection
policy, plus missing/unknown/empty values and `[start, end)` validity bounds.

Link runnable commands and captured evidence under a self-contained prototype
subdirectory. The User must inspect the examples and decide whether the semantics
fit; success is a decision about the model, not completion of production storage.

## Blocked by

- [Define shared element identity and the Assertion contract](01-element-identity-and-fact-contract.md)
- [Choose Ontology, SHACL, projection, and rule boundaries](06-ontology-validation-and-dsl-boundaries.md)
- [Define projection and temporal-query semantics](07-projection-and-temporal-query-semantics.md)
- [Define persistence Ports and atomic consistency boundaries](21-persistence-ports-and-atomic-boundaries.md)

## Comments

No work has been claimed or resolved.
