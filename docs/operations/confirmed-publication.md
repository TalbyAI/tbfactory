# Confirmed publication and recovery

The [Issue 07 contract](../../.scratch/factory-mvp/designs/confirmed-publication-and-reconciliation.md)
defines the output, authorization and recovery boundaries. Publication uses the
installation's existing single worker, persistent SurrealDB, key ring and worker
lock. It reclaims the completed Review Workflow's Work Item ownership without
changing Factory state or changing retained Mastra snapshots.

## Configure a destination

Install an authenticated provider source first using
[provider observations](provider-observations.md). Its correspondence determines
the pull request; manual Work Items without correspondence cannot publish. Ingestion
creates or finds the corresponding Work Item and does not attach correspondence to
an existing manual Work Item. Explicit authorized binding is deferred.
Store a protected JSON file outside Git and run:

```powershell
node --env-file=.env --import tsx scripts/operator.ts publication-configure C:/protected/publication.json
```

GitHub example (replace the key with a narrowly scoped installation or fine-grained
token having Pull requests write access):

```json
{
  "organization": "alpha",
  "repository": "alpha-repo",
  "source": "github-code",
  "enabled": true,
  "credential": "github-publication",
  "endpoint": "https://api.github.com",
  "githubRepository": "example/code",
  "key": "REPLACE_WITH_WRITE_TOKEN"
}
```

Azure DevOps example (replace the key with a PAT restricted to the configured
organization with Code read/write (`vso.code_write`) and PR Threads read/write
(`vso.threads_full`) access, as specified by the
[thread creation API](https://learn.microsoft.com/en-us/rest/api/azure/devops/git/pull-request-threads/create?view=azure-devops-rest-7.1)):

```json
{
  "organization": "alpha",
  "repository": "alpha-repo",
  "source": "azure-code",
  "enabled": true,
  "credential": "azure-publication",
  "endpoint": "https://dev.azure.com",
  "key": "REPLACE_WITH_WRITE_PAT"
}
```

Azure provider organization/project/repository come from the source's immutable
binding. GitHub also verifies the configured owner/name's current numeric identity
before posting. An imported correspondence cannot be redirected by an appended
external reference. Configuration and every dispatch check Factory ownership.

Keys use an independent encrypted `publication:<credential>` purpose. Omit `key`
when retaining the current key; changing only the key rotates it without changing
the destination version. Set `enabled: false` to revoke dispatch. Rebinding a
destination requires a new credential identifier. A queued Activity retains its
destination version and fails closed when configuration changes. Do not use
`secret-put` as a destination configuration interface. Add `api.github.com` or
`dev.azure.com` to `FACTORY_APPROVED_ENDPOINT_HOSTS` when overriding its defaults.

## Publication authorization

Select `pull-request-review` version 4 for new Work Items through the Work Item
Type UI or `POST /api/organizations/{organization}/work-item-types` with
`operationId`, `type: "pull-request-review"`, `version: 4`, `enabled: true` before
importing the pull request. Version 4 declares the publication Approval Point and
retains version 3's installed Review Workflow and state behavior. Existing Work
Items keep their version; selection does not migrate them. Versions 1–3 cannot
publish. Explicit migration remains the separate Issue 11 increment.
The User approved this temporary limitation. Migration changes relevant inputs:
require a new review and human confirmation unless a separate compatibility
contract is explicitly approved. Do not rewrite old reports or decisions.

The User first submits a complete current Review Decision and waits for the Review
Workflow to complete. Then request publication independently. The UI labels this
action **Request publication of confirmed Findings**. Execution needs
`review.publish`, independent of `approval.review-decide`; all existing scoped
denials and human policies apply. When human intervention is required, the run
waits for a separate `approval.review-publish` Approval. API Credentials may request
publication but cannot approve or confirm recovery. Approval never grants missing
execution access. The worker rechecks the Execution Identity, credential, relevant
inputs, Review Decision, destination and Approval immediately before the POST,
after provider repository identity verification.

Work Item API endpoints, relative to
`/api/organizations/{organization}/work-items/{item}`:

| Endpoint | POST fields in addition to `operationId` and `run` |
| --- | --- |
| `review-publications` | None; request one Activity for the retained report/decision. |
| `publication-approval` | None; human Activity-bound Approval. |
| `publication-reconciliation` | None; queue read-only provider evidence collection. |
| `publication-confirmation` | Latest `evidence` Fact ID, `resolution`, explanatory `reason`, `confirmedStopped: true`. |

For Approval and recovery, include `publication` with the current Activity ID to
reject stale commands from an older Activity. Publication requests may include
`decision` with the expected current Review Decision ID. Existing clients may omit
these preconditions, but all commands still obey current authorization and ownership.

`GET reviews` returns current publication status plus immutable publication
history. `GET facts` also retains request, dispatch, failure, evidence, recovery and
completion Facts. The UI exposes the same outcomes. No Findings means a recorded
`skipped` Activity and no provider calls. Otherwise, a single consolidated comment
contains only confirmed Finding title, severity, explanation and location. The
private summary, rejected Findings, rejection reasons and Artifact links are omitted.
The existing authenticated private Artifact download remains private.

After a `skipped` Activity or evidence-backed `not-published`, an authorized User
may correct a still-current report's Review Decision when the Work Item has no
active run. The previous decision, Activity and Facts remain unchanged. Requesting
publication again creates a new decision-bound Activity and requires current
execution access and renewed applicable Approval; correction alone never publishes.
Repeating a request for the same decision returns the existing Activity. Completed
publication and unresolved execution prevent correction. Changing already published
comments or threads is outside this increment.

## Resolve uncertainty

An uncertain or failed Activity retains ownership. Never repeat its POST manually
or remove its database record. Gather provider evidence in the UI or API, then
inspect the actual destination. Evidence matches exact content and an
Activity/attempt marker. Listing failure or no matches does not prove absence.
Neither GitHub nor Azure creation is treated as idempotent.

An authorized browser User with `review.recover` confirms the latest evidence and
records a reason. Resolutions:

- `completed`: requires an identified effect corroborated by the provider; confirm
  it already exists, record completion and release ownership. All matching IDs are
  retained. Multiple matches are visible as possible duplication and prohibit retry.
- `not-published`: confirm the stopped attempt did not publish and end the Activity.
  Requires complete evidence without positive matches, or durable local proof that
  the Factory never authorized a POST for the current attempt. Previous attempts
  require complete evidence and User confirmation before authorizing retry, and
  prior positive matches still prohibit stopping as not published. Older attempts without local tracking
  cannot claim that exception. Positive provider matches prohibit this resolution.
- `retry`: explicitly authorize another attempt after verifying the previous attempt
  stopped and complete provider evidence has no matching effects. This additionally requires current
  `review.publish`, current relevant inputs and renewed applicable Approval.

Incomplete or unavailable evidence otherwise keeps the outcome unresolved and
retains ownership. A partial positive match survives a later page failure, an
unavailable or empty subsequent listing and later attempts. Complete listings without
matches still need human confirmation and do not establish a provider absence guarantee.
There is no manual override for insufficient evidence.

The system rejects recovery while dispatch/reconciliation is in progress, stale
evidence, and competing claims. It never turns matching evidence into automatic
publication or automatic ownership release. Recovery Facts and prior attempt
reservations remain immutable. Wrong User conclusions can still duplicate a
provider effect; no production exactly-once guarantee is claimed.

For a crashed worker, independently confirm its original process stopped and use
the existing `worker-recover-lock` procedure before starting a replacement worker.
The replacement marks interrupted provider operations uncertain without replay.
`workflow-recover` is not the publication recovery interface and cannot release a
publication-owned Work Item. Restore SurrealDB, the key ring, worker files and
private Artifacts consistently using the existing installation recovery procedure.

Verification uses `tests/publications.test.ts` and `tests/publication-corrections.test.ts` with real review generation,
SurrealDB, LibSQL, Docker, separate workers and recorded local provider effects.
`npm run acceptance:publications` exercises the built application with OIDC, rejected
insufficient recovery, evidence-backed nonpublication, correction, a new Activity,
lost response and web/database/worker restart while retaining both Activities.
For browser inspection, run it with `-- --hold-insufficient --hold-correction --hold`;
each checkpoint prints its state and waits for a line on stdin before continuing
or closing the final browser session.
Production provider credentials and live customer pull requests are not test inputs.
