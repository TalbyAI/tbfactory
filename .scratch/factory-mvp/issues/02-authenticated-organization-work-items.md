# Create an authenticated, Organization-scoped Work Item

Status: ready-for-agent
Type: HITL
Labels: wayfinder:grilling
Assignee: Codex
State: closed
User stories covered: 1, 2, 3, 4, 9, 10, 11, 48, 49, 50, 51, 68

## Parent

[TBFactory MVP specification](../spec.md)

## What to build

Deliver the first usable Factory path: an authenticated User selects an Organization, creates a Work Item through protected UI operations or the public API, and inspects its persistent immutable Fact history. Include the Organization's Project and optional Repository ownership and independent Memberships.

Human checkpoint: Agree the external identity provider/protocol, User mapping, Membership bootstrap, external API authentication, and isolated secret-storage approach before dependent implementation. Record the initial persistence and command contracts before implementing them.

## Acceptance criteria

- [x] A User can authenticate externally and access each Organization for which the User has an independent Membership; authentication alone grants no Activity permission.
- [x] Protected UI operations and the public API can create and retrieve an authorized Work Item with its own identity, exactly one Organization and Project, and an optional Repository. No external source is required.
- [x] Each Project belongs to one Organization and each Repository to one Project; mismatched ownership and cross-Organization access are rejected.
- [x] Facts cannot be rewritten or deleted through Factory operations. Corrections append new Facts and retain the original occurrences.
- [x] A Work Item can reference an external resource without claiming its unique primary correspondence.
- [x] Persist Users, Memberships, ownership, Work Items, and history across restart; isolate Organization data, credentials, and policies.
- [x] Activate single-use, expiring, revocable Invitations only for the authenticated recipient with the verified invited email; require explicit invitation authority and bounded initial permission grants.
- [x] Issue expiring, revocable User-associated API credentials restricted to one Organization and bounded by current Membership and permissions.
- [x] Persist an application-managed, versioned key ring protected by a separately supplied deployment root key, and document and exercise backup and restoration of encrypted secrets without silently replacing missing keys.
- [x] Provide a runnable public-operation check using two Organizations, independent Memberships, invalid ownership, and append-only corrections, plus a minimal UI create/history scenario.

## Blocked by

None - can start immediately

## Comments

### Work started — 2026-10-03

Claimed by Codex through wayfinder. Resolve the human checkpoint and record the initial persistence and command contracts with the User before dependent implementation. The parent map includes execution, but this ticket remains open until its acceptance criteria are delivered and verified. Working branch: `design/authenticated-organization-work-items`.

### Human checkpoint — Round 1 — 2026-10-03

The User agreed the following decisions in live conversation:

- **Configurable identity:** identity-provider configuration must support different installation environments, including a self-hosted provider. Do not require a single managed identity service. The configuration scope, protocol, supported provider contract, and validation targets remain unresolved.
- **Explicit initial provisioning:** the installation operator explicitly provisions Organizations and initial Memberships for the initial increment. Self-service onboarding is not part of this initial path.
- **User-associated API access:** public API callers initially act on behalf of a User and are subject to that User's Memberships and current permissions. Independently identified machine callers are not required for this increment. Automatic Workflow Runs retain the already accepted Organization-specific Service Identity.

Repository inspection found no existing production authentication, provisioning, or secret-storage implementation to retain. These decisions refine the human checkpoint without changing the accepted separation between external authentication and Factory-owned authorization. The ticket remains open; no implementation acceptance criterion is complete.

### Human checkpoint — Round 2 — 2026-10-03

The User agreed or refined the following decisions:

- **Installation-level identity configuration:** configure the primary identity provider per installation. Depending on that provider's capabilities, Organization-specific external identity providers may be enabled. Keep the MVP minimal. The initial protocol, validation targets, and whether any Organization-level provider configuration is implemented in this increment remain to be clarified; do not assume that capability is either required now or permanently excluded.
- **User creation and invitation activation:** create the Factory User on first valid authentication, initially without Memberships or Activity permissions. Also provide an invitation mechanism whose successful activation configures access to the specific Organization that invited the recipient. Invitation issuance authority, recipient binding, initial permission grants, delivery, expiry, and revocation remain open.
- **Organization-scoped API credentials:** each initial API credential belongs to a User, is restricted to one Organization, expires, and is revocable. Effective access is bounded by that User's current Membership and permissions; a credential cannot grant additional authority. Exact credential lifetime and permission narrowing remain open.
- **Application-managed key ring:** the installation must not require an external secret manager. Persist secrets encrypted, with a key ring managed by the application. This refines the proposed single deployment-supplied key; key-ring bootstrap, persistent location, rotation, protection, backup, and recovery still need explicit contracts.

These are accepted requirements. Proposed implementation mechanisms and unresolved details are not accepted by implication. Explicit Organization provisioning remains the initial onboarding path; invitation activation is an authorized extension of Membership provisioning.

### Human checkpoint — Round 3 — 2026-10-03

- **Minimum OIDC integration:** the User accepted one installation-configured OpenID Connect connection. Identity federation is managed by the selected provider; Factory-managed configuration of external identity providers per Organization is deferred to a provider-dependent extension.
- **Invitation recipient:** the User accepted an invitation addressed to a specific email, requiring authentication with that verified email before activation. The invitation is single-use, expires, and is revocable; possession of the link alone grants no access. Provider trust and the exact verification contract still need to be specified.
- **Invitation authority and delivery:** the User accepted issuance by a User with explicit invitation permission, bounded authority to assign initial Membership permissions, and generation of a shareable link. Automatic email delivery is deferred.
- **Key-ring persistence remains unresolved:** the User requested a detailed explanation before confirming the proposed separate persistent volume, versioned keys, explicit rotation, retained decryption keys, and coordinated backup/recovery. Do not treat any of these mechanisms as accepted yet. Application management of the key ring itself remains accepted from Round 2.

The [primary-source research note](../research/identity-contracts.md) provides factual OIDC and key-management constraints; it is evidence for the discussion, not an accepted Factory design.

### Human checkpoint — Key-ring custody and backup requirement — 2026-10-03

The User accepted the explained scheme: SurrealDB stores encrypted secrets and key identifiers; the application generates and manages a versioned key ring in a separate persistent volume; a separately supplied deployment root key protects that ring. The application retains needed decryption keys across restarts and explicit rotation. The operator custodies the root key. Recovery requires compatible database and key-ring backups plus the corresponding root key; missing keys must not trigger silent regeneration.

The User additionally requires a key-ring backup plan. The [key-ring backup and recovery plan](../../../docs/operations/key-ring-backup.md) records the proposed operational procedure. Backup destination, cadence, retention, recovery objectives, and restore-drill frequency remain proposed until confirmed. This agreement resolves the prior key-ring storage question, not the remaining identity/persistence contracts or implementation acceptance criteria.

### Human checkpoint — Round 4 — 2026-10-03

The User confirmed all three recommendations from the next round:

- **Initial backup policy:** back up the database daily, retain recovery points for at least 30 days, and exercise restoration monthly. Additionally back up and verify every changed ring generation before activating new keys. These defaults are configurable per installation. Keep required ring/root-key versions for as long as retained data backups need them. The actual recovery destination and measured recovery-time objective are installation-specific.
- **External identity mapping:** identify each initial Factory User by the exact OIDC (`issuer`, `subject`) pair. Different external identities remain separate Users even if their email matches. Do not automatically merge Users by email. Preserving existing Memberships when changing identity providers requires an explicit migration; account-linking or provider-migration tooling is not added to this initial increment.
- **Initial credential lifetimes:** Invitations expire after 7 days by default. API credentials have a maximum lifetime of 90 days. Both settings are installation-configurable, may be shortened, and support immediate revocation.

These policies are accepted. The full persistence/operation contracts still require review before dependent implementation; the ticket remains open and its delivery criteria remain unchecked.

### Concrete contract draft — 2026-10-03

The [authenticated Work Item design](../designs/authenticated-organization-work-items.md) collects the proposed initial schemas, operation contracts, shared UI/API rules, Invitation edge cases, manual Fact boundaries, recovery behavior, and public-flow verification. Previously confirmed product decisions remain accepted; additional design choices await User review. In particular, the proposed browser-session lifetime, minimal initial state-flow definition, activation-time delegation checks, existing/revoked Membership handling, and one-time-secret response-loss behavior have not been independently confirmed.

### Design confirmed; implementation handoff — 2026-10-03

The User explicitly confirmed the complete concrete design as shared understanding, including the additional choices listed above, and requested implementation in a new session. The design and referenced backup procedure are now accepted; the human checkpoint is complete. Proceed to implementation planning and delivery without reopening confirmed decisions. Investigate current technical API/package facts against primary sources as needed.

The ticket is `ready-for-agent` but remains `State: open` with delivery criteria unchecked. Work on `design/authenticated-organization-work-items` and preserve the existing uncommitted documentation. No application implementation, acceptance tests, design commit, or pull request has been created in this session. Close this issue and add its named resolution link to the parent map only after its own implementation, review, and required checks pass. The scheduled production backup/deployment work remains explicitly owned by the installation ticket.

### Resolution — 2026-10-03

Delivered the accepted production increment on `design/authenticated-organization-work-items`:
shared protected UI/public operations, configurable OIDC identity, independent Memberships,
bounded Invitations and API credentials, transactional Work Items and immutable Facts,
and a protected versioned key ring with verified backup and manual recovery. Existing
accepted documentation and isolated prototypes were preserved.

All ten criteria are complete. Typechecking, the production build and all 14 behavioral
tests pass. The production acceptance script passes five groups with real persistent
SurrealDB, two Organizations, concurrency, process/database restarts, isolated database
restore and both key versions. The browser create/history and explicit Invitation
acceptance drills pass. Independent Standards and Spec reviews have no remaining
actionable findings after corrections. See the [delivery evidence](../evidence/authenticated-organization-work-items.md)
and [operation runbook](../../../docs/operations/authenticated-work-items.md) for
coverage, exact commands and limits.

Closed only after these checks. The triage status remains within the canonical status
vocabulary; lifecycle is recorded by `State: closed`. Deployment scheduling, real
off-host custody, monitoring, retention and measured recovery time remain owned by
the installation ticket. No pull request, push to `main`, or deployment is performed.
