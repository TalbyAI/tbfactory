# Confirmed publication and reconciliation

Issue: [07](../issues/07-confirmed-publication-and-reconciliation.md).
Implementation contract under accepted ADRs 0003, 0004, 0005 and 0008. Existing
domain terms, Factory states and retained `review-v1` snapshots remain unchanged.

## Destination, credentials and output

An operator configures one enabled destination per Factory Repository with
`publication-configure <protected-json-file>`. Configuration identifies the inbound
provider source, GitHub owner/repository or Azure organization/project/repository,
and an independent write credential. The source's immutable binding and Work Item
correspondence determine the pull request; secondary references cannot redirect it.
Manual Work Items need provider ingestion before publication. Configuration changes
receive a new version; rotation of the same credential preserves its version.
Secrets use OrganizationSecrets with a publication-specific purpose, are never
returned, and are unavailable to review agents. Disabling configuration revokes
dispatch. GitHub uses a repository-scoped installation token or fine-grained token
with Pull requests write permission; Azure uses a PAT with Code read/write
(`vso.code_write`) and PR Threads read/write (`vso.threads_full`) access. Tokens are
installed/rotated operationally, never inferred from webhook or
Repository Access Credentials.

MVP publishes report content as one consolidated pull request comment: GitHub
`POST /repos/{owner}/{repo}/issues/{number}/comments` with `body`; Azure
`POST /{organization}/{project}/_apis/git/repositories/{repository}/pullRequests/{number}/threads?api-version=7.1`
with one text comment and active thread status. No inline placement, pull request
Approval, merge, report summary, rejected Finding/reason or Artifact reference is
sent. If no Findings are confirmed, record a durable skipped Activity without a
provider request. External Artifact sharing remains unavailable.

Official contracts checked on 2026-10-05:
[GitHub comments](https://docs.github.com/en/rest/issues/comments),
[Azure thread creation](https://learn.microsoft.com/en-us/rest/api/azure/devops/git/pull-request-threads/create?view=azure-devops-rest-7.1),
and [Azure thread listing](https://learn.microsoft.com/en-us/rest/api/azure/devops/git/pull-request-threads/list?view=azure-devops-rest-7.1).

## Authorization and persistence

Work Item Type version 4 declares the `review.publish` Approval Point while
retaining version 3's Review Workflow and state behavior. Definitions 1–3 and
retained `review-v1` snapshots remain unchanged. Only version 4 can request
publication. Selecting it enables new Work Items without silently migrating
existing ones; explicit migration remains Issue 11. Installed review execution
continues to support versions 3 and 4.

The existing HTTP/Factory operation seam and installation worker are the public
flow test seams required by the issue. Checks use real SurrealDB and recorded
provider HTTP effects; existing review fixtures cover LibSQL and private files.

Publication is explicitly requested after the retained Review Workflow completes.
The same run reacquires exclusive Work Item ownership atomically and records a
separate `review.publish` execution identity. A complete current Review Decision
is required, never inferred from AI output. Human policies additionally require
an Activity/input/destination/identity-bound Approval under
`approval.review-publish`. Browser Users can supply that Approval separately from
the Review Decision; API Credentials cannot. Immediately before dispatch, recheck
current execution access, Approval authority when applicable, report and decision,
input versions, source binding, destination version, and credential availability.

One deterministic external Activity per run retains its exact confirmed content,
destination, decision, execution identity and numbered attempts in SurrealDB.
Reserve an attempt and commit `dispatching` before any provider request; never put
HTTP effects inside retryable database transactions. Persist completion and its
immutable Fact atomically with ownership release. Restart/deployment cannot replay
a completed Activity. Review completion and publication never change Factory state.

## Uncertainty and recovery

Network errors, timeouts, malformed success responses and server errors are
uncertain. Explicit provider rejection records failure. Both remain visible and
retain ownership until authorized recovery. An interrupted dispatch becomes
uncertain only when a new worker has acquired the existing confirmed-stop
installation lock. Neither leases nor timeouts prove that execution stopped.

An authorized User requests read-only reconciliation using `review.recover`.
The worker queries the retained destination, collecting matching provider IDs and
content digests using an Activity/attempt marker and exact content. GitHub listing
uses bounded pagination; missing or incomplete evidence is never proof of absence.
Provider errors expose unavailable evidence without returning provider bodies or
secrets. Reconciliation itself never dispatches publication or releases ownership.
Evidence receives a new immutable Fact and version. Neither provider contract is
treated as offering idempotency for these creates.

Browser User confirmation under `review.recover` is required to resolve completed,
resolve not-published, or authorize a new attempt. Confirmation identifies the
latest evidence, records an explanatory reason and checks ownership atomically.
A new attempt additionally needs current `review.publish` execution authority,
current Review Decision and renewed applicable Approval; it keeps ownership and
gets a new attempt marker. Completed recovery may preserve a stale report because
it records an already executed effect; stale inputs prohibit new dispatch.
Competing requests/confirmations serialize through the Activity row and the
evidence version. Dispatching/reconciling cannot be confirmed or superseded.
Immutable Facts preserve attempts, evidence, User decisions and completed effects.
This prevents blind replay; it does not guarantee exactly-once production effects.
