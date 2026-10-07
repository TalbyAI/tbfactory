# Persistent shared installation contract

Issue: [12](../issues/12-persistent-shared-installation.md).
Implementation contract under accepted ADRs 0001, 0004, 0007, 0008, and 0010,
the [key-ring backup policy](../../../docs/operations/key-ring-backup.md), and the
delivered workflow, publication, sharing, cancellation, finalization, and retained
definition contracts.

## Local installation shape

The User confirmed on 2026-10-07 that native Node remains a provisional local
implementation choice. The earlier approval selected local verification, not
this production architecture. Deployment shape and host supervision remain
explicit work in [Issue 12](../issues/12-persistent-shared-installation.md).

The locally verifiable installation runs the built TanStack Start web server and
one Mastra worker as separate native Node processes. Docker runs the pinned
SurrealDB service and the per-run review sandbox. Both application processes use
the same SurrealDB database, Artifact directory, and protected key-ring
directory. The worker alone owns the persistent LibSQL workflow file. The worker
lock and owner record remain
installation-wide; a second worker is never started against the same paths.

The installation runner owns web and worker child lifecycles and exposes local
`start`, `stop`, `status`, `backup`, `restore`, `drill`, and `activate` commands.
All active paths and the local recovery path are configurable. The recovery path
must be outside the database, worker, Artifact, and active ring paths. The local
exercise may use a protected directory on the same host. That verifies the local
procedure only; production requires an independent protected destination and a
measured installation-specific recovery-time objective before deployment.

## Startup and maintenance coordination

- Wait for SurrealDB `/ready` before starting the web process or worker.
- On ordinary startup, verify the configured protected ring against every
  encrypted secret before serving requests or claiming worker ownership.
- A restore-hold ledger lives in the restored worker directory. If it is present
  but not activated, `scripts/worker.ts` exits before connecting to SurrealDB or
  claiming ownership. This check applies when the worker is started directly as
  well as through the runner. The web process remains in maintenance until the
  operator starts the isolated restored installation.
- A backup first tells the worker to pause dispatch. The worker closes the
  current `tick`/dispatch race and lets active AI, sandbox, and provider tasks
  finish naturally. It must not call ordinary `ReviewWorker.close()` as a drain;
  that path aborts active controllers.
- After the worker reports zero in-flight dispatch and execution, the runner asks
  it to stop cleanly, then verifies the owner record and `worker.lock` are gone.
- The built web process receives a local IPC stop request that invokes the pinned
  srvx signal handler. The built Nitro close hook closes the same Factory Store
  singleton used by application routes and acknowledges closure. The runner
  waits for child exit and rejects any graceful-shutdown timeout or forced-close
  evidence. A close-hook acknowledgement by itself is not a clean drain.
- Capture begins only after both processes are stopped cleanly. A drain timeout
  or capture failure produces a failed status, removes the incomplete staging
  directory, and never marks a bundle complete. Services resume only after the
  failure is recorded and partial output is removed. If either child did not
  stop cleanly, keep the installation stopped for operator recovery.

## Recovery bundle

Temporary backup interruption is accepted for the MVP. Agree a maintenance
window, measure complete backup duration and web/worker interruption through
service return, and agree a maximum total interruption in the chosen environment
before Issue 12 closes. The default five-minute backup timeout applies per phase;
it is not an enforced deadline for total interruption. Failed return to service
or an exceeded operational limit requires the documented operator response.

A complete bundle contains:

- A SurrealDB 3.3 logical export with encrypted secrets, provider correspondence,
  delivery receipts, and the schema required by the installation.
- The closed Mastra LibSQL `workflows.db` and any required SQLite sidecars.
- All immutable Artifact content.
- A protected encrypted key-ring export with authenticated metadata.
- An integrity manifest with bundle format, installation identity, application
  revision, SurrealDB version, ring root-key version and covered key identifiers,
  recovery-point and capture timestamps, and a SHA-256 hash and byte length for
  each captured file.

The root key and bootstrap credentials are held separately and are never copied
into the bundle, logs, or manifest. The export request authenticates in memory;
SQL, authorization headers, credentials, and response bodies from failed export
or import requests are never logged. Incomplete exports remain under a staging
name and are never reported as successful.

Keep at least 30 daily recovery points. Retaining all points is acceptable; no
speculative pruning or key deletion is part of this increment. The scheduled
cadence must not exceed 24 hours, failed or overdue backup status must be
observable and alertable, and a restore drill must run monthly. Ring backup
verification remains a prerequisite to key activation under the accepted
key-ring policy.

## Restore and activation hold

Restore only into fresh, isolated database and file paths. Verify every manifest
hash before extraction, reject path traversal and overwrite attempts, import into
a fresh SurrealDB namespace/database or fresh isolated instance, and discard the
entire target after any partial Surreal import failure. Restore LibSQL and
Artifacts into new paths. Verify the protected ring against authenticated ring
metadata and all restored secret key identifiers, decrypt secrets without
printing them, open and close the restored LibSQL store, and verify Artifact
content hashes before declaring the local drill successful. Never generate
replacement keys over restored data.

Every restored installation remains in restore hold after those checks. Review
Workflow Run status, AI call reservations, publication attempts, cancellation
ownership, and provider evidence from the selected recovery point before
activation. Restore points can predate provider-side effects, credential
revocations, or share usage. Keep provider and AI dispatch disabled until an
operator completes that reconciliation and explicitly activates the installation.
The durable hold ledger records every nonterminal Workflow Run. Human waits and
read-only publication reconciliation may resume after activation. Other
dispatchable runs remain held until each receives an explicit per-run disposition
to keep it held, resume it after operator reconciliation, or convert a queued
publication to read-only reconciliation. A queued or pre-dispatch status and
`dispatchAuthorized: false` are not evidence that no later provider effect
occurred. Do not blindly replay queued or pre-dispatch work from an older recovery
point.
Existing provider recovery remains read-only until sufficient evidence and, where
required, explicit User confirmation are recorded. A retained human wait resumes
the same Workflow Run only after checks and explicit activation.

The activation timestamp is also the cutoff for automatic review starts from
restored external observations. The worker does not create a new AI run from an
observation recorded at or before activation, even if an older recovery point
contains the Fact but lacks a later receipt. Observations recorded after activation
remain eligible under the existing rules, including ownership and deduplication.

The User accepted this omission as an MVP limitation on 2026-10-07. The hold
ledger and `recovery-list` cover existing Runs, not observations that lack a Run;
legitimate unexecuted starts may therefore remain unperformed. The broader
durability/restart redesign is deferred in
[Issue 18](../issues/18-redesign-durable-recovery.md). This does not defer ordinary
Run durability, retained human waits, or conservative manual recovery of
interrupted execution. Unknown AI outcomes and uncertain publication are not
automatically replayed.

A clean backup must contain no `worker_owner` row or `worker.lock`. Do not
transplant a source host's worker lock into restored paths or automatically clear
a live owner. A crash-point image with ownership markers stays held until the
operator confirms the old process and sandbox cannot act and completes the
existing host/path-bound recovery procedure.

## Explicitly pending deployment decisions

Issue 12 and the umbrella specification remain open until their manual work and
verification have actually been performed. The ownership startup failure also
remains an acceptance blocker in
[Issue 17](../issues/17-diagnose-worker-ownership-recovery.md); successful later
test invocations did not establish its cause or correction.

The local acceptance path does not choose or prove a production off-host recovery
destination, its access policy, a measured installation-specific recovery-time
objective, or a production alert route. These remain deployment prerequisites;
a local same-host duration is not the production objective.

## Verification seams

Use the public installation CLI to run backup, isolated restore, status, and
restore drill against real persistent SurrealDB and LibSQL stores. Use the
existing built web/worker acceptance helpers and controlled AI/provider
boundaries. Verify at least two Organizations, retained credentials and
encrypted secrets, Artifact privacy/revocation, a suspended human wait, unchanged
completed provider/AI effects, cancellation ownership, and safe uncertain
publication recovery across restart. A failed web or worker drain must not create
a successful bundle. Existing ticket acceptance and native Board evidence remain
the application behavior seam; this contract adds no component-test framework.
