# Research RDF, SHACL, and temporal Fact representation

Status: ready-for-agent
State: closed
Type: AFK
Labels: wayfinder:research
Assignee: Codex research ontologies

## Parent

[Validate the extensible post-MVP Factory model](../spec.md)

## Question

Which primary-source standards and maintained TypeScript-compatible mechanisms
can represent and validate the proposed element graphs and immutable Fact history?

Investigate RDF datasets/named graphs, statement identity or annotation options,
provenance, recording time versus validity time, and W3C SHACL. Distinguish published
standards, drafts, optional features, and implementation support. Check whether
SHACL targets historical assertions, a projected graph, or both, and whether it
specifies projection/derivation semantics at all. Compare an RDF-native encoding
with a typed statement envelope translated to RDF for validation; do not assume
that a graph-shaped domain requires RDF-native storage.

Record current version/support evidence and candidate validation boundaries.
Provide small illustrative encodings, limitations, and the tests needed to choose
one. Research facts only; do not select the domain model or build a validator.

## Blocked by

None - can start immediately.

## Comments

### 2026-10-06 — Research claimed

Claimed by Codex research ontologies during initial map charting. Research will use
primary sources and record its evidence in
[Research RDF, SHACL, and temporal Fact representation](../research/rdf-shacl-temporal-facts.md).
Work takes place on `research/post-mvp-ontologies` in the isolated worktree
`E:/talby/tbfactory-research-post-mvp-ontologies`.
Research evidence does not approve downstream HITL decisions.

### Resolution — 2026-10-06

The [standards and implementation evidence](../research/rdf-shacl-temporal-facts.md)
separates a proposition from a Fact occurrence, and named-graph grouping from
application-defined identity, history, time, and provenance. RDF-native records
and typed envelopes translated to RDF are both representation candidates; neither
defines the Factory's authority, correction, or projection policy by itself.

SHACL validates the supplied data graph against shapes. Historical records and
already-constructed projections can be validated separately, but SHACL does not
define the Factory's temporal projection policy. PROV-O and OWL-Time provide
useful vocabulary without selecting that policy. RDF/SHACL draft capabilities
and claimed JavaScript/TypeScript processor support are distinguished from
published Recommendations and executed interoperability.

The research is resolved without choosing an encoding or processor. No validator
was installed or executed. The corrected illustrative RDF 1.2 triple-term example
was reviewed against the cited Turtle grammar; serialization and validation still
need the linked prototype. These findings inform the identity, semantic-boundary,
and persistence decisions rather than resolving them.

Evidence is retained on `research/post-mvp-ontologies` at commit
`cb24757001371b4b920e23135d4c3fbeb7af1f1e` and copied into this effort. The isolated
worktree passed `npm run format:markdown` and `npm run format:check` before its
evidence-only commit.
