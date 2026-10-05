# TBFactory

The first production increment provides authenticated, Organization-scoped Work Items,
immutable Fact history, Invitations and self-owned API credentials. TanStack Start
owns both UI server functions and public HTTP routes; both use the same transactional
Factory operations. SurrealDB is the primary persistent database.
Scoped Teams, State Transitions and provider-authenticated GitHub/Azure DevOps
observation ingestion are available. A separate Mastra worker now runs durable
Review Intake Workflows and repository reviews in an isolated Docker sandbox,
retaining private reports and proposed Findings for human review.

## Runtime and commands

Use Node.js 24.14.1 (supported range 24.x), npm 11 and SurrealDB 3.3.0 with a persistent
`surrealkv` volume. Production dependencies and build tools are pinned in
`package-lock.json`. Prototype dependencies remain inside their own subdirectories.

```powershell
npm ci
npm run typecheck
npm run build
node --env-file=.env .output/server/index.mjs
```

Copy `.env.example` into a protected, ignored `.env` and configure the installation.
Set `PORT` and `HOST` for the Node server. Register the exact callback
`FACTORY_ORIGIN/auth/callback` with the configured OIDC issuer. The supported client
authentication methods are `client_secret_post` and `client_secret_basic`, selected
with `FACTORY_OIDC_AUTH_METHOD`; use HTTPS and Authorization Code Flow
with S256 PKCE. Discovery must match the configured issuer. ID Token signatures,
audience, lifetime, state and nonce are validated. If email is returned by UserInfo,
its subject must match the validated ID Token. Missing verified email permits login
but cannot activate an Invitation. Set `FACTORY_TRUST_VERIFIED_EMAIL=true` only when
the operator trusts the issuer's email-control verification process. No email-based
account linking exists; issuer/subject changes require explicit migration.
Each new browser session requests fresh authentication with OIDC `prompt=login`;
there is no silent session renewal or refresh-token extension.

The database account, OIDC client secret, root-key file and backup access are bootstrap
configuration, supplied independently of encrypted Factory data. Restrict the
database port to application/operator access. Database table permissions deny
unauthenticated record access. Browser cookies are Secure, HttpOnly, SameSite=Lax,
host-only, and reference hashed 12-hour sessions. Browser mutations require the exact
configured Origin; logout destroys the session. HTTP loopback requires an explicit
development-only opt-in and retains secure cookie attributes.

## Formatting

Run these commands from the repository root:

```powershell
npm run format
npm run format:check
```

`format` applies Biome to code and supported configuration files, then applies
`markdownlint-cli2 --fix` to Markdown. `format:check` verifies both without writing
files and exits nonzero when formatting or Markdown violations remain. Use
`format:code`, `format:markdown`, `format:code:check`, or `format:markdown:check` to
run either tool separately. Some Markdown violations require manual corrections.

Biome uses two-space indentation, a 100-column line width, single quotes in
JavaScript and TypeScript, double quotes in JSX, semicolons, and LF line endings.
`.gitattributes` preserves LF when Git checks out text files on every platform.
Its linter and assist actions are disabled. Markdown uses the default rules except
the line-length limit (MD013), so existing prose and long links do not need wrapping.
Repository documentation, including `.scratch/`, is checked. Generated route trees,
lockfiles, Git-ignored files, and prototypes are excluded from root commands.
Each prototype owns its formatting commands, configuration, and dependencies; run
them from that prototype's directory.

Codex must format edited files and verify affected packages before delivering
changes, as required by [AGENTS.md](AGENTS.md). The `Formatting` GitHub Actions job
checks both the application and the storage prototype on pull requests targeting
`main` and pushes to `main`. CI only checks files; it does not fix or commit them.
Adding another prototype requires its own formatting setup and workflow steps.

To block merges with formatting failures, enable branch protection or a ruleset
for `main`, require pull requests, and require the `Formatting` status check. The
repository's current GitHub plan does not support these protections for this
private repository; CI reports failures, but mandatory merge blocking remains
pending a compatible plan. Git hooks are not installed by this setup.

## Operator provisioning

Create a protected JSON file containing `organization`, `projects` (each with optional
`repositories`), and `members` (exact `issuer`, `subject` and explicit `grants`). Grant
fields are `activity`, `scope`, `scopeId`, `effect`. Scopes are `organization`, `project`,
`repository`, or `user`; effects are `allow`, `deny`, or `human`. Activities are listed
in `src/server/contracts.ts`. No implicit administrator bypass exists.

```json
{
  "organization": { "id": "alpha", "name": "Alpha" },
  "projects": [{ "id": "alpha-project", "name": "Project", "repositories": [] }],
  "members": [{
    "issuer": "https://identity.example.com", "subject": "provider-subject",
    "grants": [
      { "activity": "organization.read", "scope": "organization", "scopeId": "alpha", "effect": "allow" },
      { "activity": "project.read", "scope": "organization", "scopeId": "alpha", "effect": "allow" },
      { "activity": "work-item.create", "scope": "organization", "scopeId": "alpha", "effect": "allow" },
      { "activity": "work-item.read", "scope": "organization", "scopeId": "alpha", "effect": "allow" },
      { "activity": "history.read", "scope": "organization", "scopeId": "alpha", "effect": "allow" }
    ]
  }]
}
```

```powershell
node --env-file=.env --import tsx scripts/operator.ts provision bootstrap.json
node --env-file=.env --import tsx scripts/operator.ts membership-revoke member.json
node --env-file=.env --import tsx scripts/operator.ts policy-set policy.json
```

Provisioning is transactional and idempotent; repeating an old bootstrap cannot
reactivate a revoked Membership. `member.json` contains `organization` and `user`.
`policy.json` adds the grant fields to these. Policy installation adds a rule; an
existing prohibition remains in force. Principal/scope ownership is validated.
No public Membership or policy editor is added. Invitation issuance additionally
requires `invitation.issue` and an explicit `delegate:<activity>:<effect>` allow at an
applicable scope. Initial Invitation grants cannot include delegation authority.

## Public operations

The accepted operation table is in the [design](.scratch/factory-mvp/designs/authenticated-organization-work-items.md#public-operation-contracts).
Mutations require `operationId`; unknown input fields are rejected. Retries with the
same identifier and normalized content return the recorded outcome. Different content
conflicts. Invitation/API issuance retries return metadata with `secretUnavailable`
and no secret. Explicitly revoke and reissue after losing the initial response.
Public reads use `limit` (1–100, default 30) and opaque `cursor` parameters. A browser-only
`GET /api/organizations/{id}/api-credentials` returns paginated self-owned metadata
under credential-revocation permission. No credential digest, ciphertext or key is
returned. GET Invitation preview is authenticated and never grants Membership.
`GET /api/organizations/{id}/work-items` provides a paginated authorized collection
read under each Work Item's concrete read permission, including scoped prohibitions.

Notes contain `text`. Corrections contain `fact` and `text`; the referenced Fact must
belong to the same Work Item. References contain `provider` (`github` or `azure-devops`)
and a canonical HTTPS pull request `locator`, without credentials, query or fragment.
They record a reference, never unique primary correspondence or provider evidence.
Work Item creation uses type `pull-request-review`, retained version `1`, state
`registered`, and exposes no State Transitions. Effective API access intersects token
Organization/Activities with current Membership and applicable policies. API tokens
cannot activate Invitations or create/revoke credentials.

## Key-ring operations and recovery

Provider source installation, native webhook authentication, credential rotation and
delivery recovery are described in [provider observations](docs/operations/provider-observations.md).
Review resources, worker volumes, private reports and stopped-execution recovery
are described in [durable private reviews](docs/operations/durable-private-reviews.md).

Follow [key-ring backup and recovery](docs/operations/key-ring-backup.md) and the
[manual operation runbook](docs/operations/authenticated-work-items.md). Setup is
explicit; web startup never regenerates missing keys. Key rotation retains old keys
and verifies an external protected backup before activation. The test filesystem
destination demonstrates the backup contract; production must mount independent
recovery storage. Production scheduling, monitoring and measured restore objectives
remain the installation ticket's responsibility.

## Verification

Start the dedicated persistent acceptance database described in the runbook, then:

```powershell
npm run typecheck
npm test
npm run build
npm run acceptance
# Keep the tested application and self-hosted test provider available for UI checks:
npx tsx tests/acceptance.ts --serve
```

Tests use real SurrealDB transactions and a controlled external OIDC boundary. The
acceptance command uses an actual OpenID Certified `oidc-provider`, a production
TanStack Start build, a web/database restart and a consistent export/import plus ring
restore into an isolated database. Its provider uses development accounts only; it
is a test dependency and must never be used as the deployment's identity provider.
Recovery material and machine-readable results remain under ignored `.runtime/`.
