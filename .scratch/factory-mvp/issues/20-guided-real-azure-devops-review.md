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
- [ ] Validate Microsoft OIDC compatibility and Membership without identity merging.
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
