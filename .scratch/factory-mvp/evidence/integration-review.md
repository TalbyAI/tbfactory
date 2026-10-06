# Factory MVP integration review

The two independent review axes compared
`d816f8dd57ed8963552835e9f0861ded3cffbc47...4f7c20833b1585de1afb36aa9909bbbbc0f36ac8`
on `integration/factory-mvp`. The originating specification is the
[Factory MVP map](../spec.md), including its accepted contracts and User-approved
scope boundaries. Issue 16 and v5 migration were excluded from implementation;
real deployment remains pending under Issue 12's approved local installation scope.

## Standards

No documented-standard breaches were found. One Low judgement-call finding,
possible Duplicated Code, identified repeated backup/drill overdue calculations in
the live and offline installation status paths. Both repeated
`overdue: !lastBackup || now - lastBackup > 24 * 60 * 60 * 1000` and the corresponding
31-day drill calculation.

Commit `6d40d90072e90f53f76b1019a689fff51ff3b09c` extracted one shared
`backupAndDrillHealth` helper, preserving the status fields and deadlines.

## Spec

One P1 finding identified an Approval-wait recovery regression. Entering
`reconciliation-queued` cleared `dispatchAuthorized` for live publications as well
as restored recovery points. This discarded a live attempt's durable proof of no
authorized POST and prevented an authorized User from confirming `not-published`
when provider evidence was unavailable, retaining Work Item ownership indefinitely.
The behavior contradicted the accepted [Issue 07 Approval-wait recovery
contract](../issues/07-confirmed-publication-and-reconciliation.md#approved-approval-wait-recovery-correction--2026-10-05).

Commit `6d40d90072e90f53f76b1019a689fff51ff3b09c` preserves live dispatch tracking
while clearing stale provider evidence. Installation restore continues to discard
recovery-point dispatch tracking in `convertRestoredPublications` before activation.
The existing public Approval-wait regression case failed for both providers before
the fix and passed 2/2 afterward against the isolated SurrealDB service on port 18001.

No other confirmed specification mismatches or scope creep were found. Production
off-host storage, deployed scheduling and alert routing, and measured production
RTO remain pending. The final full-suite and Board installation gate is recorded in
[Issue 12](../issues/12-persistent-shared-installation.md).

## Result

Standards: one Low judgement call, resolved. Spec: one P1 recovery regression,
resolved. The two axes remain separate; no findings remain outstanding.
