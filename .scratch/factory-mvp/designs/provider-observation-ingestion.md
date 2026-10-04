# Provider observation ingestion

Issue: [04](../issues/04-provider-observation-ingestion.md). Implementation contract
derived from the accepted foundations and ADRs 0002, 0003 and 0004; no new domain
terms, Factory states or execution permissions are introduced.

## Boundary and credentials

Use native inbound webhooks rather than polling or an API accepting unauthenticated
normalized evidence. Polling would require outbound provider credentials and a
scheduler; a normalized command would put provider authentication on its caller.
Both are unnecessary for this ticket.

An operator installs a source with `source-put <protected-json-file>`. Its immutable
binding identifies one Factory Organization, Project, Repository, Work Item Type
(`pull-request-review`) and provider repository. Its `enabled` flag and secret can
be changed; rebinding an existing source is rejected. Operator configuration is
trusted installation administration, separate from User Activities. Ingestion
records provider evidence only and grants no Activity or State Transition permission.

Here `source` is a technical operator configuration key and authentication provenance,
not a new domain concept. It is not a User, Service Identity or Execution Identity;
it cannot request or execute Activities. Fact actor strings retain the repository's
existing provenance representation (`source:<configuration-id>` alongside User IDs
and operator audit provenance). The canonical domain glossary remains unchanged.

`POST /api/organizations/{organization}/sources/{source}/observations` accepts JSON
with provider authentication, independent of browser sessions and API Credentials.
GitHub uses HMAC-SHA256 of the exact request bytes and `X-Hub-Signature-256`;
`X-GitHub-Event` must be `pull_request` and `X-GitHub-Delivery` identifies the event.
Azure DevOps uses HTTPS Basic authentication with username `factory` and a random
source password, and the service-hook envelope's `id` identifies the event. Configure
Azure resource details to All. Bodies are limited to 1 MiB. Unsupported event types and incomplete payloads fail
validation. GitHub `ping` is authenticated and acknowledged without creating Facts.

Secrets use the existing OrganizationSecrets key ring under a source-specific purpose.
They are never returned by source setup, ingestion, history or errors. A global unique
authentication fingerprint prevents reuse of one secret across source bindings.
Read the enabled binding, encrypted secret and Factory ownership inside each ingestion
transaction, including retries, so disabled sources and rotated secrets reject delivery.
Production ingress uses HTTPS; explicit loopback HTTP is reserved for tests.

## Identifiers and ownership

GitHub correspondence uses immutable numeric repository ID plus pull request number;
the payload's repository and pull request base repository must agree. Fork heads are
allowed. Azure DevOps uses collection GUID, repository GUID and pull request number;
repository.project.id must match the configured provider project GUID, and
resourceContainers.collection.id must match the configured collection GUID. GUIDs
are normalized to lowercase. The configured Azure organization slug is used only
to construct the display locator. Provider payloads cannot select Factory ownership.

Factory Project/Repository ownership is checked at source installation and every
delivery. A resource has one correspondence per Organization and Work Item Type,
independent of source IDs. A different source with the same resource must use the
same Factory Project/Repository or delivery conflicts. Secondary `external.reference`
Facts continue to be references and neither claim nor redirect correspondence.
Only the supported Work Item Type can be installed; type boundaries are included
in keys without inventing another executable type for a test.

## Persistence and public result

One SurrealDB transaction creates or locates the correspondence, creates a Work Item
in the currently selected enabled type/version when needed, records its creation
Fact and an `external.observation` Fact, and stores the delivery receipt. Deterministic
record identities and unique indices coordinate concurrent deliveries; transaction
conflicts retry the complete read/authentication/write operation.

Receipt identity includes Organization, Work Item Type, provider resource and event
ID. The normalized observation digest detects reuse of an event ID with different
content (409). Ignore unrelated provider envelope metadata when comparing retries.
Return `{workItemId, factId}` for successful and duplicate deliveries, never a stale
Work Item snapshot. A new event appends one Fact. The existing public history uses
recording timestamp and Fact ID as its stable order; concurrent events can share a
timestamp, so that order does not promise provider-event or transaction-commit order
and does not describe current Factory state. Existing
items retain title, Factory state, version and activeRun. Disabled type selection
prevents new creation but does not block evidence arriving for an existing item.

Observation payloads retain provider, resource identity, event ID, event/action,
title, provider state, head/base commit IDs and canonical locator. Store only these
validated fields, rather than private messages, credentials or entire webhook bodies.
Actor identifies the provider source, never a User or Workflow Execution Identity.
Invalid authentication returns 401; missing/disabled binding or foreign ownership
returns 404; conflicting correspondence/delivery returns 409; malformed input 422.
HTTP success follows transaction commit; failed transactions leave no partial history.

## Verification seams

The ticket explicitly selects provider-parameterized public-operation checks.
Test the inbound HTTP endpoint and existing Work Item/history/board public reads
against real SurrealDB and encrypted source credentials. Install sources through
the operator interface. Cover authentication, repeated/concurrent first and later
deliveries, identity/ownership mismatches, independent Organizations, secondary
references, selected/retained versions, unchanged Factory state, disabled/rotated
sources, interrupted writes and reconnection. The production acceptance drill uses
the built TanStack route and web/database restart. Existing history UI renders
observation Facts without a provider-specific editor.

Seeded future worker boundaries verify activeRun preservation through public reads.
Real active/suspended Workflow Runs do not exist until Issue 05. Ingestion does not
write or check activeRun; runtime verification belongs to Issues 05 and 12, as the
ticket already requires. Do not fabricate Workflow execution as acceptance evidence.

## Primary source verification (2026-10-04)

- [GitHub delivery validation](https://docs.github.com/en/webhooks/using-webhooks/validating-webhook-deliveries)
  specifies exact-body HMAC-SHA256 and constant-time signature comparison.
- [GitHub event envelopes](https://docs.github.com/en/webhooks/webhook-events-and-payloads)
  document delivery identifiers and pull_request payloads.
- [Azure DevOps webhooks](https://learn.microsoft.com/en-us/azure/devops/service-hooks/services/webhooks?view=azure-devops)
  support HTTPS Basic authentication and All resource details.
- [Azure DevOps events](https://learn.microsoft.com/en-us/azure/devops/service-hooks/events?view=azure-devops)
  document created, updated and merged pull request envelopes and resource identifiers.
