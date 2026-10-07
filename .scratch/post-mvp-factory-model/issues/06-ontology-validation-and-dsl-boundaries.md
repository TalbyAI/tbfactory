# Choose Ontology, SHACL, projection, and rule boundaries

Status: ready-for-human
State: open
Type: HITL
Labels: wayfinder:grilling

## Parent

[Validate the extensible post-MVP Factory model](../spec.md)

## Question

Which definitions belong in an Ontology, SHACL shapes, a projection DSL, a
classification DSL, or Workflow configuration, and how do those definitions refer
to one another without becoming one inseparable language?

Compare at least the ontology-owned projection semantics and separate-DSL options.
Decide the validation boundary for incoming Assertions and Assertion Bundles,
projected state, configuration,
and incomplete Work Items; invalid observations must not silently disappear.
Determine what is extensible and which concepts remain Factory contracts.
Use the resolved Bundle-scoped Assertion model: the Bundle is identified and
any Assertion names support references only within it. Ontologies and their
associated projection rules define concrete correction and state-sequence
predicates; there is no generic core correction relation. That responsibility
does not settle whether projection definitions live in the Ontology or a
separate DSL.

Resolve with a responsibility table, worked examples, and version/compatibility
expectations. SHACL is the requested validation direction, not a preselected
execution engine or assumption of automatic inference.

## Blocked by

- [Define shared element identity and the Assertion contract](01-element-identity-and-fact-contract.md)
- [Research RDF, SHACL, and temporal Fact representation](02-rdf-shacl-temporal-graphs.md)
- [Research declarative rule and extension mechanisms](05-declarative-rules-and-extension-mechanisms.md)

## Comments

No work has been claimed or resolved.
