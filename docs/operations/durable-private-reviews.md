# Durable private reviews

The accepted [Issue 05 design](../../.scratch/factory-mvp/designs/durable-private-review-report.md)
uses SurrealDB for Factory records, Mastra with LibSQL for retained Workflow snapshots,
and a persistent private file volume for Artifact content. Run one worker per Factory
database. The database ownership record and local volume lock reject another worker,
including one configured with a different directory. Different Work Items can run
concurrently, with a maximum of four active executions.

## Installation

Install the pinned root dependencies with `npm ci`. Use the existing database and
[key-ring setup](key-ring-backup.md). The web and worker must use the same database,
installation identity, key ring and Artifact directory. Restrict these volumes to
application/operator access. Keep the Workflow directory on persistent local storage;
do not replace it when deploying a new application version.

Build the platform sandbox image and resolve its immutable digest:

```powershell
docker build -f docker/review-sandbox.Dockerfile -t tbfactory-review:local docker
docker image inspect tbfactory-review:local --format '{{.Id}}'
```

Set `FACTORY_SANDBOX_IMAGE` to that digest. The base image is pinned in the Dockerfile.
Set `FACTORY_WORKER_DIRECTORY` and `FACTORY_ARTIFACT_DIRECTORY` to protected persistent
directories. `FACTORY_WORKER_LIMITS` can reduce the effective Organization limits;
its defaults are 40 model calls, 600,000 cumulative AI milliseconds, 1,200,000 active
execution milliseconds and four simultaneous subordinate agents. Start the worker:

```powershell
node --env-file=.env --import tsx scripts/worker.ts
```

The worker requires a Docker daemon accessible to trusted installation code. Agents
receive only the platform Git, file-reading and search tools. Their container has
no host mounts, Docker socket, persistent credentials, outbound network during
exploration, executable repository hooks or arbitrary command tools. Docker settings
are verified before checkout: read-only root, dropped capabilities, no new privileges,
512 MiB memory/swap, one CPU, 64 processes and bounded no-exec temporary filesystems.
Checkout uses scoped credentials only during controlled fetch, fixes both commits,
and compares the source commit with its common ancestor with the target commit.

## Configure resources

Use protected JSON input files with the existing operator CLI. The endpoint host
must appear in `FACTORY_APPROVED_ENDPOINT_HOSTS`, use public HTTPS and resolve to
public addresses. HTTP loopback is allowed only with the explicit development opt-in.
Configuration commands never return API keys or repository read keys.

Example Organization AI configuration:

```json
{
  "organization": "alpha",
  "enabled": true,
  "mode": "organization",
  "entitled": false,
  "key": "replace-in-protected-input",
  "ai": {
    "adapter": "openrouter",
    "url": "https://openrouter.ai/api/v1",
    "model": "openai/gpt-6-luna",
    "upstream": "openai",
    "permittedModels": [{ "id": "openai/gpt-6-luna", "tools": true, "reasoning": [] }]
  },
  "limits": { "calls": 40, "aiMs": 600000, "executionMs": 1200000, "subordinateAgents": 4 },
  "rules": { "enabled": false, "repositories": ["alpha-repo"], "targetBranches": ["main"], "includeDrafts": false }
}
```

Supported adapters are `openrouter`, `openai-chat`, `openai-responses` and `anthropic`.
An operator must approve each model's tool and optional reasoning capabilities;
this declaration is configuration, not automatic catalog discovery. Anthropic
reasoning settings are rejected by this initial adapter. OpenRouter requests use
the explicit `openai` upstream and disable fallback. Live paid provider execution
is not part of the controllable acceptance fixture.

For platform resources, select `mode: "platform"`, supply the operationally managed
provider key and set `entitled: true`. Entitlement is checked again before each
dispatch. Set it to false to revoke platform use. Contracting and billing remain
outside this increment. Setting `enabled: false` stops further AI dispatch for
the Organization, including retained runs.

```powershell
node --env-file=.env --import tsx scripts/operator.ts review-configure review.json
node --env-file=.env --import tsx scripts/operator.ts repository-access access.json
```

Repository access input contains `organization`, `repository`, `provider`
(`github` or `azure-devops`), `credential`, `urls`, `enabled` and an optional `key`.
URLs must match the selected provider's repository URL contract. Repositories may
share a credential only within the same Organization and identical provider/URL
scope. Keys are encrypted through the Organization key ring. Disabling access or
changing its scope prevents further execution of a retained run.

AI provider, endpoint, model, reasoning and limits are retained at handoff; changed
configuration applies to new runs. Credentials are scoped by resource mode,
adapter and endpoint. Supplying a new key for the same scope rotates that resource
for subsequent calls; configuring a different endpoint retains the old resource's
key. To revoke an old resource explicitly, use `review-resource-revoke` with JSON
containing `organization` and the nonsecret `credential` returned by configuration.

Configuration returns a deterministic `serviceIdentity`. It receives no implicit
grants. Automatic starts require explicit Service Identity policy grants for
`transition.request-review`, `review.generate` and `repository.read`; prohibitions
and human requirements still apply. Browser/API requests retain their initiating
User and any bounded API credential. Generation requiring human intervention
waits for a distinct, run-bound human Approval under `approval.review-generate`.

## Public flow and private output

Select `pull-request-review` version 3 through the authorized Work Item Type
selection operation. Versions 1 and 2 retain their prior behavior. Request
`request-review` through the existing Transition Request endpoint. The same
operation appears on the Kanban Board and starts an exclusive Review Intake Workflow.

Record `sourceBranch`, `targetBranch`, `sourceCommit` and `targetCommit` as Facts
through `POST /api/organizations/{organization}/work-items/{item}/review-facts`:

```json
{
  "operationId": "review-inputs-1",
  "fields": {
    "sourceBranch": "feature",
    "targetBranch": "main",
    "sourceCommit": "1111111111111111111111111111111111111111",
    "targetCommit": "2222222222222222222222222222222222222222"
  }
}
```

Optional Facts include `sourceUrl` and `draft`; commit IDs must be immutable 40- or
64-character hexadecimal IDs. Imported pull requests enter intake even when
automatic review rules are disabled. Missing fields and operational prerequisites
remain persistent in-app notifications. Complete Facts, enabled resources, matching
rules for automatic execution and current policies gate the durable handoff.
The worker checks prerequisite changes before resuming an intake.

## Workflow Run cancellation

An authorized User can request cancellation through the board or
`POST /api/organizations/{organization}/work-items/{item}/workflow-cancellations`
with `{ "operationId": "cancel-1", "run": "workflow-run-id" }`. The operation
requires `workflow.cancel` and records an immutable
`workflow.cancellation-requested` Fact. Existing policy rules apply: a scoped API
Credential can act for its User unless policy requires human intervention; an
authenticated browser User satisfies that human-intervention requirement. No
separate Approval Point is added.

A request does not release Work Item ownership. The UI and
`GET .../work-items/{item}/reviews` show cancellation as `requested` while the
worker drains execution and confirms the sandbox stopped. A confirmed stop records
`workflow.cancellation-confirmed`, sets the Workflow Run to `cancelled` and releases
ownership. If execution cannot be confirmed stopped, the run stays exclusive in
`recovery-required`. Queued runs and suspended intake/review waits are cancelled
without resuming their Workflow snapshot. Reports, Artifact content, decisions,
Facts and completed Activities remain available.

Publication has a separate stop boundary. A persisted `dispatchAuthorized: false`
proves the current attempt did not send a POST, so the worker can confirm
cancellation. If dispatch is authorized or retained tracking is missing, the run
stays exclusive as `awaiting-publication-resolution`. The worker can gather
read-only provider evidence, but cancellation does not retry or infer that an
effect is absent. An authorized User must resolve the outcome; a confirmed existing
effect is retained as completed and records that cancellation did not apply.

If the worker process crashes, do not let a replacement worker confirm a pending
request automatically. Recover the old worker lock, keep workers stopped while
running `workflow-recover`, and verify stopped execution. Reserved model calls are
retained as uncertain and are not replayed. Recovery records the confirmed
cancellation and releases ownership only after the stopped-run recovery succeeds.
No Work Item Type currently defines automatic cancellation rules.

`GET .../work-items/{item}/reviews` returns safe run state, notifications, declared
inputs, report summaries, proposed Findings and per-call consumption. Private
Markdown is available at `GET .../work-items/{item}/reviews/{report}/artifact`
under current `work-item.read` and `artifact.read` authorization. Storage keys,
cached provider responses and credentials are never returned by these operations.
The worker verifies Finding locations against the bound checkout. The UI renders
literal text and distinguishes Factory state, execution state and pending human review.

Every completed report, including an empty report, suspends for human review and
retains ownership. New Facts remain admissible. Direct transitions and overlapping
runs are blocked. New source/target commits mark the report outdated; they do not
replace it. `POST .../review-supersession` accepts `operationId` and `run` under
`review.supersede`, preserves the stopped run's report and releases its human wait.
A replacement receives prior reports and creates new proposed Findings with
optional previous-Finding relationships. Generation never changes Factory state.

## Consolidated human decisions and revalidation

Version 3 declares `review.decide` as an Approval Point with the separate
`approval.review-decide` authority. Submit through the authenticated browser
session; API Credentials and Service Identities cannot supply human confirmation.
Current same-Organization Membership, scoped Approval authority, `work-item.read`
and `artifact.read` are required. The board form reaches the same API rules.

`POST .../work-items/{item}/review-decisions` accepts:

```json
{
  "operationId": "human-review-1",
  "run": "bound-review-run",
  "reportVersion": "bound-report-version",
  "reviewed": true,
  "findings": [
    { "finding": "first-finding-id", "decision": "confirmed" },
    { "finding": "second-finding-id", "decision": "rejected", "reason": "Intentional behavior" }
  ]
}
```

Supply exactly one decision for every Finding in that report version. Rejections
require a nonblank reason. Empty reports require `reviewed: true` and `findings: []`.
Incomplete, duplicate or foreign Finding submissions are rejected atomically.
Report versions, proposed Findings and Markdown content remain immutable. The
human submission creates a separate `review.decision` Fact. Corrections submit a
complete replacement with `replaces` identifying the latest decision Fact; the
new Fact also links it through `correctedFact`. Existing decision Facts remain intact.
The same `operationId` and content returns the retained submission receipt.

`GET .../reviews` includes private `decisions`, `reportStatus` and `runStatus`.
Decision `usable` and report `current` are evaluated against the current report
version and declared input Fact versions. The Workflow declares Repository,
Work Item Type version and all supplied review fields (including optional source
URL and draft flag) as relevant. A new Fact for one of those fields changes its
version even if its value is identical. Unrelated notes, CI evidence without
changed review fields and textual correction Facts do not invalidate a decision.
Retained AI configuration changes still apply to new runs as described above.

Generation Approval records its Activity, run, Execution Identity and relevant
input versions. New Approvals retain `bindingVersion: 2` in both the run and the
Approval Fact, binding the Activity, Organization and Work Item explicitly.
Approvals without a binding version use the original version 1 digest over the
run, Execution Identity, inputs and retained configuration. Both agent dispatch
and review completion validate the retained version after deployment without
rewriting the original Approval Fact. Unknown versions fail closed; version 2
never falls back to version 1.

Relevant input changes invalidate Approval use before Approval or dispatch;
model/tool dispatch also rechecks versions and current execution authorization.
Supersede the stopped `waiting-approval` run and request a replacement through the
existing Transition Request path. The board exposes both operations.

A submitted decision leaves the same run in `review-submitted`, retaining exclusive
ownership until the worker resumes its persisted human checkpoint. The worker
rechecks current relevant versions and execution authorization. Relevant changes
enter `waiting-revalidation`; explicit supersession and a new `request-review`
create a replacement report requiring renewed human confirmation. A permission or
credential revocation enters `waiting-authorization`; restoring execution permission
allows the same run to resume without repeating model calls. These report waits
remain recoverable across restarts and allow explicit supersession once execution
is stopped. A newer report also prevents reuse of an earlier report's decisions.

Successful continuation records `workflow.completed` and releases ownership while
leaving Factory state unchanged. The decision never grants publication authority;
publication and lifecycle finalization remain separate subsequent operations.
Rejected Findings and reasons stay within authorized Factory history and UI.

## Consumption and recovery

The worker reserves each actual model call transactionally before dispatch. Parent
and subordinate agents share call count and cumulative AI time; simultaneous calls
each contribute their elapsed time. Active execution time includes checkout, tools
and coordination, excluding durable human waits. Provider token usage and reported
cost are recorded when available; unavailable cost is `null`. Retries and fallback
are disabled. Limit exhaustion or unknown outcomes stop visibly, retain consumption
and never attach an incomplete report. Ownership is released only after confirming
that the sandbox and coordinated agent work have stopped.

Graceful shutdown closes LibSQL and releases both worker locks. After a crash, do
not delete locks manually or start a replacement on another volume. Confirm the
original worker process has stopped on the original host, then run:

```powershell
node --env-file=.env --import tsx scripts/operator.ts worker-recover-lock stopped-worker.json
node --env-file=.env --import tsx scripts/operator.ts workflow-recover stopped-run.json
```

The first input contains `confirmedPid`; it must match the database owner and any
complete volume lock and must no longer be alive. Database ownership is recorded
before lock creation, so a crash leaving a missing or partial lock remains recoverable
from the original host/directory/PID evidence. Missing ownership evidence fails closed.
The second input contains `run`. Keep workers
stopped during run recovery. Recovery verifies container identity and confirms
stopped execution. Reserved calls become counted `uncertain` calls and are not
automatically replayed. Their run stops and releases ownership after confirmation.
When all calls have known completed outcomes, recovery can reconstruct the retained
Workflow using its cached results without repeating those provider calls.

For a Workflow Run with a pending cancellation, stopped-run recovery records
`workflow.cancellation-confirmed` and sets the run to `cancelled` after verifying
the sandbox stopped. A cancelled run with uncertain model-call outcomes is not
replayed. Publication-owned runs use the provider evidence and User confirmation
flow in [confirmed publication](confirmed-publication.md); worker restart alone
does not resolve an authorized or untracked provider attempt.

Validated report output is staged durably before file publication. Recovery reuses
that output and deterministic Artifact content to finish interrupted attachment.
Attached reports require matching metadata, size and content digest. A missing or
damaged Artifact, absent suspended snapshot or unavailable retained Workflow version
enters `recovery-required` and keeps ownership. Restore verified content/snapshots
before recovery; do not substitute a new Workflow version. Take coordinated backups
of SurrealDB, the Workflow volume, Artifact volume and independent key-ring recovery
material. The broader recovery drills remain Issue 12's responsibility.

## Verification

Start the dedicated persistent database documented in
[authenticated Work Items](authenticated-work-items.md), build the sandbox image
above, then run from the repository root:

```powershell
npm run typecheck
npm test
npm run build
npm run acceptance
npm run acceptance:reviews
node --import tsx tests/review-acceptance.ts --hold
```

The `--hold` evidence includes `uiItems.cancellation`, a suspended report run for
the protected board drill. Open that Work Item in the authenticated browser, request
cancellation, and verify the panel shows `requested` before the worker confirms
`cancelled`. Its report and private Artifact remain available afterward.

The review fixture uses a separate real worker, Docker checkout/tools, real SurrealDB,
LibSQL/files and a controllable provider HTTP endpoint. The built application flow
restarts web, worker and database in both intake and human waits, verifies the same
report and no replay, and downloads Markdown through authenticated HTTP. It writes
nonsecret evidence to its ignored `.runtime/review-*/acceptance.json`. `--hold` leaves
the application and self-hosted test identity provider available for browser checks;
create an empty `stop` file in the reported directory to stop it gracefully after
inspection (Ctrl+C also works in an interactive terminal). Tests also cover concurrent starts, second-worker
rejection, current revocation, shared budgets, subordinate calls, immutable successive
reports, cross-Organization denial, interrupted output publication and integrity failure.
