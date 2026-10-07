# Define configuration authority and definition evolution

Status: ready-for-human
State: open
Type: HITL
Labels: wayfinder:grilling

## Parent

[Validate the extensible post-MVP Factory model](../spec.md)

## Question

How can Organizations safely create and change declarative definitions without
weakening isolation or silently changing the meaning of existing Assertions and runs?

Specify installation versus Organization authority, configuration permissions,
Execution Identity, runtime capability limits, cross-Organization references, and
rechecking authorization before external effects. Compare version retention and
explicit migration for ontology, shapes, projection/rule expressions, Workflow,
step, plugin, and Work Item definitions; distinguish deployment from activation.
Specify which definitions govern Factory lifecycle states when one Element has
multiple descriptive types and how their versions and authority remain explicit.
Multi-typing does not implicitly select one lifecycle or grant transition authority.

Use the authoring prototype to examine a plugin update, a removed expression,
a changed rule during a human wait, and revoked Membership/credentials. Resolve
which policies are fixed core contracts and which are configurable. Record future
ADR 0003/0007/0009 implications without changing accepted MVP rules.

## Blocked by

- [Define Factory Plugin and declarative composition contracts](11-plugin-and-declarative-composition-contract.md)
- [Define inbound and outbound integration contracts](12-channels-and-external-correspondence.md)
- [Prototype plugin authoring and declarative UI composition](17-prototype-plugin-authoring-and-ui-composition.md)

## Comments

No work has been claimed or resolved.
