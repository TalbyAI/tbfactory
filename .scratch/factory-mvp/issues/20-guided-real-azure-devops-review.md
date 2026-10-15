# Guide the first real Azure DevOps Review with the existing User

Status: ready-for-human
State: closed
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
- [x] Record nonsecret Repository/PR, tenant, installation, model and budget choices.
- [x] Keep real credentials outside Git, chat, screenshots and logs; preserve the
  existing Organization-owned encrypted credential boundaries.
- [x] Validate Microsoft OIDC compatibility and Membership without identity merging.
- [x] Confirm actual service-hook delivery and real, isolated repository checkout.
- [x] Confirm a real model report and complete human Review Decision.
- [x] Record the explicitly authorized publication and verify the actual provider comment.
- [ ] Execute separate finalization on this real-provider Work Item; deferred at
  first-version acceptance to [Issue 23](23-deferred-real-provider-finalization.md).
- [x] Record executed results, remaining limits and explicit User acceptance before
  closing this ticket and the first MVP version.

The User explicitly accepted and closed the first MVP version on 2026-10-15 after
manually inspecting the real publication. The unchecked finalization exercise is
tracked separately and is not claimed as executed by this walkthrough. This dated
acceptance supersedes the earlier instruction to leave this ticket open for that
remaining exercise; historical comments and evidence remain unchanged.

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

### Retained type selection and real provider metadata — 2026-10-11

The User did not see the expected save confirmation, but confirmed after a browser
refresh that the selection persisted. A read of the isolated installation confirms
`pull-request-review` version 4, enabled, for Organization `real-review`, with zero
Work Items and Workflow Runs. The missing observed confirmation is retained as a
UI observation; its cause is unverified. No repeated save or code fix was attempted.

Read-only Azure CLI checks using the existing Microsoft session found PR 1905
active and not a draft, in the confirmed Repository
`https://dev.azure.com/TestJG/TDP/_git/tdp-project`:

- Collection GUID: `f69c4cce-de55-4ac3-812d-950fa62e5995`.
- Project GUID: `744f7bb5-7014-4719-bed8-ecf81cd56218`.
- Repository GUID: `cf08a2b2-12ab-4b3a-839c-9ce2c4631108`.
- Source branch: `refs/heads/work-item/4390-ci-test-phases`.
- Target branch: `refs/heads/main`.
- Source commit: `155d29ef2775d6a58dff8232e681844f03651c82`.
- Target commit: `c442074739285bd54bbe18f4ceb9ba8a80349b2d`.

These are provider observations at lookup time, not retained Review inputs or a
Factory import. A future service-hook envelope must match the source binding and
its actual commits. No PR mutation was performed.

Collection discovery through `az devops invoke --area location --resource
connectionData` failed with `--area is not present in current organization`.
The failure was retained in protected `logs/collection-discovery-cli-failure.txt`
before using `az rest` against the organization's `_apis/connectionData` endpoint
with Azure DevOps resource ID `499b84ac-1321-427f-aa17-267ca6975798`. That read
succeeded without displaying access tokens or modifying CLI defaults.

The operator created a placeholder-only Repository access template at protected
`C:/protected/tbfactory-real-1905/tdp-access.json`, outside Git. Its inherited ACL
allows only the current Windows User and SYSTEM. It targets only the canonical
clone URL, without the username returned in the provider's remote URL. It has not
been installed and contains no real credential yet.

Next User-operated block: create a dedicated short-lived TestJG PAT with only
**Code (Read)**, enter it locally into this protected JSON file, and report only
completion and expiry. The current Azure DevOps clone adapter expects a static
Basic credential; the CLI login alone does not configure Factory checkout.
The PAT's effective repository scope follows the account's Azure DevOps permissions;
the Factory URL restriction does not narrow the PAT at the provider. If PAT creation
is restricted, request the organization's administrator to permit this account's
short-lived Code (Read) PAT for the test. No write scope is requested at this stage.
Service hooks, checkout, paid Review, Review Decision, publication and finalization
remain unexecuted. Budget and limits still require the User's agreement.

### Repository read access and restricted HTTPS ingress — 2026-10-11

The User confirmed saving the PAT locally and that its expiry matched the requested
short-lived configuration. No PAT value or exact expiry date was supplied in chat.
The operator validated the protected input without displaying the key and ran
`operator.ts repository-access` against installation `tbfactory-real-1905`.
The enabled access uses credential ID `tdp-read-1905` and only the canonical
`https://dev.azure.com/TestJG/TDP/_git/tdp-project` URL. Configuration and audit
metadata contain no plaintext key. Key-ring verification and decryptability pass.

Using the encrypted Factory credential, `git ls-remote` successfully read the real
Repository. Authentication was passed only in a child-process environment, not in
command arguments, a URL, Git configuration files or output. Noninteractive Git
credential helpers were disabled for this read. Evidence is retained in protected
`logs/repository-read-verification.json`, timestamped `2026-10-11T11:31:47.421Z`:

- Source branch tip: `155d29ef2775d6a58dff8232e681844f03651c82`.
- Current `main` tip: `0868d6ca27569ae8926adca66d488c3c8c27e26e`.

A subsequent Azure CLI PR read still reported last merge target commit
`c442074739285bd54bbe18f4ceb9ba8a80349b2d`. These are distinct provider observations;
the branch tip was not substituted for the PR's retained merge target. The eventual
real event and Review must retain their actual commit evidence. This check proves
read authentication, not an isolated checkout or exclusive read-only PAT scopes.
No write operation was attempted.

The operator created protected `tdp-source.json` with an independent random
32-byte base64url source secret, then installed enabled source `tdp-prs` for the
previously verified collection/project/Repository GUIDs. Its immutable publication
mode is `confirmed-content`. Two Organization secrets now pass verification;
no publication configuration or write credential exists.

The existing ngrok agent version 3.16.0 failed before opening the ingress because
the service rejected the old version with `ERR_NGROK_121`. Original startup evidence
was retained in protected `logs/ngrok-startup.txt` before updating the agent through
its existing updater to 3.39.11. Update evidence is in `logs/ngrok-update.txt`.
No Caddy process, certificate or application proxy-trust change was introduced.

The running ngrok process uses the existing locally configured account, with
`--inspect=false`, `--log=false`, upstream `http://localhost:3001`, explicit
`--host-header=localhost:3001` and protected `ngrok-observations-policy.json`.
The policy forwards only POST requests to
`/api/organizations/real-review/sources/tdp-prs/observations`; other paths/methods
return 404 at the ingress. External TLS terminates at ngrok, which forwards to the
application's opted-in exact loopback origin. This is the local experiment's ingress,
not production external-origin preservation. No plan upgrade was requested.

Current temporary endpoint:
`https://0de7-83-46-187-16.ngrok-free.app/api/organizations/real-review/sources/tdp-prs/observations`.
At `2026-10-11T11:34:14.554Z`, six public checks passed: GET/POST `/`, GET
`/auth/login`, GET the observation route and POST a different source path returned
404; POST the exact route without authentication returned 401. The local tunnel
API also confirmed request inspection disabled. Evidence is retained in protected
`logs/https-ingress-verification.json`. No authenticated provider payload was sent;
these rejection checks are not real service-hook acceptance. ngrok terminates TLS
and therefore handles webhook data; cloud account capture/retention settings have
not been independently verified.

A read-only Azure CLI subscriptions query found one visible existing `git.push`
subscription for another Project/Repository. It was left unchanged. Visibility
does not establish edit permission for TDP. Post-check assertions confirm one source,
zero Work Items, zero Workflow Runs, zero AI configurations and zero publication
configurations. The original evaluation installation remains untouched.

Next User-operated block: open TDP **Project settings > Service hooks**, choose
**Create subscription > Web Hooks**, then select **Pull request updated**, Repository
**tdp-project**, with no restrictive update filters. Advance to the destination
configuration without finishing yet. If denied, request **View subscriptions** and
**Edit subscriptions** for this account at TDP Project scope from an Azure DevOps
administrator. The next block will enter the HTTPS URL and source Basic credential
locally. Delivery/import, isolated checkout, AI budget acceptance, paid execution,
Review Decision, explicit publication outcome and finalization remain pending.

### Service-hook destination screen reached — 2026-10-11

The User supplied a screenshot of the Web Hooks subscription **Action** page,
with **Post via HTTP**, URL, untrusted-certificate option and Basic authentication
fields. Reaching this page does not yet establish subscription creation or delivery.
A fresh public endpoint check still returns 401 for an unauthenticated POST, and
the local tunnel API confirms request inspection remains disabled.

Next User-operated block: enter the verified HTTPS observation URL, keep
**Accept untrusted SSL certificates** unchecked, use Basic username `factory` and
copy only the independently generated source secret from protected `tdp-source.json`
to the password field locally. Set **Resource details to send** to **All**, then
select **Finish** without **Test** and confirm that the subscription is listed.
The destination password is not the Repository PAT. Clear the clipboard afterward;
do not share password fields, request Authorization headers or raw delivery details.
The wizard's sample test would not establish delivery of PR 1905. Actual event
delivery, import and write permissions remain unverified at this point.

### Updated-event subscription saved and verified — 2026-10-11

The User confirmed selecting Finish. Read-only Azure CLI verification confirms
subscription `6c55256a-bde5-4c0f-865e-f505f1e66345` is enabled, event type
`git.pullrequest.updated`, resource version `1.0`, for the exact TDP Project and
tdp-project Repository GUIDs. Branch, notification type, creator and reviewer
filters are empty. The consumer URL matches the restricted HTTPS observation
endpoint and Basic username is `factory`. Resource-details configuration is omitted
in the API response; Microsoft's documented default is All. No unrelated existing
subscription was changed.

One metadata query failed locally because the Windows `az.cmd` wrapper interpreted
unquoted `keys()` parentheses. The failure was recorded before a successful
read-only retry using in-memory JSON projection. Evidence is protected
`logs/subscription-query-shell-failure.txt` and
`logs/service-hook-subscription-verification.json`.
An initial secret comparison in that projection returned false because the API
returns an asterisk mask. A subsequent nonsecret classification confirms the
password field is present, nonempty and masked. The comparison is inconclusive,
not evidence of a credential mismatch. This correction is retained in protected
`logs/service-hook-secret-projection-check.json`; no password was displayed.

The subscription notifications API reports no deliveries. Factory still contains
zero Work Items, observation deliveries, Workflow Runs, AI configurations and
publication configurations. Real subscription creation is now observed; delivery,
authentication and import are still pending. Creating a subscription does not
replay the selected existing PR's past events.

A read-only PR lookup confirms active PR 1905 has one required reviewer with vote
zero. The existing Azure DevOps account lookup returns a different account ID from
that reviewer. These provider identities are not used for Factory identity matching.
No reviewer, vote, PR status, source commit or PR description was changed by the
operator. Microsoft documents reviewer-list changes as real triggers for this
event; a description-only change is not the chosen trigger.

Next User-operated block: open PR 1905 and add the existing signed-in account as
an optional reviewer, without changing required reviewers or casting a vote.
If the account already appears, stop rather than removing an existing reviewer.
This reversible reviewer-list change can notify PR participants and should produce
the real update event for PR 1905. Report completion or a nonsecret permissions
error. The operator will then correlate provider notification, ingestion receipt,
correspondence and actual commit Facts before claiming import. Retain the original
reviewer list and remove only the test-added optional reviewer after the exercise.
No approval, merge, paid Review or Findings publication is authorized by this step.

### First actual PR 1905 observation imported — 2026-10-11

The User confirmed adding the existing account as an optional reviewer. A fresh
Azure CLI PR read confirms the original required reviewer remains with vote zero,
and the test-added account `dbca0d37-86ba-68c3-8ea2-825086b98d4b` is present with
vote zero and no required flag. The PR remains active and not a draft. No approval
or merge was performed. Removal of only this test-added reviewer remains a cleanup
step after the exercise; removing it will itself generate an update event.

The real subscription records notification ID `1`, event ID
`a98b707b-af6b-4790-967e-6ee88f748f41`, created at
`2026-10-11T11:49:57.383Z`, with result `succeeded` and status `completed`.
Factory contains exactly one matching observation delivery and correspondence,
plus Work Item `68c4f6ce-c196-4109-878c-9fa1dd81c695`, title
**Separar verificación .NET por fases y preservar paralelismo (#4390)**,
Organization `real-review`, Project `tdp`, Repository `tdp-project`, type version 4,
publication mode `confirmed-content`, state `registered`.

Assertions correlate the provider event ID, ingestion receipt, correspondence and
`external.observation` Fact `71eedc9c-450d-46b5-ad53-5ccfd2aafe47`. Its normalized
resource contains the verified collection/Repository GUIDs and PR ID 1905:

- Event: `git.pullrequest.updated`, provider state `active`, draft false.
- Source branch: `work-item/4390-ci-test-phases`.
- Target branch: `main`.
- Source commit: `155d29ef2775d6a58dff8232e681844f03651c82`.
- Target commit: `c442074739285bd54bbe18f4ceb9ba8a80349b2d`.

Both commits and branches match a fresh real PR API read. The newer `main` branch
tip recorded previously was not substituted for the imported target commit.
Protected `logs/pr-1905-import-verification.json` retains nonsecret normalized
evidence and passed assertions at `2026-10-11T11:51:15.630Z`. No raw request,
Authorization header or provider session token was copied to this ticket.
This validates actual provider delivery, source authentication, binding and PR
import; it is not fixture acceptance and does not yet validate checkout or AI.

The installation coordinator, web and worker are running. Status still exits
nonzero for previously pending backup/drill freshness; no recovery readiness is
claimed. There are zero Workflow Runs, AI configurations and publication
configurations. Automatic intake discovery iterates configured Review resources;
none exists yet, explaining the current registered state without a Workflow Run.
No Review, sandbox checkout, paid call or publication has occurred.

Next User-operated block: refresh the local Factory Board, open the imported Work
Item title, and inspect **History and notes > Fact history** for the real
`external.observation`, branch names and commit IDs above. Confirm visibility
without requesting a transition or approving report generation. Subsequent blocks
must agree the exact OpenRouter model/reasoning and budget, protect and validate
the key, configure scoped execution resources, and observe the real intake waits.
The service-hook/checkout acceptance checkbox remains open because checkout has
not executed. Created/merged-event subscriptions, backup/drill checks, cleanup,
Review Decision, explicit publication outcome and finalization also remain pending.

### Import visible in the real UI and budget accepted — 2026-10-11

The User supplied two screenshots from the real Work Item's **Fact history**.
They show the imported `external.observation` with the verified PR 1905 event ID,
branches and source/target commits, and `work-item.created` with `registered`,
`pull-request-review`, version 4 and `confirmed-content`. This confirms visibility
of the real imported evidence in the detail UI, beyond the database assertions.

The User explicitly accepted the proposed limits for the first real Review:

- Dedicated OpenRouter key: USD 5 total, with no periodic limit reset.
- Factory AI calls: at most 20.
- Factory AI time: at most 600,000 ms (10 minutes).
- Factory execution time: at most 1,200,000 ms (20 minutes).
- Subordinate agents: 0.
- Model: `openai/gpt-6-luna`, reasoning effort `max`, upstream `openai`.

These are accepted choices, not yet verified key settings or installed execution
resources. The provider-side spend limit must be checked before paid generation;
Factory call/time limits alone do not establish a dollar ceiling.

Unauthenticated public OpenRouter reads returned HTTP 200 for `/api/v1/models`
and `/api/v1/models/openai/gpt-6-luna/endpoints`. The exact model is listed, including
tools and reasoning parameters. OpenAI endpoints advertise tools and reasoning
effort; no account-specific entitlement or paid `max` execution is claimed.
Nonsecret evidence is protected `logs/openrouter-model-availability.json` at
`2026-10-11T11:57:35.861Z` and `logs/openrouter-model-endpoints.json` at
`2026-10-11T11:58:17.998Z`. No alternative model or effort was substituted.

The operator created protected `real-review-ai.json`, containing only a key
placeholder, the exact model/upstream/effort, Organization resource mode, accepted
execution limits, Repository `tdp-project` and target branch `main`. Configuration
and automatic rules are both disabled. Assertions validate the installed schema,
disabled state and exact limits. The template has not been installed in Factory.
No key, AI resource, intake Workflow, checkout or paid dispatch exists yet.

Next User-operated block: create a dedicated key in OpenRouter's account settings,
set its USD 5 spend limit with no daily/weekly/monthly reset, then replace only the
key placeholder in protected `C:/protected/tbfactory-real-1905/real-review-ai.json`.
Keep `enabled: false` and all agreed model/limit values. Save and close locally,
clear the clipboard, and report completion without the key or a secret screenshot.
The operator will read key metadata without generating content before installing
and enabling the agreed Review resources. If key-limit controls are unavailable or
the model/effort is rejected, stop and retain evidence rather than weakening limits
or silently changing the model. Checkout, human generation Approval, report,
Review Decision, explicit publication, finalization and cleanup remain pending.

### OpenRouter key checked; disabled resources and real intake wait — 2026-10-11

The User confirmed saving the OpenRouter key in the protected local input. Schema
and assertions confirm the exact agreed model, `max` effort, upstream, execution
limits and disabled state. Authenticated GET requests to `/api/v1/key` and
`/api/v1/credits` returned HTTP 200 without a generation request. Authorization
was constructed in memory; no key or partial key label was displayed or logged.
Nonsecret preflight evidence is protected `logs/openrouter-key-preflight.json`,
timestamped `2026-10-11T12:04:33.550Z`:

- Key limit USD 5, remaining USD 5, usage zero, `limit_reset: null`.
- BYOK usage zero, `include_byok_in_limit: false`.
- Not a free-tier or management key; expires `2026-10-18T12:01:00.016Z`.
- Positive account credit balance; no credit purchase or paid inference performed.

The false BYOK inclusion setting means linked provider-key usage would be excluded
from this key's spend limit. Existing account BYOK configuration was not inspected;
zero usage is not proof that no provider key exists. Before enabling paid execution,
the next User block will include BYOK usage in the same USD 5 limit. No management
key is requested in chat and no account setting was silently changed.

The operator installed the validated input through `operator.ts review-configure`
with AI configuration and automatic rules both disabled. Organization resource
version 1 retains `openai/gpt-6-luna`, `reasoningEffort: max`, upstream `openai`,
20 calls, 600,000 ms AI time, 1,200,000 ms execution time and zero subordinate agents.
The key is encrypted in the independent Organization key ring; configuration and
audit metadata exclude it. Three stored secrets pass decryption verification.

The returned Service Identity is `service_cc294e67b17b60585e4fe5d6882d34b0`, with
active explicit Membership. Four Repository-scoped policies were installed:
`review.generate` human first, then `review.generate` allow, `repository.read`
allow and `transition.request-review` allow. No publication or Approval grant was
given to this identity. An actual authorization assertion confirms generation
requires human Approval. The existing human User's separate generation Approval
permission remains scoped to the selected Repository.

With the service request permission in place, the running worker discovered the
real imported observation and created one Review Intake Workflow Run
`23b67d0b-bbd9-4f55-a806-c82f97a57dcc`. It is `waiting-inputs`, owns the imported
Work Item exclusively, and has zero calls and zero AI time. Factory state remains
`registered`; Workflow status is separate from Factory state. Configuration and
automatic eligibility are intentionally disabled, so the intake does not hand off
to paid generation. No second run should be requested for this Work Item.
Protected `logs/disabled-ai-intake-verification.json` retains the observed state at
`2026-10-11T12:06:00.105Z`. There are zero agent-call rows and no publication
configuration; no sandbox checkout has been executed yet.

Next User-operated block: edit this dedicated OpenRouter key locally, enable
**Include BYOK usage in limit** while retaining USD 5 and no periodic reset, save,
and report completion without a key screenshot. If the control is unavailable,
report the available controls before continuing. Re-read metadata before enabling
resources. Then inspect the intake wait in the real UI and later the distinct,
run-bound report-generation Approval. Checkout, paid `max` execution, report,
Review Decision, explicit publication, finalization and cleanup remain pending.

### BYOK UI instruction corrected; model allowed by key guardrails — 2026-10-11

The User supplied the complete dedicated-key detail screen and reported no
**Include BYOK usage in limit** control. The screenshots show Credit limit USD 5,
Reset limit N/A, zero usage, expiry October 18 and a separate workspace guardrail
of USD 100 weekly. Two models are available under the workspace/member/key
guardrails. No full key value is copied into this ticket.

The prior instruction assumed that the API's `include_byok_in_limit` field was
editable on that key-detail screen. That assumption was unsupported and is now
corrected; the missing control is not a User error. The USD 5 lifetime key limit
remains valid. Changing BYOK inclusion is unnecessary if no applicable provider
credential is configured; zero recorded BYOK usage alone does not establish that.
No management key, new guardrail, expanded model allowlist or account-wide budget
change is required merely to resolve this UI mismatch.

An authenticated read of `/api/v1/models/user`, using the encrypted Factory key,
returned HTTP 200 and two filtered models. The exact `openai/gpt-6-luna` is present
with tools and reasoning-effort support. This confirms model visibility under
the key's preferences/privacy/guardrails without paid inference. Nonsecret evidence
is protected `logs/openrouter-key-model-access.json`, timestamped
`2026-10-11T12:12:47.527Z`. Actual paid `max` execution remains unverified.

Inspection of the installed Review Agent confirms OpenRouter requests set
`provider.only` to the agreed OpenAI upstream and `allow_fallbacks: false`.
Therefore the next check can focus on applicable OpenAI BYOK credentials in the
same workspace. The documented workspace BYOK link redirects through
`https://openrouter.ai/workspace-redirect/byok`. No credential value needs to be
shown to perform this check.

Next User-operated block: open that workspace's BYOK settings and report whether
OpenAI has any provider key configured, without adding, removing or displaying
keys. If none is configured, retain the existing key budget and proceed using
OpenRouter credits without changing the absent inclusion control. If an OpenAI
key exists, inspect its applicability to this test key and choose a scoped remedy
before any paid call. Factory resources remain disabled; the existing intake is
still `waiting-inputs`, with zero calls and zero agent-call rows. No Workflow
restart, second run, paid request or publication was performed.

### BYOK absence confirmed; real handoff failure retained and corrected — 2026-10-11

The User reported no OpenAI provider key in the same workspace's BYOK settings.
This is User-observed evidence, not an independently enumerated provider-key list.
Keep the dedicated USD 5 lifetime key limit and no periodic reset; do not request a
management key or change the absent BYOK inclusion control. Before enabling,
authenticated metadata again showed USD 5 remaining, zero usage and zero BYOK
usage. The exact model remains `openai/gpt-6-luna`, upstream `openai`, with
`reasoningEffort: max` and no provider fallback.

The operator prepared protected `real-review-ai-enabled.json`, omitting the API
key to reuse the encrypted credential, and installed configuration version 2.
Resources and automatic rules are enabled only for `tdp-project` and `main`.
Limits remain 20 calls, 600,000 ms AI time, 1,200,000 ms execution time and zero
subordinate agents. Preflight assertions confirmed current Service Identity
generation authorization still requires human Approval. Evidence:
`logs/review-enable-preflight.json` at `2026-10-11T12:17:58.320Z`.

The first post-enable assertion failed because no Review Run existed. The existing
Intake moved to `waiting-prerequisites` with the generic error **Workflow failed;
inspect execution evidence**. The worker automatically retried this status; the
operator did not repeat configuration or request another run. Failure evidence
was retained in `logs/post-enable-first-check-failure.txt` and
`logs/post-enable-intake-state.json`. To preserve a stable failed workflow snapshot
and stop automatic retries, the operator gracefully stopped only the isolated
real installation through `installation.ts stop`. No evaluation service, volume,
history or configuration was changed.

The decoded stopped Mastra snapshot, retained in
`logs/stopped-intake-snapshot.json`, identifies the cause: the handoff attempted to
create a second `automatic-review-v1` receipt for the same Organization, Service
Identity and external observation. The generated receipt ID included the new
configuration version, while SurrealDB's unique identity consists of
`organization, user, operation, clientId`. The existing receipt
`1c8b8af754dd7e44531787cf8f1d52428232923fb264939aced23e6501e201e5`
therefore caused an index conflict and transaction rollback. This was a Factory
idempotency defect, not missing PR inputs or OpenRouter access.

The minimal code correction in `src/server/review-worker.ts` checks receipts by
their actual unique identity at automatic discovery and handoff. Existing receipt
IDs, records and results remain intact; no migration or manual history editing was
performed. A new Azure DevOps fixture regression in `tests/reviews.test.ts`
reproduced the failure before the fix and passed afterward. It verifies a disabled
observed intake can hand off after configuration changes, retains its original
receipt and ownership, waits for human generation Approval with zero AI requests,
and retains that wait after worker restart.

Fixture validation used a separate temporary in-memory SurrealDB container
`tbfactory-intake-regression-db` on loopback port 18000, removed after testing.
Five targeted tests passed: configuration-change receipt regression, generation
Approval and empty-report waits, automatic Service Identity/supersession,
confirmed-stop intake recovery, and OpenRouter max/routing/cost forwarding.
`npm run typecheck` and `npm run build` passed. The OpenRouter test used a local
fixture endpoint; it does not prove paid execution with the real model. Red/green,
related-test and build logs remain in the protected real-installation logs.

Before restarting, another authenticated key metadata check at
`2026-10-11T12:27:07.930Z` confirmed USD 5 remaining, reset null, usage zero,
BYOK usage zero, configuration version 2 and human generation Approval required.
Nonsecret evidence is `logs/intake-restart-preflight.json`. The operator restarted
the same isolated installation with the corrected build, without configuring a
new run or creating a second worker.

Real database assertions at `2026-10-11T12:27:46.175Z` now confirm:

- Original Intake `23b67d0b-bbd9-4f55-a806-c82f97a57dcc` is `completed`.
- Its single handoff points to Review Run
  `12c80bb15b3511540f3a9d860bad7ceda280421f14aab6d5071f0aaee0635e8e`,
  which exclusively owns Work Item `68c4f6ce-c196-4109-878c-9fa1dd81c695` and is
  `waiting-approval`. Factory state remains `registered`.
- Retained inputs are source `155d29ef2775d6a58dff8232e681844f03651c82` and target
  `c442074739285bd54bbe18f4ceb9ba8a80349b2d`, bound to the real external Fact.
- Configuration version 2 retains the exact model/effort and accepted limits.
- There are two Workflow Runs, one original automatic receipt, one handoff Fact,
  zero AI calls, zero AI time and zero agent-call rows.

Evidence is `logs/real-handoff-after-fix.json`. Coordinator, web and worker are
running. Installation status still reports overdue backup and drill, so those
operational checks remain pending. Generation Approval has not been submitted;
no real checkout, paid inference, private report, Review Decision, publication or
finalization has happened. Ticket 20 and the MVP remain open.

Next User-operated block: refresh the Work Item's **Private Review Reports** using
**Refresh review** and verify the completed Intake and separate Review Run in
`waiting-approval`, with **Approve report generation** available. Do not click that
button in this observation block. Report the displayed state; the later button
will authorize paid report generation within the accepted limits and is separate
from any explicit decision to publish Findings on the PR.

### Next-day server restart and verified stale-worker recovery — 2026-10-12

The User requested restarting the server to continue the observation block above.
Initial installation status showed the coordinator stopped, while the isolated
real database was healthy on loopback port 18002. Local source changes and all
evaluation services were preserved. Real database preflight at
`2026-10-12T09:26:44.677Z` confirmed the same completed Intake and Review Run in
`waiting-approval`, requiring human generation Approval, with zero calls and zero
agent-call rows. Model, `max` effort and execution limits remain unchanged.
Evidence: protected `logs/day-two-start-preflight.json`.

The initial start served the web page but reported **Worker startup did not
finish**. Before retrying, the operator retained
`logs/day-two-start-failure.json`, identifying the previous day's filesystem lock
and database worker owner, both for PID 38872 on this host and worker directory.
Independent OS inspection confirmed that PID no longer existed and no real
sandbox was running. The failed attempt's remaining coordinator and web processes
were identified by PID and command line, recorded in
`logs/day-two-failed-start-processes.json`, and stopped. No database or evaluation
process was stopped.

The existing `operator.ts worker-recover-lock` command recovered only the verified
stale ownership for `confirmedPid: 38872`; output is retained in
`logs/day-two-worker-recovery.txt`. No Workflow Run recovery, new run, reconfiguration
or manual history edit was performed. Restarting the same installation then
succeeded: coordinator, web and worker are running. The board returned HTTP 200.
Assertions at `2026-10-12T09:29:10.953Z` confirmed the same Review Run exclusively
owns the Work Item in `waiting-approval`, with zero calls and zero agent-call rows.
Evidence: `logs/day-two-restart-verification.json`.

Continue at `http://localhost:3001`: authenticate with the existing Microsoft
account if necessary, open the PR 1905 Work Item and use **Refresh review** under
**Private Review Reports**. Verify completed Intake, Review `waiting-approval` and
the available **Approve report generation** button without clicking it yet.
Backup and drill remain overdue. Public service-hook tunnel availability and
today's OpenRouter key metadata were not rechecked in this restart block; key
limits must be rechecked before paid generation. No paid call or PR publication
was performed. Ticket 20 and the MVP remain open.

### Generation checkpoint observed; stale error distinguished from execution — 2026-10-12

The User supplied a screenshot of **Private Review Reports** showing
`Execution: waiting-approval`, Workflow `review-v1`, and **Approve report
generation**. The screenshot also displays **Workflow failed; inspect execution
evidence**. Protected `logs/day-two-generation-approval-ui.png` preserves this
real visual evidence without secrets.

Read-only database and Mastra assertions distinguish the stale text from current
execution: the original Intake is `completed` with a successful Mastra snapshot,
while the current Review Run is `waiting-approval` with no execution snapshot,
zero calls, zero AI time and zero agent-call rows. Both records retain the same old
error text. `handoff` spreads `intake.data` into the new Review Run, including its
error, and the panel displays any `run.error`. This is a residual presentation/data
defect after successful retry, not a failed paid generation attempt. It remains
pending; no error field, historical record or snapshot was manually cleared.

Fresh authenticated OpenRouter metadata at `2026-10-12T09:40:51.863Z` confirms
the dedicated key has USD 5 remaining, USD 5 limit, reset null, zero total and
BYOK usage, and expiry `2026-10-18T12:01:00.016Z`. The selected model is still
available in `/api/v1/models/user`. Human generation Approval remains required.
Retained model is `openai/gpt-6-luna`, upstream `openai`, effort `max`; limits remain
20 calls, 600,000 ms AI time, 1,200,000 ms execution time and zero subordinate
agents. No paid request was sent. Nonsecret evidence:
`logs/day-two-generation-approval-preflight.json`.

Azure CLI read-only PR verification confirms PR 1905 is active, not draft, with
the same imported source and target commits. The initial `az repos pr show`
invocation rejected unsupported `--project TDP`; the failure was recorded before
retrying with supported `--id` and `--organization` arguments. Evidence:
`logs/day-two-pr-preflight-cli-failure.txt` and `logs/day-two-pr-preflight.json`.
No PR mutation was performed.

Next User-operated block: click **Approve report generation** for this waiting
Review Run under the already accepted budget, then use **Refresh review** after a
short wait and report its Execution status. This Approval permits real checkout
and paid private report generation; it does not authorize publishing Findings,
approving the Azure DevOps PR or merging it. Expected progress is execution
followed by `waiting-review`, or an evidenced prerequisite/error wait to diagnose.
The Approval, real checkout, paid model execution, private report, complete Review
Decision, explicit publication decision and finalization remain unexecuted at this
checkpoint. Backup/drill and public service-hook tunnel checks remain pending.

### Human generation Approval and first real paid execution — 2026-10-12

The User supplied the next real screenshot showing `Execution: running`, Workflow
`review-v1`. Evidence is protected `logs/first-paid-review-running-ui.png`.
The human Approval is retained in Fact
`d6b4933d-7b3b-432c-a66a-1e47c0e032c7` at `2026-10-12T09:46:27.942Z`, bound to
Review Run `12c80bb15b3511540f3a9d860bad7ceda280421f14aab6d5071f0aaee0635e8e`.
The existing authenticated User submitted this Approval; the operator did not
click it or grant Approval to the Service Identity.

Actual repository checkout provenance at `2026-10-12T09:48:30.951Z` confirms source
`155d29ef2775d6a58dff8232e681844f03651c82`, target and merge baseline
`c442074739285bd54bbe18f4ceb9ba8a80349b2d`, image
`sha256:753a05dcd0f1046a508de8062d5aaa0eb9ba4171e9c21533be8d16c35d3d6a67`,
checkout `/workspace/repository`, sandbox memory 536,870,912 bytes and disconnected
network `none`. This is execution against the real Repository commits, not a
fixture. Provenance and projected consumption evidence are retained in
`logs/first-paid-review-summary.json`.

Real OpenRouter calls are now recorded for the agreed `openai/gpt-6-luna` model,
using the retained `max` configuration and OpenAI-only routing. All observed calls
are from the parent agent. At the above snapshot there were eight reserved calls,
seven completed, 93,115 ms completed AI time and USD 0.012659865 completed recorded
cost. Authenticated key metadata returned HTTP 200 with USD 0.00923666 usage,
USD 4.99076334 remaining, reset null and zero BYOK usage; provider accounting was
still catching up with recent calls. These are intermediate measurements, not a
final total. No additional run, retry or limit increase was requested.

At `2026-10-12T09:50:26.280Z`, the same run remained `running`: ten reserved calls,
204,779 ms completed AI time, one pending call and USD 0.021010225 completed cost.
There was no report yet. Factory state remains `registered` while Workflow
execution progresses independently. The stale Intake error text remains visible
during running; it is not evidence of a new failure. No Findings publication,
PR approval, merge, Review Decision or finalization has occurred.

### First paid Review stopped at the agreed AI time limit; cost reconciled — 2026-10-12

The first paid Review stopped at approximately `2026-10-12T09:56:40.576Z`, without
producing a private report. Retained execution evidence identifies the actual
cause **AI time limit exhausted**, wrapped by the AI SDK as **Failed to process
successful response**. This current failure is distinct from the earlier stale
Intake message. The 20 ms budget watcher aborted the pending request when completed
and outstanding AI time reached the agreed limit. No model/effort substitution,
automatic budget increase, manual paid retry or second Review Run was performed.

Final Factory assertions and protected `logs/first-paid-review-stopped.json`
confirm:

- Same Review Run is `stopped`; its Mastra `generate-report` step failed.
- Seventeen parent-agent calls: sixteen `completed`, one `uncertain`, none pending
  and no subordinate-agent calls. The last call retains unknown output and cost in
  Factory rather than being replayed or relabeled as successful.
- AI time 600,055 ms against 600,000 ms, including 55 ms budget-check/abort latency.
  Execution time 612,999 ms, below the 1,200,000 ms execution limit. The 20-call cap
  and USD 5 cap were not exhausted.
- Zero Review Reports. No empty report was invented and no Review Decision is
  possible for this attempt. A missing report is not an empty reviewed report.
- The sandbox was stopped and removed. Work Item ownership was released, but
  Factory state remains `registered`. No new automatic intake appeared; the two
  existing Workflow Runs and original receipt remain intact.

`logs/first-paid-review-failed-snapshot.json` preserves the failure and cause chain
in the protected installation directory. The UI's wrapped error does not clearly
explain the exhausted AI time; clearer failure presentation remains pending.

Provider responses from completed calls confirm OpenAI, the agreed model alias and
`is_byok: false`. Intermediate tool evidence at `2026-10-12T09:52:21.399Z` retained
14 failed and 43 successful tool responses across diff, changes, history, files,
read and search. One failed initial diff had a null path, which the fixed
repository tool rejects; other failures require separate diagnosis before a
future paid attempt. Projected inputs are retained in
`logs/first-paid-review-failed-tool-inputs.json`, with provider/tool metadata in
`logs/first-paid-review-provider-tools-evidence.json`. Do not assume these
intermediate failures prove a complete review or explain all elapsed time.

Authenticated read-only generation metadata reconciled the last cancelled call
without regenerating it, using the
[OpenRouter generation metadata API](https://openrouter.ai/docs/api/api-reference/generations/get-request-&-usage-metadata-for-a-generation).
At `2026-10-12T09:58:42.590Z`, generation
`gen-1791798919-RzI7qLO3aBZGrNOO3XjV` returned HTTP 200, OpenAI, resolved provider
model `openai/gpt-6-luna-20260922`, `is_byok: false`, `cancelled: true`, null finish
reason and USD 0.0094576 cost. This is provider resolution of the configured alias,
not an operator model change. Completed Factory call costs total USD 0.043229525;
adding the cancelled generation yields **USD 0.052687125**, exactly matching the
dedicated key's usage. Remaining lifetime allowance is **USD 4.947312875**, with no
periodic reset. Evidence: `logs/first-paid-review-cost-reconciliation.json`.
Factory's uncertain call record is preserved; billing reconciliation does not
create or recover a report.

Next User-operated block: use **Refresh review** and verify `Execution: stopped`
with the wrapped error; do not request another Review or publication yet. Before
a future paid attempt, diagnose tool failures and misleading error presentation,
prepare any correction without touching evaluation history, then agree any
revised run budget explicitly while preserving the model and `max` effort.
Reading a real private report, a complete Review Decision, explicit publication
decision and separate finalization remain pending. Backup/drill, public tunnel
checks and cleanup remain pending. Ticket 20 and the MVP remain open; successful
fixtures and this bounded but incomplete paid attempt do not satisfy acceptance.

### Stopped execution hidden and transition eligibility stale after panel refresh — 2026-10-12

The User pressed **Refresh review** and reported no visible Workflow Run status
and no ability to request another Review. Their screenshot shows an empty
**Private Review Reports** section and `Active Workflow Run` under both
`prepare-review` and `request-review`. Protected evidence:
`logs/stopped-run-hidden-ui.png` and `logs/stopped-run-hidden-ui-state.json`.

Read-only database checks confirm the same two retained Workflow Runs: completed
Intake and stopped Review. Work Item `activeRun` is absent, Factory state remains
`registered`, and there are still seventeen agent-call rows. No real ownership
lock prevents another request; no new run or paid call was made.

Source inspection identifies two distinct UI limitations. In
`src/review-panel.tsx`, the `active` selector excludes `stopped`, and only this
active run's Execution status/error is rendered when no report exists. Therefore
the earlier instruction to look for `stopped` there was incorrect for the current
UI. Separately, **Refresh review** reads Review data but does not invoke the parent
`onChange` callback. Transition eligibility rendered by `src/transition-board.tsx`
therefore retains the last Work Item read until **Refresh** under **Work Item
actions**, or a full-page reload, fetches current state.

These defects remain recorded and unresolved; no source or historical data was
edited in this observation block. Next User-operated block: reload the page with
F5 and verify that the stale `Active Workflow Run` restriction disappears. Do not
request another Review yet: paid retry preparation and any budget change still
require explicit review of the failed attempt. A stopped Run remaining absent in
the report panel after reload is the confirmed visibility limitation, not loss of
the retained execution evidence. Ticket 20 and the MVP remain open.

### Reload confirmed; concurrent tool failures reproduced and corrected without AI — 2026-10-12

The User confirmed `Active Workflow Run` disappeared after a full-page reload.
Their screenshot now shows Factory state `registered`, **No active run**, and
available `prepare-review`/`request-review` forms. Protected evidence is
`logs/no-active-run-after-reload-ui.png`. Do not submit `prepare-review` merely to
retry generation; a future retry uses `request-review` and a new run-bound
generation Approval. No new Review has been requested.

The operator reproduced the failed tool inputs against the exact real source and
target commits, in temporary diagnostic sandboxes with separate IDs. These were
read-only repository diagnostics, not Workflow Runs or AI Reviews. They used the
existing scoped Repository credential locally, the same pinned sandbox image and
limits, and network disconnection after checkout. All diagnostic sandboxes were
stopped and removed; the retained failed Review, database records, evaluation
installation and its volumes remained intact.

Serial reproduction from `2026-10-12T10:19:09.896Z` to
`2026-10-12T10:19:14.470Z` explains invalid inputs: a null diff path is denied;
several guessed source paths do not exist and return `ENOENT`. Valid changes and
search queries that had failed during the Review now succeed individually.
`logs/sandbox-tool-reproduction.json` retains all eighteen cases.

Replaying the original concurrent groups from `2026-10-12T10:20:40.802Z` to
`2026-10-12T10:20:46.275Z` reproduces genuine failures for valid searches:
**fatal: grep: failed to create thread: Resource temporarily unavailable**.
Git's threads and concurrent Node tool processes share the sandbox's fixed PID
limit. This failure is separate from invalid paths and contributes wasted tool
work; it does not prove that it accounts for all model reasoning time. Evidence:
`logs/sandbox-parallel-reproduction.json`. The PID-event counter read did not yield
usable output, so no kernel counter measurement is claimed.

The minimal correction in `src/server/review-sandbox.ts` queues commands within
each sandbox. Independent sandboxes remain independent. The fixed image,
64-PID limit, 512 MiB memory, network isolation, timeouts, output retention,
credential handling, path validation, model, effort and run budgets are unchanged.
A failed command still rejects its caller and releases the command slot.
The new `tests/review-sandbox.test.ts` regression failed before the fix because
eight commands overlapped, then passed with one active command and continued
execution after the first failure. No new dependency was added.

Real-repository verification of the correction from `2026-10-12T10:24:06.400Z` to
`2026-10-12T10:24:12.087Z` replayed five concurrent request groups, 34 queries.
Thirty succeeded; four intentionally invalid reads of nonexistent paths remained
rejected. There were zero unexpected failures. This is real checkout/tool evidence
without paid inference; it does not establish that another AI attempt will finish
within ten minutes. Evidence: `logs/sandbox-parallel-fixed-real-check.json`.

Five targeted tests passed: large/escaped bounded repository output, command-slot
regression, invalid commit preparation, cumulative AI/execution limits, and
private-report retention across human-wait restarts. The tests used a separate
temporary in-memory `tbfactory-sandbox-regression-db` on loopback port 18000; it was
removed afterward. Provider calls and subordinate activity in these tests were
local fixtures, not paid calls against the real PR. Typecheck initially identified
incomplete fixture typing and the SDK's optional `executeCommand` type; only test
typing was corrected. Final `npm run typecheck` and `npm run build` passed. Evidence:
`logs/sandbox-command-slot-red.txt`, `logs/sandbox-command-slot-green.txt`,
`logs/sandbox-fix-related-tests.txt` and `logs/sandbox-fix-build.txt`.

The operator gracefully stopped and restarted only the isolated real installation
to load the correction. Coordinator, web and worker are running; the board returns
HTTP 200. Read-only preflight at `2026-10-12T10:28:13.850Z` confirms configuration
version 2, the original Review `stopped`, no active Work Item owner, two retained
Workflow Runs and seventeen agent-call rows. OpenRouter key usage is still
USD 0.052687125, remaining USD 4.947312875, limit USD 5, reset null, BYOK usage zero
and expiry `2026-10-18T12:01:00.016Z`. No additional paid request was sent.
Azure CLI confirms PR 1905 is still active, not draft and bound to the same commits.
Evidence: `logs/sandbox-fix-installation-preflight.json` and
`logs/second-review-pr-preflight.json`.

The next proposed paid attempt is concrete but not authorized yet: a new Review
Run with at most twenty additional calls, ten minutes AI time, twenty minutes
execution and zero subordinate agents, retaining `openai/gpt-6-luna`, `max`,
OpenAI-only routing and the same USD 5 lifetime key ceiling. The two attempts could
therefore reserve up to 37 calls in aggregate; the old seventeen are not reset or
erased. A scoped retry brief is prepared locally in protected
`second-review-brief.txt`: prioritize the changed pipeline/PowerShell logic and
use paths returned by files/search rather than guessing source paths.

Next User decision: explicitly authorize this second attempt under those limits
or postpone paid execution. If authorized, guide the User through only the
`request-review` form first, inspect the new human Approval checkpoint and recheck
key limits before generation. No paid action follows automatically from elapsed
time or from the available UI button. Stopped-run visibility, stale cross-panel
refresh, residual Intake errors and wrapped budget-error presentation remain
unresolved UI/data limitations. A real private report, complete Review Decision,
explicit publication decision, finalization, backup/drill, public tunnel checks
and cleanup remain pending. Ticket 20 and the MVP stay open.

### User authorizes the second bounded paid attempt — 2026-10-12

The User explicitly authorized a second private-report generation attempt for PR
1905 with at most twenty additional calls, a maximum of 37 reserved calls across
both attempts, ten minutes AI time, twenty minutes execution and zero subordinate
agents. Retain `openai/gpt-6-luna`, `reasoningEffort: max`, OpenAI-only routing and
the existing USD 5 lifetime key ceiling without periodic reset. The first attempt
and its uncertain call remain preserved; authorization does not reset history or
permit Findings publication, provider PR approval or merge.

Read-only preflight confirms the real installation is running, the Work Item is
`registered` without an active run, two historical Workflow Runs and seventeen
agent-call rows remain, and the exact installed limits/model are unchanged.
Authenticated key metadata still reports USD 0.052687125 usage and
USD 4.947312875 remaining. Evidence:
`logs/second-attempt-authorized-preflight.json`. No second run or additional paid
generation has been executed at this checkpoint.

Next User-operated block: in `request-review`, fill `reviewBrief` with the prepared
focused brief and click **Request request-review** once. Use **Refresh review**
after a short wait and report the new Execution status. Expect a new Intake and
then a separate `review-v1` Run in `waiting-approval`; inspect that checkpoint and
recheck key limits before the User clicks **Approve report generation**. Do not
submit `prepare-review`, repeat the request or click generation Approval in this
creation/observation block.

### Second Review generation checkpoint verified — 2026-10-12

The User supplied a screenshot showing the newly requested `review-v1` execution
in `waiting-approval`, with **Approve report generation** available and no stale
failure text. The `Active Workflow Run` restrictions below now correctly belong
to this new exclusive owner. Screenshot evidence:
`logs/second-generation-approval-ui.png`.

Read-only assertions at `2026-10-12T10:42:58.647Z` confirm new Intake
`032d07b8-e639-44cd-8459-21f17a4e7102` completed a single handoff to Review Run
`45c308915938dc73fda310bb4fe1cc919132a8443f4b58ded9334b3ca49f3c4a`.
This Run uses the requesting User's execution identity and the prepared focused
brief. It is `waiting-approval`, requires human generation Approval and has zero
calls, zero AI time and no error. Four Workflow Runs now retain both attempts'
Intake/Review pairs; all seventeen existing agent-call rows still belong to the
first attempt. No second-attempt paid request has occurred.

Fresh Azure CLI verification confirms the PR is active, not draft and still has
the exact source and target commits retained by this new Run. Its model remains
`openai/gpt-6-luna`, effort `max`, with twenty calls, 600,000 ms AI time,
1,200,000 ms execution and zero subordinate agents. Authenticated key metadata
again confirms the lifetime USD 5 ceiling, no reset, usage USD 0.052687125,
remaining USD 4.947312875, zero BYOK usage and expiry
`2026-10-18T12:01:00.016Z`. Nonsecret evidence:
`logs/second-generation-pr-preflight.json` and
`logs/second-generation-approval-preflight.json`.

Next User-operated block: click **Approve report generation** once for this new
Run, then use **Refresh review** after a short wait and report Execution status.
This is the already authorized second paid attempt; it does not authorize
publication, provider PR approval or merge. Preserve the first stopped attempt.
The expected successful wait is `waiting-review`, but the ten-minute AI budget
still applies and may stop an incomplete generation. Real report reading, Review
Decision, publication decision, finalization and other previously recorded
operational/UI limitations remain pending.

### Second paid execution observed; deleted-file diff limitation identified — 2026-10-12

The User reported `running` after submitting generation Approval for the second
Review. Real database evidence at `2026-10-12T10:58:11.563Z` confirms Run
`45c308915938dc73fda310bb4fe1cc919132a8443f4b58ded9334b3ca49f3c4a` is `running`
without an error, using the exact imported source/target commits, the retained
pinned image, 512 MiB memory and disconnected network. It had seven reserved calls,
28,760 ms completed AI time and USD 0.00871077 completed recorded cost at that
intermediate snapshot. Evidence: `logs/second-paid-review-progress.json`.

Completed responses again identify OpenAI, `openai/gpt-6-luna`, no BYOK and only
the parent agent. Intermediate tool evidence showed 36 successful responses and
two failed diff requests, both for `scripts/test-coverage.ps1`. Evidence:
`logs/second-paid-review-tools-progress.json` and
`logs/second-paid-review-failed-tool-inputs.json`. The Run itself was not stopped
by these failures.

A read-only Git name-status check inside the bound checkout confirms
`D scripts/test-coverage.ps1`. The earlier interpretation of this particular
missing path as a guessed/invalid source path is corrected: it is a real deleted
file in the PR. The repository tool's `diff` operation requires `realpathSync` and
a current checkout file, so it cannot inspect that valid deleted-file change.
This is a separate tool limitation, still unresolved; other nonexistent paths in
the first attempt are not reclassified without evidence. No file, run, prompt,
model or budget was changed during paid execution. Evidence:
`logs/pr-1905-changed-path-status.txt`. Keep this limitation visible when assessing
any resulting report; generation success alone would not prove full coverage.

At `2026-10-12T11:03:17.768Z`, the second Run remained `running`, with twelve calls,
288,597 ms completed AI time, one outstanding call and USD 0.02646994 completed
recorded cost. Pending call elapsed time also counts toward the 600,000 ms AI
budget; completed-time counters alone are not the effective total. No report,
Review Decision, publication or finalization existed at this snapshot. The first
stopped attempt remains preserved, and no third attempt is authorized.

### Second attempt reaches the time limit; no private report — 2026-10-12

The second attempt stopped at the same agreed AI time ceiling. Assertions at
`2026-10-12T11:09:28.940Z` confirm its `generate-report` failure cause is
**AI time limit exhausted**, wrapped as **Failed to process successful response**.
The Run is `stopped`, Work Item ownership is released, and no private report
exists. The sandbox was stopped and removed. Four historical Workflow Runs retain
both attempts; thirty-one calls have been reserved in aggregate, leaving six
within the previously authorized maximum of 37. Those unused calls do not
implicitly authorize a third attempt or different time limits.

Second-attempt totals:

- Fourteen parent calls: thirteen completed, one uncertain, none pending and no
  subordinate calls.
- 600,054 ms AI time, including 54 ms budget-check/abort latency; 609,558 ms
  execution time, below the agreed twenty-minute execution ceiling.
- Completed recorded costs USD 0.038334515. Read-only OpenRouter generation
  metadata identifies the cancelled final generation
  `gen-1791803184-5ohEXVHUCqw1SapL5le1`, OpenAI, resolved model
  `openai/gpt-6-luna-20260922`, no BYOK, and cost USD 0.0102466.
- Reconciled second-attempt cost **USD 0.048581115**. Both attempts total
  **USD 0.10126824**, matching dedicated-key usage exactly. Remaining allowance is
  **USD 4.89873176**, with the same USD 5 lifetime ceiling and reset null.

Evidence: `logs/second-paid-review-failed-snapshot.json` and
`logs/second-paid-review-stop-cost-reconciliation.json`. The uncertain call record
was not replayed, relabeled or manually given output. No Review Decision,
publication or finalization is possible from this absent report.

Projected completed-call telemetry in `logs/second-paid-review-token-summary.json`
shows two long requests of 160,489 ms and 127,181 ms. Their responses respectively
record 13,244 and 10,554 reasoning tokens, against 13,292 and 10,836 completion
tokens. This supports the inference that the retained `max` setting consumed
substantial reasoning/request time; it is not evidence that tool errors alone
caused the deadline. No effort or model was reduced to force completion.

### Deleted tracked-file diff corrected and verified before another proposal — 2026-10-12

The operator corrected the independently demonstrated deleted-file limitation in
`docker/repository-tool.mjs`. A new regression failed before the change because
the deleted file could not pass `realpathSync`. Diff now validates a safe relative
path and checks for a tracked Git blob at either immutable endpoint, then reads
the Git diff. Literal pathspecs prevent a supplied wildcard/magic path from
expanding the requested scope. Read/location operations retain realpath, file,
size and binary checks; traversal, absolute paths, `.git`, missing files and
unmatched literal paths remain denied. No Repository scripts are executed.

Three targeted tests pass: bounded large/escaped output, deleted-file diff and
invalid-path rejection, and the existing command-slot regression. Typecheck also
passes. Evidence: `logs/deleted-diff-red.txt` and `logs/deleted-diff-green.txt`.
These tests use fixture repositories and do not establish a successful real AI
Review. No additional paid call was made.

A separate image `tbfactory-review:real-1905-deleted-diff` was built and pinned as
`sha256:5598497c18a44d83c14276715a001ba5ed71ca988f3a61252f7dcfa851af209e`.
The original image and evaluation tag remain intact; historical provenance in the
two stopped attempts still references their original pinned image. Evidence:
`logs/deleted-diff-image-build.txt`.

Read-only verification against the real commits in a temporary diagnostic sandbox
at `2026-10-12T11:15:20.325Z` successfully reads the deleted
`scripts/test-coverage.ps1` diff: 2,675 bytes, not truncated, digest
`240bec5a843083df6eba530a02ea3e395dbb8a156ef680f98561159e52e965d6`.
Four invalid diff paths remain rejected. The diagnostic sandbox was removed and
no Workflow Run or agent-call row was created. Evidence:
`logs/deleted-diff-real-verification.json`.

Only the isolated real installation was gracefully stopped, its protected
`FACTORY_SANDBOX_IMAGE` pin updated, and the same coordinator restarted. Web and
worker are running. No Organization AI configuration or budget was changed.
Preflight at `2026-10-12T11:18:10.706Z` confirms configuration version 2, four
retained Workflow Runs, thirty-one calls, no active run and unchanged key usage.
Evidence: `logs/third-attempt-prepared-not-authorized.json`.

The installation-level defaults still cap AI time at ten minutes and execution at
twenty minutes. Any approved increase therefore requires explicit updates to both
the Organization configuration and installation caps; changing only Organization
limits would silently remain constrained by the smaller installation limits.
Schema-validated protected proposals are prepared but not applied:
`third-review-ai-proposed.json`, `third-review-worker-limits-proposed.json` and
`third-review-brief-proposed.txt`. They omit the key and retain the existing model,
effort, routing, Repository and branch scope.

Proposed third attempt: at most twenty new calls (maximum 51 across all three
attempts), twenty minutes AI time, thirty minutes execution and zero subordinate
agents. Keep `openai/gpt-6-luna`, `max`, the same dedicated USD 5 lifetime key and
USD 4.89873176 remaining. The proposed brief prioritizes all twelve changed paths,
includes the now-supported deleted script, plans at most eight tool rounds and
requests a concise complete report with explicit coverage limitations. Neither
the brief nor more time guarantees report completion.

Next User decision: authorize these exact new limits for a third private-report
attempt or postpone paid execution. Do not configure or dispatch it before that
decision. Stopped-run visibility, refresh synchronization and budget-error
presentation remain unresolved; the actual state is retained in protected
evidence. Private report reading, complete Review Decision, explicit publication
decision, finalization and previously recorded operational/cleanup checks remain
pending. Ticket 20 and the MVP stay open.

### Third high-effort generation checkpoint verified — 2026-10-12

The User confirmed `waiting-approval` appeared after requesting the third Review.
Read-only assertions at `2026-10-12T11:31:23.587Z` identify new Intake
`7e01cfe2-0461-478e-b7b5-7984a2dd8515`, completed with handoff to Review Run
`b54bfd1e31d2849ae58fc8bee69a6a111e75c70cb610ba3b23dd1c2b3008ca01`.
The new Run exclusively owns the Work Item and is `waiting-approval`, requires
human generation Approval and has zero calls and zero AI time.

Its retained Organization configuration version 3 selects `openai/gpt-6-luna`
with `reasoningEffort: high`, twenty calls, ten minutes AI time, twenty minutes
execution and zero subordinate agents. An exact comparison confirms its brief
matches the second attempt. Fresh Azure CLI verification confirms the active,
non-draft PR retains the same source/target commits bound by this Run. Six
historical/current Workflow Runs retain all three Intake/Review pairs, with only
the prior thirty-one agent-call rows.

Authenticated key metadata still reports USD 0.10126824 usage, USD 4.89873176
remaining, USD 5 lifetime limit, reset null, zero BYOK usage and future expiry
`2026-10-18T12:01:00.016Z`. Evidence: `logs/third-high-pr-preflight.json` and
`logs/third-high-generation-preflight.json`. No third-attempt paid call has been
made at this checkpoint.

Next User-operated block: click **Approve report generation** once, then use
**Refresh review** after a short wait and report Execution status. This dispatches
the already authorized high-effort third attempt; it does not authorize
publication, provider approval or merge. Expect `running` and eventually
`waiting-review`, or an evidenced stop under the unchanged time/call limits.
Preserve both stopped max-effort attempts and the sandbox-change comparison
caveat. The report, human Review Decision, publication decision, finalization and
previously recorded UI/operational checks remain pending.

### Third high-effort attempt generates a verified private empty report — 2026-10-12

The User reported `running` after submitting the third Run's human generation
Approval. Intermediate real evidence at `2026-10-12T11:34:07.927Z` confirms the
agreed `high` configuration, exact source/target commits, corrected pinned image,
512 MiB memory and disconnected network. Completed responses identify OpenAI and
the configured model. Evidence: `logs/third-high-paid-progress.json`.
Two failed diff queries requested an untracked composition-test path; unlike the
previous deleted-script limitation, that supplied path is genuinely absent.
Projected inputs remain in `logs/third-high-failed-tool-inputs.json`.

The Run reached **waiting-review**. Assertions at `2026-10-12T11:36:25.911Z` confirm:

- Review Run `b54bfd1e31d2849ae58fc8bee69a6a111e75c70cb610ba3b23dd1c2b3008ca01`
  exclusively owns the Work Item and waits for human Review Decision.
- Eight completed parent-agent calls, no pending/uncertain calls for this attempt,
  no subordinate agents, 105,621 ms AI time and 113,181 ms execution time.
- Model `openai/gpt-6-luna`, effort `high`, within the authorized 20-call,
  ten-minute AI and twenty-minute execution limits. Thirty-nine calls are now
  recorded across all attempts, below the authorized maximum of 51.
- Private Review Report
  `3808af30b87a42409fdda1fdf45d7be6f46850e6586b10ae5c7c3209a54bca3c`
  contains **zero Findings**. The agent's summary states that the phased pipeline
  reuses the Release build, gates integration on fast-test success, preserves
  coverage for reporting and uses one processor-bounded queue; it proposes no
  actionable correctness/parallelism regression. These are model conclusions,
  not operator validation of the PR.
- The actual private Markdown Artifact is 292 bytes and passes digest/size
  verification: `dcc2bed015d20061ede6c2464520f1574907a8b05b8efc7eeedec2e852733c4f`.
  It retains the exact imported commits and corrected sandbox provenance.
- The sandbox has been removed. Mastra snapshot status is `suspended`, the
  expected durable human-review wait, not an execution failure. Factory state
  remains `registered`, separate from Workflow execution status.

Third-attempt cost is **USD 0.013318045** and completed responses record 7,871
reasoning tokens. Dedicated-key usage is **USD 0.114586285**, exactly matching
both reconciled stopped attempts plus this completed generation. Remaining
allowance is **USD 4.885413715**; USD 5 lifetime ceiling, reset null and no BYOK are
unchanged. Protected evidence: `logs/third-high-private-report-verification.json`.
No Findings or report content has been posted to Azure DevOps.

Both `max` attempts exhausted ten minutes without a report; this `high` attempt
finished generation in about 113 seconds. This supports the practical lower-effort
hypothesis, with the already recorded deleted-file-tool correction and provider
variability as comparison caveats. It is not an isolated causal experiment or a
guarantee of report quality. All stopped attempts and uncertain calls remain
unchanged. No additional run or paid retry is needed for the current human wait.

Next User-operated block: use **Refresh review**, open the private report and read
its summary/Markdown. Verify **No Findings. Human review is still required.**
before proceeding to a complete empty Review Decision. An empty generated report
is distinct from the absent reports of the stopped attempts. A later explicit
review acknowledgement and consolidated Review Decision are still required;
publication outcome and finalization remain separate steps. Do not treat the empty
report as PR approval or merge authorization. Ticket 20 and the MVP remain open;
the actual human decision, skipped/publication outcome, finalization, UI limitations
and operational/cleanup checks remain pending.

### Private Markdown download verified; empty decision ready for human submission — 2026-10-12

The User provided the local download path
`C:/Users/iskan/Downloads/private-review.md` and a screenshot of the open private
report. The screenshot shows `waiting-review`, the bound source/target commits,
**No Findings. Human review is still required**, a pending human Review Decision,
and the explicit report-reading checkbox already checked. It does not show a
submitted decision. Screenshot evidence:
`logs/empty-review-decision-ready-ui.png`.

The downloaded Markdown is 292 bytes and its SHA-256 matches the stored Artifact
exactly: `dcc2bed015d20061ede6c2464520f1574907a8b05b8efc7eeedec2e852733c4f`.
Read-only assertions confirm zero Findings, the current Run in `waiting-review`
and no retained Review Decision yet. Evidence:
`logs/private-report-download-verification.json`. This is an actual authenticated
private download, not a fixture or shared Artifact. No report or Findings were
posted externally.

Next User-operated block: click **Submit consolidated Review Decision** once,
then **Refresh review** after a short wait. For this empty report the complete
decision explicitly acknowledges the current report version with an empty
Finding-decision array; it does not assert that the PR is approved or merged.
Expected UI evidence is **Human Review Decision: submitted and current** and
**No Findings. Human review recorded**. The active Execution line may disappear
when the Run completes because the existing panel hides completed Runs; confirm
completion from retained database evidence rather than requiring an invisible
`completed` label. Publication outcome and finalization remain separate pending
steps. No additional AI generation is required for this human decision.

### User proposes a lower-effort experiment instead of more time — 2026-10-12

The User proposed testing lower reasoning effort to assess whether high reasoning
prevents completion within the existing time budget. This explicitly changes the
earlier fixed-`max` preference for the proposed experiment; the exact new effort and
paid-attempt limits still need agreement. The prepared proposal to extend AI time
to twenty minutes and execution to thirty minutes is superseded and remains
unapplied. No third Run, paid request or resource configuration change occurred.

The operator proposes `medium` on the same `openai/gpt-6-luna` model, preserving
twenty calls, ten minutes AI time, twenty minutes execution and zero subordinate
agents. The same dedicated lifetime USD 5 key and OpenAI-only routing remain in
use. [OpenRouter's model page](https://openrouter.ai/openai/gpt-6-luna) lists medium,
high and max reasoning profiles; the live OpenAI endpoint metadata supports
reasoning parameters. The installed Factory schema accepts these values.
Authenticated guardrail/key verification will still precede any paid dispatch.

Schema-validated `third-review-ai-medium-proposed.json` is prepared locally with
no plaintext key. It changes only selected effort and the matching capability
allowlist from the second-attempt input; model, routing, scope, limits and enabled
state remain the same. `third-review-medium-brief-proposed.txt` copies the exact
second-attempt brief, avoiding a simultaneous prompt change. Neither file is
installed. No installation cap increase is required for these unchanged limits.

Comparison caveat: the current pinned sandbox also contains the deleted-file diff
correction installed after the second attempt. A faster/completed lower-effort
attempt would therefore be useful practical evidence, but would not isolate
reasoning effort as the only changed variable. Request variability also prevents
a single attempt from proving causality. Record time, calls, reasoning tokens,
cost, coverage and actual report outcome rather than assuming the hypothesis.

Next User decision: authorize a third private-report attempt at the selected lower
effort with up to twenty new calls, maximum 51 across all attempts, the original
ten/twenty-minute time limits and unchanged key ceiling, or postpone execution.
The thirty-one prior calls and both uncertain cancellations remain preserved.
No model/effort fallback will occur if the selected configuration is rejected.

### User authorizes high effort; unchanged time limits installed — 2026-10-12

The User explicitly chose **high** and authorized the third attempt with up to
twenty new calls, maximum 51 across all attempts, ten minutes AI time, twenty
minutes execution and zero subordinate agents. Keep `openai/gpt-6-luna`, the exact
second-attempt brief, OpenAI-only routing and the same lifetime USD 5 key ceiling.
Neither the `medium` proposal nor the increased-time proposal is authorized or
installed.

Authenticated preflight at `2026-10-12T11:27:32.586Z` confirms thirty-one prior calls,
no active run, key usage USD 0.10126824, remaining USD 4.89873176 and no periodic
reset. Evidence: `logs/third-high-authorized-preflight.json`. The operator prepared
schema-validated protected `third-review-ai-high.json`, omitting the key to reuse
the encrypted credential, and installed it through `operator.ts review-configure`.
Organization configuration version 3 selects `reasoningEffort: high` and retains
all other model/routing/scope/resource/limit settings. The matching capability
allowlist includes `high` and the previously supported `max`; it does not permit
an automatic fallback or effort substitution.

Post-install assertions in `logs/third-high-configuration-verification.json`
confirm four historical Workflow Runs, thirty-one agent-call rows, no active Work
Item owner and no third Run or additional paid call. Installation caps remain
unchanged; the effective third-attempt time limits remain ten and twenty minutes.
The pinned sandbox retains the verified deleted-file diff correction. Preserve
this comparison caveat when interpreting the lower-effort result.

Next User-operated block: reload the page to clear stale transition eligibility,
then submit **Request request-review** once using exactly the second-attempt
`reviewBrief`. Use **Refresh review** to observe the new `waiting-approval`
checkpoint. Inspect retained `high` configuration, inputs and key budget before
the User clicks **Approve report generation**. Do not submit `prepare-review` or
generation Approval in the creation/observation block. Third-attempt checkout,
paid generation, report, Review Decision, publication decision and finalization
remain unexecuted; all previously recorded UI/operational limitations remain
pending. Ticket 20 and the MVP stay open.

### Empty human Review Decision retained; Review completed — 2026-10-12

The User submitted **Submit consolidated Review Decision**, refreshed the page,
and supplied a screenshot showing **No active run** with the private report
collapsed. Read-only verification at `2026-10-12T11:52:10.367Z` confirms Review
Run `b54bfd1e31d2849ae58fc8bee69a6a111e75c70cb610ba3b23dd1c2b3008ca01`
is `completed`, and Work Item `68c4f6ce-c196-4109-878c-9fa1dd81c695` has no
active owner. Factory state remains `registered`; Review completion does not
perform a State Transition or approve/merge the Azure DevOps PR.

Retained human Fact `d387bdda-579d-435f-86ee-3a9744ffd816` has kind
`review.decision`, the authenticated User as actor, `reviewed: true`, and an empty
Finding-decision array. It binds report version
`3808af30b87a42409fdda1fdf45d7be6f46850e6586b10ae5c7c3209a54bca3c`
and the imported relevant inputs/commits. The installed `decisionUsable` check
passes. Zero Findings is explicitly acknowledged, not inferred from missing
human input. Total agent-call rows remain 39; this decision/completion used no
additional generation. Protected evidence:
`logs/empty-review-decision-completed-verification.json` and
`logs/empty-review-decision-completed-ui.png`.

Code inspection identifies a pending prerequisite for the next independent step:
there is no installed `publication_config`, and `publicationOperation` requires
`publicationDestination` even for empty output. The worker records `skipped`
before reading a publication credential or making provider calls when content is
empty, but still validates the destination, current decision and applicable
Activity-bound Approval. Do not ask the User to request publication while this
configuration is missing, or fabricate Findings to exercise a POST. Destination
preparation, an explicit skipped-publication request and any separate Approval,
actual skipped outcome, allowed preparation/State Transitions and Review
Finalization remain pending. No publication Activity or external comment was
created by this verification. Existing evaluation/history and all stopped runs
remain intact; Issue 20 and the MVP remain open.

Next small User-operated check: expand **Private report · 3808af30b87a** and
verify **Human Review Decision: submitted and current** and **No Findings. Human
review recorded**. Do not request another Review. The completed Run is hidden by
the active-only execution summary; retained evidence above establishes completion.

### Current decision visible; live target drift blocks publication — 2026-10-12

The User supplied the expanded report screenshot, confirming **Human Review
Decision: submitted and current**, **No Findings. Human review recorded**, and
**Empty report explicitly reviewed**. The retained decision remains valid for
its recorded inputs. Screenshot: `logs/empty-review-decision-current-ui.png`.

A fresh Azure CLI check before publication preparation found that the actual PR
now has target commit `b162d64e5f968d53694ffc2b467f93275e52590d`, rather than the
reviewed `c442074739285bd54bbe18f4ceb9ba8a80349b2d`. Source remains
`155d29ef2775d6a58dff8232e681844f03651c82`; PR remains active/non-draft with
`mergeStatus: succeeded` (merge computation, not PR completion). Its first
iteration still records the original target and common commit, so target drift
alone does not prove the reviewed diff changed. It does mean the report's recorded
target differs from current provider metadata. Evidence:
`logs/current-pr-target-changed.json`. Factory still has only the original
`external.observation` Fact; its local current-decision check cannot detect this
unobserved provider change. Do not finalize or record publication against stale
provider inputs, and do not rewrite the report, decision or historical Facts.

The operator prepared the publication destination through the existing
`putPublicationConfiguration` contract, using the existing Code-read credential
in memory under independent encrypted purpose
`publication:tdp-skip-read-1905`. No write scope, new PAT or plaintext-secret file
was requested. The endpoint/correspondence resolves exactly to PR 1905. This was
preparation only: no publication Activity was requested. After inspecting the live
target mismatch, the operator disabled the destination; current configuration
version is `442c8838-db18-4b4f-895b-d85dc865403e`, `enabled: false`. Protected
replay input `empty-publication-destination.json` contains no key. This credential
is not validated or suitable for posting Findings; it was prepared only for the
empty-content branch, which skips before provider credential access/dispatch.
Evidence: `logs/empty-publication-destination-verification.json` and
`logs/stale-target-publication-blocked.json`. All six historical Runs have no
publication ID. Agent-call count remains 39. No paid retry is authorized by this
configuration step.

### Resume failures retained; server and restricted HTTPS ingress restored — 2026-10-12

Independent checks found the coordinator stopped, localhost:3001 refusing
connections, and no ngrok process. Backup/drill remain overdue. The first resume
attempt did not finish worker startup. Database worker ownership and
`worker/worker.lock` referred to PID 2744; independent process checks confirmed
that PID no longer existed. Evidence was retained in
`logs/stale-worker-lock-before-recovery.json` and
`logs/resume-20261012-151306.stderr.txt`. The operator stopped only the newly
started failed coordinator/web processes, then used the supported
`operator.ts worker-recover-lock` command with `confirmedPid: 2744`. No Workflow
Run or historical evidence was edited. The redundant diagnostic coordinator
attempt was stopped as well; only one coordinator/worker is now running.
Installation status confirms coordinator running, web true and worker true.
Its nonzero health exit reflects the still-overdue backup/drill, not startup
failure. Operational recovery acceptance remains pending.

Attempting to reuse the old temporary ngrok URL with `--url` failed with
`ERR_NGROK_313` because the Free plan does not permit that custom subdomain.
The failure logs are retained; no plan upgrade was requested. Starting with the
existing free account without a fixed URL succeeds and produces:
`https://0cab-83-46-187-16.ngrok-free.app/api/organizations/real-review/sources/tdp-prs/observations`.
Inspection remains disabled and the protected traffic policy still exposes only
POST to the exact observation route. Other paths and GET return 404. Fresh valid
JSON POST without authentication returns 401; local root redirects with 307.
Earlier raw probes expected 302 and sent an empty non-JSON POST (422); both raw
results are preserved and the corrected transport/authentication checks are in
`logs/stale-target-current-ingress-json-check.json`. This does not prove an actual
new authenticated provider delivery. No Caddy or public identity-provider/database
exposure was introduced.

An Azure CLI service-hook query using area `hooks` failed with **--area is not
present in current organization**. This is a CLI discovery failure, not evidence
that the User lacks service-hook permissions. Next User-operated block: edit only
the URL of the existing TDP / tdp-project **Pull request updated** Web Hook to the
new endpoint and save, retaining repository/event filters, All resource details,
Basic username and protected password. Do not create a duplicate subscription or
send a sample event as real-PR evidence. Then obtain an actual current PR update
observation and check new relevant inputs before discussing any further paid
Review authorization. Publication/finalization and cleanup remain pending;
Issue 20 and the MVP stay open.

### Existing service hook URL saved and verified — 2026-10-12

The User completed the existing subscription editor, using **Next** from Trigger
to Action, leaving **Accept untrusted SSL certificates** unchecked and restoring
the independent Basic password locally from the protected source JSON. No secret
was sent through chat. The operator verified the saved subscription with an
authenticated read-only `az rest` request using the Azure DevOps resource ID
`499b84ac-1321-427f-aa17-267ca6975798`. This succeeds where earlier CLI `hooks`
area discovery failed; no new credential or permission was needed.

Subscription `6c55256a-bde5-4c0f-865e-f505f1e66345` is enabled, retains
`git.pullrequest.updated` and Repository
`cf08a2b2-12ab-4b3a-839c-9ce2c4631108`, and now points to the exact new HTTPS
observation URL. Server/worker and ngrok remain running with inspection disabled.
This verifies saved configuration, not an authenticated delivery with real PR
content. Factory still retains only the original observation and 39 agent calls;
there is no active Work Item owner. Evidence:
`logs/hook-url-saved-before-real-update.json`.

Fresh PR metadata still shows source `155d29ef2775d6a58dff8232e681844f03651c82`
and target `b162d64e5f968d53694ffc2b467f93275e52590d`. Both current reviewers
have vote 0. The original required reviewer **Iskander Sierra**
(`2305ff6f-7add-4833-aab2-1d0c5cc2ca76`) remains unchanged. The temporary optional
reviewer **Iskander Sierra Zaldivar**
(`dbca0d37-86ba-68c3-8ea2-825086b98d4b`) added for the first actual hook event is
still present. Next small User-operated block: remove only this temporary optional
reviewer in PR 1905. This restores the original reviewer list and should trigger a
real updated event. Do not remove the required reviewer, vote, approve or merge.
Inspect actual hook/Factory evidence after this action; do not claim delivery until
it is observed. Publication configuration remains disabled. Do not approve any new
report-generation Activity or start a paid fourth attempt without new budget
agreement. Historical report/decision, skipped-publication outcome and separate
finalization remain preserved/pending as previously recorded. Issue 20 stays open.

### Reviewer cleanup complete; actual current event queued by Azure — 2026-10-12

The User removed the temporary optional reviewer. Fresh Azure CLI metadata
confirms PR 1905 remains active with only original required reviewer
`2305ff6f-7add-4833-aab2-1d0c5cc2ca76`, vote 0. The source/target are still
`155d29ef2775d6a58dff8232e681844f03651c82` /
`b162d64e5f968d53694ffc2b467f93275e52590d`. No reviewer vote, approval or merge
was performed, and the temporary reviewer cleanup is complete.

Read-only service-hook inspection identifies actual notification 15, created at
`2026-10-12T13:35:28.05Z`, for event
`697eef4c-4adc-489f-b6ee-8a0f0897184e`, type `git.pullrequest.updated`, resource
PR 1905 and the current target. Its status remains `queued`, result `pending`;
no HTTP response or completed delivery is recorded yet. This is an actual event,
not the sample test notifications. Factory still has the original observation,
no active run and 39 agent calls. Evidence:
`logs/reviewer-cleanup-real-observation-check.json` and
`logs/reviewer-cleanup-notification-15.json`. Do not invent another event, resend
before checking this queue, or claim successful import of updated inputs while
Azure has not delivered it. Publication remains disabled; a new paid Review is
not authorized. Wait/check this delivery before asking for another User action.
The historical Review/decision remain intact. Skipped publication and separate
finalization still require current evidence, and Issue 20 remains open.

### Azure service-hook probation identified; recovery remains pending — 2026-10-12

Further read-only inspection shows the saved subscription has moved to
`onProbation`. Failed notification 10 retains the old ngrok endpoint, while actual
notification 15 retains the new endpoint and correct PR 1905/current target but
is still queued/pending. Notification samples 13/14 showing success are not proof
that notification 15 delivered or that Factory received current inputs. Evidence:
`logs/service-hook-on-probation.json` and the earlier notification-15 projection.

[Microsoft's service-hook troubleshooting documentation](https://learn.microsoft.com/en-us/azure/devops/service-hooks/troubleshoot?view=azure-devops)
explains that enduring notification failures cause probation, with long retry
backoffs and potential loss of new events. **Enabled (restricted)** is the UI
representation of probation. The old endpoint failure and observed probation
explain why immediate real delivery cannot be assumed after editing the URL.
No application input conflict or wrong password is established by the queued
notification. Do not rotate credentials or repeat PR edits without evidence.

Next small User-operated recovery block: in TDP Service hooks, select the existing
updated-PR subscription, disable it and then enable it again using the available
subscription actions (or report the displayed actions/status if those controls
are absent). Preserve its saved URL, filters and authentication. Recheck the exact
subscription status and actual queued delivery afterward; do not count a sample
Test as a real observation. No recovery toggle, resend, new event or paid generation
has yet been performed by the operator. Factory still awaits the new observation;
publication and finalization remain blocked/pending, and Issue 20 stays open.

### User re-enables restricted hook; pending event not yet delivered — 2026-10-12

The User supplied the initial Service Hooks list showing **Enabled (restricted)**
and the available **Enable** action, before making any change. The operator
corrected the earlier disable/enable suggestion to use the existing **Enable**
action directly. The User then clicked **Enable** and reported that the restricted
label disappeared. Fresh authenticated REST verification confirms subscription
`6c55256a-bde5-4c0f-865e-f505f1e66345` now has status `enabled` and retains the
correct current ngrok URL. No disable, duplicate subscription, sample Test or
additional PR edit was required for this status recovery.

Read-only verification at `2026-10-12T13:52:07.553Z` still finds notification 15
`queued / pending`, with real event `697eef4c-4adc-489f-b6ee-8a0f0897184e` and
target `b162d64e5f968d53694ffc2b467f93275e52590d`. A subsequent notification
list confirms there are fifteen notifications and no newer delivery. Factory
still has only the original observation, no active run and 39 agent calls. Its
historical decision is usable against local recorded inputs, not proof of current
provider alignment. Evidence: `logs/service-hook-enabled-observation-check.json`
and `logs/service-hook-enabled-notification-list.json`. Server/web/worker remain
running; backup/drill health remains overdue as before.

Recovery of the subscription status does not establish processing of an earlier
queued event. Next User-operated read-only block: open this subscription's
**History**, select the latest pending notification and inspect whether the UI
offers a **Resend** action. Do not resend or generate another PR update yet. Avoid
sharing Request/authentication-header details. Preserve the existing event identity
and inspect available recovery before creating more provider changes. Current
publication configuration remains disabled; no fourth paid Review, publication
outcome or finalization is claimed. Issue 20 remains open.

### Old delivery snapshots restore probation; replace subscription without deleting history — 2026-10-12

The User's History screenshot selects a failed notification for **PR 1909**, not
PR 1905. The Response screenshot records HTTP 404 and **ERR_NGROK_3200** at
`2026-10-12T13:54:13Z`.
[ngrok's error documentation](https://ngrok.com/docs/errors/err_ngrok_3200)
identifies this as an offline/not-found endpoint. Read-only queries show that
notifications 11 and 12 for PR 1909 retain the **old** `0de7-...` ngrok URL despite
the subscription's saved URL now being `0cab-...`. Both are failed with Not Found
(404). PR 1905 notification 15 retains the **new** URL but remains queued/pending.
The subscription has returned to `onProbation` after the User's successful Enable
operation. This is new provider status, not evidence the User failed to click it.

The current ngrok agent still reports `0cab-...` with inspection disabled, the
coordinator/web/worker are running, and a fresh anonymous valid JSON POST to the
current exact route returns 401. Old endpoint snapshots, not a current endpoint
failure, explain the observed retry failure. No wrong source password is
established; do not rotate secrets. Evidence:
`logs/old-url-retries-restrict-subscription.json`,
`logs/service-hook-old-url-failed-history-ui.png`, and
`logs/service-hook-ngrok-offline-response-ui.png`. No operator retry, new provider
event or paid generation was performed. The new-query attempts for hypothetical
notification IDs 16/17 returned Not Found; the authoritative list still has fifteen
notifications, so those errors are not webhook delivery failures.

The recovery recommendation now changes: repeated Enable does not change the
URL snapshots of already queued deliveries. Disable the old subscription,
retaining its entire provider history, then prepare a replacement with the same
Repository/event/filters and protected source authentication at the current URL.
Only the replacement should be enabled; do not leave two live matching hooks.
This avoids carrying the old delivery queue into the practical check and preserves
the diagnostic evidence. Actual replacement creation and a new actual PR 1905
update/delivery are still pending, not executed or accepted. Microsoft documents
subscription creation via its
[REST contract](https://learn.microsoft.com/en-us/rest/api/azure/devops/hooks/subscriptions/create?view=azure-devops-rest-7.1);
no new application behavior or subscription-history deletion is needed.

Next small User-operated block: close History and choose **Disable** on the
existing updated-PR hook. Verify **Disabled** before creating the replacement in
the next block. Do not delete the old subscription, use a sample Test as real PR
evidence, or approve report generation. Factory still lacks current provider
inputs; publication/finalization remain pending, and Issue 20 remains open.

### Old subscription disabled by User; replacement Trigger preparation — 2026-10-12

The User disabled the old subscription. Read-only verification at
`2026-10-12T14:05:39.1146080Z` confirms
`6c55256a-bde5-4c0f-865e-f505f1e66345` has status `disabledByUser`.
Its provider history and queued/failed notification identities remain intact.
Saved filter projection: `logs/old-subscription-disabled-reference.json`.
The event is `git.pullrequest.updated`, resource version 1.0, exact TDP project
and tdp-project Repository GUIDs. Target branch, change/notification type,
created-by and reviewer-containing filters were all unrestricted; the internal
`tfsSubscriptionId` is provider-generated and must not be copied into a new
subscription manually. No password or authentication-header value is included
in the evidence projection.

The current ngrok HTTPS URL is unchanged, inspection is disabled, and anonymous
valid JSON POST to the exact observation route still returns 401. The old
subscription is now inactive; no replacement or duplicate live hook has been
created by the operator. Next small User-operated block: click **+**, select
**Web Hooks**, proceed to Trigger, choose **Pull request updated** and Repository
**tdp-project**, retaining the other filters as **Any**, then proceed to Action.
Stop there for the next credential/destination block. A replacement subscription,
new actual PR event/delivery, current private Review/decision, skipped publication
and separate finalization remain unexecuted. The historical report/decision are
preserved and Issue 20 stays open.

### Replacement updated-PR hook created; one live matching subscription — 2026-10-12

The User completed Action for the replacement Web Hook, using the current HTTPS
observation URL, unchecked untrusted-certificate acceptance, Basic username
`factory`, protected source secret, empty custom headers and All resource details.
The source secret was copied locally without chat disclosure. No sample Test was
requested by the operator or reported by the User.

Read-only subscription verification at `2026-10-12T14:12:01.2220563Z` confirms new
subscription `8fd6630e-c16e-4605-baf0-878bc5d35f41` is `enabled` with exact TDP
project/tdp-project Repository GUIDs, event `git.pullrequest.updated`, resource
version 1.0 and the current exact `0cab-...` observation URL. Its unrestricted
filters match the old subscription. The API omits the default resource-details
setting in both configurations; do not infer a delivery payload solely from that
omission. Verify actual event fields on receipt. Old subscription
`6c55256a-bde5-4c0f-865e-f505f1e66345` remains `disabledByUser`; assertions confirm
exactly one enabled matching subscription, with no duplicate live dispatch.
Evidence: `logs/replacement-subscription-created-verification.json`.

Fresh PR 1905 metadata retains the unchanged source and current target
`b162d64e5f968d53694ffc2b467f93275e52590d`, remains active, and contains only the
original required reviewer with vote 0. Factory still has one original observation,
no active run and 39 agent calls. Evidence:
`logs/replacement-hook-before-real-update.json`. Creating a replacement subscription
alone is not an actual PR delivery or proof of updated Factory inputs.

Next small User-operated block: add **Iskander Sierra Zaldivar** as a temporary
optional reviewer to PR 1905 again, without voting or changing the existing required
reviewer. This controlled real update should produce an event on the new
subscription; preserve its actual event/notification identity and inspect Factory
before any generation Approval. Remove the temporary optional reviewer again after
the delivery check. No new paid Review is authorized. The historical report and
decision remain intact, publication configuration is disabled, and current report,
publication outcome, finalization and operational cleanup remain pending.
Issue 20 remains open.

### New hook delivers real PR 1905 event; current target imported — 2026-10-12

The User added the temporary optional reviewer again without voting. Replacement
subscription `8fd6630e-c16e-4605-baf0-878bc5d35f41` notification 1, created at
`2026-10-12T14:15:16.72Z`, is **completed / succeeded**. Its actual provider event
is `1506dfd9-e1f5-4c4c-bc7f-70f5afaaa5ef`, resource PR 1905. The subscription
remains enabled. This is real provider delivery and resolves the ingress/probation
block for the replacement; the old subscription/history remains disabled/intact.
Evidence: `logs/new-hook-real-event-notifications.json`.

Factory retains new observation Fact `1c2b7593-a75f-4f35-ab4e-2b49edcd9bb4`
with source `155d29ef2775d6a58dff8232e681844f03651c82` and current target
`b162d64e5f968d53694ffc2b467f93275e52590d`. The same Work Item remains
`registered`. New automatic intake `cf239087-f2bc-4e6a-bf94-e8ee33c91438`
completed handoff to Review Run
`9b829e2527dd4532ae4fa2eb1fee2879bb202db02351acdeaae2d4afe33571c2`, now
`waiting-approval` and owning the Work Item. It has not been approved or generated
an additional report. Total agent-call rows remain 39. Evidence:
`logs/new-hook-real-event-factory-verification.json`.

The previously completed high-effort report and its human Review Decision are
preserved. `decisionUsable` now returns false for those historical inputs after
the actual new observation, confirming that local current-state checks recognize
the observed target change. No silent rebind, report replacement, publication
Activity, external comment or finalization occurred. The new automatic intake uses
the installed default brief **Review the observed repository change**, distinct
from the earlier User-operated experimental brief; do not claim that a future
paid run would be an identical-prompt effort comparison.

Code inspection of `reviewInputsCurrent` confirms it compares both fields and
Fact-ID bindings. Removing the temporary reviewer emits another relevant
observation even if commit values are unchanged, so cleanup after paid generation
would invalidate the report's retained bindings. Perform cleanup before any paid
Approval: remove only optional reviewer `dbca0d37-86ba-68c3-8ea2-825086b98d4b`
again, preserve the required reviewer and vote 0, then inspect the delivered
observation and current waiting Run. A stale human wait can be superseded through
the installed UI without rewriting history; do not approve it blindly. This
binding behavior is recorded as a practical limitation, not silently changed by
this walkthrough.

Next small User-operated block is that reviewer removal only. Actual cleanup
delivery, any necessary supersession/replacement wait, fresh budget authorization
for a fourth paid attempt, current report/decision, skipped publication and
separate finalization remain pending. The previous three-attempt authorization
does not authorize a fourth paid run. Publication configuration remains disabled,
and Issue 20 stays open.

### Reviewer cleanup delivered; unpaid waiting Review is stale — 2026-10-12

The User removed the temporary optional reviewer again. Fresh Azure CLI metadata
confirms PR 1905 still has only the original required reviewer, vote 0, unchanged
source `155d29ef2775d6a58dff8232e681844f03651c82` and current target
`b162d64e5f968d53694ffc2b467f93275e52590d`; it remains active. Replacement hook
notification 2, created at `2026-10-12T14:20:28.36Z`, is completed/succeeded.
Cleanup of the temporary reviewer is now complete.

Factory retained actual event `e526eb36-9243-40f0-ac16-3566077a3d24` in new
observation Fact `72ac60ad-f0e4-4666-a398-3dbbd8f20c56` with the same source and
target values as notification 1. Read-only `reviewInputsCurrent` verification at
`2026-10-12T14:21:00.072Z` confirms the existing pending Run
`9b829e2527dd4532ae4fa2eb1fee2879bb202db02351acdeaae2d4afe33571c2` is now stale
because it binds the preceding observation Fact. It remains `waiting-approval`,
with zero calls, and owns the Work Item. Total agent-call rows remain 39.
Evidence: `logs/new-hook-reviewer-cleanup-verification.json`. This confirms the
previously inspected Fact-binding behavior without claiming commit content changed.

Next small User-operated block: refresh the Factory Work Item, then click
**Supersede this review** for the active unpaid generation wait, not **Approve
report generation**. This preserves the wait's history and releases its ownership;
the enabled installed rule can then create a new intake/Review for the latest
observation. Refresh review after a short wait and inspect the resulting status.
Do not manually start a competing Run. Supersession, any replacement wait and
fresh fourth-attempt payment authorization remain pending. No current private
report or publication outcome is claimed, and the historical report/decision,
old hook history and evaluation remain intact. Issue 20 stays open.

### Board has two real PR correspondences; selected walkthrough remains PR 1905 — 2026-10-12

The User refreshed the Board and asked which of two registered cards to use.
Read-only provider-correspondence verification at `2026-10-12T14:46:34.473Z`
confirms the upper card **Separar verificación .NET por fases y preservar
paralelismo (#4390)** is the selected PR 1905, Work Item
`68c4f6ce-c196-4109-878c-9fa1dd81c695`. The lower card **Completar las consultas
globales de Client: fetch, list y count (#4334)** is another real PR, 1909, Work
Item `af49afb0-125a-4212-9f56-74ca0ebe1fd9`. The hook observes the Repository,
not only PR 1905; receiving another matching PR is consistent with its saved
unrestricted filters. It is not additional acceptance evidence for this selected
walkthrough. No work, publication, approval or merge is requested for PR 1909.

Both Work Items remain in Factory state `registered`, with independent Review
Runs in `waiting-approval`. Their active Runs each have zero calls/agent-call rows;
total historical generation remains 39 calls. Workflow execution waits do not
move the cards to another Factory state. Evidence:
`logs/two-board-items-provider-correspondence.json` and
`logs/two-board-items-ui.png`. Preserve both correspondences/history instead of
deleting the incidental real PR import or treating it as a duplicate.

The User has not yet reported superseding the stale PR 1905 wait. Next User block
still applies only to the upper PR 1905 card: open that Work Item, click **Supersede
this review** for active Run
`9b829e2527dd4532ae4fa2eb1fee2879bb202db02351acdeaae2d4afe33571c2`, then
refresh review and inspect any new wait. Do not approve generation in either card
before a new paid-attempt agreement for PR 1905. No permissions or model/limits
were changed during this Board explanation. Issue 20 and finalization remain open.

### Stale wait superseded; current unpaid Review and key budget verified — 2026-10-12

The User supplied a generation-wait screenshot. Read-only verification at
`2026-10-12T14:48:39.701Z` confirms the stale Run
`9b829e2527dd4532ae4fa2eb1fee2879bb202db02351acdeaae2d4afe33571c2` is
`superseded` with zero calls, preserving its history. The active replacement Run
`f9d47e34042eb1fc7805c67eaf98127d095a537506f59d08253a781c8b21c404` is
`waiting-approval`, has zero calls and passes `reviewInputsCurrent`. It binds
source `155d29ef2775d6a58dff8232e681844f03651c82` and target
`b162d64e5f968d53694ffc2b467f93275e52590d`, matching a fresh Azure CLI check.
The default automatic brief is **Review the observed repository change**, distinct
from the previous experimental brief; that difference is explicitly part of the
proposed current-target attempt.

Retained configuration version 3 selects `openai/gpt-6-luna`, OpenAI upstream,
`reasoningEffort: high`, twenty calls, ten minutes AI time, twenty minutes execution
and zero subordinate agents. Authenticated read-only OpenRouter checks confirm
model availability and dedicated-key lifetime limit USD 5, reset null, usage
USD 0.114586285, remaining USD 4.885413715, expiry
`2026-10-18T12:01:00.016Z`, and BYOK usage 0. No key or secret value is included in
evidence. All historical agent-call rows total 39. Evidence:
`logs/fourth-attempt-wait-and-budget-preflight.json` and
`logs/current-generation-wait-ui.png`.

Next required User decision: authorize a fourth paid private-report generation
for this current-target Run, up to twenty new calls (maximum 59 across four paid
attempts), preserving the retained model/high effort, ten/twenty-minute limits,
zero subordinate agents and same lifetime USD 5 key ceiling, with the default brief
named above; or leave it waiting. Earlier three-attempt authorization does not
cover this new paid Run. No model, effort, brief, limits or configuration were
changed by this verification, and no fourth paid call or generation Approval has
occurred. The unrelated PR 1909 wait remains untouched. Publication configuration
is still disabled; current private report/decision, explicit skipped-publication
outcome and separate finalization remain pending. Issue 20 stays open.

### Fourth paid attempt explicitly authorized; generation Approval still pending — 2026-10-12

The User answered **si** to the concrete fourth-attempt proposal: up to twenty new
calls, maximum 59 across four paid attempts, `openai/gpt-6-luna` with
`reasoningEffort: high`, ten minutes AI time, twenty minutes execution, zero
subordinate agents and the same dedicated USD 5 lifetime key without resets.
The proposal explicitly named the automatic brief **Review the observed repository
change**. This authorization does not include publication, approval or merge of
the Azure DevOps PR, or generation for the incidental PR 1909.

Final read-only preflight at `2026-10-12T14:52:14.635Z` confirms current unpaid Run
`f9d47e34042eb1fc7805c67eaf98127d095a537506f59d08253a781c8b21c404` still owns
the selected Work Item, is `waiting-approval`, has zero calls and passes current
input checks. Fresh Azure metadata matches source
`155d29ef2775d6a58dff8232e681844f03651c82` and target
`b162d64e5f968d53694ffc2b467f93275e52590d`. Assertions verify the retained model,
high effort and effective limits. Authenticated key metadata still reports usage
USD 0.114586285, remaining USD 4.885413715, lifetime limit USD 5 and reset null.
There are still 39 historical agent-call rows; no fourth paid dispatch has occurred.
Evidence: `logs/fourth-attempt-authorized-preflight.json`.

Next User-operated block: in the selected PR 1905 Work Item only, click **Approve
report generation** once, wait briefly and **Refresh review**. Expect the Run to
leave its generation Approval wait and progress through execution; generation can
finish at `waiting-review` or stop with retained evidence. Record actual calls,
time, cost and report outcome rather than promising completion. If an error is
shown, retain it before any retry. No new request, competing Run, changed limits
or implicit fallback is needed. Publication configuration remains disabled;
current report/decision, publication outcome and separate finalization remain
pending. Issue 20 stays open.

### Fourth paid attempt generates a current empty private report — 2026-10-12

The User reported `running` after approving report generation. The operator
monitored the authorized Run without another request, model/effort change,
limit increase or subordinate agent. Run
`f9d47e34042eb1fc7805c67eaf98127d095a537506f59d08253a781c8b21c404` reached
`waiting-review` with **9 completed calls**, zero pending/uncertain calls in this
attempt, **95,030 ms AI time** and **103,026 ms execution time**. It remains the
Work Item owner for the human Review Decision. Factory state is still `registered`.
Historical uncertain calls from stopped attempts remain unchanged.

Current private report
`aaa775f456122294665bffbc8d6d0e9a1a7a5659ab802cb936fbd55cb6b84557`
has **zero Findings**. Its summary is **Reviewed the CI phase split and the .NET
test/coverage runner changes. I found no actionable correctness regressions.**
The report binds source `155d29ef2775d6a58dff8232e681844f03651c82` and target
`b162d64e5f968d53694ffc2b467f93275e52590d`. Fresh Azure CLI metadata matches
both commits and shows the PR still active. The installed `reportCurrent` check
passes. Artifact verification confirms 144 bytes and SHA-256
`80383a8305837c025d9386f2d80f7798fd76944e9ef40a45feba118b595a1a0e`.
The generation sandbox is removed. A human Review Decision has not yet been
submitted for this new report. Evidence:
`logs/fourth-high-private-report-verification.json` and
`logs/fourth-paid-review-progress.json`.

Fourth-attempt cost is **USD 0.00946194**. Authenticated key usage is now
**USD 0.124048225**, remaining **USD 4.875951775**, with the same USD 5 lifetime
ceiling and reset null. Total agent-call rows are **48**, within the authorized
maximum 59. Early internal progress projections looked for cost inside response
usage and printed zero; the monitor was corrected to read retained
`agent_call.data.cost`. Zero in those early projections was not a zero-billing
claim. All paid-outcome figures above use retained costs and key reconciliation.
No provider comment, publication Activity or PR approval/merge occurred.

This current-target high-effort generation finished within unchanged time limits,
but it is not an identical-prompt reasoning experiment: it uses the installed
automatic brief and a new target. An empty generated report still requires explicit
human acknowledgement and a complete decision for this version; it does not prove
PR approval or acceptance of unexecuted operational checks.

Next small User-operated block: **Refresh review**, open **Private report ·
aaa775f456**, read the new summary and download its private Markdown. Identify the
new version rather than reusing the older `3808af30b87a...` report/download. Expected
UI is `waiting-review`, pending human Review Decision and **No Findings. Human
review is still required**. Preserve both reports/downloads. Do not submit another
paid Review or publish content during the reading block. Current human decision,
explicit skipped-publication outcome, allowed preparation/finalization, operational
backup/drill and cleanup remain pending. Issue 20 stays open.

### User requests a deliberate code defect to exercise nonempty publication — 2026-10-12

The User confirmed reading the current empty report, then requested deliberately
introducing an erroneous code change to see whether Review generates Findings
that can be published. This extends the practical exercise; it does not submit the
current report's Review Decision, authorize more paid calls, authorize publishing
Findings, or authorize PR approval/merge. Keep the current PR 1905 report and its
pending human decision intact.

Read-only inspection of PR 1905 iteration changes and source
`155d29ef2775d6a58dff8232e681844f03651c82` identifies a concrete candidate in
`scripts/test-dotnet.ps1`: the phase runner propagates the first failing project's
exit code through `$testExitCode`. Deliberately changing
`if ($failure) { $testExitCode = $failure.ExitCode }` to assign zero would cause the
non-coverage Fast test phase to report success despite a failed test process,
and could allow subsequent CI phases to run. The consequence must be demonstrated
with a failing-command harness before trusting a generated Finding. No fault has
been introduced yet. A harness using a simulated dotnet command would prove that
local exit-code behavior; it would remain test-harness evidence, distinct from
actual Azure PR commits, webhook delivery, paid Review and provider publication.

The proposed isolation is a clearly labeled disposable branch/PR in the same
Repository, based on the existing PR's source commit and targeting main, so the
original PR/report/history remain available. This base choice includes the phase
runner in the test branch and retains the currently allowed target branch. Other
options are modifying PR 1905 directly (which changes its commits and invalidates
current evidence) or using an isolated fixture (which cannot replace the desired
real-provider publication test). Model detection is an experimental outcome, not
guaranteed even for a known defect. A new private report would still require
complete human Review Decision, separate explicit publication authorization and
provider write configuration, with no PR merge.

The operator applied the brainstorming skill to choose the smallest verifiable
case before code changes and asked the User to choose a separate test PR
(recommended) or modifying PR 1905. That scope choice remains pending. No remote
branch, commit, new PR, code edit, configuration change, paid call or publication
was created during discovery. New paid-attempt budget and cleanup of the deliberate
error must be agreed before execution. The selected PR 1905's empty-decision,
skipped-publication and finalization checks remain pending; Issue 20 stays open.

### Same PR fault probe accepted; one-line commit pushed with regression evidence — 2026-10-12

The User chose **modify the same PR with a commit that we will later revert**.
This explicitly selects PR 1905 over the proposed separate-PR option. The accepted
case is a one-line failure-propagation defect in `scripts/test-dotnet.ps1`, with a
later additive revert commit preserving history. It is operator-authored test
setup outside the Factory; no code-modification Workflow, changed Factory domain
scope or new platform feature is introduced.

The implementation plan and current execution record are:

- [x] Read the target Repository's AGENTS.md and applicable workflow/testing rules.
- [x] Preserve the ordinary checkout and prepare an isolated worktree at the exact
  reviewed source commit, on a task-scoped local branch.
- [x] Demonstrate the original test runner's failure propagation with the existing
  coverage/phase regression suite and mandatory agent-tooling checks.
- [x] Change only the failing phase's assigned exit code to zero, leaving tests,
  dependencies, pipeline configuration and documentation unchanged in the PR.
- [x] Demonstrate the resulting known defect, record the reverse patch, commit and
  fast-forward push only the selected PR's source branch.
- [ ] Restore a stable reachable hook destination and retain a real observation of
  the pushed commit/current target; preserve the old queued notifications/history.
- [ ] Supersede the old report wait and agree a new private-generation budget.
- [ ] Record actual model Findings (or their absence), complete human Review
  Decision and request explicit User authorization before posting confirmed content.
- [ ] Configure narrowly scoped provider write access locally for actual posting,
  execute/reconcile publication and verify the provider comment.
- [ ] Add a revert commit for the injected fault and verify that only that change is
  removed, preserving any intervening legitimate work and all review history.

The ordinary checkout was initially clean on
`work-item/4399-standardize-query-results` at
`ec958e8a3e42abf154daf0910bfbbbe0e1eccd76`. Isolated worktree:
`C:/Users/iskan/AppData/Local/Temp/tbfactory-pr1905-defect-2c2d9807ed8545f2981438d35d41807a`,
local branch `work-item/4390-tbfactory-defect-probe`, base
`155d29ef2775d6a58dff8232e681844f03651c82`. The ordinary checkout later appeared
clean on main at `2596c53f3c2167648eeccd7aa11094d200d94689`, reflecting concurrent
external work; the operator did not switch its branch or edit its files.

Initial `just check-agents` failed in the formatting fixture because the new
worktree lacked its locked Markdown linter. Evidence was retained before running
`npm ci --ignore-scripts` for the already declared dependency. No dependency or
lockfile was changed. The repeated clean baseline passes **13 publication checks,
46 formatter/hook checks and 22 coverage/phase fixture executions**.
The direct original coverage suite also passes.

The only deliberate production diff is at `scripts/test-dotnet.ps1:96`:
`if ($failure) { $testExitCode = $failure.ExitCode }` becomes
`if ($failure) { $testExitCode = 0 }`. `git diff --check` passes and numstat is one
insertion/one deletion. The existing regression now fails with **validation-failure
exited with 0 instead of 42**. Mandatory `just check-agents` still passes its
publication and formatter/hook portions and fails at that same coverage assertion.
This is the intended known defect, not a passing check or a generated Finding.
Fixture evidence proves local script behavior; real Azure commits, provider
observations, AI detection and publication remain separate evidence categories.

Commit `eee116b2000f0b3017099656f4e86f7682e9c468`,
**test(ci): add reversible TBFactory fault probe (#4390)**, was pushed as a normal
fast-forward from `155d29e...` to only
`refs/heads/work-item/4390-ci-test-phases`. A fresh pre-push remote-ref check
matched the expected old commit; no force push or main write occurred. The reverse
patch passes `git apply --reverse --check`. Original file blob is
`6ec4ed8d68564a471eb0872d5870c25437f0a1b5`; the planned later rollback is
`git revert eee116b2000f0b3017099656f4e86f7682e9c468`, followed by selected-branch
push and read-back, subject to checking any intervening changes. No revert has yet
been executed.

Durable nonsecret evidence is copied to `logs/fault-probe-initial-baseline.log`,
`logs/fault-probe-baseline-passed.log`, `logs/fault-probe-injected-regression.log`
and `logs/fault-probe-commit.patch`. Additional task logs remain in
`C:/Users/iskan/AppData/Local/Temp/tbfactory-pr1905-defect-evidence-2c2d9807`.
Automatic approval review rejected an optional combined harness-detail/ingress
capture with the generic reason **blocked by policy**. That capture was not
repeated or treated as executed; existing complete regression logs establish the
fault without it.

### Fault commit observed by Azure; paused installation blocks hook delivery — 2026-10-12

Azure CLI confirms PR 1905 remains active with source `eee116b...` and current
target `2596c53f3c2167648eeccd7aa11094d200d94689`; main advanced independently
since the previous report. Replacement hook notification 7 is queued/pending for
actual event `2fc22824-0caa-4634-87e0-a89f0f5a73aa`, PR 1905 and those commits.
Its destination snapshot retains the previous `0cab-...` URL. The hook has returned
to `onProbation` after failures during the pause. Factory still retains the older
observations and Run `f9d47e...` in `waiting-review`, with 48 historical calls.
The local old-report current check remains true only because the new actual
provider observation has not arrived; do not approve/use that report as current
provider evidence. Evidence: `logs/deliberate-fault-provider-observation.json`.

Checks found both the coordinator and ngrok stopped. Stale worker ownership/lock
for PID 32332 was independently verified as stopped, preserved in
`logs/fault-probe-stopped-worker-evidence.json`, and recovered with the supported
operator command. The coordinator was restarted as a hidden background process;
status now shows coordinator running, web true and worker true. Backup/drill
remain overdue. The evaluation installation was not changed.

ngrok was restarted without inspection and with the existing exact-route traffic
policy, using documented automatic URL selection `--url=https://`. This account
currently returns `https://420a-83-46-187-16.ngrok-free.app`, different from the
previous URL. Do not claim verified stability from the command alone.
[ngrok's domain documentation](https://ngrok.com/docs/gateway/domains) describes a
free assigned Dev Domain; the operator asked the User for only its public name
from Dashboard Domains, without any token/API key or paid plan. That optional
input and ingress reconfiguration remain pending. Existing queued notifications
must not be relabeled as successfully delivered. No further paid Review, generated
Finding, publication or merge occurred. The deliberate fault is still present in
the unmerged PR and its planned revert remains pending. Issue 20 stays open.

### User pauses for the day; local ignored handoff saved — 2026-10-12

The User explicitly paused the walkthrough until tomorrow and requested the
handoff skill. The continuity document was initially created in Windows temporary
storage; the User then explicitly chose a local ignored Repository directory to
avoid losing it. The retained handoff is
`.runtime/handoffs/2026-10-12-pr1905.md`, ignored by the existing `.runtime/`
Git rule. No shared ignore rule, source configuration or branch was changed.
It references this issue and retained evidence instead of duplicating their full
history, redacts secret/identity values and includes suggested skills and the
concrete next-session sequence.

The ngrok Dev Domain question is still unanswered. No additional paid attempt,
publication, finalization or fault revert was authorized/executed during handoff.
The deliberate fault remains in the unmerged PR, and its later additive revert is
still required. Server/tunnel were observed running at pause; their survival into
tomorrow is not assumed. The existing credential expiry, stopped-process recovery,
queued notification, current-input and spending checks must precede resumption.
The operator stops task work at the User's request. All unresolved acceptance and
cleanup remain pending; Issue 20 and the MVP stay open.

### Resume preflight; stopped worker recovered, stable ingress still pending — 2026-10-15

The User resumed the real PR 1905 walkthrough, explicitly retaining the existing
evaluation, local changes and complete history. No fifth paid attempt is authorized.
Publication still requires separate explicit User authorization; PR approval and
merge are excluded. The selected source remains
`eee116b2000f0b3017099656f4e86f7682e9c468`, target
`2596c53f3c2167648eeccd7aa11094d200d94689`, and the PR is active. Fresh Azure metadata
also reports pre-existing auto-complete configuration. The operator did not change
it or approve/merge the PR; cancel auto-complete before a later rollback/push can
make CI pass. The isolated fault worktree is clean at the fault commit. The
ordinary checkout is independently on `work-item/4421-domain-property-documentation`
at `92e4a992d1da0c17ac5439b890609a3107b0a030` and was not changed.

Initial installation status was stopped, with no ngrok or Caddy process and no
listener on ports 3001/4040. The real database container is healthy. Existing Docker
evaluation containers were retained without changes; its Factory container reports
unhealthy, which is not repaired or accepted by this real-installation resumption.
Node is v24.14.1 and ngrok is 3.39.11; the installed ngrok configuration passes
`ngrok config check`. The existing built web entry dates from October 12; no build,
dependency update or modification of the pre-existing code changes was performed.

Read-only database inspection and local process checks agree that worker owner and
lock refer to stopped PID 56500 on this host and volume. Preserved evidence precedes
the supported `worker-recover-lock` operation, which returned recovered true for
that PID. The coordinator was then started hidden with the existing protected
environment. Fresh status confirms coordinator running, web true and worker true.
Backup and drill remain overdue. The collaborative browser opens
`http://localhost:3001/?view=board` and displays Sign in; a fresh interactive
Microsoft login/session remains unverified. No credentials were requested in chat.

Azure CLI authentication succeeds. The actual installed Repository read credential
also returns HTTP 200 for the fault commit. All four Organization secrets decrypt
successfully. Authenticated OpenRouter read-only metadata returns HTTP 200, model
availability and unchanged dedicated-key values: USD 5 lifetime limit, reset null,
usage USD 0.124048225, remaining USD 4.875951775, expiry
`2026-10-18T12:01:00.016Z`, and BYOK usage zero. Retained configuration version 3
still selects `openai/gpt-6-luna`, `reasoningEffort: high`, twenty calls, ten minutes
AI time, twenty minutes execution and zero subordinate agents. There are still
48 historical agent-call rows and no running execution. No generation Approval,
model request, increased limit or fifth-attempt authorization occurred.

PR 1905 Work Item `68c4f6ce-c196-4109-878c-9fa1dd81c695` remains registered, with
Run `f9d47e34042eb1fc7805c67eaf98127d095a537506f59d08253a781c8b21c404`
waiting-review and the retained empty report `aaa775f456...`. Factory has no
observation for fault event `2fc22824-0caa-4634-87e0-a89f0f5a73aa`; do not use the
old report as current provider evidence. Matching subscription
`8fd6630e-c16e-4605-baf0-878bc5d35f41` remains onProbation; its notification 7
for actual PR 1905 and the current fault/target commits is queued/pending with
the old `0cab-...` destination snapshot. Additional October 14 notifications are
also retained, including failed and queued entries; they are not proof of fault
delivery. The older subscription `6c55256a-bde5-4c0f-865e-f505f1e66345` remains
disabledByUser. No subscription, event ID, authentication secret or PR was changed.

Next small User block: provide only the assigned public Dev Domain name from
ngrok Dashboard > Domains. The question is pending; no tunnel URL has been assumed
or restarted. Current [ngrok domain documentation](https://ngrok.com/docs/gateway/domains)
describes stable assigned Dev Domains, but the earlier observed URL changes still
require account-specific verification. Then pin and verify the exact-route HTTPS
endpoint without Caddy, preserve old hook histories, and obtain a real current
observation before superseding the stale Review. Interactive login, current unpaid
Review preparation, a fresh explicit per-run/aggregate spending agreement, complete
Review Decision, explicitly authorized publication, additive fault revert and
separate finalization all remain pending. The tutorial's earlier max-effort example
does not override the User's retained high-effort choice. Issue 20 and the MVP remain
open.

Nonsecret evidence under the real installation's logs directory:
`resume-20261015-preflight.json`, `resume-20261015-provider-preflight.json`,
`resume-20261015-stopped-worker.json`, `resume-20261015-start.json`, and
`resume-20261015-101840.stdout.txt` / `.stderr.txt`. The PR was registered with
the thread's T3 pull-request linking tool. Existing repository changes were
preserved; this continuation only appends its actual results to this issue.

### Assigned ngrok Dev Domain supplied; automatic launch rejected — 2026-10-15

The User supplied the public assigned Dev Domain
`besiegingly-hypnotizable-miya.ngrok-free.dev`. Fresh status still confirms the
real coordinator, web and worker running, with no existing ngrok process.
The installed ngrok CLI supports explicit `--url`, disabled inspection and the
existing exact-route traffic policy. The intended endpoint forwards directly to
`http://127.0.0.1:3001`, without Caddy, permitting only POST to the authenticated
`/api/organizations/real-review/sources/tdp-prs/observations` route.

Automatic approval review rejected the hidden background ngrok launch before
execution with the generic reason **blocked by policy**. The launch was not
retried through another mechanism and no running tunnel or successful HTTPS
verification is claimed. The next User-operated block is to run the explicit
ngrok command locally with `--inspect=false` and the protected existing traffic
policy, then report readiness or the nonsecret error code. Do not share the
authtoken, API key, authentication header or raw request inspection.

After manual startup, verify the actual advertised URL matches the supplied
domain, public HTTPS routing restrictions and source authentication before
changing any service hook. Hook recovery/import, fresh unpaid Review, spending
agreement, human Review Decision, publication authorization, additive fault revert
and finalization remain pending. No hook change, paid call, Finding publication,
PR approval, merge or fault revert was performed in this block.

### Manual tunnel omitted all flags; discrepancy diagnosed — 2026-10-15

The User reported forwarding at `https://21ad-83-46-187-16.ngrok-free.app`.
Read-only process inspection identifies PID 50404, started at 10:32:42 local time,
running only `ngrok http http://127.0.0.1:3001`. The explicit domain,
`--inspect=false` and exact-route policy arguments are absent. The local agent API
confirms that random URL, upstream `http://127.0.0.1:3001` and inspection enabled.
This explains the observed discrepancy without assuming an account/domain failure.
Loss of the continuation lines during manual entry is a hypothesis, not a verified
User action. No authenticated request or secret was sent through this tunnel.

Anonymous read-only HTTPS probes show the assigned
`besiegingly-hypnotizable-miya.ngrok-free.dev` endpoint offline with
`ERR_NGROK_3200`. The random endpoint responds to GET `/` with HTTP 307 and GET on
the observation route with HTTP 401, confirming that the intended route policy
is not in effect. The hook destination remains unchanged. The User's next small
block is to stop this manually started tunnel with Ctrl+C and run the complete
explicit-domain command on a single line, retaining disabled inspection and the
existing policy file. Report the advertised URL or nonsecret error code before
any credential-bearing probe or hook recovery. No automatic launch retry, paid
generation, publication, PR approval/merge or fault revert occurred.

### Explicit Dev Domain connected; missing loopback host rewrite identified — 2026-10-15

The User restarted ngrok with the complete single-line command and reported the
assigned Dev Domain. Process PID 35436 and the local agent API confirm
`https://besiegingly-hypnotizable-miya.ngrok-free.dev`, upstream
`http://127.0.0.1:3001`, the existing traffic policy and inspection false. HTTPS
probes verify HTTP 404 for GET `/`, GET `/api/organizations`, GET the observation
route and POST `/`. However, both anonymous and installed-source-authenticated
POSTs containing invalid JSON return HTTP 403 instead of the expected 401/422.
No valid event was submitted; observation-delivery count remains six.
Evidence: `logs/stable-ingress-20261015-verification.json`, explicitly recording
verified false. This result is not successful source authentication or hook delivery.

The response is `Source ingestion requires HTTPS`. Inspection of the installed
HTTP guard and the earlier accepted ingress setup identifies the omitted
`--host-header=localhost:3001` argument. The operator's proposed command omitted
that previously documented requirement. The installed server does not trust
forwarded protocol by default; the existing development exception requires the
exact opted-in application origin. A direct anonymous POST to
`http://localhost:3001` returns 401, while the equivalent request to
`http://127.0.0.1:3001` returns 403. A separate Node fetch Host-header override did
not change that result and is not evidence that ngrok's host rewrite fails.

The next manual command restores the already accepted upstream
`http://localhost:3001` and `--host-header=localhost:3001`, retaining the explicit
Dev Domain, `--inspect=false`, `--log=false` and exact-route traffic policy.
No application/proxy-trust code, protected environment, service hook, source
binding or credential is changed. The User must restart the manual tunnel;
repeat HTTPS/authentication checks afterward before hook recovery or real import.
No paid generation, publication, PR approval/merge or fault revert occurred.

### User requests one new operator launch; corrected HTTPS ingress verified — 2026-10-15

The User explicitly requested one more operator-executed ngrok launch, with manual
fallback if unsuccessful. A fresh process inventory showed no existing ngrok
process. This newly requested single attempt was permitted and started hidden
PID 8392 at 10:54:22 local time, using upstream `http://localhost:3001`, explicit
`https://besiegingly-hypnotizable-miya.ngrok-free.dev`,
`--host-header=localhost:3001`, `--inspect=false`, `--log=false` and the existing
protected exact-route traffic policy. The earlier rejected launch remains recorded
as rejected; no alternative mechanism was used to evade that result.

At `2026-10-15T08:54:43.037Z`, the local agent API confirms exactly one tunnel with
the expected domain/upstream and inspection false. Seven public HTTPS checks pass:
GET `/`, GET `/auth/login`, GET the observation route, POST `/` and POST a different
source route all return 404; anonymous POST to the intended route returns 401;
POST with the installed source credential and deliberately invalid JSON returns
422. The last check validates source authentication and payload rejection, not a
provider event. Observation-delivery count remains six before/after. TLS uses
normal certificate verification, without insecure overrides or redirects.
Evidence: `logs/stable-ingress-20261015-corrected-verification.json` records
verified true. Process output is retained in
`logs/ngrok-corrected-20261015.stdout.txt` and `.stderr.txt`. Prior failed-verification
evidence is preserved separately.

The assigned domain now serves the intended authenticated route through ngrok
without Caddy. This does not yet prove successful Azure service-hook delivery or
stability across a future process restart. Preserve the verified command/domain
for subsequent starts. The next small User-operated block is to disable the
onProbation updated-PR subscription `8fd6630e-c16e-4605-baf0-878bc5d35f41`, retaining
its old URL snapshots and complete notification history. Keep the already disabled
`6c55256a-bde5-4c0f-865e-f505f1e66345` subscription unchanged. After read-back confirms
both disabled, prepare one replacement at the explicit Dev Domain and obtain a real
PR 1905 update observation; do not treat these ingress probes as real import.
No hook mutation, paid call, generation Approval, publication, fault revert, PR
approval or merge occurred during this block. Issue 20 and the MVP remain open.

### Both historical hooks disabled; replacement Trigger block ready — 2026-10-15

The User reported completing Disable. Fresh authenticated Azure read-back confirms
both updated-PR subscriptions `8fd6630e-c16e-4605-baf0-878bc5d35f41` and
`6c55256a-bde5-4c0f-865e-f505f1e66345` are disabledByUser. Their configurations,
old destination snapshots and notification histories are preserved; there is no
enabled matching subscription. Both retain exact TDP project/tdp-project Repository
filters with all other filters unrestricted. Do not copy the provider-generated
`tfsSubscriptionId` into a new subscription.

The local ngrok API still advertises the assigned Dev Domain, upstream
`http://localhost:3001` and inspection false. A fresh anonymous POST to the exact
public observation route returns 401. The next small User-operated block is to
create a Web Hooks subscription, choose Pull request updated and Repository
tdp-project, retain other Trigger filters as Any, then proceed to Action and stop
before finishing. The destination/authentication block follows separately. No
replacement, provider event, current Review, paid call, publication, fault revert,
PR approval or merge has been executed in this block. Issue 20 remains open.

### Replacement wizard reaches Action; source password copied locally — 2026-10-15

The User reported reaching Action in the replacement Web Hooks wizard. A fresh
anonymous HTTPS POST to the assigned domain's exact observation route still
returns 401. The protected `tdp-source.json` secret was compared locally with the
installed encrypted `source:tdp-prs` value and matches. The source password was
copied to the local clipboard without printing its value or sending it through
chat. No Azure PAT, OpenRouter key or new secret is needed for this field.

Next User-operated block: set Action URL to
`https://besiegingly-hypnotizable-miya.ngrok-free.dev/api/organizations/real-review/sources/tdp-prs/observations`,
Basic username `factory`, paste the local clipboard into the password field,
leave untrusted-certificate acceptance unchecked and custom headers empty, choose
All resource details, then Finish. Do not use a sample Test as actual PR evidence.
The replacement is not yet verified as created; read back its exact filters,
enabled state and destination after the User reports completion. Historical
subscriptions remain preserved and disabled. No paid call, generation Approval,
real provider observation, Finding publication, fault revert, PR approval or merge
occurred in this block.

### Stable-domain replacement enabled; real update and auto-complete cancellation pending — 2026-10-15

The User reported completing Finish. Authenticated Azure read-back at
`2026-10-15T10:10:24.2148939Z` confirms replacement subscription
`9e97c116-3354-4df6-bf66-923cdc78edff` is enabled, event
`git.pullrequest.updated`, resource version 1.0, Basic username `factory`, exact TDP
project/tdp-project Repository GUIDs, unrestricted remaining filters, and destination
`https://besiegingly-hypnotizable-miya.ngrok-free.dev/api/organizations/real-review/sources/tdp-prs/observations`.
The API omits the default resource-details value; the User was instructed to select
All and the actual event payload must still be checked. Both historical hooks
remain disabledByUser with their configuration/history retained. Exactly one
matching subscription is enabled. Evidence:
`logs/stable-hook-created-20261015-verification.json`.

The new hook has zero notifications at baseline. Factory retains six observation
deliveries, 48 agent-call rows and the old Run `f9d47e...` waiting-review; no fault
observation or fifth paid attempt has occurred. The ngrok API still confirms the
assigned domain and inspection false. Evidence:
`logs/stable-hook-before-real-update-20261015.json`.

Fresh PR metadata remains active at source `eee116b...` and target `2596c53...`,
with one required reviewer at vote zero and pre-existing auto-complete configured.
The next small User block is to cancel auto-complete in PR 1905, keeping the PR
active and without voting, approving or completing it. Read back the resulting
provider state and inspect whether the update produces a real notification; do
not assume that changing auto-complete necessarily emits the subscribed event.
If no event is emitted, prepare a separate minimal real update before generation.
Current Review preparation, spending agreement, complete Review Decision, explicit
publication authorization, additive fault revert and separate finalization remain
pending. No operator PR mutation, paid call or publication occurred in this block.

### Auto-complete cancelled; actual fault observation delivered and old report stale — 2026-10-15

The User cancelled auto-complete on PR 1905. Fresh Azure metadata confirms
autoCompleteConfigured false, PR active, unchanged source
`eee116b2000f0b3017099656f4e86f7682e9c468`, target
`2596c53f3c2167648eeccd7aa11094d200d94689`, and the existing sole required reviewer
at vote zero. No approval or merge occurred. This actual update emitted event
`c63bcc4d-a017-4462-bbbc-ab14aa03a703`, `git.pullrequest.updated`, created at
`2026-10-15T10:15:39.24Z`. The stable-domain subscription
`9e97c116-3354-4df6-bf66-923cdc78edff` notification 1 is completed/succeeded, with
actual resource PR 1905 and those exact source/target commits at the intended HTTPS
observation destination. Evidence: `logs/stable-hook-real-delivery-20261015.json`.

Factory independently retains that same event as observation delivery
`2f5d0e8c2832e4d6f9a7b801162f1d7be002c3fde6b83a0ddc5453cc7c160fd0`, Fact
`193277bd-5c0c-45b6-a098-11413c7c3d01`, on the existing PR 1905 Work Item
`68c4f6ce-c196-4109-878c-9fa1dd81c695`. Its provider, resource identity, branches,
active state and head/base match real Azure metadata. This is actual provider
delivery/import, not a sample Test, fabricated event or ingress rejection probe.
Older queued fault notifications and all prior evidence remain retained.

Read-only installed checks now return false for both `reportCurrent` on
`aaa775f456122294665bffbc8d6d0e9a1a7a5659ab802cb936fbd55cb6b84557` and
`reviewInputsCurrent` on old Run
`f9d47e34042eb1fc7805c67eaf98127d095a537506f59d08253a781c8b21c404`.
That Run still waits for human review and owns the registered Work Item. No new
Review has been requested or approved; historical agent calls remain 48. Evidence:
`logs/stable-hook-real-fault-import-20261015.json`.

Next small User-operated block: open the selected Work Item in the local Factory
(sign in if necessary), Refresh review, use Supersede this review for the stale
`f9d47e...` Run, then Refresh review and report the resulting wait. Preserve the
old report, decision history and all stopped/uncertain calls. Do not approve report
generation yet: inspect the new unpaid Run and exact current inputs, then agree
a separate fifth-attempt budget before any model call. Current report/decision,
explicit publication authorization/outcome, additive fault revert, separate
finalization and overdue operational checks remain pending. Issue 20 and the MVP
remain open. No incidental PR Work Item was changed.

### Current fault Review waits unpaid; fifth-attempt budget proposed — 2026-10-15

The User supplied a waiting-approval screenshot after superseding the old Review.
Read-only verification at `2026-10-15T10:21:44.796Z` confirms old Run
`f9d47e34042eb1fc7805c67eaf98127d095a537506f59d08253a781c8b21c404` is superseded,
preserving the old reports and all history. New active Run
`f252692fdeff9859cab8a199d50f484f4367d748781e8f7605fbcc0bd707dbf2` is
waiting-approval with zero calls, zero AI/execution time and current inputs. It binds
source `eee116b2000f0b3017099656f4e86f7682e9c468` and target
`2596c53f3c2167648eeccd7aa11094d200d94689`, matching fresh Azure PR metadata. The
PR remains active with auto-complete false. The retained automatic brief is
Review the observed repository change.

Retained configuration version 3 remains `openai/gpt-6-luna`, reasoningEffort high,
twenty calls, ten minutes AI time, twenty minutes execution and zero subordinate
agents. Historical call rows remain 48. Authenticated read-only key metadata still
reports HTTP 200, USD 5 lifetime ceiling, reset null, usage USD 0.124048225, remaining
USD 4.875951775, expiry `2026-10-18T12:01:00.016Z` and BYOK usage zero. The sum of
retained call costs is USD 0.104344025 and does not fully reconcile to key usage;
aggregate spending is reported from the authenticated key metadata, preserving
historical stopped/uncertain evidence rather than treating missing cost as zero
billing. Evidence: `logs/fifth-attempt-unpaid-budget-preflight-20261015.json`.

The concrete proposal now awaiting explicit User agreement is one fifth paid
private-report generation for this current fault Run, up to twenty new calls
(maximum 68 historical call rows across five paid attempts), unchanged model/high
effort, ten/twenty-minute limits, zero subordinate agents, the named automatic brief
and the existing USD 5 lifetime key ceiling without resets or an increased limit.
This is a proposal, not authorization. No fifth model call or generation Approval
has occurred. After agreement, recheck the exact Run and inputs before asking the
User to approve generation once. This budget agreement does not authorize Finding
publication, PR approval/merge, or Review for incidental PRs. Complete Review
Decision, separate explicit publication authorization/outcome, fault revert and
finalization remain pending. Issue 20 and the MVP remain open.

### Fifth paid attempt explicitly authorized; generation Approval pending — 2026-10-15

The User answered yes to the concrete fifth-attempt budget: one private-report
generation, up to twenty new calls and maximum 68 cumulative call rows across
five paid attempts, `openai/gpt-6-luna`, reasoningEffort high, ten minutes AI time,
twenty minutes execution, zero subordinate agents, the retained automatic brief
Review the observed repository change, and the unchanged dedicated USD 5 lifetime
key ceiling without resets. This does not authorize Findings publication, PR
approval/merge, another attempt or generation for incidental PRs.

Final preflight at `2026-10-15T10:24:57.892Z` asserts that Run
`f252692fdeff9859cab8a199d50f484f4367d748781e8f7605fbcc0bd707dbf2` still owns
PR 1905's Work Item, is waiting-approval with zero calls and current inputs, and
retains the authorized model, effort and every effective limit. Source
`eee116b2000f0b3017099656f4e86f7682e9c468` and target
`2596c53f3c2167648eeccd7aa11094d200d94689` match fresh Azure metadata; the PR is
active and auto-complete false. Historical calls remain 48. Authenticated key
metadata still shows USD 5 limit, reset null, usage USD 0.124048225, remaining
USD 4.875951775 and future expiry `2026-10-18T12:01:00.016Z`.
Evidence: `logs/fifth-attempt-authorized-preflight-20261015.json`.

Next User-operated block: in this Work Item only, click Approve report generation
once, then Refresh review and report the displayed execution state or error.
Preserve any failure evidence before retrying; the agreement is for this attempt
and does not authorize an automatic sixth attempt. No fifth model call or human
generation Approval has occurred at this preflight. Current report/decision,
explicit publication authorization/outcome, additive fault revert and separate
finalization remain pending; Issue 20 stays open.

### Fifth attempt detects the deliberate fault but stops on invalid Finding linkage — 2026-10-15

The User approved report generation and reported Running. The authorized Run
`f252692fdeff9859cab8a199d50f484f4367d748781e8f7605fbcc0bd707dbf2` stopped with
Invalid previous Finding relationship after six completed calls, 38,324 ms AI time
and 44,626 ms execution time. This attempt has no pending/uncertain model call;
the historical uncertain-call evidence is unchanged. Total historical calls are
54, within the fifth-attempt authorization of 68. Retained fifth-attempt cost is
USD 0.007084555. Authenticated key usage rose from USD 0.124048225 to USD 0.13113278,
matching that exact delta; remaining budget is USD 4.86886722 under the unchanged
USD 5 lifetime ceiling and reset null.

The retained final text contains one high-severity candidate Finding at
`scripts/test-dotnet.ps1:96`: Test failures are reported as successful. Its
explanation identifies the deliberately introduced `$testExitCode = 0` assignment
and CI failure suppression. This is actual model detection of the known defect,
but not an accepted private Review Report or a publishable confirmed Finding.
The candidate includes `assessment: still-applicable` without `previousFinding`.
Both previous reports have zero Findings, so there is no previous Finding identity
to reference. JSON/report-schema parsing succeeds, but the worker correctly rejects
the invalid relationship before staging or attaching a report. The stopped Run has
no prepared/attached report and releases Work Item ownership; only the two earlier
reports remain. Docker confirms its sandbox container is removed.

Evidence: `logs/fifth-paid-review-progress-20261015.json` and
`logs/fifth-attempt-stopped-diagnosis-20261015.json`. The latter exports only the
final candidate, execution/cost metadata and relationship diagnosis; raw prompts,
reasoning and credential values were not printed. The original retained response
and all historical evidence remain unchanged. No manual promotion, relationship
normalization, Review Decision, publication or new attempt was performed.

The root cause investigation found an ambiguous agent instruction: its JSON example
included assessment beside an optional previous ID without explicitly requiring the
pair. A local one-line instruction correction in `src/server/review-agent.ts` now
shows a new Finding without either relationship field, requires both fields for a
relationship to an exact supplied previous Finding ID, and prohibits orphan
assessments or invented IDs. The worker/schema validation remains unchanged. This
clarifies model guidance; it does not prove a future live response will comply or
recover the stopped attempt. All pre-existing local code changes were preserved.

`npm run typecheck` passes. Targeted existing local Review tests were prepared for
generation Approval, immutable report supersession/revalidation and OpenRouter
routing/cost retention. Their prerequisite dedicated test database
`tbfactory-acceptance-db` was found stopped. Automatic approval review rejected its
startup command before execution with blocked by policy. The startup was not
retried by another mechanism; the container remains stopped and these tests have
not run. The real installation and existing Docker evaluation were not restarted
or changed. The corrected instruction is local and not yet loaded by the running
real worker.

Next small User block: run `docker start tbfactory-acceptance-db` locally and report
readiness or the nonsecret error, so the operator can run those isolated fixture
tests and stop that dedicated container afterward while retaining its volume.
Then load the verified instruction through the supported worker lifecycle and
inspect an unpaid current Review before any new budget agreement. No sixth paid
attempt is authorized. Full valid report, complete human Review Decision, explicit
publication authorization/outcome, additive fault revert and separate finalization
remain pending. The deliberate fault is still present in the unmerged PR. Issue 20
and the MVP remain open; fixture tests cannot replace real walkthrough acceptance.

### Prompt clarification passes local checks and is loaded; new unpaid Review pending — 2026-10-15

The User started `tbfactory-acceptance-db` manually. Initial inspection found it
healthy/running but disconnected from every Docker network, despite configured
networkMode bridge and a loopback-only 18000-to-8000 port binding. The readiness
probe failed with ECONNREFUSED. An early test command was interrupted without
results. Read-only Docker inspection established the missing network attachment;
the operator connected only this dedicated test container to its configured bridge
network. The port then appeared as `127.0.0.1:18000->8000/tcp` and `/ready` returned
HTTP 200. No real/evaluation database was changed or recreated, and no volume was
removed.

The directed command
`node --import tsx --test --test-concurrency=1 --test-name-pattern='Automatic Facts|Generation Approval|OpenRouter forwards' tests/reviews.test.ts`
passes three tests with zero failures in 33.818 seconds. These cover generation
Approval/empty-report human waits, automatic supersession with immutable reports
and valid previous-Finding revalidation, and OpenRouter reasoning/upstream/cost
retention. Evidence: `logs/fifth-prompt-clarification-tests-20261015.log`.
These are isolated fixture checks, not proof that a new live model response will
obey the clarified instruction. The dedicated test container was stopped afterward,
retaining its volume and restored bridge attachment. `npm run typecheck` and
`npm run format:check` also pass. No test mirrors the prompt text or calls a paid
provider.

Before loading the source change, preflight confirmed 54 historical calls, no
running/queued/preparing/recovery-required Workflow Run, and no owner Run on the
selected Work Item. Evidence: `logs/prompt-worker-restart-preflight-20261015.json`.
The supported installation stop returned stopped true. A hidden coordinator restart
then succeeded, reloading the TypeScript worker and corrected instruction. Fresh
status confirms coordinator running, web true and worker true; new coordinator PID
40176 and worker PID 37192 are observations, not future process identities.
Backup/drill remain overdue. Restart evidence:
`logs/prompt-worker-restart-20261015.json`, its named stdout/stderr logs, and
`logs/prompt-worker-restarted-verification-20261015.json`. The latter retains the
review-agent source SHA-256 and confirms the fifth Run is still stopped, the
selected Work Item remains registered without active ownership, and calls remain
54. The stable-domain anonymous ingress probe still returns 401. No history,
rejected candidate or report was rewritten; the existing Docker evaluation remains
unchanged.

Read-only authorization for the actual human User confirms request-review does
not need an extra transition Approval, while review.generate requires human
Approval. Therefore a manual request can safely prepare an unpaid generation wait.
Authenticated OpenRouter metadata remains USD 5 lifetime limit, reset null, usage
USD 0.13113278, remaining USD 4.86886722 and expiry
`2026-10-18T12:01:00.016Z`. No sixth paid attempt is authorized.

Next small User block: Refresh Work Item actions for PR 1905, use request-review
with reviewBrief `Review the observed repository change`, then Request request-review
and Refresh review. Stop at waiting-approval without Approve report generation.
Inspect that new Run, current provider inputs, model/high effort and limits before
agreeing any sixth-attempt budget. Complete valid report, human Review Decision,
separate explicit publication authorization/outcome, additive fault revert and
finalization remain pending. The deliberate fault remains in the active unmerged
PR. Issue 20 and the MVP remain open.

### Manual intake receipt conflict reproduced and repaired; sixth attempt still unpaid — 2026-10-15

The User supplied a waiting-prerequisites screenshot after requesting the new
Review. Intake `dbae52bf-f560-483d-985e-14fa750f4d74`, identity kind user, has
zero calls and the correct brief. The generic UI error was Workflow failed;
inspect execution evidence. Read-only Mastra snapshot inspection identifies
handoff failure AlreadyExistsError: receipt
`d4ff3db01307757f422ad954cb7725dfd29afa073a117025b3016c5158a0cb1d` already exists.
Evidence: `logs/sixth-intake-prerequisite-diagnosis-20261015.json`,
`logs/sixth-intake-mastra-failure-20261015.json` and
`logs/manual-intake-receipt-conflict-20261015.json`.

The existing receipt belongs to the earlier automatic Service Identity dispatch
of observation Fact `193277bd-5c0c-45b6-a098-11413c7c3d01`. Its ID is derived from
Work Item/cause/configuration rather than the requesting User. The pending local
receipt queries filtered by execution User, so a new human intake did not find the
existing receipt and attempted to create the same ID. No input Fact, provider
credential or permission is missing. The real coordinator was stopped through the
supported lifecycle to stop repeated failed handoffs and preserve evidence; the
intake was not cancelled or replaced.

A new regression in `tests/reviews.test.ts` exercises an automatic Review, explicit
supersession, then a human request against the same cause. It first failed with
the same waiting-prerequisites symptom. The minimum correction in
`src/server/review-worker.ts` removes the requesting-User filter from the two
automatic-review receipt lookups while retaining Organization, operation and cause
identity. This preserves original receipts across Service Identity/human requests
and configuration versions. Existing authorization and generation Approval checks
remain unchanged; no receipt or history is overwritten.

A recovery check then reproduced a second issue: the new Review inherited its
intake's historical error. The new child Review now clears that inherited current
error; the completed intake retains its earlier error for history. The regression
asserts both behaviors and receipt preservation. Retained red logs:
`logs/manual-intake-receipt-red-20261015.log` and
`logs/manual-intake-error-inheritance-red-20261015.log`. The final directed command
using the name pattern A human review request reuses the automatic receipt,
An observed intake preserves its receipt, Automatic Facts, and Generation Approval
passes four tests with zero failures in 41.921 seconds. Evidence:
`logs/manual-intake-receipt-and-error-green-20261015.log`; the earlier four-test
green result is also preserved separately. Type checking passes. These fixture
checks do not constitute live Review/publication/finalization acceptance.

The dedicated test database was started for these checks and stopped afterward,
retaining its volume. No real/evaluation database was recreated. Recovery preflight
confirmed the selected intake still owns the Work Item, zero calls, 54 historical
calls and human generation Approval required. It also retained a fingerprint of
the original receipt. After the supported hidden coordinator startup, the SAME
intake completed handoff to Review Run
`3b741729ac90209f94b17194dd60408d181951f6544e56d5140f1e917b2e5b26`, now
waiting-approval with zero calls and no current error. Its inputs are current:
source `eee116b2000f0b3017099656f4e86f7682e9c468`, target
`2596c53f3c2167648eeccd7aa11094d200d94689`. The old receipt's fingerprint is
unchanged. The completed intake retains its old error; the fifth paid Run and
candidate remain unchanged. Evidence: `logs/manual-intake-recovery-preflight-20261015.json`,
`logs/manual-intake-recovery-start-20261015.json`, its named stdout/stderr logs and
`logs/sixth-unpaid-review-recovery-20261015.json`.

Real coordinator/web/worker are running; backup/drill remain overdue. Fresh Azure
reads confirm PR 1905 active, auto-complete false and unchanged commits; the
stable-domain hook remains enabled. Retained model is openai/gpt-6-luna with
reasoningEffort high, twenty calls, ten minutes AI time, twenty minutes execution,
zero subordinate agents and brief Review the observed repository change.
Authenticated key metadata is unchanged: USD 5 lifetime ceiling, reset null, usage
USD 0.13113278, remaining USD 4.86886722, expiry `2026-10-18T12:01:00.016Z`.
No new paid call occurred; historical calls remain 54.

Next User decision: authorize one sixth paid generation for this exact current Run,
up to twenty new calls (maximum 74 cumulative call rows across six paid attempts),
unchanged model/high effort, brief, ten/twenty-minute limits, zero subordinate
agents and existing USD 5 lifetime ceiling; or leave the Run unpaid. This is a
proposal, not authorization. Refresh review can display the recovered wait; do not
approve report generation until the new agreement and final preflight. Full valid
report, complete human Review Decision, separate explicit publication authorization,
additive fault revert and separate finalization remain pending. Issue 20 and the
MVP remain open. All pre-existing local changes and immutable evidence are retained.

### Sixth paid attempt explicitly authorized; generation Approval pending — 2026-10-15

The User answered yes to one sixth paid generation with the proposed unchanged
model `openai/gpt-6-luna`, reasoningEffort high, up to twenty new calls (maximum
74 cumulative call rows), ten minutes AI time, twenty minutes execution, zero
subordinate agents, the same automatic brief and USD 5 lifetime key ceiling without
resets or a limit increase. This authorization applies only to the current PR 1905
Run and does not include another attempt, incidental PRs, Finding publication,
PR approval or merge.

Final read-only preflight at `2026-10-15T11:13:44.090Z` asserts Run
`3b741729ac90209f94b17194dd60408d181951f6544e56d5140f1e917b2e5b26` owns the
selected Work Item, is waiting-approval with no current error, zero calls and
current inputs. Source `eee116b2000f0b3017099656f4e86f7682e9c468` and target
`2596c53f3c2167648eeccd7aa11094d200d94689` match fresh Azure metadata. The PR
remains active with auto-complete false. The retained brief is Review the observed
repository change, and all effective limits/model/effort match the agreement.
Historical calls remain 54. Authenticated key metadata reports USD 5 limit, reset
null, usage USD 0.13113278, remaining USD 4.86886722 and expiry
`2026-10-18T12:01:00.016Z`. Evidence:
`logs/sixth-attempt-authorized-preflight-20261015.json`.

Next User-operated block: click Approve report generation once on this Run, then
Refresh review and report the state. No sixth model call or generation Approval
has occurred at this preflight. Preserve any new error before considering recovery;
there is no seventh-attempt authorization. Valid report, complete human Review
Decision, separate explicit publication authorization/outcome, additive fault
revert and finalization remain pending. Issue 20 and the MVP stay open.

### Sixth attempt produces a current valid report with the deliberate-fault Finding — 2026-10-15

The User approved generation and reported Running. Authorized Run
`3b741729ac90209f94b17194dd60408d181951f6544e56d5140f1e917b2e5b26` reached
waiting-review after seven completed calls, 49,270 ms AI time and 56,639 ms execution
time. This attempt has no reserved/uncertain call. Historical calls total 61, within
the authorized ceiling of 74. Model/effort remain `openai/gpt-6-luna`/high, without
subordinate agents or a changed budget. Work Item state remains registered and
this Run retains ownership for the human Review Decision. No further paid attempt
was started or authorized.

Accepted private report
`ce1297d5e3634eca09d514749db75083ae33d387da5fb270556789190f536959` contains
one proposed high-severity Finding, Test failures are never propagated, ID
`4b40b3b3fc03c4fe35bd3da354f4d249ae0bb051166f9ee073857008320e8d5a`, at
`scripts/test-dotnet.ps1:96`. It identifies the deliberate `$testExitCode = 0`
assignment, discarded failing-project exit code and the resulting masked CI test
and coverage-validation failures. The summary is The new test runner contains a
failure-propagation bug that can make CI report success when .NET tests fail.
This Finding has neither an invented previous ID nor an orphan assessment. It
matches the previously retained one-line fault/regression evidence; a fresh read
of the isolated worktree confirms the injected line remains present.

The report binds source `eee116b2000f0b3017099656f4e86f7682e9c468` and target
`2596c53f3c2167648eeccd7aa11094d200d94689`. Fresh Azure metadata matches both,
with the PR active and auto-complete false. Installed reportCurrent passes.
Artifact verification passes for 551 bytes and SHA-256
`999157344aeadd297790466e37ea4df81d9e44f304898f777f6766834f716544`.
The generation sandbox container is removed. All earlier reports, rejected fifth
candidate, stopped/uncertain execution evidence and immutable Facts remain retained.
Evidence: `logs/sixth-paid-review-progress-20261015.json` and
`logs/sixth-private-report-verification-20261015.json`.

The seven retained call costs total USD 0.007725695. Authenticated key metadata at
11:21:37 and again at `2026-10-15T11:22:17.948Z` reports lifetime usage USD 0.13765863
and remaining USD 4.86234137, under the same USD 5 ceiling and reset null. The key
usage delta from the preflight is USD 0.00652585, which does not yet fully match
the retained-call sum (difference USD 0.001199845). Both values are preserved;
do not claim completed cost reconciliation or zero billing for that difference.
Evidence: `logs/sixth-key-cost-reconciliation-20261015.json`. Recheck metadata
during the next independent verification rather than running another generation.

Next small User block: Refresh review, open Private report ce1297d5e363, read and
download its private Markdown. The single Finding corresponds to the accepted
deliberate defect; if the User agrees after reading, choose Confirm, acknowledge
review of this report version/all Findings, and Submit consolidated Review Decision.
Verify the complete report-version-bound decision and Review completion afterward.
Do not request publication yet: separate explicit User authorization and narrowly
scoped provider write configuration remain pending. Additive fault revert and
separate finalization follow the verified publication outcome. Issue 20 and the MVP
remain open; no Review Decision, provider post, PR approval/merge or revert occurred
during report verification.

### Complete human Review Decision verified; publication preview ready, write credential pending — 2026-10-15

The User reported submitting the consolidated Review Decision. Read-only evidence
confirms Fact `43c05f27-7896-4a37-bc51-2ff819b9a26f`, kind review.decision,
reviewed true, bound to report
`ce1297d5e3634eca09d514749db75083ae33d387da5fb270556789190f536959` and Run
`3b741729ac90209f94b17194dd60408d181951f6544e56d5140f1e917b2e5b26`. It confirms
the report's sole Finding `4b40b3b3fc03c4fe35bd3da354f4d249ae0bb051166f9ee073857008320e8d5a`.
Installed decisionUsable and reportCurrent checks pass. The Review Workflow Run is
completed, Work Item ownership is released, and Factory state remains registered.
Fresh Azure metadata still matches source eee116b... and target 2596c53..., PR active
and auto-complete false. No PR vote/approval or merge occurred.

The exact consolidated comment was prepared through the installed confirmedContent,
publicationId and publicationContent helpers without creating an external Activity
or calling the provider. It contains only the confirmed Finding title/severity,
explanation and `scripts/test-dotnet.ps1:96`, plus the standard reconciliation
marker for proposed Activity
`7f66c733cfc447cb747d9d86ec679765ca120c0aeba487bf992b533bd47e683b`, attempt 1.
Destination is exactly PR 1905. The User's publication policy requires separate
human Approval. Evidence with the complete preview:
`logs/current-decision-publication-preview-20261015.json`.

The same independent key read now reports usage USD 0.138858475 and remaining
USD 4.861141525 under the unchanged USD 5 lifetime ceiling. The sixth-attempt
delta is USD 0.007725695, now exactly matching its seven retained call costs. The
earlier metadata mismatch is resolved without replay or another paid call; the
original snapshots remain retained. Historical calls remain 61.

Publication configuration remains disabled and references the earlier skip-only
read credential. No real publication key is installed. A protected local draft at
`C:/protected/tbfactory-real-1905/tdp-publication-write-1905.json` was created with
enabled false, a distinct publication credential identifier and an empty key. It
has not been applied through the operator. Existing configuration/secrets are
unchanged. Provider write authorization must be prepared before the final explicit
User publication decision; no source/read/AI secret will be reused as a write PAT.

Next small User block: open Azure DevOps Personal access tokens > New Token and
prepare a TestJG-only publication PAT with short expiry and custom Code read/write
and PR Threads read/write scopes, as available in the UI. The
[thread creation API](https://learn.microsoft.com/en-us/rest/api/azure/devops/git/pull-request-threads/create?view=azure-devops-rest-7.1)
documents vso.code_write and vso.threads_full. Stop before Create so local secret
capture can be prepared; never paste the PAT into chat or Git. The actual provider
comment, explicit publication authorization, additive fault revert and separate
finalization remain pending. Issue 20 and the MVP stay open.

### Existing PAT inventory checked before requesting another credential — 2026-10-15

The User recalled an existing PAT for the experiments and requested verification.
Local protected-file metadata and installed Organization secret purposes confirm
Repository credential `tdp-read-1905` exists and still reads PR 1905 with HTTP 200.
Protected `tdp-access.json` matches that encrypted credential. The disabled
publication credential `tdp-skip-read-1905` contains the SAME PAT, not an independent
write token. The new protected publication draft still has an empty key and has
not been applied. No PAT value, ciphertext or raw authentication header was shown.

Authenticated read-only Azure PAT metadata listing succeeds and identifies two
relevant existing entries:

- TBFactory PR1905 read: scope vso.code; expires
  `2026-11-17T12:28:40.01Z`.
- HOME TDP Factory Pilot - 2026-11: scopes vso.build, vso.code_write and
  vso.work_write; expires `2026-11-21T14:54:52.6666667Z`.

The latter is a possible existing write credential for the experiment, but its
secret is not installed in this isolated Factory and actual comment publication
has not been tested. Its listed scopes do not include vso.threads_full explicitly;
do not claim verified posting access or modify its scopes without further evidence.
The PAT list returns metadata, not the saved token value. Evidence:
`logs/registered-pat-metadata-20261015.json`, with names/scopes/expiry/IDs only.
Related Azure PAT environment-variable presence checks are false in this session.

An initial metadata command failed because an ampersand in the URL was interpreted
by the Windows az.cmd boundary as another command. The corrected GET uses only
the API-version query parameter and succeeds. No create, regenerate, update,
revoke, permission escalation or provider POST was performed. The earlier blanket
instruction to create a new PAT was premature before checking this inventory.

Next clarification: confirm whether the User means the existing Factory Pilot PAT
and, if its value is retained in a protected local file, request only that file's
path. Inspect locally without disclosing the value before deciding whether a new
token is needed. Do not change the read credential or copy unrelated general-use
credentials automatically. Publication remains disabled and still requires the
separate explicit User authorization for the prepared PR 1905 comment. Review
Decision/history, deliberate-fault revert and finalization status remain unchanged.

### User chooses a new publication PAT; protected local input helper prepared — 2026-10-15

The User explained that PAT values are normally retained only by the process that
uses them and chose to create a new PAT for publication. The existing read PAT,
Factory Pilot PAT and their scopes remain unchanged. No recovery/regeneration of
unrelated credentials is requested. No token value is needed through chat.

The protected publication draft still has enabled false and an empty key. A small
local helper, `C:/protected/tbfactory-real-1905/save-publication-pat.ps1`, now reads
the new PAT through a hidden SecureString prompt and writes it only into that
protected draft. It validates the exact Organization/Repository/source/credential
and endpoint, requires publication disabled, and refuses to replace an existing
saved key. It does not call Azure, install configuration or request publication.
PowerShell AST parsing passes; the helper has not been executed. Its inherited ACL
grants access only to the current Windows User and SYSTEM.

Next small User block: create the new TestJG publication PAT with the previously
specified custom scopes and short expiry, copy its value locally, run the helper
with `pwsh -NoProfile -File C:/protected/tbfactory-real-1905/save-publication-pat.ps1`,
paste into its hidden prompt and press Enter. Report only saved/completed or a
nonsecret error. Then inspect nonsecret token metadata and local read access,
install a disabled publication destination and show the exact comment before the
final explicit publication authorization. Do not post a test comment or expose the
key in chat/screenshots. No new PAT is yet verified as created or saved, and no
publication or additional paid generation has occurred. Issue 20 remains open.

### New publication PAT verified and registered with destination disabled — 2026-10-15

The User reported saving the new publication PAT through the protected local
helper. Azure metadata identifies `TBFactory PR1905 publication`, authorization
ID `9069f376-31f0-48c4-98b6-6d12c18d6fc4`, restricted to the TestJG account
`f69c4cce-de55-4ac3-812d-950fa62e5995`, with scopes vso.code_write and
vso.threads_full. Its actual expiry is `2026-11-14T14:43:38.3266667Z`, rather
than the earlier suggested next-day expiry. Metadata evidence:
`logs/publication-pat-metadata-20261015.json`. No token value was printed.

Read-only HTTPS preflight with that PAT returned HTTP 200 for the exact Repository,
PR 1905 and its threads. Repository/project identities match the configured source.
PR remains active at source eee116b... and target 2596c53..., with auto-complete
false. Nine existing threads were returned; none contains the proposed publication
marker. These GETs and listed scopes do not establish successful provider POST
permission. No test comment or other provider write was attempted. Evidence:
`logs/publication-pat-read-preflight-20261015.json`.

The supported operator publication-configure command successfully registered
credential `tdp-publication-write-1905` for real-review / tdp-project / tdp-prs at
<https://dev.azure.com>, with enabled false and confirmed-content mode. Configuration
and destination version are `17cc02f9-eee4-473a-8b84-55038f87eb7a`. Decrypting the
installed secret and comparing it in memory verified an exact match to the saved
input. The plaintext key property was then removed from the protected input JSON;
the encrypted credential remains available to Factory. The previous encrypted
skip-only publication credential is retained. No credential value or ciphertext
was included in evidence.

Fresh installed checks confirm reportCurrent and decisionUsable, completed Review
Run `3b741729ac90209f94b17194dd60408d181951f6544e56d5140f1e917b2e5b26`, and
Decision Fact `43c05f27-7896-4a37-bc51-2ff819b9a26f`. The Work Item remains
registered with no active Run. There are no external Activities and no Run
publication. Historical Agent Call count remains 61. Evidence with the exact
prepared comment and disabled destination:
`logs/publication-disabled-registration-20261015.json`.

Next small User block: review the exact consolidated confirmed-Finding comment and
give explicit authorization to publish it to PR 1905. Publication has NOT been
authorized by saving the PAT. After authorization, enable the prepared destination,
request publication through the normal application flow, and obtain the separate
human Approval required by policy. Verify the actual provider thread and retained
Activity outcome before reverting only the deliberate fault through a new commit.
No further paid generation is authorized. Separate finalization and remaining real
acceptance steps are pending; Issue 20 and the MVP remain open.

### User authorizes Factory publication; destination enabled and preflight current — 2026-10-15

The User clarified that publication must be performed by the Factory Workflow,
then explicitly authorized proceeding with “Adelante”. This authorizes the normal
Factory publication flow for the previously shown single confirmed Finding on
PR 1905. It does not authorize a manual provider POST, another paid Review,
PR approval or merge. The application still requires its separate Activity-bound
human Approval.

The protected configuration now has enabled true and no plaintext key. The
supported publication-configure operator command installed the enabled destination,
version `5a7e26b5-2815-43d7-adb4-f2bbfe03b9b8`. The installed destination resolver
successfully matches the existing correspondence to PR 1905 and the exact TestJG
project/Repository. Coordinator, web and worker are running; installation status
still reports the existing overdue backup and drill, so its exit code is 1 rather
than a claim of complete installation health.

Fresh checks at `2026-10-15T14:29:31.704Z` confirm the retained report and Review
Decision remain current, Review Run completed, Work Item registered with no active
Run, no publication and zero external Activities. Historical Agent Calls remain
61. Read-only Azure checks confirm active PR, source eee116b..., target 2596c53...,
auto-complete false, nine existing threads and no proposed publication marker.
Evidence: `logs/publication-authorized-enabled-preflight-20261015.json`.

The collaborative preview remains on the Factory sign-in screen; the User's
separate authenticated browser session is not shared with it. Next small manual
block in that session: refresh the PR 1905 Review, open private report ce1297d5e363,
and click **Request publication of confirmed Findings** once. Stop at the resulting
publication status so its Activity bindings and Approval wait can be checked before
the separate **Approve this publication Activity** action. No application request,
Approval or provider publication has yet been executed in this block. Fault revert,
separate finalization and remaining real acceptance work stay pending. Issue 20
and the MVP remain open.

### Factory publication request verified at the separate Approval wait — 2026-10-15

The User clicked Request publication of confirmed Findings and stopped before
Approval. Fresh read-only verification confirms external Activity
`06d11a660eefdf7b550bc785289211fd56f34b64193141d5f27baa3cbf669bc2`, attempt 1,
status waiting-approval, with dispatchAuthorized false and no Approval. The retained
Review Run now has status publication-waiting-approval and owns the Work Item;
Factory state remains registered. Request Fact:
`6e91208a-e805-48d4-a668-b24474eaf577`.

Activity bindings match Run 3b741729ac90, report ce1297d5e363, Decision
43c05f27-7896-4a37-bc51-2ff819b9a26f and enabled destination version
5a7e26b5-2815-43d7-adb4-f2bbfe03b9b8 for PR 1905. Confirmed Finding content
matches exactly, reportCurrent and decisionUsable pass, the private Artifact
integrity check passes, current execution access requires human Approval, and
ownership is correct. Historical Agent Calls remain 61. No Approval was simulated,
submitted or bypassed by the agent.

Correction to the earlier agent-generated preview: its proposed Activity marker
7f66c733cfc4 used publicationId(run, decision). The installed initial-request path
actually uses publicationId(run), yielding 06d11a660eef; decision-bound IDs apply
to subsequent Activities after a corrected Review Decision. This is expected
installed behavior, not a changed Finding or a duplicate publication. The actual
Activity's standard marker is retained in the fresh evidence. No model output,
report, Review Decision or application code was edited to accommodate the preview.

Read-only Azure checks still show active PR, source eee116b..., target 2596c53...,
auto-complete false and nine existing threads. Neither the actual nor preview
publication marker appears in the returned threads. Evidence:
`logs/publication-waiting-approval-verification-20261015.json`.

Next small User block: click **Approve this publication Activity** once and report
the resulting status. This is the application's separate human Approval for the
already authorized Factory publication. Then independently verify the Factory
Activity outcome, dispatch/completion Facts and exact provider comment. Do not
repeat the publication request or POST if execution becomes uncertain. The
additive deliberate-fault revert and separate finalization remain pending. Issue
20 and the MVP stay open.

### Factory publication completed and exact Azure thread independently verified — 2026-10-15

The User reported approving the publication Activity and requested verification
plus a link for manual inspection. Read-only verification at
`2026-10-15T14:54:36.886Z` confirms Activity
`06d11a660eefdf7b550bc785289211fd56f34b64193141d5f27baa3cbf669bc2` completed
on attempt 1 with no error. The retained human Approval binding is valid and the
Factory recorded dispatch authorization and completion. The Review Run is completed
and Work Item ownership is released; Factory state remains registered.

Retained Facts show the actual Factory execution sequence:

- Human Approval: `ab4839e6-9b61-42be-b61a-8a38d661dc06`.
- Dispatch reservation: `2b170466-f602-46f5-9a0c-527fe9de2627`.
- Dispatch authorization: `d49f890d-fd3b-4bc3-a409-87b831933289`.
- Publication completion: `51751309-9fa2-47cd-a13e-502e7a137615`.

An independent Azure threads GET returns ten threads and exactly one nondeleted
thread/comment matching the complete Activity content, including its attempt marker.
Provider thread ID 22906, comment ID 1, was published at
`2026-10-15T14:53:22.423Z` under the publication PAT owner's displayed identity,
Iskander Sierra. Provider content digest
`5a181393fe63eb13254c4c9b7bd2b067bdd42d21e3a62490c0aa7cb88215ab88` matches
the Factory's retained effect. The agent performed read-only checks; the Factory
worker performed the provider POST. No manual duplicate or reconciliation retry
was needed.

Manual inspection link:
[PR 1905 published Finding, thread 22906](https://dev.azure.com/TestJG/TDP/_git/tdp-project/pullrequest/1905?discussionId=22906).
Full whitelisted evidence:
`logs/publication-completed-provider-verification-20261015.json`.

The report and Review Decision remain current. PR remains active at source
eee116b... and target 2596c53..., with auto-complete false. Historical Agent Calls
remain 61. No new paid generation, PR vote, approval or merge occurred. The User's
manual inspection is pending; the deliberate defect has not yet been reverted.
Next is the previously authorized additive commit reverting only eee116b..., after
this small manual inspection block, followed by separate Factory finalization and
remaining real acceptance work. Preserve the published thread and all historical
Facts/reports/Activities. Issue 20 and the MVP remain open.

### Deliberate fault reverted additively; Factory stopped and hook paused — 2026-10-15

The User confirmed manual inspection of the real published Finding succeeded,
then requested reverting the last PR 1905 commit, stopping Factory and guidance
about disconnecting the webhook. Fresh preflight confirmed the remote source
still ended at deliberate fault eee116b2000f0b3017099656f4e86f7682e9c468 and
the existing isolated worktree was clean at that commit. The ordinary target
checkout had independently moved to work-item/4423-evolving-state-records at
9ca076255f9d6690301f4b5586bbda8660a61960; it was preserved unchanged.

To avoid deliveries to the stopped installation, the exact experiment service
hook 9e97c116-3354-4df6-bf66-923cdc78edff was changed from enabled to
disabledByUser through the supported Azure subscription replacement API. Its
configuration and history are retained; it was not deleted. The source credential
was compared in memory with the installed encrypted secret before preparing the
protected replacement body, because the provider GET does not return the same
plaintext password. The replacement retains the installed source credential.
Read-back confirms disabledByUser. Both old experiment hooks remain disabled too.
The User does not need to disconnect the hook again.

The supported installation stop command returned stopped true. Independent status
shows coordinator stopped and no listener on port 3001. The exact experiment ngrok
process, identified by the stable domain and protected traffic-policy path, was
stopped as well; no matching tunnel remains. The real database container remains
healthy and running, with its volume, key ring, Artifacts and evidence retained.
The separate Docker evaluation and unrelated containers were not stopped or
modified. Existing overdue backup/drill health remains unresolved.

In the existing isolated worktree, git revert --no-commit prepared exactly one
line restoration: scripts/test-dotnet.ps1 assigns the actual failure ExitCode
again. The staged complete tree equalled eee116b's parent tree before committing.
Mandatory just check-agents passed with exit 0: 13 publication checks, 46 formatter
and hook checks, and 22 coverage/phase fixture executions. This includes the
existing failure-propagation regression. Log:
`logs/fault-revert-check-agents-20261015.log`. Staged whitespace checks passed.

New commit `b8d97f800d2332d3344bd05da7a59e078ee7789e` reverts eee116b... and
was pushed normally to refs/heads/work-item/4390-ci-test-phases. Its only parent
is the deliberate fault commit and its complete tree equals the pre-probe tree.
No reset, force push, history deletion, main write, PR vote/approval or merge was
performed. The isolated worktree is clean. Azure read-back confirms the new source
commit and active PR with auto-complete unset and reviewer vote 0. The published
thread 22906 and all Factory Review/Decision/publication history remain retained.

The PR is NOT yet merge-ready: main has independently advanced to
`5e457dced7c4302b910989223ffe9c9085174d56`, and Azure reports mergeStatus
conflicts. Read-only git merge-tree analysis (no merge/rebase or working-tree
changes) confirms two unrelated conflict paths:

- modules/projects/docs/testing.md
- modules/projects/tests/Tdp.Projects.Api.IntegrationTests/Composition/ProjectsCompositionTests.cs

These conflicts were not folded into the one-line deliberate-fault revert. Policy
evaluations are queued; the source-branch build query returned no runs at the
check time, so no remote CI success is claimed. Merge analysis evidence:
`logs/fault-revert-merge-analysis-20261015.log`. Consolidated shutdown/revert
verification: `logs/fault-revert-shutdown-verification-20261015.json`.

Next work: resolve the two source/main conflicts separately and verify remote
policies before claiming readiness to complete the PR. When resuming Factory,
start and verify the installation and stable HTTPS tunnel before re-enabling the
retained hook, then import the new commits. The old Review is historical evidence
for the injected fault, not a fresh assessment of the reverted source/current
main; hook-disabled updates were not imported. No additional paid Review is
authorized. Separate Factory finalization and remaining real acceptance work stay
pending. Issue 20 and the MVP remain open.

### First MVP version accepted by the User — 2026-10-15

After manually inspecting the real Factory-published Finding, the User explicitly
confirmed the Factory works and accepted closure of its first MVP version. The
User acknowledged remaining MVP issues and deferred user-experience improvements
and review-skill quality to another iteration. This decision supersedes the
previous instruction to keep this acceptance ticket and the MVP map open until
all remaining live walkthrough steps were executed.

This closure rests on the actual real-provider results recorded above: Microsoft
OIDC and explicit Membership, authenticated stable-HTTPS service-hook delivery,
real isolated commit checkout, budget-authorized AI Review with
openai/gpt-6-luna / reasoningEffort high, complete human Review Decision, separate
publication request and human Approval, Factory worker publication, exact provider
read-back and the User's manual inspection. Report ce1297d5e363, Decision
43c05f27-7896-4a37-bc51-2ff819b9a26f and completed Activity 06d11a660eef are
retained. Azure PR 1905 thread 22906 contains the confirmed Finding. No fixture is
being promoted to live evidence and no additional paid call was made for closure.

Acceptance is explicitly bounded: the separate Review Finalization Workflow did
NOT run on this real-provider Work Item, which remains registered in the retained
installation. It is carried forward in
[Issue 23](23-deferred-real-provider-finalization.md), with resumption prerequisites
and renewed evidence/budget requirements. Historical Docker finalization evidence
remains distinct. This is product-version acceptance, not a runtime State Transition,
a production-readiness claim, or proof of general review quality.

Next-iteration improvement areas are recorded without designing or implementing
them:

- [Issue 21: user experience](21-next-iteration-user-experience.md).
- [Issue 22: review-skill quality](22-next-iteration-review-skill-quality.md).

Issues 16 and 18 remain deferred and Issue 17 remains suspended without a claimed
fix. Existing production recovery prerequisites and overdue backup/drill health
remain recorded. Factory and ngrok stay stopped; the hook stays disabled and all
credentials/data/evaluation/history remain retained. The additive target-project
revert is complete; its unrelated source/main conflicts and remote policies remain
outside this Factory acceptance decision. No PR approval or merge was performed.

Issue 20 and the MVP specification now have State closed by explicit User
acceptance of the first version. The unchecked live finalization exercise has not
been marked complete; its separate open ticket preserves the remaining work. All
historical comments, unsuccessful/uncertain attempts and original evidence remain.

### MVP branch preparation and saved local acceptance changes — 2026-10-15

The User requested saving local changes and identifying the implementation branches
that should be prepared for a pull request. The acceptance update and follow-ups
were committed as 1645bbb48e010dc8ba8a5681d58d4920970c2b65 on
feat/mvp-first-review-experience. The branch was pushed normally to origin and its
remote head was verified; no pull request was created and main was not modified.

After fetching origin, main remains at e32d44807ae08ea9614526e8a8f9cfaee4a51f68.
The sole pending MVP implementation branch is feat/mvp-first-review-experience:
its commits deliver the first real Review experience, explicitly opted-in HTTP
localhost OIDC callbacks, sandbox/resource and intake regressions, and first-version
acceptance with recorded follow-ups. The branch contains origin/main and the
read-only merge analysis is clean. The earlier implement/*, fix/* and
integration/factory-mvp-acceptance branches are already ancestors of origin/main;
they do not require additional implementation PRs.

The clean worktree branch t3code/diagnose-worker-ownership-recovery retains one
unmerged diagnostic commit f5f36a9, while missing 19 main commits. It is separate
from the MVP delivery and remains associated with suspended Issue 17. It was not
merged, rebased, deleted or included in the candidate branch. All existing local
branches and both worktrees are retained.

Fresh verification for the candidate passed root format:check, typecheck,
production build, whitespace checks and seven directed tests covering OIDC
transport, repository-tool output/path behavior, sandbox command serialization
and Board navigation/cards. The build reports dependency use-client bundling
warnings but exits 0. Full npm test was not run: automatic approval review rejected
starting the isolated tbfactory-acceptance-db container with “blocked by policy”.
The User explicitly chose to leave the complete suite pending. The rejection was
not retried through an alternative mechanism, and no test failure or full-suite
success is inferred. Factory and the experiment tunnel remain stopped.

Nonsecret verification logs: logs/mvp-pr-typecheck-20261015.log,
logs/mvp-pr-build-20261015.log, logs/mvp-pr-unit-tests-20261015.log and
logs/mvp-branch-inventory-20261015.json. Prepare one PR from
feat/mvp-first-review-experience to main; the pending full-suite validation must
remain visible in its validation notes. This documentation-only preparation
record does not reopen accepted MVP scope or authorize a PR merge.
