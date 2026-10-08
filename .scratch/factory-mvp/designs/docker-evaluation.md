# Docker evaluation installation

Issue: [12](../issues/12-persistent-shared-installation.md).

## User-selected evaluation scope — 2026-10-07

The User selected the current Windows PC as the MVP evaluation host. The Factory
and its dependencies run in Docker, and the User is the installation operator.
Backups use a dedicated Docker volume. SMTP4Dev captures notification email for
the operator; no external mail delivery is part of this evaluation.

This updates the previously provisional native Node installation choice. The
earlier local results remain historical evidence. A backup volume on this host
validates capture, persistence, integrity, and isolated restore, but does not
demonstrate recovery after loss of the host. Independent recovery storage and
separate off-host root-key custody remain requirements before a real deployment.

## Runtime and persistence

Reuse the delivered installation coordinator inside the Factory container. It
starts the built TanStack Start web server and Mastra worker as separate
processes, retaining their existing IPC drain and backup protocol. Docker Compose
starts the Factory, SurrealDB, controlled evaluation identity boundary, SMTP4Dev,
and operational scheduler. This preserves ADR 0010's separate execution process;
it does not require splitting the coordinator's child processes into containers.

Use named volumes for Factory data, LibSQL Workflow storage, Artifact content,
the protected key ring, backup bundles, and the mock inbox. Keep root-key material
in a separate volume mounted read-only by the Factory and excluded from backup
bundles. Initialize only missing evaluation material, and verify existing data
on subsequent starts. Do not recreate keys over restored or retained data.

Expose browser endpoints only on host loopback. The trusted worker container
needs Docker access to create the existing restricted review sandboxes. Agent
sandboxes retain their isolation policy and do not receive the Docker socket,
Factory volumes, or credentials. Use a stable Factory hostname and storage paths
to retain the existing host/path-bound ownership checks. A restart must not
silently clear a worker owner or lock.

The controlled identity boundary is separate from application authentication.
The evaluation uses the existing public OIDC flow and Factory Membership checks;
no application login bypass is added. Controlled source-provider and AI boundaries
remain the accepted repeatable verification seam.

## Operational jobs and alerts

Install daily backup, monthly restore-drill, and periodic health-monitoring jobs
in the Docker stack. Jobs invoke the existing installation commands through its
control socket. They must not overlap or mark a failed capture as successful.
Retain at least 30 daily recovery points and every compatible key version; the
initial evaluation can verify retention configuration without pretending that
30 days have elapsed.

Deliver failed and overdue backup/drill alerts to SMTP4Dev. Verify message receipt
in the mock inbox, including retry when SMTP is unavailable. Email contains
nonsecret operational summaries; neither secrets nor backup contents are sent.

## Verification and remaining decisions

Execute startup and graceful container restart, reject a second worker, and verify
retained data and run identities. Exercise a complete backup and isolated restore,
integrity and encrypted-secret checks, two-Organization boundaries, retained
human waits and definitions, restore hold, and explicit activation. Preserve
completed provider effects and conservative recovery of uncertain AI outcomes.

Exercise installed jobs and captured failed/overdue alerts. Measure complete
backup duration, service interruption, and restore duration on this host. The
operator agrees the interruption limit and recovery-time objective after those
measurements; do not infer those limits from per-phase timeouts.

Record executed results against the accepted revision and update the
[requirement-to-evidence index](../spec.md#requirement-to-evidence-index). Issue 17
remains open and suspended; no diagnosis or correction is claimed. Issue 16 and
the broader recovery redesign in Issue 18 remain deferred.

## Implementation order

1. Containerize the existing runner and bootstrap the evaluation dependencies and
   persistent volumes without overwriting retained material.
2. Add the operational scheduler and SMTP delivery, with focused public-behavior
   red/green verification.
3. Integrate both increments, start the stack on this PC, and verify Docker runtime,
   backup, restore, jobs, and mock inbox behavior.
4. Run package checks and the two-axis review, record measured limits and evidence,
   and close only acceptance gates supported by executed results.
