# Docker MVP evaluation evidence

## Selected environment

The User selected this evaluation on 2026-10-07 and is the responsible operator.
Codex executed the checks on their behalf on `DESKTOP-34DS59F`, using Docker Desktop
Engine 29.5.3 and Compose 5.1.4. Implementation is on
`integration/factory-mvp-acceptance`. Record the accepted code revision and final
package checks after integration verification finishes.

The [evaluation contract](../designs/docker-evaluation.md) and
[Docker runbook](../../../docker/evaluation/README.md) describe the installation.
Factory, its separate web and worker processes, SurrealDB, embedded LibSQL storage,
OIDC, controlled Git/provider/AI boundaries, scheduler, and SMTP4Dev execute in
containers. The acceptance drivers and collaborative browser operate from the
host against the public interfaces.

Only loopback ports are exposed: application `18030`, OIDC bridge `18081`,
controlled boundary `18082`, and SMTP4Dev inbox `18085`. SurrealDB has no host port.
The Factory hostname is stable, and the existing single-worker ownership guard
remains enabled. The trusted Factory worker can use the Docker socket; its review
sandboxes receive no Factory volumes or Docker socket.

## Executed installation checks

| Check | Observed result |
| --- | --- |
| Startup and root-key reuse | Pinned images start in dependency order. Repeating initialization preserves the existing 32-byte root key with mode `0400`; its Factory mount is read-only. No key bytes or digest were recorded. |
| Public OIDC access | Alice signs in through the ordinary OIDC code/PKCE flow and sees the persistent `alpha` and `beta` Organization identities before and after Factory container restart. |
| Exclusive worker | Starting a second worker inside the Factory container exits with the existing database-owner rejection; the original installation remains healthy. |
| Two retained Reviews | Real containerized workers launch restricted Docker sandboxes, fetch the bound Git commits, and exchange actual read/changes tool results with the controlled AI boundary. Alpha and beta retain separate private reports and human Review Decision waits. |
| Factory and database restart | The same Work Item, Workflow Run, report, output, and wait identities remain available after Factory recreation and SurrealDB restart. The immediate request during database startup returned `500`; after database readiness the authenticated check passed. |
| Access and revocation | An alpha API credential can read its private report (`200`), is denied beta's report (`404`), and receives `401` after revocation. The same revoked credential is denied by the isolated restored installation. Tokens are kept in memory and excluded from evidence. |
| Isolated restore and activation | A fresh SurrealDB namespace and fresh Docker volume restore the bundle with the separately mounted root key. Maintenance returns `503`. Activation without per-run dispositions is refused. Two retained Workflow Runs receive explicit `hold` dispositions; activation preserves their identities and private reports without AI or provider replay. |

The nonsecret initial receipt is
`.runtime/docker-evaluation/review-acceptance.json`. The restored target's evidence
is `.runtime/docker-private-credential-recovery.json` and
`.runtime/docker-isolated-restore.json`. The root key is excluded from recovery
bundles. Database credentials and generated API/session secrets are not included
in these records.

## Recovery measurements

These measurements use the small evaluation dataset and the current PC. They are
observations, not agreed limits or production recovery estimates.

| Operation | Measured result |
| --- | --- |
| Bootstrap backup | Complete public command: `7237 ms`; sampled web interruption between `1630` and `1845 ms`. |
| Backup with two waiting Reviews | Complete public command: `10829 ms`; sampled web interruption between `2309` and `2524 ms`. |
| Backup retaining credential revocation | Complete public command: `7026 ms`; the complete bundle includes the protected ring and encrypted Organization secrets. |
| Restore drill | `3318 ms`, including integrity, key coverage, secret decryption, persistent Workflow snapshots, Artifact verification, and durable restore hold. |
| Isolated restore | `4085 ms` for restore; `28303 ms` including separate CLI inspection, explicit dispositions, container startup, and activation. |

Web sampling uses a nominal `100 ms` interval with a `2000 ms` request timeout.
The recorded bounds bracket observed responses; they do not measure every worker
dispatch pause. Complete backup command duration includes drain and service return.
Samples are in `.runtime/docker-backup-measurement.json`; the earlier bootstrap
sample is `.runtime/docker-bootstrap-backup-measurement.json`.

Operator agreement on the maximum backup window, permitted schedule window, and
recovery-time objective remains pending. Codex proposed two minutes for the total
backup window and five minutes for recovered service after these measurements;
the proposal is not an accepted setting.

## Delivered alert evidence

SMTP4Dev captured messages for `operator@example.test`, from
`factory@example.test`, without relay:

- `Restore drill failed`: a real initial drill failed because an empty Artifact
  directory was absent from its bundle. The regression now creates both component
  directories and a subsequent drill passed.
- `Restore drill is overdue`: no successful drill existed after that failed attempt.
- `Installation coordinator is unavailable`: the Factory container was deliberately
  stopped for the negative check.
- `Backup failed`: the scheduled public backup command failed while that coordinator
  was stopped and recorded a durable failed job receipt.
- `Backup recovery point is overdue`: controlled injection of an old timestamp into
  the operational health receipt exercised the overdue condition. The receipt was
  restored afterward; no database, bundle, Fact, or Workflow was modified.

For the overdue backup check, SMTP4Dev was deliberately stopped. The scheduler
recorded one delivery failure and no `deliveredAt`. After SMTP4Dev restarted,
the same incident retained its original timestamp and was delivered. Repeating
the check attempted no delivery and the inbox remained at five messages. These
records are in `.runtime/docker-alert-exercise.json` and
`.runtime/docker-mail-before-retry.json`.

## Integration work and remaining acceptance

The initial empty-store drill exposed a reproducible recovery-bundle defect;
`tests/installation-empty-recovery.test.ts` failed with the missing Artifact
directory before the fix and passed afterward. A separate acceptance-driver
configuration initially used a public GitHub URL with a credential restricted to
the controlled Git boundary. Factory correctly refused it; the driver now appends
an explicit authorized review Fact for the controlled URL. No endpoint or
credential-scope protection was weakened.

The first new full-suite invocation was interrupted after discovering hard-coded
database-container restart targets. It is not a passing full-suite result.
The configured-container helper now verifies endpoint ownership before restart
and waits for database readiness. This fixture correction does not establish the
cause of that invocation's GitHub failure or diagnose Issue 17. Issue 17 remains
open and suspended, with no ownership correction claimed.

Final full-suite checks, explicit uncertain-publication recovery, Board
finalization, installed scheduler receipts, operational window alerting, and
operator agreement on limits remain to be recorded before this evaluation can
be accepted. The dedicated same-host volumes do not demonstrate host-loss
recovery, 30 elapsed days of backup history, or real deployment acceptance.
