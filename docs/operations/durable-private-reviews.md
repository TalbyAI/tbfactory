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
optional previous-Finding relationships. Review Decision and publication operations
belong to subsequent tickets. Generation never changes Factory state.

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
