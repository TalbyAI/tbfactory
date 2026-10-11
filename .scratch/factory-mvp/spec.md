# TBFactory MVP: pull request review and Work Item finalization

Status: ready-for-agent
Labels: wayfinder:map
State: open

## Destination

Deliver the TBFactory MVP described below, resolving its recorded human checkpoints and feasibility questions before the implementation that depends on them.

## Notes

This existing implementation specification is the first map. Execution is included through its child tickets; the storage-feasibility ticket explicitly authorizes an isolated prototype. Follow the repository's local Markdown tracker, foundations, and canonical domain language. Work through one ticket per session.

## Problem Statement

Teams need to automate complex work with agents and humans while retaining control over authorization, review quality, and completion. For pull request review, an agent's proposed Finding is not a human-confirmed observation, successful analysis is not completion of the Work Item, and a provider event is not permission to change Factory state.

The Factory must preserve those distinctions across GitHub and Azure DevOps, independent Organizations, long human waits, process restarts, and deployments. Users need a trustworthy history, private Artifacts, and publication that does not silently repeat an external Activity after an uncertain response.

The repository contains the domain glossary, accepted foundations, and ten accepted ADRs. The isolated storage-feasibility investigation has executed checks and recorded its selected provider and dependency pins in the linked ticket. The application and local installation increments have been delivered; the User-selected Docker evaluation is accepted. The historical worker-ownership startup report is unexplained and suspended pending reproducible reporting conditions, with no correction claimed. This specification translates the accepted foundation into MVP behavior and acceptance requirements without inventing the detailed designs explicitly reserved for follow-up specifications.

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
- The following areas were identified as required follow-up designs in the initial specification. Their requirements stay within the MVP; linked implementation resolutions below record completed contracts, while deployment acceptance remains open. Any remaining decisions must be recorded before dependent implementation:

| Follow-up area | Required design coverage |
| --- | --- |
| Adapter prototype | Resolved; use the storage-feasibility ticket's selected provider, pins, and evidence. |
| Domain persistence and API | Schemas, provider identifiers, duplicate-ingestion mechanism, atomic state/history updates, command contracts, and ownership enforcement. |
| Review lifecycle and interaction | Concrete type states, prerequisites, input collection, report decision/version handling, superseded inputs, reruns, and explicit migrations. |
| Identity and integrations | Identity provider and protocol, User mapping, provider credentials, external API authentication, secret storage, and scoped access. |
| AI execution | Concrete providers/models, allowed configuration, credential handling, consumption accounting, and run-limit enforcement. |
| Runtime and deployment | Scheduling, exclusive ownership, cancellation completion, recovery coordination, provider reconciliation, volumes, and operational checks. |
| Artifacts and publication | Content/reference versioning, destinations, private sharing, expiry/revocation mechanisms, and retention. |

No concrete endpoints, schema fields, state names, scheduling algorithm, authentication protocol, or sharing mechanism are accepted merely by appearing as an implementation possibility. This specification preserves the accepted ADRs rather than reopening them.

### Accepted operational limits — 2026-10-07

The User confirmed reopening [Issue 12](issues/12-persistent-shared-installation.md)
and requiring executed manual work and evidence before closing that ticket or this
specification. Native Node remains a provisional local implementation choice;
the earlier local-installation approval did not choose the production architecture.
Temporary backup interruption is accepted for the MVP. Its maintenance window and
maximum total interruption must be agreed after measurement in the chosen
environment and before closure.

Restored external observations recorded at or before activation do not automatically
start new Review Workflows, including legitimate starts whose receipt or Run is
absent from the recovery point. This is an accepted MVP limitation. Existing Run
durability, retained human waits, and conservative manual recovery of interrupted
execution remain required. The broader durability/restart redesign is deferred in
[Issue 18](issues/18-redesign-durable-recovery.md). The historical ownership startup
report is tracked in [Issue 17](issues/17-diagnose-worker-ownership-recovery.md), now
open and suspended with `Status: needs-info` because its reporting conditions cannot
currently be reproduced. Its cause remains unknown and no correction is claimed. It
is not a current blocker; preserve ownership protections and perform Issue 12's
deployment-specific restart and recovery checks.

## Testing Decisions

- **Strategy traceability:** The primary end-to-end test seam is a specification-level testing decision. Its User confirmation on 2026-10-02 is recorded below; no separate conversation transcript or ADR documenting that confirmation is stored in this repository. The behavior to verify comes from the foundations' [domain and authorization invariants](../../docs/foundations.md#domain-and-authorization-invariants), [execution and recovery invariants](../../docs/foundations.md#execution-and-recovery-invariants), and [human review and publication](../../docs/foundations.md#human-review-and-publication). [ADR 0010](../../docs/adr/0010-separate-web-and-workflow-execution.md) establishes the separate worker boundary; these sources do not prescribe the primary test seam. The separate adapter feasibility check directly follows the [planned prototype](../../docs/foundations.md#planned-mastrasurrealdb-adapter-prototype) and [ADR 0001](../../docs/adr/0001-required-stack.md). This traceability note records the planned seam, not execution evidence; see Issue 01 for the executed adapter feasibility result.
- Test externally observable behavior: accepted/rejected operations, visible state and history, report versions and decisions, accessible Artifacts, actual publication attempts, and recoverable runs. Avoid assertions about internal class structure, call order unrelated to behavior, or the shape of Mastra's private snapshots.
- **Confirmed primary seam:** exercise the public Factory operations end to end, with the worker and persistent stores running as separate processes. Use the API as the repeatable entry point and a small number of Kanban Board/UI scenarios to verify that human interaction reaches the same rules. Simulate source-provider and AI boundaries with controllable evidence and effect recording; retain real persistence and restart behavior. The User confirmed the full public flow and the separate adapter check on 2026-10-02.
- At that seam, cover ingestion, ownership enforcement, Transition Requests, immutable history, review and human decisions, authorized publication, separate finalization, cancellation, and recovery. The implementation tickets and test sources below now cover these behavioral areas; their local execution records do not establish acceptance on a yet-to-be-selected installation.
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
- **Prior art:** the isolated storage prototype provides runnable public-framework checks and recorded restart/concurrency evidence. The authenticated Work Item increment and subsequent Review Workflow, provider, publication, cancellation, finalization, migration, and installation increments record local public-operation, Board/UI, restart, and recovery checks in their linked resolutions. Those historical local results are supplemented by the executed Docker installation checks linked from Issue 12; the operator accepted measured evaluation limits on 2026-10-08. Reuse public framework operations where feasible rather than introduce a new testing abstraction.
- Concrete test tools and fixtures are follow-up implementation choices. Begin with the smallest runnable behavioral checks that cover the selected increment; avoid a speculative collection of component-level suites.

## Decisions so far

- [User interface acceptance](issues/19-compact-kanban-and-work-item-detail.md#foreground-focus-and-user-visual-acceptance--2026-10-11): the User confirmed authorization, navigation, access and visible foreground focus in the isolated Microsoft-authenticated installation. Issue 19 is closed; the real Azure DevOps walkthrough in Issue 20 and overall MVP acceptance remain open.

- [Compact interface implementation](issues/19-compact-kanban-and-work-item-detail.md#implementation-and-local-verification--2026-10-08): local Board/detail/creation/Administration changes pass 198 tests with one expected Windows skip; foreground focus and User visual acceptance remain pending. [First real Azure DevOps Review](issues/20-guided-real-azure-devops-review.md#walkthrough-preparation-and-tenant-supplied--2026-10-08): the tutorial records Repository, tenant and OpenRouter/max choices; live identity, credentials, budget, PR and provider execution remain unaccepted.

- [Docker evaluation on the current PC](designs/docker-evaluation.md): the User selected Docker for the Factory and dependencies, acts as operator, and chose a Docker backup volume and SMTP4Dev mock inbox. The [executed evaluation](evidence/docker-evaluation.md) verifies the chosen runtime and records the accepted two-minute backup window and five-minute recovery-time objective; same-host results do not establish recovery after host loss or real deployment readiness.

- [Reopen installation acceptance after assumption review](issues/12-persistent-shared-installation.md#reopened-after-assumption-review--2026-10-07): local installation remains delivered; ticket and specification stay open until manual deployment/recovery checks are completed. Node is provisional locally, MVP backup interruption is accepted subject to measured limits, and the broader recovery redesign is deferred.

- [Worker ownership diagnostic disposition](issues/17-diagnose-worker-ownership-recovery.md#user-directed-suspension--2026-10-07): open with `Status: needs-info` and `suspended` label because the reported conditions cannot currently be reproduced. The original cause remains unknown; no correction is claimed. It is not a current blocker. Preserve ownership protections and complete Issue 12's installation-specific restart and recovery checks.

- [Redesign durable recovery beyond the MVP](issues/18-redesign-durable-recovery.md): User-approved post-MVP follow-up for observation recovery and interrupted-run restart design, preserving existing MVP durability and conservative recovery commitments.

- [Local installation delivery](issues/12-persistent-shared-installation.md#resolution--2026-10-06): historical web/worker, recovery-bundle, activation-hold and isolated-drill evidence, including a 179/179 invocation following an unexplained 178/179 ownership failure; the historical closure is superseded by the reopening agreement.

- [Retain definition versions and explicitly migrate Work Items](issues/11-retained-versions-and-explicit-migration.md#resolution--2026-10-06): delivered narrow authorized atomic migrations, unchanged retained lifecycle history and obsolete prior review evidence; eight focused checks and built HTTP/browser/restart acceptance pass.

- [Finalize a Work Item through a separate Review Finalization Workflow](issues/10-separate-review-finalization.md#resolution--2026-10-06): delivered version-appropriate current evidence and authorization checks, exclusive durable finalization and atomic lifecycle completion; focused public checks plus built HTTP/browser/restart acceptance pass.

- [Cancel a Workflow Run after a confirmed stop](issues/09-confirmed-workflow-run-cancellation.md#resolution--2026-10-06): delivered authorized immutable requests, confirmed-stop ownership release, conservative publication resolution and preserved history; eight focused checks plus built HTTP/browser/restart acceptance pass.

- [Publish an explicitly shared, limited report Artifact](issues/08-limited-report-artifact-sharing.md#resolution--2026-10-06): delivered version-5 immutable confirmed-only references, named-human recipient access, independent sharing/publication/revocation authorization, bounded expiry and permanent retained revocations; 147 checks plus built HTTP/browser/restart acceptance pass. Retained versions and provider recovery remain available; migration and manual correspondence remain separate increments.

- [Approved publication boundaries](designs/confirmed-publication-and-reconciliation.md#user-approval--2026-10-05): retain version 4, explicit publication requests and same-run ownership; allow corrections after safe nonpublication with a new Activity; require sufficient recovery evidence and preserve positive matches. Version migration remains Issue 11; [manual correspondence](issues/16-explicit-manual-provider-correspondence.md) is deferred.

- [Publish confirmed Findings and reconcile uncertain outcomes](issues/07-confirmed-publication-and-reconciliation.md#approved-approval-wait-recovery-correction--2026-10-05): delivered separate execution/Approval checks, corrections after safe nonpublication with new Activities, sufficient evidence and persistent positive matches, evidence-based recovery from Approval waits, durable recovery and UI/API history; 128 checks plus built HTTP/browser/restart acceptance pass. Publication requires version 4; retained versions await Issue 11 migration and explicit manual correspondence remains deferred.

- [Submit and revalidate a consolidated Review Decision](issues/06-current-consolidated-review-decisions.md#resolution--2026-10-05): delivered complete human submissions, immutable corrections, input/report currentness, Activity-bound Approval rechecks and same-run continuation with unchanged Factory state; 69 checks plus production HTTP/browser/restart acceptance pass.

- [Generate a private report in a durable Review Workflow](issues/05-durable-private-review-report.md#resolution--2026-10-05): delivered exclusive intake/handoff, isolated Docker repository exploration, retained AI configuration and shared budgets, immutable private reports, human waits and conservative recovery with completed-call reuse; 59 checks plus built HTTP/UI/restart acceptance pass.

- [Establish the Mastra Docker sandbox integration contract](issues/15-mastra-docker-sandbox-contract.md#resolution--2026-10-05): official DockerSandbox has declared compatibility with the selected core pin; use container-native checkout and platform Git/read/search tools, with runtime isolation/recovery validation still required.

- [Establish the Mastra local sandbox integration boundary](issues/14-mastra-local-sandbox-contract.md#resolution--2026-10-05): per-run Workspace supports the local composition; host command isolation is opt-in and OS-specific, requiring restricted platform tools and validated backend isolation.

- [Establish Mastra AI provider configuration constraints](issues/13-mastra-ai-provider-contracts.md#resolution--2026-10-04): Mastra supports router IDs, native model adapters, and OpenAI-compatible configurations; endpoint/effort capabilities are adapter-specific, and Factory owns isolation and cumulative budgets.

- [Validate durable Workflow storage within one working day](issues/01-validate-durable-workflow-storage.md): select LibSQL after the candidate's incremental concurrent-update failure; retain SurrealDB for Factory data.
- [Create an authenticated, Organization-scoped Work Item](issues/02-authenticated-organization-work-items.md#resolution--2026-10-03): delivered shared authenticated operations, immutable history, bounded Invitations/API credentials and recoverable key ring; public/UI, concurrency, restart and restoration checks pass.
- [Execute authorized Transition Requests from the Kanban Board and API](issues/03-authorized-transition-requests.md#resolution--2026-10-03): delivered retained state-flow versions, atomic direct transitions, scoped Team policies and durable activity-bound Approval with current authorization rechecks; Workflow execution and explicit migration remain gated by their own issues.
- [Ingest deduplicated pull request observations from both providers](issues/04-provider-observation-ingestion.md#resolution--2026-10-04): delivered native provider authentication, scoped encrypted sources, atomic correspondence and event deduplication, and immutable observation history; built HTTP/CLI, concurrency, restart and restoration checks pass, with real Workflow ingestion drills assigned to Issues 05 and 12.

## Requirement-to-evidence index

The `User stories covered` metadata in Issues 01–12 provides the story-to-ticket
mapping below. A local check of that metadata found every story ID from 1 through
70 and no unassigned ID. This confirms traceability only; it does not prove that
each acceptance condition passed. Ticket resolutions and evidence files record
historical local runs. Test links below point to source files verified in this
checkout. The [Docker evaluation evidence](evidence/docker-evaluation.md) adds
executed checks on the User-selected installation and records the fresh package
verification separately from historical results. Generated
`.runtime/` logs and browser JSON referenced by older resolutions are ignored local
artifacts, not committed evidence. Issue 12 is closed for the User-selected Docker evaluation with operational
limits accepted on 2026-10-08. Same-host recovery does not establish
independent recovery after host loss, which remains required before real deployment.

| User Stories declared by ticket | Ticket, design, and evidence sources | Evidence state and remaining limit |
| --- | --- | --- |
| 69–70 | [Issue 01 resolution](issues/01-validate-durable-workflow-storage.md#resolution--2026-10-02), [prototype instructions](../../prototypes/durable-workflow-storage/README.md), [research](../../prototypes/durable-workflow-storage/research.md), and [executed report](../../prototypes/durable-workflow-storage/evidence/cd3afef2-c6dc-4043-9874-0b9583f0826f.json). | The bounded feasibility run selected LibSQL after recording the SurrealDB candidate's concurrency failure. This is adapter feasibility evidence, not Factory installation acceptance. |
| 1–4, 9–11, 48–51, 68 | [Issue 02 resolution](issues/02-authenticated-organization-work-items.md#resolution--2026-10-03), [design](designs/authenticated-organization-work-items.md), [implementation evidence](evidence/authenticated-organization-work-items.md), and test sources [work-items](../../tests/work-items.test.ts), [auth](../../tests/auth.test.ts), [invitations](../../tests/invitations.test.ts), [credentials](../../tests/credentials.test.ts), [key ring](../../tests/key-ring.test.ts), and [secrets](../../tests/secrets.test.ts). | The ticket records local public/UI, concurrency, restart, and restoration checks. Current test-source presence is verified; production deployment evidence remains pending where required by Issue 12. |
| 13–19, 40, 52–58, 64, 66 | [Issue 03 resolution](issues/03-authorized-transition-requests.md#resolution--2026-10-03), [design](designs/authorized-transition-requests.md), [acceptance evidence](evidence/authorized-transition-requests.md), and test sources [transitions](../../tests/transitions.test.ts), [policies](../../tests/policies.test.ts), [review approvals](../../tests/review-approvals.test.ts), and [type migrations](../../tests/type-migrations.test.ts). | The ticket records public API and Board checks, including restart/restore and policy cases. Workflow-backed transitions and explicit migration have their own scope and evidence; do not infer those from direct-transition coverage. |
| 5–8, 12, 38 | [Issue 04 resolution](issues/04-provider-observation-ingestion.md#resolution--2026-10-04), [ingestion design](designs/provider-observation-ingestion.md), [acceptance evidence](evidence/provider-observation-ingestion.md), and test sources [observations](../../tests/observations.test.ts) and [installation observations](../../tests/installation-observations.test.ts). | Historical provider checks cover deduplication, correspondence, and restore. The [Docker evaluation](evidence/docker-evaluation.md#executed-recovery-board-and-scheduler-checks) additionally delivered authenticated GitHub/Azure DevOps observations after restart, retained immutable Fact identities on repeated delivery, and left Factory state unchanged. |
| 19–21, 34, 36–39, 41, 58–62, 65, 67–68 | [Issue 05 resolution](issues/05-durable-private-review-report.md#resolution--2026-10-05), [durable Review Workflow design](designs/durable-private-review-report.md), and test sources [reviews](../../tests/reviews.test.ts), [repository tool](../../tests/repository-tool.test.ts), [review approvals](../../tests/review-approvals.test.ts), and [review acceptance driver](../../tests/review-acceptance.ts). | Historical checks are supplemented by the [Docker evaluation](evidence/docker-evaluation.md): real worker/sandbox tool execution, two private reports and human waits retained across Factory/database restart, isolated restore, encrypted configuration, and no AI replay. |
| 18, 21–24, 26–31, 34, 56–57 | [Issue 06 resolution](issues/06-current-consolidated-review-decisions.md#resolution--2026-10-05), and test sources [review decisions](../../tests/review-decisions.test.ts) and [review approvals](../../tests/review-approvals.test.ts). | The issue records 69 local checks plus built HTTP/browser/restart acceptance. Generated browser evidence is ignored; these results are historical local evidence. |
| 25, 32–34, 42, 46–47, 57 | [Issue 07 resolution](issues/07-confirmed-publication-and-reconciliation.md#resolution--2026-10-05), [publication design](designs/confirmed-publication-and-reconciliation.md), and test sources [publications](../../tests/publications.test.ts), [publication corrections](../../tests/publication-corrections.test.ts), and [Approval recovery](../../tests/publication-approval-recovery.test.ts). | The issue records provider-parameterized public-flow, restart, evidence-gathering, and no-blind-retry checks. These are controlled local provider-boundary results, not a production exactly-once guarantee. |
| 25, 32–33, 62–63, 68 | [Issue 08 resolution](issues/08-limited-report-artifact-sharing.md#resolution--2026-10-06), [sharing design](designs/limited-report-artifact-sharing.md), [implementation evidence](evidence/limited-report-artifact-sharing.md), and test sources [Artifact sharing](../../tests/artifact-sharing.test.ts), [sharing revalidation](../../tests/sharing-revalidation.test.ts), and [sharing acceptance driver](../../tests/sharing-acceptance.ts). | Historical sharing checks remain linked. The [Docker evaluation](evidence/docker-evaluation.md#executed-installation-checks) additionally verified private access, cross-Organization denial, credential revocation, and continued denial after isolated restore. |
| 36, 39, 43–45 | [Issue 09 resolution](issues/09-confirmed-workflow-run-cancellation.md#resolution--2026-10-06), [cancellation design](designs/confirmed-workflow-run-cancellation.md), [review/cancellation tests](../../tests/reviews.test.ts), and [publication/cancellation tests](../../tests/publications.test.ts). | Historical cancellation evidence is supplemented by [Docker Board cancellation](evidence/docker-evaluation.md#executed-recovery-board-and-scheduler-checks): competing transitions remain blocked until worker-confirmed stop releases ownership. |
| 13, 17–18, 34–35, 39 | [Issue 10 resolution](issues/10-separate-review-finalization.md#resolution--2026-10-06), [finalization design](designs/separate-review-finalization.md), and [public-flow finalization tests](../../tests/finalization.test.ts). | Historical finalization checks are supplemented by the [Docker Board exercise](evidence/docker-evaluation.md#executed-recovery-board-and-scheduler-checks): Review/publication completion leaves Factory state unchanged until a separately requested Review Finalization Workflow completes. |
| 64–66 | [Issue 11 resolution](issues/11-retained-versions-and-explicit-migration.md#resolution--2026-10-06), [migration design](designs/retained-versions-and-explicit-migration.md), and [migration tests](../../tests/type-migrations.test.ts). | Historical explicit-migration checks remain linked. The [Docker evaluation](evidence/docker-evaluation.md) retains Workflow Run, report, output, wait, and state-flow versions through restart and isolated restore. |
| 41–42, 50, 62, 65–68 | [Issue 12 current record](issues/12-persistent-shared-installation.md#prepared-deployment-acceptance-record), [Docker evaluation](evidence/docker-evaluation.md), [installation design](designs/persistent-shared-installation.md), [operations runbook](../../docs/operations/persistent-shared-installation.md), and sources [coordinator](../../tests/installation-coordinator.test.ts), [scheduler](../../tests/installation-schedule.test.ts), [Docker acceptance driver](../../tests/docker-evaluation-acceptance.ts), [drain](../../tests/installation-drain.test.ts), [maintenance](../../tests/installation-maintenance.test.ts), [provider observations](../../tests/installation-observations.test.ts), and [Board finalization](../../tests/finalization.test.ts). | The User selected Docker on this PC, acts as operator, and chose a backup volume and SMTP4Dev. Executed evidence covers separate processes, persistent stores, startup/restart, isolated restore/hold/activation, private/revoked Artifact access, retained Workflow Runs/definitions, jobs/alerts, ingestion, cancellation, uncertain publication, and Board finalization. The operator accepted a two-minute backup window and five-minute recovery-time objective; independent host-loss recovery remains required before real deployment. |

Several tickets intentionally claim overlapping stories because they validate
different parts of the same requirement. Issues 13–15 record AI-provider and
sandbox contracts but add no separate User Story IDs; see the [AI provider
research](research/mastra-ai-provider-contracts.md), [local sandbox research](research/mastra-local-sandbox-contracts.md), and [Docker sandbox research](research/mastra-docker-sandbox-contracts.md).

| Testing area from the accepted testing decisions | Source links verified in this checkout | Recorded evidence and remaining limit |
| --- | --- | --- |
| Public API as the primary seam; selected Kanban Board/UI scenarios | [general acceptance driver](../../tests/acceptance.ts), [Review Workflow acceptance](../../tests/review-acceptance.ts), [publication acceptance](../../tests/publication-acceptance.ts), [sharing acceptance](../../tests/sharing-acceptance.ts), plus Issues 03, 05, 07–12 above. | Public Docker/OIDC checks and Board cancellation/finalization are recorded in the [Docker evidence](evidence/docker-evaluation.md). Package checks for the evaluated application revision are recorded separately from historical ticket results. |
| GitHub/Azure DevOps event deduplication, correspondence, and Fact/state separation | [observations tests](../../tests/observations.test.ts), [installation observation tests](../../tests/installation-observations.test.ts), [Issue 04 evidence](evidence/provider-observation-ingestion.md). | The [Docker evaluation](evidence/docker-evaluation.md#executed-recovery-board-and-scheduler-checks) executed authenticated observations from both providers after restart and verified stable Work Item/Fact identities on repetition without a Factory State Transition. |
| Atomic current state/history, Transition Requests, and shared API/Board rules | [Factory tests](../../tests/factory.test.ts), [transition tests](../../tests/transitions.test.ts), [Work Item tests](../../tests/work-items.test.ts), [migration tests](../../tests/type-migrations.test.ts), [Issues 02–03 evidence](evidence/authorized-transition-requests.md). | Historical atomicity/concurrency checks remain linked. The [Docker evaluation](evidence/docker-evaluation.md) executes retained state/history and explicit Board transition rules across restart and recovery. |
| Organization isolation, Membership, scoped policy, Approval authority, and revoked permission | [auth](../../tests/auth.test.ts), [policies](../../tests/policies.test.ts), [credentials](../../tests/credentials.test.ts), [invitations](../../tests/invitations.test.ts), [review approvals](../../tests/review-approvals.test.ts), [Artifact sharing](../../tests/artifact-sharing.test.ts), and Issues 02–03/08. | Historical authority/policy checks remain linked. The [Docker evaluation](evidence/docker-evaluation.md#executed-installation-checks) verifies two-Organization isolation, private/revoked Artifact access, encrypted-secret restoration, and Membership-based OIDC access on the selected runtime. |
| Review outputs, consolidated human decisions, current inputs, and separate finalization | [reviews](../../tests/reviews.test.ts), [review decisions](../../tests/review-decisions.test.ts), [review approvals](../../tests/review-approvals.test.ts), [finalization](../../tests/finalization.test.ts), and Issues 05–06/10. | The [Docker evaluation](evidence/docker-evaluation.md) retains two reports/human waits through restart/restore, records explicit Decisions/publication, and executes a separately requested Board finalization. Historical currentness/Approval regressions remain in the linked sources. |
| Single-run ownership, concurrent requests, continued Facts, cancellation, and confirmed stop | [reviews](../../tests/reviews.test.ts), [transitions](../../tests/transitions.test.ts), [publications](../../tests/publications.test.ts), [finalization](../../tests/finalization.test.ts), [installation drain](../../tests/installation-drain.test.ts), and Issues 04–05/09/12. | The [Docker evaluation](evidence/docker-evaluation.md) rejects a second worker, continues provider Fact ingestion, blocks overlapping Board transitions, and confirms cancellation before ownership release. Issue 17 remains suspended and undiagnosed; guards remain enabled. |
| Process/database restart, human waits, completed effects, backup/restore, and retained definitions | [installation coordinator](../../tests/installation-coordinator.test.ts), [installation maintenance](../../tests/installation-maintenance.test.ts), [installation observations](../../tests/installation-observations.test.ts), [review tests](../../tests/reviews.test.ts), [publication tests](../../tests/publications.test.ts), [migration tests](../../tests/type-migrations.test.ts), and Issues 01/05/07/11/12. | The [Docker evaluation](evidence/docker-evaluation.md) executes Factory/database restart, isolated restore with explicit hold/dispositions/activation, retained reports/Workflow Runs/definitions, and provider evidence reconciliation without duplicate effects. Independent host-loss recovery remains a prerequisite before real deployment. |
| Uncertain provider outcome, evidence gathering, human resolution, and no blind replay | [publications](../../tests/publications.test.ts), [publication corrections](../../tests/publication-corrections.test.ts), [Approval recovery](../../tests/publication-approval-recovery.test.ts), and [Issue 07 resolution](issues/07-confirmed-publication-and-reconciliation.md#resolution--2026-10-05). | The [Docker evaluation](evidence/docker-evaluation.md#executed-recovery-board-and-scheduler-checks) durably records provider success followed by a lost response, restarts services, gathers positive provider evidence, rejects duplicate retry, and resolves completion explicitly. This controlled boundary does not establish production exactly-once effects. |
| Private Artifact access, revocation, AI configuration, model limits, and sandbox boundaries | [Artifact sharing](../../tests/artifact-sharing.test.ts), [sharing revalidation](../../tests/sharing-revalidation.test.ts), [secrets](../../tests/secrets.test.ts), [reviews](../../tests/reviews.test.ts), [Issue 05](issues/05-durable-private-review-report.md), [Issue 08](issues/08-limited-report-artifact-sharing.md), [Issue 13](issues/13-mastra-ai-provider-contracts.md), [Issue 14](issues/14-mastra-local-sandbox-contract.md), and [Issue 15](issues/15-mastra-docker-sandbox-contract.md). | Historical policy/budget tests remain linked. The [Docker evaluation](evidence/docker-evaluation.md) uses real restricted Docker sandboxes and tool/AI exchanges, isolated Organization configuration, private/revoked Artifact checks, and encrypted backup/restore. Production provider credentials remain outside evaluation scope. |
| Mastra storage adapter process/database restart and concurrency feasibility | [Issue 01 resolution](issues/01-validate-durable-workflow-storage.md#resolution--2026-10-02), [prototype runner](../../prototypes/durable-workflow-storage/README.md), and [executed report](../../prototypes/durable-workflow-storage/evidence/cd3afef2-c6dc-4043-9874-0b9583f0826f.json). | The bounded local evaluation is complete and selected LibSQL after recording candidate concurrency failure. It does not verify Factory authorization, publication recovery, or deployed storage operations. |
| Backup schedule, independent recovery, alerts, interruption, RPO/RTO, and deployed restore | [Issue 12 manual checklist and current record](issues/12-persistent-shared-installation.md#prepared-deployment-acceptance-record), [Docker runbook](../../docker/evaluation/README.md), [Docker evidence](evidence/docker-evaluation.md), [scheduler tests](../../tests/installation-schedule.test.ts), and [installation runbook](../../docs/operations/persistent-shared-installation.md). | Installed daily/monthly jobs succeeded; SMTP4Dev received failed/overdue and service/window alerts with retry/deduplication. The operator accepted the measured results with a two-minute backup window and five-minute recovery-time objective. Retention configuration is verified, not thirty elapsed days. Same-host volume/root-key recovery does not meet host-loss recovery prerequisites for real deployment. |

Issue 16's manual provider correspondence and Issue 18's broader recovery redesign
remain explicitly deferred. That deferral does not postpone current Workflow Run
durability, conservative interrupted-execution recovery, or Issue 12's mandatory
deployment checks. Issue 17's unresolved historical report is open and suspended,
not a current blocker; no diagnosis or correction is claimed.

## MVP closure checklist

The User confirmed these closure gates on 2026-10-07. The User-selected Docker evaluation is accepted on 2026-10-08. A list of commands or a passing local suite
does not substitute for executed installation work.

- [x] Record [Issue 17's current disposition](issues/17-diagnose-worker-ownership-recovery.md#user-directed-suspension--2026-10-07): open with `Status: needs-info` and `suspended` label, cause unknown, no correction claimed, and ownership protections retained. It is not a current blocker for this map.
- [x] Execute and record the installation and recovery work in
  [Issue 12's manual closure checklist](issues/12-persistent-shared-installation.md#manual-work-and-closure-evidence):
  deployment/supervision/volumes, selected recovery access and separate root-key material,
  actual backup/drill schedules and retention, delivered failure/overdue alerts,
  measured and agreed interruption/RTO, isolated restore, and existing-Run recovery.
  Those installation checks are prerequisites for both Issue 12 and this map;
  neither document requires the other to be closed first.
  The User-selected Docker evaluation has executed same-host recovery, installed
  jobs/alerts, retention configuration, and interrupted-execution checks. Its
  measured limits were accepted by the operator on 2026-10-08; independent
  host-loss retrieval and off-host root-key custody remain required before real
  deployment and are not claimed by this evaluation.
- [x] Prepare a requirement-to-evidence index for all 70 User Stories and the
  accepted testing areas, linking ticket metadata to existing designs, test sources,
  and recorded evidence while distinguishing local history from pending deployment.
- [x] Revalidate the index against the evaluated application revision and update
  stale summaries without discarding historical results. All 70 User Story IDs,
  local source links, and heading anchors were checked.
- [x] At final acceptance, confirm remaining operational agreements are resolved
  and no mandatory work is untracked.
- [x] Record applicable build, typecheck, test, formatting, and operational-check
  results for the accepted application revision, with environment, dates, responsible
  operator, evidence locations, and any accepted limitations. Controlled provider/AI
  boundaries remain the agreed repeatable test seam; do not claim provider exactly-once
  behavior or silently add live provider effects as a closure requirement.
- [x] Confirm the explicitly deferred scope stays visible:
  [Issue 16](issues/16-explicit-manual-provider-correspondence.md) for manual provider
  correspondence and [Issue 18](issues/18-redesign-durable-recovery.md) for the later
  recovery redesign. These follow-ups may remain open at MVP closure; they do not
  defer existing Run durability or Issue 12's deployment/recovery checks.
- [x] Append a dated final acceptance and evidence summary to Issue 12 and this map,
  then mark both closed. Preserve their delivered local evidence and reopening history.

## Out of Scope

- The broader durable-recovery redesign in Issue 18, including recovery of historical
  observations that never generated a Run. Current MVP durability and conservative
  interrupted-execution recovery remain required.

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
- This is an umbrella MVP specification. Its `ready-for-agent` status is the tracker role; `State: open` records the User-approved additional usability and real-provider acceptance gates. The Docker MVP evaluation remains accepted historical evidence. The implementation resolutions above own completed design and historical local behavioral evidence. Issue 12 owns manual deployment acceptance. Issue 17 retains an open, suspended diagnostic for the unreproduced ownership report and is not a current blocker; Issues 16 and 18 are explicitly deferred. Any implementation that depends on a remaining unresolved choice must first complete that design.
- The source's technical investigation was recorded on 2026-10-01. This synthesis does not refresh external documentation. The storage prototype selected LibSQL and validated the selected provider's pinned dependency set recorded in the linked storage-feasibility ticket.
- Publication to the local issue tracker consists of this specification. No external issue system, additional architecture document, or combined implementation-ticket file is needed.

## Comments

### Docker installation verification — 2026-10-07

The User-selected Docker evaluation runs on the current PC with persistent
Factory/dependency volumes, the User as operator, a dedicated recovery volume,
and SMTP4Dev. The [executed evidence](evidence/docker-evaluation.md) records
application revision `29ee73c`, public API/Board flows, two-Organization isolation,
private/revoked Artifact recovery, retained waits/definitions, restart and
ownership checks, isolated restore with explicit activation, actual installed
jobs/alerts, and uncertain-provider reconciliation without duplicate effects.

Fresh root verification passed 196 tests with zero failures/cancellations and
one expected Windows skip out of 197 tests. The skipped Unix socket case passed
separately in the final Linux Docker image. Build, typecheck, image build,
formatting, diff, local source/anchor, and 70-story index checks passed.
Issue 17 stays suspended and undiagnosed; Issues 16 and 18 stay deferred.

This map and Issue 12 remain open for operator agreement on the proposed
two-minute total backup window, unrestricted scheduling while the PC is running,
and five-minute evaluation recovery-time objective. Same-host recovery is the
chosen evaluation scope; independent host-loss retrieval and off-host root-key
custody remain prerequisites before real deployment. No production acceptance
or thirty elapsed days of retained backups is claimed.

### Docker evaluation accepted — 2026-10-08

The User accepted two minutes for complete backup and five minutes for recovery,
including the proposed unrestricted backup window while this PC is running. The
scheduler now uses `FACTORY_BACKUP_MAX_TOTAL_MS=120000`; a complete backup under
that setting succeeded in 6901 ms. The application remains at verified revision
`29ee73c`; this acceptance changes Compose configuration and documentation only.
The 196-pass full suite, separate Linux socket check, operational exercises, and
70-story index remain the linked application evidence.

Issue 12 and this map close for the selected same-host Docker evaluation. The
[Docker evidence](evidence/docker-evaluation.md) records the executed checks and
accepted limits. Independent host-loss recovery and off-host root-key custody
remain prerequisites before real deployment. Issue 17 remains suspended without
a claimed correction; Issues 16 and 18 remain explicitly deferred.

### MVP acceptance reopened for usability and real-provider walkthrough — 2026-10-08

The User approved two additional acceptance gates after the Docker evaluation:
[compact Kanban and Work Item detail](issues/19-compact-kanban-and-work-item-detail.md)
and [a guided real Azure DevOps Review](issues/20-guided-real-azure-devops-review.md).
This map is open until both are completed and the User accepts their results.
Issue 12 and its same-host Docker operational evidence remain accepted and closed;
the application changes require fresh checks. Issues 16 and 18 stay deferred and
Issue 17 stays suspended. The scope does not include production deployment,
identity merging, provider-side PR approval/merge, or the post-MVP model.

- [x] Complete Issue 19 and verify the final interface.
- [ ] Complete Issue 20 with the selected real User, Repository, pull request and AI.
- [ ] Record User acceptance of the new gates before closing this map again.
