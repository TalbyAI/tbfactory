# Key-ring backup and recovery plan

Status: Accepted initial backup policy and operational procedure, confirmed with the concrete design on 2026-10-03 in [Create an authenticated, Organization-scoped Work Item](../../.scratch/factory-mvp/issues/02-authenticated-organization-work-items.md#comments). Manual backup/rotation/restore tooling and a real persistent database restore drill were delivered on 2026-10-03; see the [runbook](authenticated-work-items.md) and [delivery evidence](../../.scratch/factory-mvp/evidence/authenticated-organization-work-items.md). Production scheduling, the independent recovery destination and measured recovery-time objective remain installation responsibilities.

## Responsibility and recovery material

The installation operator owns backup configuration, recovery access, root-key custody, monitoring, and restore drills. The application owns key-ring generation, versioning, protected export, and rotation. This plan does not require a managed secret service or a particular storage vendor.

Recovery needs three compatible components:

| Component | Backup contents | Custody |
| --- | --- | --- |
| Factory database | A consistent supported SurrealDB backup, including encrypted secrets and their key identifiers | Operator-managed backup destination |
| Key ring | A consistent encrypted export containing all required key versions and non-secret format/version metadata | Backup storage outside the active installation's host and volumes |
| Root key | Each root-key version needed to open retained ring backups | A separately controlled protected recovery location, outside the database/ring backup bundle |

The backup destination must be configurable for self-hosted deployments. It may be an operator-controlled remote filesystem or object store. A second directory or volume on the same host is not the disaster-recovery copy. Backup credentials must not depend solely on secrets recoverable only through the lost installation; the operator needs an independent recovery access path.

Ring exports must retain their cryptographic integrity protection and key identifiers. Backup metadata identifies the installation, format, creation time, ring generation, required root-key version, and covered key identifiers. It contains no plaintext secrets or key material. Successful restoration must verify this metadata against the authenticated ring contents rather than trust an editable manifest alone.

## Accepted initial backup policy

- Back up a new key-ring generation and verify its protected export before activating a new encryption key or writing durable data that requires it. Apply this gate at initial setup and every key-ring change. If the backup cannot complete, do not activate the new key; existing operations may continue with the previously valid active key.
- Take a consistent database backup at least every 24 hours, accompanied by a compatible ring generation or a verified reference to an already retained compatible ring backup.
- Retain daily database recovery points for at least 30 days. Keep all ring and root-key versions required by every retained recovery point, regardless of this minimum period. Account for any independent longer-lived database backups before deleting keys.
- Keep copies outside the active installation and restrict access to authorized operators. Separate custody of the root key from access to the database/ring bundle; do not include it in application logs, source control, images, or the bundle itself.
- Verify backup completion and alert on failed or overdue jobs. Record timestamps, generation identifiers, integrity-check results, and failure status without logging secrets.
- Exercise restoration at initial installation, monthly, and after changes to key formats, backup mechanisms, root-key protection, or deployment storage.

The accepted daily database backup policy implies an initial recovery-point objective of at most 24 hours of data loss when backups complete successfully. Monitor failures against that objective. The ring policy prevents newly activated key versions from depending on an unbacked-up ring; it does not eliminate database data loss. A recovery-time objective cannot be promised before installation size and restore performance are measured.

## Backup and rotation procedure

1. Prepare a protected, consistent ring export without exposing plaintext keys. Concurrent rotation must not produce a partially written export or an ambiguous generation.
2. Write the export and non-secret metadata to a staging object at the configured recovery destination; validate integrity and recoverability before marking the backup complete.
3. At setup or rotation, make the new generation active only after that verification. Do not persist secrets under a key whose required recovery material has not been verified.
4. For each database recovery point, verify that a retained ring contains every key identifier required by that database. Retain a link to the compatible ring generation and required root-key version.
5. Preserve old keys while live data or retained backups need them. Re-encrypting live secrets does not establish that older backups no longer require old keys.
6. Treat root-key changes separately from ordinary encryption-key rotation. Verify recoverability under the new root protection, and retain the old root recovery material for backups that still require it.

## Restore procedure

1. Select a database recovery point and its compatible ring backup. Obtain the referenced root-key version from the separate recovery location.
2. Restore into an isolated installation with outbound provider and AI Activities disabled. Keep the web/worker processes from executing normal work until checks complete.
3. Restore SurrealDB through its supported consistent recovery mechanism. Restore the encrypted ring to its persistent volume and mount the root key through the deployment's protected secret/file mechanism.
4. Verify ring integrity, installation identity, supported format, and coverage of every key identifier required by restored secrets. Verify decryption without printing plaintext values. Include both current and retained key versions where the recovery point requires them.
5. Verify Organization boundaries and that web and worker processes can use the same restored key generation. Exercise authorized reads with two Organizations and rejection of cross-Organization access.
6. Reject a missing, incorrect, corrupted, or incompatible ring/root key with an explicit recovery error. Do not create replacement keys over restored data. Diagnose missing recovery material before retrying.
7. Record the recovery point, checked key versions, restore duration, and results without secrets. Enable normal operations only after checks pass. Workflow recovery and external-Activity reconciliation must additionally follow the contracts owned by [Operate the persistent shared installation](../../.scratch/factory-mvp/issues/12-persistent-shared-installation.md).

## Verification and delivery ownership

[Create an authenticated, Organization-scoped Work Item](../../.scratch/factory-mvp/issues/02-authenticated-organization-work-items.md) must deliver the protected ring export/recovery contract and a runnable restore check for encrypted Organization secrets, including rotation, missing keys, and restart persistence.

[Operate the persistent shared installation](../../.scratch/factory-mvp/issues/12-persistent-shared-installation.md) must wire the configurable recovery destination, scheduled database backups, monitoring, recovery access, and deployment runbook, then exercise restoration with the deployed stores and processes. The initial Work Item increment still requires a usable protected export and manual recovery path; production scheduling is not a reason to omit it.

## Evidence and unresolved policy

The [primary-source investigation](../../.scratch/factory-mvp/research/identity-contracts.md#persistent-application-managed-key-ring-in-a-node-runtime) links Node.js, OWASP, and NIST guidance. Those sources support key-lifecycle, integrity, retained decryption keys, and independent recovery custody requirements; they do not select this installation's backup cadence or retention.

The daily/30-day/monthly policy and the concrete procedures are accepted. Choose the actual destination and recovery-time objective when the installation environment is known. This plan must not be described as an implemented or tested backup system until its delivery checks pass.
