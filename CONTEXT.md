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

**Review Workflow**:
A Workflow that reviews code and produces an Artifact containing findings. It is not responsible for closing a Work Item or changing its Factory state.

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

**Membership**:
A user's belonging to an Organization, independent of that user's memberships in other Organizations.

**Service Identity**:
An Organization-specific execution identity used for automatically initiated Workflow Runs.

**Execution Identity**:
The identity under which a Workflow Run's authorization is evaluated. Automatic runs use their Organization's Service Identity.

**Project**:
A grouping of work and Repositories belonging to one Organization.

**Repository**:
A source code repository associated with one Project.

**Team**:
A group within an Organization that can operate across its Projects and Repositories.

**Activity**:
An operation subject to permissions at Organization, Project, Repository, Team, and User scopes, with automatic execution or required human intervention.

**Approval Point**:
A possible decision checkpoint declared by a Work Item Type within its Work Items' lifecycle. It identifies where confirmation or approval may be required.

**Approval**:
A decision by an authorized participant at an Approval Point, tied to the relevant evidence and input versions. Approval authority is separate from execution authority and does not grant a missing permission or override a prohibition.
