# Provider observation ingestion

The [Issue 04 contract](../../.scratch/factory-mvp/designs/provider-observation-ingestion.md)
defines identifiers, ownership, normalization and deduplication. Operator-installed
sources accept provider evidence; they do not authorize execution or change Factory
state. Existing Work Item history and the Kanban Board expose the resulting Facts.

## Install and rotate a source

Configure the persistent database and existing key ring first. Create a protected
JSON file with the following GitHub shape, replacing the example secret with a
new random base64url value of at least 32 characters (32 random bytes recommended):

```json
{
  "organization": "alpha",
  "project": "alpha-project",
  "repository": "alpha-repo",
  "source": "github-code",
  "type": "pull-request-review",
  "enabled": true,
  "secret": "REPLACE_WITH_A_RANDOM_BASE64URL_SECRET",
  "external": { "provider": "github", "repository": "12345" }
}
```

The external repository value is GitHub's immutable numeric repository ID as a
decimal string, not its name. The Factory Project and Repository must already
exist and belong to the specified Organization. Install from the repository root:

```powershell
node --env-file=.env --import tsx scripts/operator.ts source-put C:/protected/github-source.json
```

The result contains binding metadata and enabled state, with no secret or digest.
Each source needs its own credential; reuse across sources is rejected. Configuration
and encrypted credentials commit together and record an operator audit entry.
Keep the input file under deployment secret controls, outside Git. Source passwords
use base64url characters only and are 32–300 characters long.

Re-run with the same binding and a new secret to rotate. Re-run with `enabled: false`
to revoke ingestion. Existing bindings are immutable; use a new source ID to change
a provider mapping. New source IDs do not reset resource/event deduplication. The
same external resource cannot be remapped to another Factory Project/Repository
within one Organization and Work Item Type. `secret-put` is not the source rotation
interface; always use `source-put` to keep authentication metadata consistent.

## GitHub repository webhook

Configure a repository webhook with content type `application/json`, the configured
secret, and Pull requests events. Use this HTTPS payload URL:

```text
https://factory.example/api/organizations/alpha/sources/github-code/observations
```

Delivery validation uses `X-Hub-Signature-256` over the unmodified request bytes.
`X-GitHub-Delivery` is required for pull request deliveries; `X-GitHub-Event` is
`pull_request`. An authenticated `ping` returns `{acknowledged:true}` without Facts.
All valid pull_request actions record observations, including updates and closing;
none requests a Factory State Transition. Fork head repositories are allowed, while
the base repository must match the binding. Configure proxies to preserve body
bytes and provider headers.

## Azure DevOps service hooks

Use the same top-level shape with a separate secret/source and this external binding:

```json
{
  "provider": "azure-devops",
  "organization": "provider-organization-slug",
  "collection": "33333333-3333-4333-8333-333333333333",
  "project": "22222222-2222-4222-8222-222222222222",
  "repository": "11111111-1111-4111-8111-111111111111"
}
```

Replace all IDs with the actual provider collection, project and repository GUIDs.
GUID casing is normalized; UUID version bits are not imposed on provider identifiers.
The organization slug is used in display locators; it
does not identify a Factory Organization. Configure Web Hooks subscriptions for
`git.pullrequest.created`, `git.pullrequest.updated`, and `git.pullrequest.merged`,
filtered to the bound repository, with Resource details to send set to All.
Use Basic authentication username `factory` and password equal to the configured
source secret. Multiple subscriptions may share one source binding. The envelope
event `id` is the delivery identity; the resource repository, project and collection
must match the binding. A minimal/empty resource payload is rejected.

## Responses and recovery

Successful ingestion returns HTTP 200 and `{workItemId,factId}` after commit.
Repeated delivery of the same normalized observation returns the same IDs. Event
ID reuse with changed normalized content or conflicting resource ownership returns
409. Unknown/unavailable bindings return 404, invalid credentials 401, invalid
payloads/content type and bodies larger than 1 MiB return 422. No failure response
contains credentials or raw provider payloads. Only normalized observation fields
enter Fact history; extra envelope fields are ignored.

A successful first delivery atomically creates one corresponding Work Item and its
creation/observation Facts. Subsequent deliveries append evidence without overwriting
the Work Item title, retained state-flow version, Factory state or Workflow ownership.
Disabling type selection prevents new Work Items; existing correspondence still
accepts evidence. A secondary reference on a manually created Work Item does not
claim correspondence. Out-of-order delivery records timestamped evidence without
deriving Factory state from the latest provider state. History retains its stable
recording-timestamp/Fact-ID order; concurrent deliveries do not promise provider-event
or transaction-commit order.

Retry transient failures with the original event ID and content. HTTP 500 follows
a failed operation without a confirmed outcome; a lost response is safe to redeliver
because creation and its receipt are one persistent transaction. Investigate 409
instead of changing the ID to conceal a conflict. Source secrets, correspondence,
receipts and Facts must be included in database/ring backup and restore.

Production must preserve the external HTTPS request URL at the trusted ingress.
Plain HTTP is accepted only for exact configured loopback origin when
`FACTORY_ALLOW_LOOPBACK_HTTP=true`, for local verification. No polling, outbound
provider token, User impersonation or Workflow start is installed by this ticket.

## Verification

With the dedicated acceptance database running:

```powershell
npx tsx --test tests/observations.test.ts
npm run typecheck
npm test
npm run build
npm run acceptance
```

The production drill exercises both native delivery routes, concurrent retries,
Organization isolation, web/database restart and database/ring restore. Tests also
verify the future active/suspended ownership boundary with explicit fixtures;
they are not evidence of real Workflow execution. Issues 05 and 12 own that drill.
