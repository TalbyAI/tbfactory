# RDF, SHACL, and temporal Fact representation: research facts

**Checked:** 2026-10-06

**Purpose:** Evidence for [Research RDF, SHACL, and temporal Fact representation](../issues/02-rdf-shacl-temporal-graphs.md). This note records standards and implementation facts; it does not choose a Factory representation, define an Ontology, or change MVP architecture. The proposed model remains open.

The repository glossary defines a **Fact** as an immutable record of an occurrence concerning a Work Item; a correction is another Fact. That occurrence identity is a domain requirement to preserve when comparing RDF statements with RDF records. [CONTEXT.md](../../../CONTEXT.md)

No validator was installed or executed for this research. Package facts below come from current package metadata, project documentation, and published standards; they are not runtime verification in this repository.

## RDF graphs, datasets, and statement metadata

An RDF graph is a set of subject-predicate-object triples. RDF 1.2 explicitly describes the abstract RDF data model as atemporal: graphs are static snapshots, although vocabularies can express events and temporal aspects. A graph set also does not preserve duplicate copies of the same triple. Therefore an asserted triple alone does not identify two distinct observations of the same proposition or provide append-only history. [RDF 1.2 Concepts and Abstract Data Model, Candidate Recommendation Snapshot 2026-04-07, §§1.1, 1.6, 3.1](https://www.w3.org/TR/2026/CR-rdf12-concepts-20260407/)

An RDF dataset consists of one default graph and zero or more named graphs. Each named graph is a pair of a graph name (IRI or blank node) and an RDF graph. The graph name is not required to denote the graph, and RDF does not prescribe a relationship between them. Some dataset implementations also do not preserve empty named graphs. Named graphs can group snapshots, sources, or Fact records when an application defines those conventions; the dataset model does not give those labels event, provenance, temporal, or authority semantics. [RDF 1.1 Concepts and Abstract Syntax, Recommendation, §4](https://www.w3.org/TR/rdf-concepts/) · [RDF 1.2 Concepts, §4](https://www.w3.org/TR/2026/CR-rdf12-concepts-20260407/)

RDF 1.1 has a standard reification vocabulary: an IRI or blank node can be described with rdf:Statement, rdf:subject, rdf:predicate, and rdf:object. The RDF Schema definition explicitly allows different rdf:Statement instances to have the same subject, predicate, and object values, so separate records can refer to the same proposition. This vocabulary describes a statement; it does not by itself assert that the described triple is true or define a Fact occurrence. [RDF Schema 1.1, §5.3](https://www.w3.org/TR/rdf-schema/) · [RDF 1.1 Semantics, §D.1](https://www.w3.org/TR/rdf11-mt/#reification)

~~~turtle
@prefix ex:   <https://example.test/> .
@prefix rdf:  <http://www.w3.org/1999/02/22-rdf-syntax-ns#> .
@prefix prov: <http://www.w3.org/ns/prov#> .
@prefix xsd:  <http://www.w3.org/2001/XMLSchema#> .

ex:fact-17
    a rdf:Statement, ex:Fact ;
    rdf:subject ex:pull-request-9 ;
    rdf:predicate ex:providerState ;
    rdf:object "open" ;
    prov:generatedAtTime "2026-10-06T09:00:00Z"^^xsd:dateTime ;
    prov:wasAttributedTo ex:provider-account .
~~~

RDF 1.2 adds triple terms and the rdf:reifies relation. A reifier is an ordinary subject that can carry metadata and refer to a triple term; different reifiers can relate to the same proposition. Turtle distinguishes the triple-term form `<<( subject predicate object )>>` from the reified-triple shorthand `<< subject predicate object >>`. The latter expands to a reifying triple and supplies a reifier identifier; in explicit `rdf:reifies` syntax the triple term uses the parenthesized form. Neither form asserts the enclosed proposition unless that triple is separately present in the graph. The meaning of rdf:reifies is deliberately generic, covering claims, situations, events, and other relations to a proposition. A domain-specific Fact class and source semantics are still needed. [RDF 1.2 Concepts, §1.5](https://www.w3.org/TR/2026/CR-rdf12-concepts-20260407/) · [RDF 1.2 Turtle Working Draft, §§2.10–2.11](https://www.w3.org/TR/2026/WD-rdf12-turtle-20260914/)

~~~turtle
@prefix ex:   <https://example.test/> .
@prefix rdf:  <http://www.w3.org/1999/02/22-rdf-syntax-ns#> .
@prefix prov: <http://www.w3.org/ns/prov#> .
@prefix xsd:  <http://www.w3.org/2001/XMLSchema#> .

ex:fact-17
    a ex:Fact ;
    rdf:reifies <<( ex:pull-request-9 ex:providerState "open" )>> ;
    prov:generatedAtTime "2026-10-06T09:00:00Z"^^xsd:dateTime ;
    prov:wasAttributedTo ex:provider-account .
~~~

The second snippet uses RDF 1.2 triple-term syntax and the explicitly identified `rdf:reifies` relation. It does not separately assert the provider-state triple. RDF 1.2 Concepts is a Candidate Recommendation Snapshot, while the RDF 1.2 Turtle and TriG concrete syntaxes remain Working Drafts as of the check date. RDF 1.1 remains the latest RDF Concepts Recommendation. Implementations and serialization round-trips for RDF 1.2 terms therefore need direct verification before depending on this encoding. [RDF 1.2 Concepts status](https://www.w3.org/TR/2026/CR-rdf12-concepts-20260407/) · [RDF 1.2 Turtle Working Draft 2026-09-14](https://www.w3.org/TR/2026/WD-rdf12-turtle-20260914/) · [RDF 1.2 TriG publication history](https://www.w3.org/standards/history/rdf12-trig/)

## Provenance and time

PROV-O is a W3C Recommendation vocabulary for describing entities, activities, and agents. It includes attribution (prov:wasAttributedTo), generation of an entity by an activity (prov:wasGeneratedBy), entity generation time (prov:generatedAtTime), and activity start/end times. If a Factory Fact record is modeled as a PROV entity, generatedAtTime can describe when that entity was generated. It does not automatically mean when an external source observed a state or the interval when that state was valid. [PROV-O: The PROV Ontology, Recommendation](https://www.w3.org/TR/prov-o/)

OWL-Time is a W3C Recommendation ontology for temporal entities, instants, intervals, and relations between intervals. Its time:hasBeginning and time:hasEnd properties associate an interval with endpoint instants. An application still has to define which interval belongs to a Fact and what it means—for example, source-observation validity versus a system's recording interval. RDF, PROV-O, and OWL-Time do not establish that Fact-specific bitemporal contract by themselves. **Inference from the standards and the repository Fact definition:** recording time, source observation time, and validity time should be separately represented if they can differ. [Time Ontology in OWL (OWL-Time), Recommendation](https://www.w3.org/TR/owl-time/)

For example, an envelope or RDF vocabulary could keep distinct fields named recordedAt, observedAt, and validDuring. PROV-O terms can describe generation and attribution; OWL-Time can describe an interval; the Factory contract must still specify endpoint inclusion, unknown/open bounds, source authority, correction behavior, and selection rules.

## What SHACL validates

The 2017 SHACL Recommendation defines validation using a data graph and a shapes graph. A shape validates focus nodes selected by its target in the data graph, or nodes supplied as direct input. The data graph may be any RDF graph, including a named graph selected from a dataset or an in-memory graph. The shapes graph and data graph must remain unchanged during validation. The standard does not require a validator to validate a whole RDF dataset with cross-graph semantics. [Shapes Constraint Language (SHACL), W3C Recommendation 2017-07-20, §§2–3](https://www.w3.org/TR/2017/REC-shacl-20170720/)

As of 2026-10-06, SHACL 1.0 remains the latest SHACL Recommendation. SHACL 1.2 Core, Node Expressions, SPARQL-related features, and Inference Rules are Working Drafts; the SHACL 1.2 Core page identifies the 2017 Recommendation as the latest Recommendation. These draft additions should be treated separately from the published 2017 Recommendation. [SHACL 1.2 Core Working Draft 2026-09-18 and status](https://www.w3.org/TR/2026/WD-shacl12-core-20260918/) · [SHACL 1.2 Inference Rules First Public Working Draft 2026-09-17](https://www.w3.org/TR/2026/WD-shacl12-inference-rules-20260917/)

SHACL can validate a historical Fact graph if that graph encodes Fact nodes and is passed as the data graph with shapes targeting those nodes. It can also validate a projected graph if a separate process first constructs that graph. It can validate both in separate invocations. **It does not define how to turn an immutable Fact history into a current or as-of-time projection.** A SHACL invocation describes constraints on the graph it receives; its targets do not select a history window or decide how to resolve conflicting observations. [SHACL Recommendation, §3.4](https://www.w3.org/TR/2017/REC-shacl-20170720/#validation) · [SHACL 1.2 Core, §6.5](https://www.w3.org/TR/2026/WD-shacl12-core-20260918/#validation)

There is an important qualification to “no derivation semantics.” SHACL 1.2 Node Expressions is a separate Working Draft for deriving focus nodes and value nodes; its examples compute target nodes and values from a data graph. The draft says computed property values do not create triples in the data graph. SHACL 1.2 Inference Rules is another Working Draft and defines a rules engine that can infer triples from a data graph. These are graph-level expression and inference facilities, not a defined temporal projection from Factory Facts, and they have not reached Recommendation status. [SHACL 1.2 Node Expressions Working Draft](https://www.w3.org/TR/shacl12-node-expr/) · [SHACL 1.2 Inference Rules, §§2 and 8](https://www.w3.org/TR/2026/WD-shacl12-inference-rules-20260917/)

Candidate validation boundaries, without choosing one:

- Validate the structure of a newly received Fact before append; the validated graph could be a serialization of the typed record.
- Validate the recorded history graph for required Fact fields, subject/object kinds, provenance, and time datatype constraints.
- Separately validate a materialized element graph after an explicitly defined projection step. SHACL can report whether the output conforms; the projection algorithm and its version remain outside ordinary SHACL validation.
- When using named graphs, pass the intended graph or explicitly constructed graph to the processor. Test whether the library reads the default graph, one named graph, or a union of quads; the W3C single-graph validation contract does not settle library dataset handling.

## TypeScript-compatible implementation evidence

The RDF/JS Data Model and Dataset interfaces are JavaScript interoperability specifications. The separate @rdfjs/types package provides TypeScript declarations for RDF/JS interfaces such as Term, Quad, and DatasetCore; it is type support for data structures, not a SHACL validator or an append-only Fact store. [RDF/JS Data Model specification](https://rdf.js.org/data-model-spec/) · [RDF/JS Dataset specification](https://rdf.js.org/dataset-spec/) · [@rdfjs/types 2.0.1](https://www.npmjs.com/package/@rdfjs/types)

| Package | Evidence checked on 2026-10-06 | TypeScript fit and documented support |
| --- | --- | --- |
| rdf-validate-shacl 0.6.5 | Latest npm version; published 2025-05-30. Project docs describe a JavaScript SHACL validator over RDF/JS. | npm marks built-in TypeScript declarations and the package manifest exposes index.d.ts. Supports SHACL Core; its README explicitly says SHACL-SPARQL constraints are not supported. No RDF 1.2 or SHACL 1.2 support claim was found. [npm version history](https://www.npmjs.com/package/rdf-validate-shacl?activeTab=versions) · [project README](https://github.com/zazuko/rdf-validate-shacl) |
| shacl-engine 1.1.2 | Latest npm version; published 2026-06-30. Project README documents validation over RDF/JS DatasetCore. | Documents SHACL Core; SPARQL-based constraints and targets are optional modules. The package is JavaScript and its package metadata/repository expose no TypeScript declaration entry. Type-safe use from a strict TypeScript project is therefore unverified; an adapter or local declarations may be needed. No RDF 1.2 or SHACL 1.2 support claim was found. [npm package and README](https://www.npmjs.com/package/shacl-engine) · [package.json](https://github.com/rdf-ext/shacl-engine/blob/master/package.json) |

These package pages document APIs and claimed feature support; they do not establish runtime behavior for this Factory. Both take RDF/JS dataset-shaped inputs in their examples, but SHACL's standard contract is a single graph. Named-graph isolation, explicit focus-node behavior, RDF 1.2 triple terms, and SHACL 1.2 features must be checked against the exact installed versions and configuration before use. No validator execution was performed for this note.

## Native RDF versus a typed Fact envelope

The options below are translation boundaries to compare, not architecture decisions.

This TypeScript shape is only an illustration of an adapter input, not a proposed canonical model:

~~~typescript
type RdfNode = { kind: "iri" | "blankNode"; value: string };
type RdfObject =
  | RdfNode
  | { kind: "literal"; value: string; datatype?: string; language?: string };

type ExampleInputRecord = {
  id: string;
  subject: RdfNode;
  predicate: string;
  object: RdfObject;
  recordedAt: string;
  observedAt?: string;
  validDuring?: { start?: string; end?: string };
  source?: string;
};
~~~

| Concern | RDF-native record | Typed envelope translated to RDF |
| --- | --- | --- |
| Primary representation | An RDF resource represents each Fact; RDF 1.1 reification or RDF 1.2 reifiers can connect it to a proposition. | A typed application record owns Fact identity and typed subject, predicate, object, time, and provenance fields. An adapter emits an RDF graph for validation or exchange. |
| Repeated proposition | Give each occurrence its own record/reifier resource; the same triple can have multiple reifiers. | Give each envelope its own stable Fact identifier; translate each occurrence to a distinct RDF subject. |
| SHACL boundary | Validate the Fact-resource graph and/or a materialized graph. RDF 1.2 syntax and validator support need verification if using triple terms. | Validate the adapter's event graph or a projected graph. SHACL validates the translated representation, not the TypeScript type definition itself. |
| Main contract to test | Exact assertion-versus-quoted-statement meaning, node identity, graph scope, serialization, and RDF 1.2 interoperability. | Lossless mapping for IRIs, literals and datatypes, language tags, external references, nested element IDs, and provenance/time fields. |

The distinction is that an RDF triple represents a proposition, while the repository's Fact is an occurrence record. **Inference:** either representation can encode both only when it gives each occurrence stable identity and explicitly defines whether its proposition is asserted. Making the product's internal type a typed envelope does not prevent translating a copy into RDF for SHACL; making RDF native does not supply event-store, projection, or authority rules.

## Minimal prototype tests before choosing

These are proposed discriminating tests, not tests run in this research.

- Round-trip two different Fact identifiers that carry the same subject, predicate, and object but different sources and recording times. Verify neither mapping collapses them and that correction is another record.
- Round-trip IRI and literal objects, including a typed literal and a language-tagged literal; test nested element identity and external references.
- For RDF 1.2 encoding, verify a quoted triple is not emitted as an asserted triple unless the chosen projection explicitly asserts it; verify two reifier nodes survive serialization and parsing.
- Use SHACL Core shapes with positive and negative cases on a Fact history graph and on a projected element graph. Confirm the two invocations validate the supplied graph and do not implicitly derive the projection.
- Place valid and invalid records in separate named graphs. Confirm the validator only sees the intended graph or an explicitly built union, and test whether empty graph presence matters to the chosen dataset library.
- Build a tiny deterministic projection fixture with separate recorded time and validity interval. Exercise as-of queries, last-value and accumulating properties, ties/conflicts, correction, and rule/projection versioning; then validate the resulting graph. The expected projection results must come from an independently written policy fixture, since SHACL does not define them.
- Compile and run the same fixture against the exact TypeScript package and validator version under consideration. Check declared TypeScript types, SHACL feature coverage, validation report fields, and RDF 1.2/SHACL 1.2 support separately.

## Sources

- [RDF 1.1 Concepts and Abstract Syntax — W3C Recommendation](https://www.w3.org/TR/rdf-concepts/)
- [RDF 1.1 Semantics — W3C Recommendation, §D.1](https://www.w3.org/TR/rdf11-mt/#reification)
- [RDF Schema 1.1 — W3C Recommendation](https://www.w3.org/TR/rdf-schema/)
- [RDF 1.2 Concepts and Abstract Data Model — Candidate Recommendation Snapshot, 2026-04-07](https://www.w3.org/TR/2026/CR-rdf12-concepts-20260407/)
- [RDF 1.2 Turtle — Working Draft, 2026-09-14](https://www.w3.org/TR/2026/WD-rdf12-turtle-20260914/)
- [RDF 1.2 TriG publication history](https://www.w3.org/standards/history/rdf12-trig/)
- [Shapes Constraint Language (SHACL) — W3C Recommendation, 2017-07-20](https://www.w3.org/TR/2017/REC-shacl-20170720/)
- [SHACL 1.2 Core — Working Draft, 2026-09-18](https://www.w3.org/TR/2026/WD-shacl12-core-20260918/)
- [SHACL 1.2 Node Expressions — Working Draft](https://www.w3.org/TR/shacl12-node-expr/)
- [SHACL 1.2 Inference Rules — First Public Working Draft, 2026-09-17](https://www.w3.org/TR/2026/WD-shacl12-inference-rules-20260917/)
- [PROV-O — The PROV Ontology, W3C Recommendation](https://www.w3.org/TR/prov-o/)
- [Time Ontology in OWL (OWL-Time), W3C Recommendation](https://www.w3.org/TR/owl-time/)
- [rdf-validate-shacl npm package and version history](https://www.npmjs.com/package/rdf-validate-shacl?activeTab=versions) · [repository](https://github.com/zazuko/rdf-validate-shacl)
- [shacl-engine npm package](https://www.npmjs.com/package/shacl-engine) · [repository package.json](https://github.com/rdf-ext/shacl-engine/blob/master/package.json)
- [RDF/JS Data Model specification](https://rdf.js.org/data-model-spec/) · [Dataset specification](https://rdf.js.org/dataset-spec/) · [@rdfjs/types](https://www.npmjs.com/package/@rdfjs/types)
