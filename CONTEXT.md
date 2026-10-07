# TBFactory

An extensible factory for automating complex processes with human and artificial intelligence assistance.

## Language

**Factory**:
The extensible platform in which complex processes are automated with human and artificial intelligence assistance.
_Avoid_: using Factory to mean a single process.

**Work Item**:
A collection of Facts accumulated over time about a specific task, such as a pull request, task, or feature. It has its own identity, belongs to an Organization and a Project, may be associated with a Repository, and can exist without an external source.
_Avoid_: using Pull Request as the name of the general concept.

**Work Item Type**:
A category of Work Items with its own allowed Factory states, State Transitions, and possible Approval Points. It defines whether a Transition Request is handled directly or starts a Workflow Run, including any required input data or confirmed prerequisite Facts.

**Kanban Board**:
A view specific to a Work Item Type that represents Work Items according to their Factory states.

**Fact**:
An immutable record of an occurrence concerning a Work Item, including an observed change in an external source; a correction is recorded as a new Fact. Recording a Fact does not itself imply a transition of the Work Item's Factory state.

**State Transition**:
A validated change to a Work Item's Factory state, performed automatically or with manual authorization. A change observed in an external source is distinct from this transition.

**Transition Request**:
A request to change a Work Item's Factory state, handled according to its Work Item Type. Requesting a transition does not itself change the state.

**Cancellation Request**:
A Fact emitted by an authorized User requesting cancellation, which the Factory can use as evidence to stop a Workflow Run. The request is distinct from evidence that the run has actually stopped.

**Workflow**:
A developer-defined process through which agents and humans can work on a Work Item and update its Factory state. It is one way, rather than the only way, to update that state.

**Workflow Run**:
A particular execution of a Workflow associated with a Work Item.

**Review Intake Workflow**:
A Workflow initiated by pull request import or a manual review request that waits for required review Facts, notifies the User about missing fields, and emits a review-start eligibility Fact when its preconditions are satisfied.

**Review Workflow**:
A Workflow that explores repository code, including differences between branches and relevant unchanged files, and produces an Artifact containing Findings. It is not responsible for closing a Work Item or changing its Factory state.

**Review Finalization Workflow**:
A Workflow that can end a Work Item's review lifecycle and perform the corresponding Factory State Transition.

**Finding**:
A review observation about code, produced during review and presented in an Artifact. A proposed Finding is distinct from confirmation of that observation.

**Review Decision**:
A User's consolidated review of a particular report version, recording confirmation or rejection of its Findings. It also records review of a report with no Findings.

**Artifact**:
A document or other unstructured source stored by the Factory. A Workflow may specify that it be published as an external reference.

**Organization**:
An independent customer boundary with isolated data, credentials, and policies.
_Avoid_: treating a provider's organization as automatically equivalent to a Factory Organization.

**User**:
A human participant represented by an identity in the Factory, with independent Memberships and permissions. Distinct external identities initially represent distinct Users, even when they share an email address.

**Membership**:
A user's belonging to an Organization, independent of that user's memberships in other Organizations.

**Invitation**:
An offer to an intended recipient to join a specific Organization with explicitly assigned initial permissions. Its authorized activation establishes the recipient's Membership and access within that Organization.

**API Credential**:
An expiring, revocable credential associated with one User and restricted to one Organization and a maximum set of Activities. Its effective access is bounded by the User's current Membership and permissions; its opaque token is shown once and stored only as a cryptographic digest.

**Service Identity**:
An Organization-specific execution identity used for automatically initiated Workflow Runs.

**Execution Identity**:
The identity under which a Workflow Run's authorization is evaluated. Automatic runs use their Organization's Service Identity.

**Project**:
A grouping of work and Repositories belonging to one Organization.

**Repository**:
A source code repository associated with one Project.

**Repository Access Credential**:
An Organization-owned credential for reading provider-hosted Repositories, which multiple Repositories may reference within its provider and access scope.
_Avoid_: API Credential, which authenticates a User to the Factory.

**Team**:
A group within an Organization that can operate across its Projects and Repositories.

**Activity**:
An operation subject to permissions at Organization, Project, Repository, Team, and User scopes, with automatic execution or required human intervention.

**Approval Point**:
A possible decision checkpoint declared by a Work Item Type within its Work Items' lifecycle. It identifies where confirmation or approval may be required.

**Approval**:
A decision by an authorized participant at an Approval Point, tied to the relevant evidence and input versions. Approval authority is separate from execution authority and does not grant a missing permission or override a prohibition.

## Post-MVP exploration language

The following terms describe the agreed direction of the post-MVP exploration.
They do not change the accepted MVP definitions or authorize implementation.
The [post-MVP model proposal](.scratch/post-mvp-factory-model/proposal.md) records
the context and the [decision map](.scratch/post-mvp-factory-model/spec.md) tracks
the unresolved contracts.

**Element (post-MVP)**:
An Organization-owned object in the Factory graph with a stable identity
independent of its types and any external representation. An Element can carry
multiple descriptive types and the Resource and Work Item roles under one identity.

**Assertion**:
An immutable subject-predicate-object assertion with statement-specific attribution
and temporal metadata; any local identity is scoped to its containing Assertion
Bundle for references from other Assertions in that same Bundle. It has no global
identity and does not itself establish current truth or authorize a Factory State
Transition.
_Avoid_: Fact as a synonym in the post-MVP model; Fact retains its MVP meaning.

**Assertion Bundle**:
An identified grouping of Assertions with shared receipt and provenance metadata,
which can be represented as a graph. It can describe multiple Elements within one
Organization and aggregate results from several integration queries.
_Avoid_: Fact Bundle, Fact Commit, or Event as parallel names for this concept.

**Resource**:
A Factory representation of an object or work context, such as an Organization,
Project, person, Repository, or Branch. Resource is a role of an Element, sharing
its identity and Assertion history with the Work Item role when both apply; the role
does not itself imply exclusive access.

**Work Item (post-MVP)**:
The role of an element on which the Factory performs work. The same element can
also be a Resource and carry multiple descriptive types, accumulating external
observations and processing Assertions under one identity while keeping external state
and Factory state distinct; only its Organization is required, and Project or
Repository associations can be established later.
_Avoid_: Factory Item as a parallel name.

**Comment (post-MVP)**:
An Element representing a comment, with its own Factory identity even when no
external representation is known. Export through an integration can establish an
external representation whose identifier is recorded as an Assertion about the same
local Comment.

**Resource Claim**:
A Workflow Run's declared intention to access a specific Resource with an access
mode, including shared reading or exclusive modification. Compatibility concerns
the intended access even when the run ultimately makes no modification.

**Trigger**:
A configured mechanism that uses rule evaluation results to request the start of
a Workflow Run for a Work Item. Eligibility is distinct from authorization and
successful acquisition of the required claims.
_Avoid_: Port for this domain concept; Port names an architectural contract.

**Factory Plugin**:
An installation-loaded extension supplied by the hosting TypeScript project or a
package, which contributes capabilities available for declarative composition in
the Factory. A User's declarative configuration is distinct from loading a Factory
Plugin's executable code.
