# Define Factory Plugin and declarative composition contracts

Status: ready-for-human
State: open
Type: HITL
Labels: wayfinder:grilling

## Parent

[Validate the extensible post-MVP Factory model](../spec.md)

## Question

How does a hosting TypeScript project load local or published Factory Plugins and
expose their capabilities to permission-bound declarative UI configuration?

Preserve the agreed two extension levels. Define registration for adapters, step
types, rule expressions, integrations, types, validation, and reusable definitions.
Include packaged Ontologies, SHACL shapes, projections, rules, Triggers, and
Workflow presets alongside executable capabilities. Decide whether a complete
Factory pack is a preset bundle or a separate extension unit.
Decide namespaces, schemas, capability discovery, configuration scope, dependency
resolution, version retention, and handling of missing or incompatible plugins.
Distinguish trusted executable plugin installation from User configuration and
from permission to execute the resulting Activity. Plugins must not accidentally
become a tenant-isolation bypass or arbitrary UI-code execution mechanism.

Resolve with a minimal plugin manifest/registration example and an equivalent
User-authored declaration; document who is allowed to perform each action.

## Blocked by

- [Research Effect 4 and Mastra execution boundaries](03-effect4-and-mastra-boundaries.md)
- [Research declarative rule and extension mechanisms](05-declarative-rules-and-extension-mechanisms.md)
- [Choose Ontology, SHACL, projection, and rule boundaries](06-ontology-validation-and-dsl-boundaries.md)

## Comments

No work has been claimed or resolved.
