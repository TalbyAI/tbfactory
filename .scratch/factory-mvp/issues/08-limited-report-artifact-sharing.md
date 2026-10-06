# Publish an explicitly shared, limited report Artifact

Status: ready-for-human
Assignee: Codex
Type: HITL
User stories covered: 25, 32, 33, 62, 63, 68

## Parent

[TBFactory MVP specification](../spec.md)

## What to build

Allow authorized GitHub and Azure DevOps publication through a versioned external report reference. Keep the original review Artifact private and share only a publication version containing confirmed Findings.

Human checkpoint: Agree and record content/reference versioning, publication destinations, access limits, expiry where selected, revocation, and retention before dependent implementation.

## Acceptance criteria

- [ ] Create a publishable report version containing only confirmed Findings; rejected Findings, reasons, and the original review history remain private.
- [ ] External sharing is an explicit authorized operation, and publication requires its separate execution authorization and current human decision.
- [ ] Publishing a reference cannot make its content unrestricted or expose the original private Artifact.
- [ ] Enforce the agreed sharing limits; deny access after revocation or selected expiry and reject cross-Organization access to private content.
- [ ] Expose sharing status and authorized revocation through protected Factory UI/API operations.
- [ ] Persist content, metadata, versions, and sharing restrictions across restart on the accepted database/file-volume storage.
- [ ] Provide public-flow checks for both provider report-reference destinations, redacted content, unauthorized/private access, limits, revocation, selected expiry, and restart persistence.

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
