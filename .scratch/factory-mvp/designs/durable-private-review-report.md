# Durable private Review Workflow

Status: proposed; pending User agreement at the human checkpoint in
[Issue 05](../issues/05-durable-private-review-report.md).

This proposal preserves the accepted foundations, canonical glossary, and ADRs
0003–0005, 0007–0010. It specifies the dependent implementation; it does not record
approval or claim executed runtime evidence.

## Approach and alternatives

Recommended: install platform-owned `pull-request-review` Workflow version 1 in a
separate Mastra worker. Retain SurrealDB for authoritative Factory records, the
Issue 01-selected LibSQL file for Mastra snapshots, and a persistent private file
volume for Artifacts. Start with OpenAI and an explicit code patch supplied by the
requester; provider observations supply source versions, not code content.

A multi-provider implementation would require additional credential, response,
accounting, and failure contracts before it improves this bounded increment. Fetching
code automatically from GitHub/Azure DevOps would additionally require outbound
provider credentials, permission checks, and version-consistent retrieval, none of
which Issue 04's inbound webhooks provide. Those are alternatives to approve
explicitly rather than silently adding them here.

## Organization AI configuration and consumption

The initial production provider is OpenAI Chat Completions, using the exact model
`gpt-4.1-2025-04-14`. No moving model aliases, arbitrary endpoints, customer tools,
custom executable prompts, or fallback provider are accepted. The platform keeps
the endpoint and report prompt/schema version in trusted code.

An Organization operator configures its AI resources through
`PUT /api/organizations/{organization}/ai-configuration`, requiring the new
Organization-scoped `ai.manage` Activity, current Membership, applicable policies,
and API Credential bounds where relevant. A minimal protected board-adjacent form
uses the same operation. Strict inputs include an operation ID, enabled flag,
permitted models, selected model, optional replacement API key, `maximumCalls`
(1–10), and `maximumSeconds` (1–3600). The first enabled configuration requires a
key; omission later preserves it. The selected model must belong to both the
platform catalog and the Organization allowlist. Installation operators can also
bootstrap configuration with `npm run operator -- ai-put <protected-json-file>`.

Store the key through the existing OrganizationSecrets and key ring in the same
transaction as the configuration revision and audit. Record the authenticated
operator and Organization scope; never put a plaintext key in audit, receipts,
responses, or logs. Operation receipts bind a digest of the submitted secret, with
only sanitized configuration in their result. `GET` on this route requires
`ai.manage` and returns nonsecret settings and credential-present status. Public
run reads expose nonsecret revision and limit values. There is no key-read route or
global credential fallback. Cross-Organization configuration access is denied.

Bind each run to its starting nonsecret configuration revision. Immediately before
each AI dispatch, recheck current enabled status, current model permissions, and
execution authorization. Resolve the current Organization key at dispatch; key
rotation does not change retained outputs. Configuration removal or a prohibition
stops further dispatch. Limit increases apply only to new runs; reductions apply
to existing runs too. The effective call budget is the smaller starting/current
maximum, and the effective deadline is the earlier starting deadline or first
generation claim time plus the current maximum seconds.

Persist a call reservation before network dispatch. Every reserved attempt consumes
one call, including rejected responses, invalid JSON, refusal, timeout, and uncertain
outcome. Disable hidden SDK retries. Version 1 makes one generation call and may
retry an explicitly received HTTP 429 or 5xx response, within both budgets; no
retry follows a timeout, lost connection, or ambiguous process interruption.

The time budget starts on the first permitted generation claim, after any required
Activity Approval, and ends on report suspension or confirmed failure. Queue time
and human waits do not count. The generation deadline persists across restarts.
A dispatch uses the remaining time
as its abort deadline; exhausted budgets prevent a call, and expiration aborts a
pending call. Do not accept a late response or expose a partial report as complete.

Record attempt ordinal, configured and returned model, provider response/request
ID when available, start/end times, outcome, and provider-reported input/output/total
tokens. Missing usage is explicitly unknown, never zero. Aggregate known tokens
and separately count unknown attempts; this is consumption evidence, not monetary
billing. Persist observable `call-limit`, `time-limit`, `model-denied`, `ai-refused`,
`invalid-report`, or `outcome-unknown` reasons. Abort does not prove the provider
stopped processing or charging for a request.

The [OpenAI model catalog](https://developers.openai.com/api/docs/models/gpt-4.1)
documents this snapshot and structured output support. The
[Chat Completions reference](https://developers.openai.com/api/reference/resources/chat/subresources/completions/methods/create)
documents the response and token usage fields. Checked on 2026-10-04; these are
provider capabilities, not Factory implementation evidence.

## Request, code input, and relevant inputs

Enable only version 2's existing `request-review` transition. Preserve version 1's
Work Item Type and leave `finalize-review` unavailable. A request keeps its existing
operation ID, expected state, retained state-flow version, and `reviewBrief`, and
adds a required `reviewPatch` (nonempty unified diff, at most 256 KiB UTF-8) and an
optional `sourceObservationFact` ID. The board collects the same inputs. Explain
that this increment reviews supplied code; it does not retrieve a repository.

For a Work Item with provider correspondence, require an authenticated
`external.observation` Fact for that resource, with its head/base commit versions.
It must be the latest recorded observation for that correspondence at acceptance.
For a manual Work Item, the source binding is absent and the patch is explicitly
requester-supplied. Provider-backed patches are also requester-supplied: commit
binding records the requester's declared association, not independently verified
code provenance. Do not describe them as fetched or verified provider code.

Declare relevant inputs as the immutable request ID, normalized review brief,
patch digest and original patch, Work Item Type/version, and, when present,
provider resource/head/base versions and observation Fact ID. Use a canonical
digest for the binding. Do not include every Fact or unrelated note in the binding.
For equal recorded timestamps, use a deterministic Fact-ID tie break, consistent
with later current-input checks. A correction of the bound source Fact or a newer
observation with different head/base versions makes source inputs stale; a same
version observation or unrelated Fact does not. The bound observation Fact ID is
retained provenance; freshness compares resource/head/base versions rather than
replacing that ID with each new same-version observation. Expose this separately from report
generation success. Issue 06 owns Review Decision revalidation against this contract.

The worker rechecks the source binding before dispatch. If it changed while queued,
stop with `inputs-stale` without calling AI. Changes during generation or suspension
remain admissible Facts and mark the produced report stale, preserving its original
binding and ownership. A new run requires the previous run's confirmed release;
Issue 09 owns User cancellation, and Issue 06 owns the renewed review/rerun path.

## Execution Identity and Activity authorization

User/browser/API starts retain the original User as Execution Identity; retain API
Credential identity, bounds, and current Membership where applicable. A worker
uses persisted identity information and current policies, not a cached grant or
the server operator's authority. Browser session expiry alone does not cancel an
accepted durable run; Membership and execution policy still apply. API Credential
revocation or expiry prevents its further Activities.

Support an Organization-specific Service Identity as a distinct policy principal,
with Organization-owned Team associations. It is not a login User or an API
Credential. Add service-principal policy/Team administration through the existing
authorized Organization management boundary, rejecting cross-Organization links.
Automatic starts can only originate from an authenticated operator automation
command, `review-start`, which selects the Organization's persisted Service Identity;
there is no client-selectable execution principal or automatic webhook start.

Evaluate every applicable Organization, Project, Repository, Team, and identity
scope. Default deny, explicit deny precedence, and human requirements apply equally
to Service Identities. Keep `transition.request-review` for start authority and add
`review.generate` for AI generation, `workflow.read` for run inspection, and
`artifact.read` for private content. Starting a run never grants generation authority.

Preserve the existing `approval.request-review` human Approval for a start requiring
intervention. If `review.generate` requires human intervention, persist
`waiting-for-approval` ownership and expose a browser-only `approval.review-generate`
operation bound to run, Activity, identity, Workflow version, and relevant inputs.
Approval does not grant execution permission. Recheck authorization immediately
before generation; policy changes introducing a human requirement require Approval.
This Activity Approval is separate from the report's later human Review Decision.

## Scheduling, exclusive ownership, and stopping

In one SurrealDB transaction, validate request and permission, create the run and
requested Fact, install `work_item.activeRun`, update the Transition Request, and
persist the operation receipt. Concurrent requests retry against current ownership;
only one wins, including requests with different operation IDs. Keep Factory state
and transition sequence unchanged; no `state.transition` Fact is emitted.

Persist execution states `queued`, `running`, `waiting-for-approval`,
`waiting-for-review`, `recovery-required`, `failed`, and `completed`. The request
response reports accepted request and started run separately from any completed
State Transition. `activeRun` contains the run identity and execution state, updated
atomically with authoritative run records. Direct transitions check that association.
Facts, notes, and authenticated provider observations remain available throughout.

For the initial shared installation, support one worker process with bounded
concurrency across different Work Items, default 4. It polls durable queued runs;
no HTTP process executes AI or Mastra. Serialize worker startup with an exclusive
file created on the worker volume, recording instance ID, host, and PID. A second
worker attempt refuses startup. This file has no TTL-based automatic takeover:
lease expiry is not evidence that an old worker stopped.

Clean shutdown stops claims, aborts pending calls, drains local work, then removes
its own startup lock. A crash leaves the lock in place. A recovery operator must
stop and verify the old process/container before `worker-recover` removes a lock
and reconciles runs; the command records that confirmation in audit history.
This conservative manual crash-recovery path is an explicit deployment constraint;
automatic multi-host failover is not supported in this increment.

Transactional per-run claims additionally reject concurrent attempts within the
worker. An ownership token guards every domain write and Artifact attachment.
Neither stale heartbeat nor elapsed AI deadline alone releases ownership. A known
error with no pending local Activity can atomically mark failure and release the
association. Timeout abort and uncertain outcomes retain `recovery-required`
ownership until the worker confirms no local Activity continues or the recovery
operator confirms the previous worker stopped. Unknown AI outcomes remain counted
and are never automatically dispatched again. Facts and completed outputs survive.

## Durable checkpoints and retained versions

Use the selected pins `@mastra/core` 1.74.0 and `@mastra/libsql` 1.25.0 as production
dependencies, independent of the prototype. Retain the existing production Zod
version unless a compatibility check requires an explicit pinned update. Configure
an absolute persistent LibSQL file and a distinct Artifact directory, outside
static web assets. Missing settings/storage fail startup visibly.

The version 1 Mastra Workflow has generation, report persistence, and a human wait.
Persist validated AI output and attempt completion in SurrealDB before the
generation step returns. Replay consults that durable completion and never repeats
a completed AI attempt, even if the later Mastra snapshot was not committed.
Persist deterministic run, step, report, and Artifact IDs. External I/O stays outside
retryable Factory transactions; their retries cannot repeat an AI call or file write.

Reconcile SurrealDB output records, Mastra public run state, and file digests after
startup. Queued runs continue; completed generation outputs can finish deterministic
report persistence without another call. A reserved call without a persisted outcome
is uncertain and stops for recovery. Reload suspended runs by their original run ID
and Workflow version, preserving Findings, inputs, and pending human review.
Recovery recreates a missing human-wait snapshot from retained outputs if needed.

Keep Workflow version 1 code and schemas deployed when adding a later version.
Unknown retained versions expose `recovery-required` and hold ownership; never
reinterpret them using the latest code. Issue 11 owns generalized explicit migration.
Issue 06 will resume the same suspended run through its Review Decision operation;
this issue exposes no temporary completion or publication endpoint.

## Report and private Artifact contract

Validate structured AI output: nonempty summary (at most 10,000 characters) and
0–100 proposed Findings. Each Finding has severity (`info`, `warning`, `error`),
title (at most 300 characters), explanation (at most 10,000 characters), and an
optional patch file/positive line location. Validate locations against supplied
diff paths and changed-line ranges. The Factory assigns stable Finding IDs; AI
does not assign trusted IDs, decisions, permissions, or publication status.

Store immutable report version, Workflow version, declared input binding, summary,
proposed Findings, creation time, and Artifact metadata in SurrealDB. Version 1
creates one report version per run. Atomically append a `review.report-generated`
Fact with report/Artifact references and set the run to pending human review after
the persistent content is ready. Empty Findings still require human review.

Render plain Markdown deterministically from validated fields, escaping provider
text for that format. Write a private immutable file using the existing durable
atomic-write primitive; persist digest, byte length, media type, run/report linkage,
and opaque storage key. Metadata is only committed after durable file creation.
An interruption may leave an unreferenced file; recovery can verify/reuse it.
Never expose metadata referencing incomplete content. Retain files/reports for the
run history without automatic deletion in this increment. Coordinate backup of
SurrealDB, LibSQL, the Artifact volume, and the existing encryption key ring.

Under `/api/organizations/{organization}/work-items/{item}`, add `GET workflows`
and `GET workflows/{run}` for execution/input/consumption/report metadata, and
`GET reports/{report}` for proposed Findings and the relevant-input binding.
Use `workflow.read` and `work-item.read` for run/report reads. Add
`GET /api/organizations/{organization}/artifacts/{artifact}/content`, requiring
current same-Organization Membership, parent Work Item visibility, and
`artifact.read`; enforce API Credential bounds too. Wrong Organization is 404,
missing Activity authority is 403. Never return filesystem paths or provider keys.

Content responses use `Cache-Control: private, no-store`, an explicit text media
type, `nosniff`, and attachment disposition. Construct paths only from validated
server-owned keys under the private directory; verify content digest and fail
visibly for missing/corrupt files. No static serving or sharing tokens are added;
Issue 08 owns limited sharing.

The board keeps the Factory state column unchanged and displays execution state,
pending generation Approval or human review, report version, source staleness,
summary/proposed Findings, and an authorized download control. Render text safely
without interpreting report HTML. No confirmed Finding, publication, or lifecycle
completion is implied by generated output.

## Verification and delivery

Reuse the User-confirmed primary seam in the parent specification: public Factory
HTTP operations with real persistent SurrealDB, a separate worker process,
persistent LibSQL/Artifact volumes, and controllable external AI evidence. Keep a
test-only loopback provider available only under explicit acceptance configuration;
production configuration cannot choose it. Record requests, delays, responses,
refusals, malformed output, retryable errors, and ambiguous disconnects at this seam.

Implement vertical red/green slices for concurrent starts and direct-transition
blocking; explicit User/API/Service Identities and all applicable Team policies;
Organization operator AI configuration and isolated credentials; generation Approval
and revoked authority; report/input persistence and no state
change; empty reports and strict validation; model/time/call limits and consumption;
private Artifact authorization including cross-Organization denial; and retained
human waits across web/worker/SurrealDB restarts. Verify different Work Items can
execute concurrently and competing worker startup refuses overlap.

Include worker crash recovery after completed AI output, before a snapshot, during
an uncertain call, and during file/metadata persistence. Verify provider effect logs
show no replay of completed or uncertain calls. Exercise authenticated GitHub and
Azure DevOps observations during running and suspended execution, preserving
Factory state and ownership while marking only relevant changed inputs stale.
Use one minimal real-browser scenario for request inputs, pending human review,
safe report display, and authorized private download.

Run typecheck and focused test files throughout implementation, then the full test
suite, production build, public-flow acceptance checks, formatting, and both axes
of code-review before committing. Keep Issue 05 open until implementation and
verification satisfy its criteria. Proposed contracts and a reviewed design alone
do not complete the issue.
