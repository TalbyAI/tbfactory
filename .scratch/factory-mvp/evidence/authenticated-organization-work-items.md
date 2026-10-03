# Authenticated Work Item delivery evidence

Checked on 2026-10-03 on `design/authenticated-organization-work-items`, against the
accepted design at baseline `4430b8c`. Implementation commits: `c1d44f0`, `8e7d55e`,
and review corrections `e9df4bd`. Existing design decisions and prototype directories
were preserved. The required stack remains TanStack Start and persistent SurrealDB;
Workflow execution stays in its subsequent tickets.

## Reproducible checks

The [operation runbook](../../../docs/operations/authenticated-work-items.md) gives
the isolated Docker setup, configuration, commands and manual UI/restore drill.
Runtime: Windows, Node.js 24.14.1, npm 11.17.0, SurrealDB 3.3.0 (`surrealkv` on a
persistent Docker volume). Dependency versions are pinned in `package-lock.json`.

| Check | Result |
| --- | --- |
| `npm run typecheck` | Passed |
| `npm test` | 14 tests passed; zero failures, skips or cancellations |
| `npm run build` | Passed; production Nitro Node output generated |
| `npx tsx tests/acceptance.ts --serve` | All five production HTTP/recovery groups passed |
| Operator CLI `secret-check`, `ring-export`, `ring-restore`, `secret-check` | Passed with web/provider stopped; restored generation 2 covers two keys and two stored secrets |
| Collaborative browser UI drill | Login/logout, creation, persistent history, corrections, references, credential revocation and explicit Invitation acceptance passed |
| Independent Standards and Spec reviews | Findings corrected; both follow-up reviews report no remaining actionable findings |

The final acceptance output is retained locally at
`.runtime/acceptance-1791034069800/results.json`. Protected database/ring recovery
material stays in ignored `.runtime/`; it is deliberately excluded from Git. The
script creates fresh database names and can reproduce the checks without this local
material. It restarts only the dedicated `tbfactory-acceptance-db` container and
never deletes its persistent volume.
The acceptance web/provider processes and dedicated container were stopped after
verification; retained test data can be reused with `docker start tbfactory-acceptance-db`.

## Coverage of accepted contracts

- OIDC Authorization Code Flow uses S256 PKCE, state, nonce, signature, issuer,
  audience and expiration validation. Controlled invalid claims, callback replay,
  UserInfo subject substitution and exact issuer/subject identity mapping are tested.
  Both supported client authentication methods are exercised. The production build
  also authenticates against the actual self-hosted OpenID Certified `oidc-provider`
  test fixture, including verified contact attributes obtained from UserInfo.
- Operator provisioning is idempotent and validates Organization/Project/Repository
  ownership. Alice has independent Memberships in Alpha and Beta; Bob has only Beta.
  Authentication alone gives a new User no Organization access. Scoped restrictions,
  prevailing prohibitions, required human intervention, current Membership revocation,
  credential expiration and browser-session expiration are checked at public seams.
- Protected UI server functions and HTTP routes call shared transactional operations.
  Authorized creation retains the Work Item identity, Organization, Project, optional
  Repository, registered initial state and state-flow version. Invalid ownership and
  cross-Organization access fail without effects. Eight concurrent identical requests
  return one result and one initial/manual Fact. Changed receipt content conflicts.
  A database-injected failure during initial Fact persistence rolls back the Work Item,
  Fact and receipt; the same public operation then retries successfully exactly once.
- History is bounded and paginated. Manual notes, corrections and references append
  immutable Facts with their actor and source. Corrections retain the original Fact;
  references claim no unique primary correspondence. Factory exposes no Fact rewrite
  or deletion operation. Fresh connections retain history and stable ordering.
- Invitations require explicit issuance/delegation authority, bounded scoped grants,
  current issuer authority at acceptance and the authenticated verified recipient.
  Preview does not activate access. Expiry, revocation, different recipients, concurrent
  acceptance, existing/revoked Membership rules and receipt replay are checked. A
  replay by the same User remains valid after contact attributes change and never
  resurrects a subsequently revoked Membership.
- API credentials belong to the issuing User and one Organization, narrow Activities,
  and intersect current permissions. Only the initial response contains the secret;
  receipt replay returns metadata. Tokens are stored hashed, expire and revoke
  immediately. Browser-only issuance prevents recursive credential creation.
- The protected versioned key ring uses a separately custodied root key. Setup and
  rotation require verified protected backup before activation; previous decryption
  keys remain available. Organization/purpose binding, writer exclusion, fresh-reader
  loading, unavailable backup, wrong root/installation, corrupted ring and missing key
  coverage are checked. Windows durable file replacement ran in these checks; POSIX
  uses file sync, rename and containing-directory sync.
- Production acceptance terminates/restarts the web process and persistent database,
  then checks Users, Memberships, Work Items, Facts, receipts, API credentials and
  encrypted secrets. It exports a consistent stopped-application database and imports
  it into an isolated database. An older ring lacking required coverage is rejected;
  the compatible protected ring restores both key versions. History, isolation and
  immediate credential revocation still hold after restoration.

## Browser observations

The collaborative browser used the production Node build and actual test OIDC provider.
Alice selected Alpha, created a Work Item, appended a note, a correction of its Fact
and an external reference. Reloading the Work Item link restored its state and history.
A UI-issued credential returned HTTP 200 for its permitted read, then HTTP 401 after
UI revocation; the one-time token display was cleared.

With the final build, Alice issued an Invitation for `ui-recipient@example.test` and
signed out. Following its link preserved the Invitation through fresh OIDC login.
The recipient saw proposed grants alongside the no-access screen. Only clicking
**Accept Invitation** made Alpha available; the pending token was then cleared.
No secret values were recorded in this evidence. Browser verification used DOM and
observable results; the collaborative screenshot tool was unavailable.

The final build also created Work Item `04b2d74e-95c8-43ff-8e07-f71fc0643db2` through
the UI and appended a note. Reloading its scoped link returned the same title,
registered state, initial Fact and note (two Facts, no UI errors).

## Review corrections and installation boundary

Spec review identified fixed client authentication, contact checks preceding receipt
replay, and incomplete file-replacement durability. Regression tests first exposed
the replay failure; configurable OIDC authentication and durable OS replacement now
pass the final checks. Standards review requested the canonical API Credential term
and removal of repeated validation dispatch; both are addressed.

The installation ticket still owns a real independent remote backup destination,
restricted Windows ACLs, separate root custody, daily monitored database backups,
at least 30-day retention, monthly drills and a measured recovery-time objective.
Local test directories prove protocol behavior, not off-host disaster recovery or
physical power-loss behavior. Mounted storage must honor OS flush guarantees.
Windows key-ring operations require Windows PowerShell. The test provider uses
development interactions and in-memory provider state and is not a deployment IdP.
Teams, Workflow Runs, policy editing, automatic email, provider ingestion, primary
correspondence and transitions remain deferred as accepted.
