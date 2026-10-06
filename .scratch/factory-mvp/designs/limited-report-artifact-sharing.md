# Limited report Artifact sharing

Issue: [08](../issues/08-limited-report-artifact-sharing.md).

Status: accepted by the User on 2026-10-06. The contract below is approved for
implementation. Issue 07 is closed; its publication and recovery
contract remains the starting point. This design preserves ADRs 0003, 0004,
0007, 0008 and 0009 and uses the existing domain language.

## Access approaches

1. **Recommended: authenticated, named Users in the same Organization.** A
   reference grants access only to its redacted publication version and only to
   its explicit recipient list. Every read checks current Membership and scoped
   sharing-read permission. This reuses Factory identities and restrictive policy
   composition, but provider participants need Factory onboarding.
2. **Bounded bearer links.** Possession of a secret grants redacted-content access
   until expiry or revocation. This avoids onboarding, but forwarding the link
   forwards access and cannot identify or restrict individual recipients.
3. **External recipient identities.** Authenticate named recipients without
   Organization Membership. This supports outside collaborators, but adds a new
   identity/access boundary and onboarding contract beyond the current MVP.

The accepted contract selects approach 1. External publication means placing a
reference in a provider comment; it does not imply anonymous content access.

## Content and reference versions

Generate an immutable publication Artifact from one complete, current human
Review Decision. Include only confirmed Finding titles, severities, explanations
and code locations. Exclude the private summary, rejected Findings, rejection
reasons, prior-Finding links, internal report identifiers and review history.
Render the selected fields as escaped Markdown without embedded HTML.

Bind the content version to the private report and Review Decision internally.
Store its content digest and file metadata in SurrealDB and its content on the
existing persistent Artifact volume. The private Artifact is never changed or
served through the shared-content route.

Each reference has a distinct identifier and immutable content-version,
Organization, recipient and expiry bindings. Do not include bearer credentials
or private storage paths in the URL. Changing recipients or expiry requires a
new reference and explicit authorization; it cannot reactivate a revoked or
expired reference. The original reference never redirects to newer content.
New content requires a new current human Review Decision and the existing safe
publication/correction rules; completed publication is not silently edited.

## Destinations and explicit authorization

Keep GitHub pull request comments and Azure DevOps pull request comment threads
as the destinations already implemented by Issue 07. Add a versioned Repository
publication-configuration default mode; existing configuration defaults to
confirmed-content comments. Record the selected mode in initial Work Item
configuration at creation/import, allowing an explicit initial override. The
Workflow uses that retained Work Item selection, not a later change to the
Repository default. A reference mode requires a type supporting sharing; reject
incompatible creation/import configuration. Existing version-4 Work Items without
a mode retain confirmed-content comments; versions 1–3 keep their existing
no-publication behavior pending explicit migration. The Repository still fixes the authorized
provider destination and credential, never a client-supplied destination URL.

Add Work Item Type version 5 declaring
the sharing and revocation Approval Points alongside the existing publication
Approval Point. Definitions 1–4 remain unchanged; version 4 keeps its existing
confirmed-content publication behavior. Reference sharing requires version 5.
Organizations select version 5 for new Work Items. Reference sharing for retained
versions is outside this increment: Issue 11 currently specifies version-3 to
version-4 migration only. Extending migration to version 5 requires a separately
approved contract and a new review/current Review Decision, without rewriting
retained inputs or history. Manual Work Item correspondence remains Issue 16.

Creating a share requires an explicit authenticated human request, private
Artifact access, Work Item access and independently scoped `artifact.share`
execution authorization. Publishing its reference additionally requires the
existing `review.publish` execution authorization, current Review Decision and
applicable `approval.review-publish` Approval. Sharing does not itself dispatch a
provider request, and a Review Decision does not grant either execution right.
An applicable human-intervention policy for sharing requires a separate,
input-bound `approval.artifact-share` Approval; a missing execution permission or
an explicit prohibition always denies the operation.

Provider output contains only a generic report-reference label, the authenticated
Factory URL and the existing Activity/attempt marker. Bind publication and its
Approval to the exact content version, reference restrictions and destination
configuration. Recheck access, current inputs and active sharing immediately
before POST. Empty confirmed output retains Issue 07's skipped Activity behavior
and creates neither an active share nor a provider comment.

Reuse durable Activity reservation, exclusive ownership, stopped-execution
recovery and evidence-based reconciliation. Never replay a completed provider
Activity or blindly retry an uncertain one. Revoking a reference does not erase
or resolve an uncertain provider effect; recovery can still identify that effect
using the retained exact comment content and attempt marker.

## Access limits, expiry and revocation

Accepted limits: one to 50 named User recipients, all with current Membership in
the owning Organization. A recipient must also retain `artifact.shared-read`
permission at the Work Item's scope. Reading the publication version does not
require `artifact.read`, `work-item.read` or `history.read` and grants none of
those permissions. A URL alone never authorizes access. Users belonging to other
Organizations only, anonymous callers and API Credentials cannot read shared
content in this increment.

Accepted expiry: seven days by default, explicitly selectable up to 30 days from
share creation; no nonexpiring references in this increment. Deny a read when
server time is at or beyond expiry. Enforce expiry on every read without relying
on a cleanup job, including after web/database restart.

An authenticated human with Work Item access and scoped `artifact.revoke`
execution authorization may permanently revoke any reference in that scope.
Honor applicable human policies through an input-bound
`approval.artifact-revoke` Approval. Revocation does not require the original
creator's continuing access, current report inputs or available provider
credentials. Serialize revocation with share activation and dispatch
authorization. Deny every new read authorized after revocation commits; a
response already authorized or a downloaded copy cannot be recalled. Return
shared content with `Cache-Control: no-store` and safe download headers.

Protected Factory UI/API operations expose content/reference versions,
recipients, expiry, active/expired/revoked status, provider Activity outcomes and
authorized revocation. Recipients see only the redacted version, with no private
review/history navigation or private metadata. The private report UI keeps its
existing private authorization checks.

## Retention and restart

Accepted retention: keep private and publication Artifact content, metadata,
references, restrictions, revocations and immutable Facts indefinitely on the
accepted database/file-volume storage. Expiry and revocation withdraw access;
they do not delete evidence. Automated deletion and a configurable retention
policy require a separate approved follow-up. Restoring an older backup can
restore older access restrictions, so restoration requires an operator check of
post-backup revocations before shared access is reopened.

File creation precedes activation of its database-backed reference. A failed or
interrupted creation cannot expose incomplete content. Verify retained file size
and digest before serving content; unavailable or corrupt content fails closed.
Restart retains reference bindings and does not regenerate content, reset expiry,
reactivate revocations or replay completed publication.

## Verification and implementation order

Use the already confirmed public Factory HTTP/operation seam with separate
worker processes, real SurrealDB/LibSQL/file persistence and recorded local
provider effects. Use the existing public-flow fixtures; provider simulations
do not establish production exactly-once guarantees.

Implement one failing behavioral check and its passing slice at a time:

1. Create the redacted immutable version and explicit restricted reference;
   verify confirmed-only output, separate authority, policy Approval and no
   access to the private report from the shared route.
2. Publish reference-only output through both configured providers, including
   stale decisions/configuration, permission loss, revocation before dispatch,
   empty output and uncertain-effect recovery without blind retry.
3. Read as a permitted recipient; deny anonymous, nonrecipient,
   cross-Organization, expired and revoked access, revoked Membership and
   prevailing prohibitions. Exercise recipient-count and expiry bounds.
4. Expose protected status and revocation in UI/API and verify scoped denial,
   required human Approval and competing operations.
5. Restart web, worker and database using the same volumes; verify identical
   content and reference bindings, retained expiry/revocation and no replay.

Run focused test files and typechecking during implementation. Finish with the
full test suite, built HTTP/browser acceptance, build, formatting verification
and independent Standards/Spec code review before the implementation commit.

## Human checkpoint

The User approved this document as implementation decisions on 2026-10-06,
including content/reference versioning, provider destinations, recipient/access
limits, expiry, revocation and retention. The approval is recorded in Issue 08.
No human checkpoint question remains open for this increment.
