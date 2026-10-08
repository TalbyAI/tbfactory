# Docker evaluation installation

This Compose stack runs TBFactory and its local evaluation dependencies on the
current PC. It is a local MVP evaluation, not a production deployment or an
independent disaster-recovery copy. SurrealDB, the OIDC fixture, SMTP4Dev, and
the TBFactory image are pinned. App, worker, Artifact, key-ring, backup, root-key,
and mock-inbox data use separate named Docker volumes.

Docker Engine with Docker Compose is required. The Factory container uses the
Docker socket only for the existing trusted review-sandbox integration. Agent
sandbox containers receive no socket, Factory volume, or credentials. The
Factory's host/path-bound ownership identity uses the stable hostname
`tbfactory-evaluation` and fixed volume paths. Recovery bundles live at
`/var/lib/factory/recovery`; its named volume also provides a writable parent
for temporary restore-drill directories.

From the repository root, start the stack:

```powershell
docker compose -f docker/evaluation/compose.yaml up --build --detach
docker compose -f docker/evaluation/compose.yaml ps
```

Open [http://127.0.0.1:18030](http://127.0.0.1:18030) and sign in through the
evaluation OIDC provider as `alice@example.test`. Alice is provisioned in the
`alpha` and `beta` Organizations through the existing provisioning contract.
The identity provider is available to the browser on
[http://127.0.0.1:18081](http://127.0.0.1:18081). A loopback bridge in the
Factory container forwards requests to the isolated OIDC service, so the
application keeps its loopback-only HTTP OIDC allowance across Factory
container restarts. The SMTP4Dev inbox is at
[http://127.0.0.1:18085](http://127.0.0.1:18085); scheduled mail is captured
locally and is not relayed.
The repeatable review boundary is available on loopback at
[http://127.0.0.1:18082](http://127.0.0.1:18082). A separate named volume
retains non-secret publication-effect evidence outside Factory recovery bundles.

Check the public login and Organization flow from the repository root:

```powershell
node docker/evaluation/check-operator-login.mjs
```

The output contains only the fixture identity and Organization names/IDs. Repeat
it after restarts to confirm the same Organization identities remain available.

The Factory coordinator supervises the built web process and Mastra worker. A
container stop sends the normal termination signal and allows twelve minutes for
graceful shutdown. The coordinator keeps its worker owner and lock safeguards;
it does not clear stale ownership markers automatically. The Docker CLI and
socket allow the trusted Factory worker to build the pinned repository sandbox
image and create isolated review sandboxes.

If a child exits unexpectedly, graceful coordinator shutdown can refuse to
finish. Check `installation.ts status` and verify that both child processes are
absent, the database has no `worker_owner` record, and the worker directory has
no `worker.lock` before force-stopping the coordinator or container. Do not
delete either ownership marker to make shutdown proceed. If a marker remains,
keep the coordinator available and follow the worker recovery procedure. On
Linux, coordinator startup probes an existing Unix control socket before reuse:
it refuses an active listener and removes only a confirmed stale socket path.
This recovery does not change worker ownership markers.

During an unactivated restore hold, the maintenance web process remains live and
only the worker's absence is expected. Scheduler incidents and Docker health
checks still report an unavailable web process.

Operational jobs run in the scheduler container after the Factory is healthy.
It shares only the backup/status volume and does not receive the root-key volume,
database credentials, or Docker socket. It runs the normal scheduled backup
startup path and then follows the configured daily backup and monthly restore
drill intervals. The evaluation backup cadence is slightly under 24 hours so
scheduler polling and capture time fit within the 24-hour recovery-point
objective. Failed or stale-running jobs retry every five minutes by default;
`FACTORY_SCHEDULE_RETRY_INTERVAL_MS` can configure that interval. This margin
cannot guarantee a 24-hour recovery point if the PC or scheduler is offline or
backups keep failing. Status and overdue alerts use the most recent successful
`recoveryPointAt`, so operators can respond before it passes 24 hours. Use the
public scheduled commands for a local evaluation:

```powershell
docker compose -f docker/evaluation/compose.yaml exec scheduler node --import tsx scripts/installation-schedule.ts backup
docker compose -f docker/evaluation/compose.yaml exec scheduler node --import tsx scripts/installation-schedule.ts drill
docker compose -f docker/evaluation/compose.yaml exec factory node --import tsx scripts/installation.ts status
```

SMTP4Dev captures failed or overdue job notices for inspection. The stack does
not automatically run a negative alert check during ordinary startup.

On 2026-10-08, the operator accepted backups at any time while the PC is running,
a maximum total backup window of two minutes, and a recovery-time objective of
five minutes for this evaluation. The scheduler configures
`FACTORY_BACKUP_MAX_TOTAL_MS=120000`. The recovery-time objective is an operator
target, not an automatic activation or replay deadline. The backup
limit measures the full command through service return, not a per-phase timeout.
An exceeded-window notice is sent while a backup is still running; it does not
cancel the backup or clear ownership. Inspect status and follow the recovery
procedure if the service does not return.

Restart the Factory to exercise the same persistent stores:

```powershell
docker compose -f docker/evaluation/compose.yaml restart --timeout 720 factory
node docker/evaluation/check-operator-login.mjs
```

The database can also be restarted independently around a retained human wait.
Record the Workflow Run identity and expected wait before restart, then verify it
through the public Factory flow after service recovery. A completed scheduled
backup and restore drill can be checked in the SMTP4Dev inbox and in the
installation status. The recovery volume retains successful bundles; the stack
does not prune them.

Stop containers while retaining all evaluation data with:

```powershell
docker compose -f docker/evaluation/compose.yaml down
```

Do not use `down --volumes` when retaining evaluation data. The separately
mounted root-key volume is read-only in the Factory container and is not included
in backup bundles. The named backup volume and root-key volume are on this host;
they do not satisfy independent recovery access or separate off-host root-key
custody. The Docker evaluation therefore does not establish disaster recovery,
30 elapsed days of backup history, or production acceptance.
