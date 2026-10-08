# Docker MVP evaluation evidence

## Selected environment

The User selected this evaluation on 2026-10-07 and is the responsible operator.
Codex executed the checks on their behalf on `DESKTOP-34DS59F`, using Docker Desktop
Engine 29.5.3 and Compose 5.1.4. Implementation is on
`integration/factory-mvp-acceptance`. The evaluated application revision is
`29ee73cdec7f18ec63dd197512554c60438171e5`; final package results are recorded below.

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

Available access is local to this PC: Docker Engine/Compose commands, the Factory
at `http://127.0.0.1:18030`, evaluation OIDC as `alice@example.test`, and the
SMTP4Dev inbox at `http://127.0.0.1:18085`. The fixture identity has Membership in
`alpha` and `beta`. The mock recipient is `operator@example.test`. No external
hosting account, production provider/AI credential, live SMTP relay, or off-host
recovery access is required or claimed for this evaluation. Protected root-key
material stays in its separate Docker volume; its bytes are not in this report.

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

On 2026-10-08, the operator accepted backups at any time while the PC is running,
a two-minute maximum total backup window, and a five-minute recovery-time
objective for this evaluation. The scheduler configures
`FACTORY_BACKUP_MAX_TOTAL_MS=120000`; the recovery-time objective is an operator
target and does not authorize automatic activation or replay.

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

The executed checks below supplement the initial installation evidence.
The operator accepted the measured evaluation limits on 2026-10-08.
The dedicated same-host volumes do not demonstrate host-loss recovery,
30 elapsed days of backup history, or real deployment acceptance.

## Executed recovery, Board, and scheduler checks

On 2026-10-07, the controlled provider durably saved one publication effect and
then dropped its response. Factory recorded an uncertain outcome. The complete
backup command took `7396 ms`, sampled web interruption was `1725`–`1944 ms`,
and the subsequent restore drill took `3929 ms`. Factory, SurrealDB, and the
provider boundary were restarted. An immediate login during startup failed;
after readiness, the ordinary OIDC login and retained identities were available.

Factory's public reconciliation gathered positive provider evidence, rejected a
duplicate retry, and accepted an explicit completed resolution with
`confirmedStopped: true`. The provider retained exactly one effect. No additional
AI request occurred during this recovery. The provider boundary's in-memory
request counters reset when its container restarted; the persistent effect journal
and Factory Facts supplied the retained-effect evidence. These controlled checks
do not establish exactly-once behavior at a production provider.

The alpha Work Item remained `ready-for-review` after the Review Workflow and
publication completed. The User interface separately requested the Review
Finalization Workflow. That Workflow Run completed and moved Factory state to
`completed`, retaining the original report, Review Decision, publication, and
state-flow version. It survived the later service recovery.

Authenticated GitHub and Azure DevOps observations after restart appended Facts
to distinct new Work Items. Repeated deliveries reused the same Work Item and
Fact identities without changing Factory state. On the Kanban Board, the new
GitHub Review Intake Workflow waited for missing Git inputs, blocked competing
transitions, and released ownership only after worker-confirmed cancellation.
The two original reports remained private and retained their identities.

Nonsecret receipts are `.runtime/docker-ingestion-evidence.json`,
`.runtime/docker-board-cancellation.json`, `.runtime/docker-board-finalization.json`,
`.runtime/docker-uncertain-backup-measurement.json`, and
`.runtime/docker-evaluation/uncertain-publication-acceptance.json`.

The installed scheduler's public backup and drill commands both succeeded.
Under concurrent test load, their complete command receipts recorded `14210 ms`
and `6949 ms`. The daemon runs the daily cadence and calendar-monthly drill,
polling once per minute. The dedicated volume retains all valid bundles and
compatible key versions; no pruning is configured. This verifies retention
configuration, not thirty elapsed days of history. Docker and the PC must remain
running for scheduled operation. Successful job and resolved incident receipts
are in `.runtime/docker-scheduler-success.json`.

A one-shot negative check used `FACTORY_BACKUP_MAX_TOTAL_MS=100`. SMTP4Dev accepted
the window alert at `1791388367255`, before the backup completed at
`1791388374389`. The command succeeded after `7375 ms`; the alert did not cancel
the operation or clear ownership. The threshold was confined to that test and
was unset in regular operation during that check. On 2026-10-08 the operator
accepted two minutes and the regular Compose setting became `120000` ms.

Forcing only the web child to exit left the worker running. The public status
reported `web: false`, the health helper returned failure, and SMTP4Dev accepted
the child-service alert. Conservative shutdown then stopped the worker but
refused the already-dead web's graceful-close claim. The operator check confirmed
zero worker owners and no worker lock before forcing the remaining coordinator
to stop. Its stale Unix control socket was removed while Factory was stopped;
ownership records were not removed. This exposed the startup regression addressed
by the final review correction. Record its automated regression and fresh live
recovery check with the accepted revision.

SMTP4Dev displayed eight captured messages, including the original failed/overdue
checks, the pending-backup window alert, child-service failure, and a new
coordinator outage during this negative exercise. Every message was addressed to
`operator@example.test` and remained unrelayed. Recovered-service checks reported
no active incidents. Evidence is `.runtime/docker-child-health-evidence.json`
and `.runtime/docker-final-mail.json`.

## Final integration review and verification

The two-axis review compared `9cdaeb6...48a48ae`. One implementer corrected every
finding in `29ee73c`, together with the independently reproduced stale Unix
control socket regression. The historical Issue 17 remains undiagnosed.

### Standards review

The review checked repository instructions, accepted domain and architecture
decisions, and the full Fowler code-smell baseline. It found three shorthand
domain terms and a small duplicated failed-job incident branch. The correction
uses the canonical Workflow Run term and shares the failed-job incident helper.
No other standards finding was reported.

### Specification review

The review found that a failed backup could wait another full daily interval
before retry, and that a restore hold suppressed web-process failure as well as
the expected worker absence. Failed or stale-running jobs now retry every five
minutes. Coordinator status retains the last successful capture point through
later attempts and uses it for recovery-point age. An unactivated restore hold
permits an absent worker while still requiring the maintenance web process.
Scheduler regression checks passed `15/15`; the public coordinator test passed
`1/1` against a separate test namespace. These changes do not guarantee a daily
recovery point during persistent failure or host downtime.

### Additional startup correction

Linux startup refuses a live control socket and removes only a proven stale Unix
socket. It never removes worker ownership records or locks. The fresh final Docker
image passed the Linux socket regression `1/1`, with no skip. This tests active
listener refusal, recovery after a killed listener, rebinding, and unchanged
ownership markers. Evidence is `.runtime/docker-final-linux-socket-test.log`.

The rebuilt image is
`sha256:42ae3f8516dd8b41d18a55e1c3c8152ff4a70e70ded53e85b48370e633f6b231`.
After cleanly stopping the Factory, a disposable listener left a stale control
socket in the recovery volume. Ordinary Compose startup recovered it without
operator deletion and became healthy in `16153 ms`. Web and worker were live;
public OIDC retained both Organization identities. Evidence is
`.runtime/docker-final-startup-check.json`.

On this image, the installed public scheduler commands completed backup in
`7021 ms` and drill in `5491 ms`. The coordinator retained capture point
`1791390894932` and its `lastSuccessful` receipt. A health check had no active
incident or delivery attempt; the scheduler daemon resumed and the inbox stayed
at eight unrelayed messages. A fresh browser navigation confirmed the completed
alpha Work Item, original report and Workflow Run identities, separate completed
finalization, private Artifact `200`, and cross-Organization denial `404`.
The boundary still retained one provider effect and received no additional AI
request. Receipts are `.runtime/docker-final-scheduled-backup.log`,
`.runtime/docker-final-scheduled-drill.log`, `.runtime/docker-scheduler-success.json`,
and `.runtime/docker-final-board-verification.json`.
Beta also retained its original private report and completed Review Workflow,
with two retained consumption records and no publication. Its receipt is
`.runtime/docker-final-beta-verification.json`.

The second full-suite invocation was interrupted after worktree cleanup followed
a dependency junction and damaged the shared host `node_modules`. A focused check
reported missing `@ai-sdk/provider-utils-v6`. Reinstalling from the unchanged
lockfile restored dependencies; the affected positive-provider-evidence check
then passed `1/1`. This invocation is not a passing product suite. Its log is
`.runtime/factory-mvp-docker-tests-aborted-dependencies.log`; the subsequent check
is `.runtime/docker-restored-dependencies-check.log`.

### Final package results

The fresh complete suite on application revision `29ee73c` exited successfully:
`197` tests, `196` passed, `0` failures or cancellations, and `1` expected Windows
skip, in `1471961 ms`. The skipped Unix socket case passed separately in the
final Linux Docker image (`1/1`, no skips). The suite used the separate persistent
test container `tbfactory-mvp-tests-db`, endpoint `ws://127.0.0.1:18000/rpc`, and
namespace `docker_acceptance_suite`; it did not use the evaluation database.
The complete log is `.runtime/factory-mvp-docker-tests.log`.

Fresh `npm run typecheck`, `npm run build`, Docker image build, formatting checks,
and `git diff --check` passed. Their receipts are
`.runtime/docker-final-typecheck.log`, `.runtime/docker-final-build.log`,
`.runtime/docker-final-image-build.log`, and
`.runtime/docker-evidence-format-check.log`. Local link/heading checks cover all
11 affected Markdown files and all 70 User Story IDs without a missing source
or anchor. The final documentation commit changes no evaluated application code.

### Operator acceptance — 2026-10-08

The evaluation is running with persistent volumes and the scheduler daemon.
The User remains the operator and accepted the two-minute total backup window,
an unrestricted window while the PC is running, and the five-minute evaluation
recovery-time objective. Issue 12 and the parent specification close for the
User-selected Docker evaluation. The regular backup-window threshold is `120000` ms.
Same-host volumes
and this small dataset do not establish host-loss recovery, thirty elapsed days
of history, or production recovery estimates. Independent recovery access and
off-host root-key custody remain prerequisites before real deployment. Issue 17
remains suspended and undiagnosed; Issues 16 and 18 remain explicitly deferred.

### Accepted configuration verification — 2026-10-08

The scheduler container was recreated with `FACTORY_BACKUP_MAX_TOTAL_MS=120000`.
Its environment was checked without printing secrets. The first attempted backup
failed while Factory was unhealthy. The container had started on 2026-10-08,
but retained the earlier worker owner and lock for PID `280`, host
`tbfactory-evaluation`, and directory `/var/lib/factory-workflows`. No worker
process was present and the recorded PID was independently verified absent.
The existing `worker-recover-lock` operator command verified that identity and
recovered the stopped owner; no ownership marker was deleted manually. Ordinary
Factory restart then became healthy. This is runbook recovery, not a diagnosis
or correction of historical Issue 17, and the preceding shutdown cause is unknown.

A complete backup with the accepted limit succeeded in `6901 ms`, below
`120000 ms`. The scheduler check returned `active: []` and `attempted: []`; its
daemon resumed. Public OIDC retained `alpha` and `beta`. Evidence is
`.runtime/docker-accepted-limits-owner-recovery.log`,
`.runtime/docker-accepted-limits-backup.log`, and
`.runtime/docker-accepted-limits-check.log`. Existing exceeded-window alert
verification and the unchanged application's full-suite results remain valid.
