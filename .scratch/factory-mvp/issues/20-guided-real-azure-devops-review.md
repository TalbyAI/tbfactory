# Guide the first real Azure DevOps Review with the existing User

Status: ready-for-human
State: open
Type: HITL
Assignee: Codex

## Parent

[TBFactory MVP specification](../spec.md)

## Approved scope

The User approved this additional MVP acceptance gate on 2026-10-08. Use their
existing Microsoft account, a selected real Azure DevOps Repository and small pull
request, real AI, and the final screens from Issue 19. No additional human accounts
are required. Existing evaluation fixtures remain isolated and retained.

Produce a beginner tutorial in English, with numbered steps, expected results,
troubleshooting and a guided session in Spanish when requested:

1. Establish the real OIDC User and explicit Factory Membership and permissions.
2. Register Organization/Project/Repository resources and protected read credentials.
3. Configure authenticated Azure DevOps service hooks through an accessible HTTPS
   endpoint and import the selected pull request with actual branch/commit evidence.
4. Configure an agreed AI model and budgets, execute Review and explain waits/errors.
5. Inspect the private Artifact and submit a complete human Review Decision.
6. Explain and exercise explicit publication when the User requests it, then the
   separate Review Finalization Workflow. An empty report requires human review
   and a recorded skipped publication rather than a fabricated Finding.

## Acceptance

- [x] Prepare the walkthrough against final UI labels and actual supported commands.
- [ ] Record nonsecret Repository/PR, tenant, installation, model and budget choices.
- [ ] Keep real credentials outside Git, chat, screenshots and logs; preserve the
  existing Organization-owned encrypted credential boundaries.
- [x] Validate Microsoft OIDC compatibility and Membership without identity merging.
- [ ] Confirm actual service-hook delivery and real, isolated repository checkout.
- [ ] Confirm a real model report and complete human Review Decision.
- [ ] Record the explicitly chosen publication outcome and separate finalization.
- [ ] Record executed results and remaining limits before closing this ticket or MVP.

## Assumptions and prerequisites

Azure DevOps Services and Microsoft Entra ID are the approved planning assumptions.
Tenant, Repository/PR, administrative rights, AI provider/model/budget and reachable
HTTPS ingress remain installation-specific inputs. OIDC authentication does not
grant repository access. Factory Users use exact issuer/subject identity; a fixture
User is not silently converted to the real identity.

Repository data will reach the configured AI provider and incur usage. Publication
requires a separate explicit User action on the selected real pull request. The
existing loopback-only test identity provider must not be exposed publicly.

## Blocked by

- [Improve the work interface](19-compact-kanban-and-work-item-detail.md)

## Comments

### User approval — 2026-10-08

The User approved the two-ticket auto-grill summary. Live execution awaits the
nonsecret account/resource choices and locally protected credentials. This is a
real-provider acceptance exercise, not acceptance of production disaster recovery.

### Resource choices — 2026-10-08

The User selected `https://dev.azure.com/TestJG/TDP/_git/tdp-project` as the initial
Repository, with straightforward replacement before configuring a source binding.
The specific pull request will be selected during the guided session. The AI choice
is OpenRouter with GPT-6 Luna and maximum reasoning: API model `openai/gpt-6-luna`,
`reasoningEffort: "max"`. The [OpenRouter catalog](https://openrouter.ai/api/v1/models)
lists tools and maximum reasoning support. Actual availability, entitlement and
paid execution remain to be verified with the configured account. Tenant and
budget are still pending; secrets are not requested in conversation.

### Walkthrough preparation and tenant supplied — 2026-10-08

The [first real Review tutorial](../../../docs/operations/first-azure-devops-review.md)
is prepared against the compact Board, Work Item detail, Administration labels
and installed operator commands. The User supplied tenant
`b6c9961c-042d-4750-aa03-00df693c6c5b` and will create the OpenRouter key with its
spending limit locally. Actual account/directory compatibility is unverified.

Codex recommends a dedicated key with USD 5 total and no periodic reset, plus
20 AI calls, 10 minutes of AI time, 20 minutes of execution time and no subordinate
agents for the initial small PR. These are proposals, not accepted/configured limits.
The specific PR, budget choice, app registration, protected credentials and HTTPS
ingress remain pending. No real provider authentication, checkout, AI call or
publication has been performed.

### Public tenant metadata check — 2026-10-08

The tenant-specific Microsoft OIDC discovery endpoint returned the matching
`https://login.microsoftonline.com/b6c9961c-042d-4750-aa03-00df693c6c5b/v2.0`
issuer and supports `client_secret_post` and `client_secret_basic`. This was a
public metadata read without credentials or resource changes. It does not prove
the app registration, authorization-code/PKCE login, exact User identity or
Factory Membership; those live checks remain pending.

### Guided session preflight — 2026-10-10

The User requested a step-by-step session in Spanish, preserving local changes,
the existing Docker evaluation and immutable history. The operator read `AGENTS.md`,
the tutorial, Issues 19 and 20, and the existing interface evidence. The branch is
`feat/mvp-first-review-experience`, based on commit
`e32d44807ae08ea9614526e8a8f9cfaee4a51f68`, with eight modified tracked files and
nine untracked files at session entry. No checkout, reset, stash, commit, rebuild
or container restart was performed. Existing ticket comments remain retained.

Executed local checks:

- Node `v24.14.1` satisfies the package requirement `>=24.14.1 <25`; npm is
  `11.17.0`. `npm ls --depth=0` exits successfully with the installed pinned root
  dependencies. The package has no declared application release version; identify
  this source by its commit and uncommitted changes.
- Docker Engine is `29.5.3`; Docker Compose is `v5.1.4`. The existing evaluation
  Factory uses image
  `sha256:42ae3f8516dd8b41d18a55e1c3c8152ff4a70e70ded53e85b48370e633f6b231`,
  created at `2026-10-07T16:33:00.61167966Z`. That image does not establish deployment
  of the local Issue 19 changes. The evaluation database reports healthy.
- The evaluation Factory reports `unhealthy`. At approximately 09:30 UTC,
  `docker compose -f docker/evaluation/compose.yaml exec -T factory node --import tsx scripts/installation.ts status`
  exits with code 1 and reports `coordinator: "stopped"`, the last backup as
  `succeeded` but `overdue: true`, and the last drill as `succeeded` with
  `overdue: false`. The healthcheck requires a running coordinator; this accounts
  for the failing healthcheck, but the reason the coordinator stopped remains
  undiagnosed. No ownership marker, volume, credential or retained evidence was
  changed, and no retry was attempted.
- The documented interface fixture at `http://localhost:3000` has no listening
  process. The collaborative browser reaches an error page at
  `http://127.0.0.1:3000`. Its `tbfactory-ui-browser-db` container is stopped
  (`Exited (255)`); `tbfactory-ui-acceptance-db` is also stopped (`Exited (0)`).
  These are fixture observations, not Microsoft login or real Review evidence.
- `npm run format:check` passes for root code and Markdown at session entry.
  Existing test/build claims from 2026-10-08 were read, not rerun or promoted to
  new real-provider acceptance evidence.

Current choices and pending steps:

- Asked the User for the actual PR URL and confirmation of the initial Repository
  `https://dev.azure.com/TestJG/TDP/_git/tdp-project`; both answers remain pending.
  The supplied tenant remains `b6c9961c-042d-4750-aa03-00df693c6c5b`, with actual
  account compatibility unverified.
- Retain OpenRouter model `openai/gpt-6-luna`, upstream `openai`, and
  `reasoningEffort: "max"`. No model or effort substitution is authorized. The
  previously proposed USD 5 total key limit with no reset, 20 AI calls, 10 minutes
  of AI time, 20 minutes of execution time and zero subordinate agents remains
  unaccepted and unconfigured. Verify account availability, the locally configured
  key limit and effective Factory limits with the User before any paid dispatch.
- Issue 19 remains open for foreground keyboard-focus verification and User
  visual acceptance. Restore access to an isolated current UI before that check;
  the historical screenshot and fixture evidence do not replace User acceptance.
- No separate real-provider installation has been validated. App registration,
  real Microsoft login, exact issuer/subject Membership, scoped human and Service
  Identity permissions, protected credentials, independent storage and keys,
  provider GUID verification, Repository access and HTTPS service hooks remain
  pending. Guide these in small blocks, waiting for User-operated steps.
- No real PR import, commit checkout, AI call, private report, Review Decision,
  publication or finalization has been executed in this session. Publication
  requires the User's explicit decision for the selected PR; provider approval
  and merge are outside this session's authorization. Keep this ticket and MVP
  acceptance open until the actual walkthrough supplies the required evidence.

### Repository and PR confirmed — 2026-10-11

The User supplied pull request
[`1905`](https://dev.azure.com/TestJG/TDP/_git/tdp-project/pullrequest/1905)
and explicitly confirmed Repository
[`tdp-project`](https://dev.azure.com/TestJG/TDP/_git/tdp-project), Azure DevOps
organization `TestJG`, project `TDP`. This resolves the pending Repository/PR
selection recorded above. The PR was successfully linked to this guided-session
thread; linking is not a Factory import or provider delivery check.

Next User-operated block: sign in to Microsoft Entra admin center with the existing
Microsoft account, verify the selected Directory (tenant) ID against
`b6c9961c-042d-4750-aa03-00df693c6c5b`, and report whether App registrations is
accessible and whether a TBFactory application already exists. Do not create or
share a client secret yet. Actual login to Factory, provider GUIDs, PR status,
branches and fixed commits remain unverified. Budget acceptance, current UI visual
acceptance and all real execution/publication steps remain pending.

### Azure CLI identity and App registration checks — 2026-10-11

At the User's request, the operator replaced the manual Entra preflight with
read-only Azure CLI checks using the existing authenticated session. Azure CLI
is `2.84.0`. The first version query failed because PowerShell passed the
hyphenated JMESPath key without the required quotes; parsing `az version -o json`
in PowerShell returned the version successfully. No login, tenant switch or
resource mutation was performed.

Executed results:

- `az account show` reports tenant
  `b6c9961c-042d-4750-aa03-00df693c6c5b`, environment `AzureCloud`, account state
  `Enabled` and identity type `user`. `az account tenant list` also includes this
  tenant. This confirms the existing CLI session's directory, not the Azure DevOps
  organization's connected directory or a Factory authorization-code login.
- `az ad signed-in-user show` identifies `Iskander Sierra`, directory object ID
  `9438646e-81ac-4daf-bea1-82b5e26ce5d4`. This directory object ID must not be
  substituted for the OIDC subject needed by Factory Membership provisioning.
- `az ad app list` filtered to names starting with `TBFactory` or `Factory`
  successfully finds App registration `TBFactory`, application client ID
  `cc80990a-bac2-420d-8325-81b631e12752`, object ID
  `ed675124-b136-4407-a72c-90ffdec0b5a0`, audience `AzureADMyOrg`.
- `az ad app show` confirms empty `web.redirectUris`, `passwordCredentials` and
  `keyCredentials` metadata. No secret value was requested or displayed. The app
  still needs an exact Web callback URI and a protected credential before login.
- `az ad app owner list` filtered to the signed-in directory object returns no
  matching owner. A Microsoft Graph read through `az rest` of
  `/me/memberOf/microsoft.graph.directoryRole` reports `Global Administrator`.
  The session therefore has an administrative role relevant to configuring this
  existing app; lack of ownership alone is not an administrator dependency.
  No edit operation has been tested, and tenant policy may still affect changes.

Next: prepare the independent real-provider installation and fix its browser
origin and exact `/auth/callback` URL before updating the existing app. Create
and retain any client secret only through a protected local workflow, outside
Git, chat and captured output. Factory login and exact issuer/subject,
Membership, UI acceptance, Repository import and paid execution remain pending.

### Isolated installation and HTTP localhost experiment — 2026-10-11

The User authorized preparation, then explicitly requested a practical HTTP
localhost callback experiment without Caddy. The final browser origin is
`http://localhost:3001`; Web callback is
`http://localhost:3001/auth/callback`. Azure CLI updated the existing `TBFactory`
App registration and read back this exact URI successfully. The tenant-specific
Microsoft issuer remains HTTPS with `client_secret_post`.

Installation isolation and protected custody:

- Installation identity `tbfactory-real-1905`, native web/worker using the current
  production build from this working tree. Runtime data is under
  `C:/Users/iskan/AppData/Local/TBFactory/real-review-1905`, with separate `worker`,
  `artifacts`, `ring`, `ring-backups`, `recovery` and `logs` directories.
- Protected environment and independently generated 32-byte root key are under
  `C:/protected/tbfactory-real-1905`. Both installation directories have inheritance
  disabled and access granted only to the current Windows User and SYSTEM.
  These are same-host exercise paths, not production disaster-recovery custody.
- SurrealDB uses a separate `tbfactory-real-1905-database` container and
  `tbfactory-real-1905-surrealdb` volume, pinned image digest
  `sha256:681c6c22c287421b5c7d99e0fde79b6e0d32c36c1ddeaab2762a1661cb04cd20`,
  and loopback port `18002`. Namespace `factory_real_1905`, database `factory`.
  Its independent generated bootstrap password is supplied through a protected
  environment file, never plaintext command arguments. Docker administrators
  remain privileged installation operators and can inspect container environment.
- `ring-setup` and `secret-check` succeeded with generation 1 and zero stored
  Organization secrets. The existing sandbox image was resolved to its immutable
  digest for this installation. No evaluation volume or worker directory is reused.
- A new app credential was added with `az ad app credential reset --append`,
  description `TBFactory real PR 1905 20261011-102245`, expiry
  `2026-11-10T10:22:45Z`. Its response was captured in memory and written directly
  to the protected installation environment; no secret was displayed or retained
  in this ticket. No previous credential was invalidated.
- The web/worker runner is launched from this repository with
  `node --env-file=C:/protected/tbfactory-real-1905/factory-real.env --import tsx scripts/installation.ts run`.
  It is supervised by the active tool session, not installed as a Windows startup
  service. Keep the same working directory and protected environment for operator
  commands. Before any restart, use `installation.ts status`; do not start a second
  worker. Initial backup and restore drill have not been executed.

Failures and retained evidence:

- The initial database start failed with RocksDB `PermissionDenied`. After the
  initializer reported success, the empty volume was observed as root-owned mode
  0755. Docker volume copy-up was the suspected reset boundary. Logs were captured
  in protected `logs/database-permission-failure.log` before retry. The failed new
  container was stopped and removed, retaining its empty volume. Reinitialization
  verified UID/GID 65532 and mode 0700, then the replacement used `volume-nocopy`.
  `/ready` subsequently returned 200 and key-ring commands succeeded.
- A combined PowerShell setup/hidden-launch command was rejected by tool policy
  before execution. The operator ran the existing CLI commands separately and
  used tool-managed foreground process sessions instead; no approval bypass or
  permission request was used.
- The first HTTPS self-check expected 200 at `/`, but the application normally
  redirects to `/?view=board`. This test expectation was corrected; the original
  observation is in protected `logs/initial-https-smoke-check.txt`.
- HTTPS through Caddy then failed login with `400 Invalid application origin`.
  The installed Nitro/srvx server does not trust forwarded protocol by default,
  so its HTTP upstream request has an HTTP origin. Evidence is in protected
  `logs/https-proxy-origin-failure.txt`. No proxy-trust code change was made.
- At the User's instruction, the installation stopped gracefully before changing
  origin. Only the Caddy process on port 3443 was stopped. Its exact temporary CA
  was removed from `CurrentUser/Root` using `certutil -user -delstore` after the
  certificate-provider removal failed because UI was unavailable. That initial
  failure is preserved in `logs/certificate-removal-first-attempt.txt`. Dormant
  protected Caddy configuration/CA files remain retained; Caddy is not in the
  running installation and its callback was removed from the app registration.

Application change and executed checks:

- `Authentication.create` formerly required both issuer and callback to be
  loopback whenever either used HTTP. Two new transport tests first failed:
  HTTPS issuer with an opted-in HTTP localhost callback was rejected, and an
  unsupported loopback protocol reached discovery. The minimal fix validates each
  URL independently: HTTPS or explicitly opted-in HTTP on exact loopback names.
  Remote HTTP, lookalike localhost names and unsupported protocols remain rejected
  before discovery. PKCE, issuer/token validation and Secure, HttpOnly cookies
  remain intact. Existing callers and fixtures were inspected before the change.
- `tests/auth.test.ts` and `tests/oidc-transport.test.ts`: three tests pass. The
  existing identity/substitution/replay/client-auth test used a separate temporary
  in-memory database on port 18000; that test container was stopped and removed.
  These are fixture tests, not a Microsoft authorization-code completion.
- Two Board/navigation tests passed before the transport change. Typecheck and
  production build pass after the transport change. Build warnings are retained
  in protected `logs/http-localhost-build.log`; no whole-suite rerun is claimed.
- The real installation's HTTP home returned 200 after its normal redirect;
  `/auth/login` returned 302 to the actual tenant's Microsoft authorization
  endpoint with the expected app client ID, exact HTTP callback, PKCE `S256` and
  a Secure login cookie. The self-check did not print cookies, state, nonce or
  tokens and did not exchange an authorization code.
- The collaborative browser displays the current TBFactory Sign in page at
  `http://localhost:3001/?view=board`. User login and actual browser acceptance
  of the login/session cookies are the next practical checks. No Factory
  Membership, Organization resources, Repository credentials, AI configuration,
  service hook, real checkout, report or publication has been provisioned yet.

Next User-operated block: open `http://localhost:3001`, select **Sign in**, and use
the existing Microsoft account. Expected initial result is the authenticated
identity with **No Organization access** until explicit Membership provisioning.
Report the displayed result or a nonsecret error code; do not share passwords,
tokens or callback query strings. Issue 19 visual acceptance and initial recovery
checks remain pending. The USD budget and AI limits are still proposals; no paid
dispatch or provider-side PR effect has occurred. The original Docker evaluation,
its fixtures, histories and volumes remain unchanged.

### Real Microsoft login and initial Membership — 2026-10-11

The User supplied a browser screenshot showing their authenticated Microsoft
account, **Sign out**, and **No Organization access**. The installation database
contains exactly one authenticated User, with issuer
`https://login.microsoftonline.com/b6c9961c-042d-4750-aa03-00df693c6c5b/v2.0`,
subject `OuPQ5GgZrrXUNjJQ5p1LVk_NmoYEQGeJFnKYvKJgDY0` and Factory User ID
`7f8b45383283962261f1c0587f69da1872df543b408cff5f88f3f54d72a6e64b`.
This is real authorization-code login evidence with the HTTP localhost callback
and configured `client_secret_post`, including a usable browser session after
the callback. No cookie, code, token or password was captured in the ticket.
No identity was matched or merged by email; the Entra directory object ID was
not used as the OIDC subject. Cross-browser compatibility is not claimed.

The operator prepared protected
`C:/protected/tbfactory-real-1905/real-review-bootstrap.json` from that exact stored
issuer/subject pair, validated it against the installed provisioning schema,
then executed the existing `operator.ts provision` command using the isolated
installation environment. The resulting Factory Organization is `real-review`
(display name **Real Azure DevOps Review**), Project `tdp` (display name **TDP**),
Repository `tdp-project`. These are Factory identifiers, not verified provider GUIDs.

Executed post-provision checks confirm an active Membership for the exact User,
one Organization, correct Project/Repository ownership and 24 scoped policy rows:

- Organization scope `real-review`: `organization.read`, `type.manage`.
- Project scope `tdp`: `project.read`.
- Repository scope `tdp-project`: `work-item.read`, `history.read`,
  `workflow.read`, `artifact.read`, `repository.read`, `review.facts`,
  `review.generate`, `approval.review-generate`, `approval.review-decide`,
  `review.publish`, `approval.review-publish`, `review.supersede`, `workflow.cancel`,
  `transition.prepare-review`, `approval.prepare-review`,
  `transition.request-review`, `approval.request-review`,
  `transition.finalize-review`, `approval.finalize-review`.
- The 22 named execution/Approval grants use `allow`. Two additional `human`
  policies on `review.generate` and `review.publish` require distinct human
  checkpoints. Approval grants do not replace execution grants. No wildcard,
  delegation, Team, Invitation, API Credential, sharing or unrelated Organization
  permissions were installed. Service Identity permissions remain a later step.

Assertions also confirm zero Work Items, AI configurations/resources, provider
sources, Repository access configurations and publication configurations. This
provisioning neither imports PR 1905 nor authorizes an agent to post to it.
The User's explicit publication decision and paid-run budget remain pending.

Next User-operated block: reload the authenticated Factory page, select
**Real Azure DevOps Review**, and confirm that the empty Board loads without an
authorization error. Exercise Tab in the foreground and report whether control
focus is visibly indicated as part of Issue 19's remaining acceptance. Then use
Administration to select Work Item Type version **4 · confirmed publication**
before configuring source import. Membership visibility in the browser and the
version selection have not yet been observed; keep their acceptance pending.

### Membership UI and foreground focus accepted — 2026-10-11

The User confirmed that authorization, navigation, access and focus all looked
correct after the real login and scoped Membership setup. The User did not
activate action buttons. Together with the retained exact issuer/subject,
Membership and policy checks, this validates real Microsoft OIDC compatibility
and Membership visibility without identity merging. Foreground focus and visual
acceptance resolve Issue 19's final pending criterion; that ticket is closed.
This ticket and the MVP remain open pending real-provider execution.

A fresh database read confirms no `type_selection` rows, zero Work Items, zero
Workflow Runs, zero AI configurations and zero publication configurations.
The read neither changes selection nor performs a provider or AI effect.

Next User-operated block: open **Administration > Work Item Type selection**,
choose **4 · confirmed publication**, check **Enable creation**, and select
**Save type selection**. Expected confirmation:
**Selection saved for new Work Items. Existing versions are retained.**
Then verify the retained version/enabled values before source import. This
configuration operation does not start a Review, spend AI budget or publish to
the PR. Version selection is still pending until the User performs and the
installation records it; prior fixture actions are not substituted for this step.
