# Publish confirmed Findings and reconcile uncertain outcomes

Status: ready-for-agent
Type: AFK
User stories covered: 25, 32, 33, 34, 42, 46, 47, 57

## Parent

[TBFactory MVP specification](../spec.md)

## What to build

Publish human-confirmed review output to the configured GitHub or Azure DevOps comments or report-content destination with separately checked execution authorization. Include durable external Activity tracking and authorized evidence-based recovery when a provider response is uncertain.

## Acceptance criteria

- [ ] Record both providers' destinations, credential handling, publication contracts, effect tracking, reconciliation, and recovery coordination before dependent implementation.
- [ ] Require a complete current Review Decision and separate execution authorization; publish only confirmed Findings and exclude rejected Findings and their reasons.
- [ ] Enforce applicable human-intervention policies and recheck permissions and relevant inputs immediately before publication. Handle no confirmed Findings according to the agreed output policy.
- [ ] Persist confirmed completed external Activities so process/database restart or deployment does not repeat publication.
- [ ] If publication may have succeeded but local confirmation is absent, gather provider evidence, expose the unresolved result, retain run ownership, and prevent blind retries.
- [ ] When provider idempotency is unavailable, require authorized User confirmation before resolving the uncertain Activity or authorizing a new attempt. Preserve recovery decisions and completed Activities in immutable history.
- [ ] Competing recovery attempts cannot duplicate an external Activity or release ownership while execution remains unresolved.
- [ ] Expose publication and recovery outcome in UI/API history. Review Workflow completion leaves Factory state unchanged; external Artifact references remain unavailable until explicit sharing is implemented.
- [ ] Provide provider-parameterized public-flow checks with real persistence and recorded effects for success, failure, relevant-input changes, permission revocation, provider success followed by a lost response, User confirmation, competing recovery, and restarts. Do not claim production provider exactly-once guarantees.

## Blocked by

- [Issue 04: Ingest deduplicated pull request observations from both providers](04-provider-observation-ingestion.md)
- [Issue 06: Submit and revalidate a consolidated Review Decision](06-current-consolidated-review-decisions.md)
