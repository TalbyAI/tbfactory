# Define classification and Trigger activation semantics

Status: ready-for-human
State: open
Type: HITL
Labels: wayfinder:grilling

## Parent

[Validate the extensible post-MVP Factory model](../spec.md)

## Question

How do rules inspect history or projections, produce binary or multidimensional
classifications, and cause a Trigger to request one eligible Workflow Run?

Decide deterministic versus agent-assisted evaluation, result evidence and
confidence if relevant, input versions, re-evaluation causes, trigger-on-change
versus level-triggered behavior, deduplication, recursion/feedback, and supersession.
Specify the relationship between processing-aspect ownership and Resource Claims;
multiple compatible runs must be possible without repeated starts of the same work.
Keep classification, authorization, Approval, and successful scheduling distinct.

Resolve using missing-input completion and two distinct reviews of one pull request.
Name the aspect/ownership concept only after its boundaries are agreed.

## Blocked by

- [Define shared element identity and the Assertion contract](01-element-identity-and-fact-contract.md)
- [Choose Ontology, SHACL, projection, and rule boundaries](06-ontology-validation-and-dsl-boundaries.md)
- [Define projection and temporal-query semantics](07-projection-and-temporal-query-semantics.md)
- [Research declarative rule and extension mechanisms](05-declarative-rules-and-extension-mechanisms.md)

## Comments

No work has been claimed or resolved.
