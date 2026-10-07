# Extensible post-MVP Factory: initial proposal

This document preserves the User's proposal and the shared understanding reached
on 2026-10-06. The [decision map](spec.md) owns the exploration. This is an intake
record, not an accepted post-MVP architecture or a replacement for MVP foundations.

Terminology update, 2026-10-07: the live decision session adopted Assertion and
Assertion Bundle for the post-MVP model. This kickoff record preserves the original
Fact terminology; current definitions are in
[CONTEXT.md](../../CONTEXT.md#post-mvp-exploration-language), and detailed agreements
are in [the identity and Assertion decision ticket](issues/01-element-identity-and-fact-contract.md#comments).

## Agreed directions

- The destination is a validated specification, supported by research and product
  prototypes, rather than production implementation during this map.
- Infrastructure technologies should be abstractable behind architectural Ports
  and adapters. The User wants Effect 4 introduced from the core. Its exact scope,
  feasibility, and relationship with Mastra require investigation.
- A Resource and a Work Item representing the same object can share one identity
  and history. A pull request can receive external change Facts and Facts produced
  by reviews, user decisions, and other Factory processing on that same element.
- Facts preserve what a source observed or asserted. External observations are
  retained as recorded evidence; later observations and corrections add history.
  A predicate describing external state need not be the predicate describing the
  Factory-assigned lifecycle state. Source authority and conflicting observations
  still need an explicit interpretation contract.
- A Workflow Run declares intended reading or modification of relevant Resources.
  Multiple reviews can share reading access to the same exact Branch, while a run
  intending modification conflicts with those reads even if it ultimately makes
  no changes. Different Branches of one Repository can be worked on concurrently
  in separate sandboxes.
- Use Trigger for the domain activation mechanism, reserving Port for architecture.
- Installation extensibility and UI extensibility are distinct. A hosting
  TypeScript project loads local or published Factory Plugins. A User composes
  only installed declarative capabilities through the UI, subject to permissions.
- Plugins may contribute new step types, classification expressions, and inbound
  or outbound integrations, as well as adapters used by Factory definitions.
- The exact home of projection semantics is open: it could be an Ontology or a
  separate DSL. The User confirmed W3C SHACL as the intended ontology-validation
  technology. Its exact role and the representation of declarative classification
  rules are open.

## Proposed representation to investigate

Each element has at least one type and a history of Facts with a subject,
predicate, and object. Subjects can identify the element itself or a nested
element, such as a comment within a pull request. Objects can be literals or
references to local or external elements. The User proposes treating the element
as a graph whose own identity can also be a subject.

Proposed metadata includes recording time, the time interval in which a Fact is
relevant, and provenance. Identity, graph boundaries, time semantics, deletion,
correction, source authority, and statement-versus-occurrence semantics remain
open. A triple by itself does not resolve those questions.

Consumers may use different projections of the same history. Proposed properties
include scalar values with defaults and last-value selection, and collections
that accumulate values. Ordering, removal, conflict handling, historical queries,
projection versions, and the authoritative state transition contract need decisions.

## Proposed automation to investigate

An Organization may configure several channels for creating elements and adding
Facts to existing elements. Classification rules may inspect full history or
particular projections and produce binary or multidimensional results. The User's
classification analogy does not select a rule language or an evaluator.

Triggers connect eligible classifications to Workflows. Coordination must prevent
duplicate or incompatible processing while allowing compatible work. Historical
Facts may record claims, but whether a claim was granted requires a concurrency
contract; the representation alone is not that contract.

Workflow orchestration has a defined control flow and may contain deterministic
steps, agents, tools, integrations, and human waits. A deterministic control flow
does not imply deterministic outputs or exactly-once external effects. The desired
authoring experience uses reusable step and Workflow libraries; the division of
responsibility between Effect, Factory contracts, and Mastra remains open.

One Workflow may gather missing inputs or notify a User; a later Trigger can start
other work after completion. The Factory must support that chain without loops,
duplicate runs, unauthorized effects, or permanent ownership of unrelated aspects.

## Product validation scenarios

### Concurrent work on a pull request

One shared-identity element receives provider changes and Factory processing Facts.
Two compatible reviews can read one Branch concurrently. A third run intending
to modify that Branch waits or is refused according to the chosen claim policy.
Another Branch in the same Repository remains independently usable.

### Missing-input completion

An incomplete Work Item is retained. A Workflow identifies missing prerequisites
and either supplies them or requests human input. New Facts change eligibility,
and a later Trigger starts the next authorized Workflow without duplicating work.

### A message creates related work

An inbound integration receives a message, identifies or creates the relevant
element, and relates work to a Repository and Branch. Repeated delivery preserves
identity and avoids duplicate ingestion or external effects. Processing uses the
appropriate claims and an isolated execution environment.

## Existing decisions affected by future proposals

- [Required stack](../../docs/adr/0001-required-stack.md): Ports/adapters and an
  Effect-based core may change future coupling; the MVP stack remains accepted.
- [Work Items](../../docs/adr/0002-work-items.md): shared Resource roles, graph-wide
  Facts, typing, and replayable projections broaden the proposed model. The current
  required Project association and correspondence uniqueness need explicit review.
- [Organization policies](../../docs/adr/0003-organization-policy-boundaries.md):
  extensibility must state how tenant isolation and restrictive authorization
  remain effective; classification and claims do not confer authority.
- [Serialized execution](../../docs/adr/0004-serialized-durable-workflow-runs.md):
  compatible concurrent runs require a future replacement coordination contract.
- [Type-specific states](../../docs/adr/0006-type-specific-state-models.md):
  multi-typing and projections may affect ownership of lifecycle definitions.
- [Versioned definitions](../../docs/adr/0007-platform-owned-versioned-definitions.md):
  customer composition and plugins extend definition ownership and compatibility.
- [Human confirmation](../../docs/adr/0009-human-finding-confirmation-for-mvp.md):
  future configurable policy must not silently alter the MVP's fixed rule.
- [Separate worker](../../docs/adr/0010-separate-web-and-workflow-execution.md):
  the future execution adapter boundary needs clarification, not an implicit
  production topology change.

## Unresolved vocabulary

Ontology, graph, projection, classification rule, channel, processing aspect, and
Sandbox need sharper contracts. Sandbox may remain an execution-adapter capability
or become a Factory concept. No term is accepted merely because it appears in this
proposal. The unexplained "Bill manager" phrase in the initial graph example is
not used as a requirement; the graph-subject intent is preserved above.
