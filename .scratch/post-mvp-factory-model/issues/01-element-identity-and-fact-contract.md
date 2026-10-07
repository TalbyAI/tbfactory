# Define shared element identity and the Assertion contract

Status: ready-for-human
State: closed
Assignee: Iskander
Type: HITL
Labels: wayfinder:grilling

## Parent

[Validate the extensible post-MVP Factory model](../spec.md)

## Question

What are the identity, graph, typing, Assertion, and Assertion Bundle boundaries
for an Element that carries the Resource and Work Item roles, including nested
Elements and external references?

Apply the agreed shared identity, descriptive multi-typing, optional Project
association, and separate external/Factory state predicates. Assertions record
attributed triples with statement-specific metadata; Assertion Bundles identify
groups with shared receipt/provenance metadata, including batched observations.
Finish Bundle-scoped addressing, repeated observation versus redelivery, validity
bounds, correction/retraction, removal, and explicit unknown values. Specify
cross-Organization references without weakening isolation. Use pull request
Comments and internally originated work to stress-test the contract. Distinguish
immutable historical evidence from interpretation as current truth.

Resolve with named concepts, example histories, invariants, and the future changes
needed to ADR 0002. Leave encoding and implementation to downstream tickets.

## Blocked by

None - can start immediately.

## Comments

### 2026-10-06 — Claimed for a live decision session

Claimed by Iskander with Codex facilitating `wayfinder`, `grilling`, and
`domain-modeling`. The ticket remains open; the following recommendations are
discussion inputs, not agreed decisions or a resolution.

The existing shared Resource/Work Item identity direction and distinct external
and Factory state predicates remain the starting point. Consulted the
[proposal](../proposal.md), [canonical language](../../../CONTEXT.md),
[MVP foundations](../../../docs/foundations.md), and accepted ADRs for
[Work Items](../../../docs/adr/0002-work-items.md),
[Organization isolation](../../../docs/adr/0003-organization-policy-boundaries.md),
and [type-specific states](../../../docs/adr/0006-type-specific-state-models.md).

The [RDF, SHACL, and temporal evidence](../research/rdf-shacl-temporal-facts.md)
distinguishes statement content from occurrence identity. It does not choose the
Factory contract or establish an executed encoding. The current MVP stores a
Fact occurrence with `kind` and `payload`; ingestion correspondence is scoped by
Organization, Work Item Type, and external resource. These are existing behavior,
not an approved post-MVP model.

### Discussion round 1 — Awaiting User answers

The currently discussable decisions and recommendations are:

1. **Identity scope:** use stable Factory identity within an Organization,
   independent of external keys and types. Recommend one local representation of
   the same external object across its Resource and Work Item roles; different
   Organizations retain independent representations and history. Cross-Organization
   references never grant access. External-key reconciliation details remain with
   [Define inbound and outbound integration contracts](12-channels-and-external-correspondence.md).
2. **Nested subjects and graph boundaries:** give addressable nested objects, such
   as pull request comments, stable identities and explicit relations to their
   parent. Recommend that graph membership not be confused with ownership or access
   permission. Defer physical graph encoding and storage.
3. **Roles and types:** allow one identity to carry multiple descriptive types and
   Resource/Work Item roles. Recommend retaining meaningful specific types, such as
   Pull Request, and explicit predicates for external versus Factory states;
   multiple types do not implicitly select a single lifecycle.
4. **Project association:** decide whether Organization-owned internally created
   work may exist before a Project is identified. Recommend optional Project at
   creation, with specific Activities requiring their necessary scope and inputs.
   This would revise ADR 0002 for the future model only.
5. **Fact occurrence and statements:** choose between a bare statement, an
   identified occurrence carrying one statement, or an identified occurrence
   carrying a cohesive set of statements. Recommend the last option, preserving
   source occurrences and provenance; it does not prescribe a database transaction.
   Repeated delivery of one occurrence differs from a new occurrence asserting
   identical content.
6. **Time dimensions:** distinguish Factory recording time, source occurrence or
   observation time, and any explicitly asserted validity interval. Recommend
   keeping unavailable source time or validity unspecified instead of substituting
   recording time or inventing perpetual validity.
7. **Provenance versus authority:** distinguish the original source or asserting
   participant from the integration or Workflow Run recording the Fact. Recommend
   retaining conflicting assertions with provenance; recording an assertion does
   not make it authoritative or authorize a Factory State Transition.

After these answers, discuss the dependent contracts: precise external and
cross-Organization reference behavior; multi-type lifecycle boundaries; occurrence
redelivery and contradictory payloads; statement-level versus occurrence-level
metadata; time bounds; corrections, retractions, removal, and explicit unknown
values. Selection policies belong to
[Define projection and temporal-query semantics](07-projection-and-temporal-query-semantics.md);
this ticket must settle what the historical evidence can express.

No new term or recommendation is approved by this comment. Update the post-MVP
language when the User agrees to a definition. Close this ticket and add its named
resolution pointer to the map only after the live exchange resolves its question.

### 2026-10-06 — User agreements from discussion round 1

The User confirmed the following post-MVP decisions. These are partial agreements;
the ticket remains open and does not yet unblock its dependents.

- **Identity:** one stable local Element identity per represented object within an
  Organization, independent of types and external identifiers. Resource and Work
  Item roles share that identity and history. Another Organization has its own
  representation; references do not grant access across the tenant boundary.
- **Comment identity:** creating a Comment during a review creates a local Element
  in the Factory graph with its own identity. Exporting it through an integration
  records the returned external identifier as a Fact associated with that same
  Comment. A Comment can exist without a known external representation. External
  identity never replaces local identity. Representation cardinality, uncertain
  export outcomes, and binding reconciliation remain undecided.
- **Roles and types:** an Element can have multiple descriptive types and both
  Resource and Work Item roles. External and Factory states remain distinct
  predicates; multiple descriptive types do not implicitly select one lifecycle.
- **Tenant and optional associations:** only Organization is required for a Work
  Item. A Trigger may be responsible for initiating Project association through
  automatic classification or User intervention. The division between Trigger
  dispatch and the authorized operation that records the association belongs to
  [Define classification and Trigger activation semantics](08-classification-and-trigger-semantics.md)
  and is not settled by this agreement.
- **Time:** distinguish Factory recording time, source occurrence/observation time,
  and an explicitly stated validity interval. Recording time is required; missing
  source time or validity stays unspecified, without substituting recording time
  or assuming perpetual validity. Interval boundary semantics remain open.
- **Provenance and authority:** retain the original source or asserting participant
  separately from the integration or Workflow Run recording the Fact. Conflicting
  assertions retain their provenance. Recording an assertion does not make it
  authoritative or authorize a Factory State Transition.

The User requested more detail before deciding the Fact's relationship to
statements. No Fact cardinality or occurrence envelope is agreed yet.

[CONTEXT.md](../../../CONTEXT.md#post-mvp-exploration-language) now records Element,
Resource, Work Item, and Comment definitions under post-MVP language. Existing MVP
definitions, foundations, and ADRs remain accepted for the application. A future
ADR 0002 replacement must address type-independent correspondence and optional
Project association; ADR 0006 requires explicit future lifecycle ownership for
multi-typed Elements. This comment approves neither replacement ADR.

### 2026-10-06 — Other-session research checked

Read-only Git inspection found the following existing research branches and
separate worktrees, each clean at inspection time:

| Research | Branch | Commit |
| --- | --- | --- |
| [Research RDF, SHACL, and temporal Fact representation](02-rdf-shacl-temporal-graphs.md) | `research/post-mvp-ontologies` | `cb24757` |
| [Research Effect 4 and Mastra execution boundaries](03-effect4-and-mastra-boundaries.md) | `research/post-mvp-effect4` | `cb6540e` |
| [Research durable shared-read and exclusive-write coordination](04-durable-resource-coordination.md) | `research/post-mvp-coordination` | `d905e21` |
| [Research declarative rule and extension mechanisms](05-declarative-rules-and-extension-mechanisms.md) | `research/post-mvp-declarations` | `efce6cf` |

SHA-256 comparisons confirmed that each research evidence file in this worktree
matches its corresponding research worktree. These are the four already-closed
research tickets. No additional local post-MVP research branch or second post-MVP
map was found in the inspected worktrees. This is a repository-state check, not
proof that no other conversation is active. No research was repeated or merged.

### Discussion round 1 follow-up — Fact structure, awaiting User answer

The examples below are conceptual notation, not accepted predicate names or a
serialization choice. Local Comment creation and later external binding are
distinct occurrences under every option.

Assume provider event `E17` reports three statements about local Element `PR1`:

~~~text
(PR1, externalState, "open")
(PR1, title, "Fix login")
(PR1, sourceBranch, B1)
~~~

| Option | What the Factory calls a Fact | Representation of E17 |
| --- | --- | --- |
| A | Statement content alone | Three triples; repeating a triple has no separate occurrence identity unless another structure supplies it. |
| B | An identified occurrence of one statement | Three Facts F1, F2, F3, each with its own identity, provenance, and time, linked to source event E17. |
| C | An identified occurrence carrying one or more related statements | One Fact F1 identifies the observation E17 and contains all three statements; its statements can still be inspected individually. |

Option B makes the statement occurrence the Fact unit; grouping several Facts as
one observation needs an explicit additional relationship. Option C makes the
source observation or Factory action the Fact unit; independently correcting one
contained statement needs explicit targeting in a later Fact. Neither choice
alone determines storage atomicity, projection selection, or authority.

The User's Comment example under Option C could have these separate records:

~~~text
F10: local Comment creation
  (C1, type, Comment)
  (C1, about, PR1)
  (C1, body, "Check null handling")
  original source: review participant; recorded by: Workflow Run R1

F11: confirmed external representation after export
  (C1, externalRepresentation, provider-comment-987)
  original source: provider export response; recorded by: integration channel

F12: a later observation that provider-comment-987 was edited
  (C1, externalBody, "Updated external text")
  original source: provider observation; recorded by: integration channel
~~~

C1 is stable throughout. F11 does not recreate C1 or rewrite F10. F12 does not
silently overwrite the locally authored body. Identical content from a genuinely
new observation remains distinguishable from redelivery of E17.

The recommendation remains Option C, with cohesive statements from one source
occurrence or Factory action rather than arbitrary batches of unrelated events.
The User must choose the Fact unit before the next round specifies statement
addressing, metadata scope, corrections/retractions, removal, and unknown values.

### 2026-10-06 — Grouped graph and statement metadata direction confirmed

The User agrees in principle with the grouped structure in Option C and proposes
an identified grouping, potentially called Fact Bundle or Fact Commit. It carries
shared metadata, including receipt time and source, and contains a list of triples.
Each contained statement can also carry metadata, including its particular
asserting participant and validity interval. The grouping can itself be represented
as a graph. This does not yet choose RDF-native storage or a particular encoding.

The User leaves open how that graph is imported or integrated into the Work Item
graph. The discussion must distinguish preserving the grouping and historical
assertions from selecting or asserting their contents as current truth. Neither
SHACL validation nor a graph union alone is an agreed integration contract.

These structural directions are agreed; their final terminology and operational
boundaries are not. In particular, Option C previously called the whole occurrence
a Fact. Introducing Fact Bundle leaves a naming decision: does Fact continue to
mean the occurrence, or name each attributed statement within the grouping? The
MVP Fact definition continues to mean an immutable occurrence record.

Do not add either competing grouping name or redefine Fact in CONTEXT.md before
the User settles that distinction. The following are recommendations for the next
live round, not new decisions:

1. **Names and units:** recommend Fact Bundle for the identified grouping and Fact
   for an immutable attributed statement occurrence inside it. A bare triple is
   its content, not its occurrence identity. This would be an explicit post-MVP
   terminology change rather than silently changing the MVP definition. Fact Commit
   would prematurely imply that the received group has already been admitted.
2. **Shared versus statement metadata:** recommend immutable receipt/provenance
   metadata on the grouping, with statement attribution and validity explicit at
   statement scope. Defaults for those fields must be explicit and distinguish
   source-reported authorship from the participant/mechanism recording the group;
   an absent validity interval must not become an assertion of perpetual validity.
3. **Meaning of integration:** recommend preserving the received graph and its
   identity, then recording whether it is admitted to the authorized Element
   history. Receipt, admission, and interpretation as current state are distinct.
   The appropriate validation and admission contracts remain open.
4. **Subjects and graph membership:** recommend allowing one cohesive source
   occurrence or Factory action to describe multiple local Elements within one
   Organization, with relationships to relevant histories rather than duplicating
   the occurrence per subject. Cross-Organization subjects must not become local
   history through this mechanism; external object references remain distinct
   from permission to traverse another Organization's graph.

The graph-admission mechanism is already within existing tickets: incoming-graph
validation in
[Choose Ontology, SHACL, projection, and rule boundaries](06-ontology-validation-and-dsl-boundaries.md),
external identity/delivery mapping in
[Define inbound and outbound integration contracts](12-channels-and-external-correspondence.md),
and history append/linking and atomicity in
[Define persistence Ports and atomic consistency boundaries](21-persistence-ports-and-atomic-boundaries.md).
The latter now explicitly calls out this question. No duplicate ticket, research
session, implementation, or closed-ticket map entry is needed at this point.

After these boundaries, settle addressing individual statement occurrences,
correction/retraction targets, time bounds, unknown values, and removal. The ticket
remains claimed and open pending the live exchange.

### 2026-10-06 — Metadata, history integration, and batch grouping agreed

The User confirmed the metadata boundary: the identified grouping records receipt
and provenance; individual statements can carry their own attribution and validity.
Shared authorship defaults must be explicit rather than inferred from a transport
channel, and an absent validity interval remains unspecified.

The User confirmed that graph incorporation adds evidence to authorized Element
history while preserving the grouping's identity and provenance. Receipt,
admission, and interpretation as current state remain distinct. Exact admission
validation, persistence, rejection, and atomicity are downstream contracts.

The User confirmed that one grouping can describe multiple Elements within an
Organization. An integration may perform several queries in a batch and deliver
all results as one observation or identified set of statements. This broadens the
earlier recommendation that a group correspond to one source occurrence or Factory
action: one received group need not correspond to one upstream event or API call.
Statement-specific provenance and times remain relevant in this batch case.

The implications to validate downstream include whether batched results form a
consistent snapshot, how partial query failures are represented, and how upstream
result identifiers differ from the grouping's identity. Grouping alone must not
silently settle any of these questions. Integration and persistence tickets now
explicitly include the batched-query scenario.

Q8 remains open. The User likes Fact Bundle / Fact provisionally but requests
alternative names and trade-offs before committing. No grouping name or new Fact
definition has been entered into CONTEXT.md.

### Q8 follow-up — Naming alternatives, awaiting User decision

Every option below describes the same agreed two-level structure: an identified
historical grouping with shared metadata, containing attributed statements with
their own metadata. The alternatives concern domain vocabulary, not a new choice
of graph encoding or integration mechanism. Statement occurrence addressing is
still a subsequent decision.

| Group / individual record | Advantages | Costs |
| --- | --- | --- |
| Fact Bundle / Fact | Neutral grouping that supports one statement, batched queries, external observations, and internal actions; concise individual term. | Changes the MVP Fact unit; Fact may sound like established truth even though it records an assertion. |
| Fact Bundle / Assertion | Clearly distinguishes asserted content from authoritative truth; makes differing authors easy to discuss. | The group refers to Facts while its members are called Assertions; the post-MVP meaning or retirement of Fact still needs a deliberate definition. |
| Fact / Fact Statement | Preserves the MVP occurrence-level meaning of Fact and the original Option C terminology. | Fact still means a whole batch; individual discussions use a longer term, and Statement must mean a recorded assertion rather than just triple content. |
| Observation / Assertion | Makes observation, provenance, and attributed content explicit; a batch can be one observation. | Observation is less natural for an authorized decision or internally performed action, and existing Fact terminology would need revision. |
| Fact Commit / Fact | Communicates immutable history addition and a useful analogy with a commit containing related changes. | Suggests accepted incorporation or atomicity; naming a merely received group Commit needs an explicit convention and cannot promise those semantics. |
| Fact Batch / Fact | Directly expresses the multi-query example and a collection of statements. | Sounds like transport or bulk-processing terminology rather than a lasting domain record; awkward for one statement or a human decision. |

Recommended shortlist: Fact Bundle / Fact for clarity of the two levels, or
Fact / Fact Statement for continuity with the MVP. Fact Bundle / Assertion is
worth considering if the User prioritizes avoiding an implication of established
truth, provided the Fact term's future role is explicitly settled.

Names such as Event or Graph alone are not recommended: one grouping can aggregate
several queries, and graph describes its representation rather than its role.
None of these alternatives is adopted by this comment.

### 2026-10-07 — Assertion and Assertion Bundle terminology adopted

The User accepted Assertion and Assertion Bundle as the canonical post-MVP terms:

- **Assertion:** an immutable, identified record that a source asserted a
  subject-predicate-object triple, with statement-specific attribution and temporal
  metadata. Recording it establishes historical evidence rather than current truth
  or execution authority.
- **Assertion Bundle:** an identified grouping of Assertions, with shared receipt
  and provenance metadata, which can be represented as a graph. It can describe
  several Elements in one Organization and aggregate results of multiple queries.
- **Fact:** retains its accepted MVP meaning. It is not a third equivalent concept
  in the post-MVP model. Fact Bundle and Fact Commit are unselected alternatives.

The canonical glossary now records these definitions. Current open-ticket
questions and named links use the new terms; filenames remain stable. This ticket
was previously titled "Define shared element identity and the Fact contract".
Historical discussion, the kickoff proposal, and completed research retain their
original vocabulary; interpret them through this explicit terminology agreement.
The map Notes point readers to that distinction. No MVP code or accepted ADR is
changed, and this partial agreement does not close or unblock the ticket.

### Discussion round 3 — Assertion identity and historical operations

These are questions and recommendations awaiting the User, not a resolution:

1. **Occurrence identity across Bundles:** can another Assertion Bundle cite the
   same recorded Assertion? Recommend stable identity for the recorded assertion
   occurrence across references. A genuinely new observation of identical triple
   content is a different Assertion; a redelivery or citation of the existing
   record preserves identity. Identifier encoding and adapter deduplication are
   downstream implementation decisions.
2. **Correction and retraction:** recommend a later Assertion Bundle containing
   explicit links to the particular Assertion being corrected or retracted, with
   replacement Assertions when appropriate. Preserve the old record. Contradictory
   evidence from another source remains a separate assertion rather than an
   automatic correction of the first source. Authority and projection consequences
   remain distinguishable from the historical operation.
3. **Removal and external deletion:** recommend distinguishing retraction of an
   erroneous assertion from an object or relationship ceasing to exist externally.
   A provider Comment deletion is new evidence; it does not delete the local
   Comment, its export evidence, or its past content. Removal of a collection
   relationship records its end or removal rather than rewriting its original
   addition; exact encoding and projection policy remain open.
4. **Unknown, absent, and empty:** recommend that no observation, an explicit claim
   of unknown value, and an explicitly empty/no-value property remain distinct in
   historical evidence. A missing payload field cannot silently mean removal.
   Agree the semantics here; choose the RDF or typed encoding downstream.
5. **Validity bounds:** recommend start-inclusive/end-exclusive intervals and an
   explicit distinction between an unknown boundary and a deliberately unbounded
   boundary. An absent interval remains unspecified. Receipt/recording time does
   not supply an unstated validity boundary.
6. **References and tenant isolation:** recommend local Element references for
   objects represented within the same Organization, and opaque external references
   for objects not locally represented. A reference to another Organization's
   representation does not authorize graph traversal or import its history;
   explicit authorized sharing/resolution remains a separate contract.

After the User answers, examine any newly exposed dependent details, including
contradictory content under a reused identity and who may issue effective
corrections. Definition ownership and lifecycle implications of multiple types
are recorded for the downstream configuration/evolution ticket, rather than
choosing a lifecycle model implicitly in this identity session.

### 2026-10-07 — Final round agreements

The User accepted Q14–Q17 and replaced the recommendations in Q12 and Q13:

- **Q12:** the Assertion Bundle has identity; Assertions have no global identity.
  Any local name is for references from other Assertions inside that same Bundle.
  Content and metadata matter rather than a global assertion occurrence identifier.
- **Q13:** concrete predicates express correction. There is no generic correction
  operation or universal correction relation. Each Ontology and its associated
  projection rules decide how predicate composition expresses sequences of states
  at a given time. The location of projection rules remains undecided.
- **Q14:** external deletion or relationship removal adds historical evidence,
  preserving local identity and past evidence. This differs from recording that
  an earlier assertion was erroneous; interpretation uses domain predicates.
- **Q15:** missing observation, explicit unknown, and explicit empty/no-value are
  distinct. A missing payload field does not implicitly remove earlier evidence.
- **Q16:** specified intervals use `[start, end)`; unknown bounds, deliberately
  unbounded bounds, and an unspecified interval remain distinct. Recording time
  does not supply unstated validity.
- **Q17:** local Element references and opaque external references are distinct.
  Cross-Organization references do not authorize traversal or import history.

These answers supersede earlier proposals for global Assertion identity or generic
cross-Bundle correction targets. No such mechanism is adopted.

### Resolution — 2026-10-07

Resolved through the live exchange with Iskander. This is a post-MVP domain
decision, not approval of an encoding, projection language, or implementation.

#### Identity and graph boundaries

- One stable Factory Element identity within an Organization represents the same
  object across its Resource and Work Item roles and descriptive types. External
  representation is optional; another Organization has independent representation
  and history. Multiple types do not implicitly select one lifecycle.
- Only Organization is required for a Work Item. Project or Repository association
  may follow later; a Trigger can initiate classification or User input to establish
  it. Activities retain their authorization and required-input constraints.
- A locally created review Comment has its own Element identity. Export records
  the returned external identifier about that same Comment without replacing local
  identity or rewriting creation history.
- Graph membership does not confer access. Local references remain inside the
  Organization; external references are opaque until independently authorized
  resolution. Another tenant's history is not imported implicitly.

#### Assertions and Assertion Bundles

- Assertion is the canonical post-MVP term for an immutable attributed triple with
  statement-specific metadata. It has no global identity; local names support
  references only inside the containing Assertion Bundle.
- An Assertion Bundle is identified and carries shared receipt/provenance metadata.
  It can be a graph describing several Elements in one Organization, including
  results of batched integration queries. One Bundle need not be one source event,
  one query, one observation time, or a consistent external snapshot.
- Original source/asserting participant differs from the recording integration or
  Workflow Run. Shared authorship defaults must be explicit; per-statement author,
  source time, and validity remain distinguishable.
- Receipt, admission to authorized history, and interpretation as current state
  are separate. Preserve received evidence and provenance; incorporation does not
  establish current truth or authorize a Factory State Transition. External and
  Factory states remain distinct predicates.
- Repeated delivery and a genuinely new observation must be distinguished at the
  Bundle/integration boundary. There is no global Assertion identity for
  cross-Bundle deduplication or targeting. Source keys and Bundle identity-integrity
  protocols remain downstream integration/persistence decisions.

#### Time, correction, removal, and unknown values

- Factory receipt/recording time, source occurrence/observation time, and stated
  validity are different dimensions. Recording time is required; unavailable
  source time or validity remains unspecified.
- Explicit intervals use `[start, end)`. Unknown endpoints differ from explicitly
  unbounded endpoints. Neither a missing interval nor recording time invents
  validity.
- Concrete Ontology predicates and associated projection rules express correction,
  retraction, and state-sequence meaning. The core defines no generic correction
  command, global Assertion target, or universal last-value algorithm.
- Domain removal/deletion adds evidence while preserving local identity and past
  history. Missing observation, explicit unknown, and explicit empty/no-value
  remain distinct. Encoding and projected effects require domain-specific rules.

#### Example histories

The following notation and predicates are illustrative, not an adopted Ontology
or encoding:

~~~text
Bundle B1: local review Comment creation
  local a1: (C1, body, "Check null handling")
  local a2: (C1, about, PR1)
  metadata Assertions within B1 may refer to B1's local a1

Bundle B2: export confirmed
  local a1: (C1, externalRepresentation, provider-comment-987)
  B2's a1 is unrelated to B1's local a1

Bundle B3: provider reports deletion
  (C1, externalCommentDeleted, true)
  C1 and all earlier evidence remain in Factory history
~~~

The same Comment C1 spans these Bundles; the local assertion name a1 does not.

~~~text
Bundle B4: (PR1, providerTitle, "Fxi login")
Bundle B5: (PR1, providerCorrectedTitle, "Fix login")
~~~

A domain can define how those concrete predicates compose at a given time. The
core retains the evidence without a universal correction link between Assertions.
Conflicting sources and delayed observations require explicit domain authority
and temporal policies.

#### Evidence and remaining route

The [RDF/SHACL research](../research/rdf-shacl-temporal-facts.md) separates statement
content, grouping, provenance, and application-defined time. Its global Fact
occurrence examples are historical illustrations, not the adopted Assertion
identity contract. Representation and validation still need executed evidence.

- [Choose Ontology, SHACL, projection, and rule boundaries](06-ontology-validation-and-dsl-boundaries.md)
  owns validation boundaries and the still-open location of projection semantics.
- [Define projection and temporal-query semantics](07-projection-and-temporal-query-semantics.md)
  owns concrete predicate composition, authority, correction/removal interpretation,
  historical selection, and reproducible versioned projections.
- [Define inbound and outbound integration contracts](12-channels-and-external-correspondence.md)
  owns source mapping, Bundle delivery/deduplication, batch failures, external
  binding, and authorized external-reference resolution.
- [Define persistence Ports and atomic consistency boundaries](21-persistence-ports-and-atomic-boundaries.md)
  owns encoding, linking/admission, identity integrity, atomicity, and adapters,
  preserving Bundle identity and Bundle-local references.
- [Prototype Assertion history, SHACL validation, and projections](14-prototype-fact-history-and-projections.md)
  must test local-name reuse, intra-Bundle references, metadata preservation,
  external Comment history, domain correction predicates, time, and unknown values.
- [Define configuration authority and definition evolution](18-configuration-authority-and-version-evolution.md)
  owns definition authority/versioning and lifecycle implications of multi-typing.

These questions already have tickets. No additional ticket or fog graduation is
needed for this resolution; no downstream decision is resolved in this session.

#### Future ADR implications

ADR 0002 stays accepted for the MVP. A future decision must explicitly replace
mandatory Project association, type-scoped external correspondence, and the MVP
Fact unit with the post-MVP tenant, identity, and Assertion Bundle model. Domain
correction predicates and historical projections do not retroactively change MVP
correction records or stored current state. ADR 0006's multi-type lifecycle
ownership remains downstream; ADR 0003's isolation/authorization remain
constraints. No accepted MVP ADR or production code changes through this ticket.
