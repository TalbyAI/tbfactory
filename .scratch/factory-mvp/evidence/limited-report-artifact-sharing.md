# Limited report Artifact sharing evidence

Date: 2026-10-06.
Contract: [approved design](../designs/limited-report-artifact-sharing.md).
Issue: [08](../issues/08-limited-report-artifact-sharing.md).
Operations: [sharing runbook](../../../docs/operations/limited-report-sharing.md).

## Implemented boundary

Work Item Type version 5 adds explicit sharing and revocation with independent
execution and input-bound Approval. Retained versions 1–4 keep their definitions.
Each Work Item retains its initially selected publication mode. Changing only a
Repository default does not invalidate an already queued publication.

Publication Artifacts contain escaped confirmed Finding titles, severities,
explanations and locations. Content versions bind the report and human Review
Decision; references bind immutable recipients and expiry. Only named human Users
with current Organization Membership and scoped `artifact.shared-read` can
download them. That access grants no private Artifact, Work Item or history access.

Limits are one to 50 unique recipients, seven days by default and 30 days maximum.
The UI submits a bounded duration calculated using server time. Revocation is
permanent and requires current independent authority. Database metadata and
durable Artifact files retain content, restrictions, revocations and Facts
indefinitely; missing or damaged content fails closed.

## Behavioral checks

The public Factory HTTP/operation seam retains real SurrealDB, separate worker
processes and persistent files, with recorded GitHub and Azure DevOps effects.
[Sharing tests](../../../tests/artifact-sharing.test.ts) cover both providers,
redaction, recipient-only access, anonymous/API/nonrecipient/cross-Organization
denials, limits, expiry, Membership and policy revalidation, separate execution
and Approval, empty output, revocation before dispatch, uncertain provider effects,
exact reconciliation after revocation, restart persistence and corrupt content.

[Additional checks](../../../tests/sharing-revalidation.test.ts) cover corrected
Review Decisions and immutable older links, revocation independent of stale
inputs/original-creator access/provider configuration, selected expiry across web
and database restart, retained modes after default changes, and server-relative
duration bounds. The default-change and relative-duration regressions first failed
at this seam and passed after their corresponding fixes.

## Built HTTP and browser checks

The [built acceptance flow](../../../tests/sharing-acceptance.ts) uses the
production server, local OIDC sign-in, a recipient with only shared-read permission,
recorded provider comments and shared persistent volumes. It verifies redaction,
safe download headers, private-access denial, reference-only provider content,
web/database/worker restart, unchanged restrictions, permanent revocation and no
completed-publication replay.

Collaborative browser interaction verifies version 5 Board access, sharing
creation, visible restrictions and permanent revocation. A separate empty-report
drill clicks `Record skipped publication: no confirmed Findings` from a
reference-mode Review Panel; the stored Activity becomes `skipped` with zero
shares and zero provider POSTs. Run it with
`node --import tsx tests/sharing-acceptance.ts --empty --hold`, interact in the
browser, then resume the harness to verify the resulting public state.

Final built acceptance passed and recorded its immutable reference, restrictions
and provider effects in ignored
`.runtime/review-f04046cc-1ba3-47d5-9dfe-4addd3bc07e4/sharing-acceptance.json`.
The five additional public checks also passed, including expiry after restart.

The existing server test now builds and launches the production server with its
original 45-second bound and unchanged HTTP assertions; it passes in about five
seconds. The earlier development-server run exhausted Nitro's internal cold
reload deadline during dependency compilation. The production check verifies the
delivered runtime without depending on that development reload behavior.

## Final verification

- `npm test`: 147 passed, zero failed, canceled or skipped, in 1,051 seconds.
  The final run includes the additional sharing checks and production HTTP test.
- `npm run typecheck`, production build and `npm run format:check`: passed.
- `npm run acceptance:sharing`: passed with the evidence file linked above.
- Collaborative browser sharing/revocation and empty-output skip drills: passed.

The ignored execution logs include `.runtime/sharing-final-suite.log`,
`.runtime/sharing-revalidation-final.log`, `.runtime/sharing-server-built-check.log`
and `.runtime/sharing-acceptance-final.log`.

## Review and practical limits

Independent Standards and Spec review reports have no outstanding actionable
findings after corrections. The checks establish behavior against recorded local
provider effects; they do not establish production exactly-once guarantees.
Previously authorized downloads and local copies cannot be recalled. A provider
POST already authorized before revocation may complete and retains the existing
evidence-based recovery contract.

Database and Artifact volume backups must be restored together. Older backup
restoration requires reconciliation of later revocations before reopening shared
access. No migration, anonymous bearer-link sharing or automatic retention deletion
is included in this increment.
