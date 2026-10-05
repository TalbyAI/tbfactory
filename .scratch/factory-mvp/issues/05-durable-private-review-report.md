# Generate a private report in a durable Review Workflow

Status: ready-for-agent
Type: HITL
Labels: wayfinder:grilling
Assignee: Codex
State: closed
User stories covered: 19, 20, 21, 34, 36, 37, 38, 39, 41, 58, 59, 60, 61, 62, 65, 67, 68

## Parent

[TBFactory MVP specification](../spec.md)

## What to build

Start an authorized Review Workflow from a Transition Request, execute it in the separate Mastra worker using Organization-approved AI resources, persist a version-bound report Artifact with proposed Findings, and suspend for human review. Report generation does not change Factory state.

Human checkpoint: Agree and record supported AI providers/models, allowed Organization configuration, consumption accounting, time/call-count limit behavior, and the report/relevant-input contract before dependent implementation. Record scheduling, exclusive ownership, recovery, version retention, and private Artifact persistence/access contracts before implementing them.

The 2026-10-04 checkpoint continuation below expands the required design to repository exploration in a sandbox, optional subordinate agents, platform-provided or Organization-provided AI, separate agent-call and execution time budgets, and Fact-driven automatic starts. The earlier supplied-patch proposal is superseded. The User confirmed the [consolidated design](../designs/durable-private-review-report.md) on 2026-10-05; the human checkpoint is complete and implementation may proceed against that baseline.

## Acceptance criteria

- [x] Organizations can use platform-provided AI under a subscription or their own supported AI resources, with isolated access and permitted models. Enforce per-run agent-call time, call-count, and separate execution time limits; execution time excludes human and timer waits.
- [x] The Review Workflow obtains a revision-bound repository checkout in a sandbox with Git and exploration tools, without requiring a supplied diff. Agents can inspect differences and relevant unchanged files, using subordinate agents within the agreed access and resource bounds.
- [x] New Facts are evaluated against the agreed deterministic platform and Organization preconditions. Derived Facts can initiate an authorized Workflow Run without duplicate or overlapping starts; nondeterministic evaluation remains future work.
- [x] Pull request import starts a Review Intake Workflow. It preserves an incomplete Work Item, notifies the User by missing field name, and waits for concrete prerequisite Facts from the User or another process before emitting a review-start eligibility Fact.
- [x] Bind review exploration to immutable source and target commits, comparing source changes since their common ancestor. Later commit Facts remain admissible; subsequent reviews receive prior results to propose enriched, obsolete, or resolved Findings while retaining immutable history and renewed human review.
- [x] Transition Requests start at most one active Workflow Run per Work Item, including under concurrent requests or worker attempts. Different Work Items may execute concurrently.
- [x] Each run has an explicit Execution Identity; automatic starts use the Organization's Service Identity and all applicable Activity policies.
- [x] Retain exclusive ownership while running or waiting for human review. Direct User/API transitions are blocked, while authorized new Facts remain admissible.
- [x] Persist report version, declared relevant inputs, proposed Findings, and Artifact metadata in SurrealDB; store Artifact content on a persistent file volume with Factory-authorized private access.
- [x] After application/worker and database restarts, load the same suspended run with retained outputs and its original Workflow version, without repeating completed work.
- [x] UI/API distinguish Factory state, execution state, and the pending human review. Report generation or Review Workflow completion does not close or change the Work Item.
- [x] Provide runnable public-flow checks with a separate worker, real persistent stores, controllable AI evidence, concurrent requests, human-wait restarts, cross-Organization Artifact denial, AI limits, and a minimal private-report UI scenario.

## Blocked by

- [Issue 01: Validate durable Workflow storage within one working day](01-validate-durable-workflow-storage.md)
- [Issue 03: Execute authorized Transition Requests from the Kanban Board and API](03-authorized-transition-requests.md)
- [Establish Mastra AI provider configuration constraints](13-mastra-ai-provider-contracts.md)
- [Establish the Mastra local sandbox integration boundary](14-mastra-local-sandbox-contract.md)
- [Establish the Mastra Docker sandbox integration contract](15-mastra-docker-sandbox-contract.md)

## Comments

### 2026-10-04 — Provider ingestion runtime verification

Issue 04's [ingestion contract](../designs/provider-observation-ingestion.md) preserves
the future active/suspended ownership boundary using explicit fixtures. When real
Workflow Runs become available here, verify that authenticated GitHub and Azure
DevOps observations append Facts during running and suspended execution without
changing Factory state or releasing ownership. Repeat with worker recovery in Issue 12.

### 2026-10-04 — Human checkpoint proposal

Issues 01 and 03 are closed. Codex claimed this issue and prepared the
[durable private Review Workflow proposal](../designs/durable-private-review-report.md)
on `feature/durable-private-review-report`. It specifies the initial AI provider/model,
Organization configuration, consumption and limits, supplied-code/relevant-input
contract, execution authorization, single-worker scheduling, exclusive ownership,
conservative crash recovery, retained Workflow versions, private Artifact access,
and the already-confirmed public verification seam. User agreement is pending;
dependent implementation has not started and no acceptance criterion is claimed.

### 2026-10-04 — OpenRouter selected

The User proposed OpenRouter as the AI provider. The design now records OpenRouter
as the selected gateway, replacing the proposed direct OpenAI integration. The
initial `openai/gpt-4.1` model remains proposed; explicit routing, disabled fallbacks,
model/capability validation, Organization-owned OpenRouter keys, and reported
token/cost accounting are specified using official documentation and the public
catalog. This provider choice does not approve the remaining checkpoint contracts
or claim implementation/paid-provider evidence.

### 2026-10-04 — GPT-6 Luna selected

The User selected OpenAI GPT-6 Luna as the initial model through OpenRouter,
replacing the earlier GPT-4.1 proposal. The updated design uses request ID
`openai/gpt-6-luna` and retains the observed canonical mapping
`openai/gpt-6-luna-20260922`. The official public model/endpoint catalog was checked
on this date: the `openai` upstream declares `response_format` and
`structured_outputs` support. Provider and initial model selection are agreed;
remaining checkpoint contracts are still proposed. No paid generation or
implementation acceptance criterion is claimed.

### 2026-10-04 — Human checkpoint continuation: repository exploration and Fact-driven starts

The User supplied the following decisions through the live wayfinding interview:

- The Review Workflow obtains a repository checkout inside a sandbox with Git and tools for exploring branch differences and relevant unchanged files. A supplied diff is not a required input: it can exceed an agent's context. Agents may delegate exploration to subordinate agents to manage context. Exact revision selection, repository access, sandbox capabilities, and delegation bounds remain to be specified.
- Organizations may subscribe to platform-provided AI or use their own AI. OpenRouter and GPT-6 Luna remain the selected initial route; the additional resource modes and supported authentication mechanisms need explicit contracts. This does not silently authorize every provider, model, or endpoint.
- The AI time budget counts only agent calls within the Workflow. A separate maximum execution time excludes human waits and timer waits. Parallel-call accounting, tool-time accounting, call-count semantics, and enforcement remain to be specified.
- The proposed single worker with concurrency across Work Items and manual crash recovery is accepted.
- The proposed private summary, Findings with severity/explanation and optional location, Kanban Board display, and private Markdown download are accepted. Human review is still required for empty reports, and report generation does not change Factory state.
- Pull request events record Facts. Platform and Organization preconditions are evaluated when new Facts change a Work Item; evaluation may produce further Facts, some of which initiate Workflows. Initial evaluation is deterministic; nondeterministic evaluation is a future possibility. Rule ownership/configuration, causal deduplication, cascade bounds, authorization, and behavior during existing execution remain unresolved.

These decisions supersede the proposal's required `reviewPatch`, Organization-owned-key-only resource model, single generation deadline, one-response-only review assumption, and prohibition on webhook-driven starts. They do not approve the remainder of the earlier proposal. The [updated checkpoint record](../designs/durable-private-review-report.md#current-checkpoint-decisions) distinguishes these agreements from the remaining draft.

This issue remains open at its human checkpoint. No implementation acceptance criterion is claimed, and dependent tickets remain blocked until its implementation and verification are complete.

### 2026-10-04 — Human checkpoint round 2: tools, branch Facts, AI configuration, and budgets

The User resolved the next frontier:

- MVP agents have Git, file reading, and search only. Delegation is limited to subordinate agents declared in platform source code; no repository test execution or customer-declared executable tools are added.
- Pull request import must bring source and target branch names into the Work Item as Facts. Missing metadata is reported to the User by field name. The answer establishes required metadata; exact commit selection, comparison semantics, and incomplete-import behavior remain to be finalized rather than inferred.
- Organization-provided AI means a provider API key and the necessary configuration, explicitly including URL, model, reasoning effort, and related settings. An Organization can instead select the platform's AI provider. This is not an interactive assistant subscription; provider API compatibility is still an implementation decision.
- AI time is cumulative across model calls, including subordinate agents, excluding tools. Three concurrent ten-second model calls consume thirty AI seconds. Execution time is elapsed active time, including checkout, tools, and coordination, excluding human and timer waits; the same concurrent calls consume ten execution seconds. Parent and subordinate agents share run limits.
- Initial automatic-start rules are supplied by the platform and parameterized by Organization. Derived start Facts enter the same authorized Transition Request path under Service Identity. Finding confirmation remains human and distinct from automatic eligibility.

The [current checkpoint decisions](../designs/durable-private-review-report.md#current-checkpoint-decisions) now identify the narrowed frontier. No remaining contract is implicitly approved and no implementation criterion is claimed.

### 2026-10-04 — Human checkpoint round 3: Review Intake Workflow and successive reviews

The User clarified the next decisions:

- Preserve an incomplete Work Item. Required review fields must be represented by concrete Facts. Pull request import initiates a separate Review Intake Workflow, which notifies the User of missing fields and waits until Facts supplied by the User or another process satisfy its preconditions. Only then does it emit the Fact approving review initiation, which activates the Review Workflow.
- Fix source and target commits when review starts and compare source changes from their common ancestor. Later branch movements remain new Facts rather than mutating that checkout.
- Mastra determines supported AI provider integration constraints. Research must identify supported configuration mechanisms rather than impose an OpenAI-compatible-only restriction. The prerequisite is [Establish Mastra AI provider configuration constraints](13-mastra-ai-provider-contracts.md).
- New commits are recorded as Facts. Results of the current review remain available to the next review, allowing its agent to relate prior Findings and propose that they are obsolete, enriched, or resolved. No destructive update to historical reports or automatic transfer of human confirmation has been authorized.
- The initial platform rule catalog may support pull requests opened or updated, with Organization/Repository/target-branch/draft parameters. Rules start disabled until an Organization enables them. Required data, Git and AI access, and Service Identity authorization are prerequisites; derived Facts retain causal provenance to prevent duplicate/cyclic starts.

The term **Review Intake Workflow** is recorded in the canonical glossary. Its
review-start Fact establishes eligibility; it is not an Activity Approval and
cannot grant missing execution authority. The separate Workflow Run handoff,
notification surface, old-to-new Finding relationships, and treatment of updates
during human review remain to be resolved. This issue stays open.

### 2026-10-04 — Human checkpoint round 4: exclusive intake, notifications, and supersession

The User confirmed all four decisions in the next frontier:

- Review Intake Workflow is a normal exclusive Workflow Run while waiting for missing Facts. It completes with a durable handoff before Review Workflow acquires the Work Item's run ownership; Facts remain admissible throughout.
- Missing-field notifications are persistent in-app records visible in the Work Item and Kanban Board. Email delivery is not an MVP requirement.
- Each report retains its own immutable Findings. Subsequent reports create related proposed Findings assessing previous Findings as still applicable, enriched, obsolete, or resolved. A new report requires a new Review Decision; historical reports and decisions remain intact.
- New commits during a human-review wait do not automatically replace the existing run. The User explicitly supersedes the outdated review, preserving its report and closing its run without publication before a replacement can start. Ownership is released only after execution is confirmed stopped. This operation cannot publish or silently authorize a new run.

These agreements resolve the round 3 behavioral questions. Detailed handoff,
notification, Finding relation schemas, and supersession operations will be
specified against these contracts. The issue remains open for its remaining
technical checkpoint and subsequent implementation/verification.

### 2026-10-05 — Human checkpoint round 5: local sandbox, reusable credentials, and operational defaults

The User resolved the operational frontier:

- Validate the MVP against a local sandbox operated by the installation, with an isolated checkout per run and recreation from retained commit provenance after restart. Once the local MVP is demonstrated, support the other sandbox options available through Mastra. That expansion is a post-MVP direction, not a requirement to implement every backend before proving the local path.
- Configure repository read access per Repository, while allowing Repositories on the same provider to reference a shared Organization-owned Repository Access Credential. Credential reuse must respect provider/access scope and Organization isolation. Store secrets encrypted and use them only for controlled checkout preparation; agents do not receive them.
- Accept configurable defaults of 40 model calls, 600 cumulative AI seconds, 1,200 active execution seconds, and four simultaneous subordinate agents per Workflow Run. Parent and subordinate agents share budgets; stricter installation limits may reduce effective limits.
- Platform AI entitlement is activated/revoked operationally per Organization, with consumption records. Contracting and billing flows are outside this MVP increment.
- Manual review requests may enter Review Intake Workflow when Users or processes supply the same Repository, branch, and commit Facts. Apply the same prerequisites and authorization as imported pull requests.

These decisions are reflected in the [current design](../designs/durable-private-review-report.md).
The additional Mastra sandbox backend capability must be investigated before its
later adoption rather than promised as already implemented. The issue remains
open for the final design review and implementation verification.

### 2026-10-05 — Human checkpoint round 6: retained configuration and stopped execution

The User confirmed the first two decisions in this frontier:

- Retain provider, model, reasoning effort, and nonsecret configuration at run start; changes apply to new runs. Rotation of the same credential may be used on subsequent calls. Current permission, credential, and platform AI entitlement revocation prevents further dispatch. Never switch providers automatically.
- On limit exhaustion or an unknown AI outcome, stop visibly and preserve Facts, completed results, and consumption evidence. Do not expose an incomplete report as complete. An uncertain call remains counted and is not replayed automatically. Release ownership only after execution is confirmed stopped.

The separate decision whether the isolated local MVP worker may require Linux
and Bubblewrap has not been answered. It remains the User decision frontier;
neither Linux-only deployment nor Windows isolation is implicitly accepted.

### 2026-10-05 — Human checkpoint round 6 continued: Docker selected

The User selected Docker as the installation-local isolated sandbox for the MVP,
replacing the proposed Linux worker with LocalSandbox/Bubblewrap. This does not
authorize fallback to unisolated host commands or expose arbitrary command tools
to agents. Git, reading, and search remain platform-controlled capabilities.
The official integration and version boundary are being investigated in
[Establish the Mastra Docker sandbox integration contract](15-mastra-docker-sandbox-contract.md).

### 2026-10-05 — Consolidated design ready for final review

All product questions asked in this checkpoint are answered. Provider and sandbox
research prerequisites are closed with primary-source evidence. The
[consolidated design](../designs/durable-private-review-report.md) reflects Docker,
exclusive intake/handoff, required branch/commit Facts, immutable successive reports,
explicit User supersession, both AI resource modes, retained configuration,
revocation, and shared limits.

Final shared-understanding review remains before dependent implementation. The
Docker adapter's peer range is declared compatible, but no runtime sandbox or
production implementation is claimed. This issue remains open and
`ready-for-human`; implementation-dependent tickets remain blocked until its
acceptance criteria are implemented and verified.

### 2026-10-05 — Human checkpoint accepted

The User explicitly confirmed that the consolidated design reflects the agreed
understanding and authorized closing the design checkpoint. The design is the
accepted implementation baseline, including Docker sandbox, exclusive intake
and durable handoff, required Facts and fixed commit comparison, reusable scoped
Repository Access Credentials, supported Mastra AI configuration, shared budgets,
retained configuration and revocation, successive immutable reports, and explicit
User supersession.

Status is now `ready-for-agent`. The issue remains `State: open` because its
implementation and public-flow verification are not delivered. Research tickets
are closed, but runtime compatibility and sandbox recovery checks remain required.
No acceptance criterion is marked complete by this design confirmation.

### Resolution — 2026-10-05

Implemented the accepted baseline on `design/repository-review-workflow` with
retained `pull-request-review` version 3, exclusive Review Intake Workflow and
atomic Review Workflow handoff, deterministic Fact-driven starts under Service
Identity, required-field notifications, generation Approval, and immutable private
reports with proposed Findings. Versions 1 and 2 retain their existing definitions.
Report generation and human waits leave Factory state unchanged.

The separate Mastra worker uses pinned core/LibSQL/Docker and native AI SDK adapters.
It obtains fixed source/target checkouts, checks the common ancestor, permits
bounded Git/read/search and declared subordinate agents, and verifies Docker
isolation. Encrypted resource scopes, current authorization/entitlement rechecks,
retained configuration, shared call/time limits and known/unknown consumption
accounting are implemented. Private Artifact download rechecks current credentials
and permissions, and verifies content size/digest.

Database-wide worker ownership prevents execution from a second volume. Interrupted
calls require confirmed-stop recovery; uncertain calls remain counted and are not
replayed. Known completed parent/subordinate results are reused, including the
pre-staging crash window. Recovery preserves intake handoff, resets stale delegation
counts, finishes staged report attachment, and keeps ownership on missing/damaged
content or unavailable retained Workflow definitions. Partial volume locks are
recoverable from the durable original worker identity. Explicit supersession retains
immutable reports and permits a subsequent review with previous-Finding relationships.

Verification:

- `npm test`: 59 passing checks, including 14 review checks against real SurrealDB,
  LibSQL, private files, Docker and a separate worker with controllable provider HTTP.
- `npm run typecheck`, `npm run build` and `npm run format:check`: pass.
- `npm run acceptance`: all ten built-application authentication, provider ingestion,
  transition, restart and protected restoration scenarios pass.
- The built review acceptance flow preserves incomplete intake and the same human-wait
  report through web/worker/SurrealDB restarts; it makes two provider calls and does
  not repeat them after restart. Authenticated Markdown download succeeds.
- The collaborative browser confirms `Factory state: registered`, execution
  `waiting-review`, pending human Review Decision, proposed `unchanged.ts:1` Finding,
  summary and private Markdown download with HTTP 200.
- Independent Standards and Spec reviews have no outstanding material findings
  after recovery, ownership, current authorization and retained-resource corrections.

Runnable setup, resource/revocation commands, recovery procedures and evidence
locations are documented in [durable private reviews](../../../docs/operations/durable-private-reviews.md).
Test evidence remains in ignored `.runtime/` directories, including the production
review drill at `.runtime/review-e90a65c8-3e1f-4ade-ad8b-6fb5b15e5404/acceptance.json`
and the existing application drill at `.runtime/acceptance-1791198049291/results.json`.
The provider is controllable test infrastructure; no paid GPT-6 Luna execution is
claimed. Finding confirmation, publication and finalization remain subsequent issues.
The issue is closed; its implementation-dependent tickets may proceed.
