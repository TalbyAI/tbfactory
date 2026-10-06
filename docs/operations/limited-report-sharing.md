# Limited report Artifact sharing

The [approved Issue 08 contract](../../.scratch/factory-mvp/designs/limited-report-artifact-sharing.md)
uses authenticated named Users in the owning Organization. A provider comment
contains a report reference; its URL alone grants no access.

## Configuration and retained versions

Select Work Item Type version 5 through the protected `work-item-types` operation
for new Work Items. Versions 1–4 retain their definitions and publication behavior.
Migration to version 5 is outside this increment.

The existing `publication-configure` operator command accepts `defaultMode`:
`confirmed-content` (the default) or `report-reference`. Work Item creation accepts
an optional `publicationMode` override. An authenticated provider source may also
retain an optional `publicationMode` initial-import override in `source-put`.
Initial configuration is stored on the Work Item and its creation Fact; later
Repository defaults do not change it. A reference selection requires version 5.
The Repository configuration and provider correspondence still fix the destination
and credential; clients cannot select a destination URL.
Configuration versions record default-mode changes independently of the provider
destination version. Changing only the default does not invalidate a queued
Activity or its Approval; changing destination inputs still requires revalidation.

## Protected operations

Operations use the existing authenticated Factory API, same-origin browser mutation
checks and operation receipts. Paths below are relative to
`/api/organizations/{organization}/work-items/{workItem}`.

| Method and path | Input and authorization |
| --- | --- |
| `POST /artifact-shares` | `operationId`, `run`, current `decision`, one to 50 unique recipient User IDs, optional `expiresInDays` (1–30) or `expiresAt` in server milliseconds, mutually exclusive; authenticated human, `work-item.read`, `artifact.read`, independent `artifact.share`. |
| `GET /artifact-shares` | Protected private status, content/reference versions, recipients, expiry, revocation request and provider Activity outcomes; `work-item.read` and `artifact.read`. |
| `POST /artifact-shares/{reference}/approve` | `operationId`; human `approval.artifact-share`; rechecks the requesting User's execution permission, private access, current decision, recipients, expiry and file integrity. |
| `POST /artifact-shares/{reference}/revoke` | `operationId`; human `work-item.read` and independent `artifact.revoke`; permanently revokes or records an input-bound request when policy requires human intervention. |
| `POST /artifact-shares/{reference}/revoke-approve` | `operationId`, revocation `request`; human `approval.artifact-revoke`; checks the current request and requester execution authority. |
| `POST /review-publications` | Existing publication request plus explicit `reference` for nonempty reference-mode output; separate `review.publish` authority and applicable `approval.review-publish`. |

The private review panel provides creation, sharing Approval, reference publication,
status and permanent revocation controls. A Review Decision grants none of the
execution or Approval permissions above. A policy prohibition always wins.

`GET /api/shared-reports/{reference}` serves only the immutable, escaped Markdown
publication Artifact, with safe attachment headers and `Cache-Control: no-store`.
It requires an authenticated human recipient, current Membership and scoped
`artifact.shared-read`; it requires no private Artifact, Work Item or history
permission and grants none. API Credentials, anonymous callers, nonrecipients and
Users belonging only to other Organizations are denied. Recipients must sign in to
Factory before opening the reference.

Only confirmed Finding titles, severities, explanations and code locations are
included. The original report, summary, rejected Findings, reasons, prior-Finding
links and history remain private. Empty confirmed output creates no active share;
the existing publication Activity records `skipped` without a provider request.

## Expiry, revocation and recovery

Expiry defaults to seven days; an explicit timestamp must be in the next 30 days.
The UI submits a duration of one to 30 days, calculated using server time.
Each read checks server time. Revocation is permanent and independent of current
review inputs, original-creator access and provider credentials. Changing
recipients or expiry means an explicitly authorized new reference. Existing links
never redirect to newer content.

Dispatch authorization rechecks current inputs, private access, publication
permission, active sharing, destination configuration and file integrity. Its
reference update serializes with activation and revocation. Revocation prevents
new reads authorized after its commit; previously authorized responses and
downloaded copies cannot be recalled. A provider POST already authorized before
revocation may complete and remains subject to the existing recovery contract.

Revoking a reference does not resolve an uncertain provider effect. Recovery
retains the exact comment and Activity/attempt marker for evidence-based
reconciliation, including after revocation or expiry. Positive matches prohibit
blind retries; completed Activities are never replayed.

## Persistence and operator responsibilities

Publication content is written durably before its database reference is activated.
SurrealDB retains metadata, content/reference bindings, expiry, revocations and
immutable Facts; the existing Artifact volume retains private and publication
content indefinitely. Missing or corrupt files fail closed after size/digest
verification. Restarts do not regenerate content, reset expiry or reactivate
revocations. An interrupted creation may leave an inaccessible unreferenced file.

Restore both database and Artifact volume together in maintenance mode. Before
reopening shared access after restoring an older backup, reconcile all post-backup
revocations; an older database can restore older restrictions. Automated deletion
and configurable retention require a separately approved contract.

With the dedicated acceptance database and sandbox image running, verify with
`npm run typecheck`, `node --import tsx --test tests/artifact-sharing.test.ts`,
`node --import tsx --test tests/sharing-revalidation.test.ts`, `npm test`,
`npm run build`, `npm run acceptance:sharing` and `npm run format:check`.
`node --import tsx tests/sharing-acceptance.ts --hold` retains the built app for a
browser drill; sign in as `alice`, then open the printed Work Item path from the
board. Local recorded provider effects validate these flows without establishing
production exactly-once guarantees.
