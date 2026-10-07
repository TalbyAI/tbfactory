# Persistent shared installation operations

This runbook describes the local native Node installation delivered for Issue 12.
It runs the built TanStack Start web server and one Mastra worker as separate Node
processes. Docker runs SurrealDB and review sandbox containers. The local recovery
directory exercises backup and restore on one host; production still requires an
independent protected recovery destination and a measured installation-specific
recovery-time objective.

Native Node is a provisional choice for local verification, confirmed as such by
the User on 2026-10-07. Choose the deployment shape explicitly before operational
acceptance. [Issue 12](../../.scratch/factory-mvp/issues/12-persistent-shared-installation.md#manual-work-and-closure-evidence)
is reopened and records the manual work and evidence required for closure; this
runbook and prior local checks do not establish that those jobs are deployed.

## Configure and start

Copy [`.env.example`](../../.env.example) to a protected environment file outside
the repository. Set the installation identity, SurrealDB URL and bootstrap
credentials, OIDC settings, separately held root-key file and version, protected
key-ring paths, worker and Artifact paths, recovery path, sandbox image, and
approved provider host list. The root key and SurrealDB bootstrap credentials
must be available from protected operator custody; neither is included in a
recovery bundle. Do not place them in source control, command arguments, logs, or
container images.

The local web listener defaults to `FACTORY_PORT=3000`, even when the public
`FACTORY_ORIGIN` omits a port. Set `FACTORY_PORT` explicitly when the host
service manager or reverse proxy uses a different internal port.

The recovery path must be outside the SurrealDB data, worker, Artifact, and active
key-ring paths. Use restrictive file permissions and an independently managed
credential to access it. A same-host local directory is suitable for the local
exercise only. Production backups must be copied to an independent protected
destination.

Run the pinned SurrealDB 3.3 image with durable storage and bind its HTTP/RPC
ports only to the private installation network. Wait for `GET /ready` to return
200 before starting TBFactory. The server, worker, and sandbox image versions
must match the tested installation. Do not start a second worker against the
same database or worker directory.

From the repository package directory, build and start the runner:

```powershell
npm ci
npm run build
npm run installation -- run
```

Keep the runner in the foreground under the host's service manager. It starts the
web process and one worker only after SurrealDB is ready and the protected ring
can decrypt all stored Organization secrets. Set the service manager's working
directory to this package. `npm run installation -- status` reports process
health, restore hold, and most recent backup/drill result. `npm run installation
-- stop` drains and stops the web and worker processes through their local IPC
protocol.

Set `FACTORY_MAINTENANCE=true` for restore or operator maintenance. In this mode
the web service refuses Factory operations and `scripts/worker.ts` exits before
connecting to SurrealDB or claiming worker ownership.

## Backup and monitoring

Temporary service interruption during backup is accepted for the MVP. Agree a
maintenance window and measure complete backup duration and web/worker
interruption until service is available again in the chosen environment. Agree
and record a maximum total interruption and operator response before Issue 12
closes. `FACTORY_BACKUP_TIMEOUT_MS` defaults to five minutes per phase; it does
not cap total interruption. Verify service return, and configure alerting and
operator action for an exceeded limit or failed shutdown/restart.

Run a backup at least once every 24 hours. Configure the host scheduler to invoke
the public command below daily and to alert on a nonzero exit code. `status`
reports `overdue` after 24 hours without a completed recovery point; monitor this
value alongside SurrealDB and process health. A healthy web/worker process does
not prove a recent recovery point.

```powershell
npm run installation -- backup
npm run installation -- status
```

The coordinator pauses new worker dispatch, lets active AI/provider work finish,
waits for the worker tick and dispatch race to close, then cleanly stops the
worker and verifies its owner and lock are gone. It gracefully drains the built
web process and closes the Factory Store before capture. It exports SurrealDB
through the pinned HTTP export endpoint using in-memory authorization, then
captures the closed LibSQL workflow database, Artifact content, and verified
protected key ring with a hash manifest. No export SQL, authorization header,
bootstrap credential, or root key is written to logs or bundle metadata.

Only a fully written and verified recovery point is marked successful. A timeout
or copy/verification error leaves a failed status, removes incomplete staging
output, and never creates a successful bundle. If either process failed to stop
cleanly, leave the installation stopped for operator recovery. The runner keeps
all valid bundles by default, meeting the minimum 30 daily points without
speculative pruning or key deletion. Preserve every root-key version needed by
retained ring exports in separate protected custody.

The existing key-ring activation gate remains in force: verify a protected ring
backup before activating a new encryption key. The daily recovery bundle must
include a compatible protected ring export and verify coverage of every key
identifier required by the database.

## Restore and recovery hold

Restore a bundle only into a fresh, isolated SurrealDB target and new worker,
Artifact, and ring paths. Configure the target database and protected root key
from operator custody. The target must not share active paths with the source.
SurrealDB imports apply statements incrementally; if import or any validation
fails, discard the entire fresh target and start again with a new target.

```powershell
npm run installation -- restore <bundle-directory>
npm run installation -- status
```

Restore verifies all manifest hashes before extraction, rejects overwrite and
path traversal, validates Artifact content, opens and closes the restored
LibSQL store, authenticates the encrypted ring metadata and checks its key
coverage, and verifies secret decryption without printing plaintext. It does not
generate replacement keys over restored data. Successful restore writes a
durable hold ledger into the new worker directory. The web stays in maintenance
and `scripts/worker.ts` refuses to connect or claim ownership while the ledger
has not been activated, even if an operator starts the worker directly.

Before activation, inspect Workflow Run and cancellation ownership, AI call
reservations, publication attempts, retained Artifact access, and provider
evidence for the selected recovery point. A recovery point may predate provider
effects, credential revocations, or report-share use. The restore ledger keeps
human waits and read-only publication reconciliation available after activation.
Other dispatchable runs stay held until each receives an explicit disposition.
Use `recovery-list` to inspect run identifiers and statuses, then set `hold`,
`resume`, or `reconcile` for each listed run. `resume` requires the operator to
have reconciled possible AI/provider effects first. `reconcile` is allowed only
for a queued publication and changes it to the existing read-only provider
evidence path; it does not authorize a POST. A queued/pre-dispatch status and
`dispatchAuthorized: false` do not prove that no later provider effect happened.
Never blindly replay work from an older point.

The worker also skips automatic review starts from restored external observations
recorded at or before the activation timestamp, including when a recovery point
contains the observation but lacks a later automatic-start receipt. New
observations recorded after activation continue through the existing ingestion,
ownership, and deduplication rules.

This is an accepted MVP limitation: a legitimate observation that never started
a Run may remain unperformed. `recovery-list` lists existing Runs and does not
provide an inventory of those observations. The later recovery redesign is
tracked in [Issue 18](../../.scratch/factory-mvp/issues/18-redesign-durable-recovery.md).
Existing Run durability remains required. Ordinary restarts preserve human waits
and completed results; interrupted execution follows the
[conservative manual-recovery procedure](durable-private-reviews.md#consumption-and-recovery)
without automatically replaying uncertain AI/provider effects.

The unresolved ownership startup failure is tracked separately in
[Issue 17](../../.scratch/factory-mvp/issues/17-diagnose-worker-ownership-recovery.md)
and blocks acceptance of the affected recovery scenario. Do not treat later
passing repetitions as a diagnosed correction or bypass a live ownership guard.

```powershell
npm run installation -- recovery-list
npm run installation -- recovery-run <run-id> hold
npm run installation -- recovery-run <run-id> resume
npm run installation -- recovery-run <run-id> reconcile
npm run installation -- activate --confirm-reconciled
```

Activation requires the explicit operator confirmation, a verified key ring,
an explicit disposition for every potentially dispatchable run, and no
unresolved source worker owner or lock. A retained human wait remains bound to
its original Workflow Run and resumes only after checks and activation.
For a crash-point image containing ownership markers, confirm the old process and
sandbox cannot still act, then use the existing host/path-bound worker recovery
procedure. Never transplant a source worker lock into the restored installation
or clear a live owner automatically.

## Monthly restore drill

Schedule a monthly drill against the newest successful recovery point. The drill
restores to a fresh isolated database and new file paths, verifies the complete
bundle and key-ring coverage, opens the restored LibSQL database, and records a
non-secret result in installation status. A failed or overdue drill must alert
through the host scheduler. Remove only the isolated drill target after its
result is recorded; keep the source bundle.

```powershell
npm run installation -- drill
npm run installation -- status
```

Record the measured local drill duration and recovery-point timestamp. This local
result demonstrates the procedure on this host; it is not a production recovery
time objective and does not provide disaster recovery from loss of the host.
