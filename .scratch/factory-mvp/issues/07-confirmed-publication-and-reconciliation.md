# Publish confirmed Findings and reconcile uncertain outcomes

Status: ready-for-agent
State: closed
Assignee: Codex
Type: AFK
User stories covered: 25, 32, 33, 34, 42, 46, 47, 57

## Parent

[TBFactory MVP specification](../spec.md)

## What to build

Publish human-confirmed review output to the configured GitHub or Azure DevOps comments or report-content destination with separately checked execution authorization. Include durable external Activity tracking and authorized evidence-based recovery when a provider response is uncertain.

## Acceptance criteria

- [x] Record both providers' destinations, credential handling, publication contracts, effect tracking, reconciliation, and recovery coordination before dependent implementation.
- [x] Require a complete current Review Decision and separate execution authorization; publish only confirmed Findings and exclude rejected Findings and their reasons.
- [x] Enforce applicable human-intervention policies and recheck permissions and relevant inputs immediately before publication. Handle no confirmed Findings according to the agreed output policy.
- [x] Persist confirmed completed external Activities so process/database restart or deployment does not repeat publication.
- [x] If publication may have succeeded but local confirmation is absent, gather provider evidence, expose the unresolved result, retain run ownership, and prevent blind retries.
- [x] When provider idempotency is unavailable, require authorized User confirmation before resolving the uncertain Activity or authorizing a new attempt. Preserve recovery decisions and completed Activities in immutable history.
- [x] Competing recovery attempts cannot duplicate an external Activity or release ownership while execution remains unresolved.
- [x] Expose publication and recovery outcome in UI/API history. Review Workflow completion leaves Factory state unchanged; external Artifact references remain unavailable until explicit sharing is implemented.
- [x] Provide provider-parameterized public-flow checks with real persistence and recorded effects for success, failure, relevant-input changes, permission revocation, provider success followed by a lost response, User confirmation, competing recovery, and restarts. Do not claim production provider exactly-once guarantees.

## Blocked by

- [Issue 04: Ingest deduplicated pull request observations from both providers](04-provider-observation-ingestion.md)
- [Issue 06: Submit and revalidate a consolidated Review Decision](06-current-consolidated-review-decisions.md)

## Comments

### Resolution — 2026-10-05

Implemented the recorded
[publication contract](../designs/confirmed-publication-and-reconciliation.md)
and [operator guide](../../../docs/operations/confirmed-publication.md). GitHub
publishes one pull request comment; Azure DevOps creates one comment thread.
Provider source correspondence fixes the destination, independent encrypted write
credentials stay unavailable to agents, and provider repository identity is
checked before dispatch. Azure setup specifies both code and PR thread scopes.

Publication requires a complete current human Review Decision and independently
authorized `review.publish` execution. Applicable human policies additionally
require an Activity-bound `approval.review-publish` Approval. Relevant inputs,
decision, permissions, identity, credentials and destination are rechecked
immediately before POST. Only confirmed Findings are sent; private summaries,
rejected Findings/reasons and Artifact references remain internal. No confirmed
Findings produces a durable skipped Activity without provider requests.

Work Item Type version 4 declares the publication Approval Point. Versions 1–3
remain unchanged, and installed Review execution supports versions 3 and 4.
Organizations must select version 4 before creating/importing new Work Items that
will publish. Existing version 3 Work Items cannot publish; their explicit
migration remains Issue 11. This compatibility limitation preserves the accepted
retained-definition model rather than silently upgrading existing Work Items.

The completed Review Workflow reacquires exclusive Work Item ownership for the
publication Activity without changing Factory state or retained Mastra snapshots.
Dispatch reservation precedes HTTP effects; durable confirmed completion prevents
replay after restart. Failure, lost response or interrupted execution retains
ownership. Read-only reconciliation records provider evidence, and an authorized
User must confirm the latest evidence and stopped execution before completion,
termination or a separately authorized new attempt. Positive matches prohibit
retry. Immutable Facts retain attempts, evidence, effects and recovery decisions;
UI and API expose these outcomes while authenticated Artifacts remain private.

Independent Standards review reports no actionable findings. Spec review's
credential-scope and Approval Point findings were corrected and rechecked; its
retained-version concern was resolved against ADR 0007 as the documented
compatibility limitation above. There are no remaining actionable Spec findings.
Recorded local provider effects validate recovery behavior; they do not establish
production provider exactly-once guarantees.

Verification:

- `npm test`: 103 passing checks, including 21 publication checks with retained
  type compatibility and provider-parameterized real SurrealDB, LibSQL, Docker,
  separate workers and recorded HTTP effects. Coverage includes crash after
  provider success, explicit failure, relevant inputs, revocation immediately
  before POST, changed source/destination, empty output, separate human Approval,
  lost response, concurrent recovery, immutable attempts and persistent restart.
- `npm run typecheck`, `npm run build` and `npm run format:check`: pass.
- `npm run acceptance:publications`: built HTTP/OIDC flow passes with lost response,
  provider evidence, web/database/worker restart without replay, authorized User
  confirmation, unchanged Factory state and private authenticated Artifact access.
- The collaborative browser verifies version 4 selection/rendering, positive
  evidence prohibiting retry, required reason and stopped-attempt confirmation,
  completed provider effect, released ownership and immutable recovery reason.

Final built acceptance evidence is in ignored
`.runtime/review-6639f544-d6c9-4ce1-bdf9-4e1745bfd5a8/publication-acceptance.json`;
final browser evidence is in
`.runtime/review-b3a1f05f-03e0-4924-a308-c30fae264f56/publication-browser-checks.json`.
This issue is closed.

### Approved auto-grill corrections — 2026-10-05

The User approved the five decisions in the
[revised contract](../designs/confirmed-publication-and-reconciliation.md#user-approval--2026-10-05).
Version-4-only publication and explicit requests after review completion using the
same Workflow Run are now explicit product decisions. Version-3 migration remains
Issue 11 and requires a new review unless separate compatibility is approved;
[explicit correspondence for manual Work Items](16-explicit-manual-provider-correspondence.md)
is deferred. Corrections after safe nonpublication require a new decision-bound
Activity. Insufficient recovery evidence must retain the unresolved outcome, and
all positive evidence must survive partial failures and subsequent queries.
The original verification above describes the earlier implementation; follow-up
verification is recorded below.

### Approved publication corrections verification — 2026-10-05

Implemented the User-approved boundaries. Corrections after `skipped` or sufficient
`not-published` evidence preserve the previous Activity and create a new
decision-bound Activity only on an explicit publication request. Current report
checks, scoped authority, exclusive ownership and renewed applicable Approval
remain required. Existing Activity IDs and retained Mastra snapshots remain intact;
the worker follows the run's current Activity pointer without repeating review.

Recovery completion requires identified provider effects and retains every matching
ID, exposing possible duplication. Negative resolution and retry require complete
no-match evidence and explicit User confirmation; durable proof of no authorized
POST for the current attempt permits stopping even when credentials or provider
evidence are unavailable. Prior positive matches survive page failures, later
listings and attempts and prohibit negative resolution or retry. Existing attempts
without local dispatch tracking cannot infer that exception. UI commands carry
Activity/decision preconditions, and private correction eligibility requires Artifact access.

Independent code review found two recovery gaps: tracking reset for a new attempt
and missing-credential evidence persistence. Both were corrected with failing
regressions followed by passing checks. Final review has no actionable findings.

Verification:

- `npm test`: 120 passing checks, including 38 publication checks and 17 new
  regressions across both providers. Covers corrected decisions, concurrent requests,
  separate renewed Approval, stale Activity commands, preserved history, insufficient
  evidence, partial positive matches, multiple effects, unavailable credentials,
  per-attempt dispatch proof, private eligibility and restart without replay.
- `npm run typecheck`, `npm run build` and `npm run format:check`: pass.
- `npm run acceptance:publications`: built HTTP/OIDC flow passes through insufficient
  recovery rejection, confirmed nonpublication, correction, new Activity, lost
  response, web/database/worker restart, identified completion, unchanged Factory
  state and authenticated private Artifact access.
- Collaborative browser checks pass for unavailable evidence with no recovery or
  correction form, correction after safe nonpublication, completion-only recovery
  for an identified effect, required reason/stopped confirmation, preserved prior
  Activity and released ownership after confirmation.

Built acceptance evidence is in ignored
`.runtime/review-7848f5eb-9909-4a45-8761-f567d9edd461/publication-acceptance.json`.
Browser evidence is in ignored
`.runtime/review-d4b7ab5d-ead5-47ff-939a-afc174e0680f/publication-browser-checks.json`.
Recorded local provider effects do not establish production exactly-once guarantees.
Issue 11 migration and Issue 16 manual correspondence remain separate follow-ups.

### Approved Approval-wait recovery correction — 2026-10-05

The User approved resolving the P1 that stranded publication ownership when
Approval was rejected after relevant inputs changed or the requesting API
Credential was revoked. Publication reconciliation now accepts `waiting-approval`
under the recovering browser User's current `review.recover`, Work Item and
Artifact access. The UI offers the existing evidence-gathering action during that
wait. Recovery may also abandon a valid wait without first rejecting Approval.

The existing worker and confirmation path records durable evidence, retains
ownership until confirmed resolution, and permits `not-published` with local proof
of no authorized POST even when provider evidence is unavailable. Approval and
recovery claims compete atomically. Confirmation cannot bypass reconciliation,
stale evidence is rejected, and retained attempts without dispatch tracking do
not infer local proof. Historical Facts, positive effects, current retry authority
and input checks remain protected. Safe terminal recovery releases the Work Item
for a new Review Workflow without changing Factory state.

Verification:

- The new input-change regression first failed because competing recovery claims
  both returned 409 instead of allowing one authorized claim; it passes with the fix.
- `npm test`: all 128 checks pass, including eight new provider-parameterized
  Approval-wait recovery regressions. They cover stale inputs, revoked requester
  credentials, denied and nonhuman recovery, competing claims and confirmations,
  Approval races, stale commands/evidence, immutable history, process restart,
  retained attempts without local tracking, zero POSTs and a new Review Workflow.
- `npm run typecheck`, `npm run build` and `npm run format:check`: pass.
- Built HTTP/OIDC publication acceptance passes with a revoked requester waiting
  for Approval, unavailable provider evidence, evidence-backed nonpublication
  without a POST, corrected decisions, preserved prior Activities, lost response
  and web/database/worker restart. Local non-dispatch evidence remains unchanged
  after restart.
- Collaborative browser inspection verifies reconciliation during the wait,
  removal of Approval after the recovery claim, local proof with unavailable
  provider evidence, only the eligible `not-published` resolution, required reason
  and stopped confirmation, released ownership and the immutable recovery reason.

Final built acceptance evidence is in ignored
`.runtime/review-90878d76-332a-43ee-8882-766c2bb63129/publication-acceptance.json`.
Browser evidence is in ignored
`.runtime/review-1fc38f4f-7a22-45cf-9f7b-110ddd73e0dc/approval-recovery-browser.json`.
The P1 is resolved. Provider abstractions, general cancellation and migrations
remain outside this correction. Recorded effects do not establish production
exactly-once guarantees.
