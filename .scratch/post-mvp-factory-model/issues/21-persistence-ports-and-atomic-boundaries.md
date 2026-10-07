# Define persistence Ports and atomic consistency boundaries

Status: ready-for-human
State: open
Type: HITL
Labels: wayfinder:grilling

## Parent

[Validate the extensible post-MVP Factory model](../spec.md)

## Question

Which persistence contracts let an Effect-based core store Assertion history, obtain
versioned projections, and grant claims atomically through replaceable adapters?

Compare RDF-native storage with typed Assertions and Assertion Bundles translated
to RDF at the validation boundary.
Specify append/deduplication, element identity, history selection and ordering,
projection checkpoints, atomic conditional writes, and tenant-scoped references.
Determine which invariants must be committed together and how audit Assertions relate
to granted ownership or dispatch records. Define consistency expectations for
classification and recovery without assuming that every adapter offers identical
transaction or query capabilities.

Explicitly define how an Assertion Bundle graph, carrying shared receipt/source
metadata and statement-specific attribution and validity, is admitted and linked
into Element histories. Preserve Bundle identity, Assertion content/metadata, and
Bundle-local references instead of flattening away provenance. Assertions have
no global identity, and their local names cannot address Assertions in another
Bundle. Distinguish receipt, validation/admission,
and projection; decide partial versus whole-group admission, rejected-evidence
retention, and atomic visibility. Coordinate this boundary with validation and
integration contracts. The adopted terms and remaining historical contracts are in
[Define shared element identity and the Assertion contract](01-element-identity-and-fact-contract.md).
Include one Assertion Bundle assembled from batched integration queries about several
Elements; do not assume one upstream event, one query, or one observation time per
group. Distinguish atomic history visibility from external snapshot consistency.
Define integrity behavior when a received Bundle identifier is reused with changed
content, without treating local Assertion names as cross-Bundle record identities.

Resolve with minimal Port contracts, adapter capability requirements, examples of
rejected insufficient implementations, and the prototype checks needed to validate
the chosen candidate. This is a contract decision, not production schema design,
database replacement, or a new MVP adapter implementation.

## Blocked by

- [Define shared element identity and the Assertion contract](01-element-identity-and-fact-contract.md)
- [Research RDF, SHACL, and temporal Fact representation](02-rdf-shacl-temporal-graphs.md)
- [Research Effect 4 and Mastra execution boundaries](03-effect4-and-mastra-boundaries.md)
- [Research durable shared-read and exclusive-write coordination](04-durable-resource-coordination.md)
- [Define projection and temporal-query semantics](07-projection-and-temporal-query-semantics.md)
- [Define Resource Claim identity, compatibility, and lifecycle](09-resource-claim-protocol.md)

## Comments

No work has been claimed or resolved. The initial research review made the need
for an explicit persistence boundary clear: graph encoding, immutable audit, and
atomic coordination cannot be treated as the same responsibility.
