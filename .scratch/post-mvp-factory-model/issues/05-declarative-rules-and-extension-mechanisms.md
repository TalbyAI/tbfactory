# Research declarative rule and extension mechanisms

Status: ready-for-agent
State: closed
Type: AFK
Labels: wayfinder:research
Assignee: Codex research declarations

## Parent

[Validate the extensible post-MVP Factory model](../spec.md)

## Question

Which small set of existing mechanisms can support plugin-extensible declarative
classification, projections, and Workflow composition in a TypeScript Factory?

Compare up to four representative approaches, including a typed data/AST contract,
a maintained expression/rule evaluator, a semantic-query or rule approach, and
Mastra's official composition facilities. Use maintained first-party docs/source.
Assess history versus projection input, binary/multidimensional outputs, custom
plugin expressions, validation, cost limits, diagnostics, and version retention.
Check what a UI User can configure without executing arbitrary code, and what
installation-loaded TypeScript plugins must register or own.

Separate ontology vocabulary, SHACL validation, projection evaluation, rule
classification, and Trigger dispatch even if one library spans several. Record
trade-offs and evidence gaps rather than selecting a DSL or creating a framework.

## Blocked by

None - can start immediately.

## Comments

### 2026-10-06 — Research claimed

Claimed by Codex research declarations during initial map charting. Research will use
primary sources and record its evidence in
[Research declarative rule and extension mechanisms](../research/declarative-extension-mechanisms.md).
Work takes place on `research/post-mvp-declarations` in the isolated worktree
`E:/talby/tbfactory-research-post-mvp-declarations`.
Research evidence does not approve downstream HITL decisions.

### Resolution — 2026-10-06

The [primary-source comparison](../research/declarative-extension-mechanisms.md)
distinguishes a host-owned typed AST/schema contract, CEL expressions, RDF/SPARQL
with SHACL, and Mastra Workflow composition. Schema validation does not supply
rule evaluation. The reviewed CEL ECMAScript implementation is beta, and the host
still owns inputs, cost limits, outputs, and evaluator versions. SHACL validation,
optional graph inference, and Trigger dispatch have different responsibilities.
Mastra's reviewed composition APIs do not establish a general Factory Plugin or
UI-authored definition registry.

The research is resolved as documentary evidence, not a selected DSL. Exact schema
interop, expression limits, plugin compatibility, and declarative authoring remain
decisions and prototype obligations in the linked child tickets. No runtime
integration experiment was executed.

Evidence is retained on `research/post-mvp-declarations` at commit
`efce6cf8ac86a19c6595327e869324fe1a7f642a` and copied into this effort's research
directory. The isolated worktree passed `npm run format:markdown` and
`npm run format:check` before its evidence-only commit.
