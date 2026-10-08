# Persistent shared installation delivery evidence

## Local scope and implementation choice

The User selected a locally verifiable installation with a configurable recovery
destination. Native Node was an implementation choice for that local exercise;
the User confirmed on 2026-10-07 that it remains provisional, not an approved
production architecture. Real deployment, independent off-host recovery storage,
deployed scheduling and alert routing, and an installation-specific measured RTO
remain pending. A same-host recovery directory and the local timings below do not
establish disaster recovery or a production RTO.

[Issue 12 was reopened](../issues/12-persistent-shared-installation.md#reopened-after-assumption-review--2026-10-07)
after the User's assumption review. Its manual closure checklist and the
[specification closure checklist](../spec.md#mvp-closure-checklist) require executed
deployment and recovery evidence. The local checks below remain historical results;
they do not close the ticket or establish complete MVP acceptance.

The [installation design](../designs/persistent-shared-installation.md) records
the accepted contract; the [runbook](../../../docs/operations/persistent-shared-installation.md)
documents startup, maintenance, backup, restore hold, per-run disposition,
activation, monitoring, and monthly drills.

## Behavioral and operational checks

Implementation commit `4f7c20833b1585de1afb36aa9909bbbbc0f36ac8` includes separate
built web and Mastra worker processes with persistent SurrealDB, LibSQL, Artifact,
and protected key-ring data. Recovery bundles exclude the separately held root key
and bootstrap credentials.

The focused public checks passed: coordinator 1/1, dispatch drain 2/2, maintenance
2/2, and provider observation restart 2/2. The coordinator exercised backup,
isolated restore, an enforced activation hold, explicit activation, a backup of
the activated installation, and a second-generation restore drill. It checked
two Organizations, encrypted secret recovery, retained Workflow identity and
human waits, completed publication without replay, private and revoked Artifact
access, and preservation of a cancelled terminal publication alongside newer
run ownership.

The active AI drain negative produced no bundle, recorded failed/overdue backup
health, kept web and worker available, and let the Activity finish naturally before
cancellation. Both GitHub and Azure DevOps checks delivered observations to actual
running and suspended Workflow Runs before and after worker/database restart.
Immutable Facts, Factory state, run identity, exclusivity, and completed AI work
were retained.

The final integration's local drill recorded `durationMs: 4989` and a successful
result in `.runtime/review-92b90915-ae33-4c0c-acf3-ed81328a14c5/recovery/installation-status.json`.
The final failed backup status in that fixture is the intentional drain-timeout
negative, not an unsuccessful restore drill. These ignored runtime files are local
execution evidence, not production recovery material.

## Kanban Board checks

The cancellation and migration Board scenarios are recorded in the resolutions
of [Issue 09](../issues/09-confirmed-workflow-run-cancellation.md) and
[Issue 11](../issues/11-retained-versions-and-explicit-migration.md).

On integration code commit `6d40d90072e90f53f76b1019a689fff51ff3b09c`, the built
publication acceptance fixture and native T3 Board verified explicit finalization.
For Work Item `2ae0ca97-b79f-4286-9cd7-a00075953c2f`, the Board requested
`review-finalization-v1`. The queued Request preserved `ready-for-review` and
transition sequence 1. Releasing the stopped worker completed the same Run,
advanced Factory state to `completed` with sequence 2, released ownership, and
retained the original report, Review Decision, and completed publication.

Public history included the matching immutable `state.transition` Fact
`7dff158d-6da4-4ce7-8b63-ea3e7a109ebf` and the finalizer's `workflow.completed`
Fact. Local metadata and screenshots are referenced by
`.runtime/review-c0291cbb-5c0e-4d9c-bb03-bd1ae228bcee/browser-finalization.json`.
The held fixture exited cleanly after the `stop` command.

## Integration review

The [two-axis review](integration-review.md) found one Low duplication judgement
call and one P1 live publication recovery regression. Both were resolved in
`6d40d90072e90f53f76b1019a689fff51ff3b09c`; the existing two-provider regression
failed before the fix and passed afterward. The final complete suite and package
checks are recorded in [Issue 12](../issues/12-persistent-shared-installation.md).

## Final package verification

The final complete `npm test` invocation passed 179/179, with no failures,
cancellations, or skipped cases, in 1,486,418.6743 ms. The local log is
`.runtime/factory-mvp-final-tests-retry.log`. Build, typecheck, formatting, and
diff checks also passed on the delivered application code.

The first full invocation passed 178/179 with one worker-ownership startup error
in the GitHub crash-recovery test. That case passed three isolated repetitions
and the final full invocation. Its original cause was not established; no
ownership protection was weakened or speculative fix introduced.

[Issue 17](../issues/17-diagnose-worker-ownership-recovery.md) records the original
report as open and suspended with `Status: needs-info`: its conditions could not
be reproduced in the later recorded runs. The cause remains unknown and no
correction is claimed. This diagnostic is not a current blocker; preserve the
ownership guards and perform Issue 12's deployment-specific restart and recovery
checks. Temporary backup interruption is accepted for the MVP, but its measured
maximum must be agreed in the chosen environment before Issue 12 closes. The
restored-observation omission is an accepted MVP limitation; the broader recovery redesign is deferred in
[Issue 18](../issues/18-redesign-durable-recovery.md), preserving current Run
durability and conservative interrupted-execution recovery requirements.

All six implementer worktrees and their auxiliary database containers were
removed after their changes were integrated. The pre-existing acceptance database
and unrelated services were preserved.
