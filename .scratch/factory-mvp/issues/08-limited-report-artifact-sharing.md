# Publish an explicitly shared, limited report Artifact

Status: ready-for-agent
State: closed
Assignee: Codex
Type: HITL
User stories covered: 25, 32, 33, 62, 63, 68

## Parent

[TBFactory MVP specification](../spec.md)

## What to build

Allow authorized GitHub and Azure DevOps publication through a versioned external report reference. Keep the original review Artifact private and share only a publication version containing confirmed Findings.

Human checkpoint: Agree and record content/reference versioning, publication destinations, access limits, expiry where selected, revocation, and retention before dependent implementation.

## Acceptance criteria

- [x] Create a publishable report version containing only confirmed Findings; rejected Findings, reasons, and the original review history remain private.
- [x] External sharing is an explicit authorized operation, and publication requires its separate execution authorization and current human decision.
- [x] Publishing a reference cannot make its content unrestricted or expose the original private Artifact.
- [x] Enforce the agreed sharing limits; deny access after revocation or selected expiry and reject cross-Organization access to private content.
- [x] Expose sharing status and authorized revocation through protected Factory UI/API operations.
- [x] Persist content, metadata, versions, and sharing restrictions across restart on the accepted database/file-volume storage.
- [x] Provide public-flow checks for both provider report-reference destinations, redacted content, unauthorized/private access, limits, revocation, selected expiry, and restart persistence.

## Blocked by

- [Issue 07: Publish confirmed Findings and reconcile uncertain outcomes](07-confirmed-publication-and-reconciliation.md)

## Comments

### Human checkpoint proposal — 2026-10-06

Issue 07 is closed and its publication/reconciliation implementation is available.
The [sharing proposal](../designs/limited-report-artifact-sharing.md) records
concrete options and a recommended contract for this issue's required human
checkpoint. All new sharing choices remain proposals pending User agreement;
dependent application implementation has not started. The ticket remains open
and `ready-for-human` until that checkpoint is resolved.

### Human checkpoint approved — 2026-10-06

The User explicitly approved the linked design as implementation decisions.
The accepted contract uses authenticated named Users in the same Organization,
one to 50 recipients, seven-day default expiry with a 30-day maximum, permanent
authorized revocation, immutable content/reference bindings and indefinite
retention on the existing database/file volume. Work Item Type version 5 adds
sharing and revocation Approval Points. The already confirmed public Factory
HTTP/operation seam is retained for behavioral verification. Implementation is
authorized; no checkpoint question remains open for this increment.

### Resolution — 2026-10-06

Implemented the approved version-5 contract: immutable confirmed-only publication
Artifacts, independently authorized sharing/publication/revocation, named-human
recipient access, bounded expiry, permanent revocation and indefinite persistence.
Protected UI/API operations expose restrictions, Approval and provider Activity
outcomes. Initial publication modes remain retained; changing a Repository default
does not invalidate queued publication. Empty output records `skipped` without a
share or provider POST. Legacy type versions and evidence-based recovery remain
available.

All 147 checks pass in the final `npm test` run. Typecheck, production build,
format checks and built HTTP/OIDC/restart acceptance pass. Collaborative browser
interaction verifies sharing creation/revocation and the empty-output skipped
publication action. Independent Standards and Spec review have zero outstanding
actionable findings.

See the [implementation evidence](../evidence/limited-report-artifact-sharing.md)
for executed checks, recorded effects and practical limits, and the
[operations guide](../../../docs/operations/limited-report-sharing.md) for
configuration, permissions, persistence and backup responsibilities. Local provider
effects do not establish production exactly-once guarantees. Migration and manual
provider correspondence remain separate increments.
