# Authenticated Work Item operation runbook

## First installation

Configure `.env.example` values through the deployment's protected secret mechanism.
The root key is exactly 32 random binary bytes, custodied separately from database
and ring backups. Generate it once into a restricted directory (never Git or an image):

```powershell
node -e "require('node:fs').writeFileSync(process.argv[1],require('node:crypto').randomBytes(32),{flag:'wx',mode:0o600})" C:/protected/factory-root.key
node --env-file=.env --import tsx scripts/operator.ts ring-setup
node --env-file=.env --import tsx scripts/operator.ts provision bootstrap.json
```

On Windows, restrict directory/file ACLs to the application identity and authorized
recovery operators; POSIX `mode` alone does not set Windows ACLs. The active ring and
root-key paths must be separately protected. The backup directory must be an independently
mounted remote filesystem with bootstrap access that does not depend on Factory secrets.
A local second directory is suitable only for tests. The operator verifies destination
custody and independence; the application verifies the actual protected write/read and
authenticated content before activating a generation.

Setup refuses existing rings or a database with secrets requiring existing keys. A
missing, malformed, wrong-root or wrong-installation ring is a recovery error. The
web server checks coverage and decryptability before serving Factory operations.

## Manual backup and rotation

```powershell
node --env-file=.env --import tsx scripts/operator.ts secret-check
node --env-file=.env --import tsx scripts/operator.ts ring-export
node --env-file=.env --import tsx scripts/operator.ts ring-rotate
```

Exports include authenticated installation, root version, generation, creation time,
format and covered key identifiers. The application verifies a read-back copy with the
configured root key and compares the authenticated ring before completing backup.
Rotation activates only after verification, retains every previous decryption key,
and uses an exclusive writer lock plus synced temporary-file/rename replacement.
Readers reload the authoritative ring for each encryption/decryption; they do not
activate cached generations. Keep required root versions independently accessible.

`secret-put <protected-json-file>` accepts `organization`, `purpose`, and `value` to
store server-managed encrypted configuration. `secret-check` verifies all stored
secrets without displaying plaintext. No general-purpose public secret-management
UI/API or provider integration is introduced. Ciphertexts use Node.js AES-256-GCM,
fresh 96-bit nonces, key identifiers, and authenticated installation/Organization/purpose.

The installation ticket must schedule database backup at least daily, retain at
least 30 days and run monthly restore drills. Take a consistent SurrealDB 3.3 export
with logging disabled; associate its recovery point with a verified ring containing
all `secret.keyId` values and its root version. Do not retire keys based solely on
live-data re-encryption. Do not delete recovery files automatically in this increment.

## Manual restoration

1. Stop web/worker processes and disable outbound Activities. Select the database
   recovery point, compatible protected ring export and separately held root version.
2. Import the SurrealDB export into an isolated database using SurrealDB 3.3's supported
   `import` command or `/import` endpoint, retaining `OPTION IMPORT`. Check import success;
   large imports can be partial on failure, so discard only the disposable restore
   database and retry from the selected source backup before enabling the application.
3. Configure the restored installation's stable identity, restored database, root-key
   file/version, new ring directory and independently available backup destination.
4. Set `FACTORY_MAINTENANCE=true` and restore:

   ```powershell
   node --env-file=.env --import tsx scripts/operator.ts ring-restore C:/recovery/protected-ring.json
   node --env-file=.env --import tsx scripts/operator.ts secret-check
   ```

5. Restore verifies authenticated metadata and coverage of all database secret key
   identifiers, backs up the restored ring, then writes it and verifies every stored
   secret without printing values. Reject missing/wrong/corrupted recovery material.
   Never run `ring-setup` over restored data.
6. Check two Organizations, denied cross-Organization reads, retained history and both
   current and previous secret keys. Record database recovery point, ring/root versions,
   results and elapsed restore time. Remove maintenance mode and start web/worker only
   after checks pass. Workflow reconciliation remains owned by the installation ticket.

If a process dies holding `writer.lock`, first stop all possible ring writers and
verify the active ring and retained backups. An operator may then remove that exact
lock file. The application never guesses that an existing writer is stale. Failed
backup verification leaves the prior active ring unchanged. Directory access and
durable storage are deployment responsibilities; test filesystem results do not
promise a measured production recovery-time objective.

## Runnable acceptance environment

The following creates a dedicated persistent test database; its fixed credentials
are test-only. Bind to loopback and never reuse the volume for production:

```powershell
docker run -d --user 0:0 --name tbfactory-acceptance-db -p 127.0.0.1:18000:8000 -v tbfactory-acceptance-data:/data surrealdb/surrealdb:v3.3.0 start --bind 0.0.0.0:8000 --user root --pass acceptance-only surrealkv:/data/factory
npm test
npm run build
npm run acceptance
```

The root container user above accommodates Docker Desktop test-volume permissions;
production should prepare volume ownership and run with a dedicated restricted identity.
Tests create isolated database names. Acceptance restarts only this named dedicated
container, preserves its volume, and restores an export into another isolated database.
Tests never consume production credentials or call real external providers.

For a UI drill run `npx tsx tests/acceptance.ts --serve`, then open `http://localhost:3000`.
Sign in as `alice` using any test password, select `alpha`, create a Work Item and
add a note/correction/reference. Reload its link and check persistent history. Issue
an Invitation for `newcomer@example.test`; sign in as `newcomer`, preview and explicitly
accept. Create/copy/revoke an API credential. No test-provider claim is a production
email trust guarantee.

## Technical sources checked during implementation

- [TanStack Start server routes](https://tanstack.com/start/latest/docs/framework/react/guide/server-routes)
  and [hosting](https://tanstack.com/start/latest/docs/framework/react/guide/hosting)
  document server handlers and the Nitro Node build integration.
- [SurrealDB JavaScript transactions](https://surrealdb.com/docs/reference/javascript/concepts/transactions)
  support interactive atomic work; Factory retries the entire authorization/write
  transaction after contention, rather than retrying an isolated write.
- [SurrealDB import](https://surrealdb.com/docs/reference/cli/surrealdb-cli/commands/import)
  and [export](https://surrealdb.com/docs/reference/cli/surrealdb-cli/commands/export)
  require `OPTION IMPORT` for supported 3.3 restore and suppress import side effects.
- [openid-client signature validation](https://github.com/panva/openid-client/blob/main/docs/functions/enableNonRepudiationChecks.md)
  is enabled explicitly; [Authorization Code Grant checks](https://github.com/panva/openid-client/blob/main/docs/interfaces/AuthorizationCodeGrantChecks.md)
  document state, nonce and PKCE checks.
- [Node.js crypto](https://nodejs.org/docs/latest-v24.x/api/crypto.html) supplies authenticated
  AES-GCM encryption; application code owns persistence, backup verification and recovery.
- [OpenID Certified oidc-provider](https://github.com/panva/node-oidc-provider) is used only
  as the actual self-hosted provider in acceptance checks.
