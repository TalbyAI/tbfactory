# TBFactory MVP: pull request review and Work Item finalization

Status: ready-for-agent
Labels: wayfinder:map

## Destination

Deliver the TBFactory MVP described below, resolving its recorded human checkpoints and feasibility questions before the implementation that depends on them.

## Notes

This existing implementation specification is the first map. Execution is included through its child tickets; the storage-feasibility ticket explicitly authorizes an isolated prototype. Follow the repository's local Markdown tracker, foundations, and canonical domain language. Work through one ticket per session.

## Problem Statement

Teams need to automate complex work with agents and humans while retaining control over authorization, review quality, and completion. For pull request review, an agent's proposed Finding is not a human-confirmed observation, successful analysis is not completion of the Work Item, and a provider event is not permission to change Factory state.

The Factory must preserve those distinctions across GitHub and Azure DevOps, independent Organizations, long human waits, process restarts, and deployments. Users need a trustworthy history, private Artifacts, and publication that does not silently repeat an external Activity after an uncertain response.

The repository contains the domain glossary, accepted foundations, and ten accepted ADRs. The isolated storage-feasibility investigation has executed checks and recorded its selected provider and dependency pins in the linked ticket. It has no production application implementation. This specification translates the accepted foundation into MVP behavior and acceptance requirements without inventing the detailed designs explicitly reserved for follow-up specifications.

## Solution

Provide one shared Factory installation in which Organizations manage their own Users, Memberships, policies, Projects, Repositories, Teams, and AI configuration. Users work with Work Items through protected application operations, a public backend API, and a Kanban Board specific to each Work Item Type.

The first functional process ingests pull request observations from GitHub and Azure DevOps or accepts manual/API requests, records immutable Facts, and handles Transition Requests according to the selected Work Item Type. A Review Workflow produces a version-bound report Artifact and proposed Findings. An authorized User reviews all Findings together, including reviewing reports with no Findings. Publication includes only confirmed Findings and requires separate execution authorization. Review completion leaves Factory state unchanged; a separate Review Finalization Workflow can perform the permitted lifecycle-ending State Transition.

Workflow Runs remain exclusive per Work Item during execution and human waits, retain their definition versions, and recover through persistent storage without repeating completed external Activities. Cancellation and uncertain publication outcomes remain visible, auditable processes rather than being treated as immediate success.

## User Stories

1. As a User, I want a Work Item to have its own identity, so that I can track work independently of an external provider.
2. As a User, I want to create a Work Item without an external source, so that internally initiated work fits the Factory model.
3. As a User, I want each Work Item to belong to an Organization and a Project, so that its ownership and access boundary are explicit.
4. As a User, I want a Work Item to have an optional Repository association, so that work without a Repository remains representable.
5. As a User, I want GitHub pull request observations recorded against the corresponding Work Item, so that I can review GitHub work through the Factory.
6. As a User, I want Azure DevOps pull request observations recorded against the corresponding Work Item, so that I can review Azure DevOps work through the Factory.
7. As a User, I want repeated delivery of an external event to avoid duplicate Facts, so that my history remains accurate.
8. As a User, I want at most one corresponding Work Item for an external resource within an Organization and Work Item Type, so that ingestion does not create competing records.
9. As a User, I want other Work Items to be able to reference an external resource, so that related work remains expressible without duplicating its primary correspondence.
10. As a User, I want Facts to remain immutable, so that earlier observations and decisions cannot be silently rewritten.
11. As a User, I want corrections recorded as new Facts, so that I can understand both the original occurrence and its correction.
12. As a User, I want an external state change to be recorded separately from a Factory State Transition, so that provider synchronization does not bypass Factory rules.
13. As a User, I want every Factory State Transition recorded alongside the stored current state, so that displayed state agrees with its history.
14. As a User, I want a Kanban Board specific to the Work Item Type, so that I can see work according to its permitted Factory states.
15. As a User, I want a board action to follow the same Transition Request rules as an API request, so that every entry point enforces the same constraints.
16. As a User, I want requesting a transition to remain distinct from completing it, so that a pending request does not misrepresent progress.
17. As a User, I want a Transition Request to perform a permitted direct transition or start the specified Workflow Run, so that the Work Item Type controls its lifecycle.
18. As a User, I want required input data and confirmed prerequisite Facts checked before the requested action proceeds, so that incomplete requests cannot bypass lifecycle requirements.
19. As a User, I want Factory state and Workflow Run execution state displayed as distinct concepts, so that a human wait or execution failure is not confused with Work Item completion.
20. As a User, I want a Review Workflow to produce a report Artifact containing proposed Findings, so that I can evaluate the agent's observations.
21. As a User, I want review output tied to a report version and relevant inputs, so that I know what code and evidence I am reviewing.
22. As an authorized User, I want to confirm or reject each Finding, so that only observations I validate become eligible for publication.
23. As an authorized User, I want to submit decisions for all Findings together, so that publication uses a consolidated Review Decision.
24. As a User, I want publication to wait until every Finding has a human decision, so that partially reviewed reports are not published.
25. As a User, I want publication to include only confirmed Findings, so that rejected proposals are not presented externally as validated observations.
26. As a User, I want rejected Findings and their reasons retained internally, so that the review history remains complete.
27. As an authorized User, I want to review a report with no Findings, so that an empty report still receives human validation.
28. As a User, I want agent proposals, Review Decisions, and corrections recorded separately, so that their different sources and authority remain clear.
29. As a User, I want CI results and other source observations to remain evidence rather than substitutes for human Finding confirmation, so that the MVP's review rule is enforced.
30. As a User, I want changes to relevant inputs to require renewed review or Approval, so that decisions cannot authorize work against superseded evidence.
31. As a User, I want unrelated Facts to leave an otherwise valid decision usable, so that irrelevant updates do not cause unnecessary human review.
32. As an authorized User, I want publication through comments or a report according to Work Item configuration and the Workflow, so that output reaches the intended destination.
33. As a User, I want publication authorization checked separately from Finding confirmation, so that approval authority does not grant missing execution permission.
34. As a User, I want completion of a Review Workflow to leave Factory state unchanged, so that analysis does not implicitly finalize the Work Item.
35. As an authorized User, I want a separate Review Finalization Workflow to perform the permitted lifecycle-ending State Transition, so that completion is deliberate and validated.
36. As a User, I want only one active Workflow Run per Work Item, so that concurrent runs cannot compete to advance the same work.
37. As a User, I want a Workflow Run waiting for Approval to retain exclusivity, so that a second run cannot bypass the pending decision.
38. As a User, I want new Facts to arrive while a run is active or suspended, so that external observations remain current during execution and human waits.
39. As a User, I want direct User/API transitions blocked while a run is active or suspended, so that only the owning run can perform permitted State Transitions.
40. As a User, I want direct transitions available when no run is active, so that authorized lifecycle changes do not always require a Workflow.
41. As a User, I want human waits to last days and survive restarts, so that I can review work without depending on a continuously running process.
42. As a User, I want completed external Activities preserved during recovery, so that a restart or deployment does not repeat publication.
43. As an authorized User, I want to record a Cancellation Request, so that the Factory can stop an unwanted Workflow Run.
44. As a User, I want cancellation to preserve Facts, Artifacts, and completed Activities, so that stopping execution does not erase history.
45. As a User, I want cancellation requests distinguished from confirmed stops, so that a new run cannot overlap with a previous run still executing.
46. As an authorized User, I want provider evidence gathered after an uncertain publication outcome, so that recovery can establish what actually happened.
47. As an authorized User, I want recovery to require my confirmation when publication is uncertain and provider idempotency is unavailable, so that the Factory does not blindly duplicate an external Activity.
48. As a User, I want authentication through an external identity provider, so that human identity is established before Factory access is evaluated.
49. As a User, I want independent Memberships in multiple Organizations, so that access in one customer boundary does not imply access in another.
50. As a User, I want my Organization's data, credentials, and policies isolated, so that another Organization cannot access or use them.
51. As an Organization operator, I want Projects and Repositories to retain their ownership hierarchy, so that policies apply within the correct customer boundary.
52. As an Organization operator, I want Teams to operate across the Organization's Projects and Repositories, so that collaboration is not limited to a single Repository.
53. As an Organization operator, I want Activity authorization denied by default with inherited grants and prevailing explicit prohibitions, so that permissive local settings cannot bypass restrictions.
54. As an Organization operator, I want every applicable Team policy evaluated for the Execution Identity, so that one Team's grant cannot bypass another applicable prohibition.
55. As an Organization operator, I want any applicable human-intervention requirement to prevent automatic execution, so that automation respects human checkpoints.
56. As an Organization operator, I want Approval authority separate from execution authority and limited to Users in the same Organization, so that Approval does not override authorization boundaries.
57. As an Organization operator, I want authorization checked again immediately before an Activity proceeds, so that an earlier Approval does not preserve revoked access.
58. As an Organization operator, I want every Workflow Run to have an explicit Execution Identity, so that authorization can be evaluated consistently.
59. As an Organization operator, I want automatically initiated runs to use the Organization's Service Identity, so that automatic execution remains scoped and attributable.
60. As an Organization operator, I want to configure AI providers, permitted models, and isolated credentials, so that agents use the Organization's approved AI resources.
61. As an Organization operator, I want time and call-count limits enforced per Workflow Run, so that AI execution stays within the configured bounds.
62. As a User, I want Artifacts private by default and accessible under Factory authorization, so that review content is not exposed by its storage location.
63. As an authorized User, I want external Artifact sharing explicit, limited, and revocable, so that publishing a reference does not create unrestricted permanent access.
64. As an Organization operator, I want to select and configure available platform-owned Workflows and Work Item Types, so that I can use supported definitions without supplying executable code.
65. As a User, I want existing Workflow Runs to retain their Workflow version across deployments, so that suspended execution continues under its original definition.
66. As a User, I want Work Items to retain their state-flow version until an explicit migration, so that a deployment does not silently reinterpret their lifecycle.
67. As an installation operator, I want long-running execution in a separate worker, so that human waits and recovery do not depend on an HTTP request remaining open.
68. As an installation operator, I want persistent Factory data, Workflow Run storage, and Artifact content, so that restarts preserve the information needed to continue work.
69. As an installation operator, I want the candidate Mastra-SurrealDB adapter tested with process and database restarts and concurrency, so that adoption depends on demonstrated behavior.
70. As an installation operator, I want a Mastra-supported storage provider selected if the adapter fails its bounded evaluation, so that a custom adapter project does not delay the MVP.

## Implementation Decisions

### Accepted architecture and boundaries

- TanStack Start owns the frontend, protected application operations, and public backend API. A separate Mastra worker executes Workflows and agents using the same platform codebase and domain rules. The initial deployment is a shared multi-Organization installation on a server or in containers.
- SurrealDB is the primary database for Work Items, immutable Facts, stored current Factory state, Users, Memberships, authorization data, and Artifact metadata. Initial Artifact content resides on a persistent file volume and is accessed through Factory authorization.
- Human authentication uses an external identity provider. The Factory owns User mapping, Memberships, and authorization; provider identity does not itself authorize an Activity.
- Organizations configure isolated AI provider credentials, permitted models, and per-run time and call-count limits. These controls do not replace Activity authorization or human Finding confirmation.
- Initial Workflows and Work Item Types are platform code. Organizations select and configure available definitions; active definition versions remain available across deployments.

### Accepted domain behavior

- A Work Item has its own identity, belongs to exactly one Organization and Project, may be associated with a Repository, and may have no external source. Projects belong to one Organization; Repositories belong to one Project; Teams remain within their Organization.
- External-resource correspondence is unique per Organization and Work Item Type. Other Work Items may reference the resource. Repeated delivery of the same event must not duplicate Facts.
- Facts are immutable and corrections create new Facts. External observations do not themselves change Factory state. Each validated State Transition must leave the stored current state and its recorded Fact consistent; concrete atomic persistence is a follow-up design requirement.
- Work Item Types define states, allowed State Transitions, possible Approval Points, and Transition Request handling, including required inputs and confirmed prerequisite Facts. Board actions and API requests follow the same rules. Request acceptance is distinct from completed transition.
- Factory state and Workflow Run execution state are separate. A Review Workflow produces Findings and an Artifact without changing Factory state or closing the Work Item. A Review Finalization Workflow can perform the lifecycle-ending State Transition.
- Each Workflow Run has an explicit Execution Identity. Automatic runs use an Organization-specific Service Identity. Authorization combines applicable Organization, Project, Repository, Team, and User policies: default deny, inherited grants, prevailing explicit prohibitions, and human intervention whenever any applicable policy requires it. All associated Teams are evaluated.
- Approval requires its own authority and same-Organization Membership. It cannot grant missing execution permission or override a prohibition. Execution authorization is checked again before an Activity proceeds.

### Accepted execution, review, and publication behavior

- Only one Workflow Run may be active per Work Item, including suspended human waits. While it owns execution, only that run may perform permitted State Transitions. New Facts remain admissible. Direct User/API transitions are available only without an active run.
- Workflows declare relevant inputs. Approval is bound to a specific Activity and relevant input versions; a Review Decision is bound to a report version and relevant inputs. Relevant changes require revalidation and renewed confirmation; unrelated Facts do not automatically invalidate decisions.
- The MVP has a fixed human validation rule: an authorized User in the same Organization confirms or rejects all Findings and submits one consolidated Review Decision. Empty reports also require review. Publication waits for a complete decision and includes only confirmed Findings; rejected Findings and reasons remain internal.
- Agent proposals, human decisions, and corrections are separate occurrences in the immutable Fact history. Source observations, including CI results, cannot substitute for the required human decision.
- Publication follows initial Work Item configuration and the Workflow through comments or a report. Finding confirmation and authorization to publish are separate checks. Artifact sharing is private by default; external references require explicit, limited, revocable access.
- Runs must survive waits lasting days and continue after restarts or deployments without repeating completed external Activities. Workflow snapshot persistence alone does not establish exactly-once external effects.
- Authorized Users emit Cancellation Requests as Facts; type-defined rules may authorize automatic cancellation. A request is distinct from evidence that execution stopped. Facts, Artifacts, and completed Activities survive cancellation, and exclusivity is retained while the old run still executes.
- Recovery first gathers provider evidence for uncertain publication. When idempotency is unavailable, User confirmation is required; unresolved outcomes cannot trigger blind retries.
- Workflow Runs retain their starting Workflow version. Work Items retain their state-flow version until an explicit migration. Deployments must preserve definitions needed by existing runs and items.

### Conditional storage decision and required follow-up designs

- Evaluate the existing Mastra-SurrealDB adapter in an isolated, one-working-day prototype using a disposable database with persistent storage and a pinned, mutually compatible dependency set. The executed result and exact dependency pins belong to the storage-feasibility ticket.
- Adopt the adapter only if the restart, resume, output-retention, and concurrency checks pass within the timebox. Otherwise select a Mastra-supported provider and record the failed criterion. This policy has been applied in the resolved storage-feasibility ticket indexed below. Substantial custom adapter development is excluded.
- The adapter result affects Mastra storage only; SurrealDB remains the primary Factory database regardless of that result.
- The following detailed designs remain unresolved. Their requirements stay within the MVP, and decisions must be recorded before implementation that depends on them:

| Follow-up area | Decisions still required |
| --- | --- |
| Adapter prototype | Resolved; use the storage-feasibility ticket's selected provider, pins, and evidence. |
| Domain persistence and API | Schemas, provider identifiers, duplicate-ingestion mechanism, atomic state/history updates, command contracts, and ownership enforcement. |
| Review lifecycle and interaction | Concrete type states, prerequisites, input collection, report decision/version handling, superseded inputs, reruns, and explicit migrations. |
| Identity and integrations | Identity provider and protocol, User mapping, provider credentials, external API authentication, secret storage, and scoped access. |
| AI execution | Concrete providers/models, allowed configuration, credential handling, consumption accounting, and run-limit enforcement. |
| Runtime and deployment | Scheduling, exclusive ownership, cancellation completion, recovery coordination, provider reconciliation, volumes, and operational checks. |
| Artifacts and publication | Content/reference versioning, destinations, private sharing, expiry/revocation mechanisms, and retention. |

No concrete endpoints, schema fields, state names, scheduling algorithm, authentication protocol, or sharing mechanism are accepted merely by appearing as an implementation possibility. This specification preserves the accepted ADRs rather than reopening them.

## Testing Decisions

- **Strategy traceability:** The primary end-to-end test seam is a specification-level testing decision. Its User confirmation on 2026-10-02 is recorded below; no separate conversation transcript or ADR documenting that confirmation is stored in this repository. The behavior to verify comes from the foundations' [domain and authorization invariants](../../docs/foundations.md#domain-and-authorization-invariants), [execution and recovery invariants](../../docs/foundations.md#execution-and-recovery-invariants), and [human review and publication](../../docs/foundations.md#human-review-and-publication). [ADR 0010](../../docs/adr/0010-separate-web-and-workflow-execution.md) establishes the separate worker boundary; these sources do not prescribe the primary test seam. The separate adapter feasibility check directly follows the [planned prototype](../../docs/foundations.md#planned-mastrasurrealdb-adapter-prototype) and [ADR 0001](../../docs/adr/0001-required-stack.md). These are planned checks, not evidence of executed tests.
- Test externally observable behavior: accepted/rejected operations, visible state and history, report versions and decisions, accessible Artifacts, actual publication attempts, and recoverable runs. Avoid assertions about internal class structure, call order unrelated to behavior, or the shape of Mastra's private snapshots.
- **Confirmed primary seam:** exercise the public Factory operations end to end, with the worker and persistent stores running as separate processes. Use the API as the repeatable entry point and a small number of Kanban Board/UI scenarios to verify that human interaction reaches the same rules. Simulate source-provider and AI boundaries with controllable evidence and effect recording; retain real persistence and restart behavior. The User confirmed the full public flow and the separate adapter check on 2026-10-02.
- At that seam, cover ingestion, ownership enforcement, Transition Requests, immutable history, review and human decisions, authorized publication, separate finalization, cancellation, and recovery. These are behavioral areas of the future application, not existing modules with established test seams.
- Parameterize provider behavior for GitHub and Azure DevOps. Repeated events must produce one Fact; the same external resource must not create duplicate corresponding Work Items within the same Organization and Work Item Type. Separately verify permitted references and independent Organization/type boundaries.
- Verify consistent stored state and transition history on success, rejection, and interrupted persistence. Rejection must not leave a transitioned state or a misleading successful-transition Fact. External observations must remain distinct from State Transitions.
- Use at least two Organizations, independent Memberships, multiple applicable Teams, and conflicting scoped policies to verify isolation, default deny, inherited grants, prevailing prohibitions, and required human intervention. Exercise revoked execution permission after Approval and reject cross-Organization Approval and Artifact access.
- Review scenarios include confirmed/rejected Findings, incomplete decision submission, empty reports, rejection reasons retained internally, relevant inputs changed before publication, unrelated new Facts, and separate publication authorization. Source or AI evidence alone must not satisfy human confirmation. Review completion must preserve Factory state; permitted finalization must record its own State Transition.
- Submit concurrent requests for the same Work Item and verify at most one active run. Suspended Approval retains exclusivity while Facts can still arrive. Direct transitions must not bypass the active run. Different Work Items may run concurrently.
- Test cancellation during execution and suspension. A recorded Cancellation Request must not release exclusivity before evidence of a stop; completed Activities and Artifacts remain available afterward.
- Stop and restart application/worker processes and persistent storage around human waits and external Activities. Verify the same Workflow Run identity, surviving outputs, unchanged completed effects, and retained Workflow/state-flow versions across deployments. A short automated wait can exercise persistence without literally delaying a test for days.
- Inject publication outcomes including confirmed success, failed requests, and provider success followed by a lost response before local confirmation. Verify evidence gathering, required User confirmation when idempotency is unavailable, and absence of blind duplicate publication. A simulated effect log checks replay behavior but does not prove production provider exactly-once semantics.
- Verify Factory-authorized Artifact access and denial after the sharing limit, expiry where selected, or revocation defined by the follow-up design. Verify configured AI model restrictions and time/call-count limits through observable acceptance, refusal, or stopping behavior according to that design.
- **Confirmed separate adapter feasibility seam:** use the candidate adapter's public Workflow Run persistence/resume operations against persistent SurrealDB. Complete a step, suspend for human input, capture the run identifier, terminate the application process, and load/resume the same run in a fresh process. Assert output retention and no repeat of completed work. Repeat with a database restart against the same data.
- The adapter prototype must also verify parallel steps within a run, concurrent runs for different Work Items, retained snapshot results, and recorded simulated external effects. Record exact versions, checks, failures, and effort within one working day. Passing storage checks does not validate Factory authorization, exclusive ownership, or real provider publication recovery.
- **Prior art:** the isolated storage prototype provides runnable public-framework checks and recorded restart/concurrency evidence. The authenticated Work Item increment now implements production public-operation and minimal UI checks, including persistent restart and key-ring restoration; see its linked resolution below. Workflow/provider execution checks remain subsequent work. Reuse public framework operations where feasible rather than introduce a new testing abstraction.
- Concrete test tools and fixtures are follow-up implementation choices. Begin with the smallest runnable behavioral checks that cover the selected increment; avoid a speculative collection of component-level suites.

## Decisions so far

- [Generate a private report in a durable Review Workflow](issues/05-durable-private-review-report.md#resolution--2026-10-05): delivered exclusive intake/handoff, isolated Docker repository exploration, retained AI configuration and shared budgets, immutable private reports, human waits and conservative recovery with completed-call reuse; 59 checks plus built HTTP/UI/restart acceptance pass.

- [Establish the Mastra Docker sandbox integration contract](issues/15-mastra-docker-sandbox-contract.md#resolution--2026-10-05): official DockerSandbox has declared compatibility with the selected core pin; use container-native checkout and platform Git/read/search tools, with runtime isolation/recovery validation still required.

- [Establish the Mastra local sandbox integration boundary](issues/14-mastra-local-sandbox-contract.md#resolution--2026-10-05): per-run Workspace supports the local composition; host command isolation is opt-in and OS-specific, requiring restricted platform tools and validated backend isolation.

- [Establish Mastra AI provider configuration constraints](issues/13-mastra-ai-provider-contracts.md#resolution--2026-10-04): Mastra supports router IDs, native model adapters, and OpenAI-compatible configurations; endpoint/effort capabilities are adapter-specific, and Factory owns isolation and cumulative budgets.

- [Validate durable Workflow storage within one working day](issues/01-validate-durable-workflow-storage.md): select LibSQL after the candidate's incremental concurrent-update failure; retain SurrealDB for Factory data.
- [Create an authenticated, Organization-scoped Work Item](issues/02-authenticated-organization-work-items.md#resolution--2026-10-03): delivered shared authenticated operations, immutable history, bounded Invitations/API credentials and recoverable key ring; public/UI, concurrency, restart and restoration checks pass.
- [Execute authorized Transition Requests from the Kanban Board and API](issues/03-authorized-transition-requests.md#resolution--2026-10-03): delivered retained state-flow versions, atomic direct transitions, scoped Team policies and durable activity-bound Approval with current authorization rechecks; Workflow execution and explicit migration remain gated by their own issues.
- [Ingest deduplicated pull request observations from both providers](issues/04-provider-observation-ingestion.md#resolution--2026-10-04): delivered native provider authentication, scoped encrypted sources, atomic correspondence and event deduplication, and immutable observation history; built HTTP/CLI, concurrency, restart and restoration checks pass, with real Workflow ingestion drills assigned to Issues 05 and 12.

## Out of Scope

- Contracting and billing UI for platform AI in the initial review increment; Organization entitlement is activated/revoked operationally and consumption is recorded.
- Additional sandbox backends before local MVP validation; subsequent adoption of Mastra-supported options remains the agreed follow-up direction.

- Modifying source code, approving provider pull requests, or merging pull requests in the pilot.
- Concrete task, feature, or other non-review processes; the general Work Item domain remains available without designing those lifecycles now.
- Customer-authored Workflows, execution of arbitrary customer-supplied code, or a customer Workflow editor.
- Configurable Approval Point rule evaluation, combinations of confirmers, and agent-only or integration-only Finding confirmation. The MVP retains fixed human validation.
- Simultaneous active Workflow Runs for the same Work Item or coordinated concurrent state-writing for that item. Parallel steps within one run and runs for different Work Items are not excluded.
- Complete reconstruction of Factory state by replaying all Facts as an initial requirement.
- Substantial custom Mastra-SurrealDB adapter development or extending the prototype beyond its accepted one-working-day timebox.
- Claiming that a storage adapter or framework snapshots guarantee exactly-once provider effects.
- Additional object-storage infrastructure as a prerequisite for initial Artifact storage.
- Resolving implementation choices by silently changing accepted architecture, domain invariants, or MVP boundaries. The required follow-up designs are subsequent work, not removed MVP requirements.
- Implementing application code, executing the adapter prototype, or creating implementation tickets as part of publishing this specification.

## Further Notes

- Source of truth: [accepted foundations](../../docs/foundations.md), [canonical glossary](../../CONTEXT.md), and [accepted ADRs](../../docs/adr/). The foundations record agreement through Q46 on 2026-10-02. All ten ADRs are accepted; no conflicting architecture proposal is introduced here.
- This is an umbrella MVP specification. Its `ready-for-agent` status is the requested tracker label for the synthesized specification; the Workflow storage decision is complete as recorded in the linked storage-feasibility ticket, while the other listed implementation designs remain open. An agent can use it to derive the required bounded follow-up specifications. Implementation that depends on an unresolved choice must first complete the corresponding design.
- The source's technical investigation was recorded on 2026-10-01. This synthesis does not refresh external documentation. The storage prototype selected LibSQL and validated the selected provider's pinned dependency set recorded in the linked storage-feasibility ticket.
- Publication to the local issue tracker consists of this specification. No external issue system, additional architecture document, or combined implementation-ticket file is needed.
