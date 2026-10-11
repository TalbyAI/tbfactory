# Your first real Azure DevOps Review

This tutorial walks through one real pull request with your existing Microsoft
account. The initial Repository is
[tdp-project](https://dev.azure.com/TestJG/TDP/_git/tdp-project), in Azure DevOps
organization `TestJG` and project `TDP`. You can choose another Repository before
configuration. Select the pull request during the guided session.

The live walkthrough is pending. The Docker evaluation uses fixtures and does not
prove that your Microsoft account, Azure DevOps credentials or OpenRouter account
work. Complete the preparation with the installation operator, then follow the
browser steps. Never paste PATs, API keys or client secrets into chat or Git.

## 1. Prepare your account and installation

Open [Microsoft Entra admin center](https://entra.microsoft.com), select the
directory used by your Azure DevOps account, and go to **Entra ID > Overview**.
Copy **Directory (tenant) ID**. It is a GUID, not `TestJG`, your email, an
application client ID or a subscription ID. In Azure DevOps, **Organization
settings > Microsoft Entra ID** identifies the connected directory when you have
access. If you use a personal Microsoft account or cannot access these settings,
tell the operator; do not guess a tenant or change the organization's directory.

The User supplied tenant `b6c9961c-042d-4750-aa03-00df693c6c5b` for this exercise.
Its relationship to the actual account and Repository still needs login validation.
Public OIDC discovery was checked on 2026-10-08. It returns issuer
`https://login.microsoftonline.com/b6c9961c-042d-4750-aa03-00df693c6c5b/v2.0`
and supports both installed client-secret authentication methods. This verifies
metadata availability, not the app registration, account login or Membership.

The operator registers a confidential Web application with the exact Factory
`/auth/callback` redirect URI and configures its tenant-specific OIDC issuer,
client ID and protected client secret. Validate discovery, issuer matching and
the actual authorization-code/PKCE login. The existing application supports
`client_secret_post` and `client_secret_basic`; this walkthrough must prove the
selected Microsoft configuration. See
[Microsoft OIDC](https://learn.microsoft.com/en-us/entra/identity-platform/v2-protocols-oidc).

For a native local development walkthrough, the User selected
`http://localhost:3001/auth/callback` on 2026-10-11, without Caddy. Microsoft accepted
this Web redirect URI. Set `FACTORY_ORIGIN=http://localhost:3001`,
`FACTORY_PORT=3001` and explicitly enable `FACTORY_ALLOW_LOOPBACK_HTTP=true` in the
isolated installation. The Microsoft issuer remains HTTPS. The application checks
issuer and callback transport separately, permitting HTTP only on loopback with
that opt-in. Keep the existing Secure, HttpOnly cookies and prove their behavior
through the actual browser login; registration and a login redirect alone do not
prove a completed session. This development exception does not replace the public
HTTPS endpoint required for Azure DevOps service hooks or production HTTPS.

Use a separate real-provider installation with independent database, installation
identity, root key, key ring, Workflow and Artifact paths. Follow
[installation](persistent-shared-installation.md) and
[private Review setup](durable-private-reviews.md#installation). Retain the existing
evaluation stack unchanged. It uses a test identity provider that must remain
loopback-only. Real-provider evaluation is not production disaster-recovery acceptance.

**Expected result:** Sign in with your own Microsoft account. Factory displays
your identity. Initially, **No Organization access** is valid: authentication
alone does not establish Membership. The operator uses the authenticated User's
exact issuer/subject pair for provisioning, not an email match or the fixture
User `alice`.

## 2. Register the Factory resources and permissions

The operator prepares protected provisioning JSON for one Factory Organization,
Project and Repository using the existing
[provisioning contract](../../src/server/provision.ts). For example, use Factory
identifiers `real-review`, `tdp`, and `tdp-project`. These are local identifiers;
the Azure DevOps organization name and provider GUIDs are separate.

Include only your authenticated User in `members`, with the scoped Activities
needed for reading resources/history, configuring Work Item Types, requesting
Review, reading the Repository/report, recording Review Facts and Review
Decisions, publication and finalization. Use the exact installed
[Activity names](../../src/server/contracts.ts), including separate execution
and Approval permissions. Do not grant permissions by guessing wildcard names.

From the owning installation's repository root, using its protected environment:

```powershell
node --env-file=C:/protected/factory-real.env --import tsx scripts/operator.ts provision C:/protected/real-review-bootstrap.json
```

**Expected result:** After signing in again, select your Organization. The Board
loads without authorization errors. Under **Administration > Work Item Type
selection**, choose version **4 · confirmed publication** for this walkthrough
before importing the PR. Version 4 avoids configuring report-reference recipients;
existing Work Items retain their own versions.

**If blocked:** Confirm current Membership and scoped permissions. Approval
cannot override missing execution permissions. Do not reuse test credentials.

## 3. Connect the Repository and pull request observations

Choose the Repository URL now. Changing it later requires a new immutable source
binding rather than redirecting existing correspondence. Obtain its actual Azure
collection, project and repository GUIDs; have the operator verify them against
the provider's real API/event metadata. Repository names are not GUIDs.

Prepare the protected JSON inputs described in
[Repository access](durable-private-reviews.md#configure-resources) and
[Azure DevOps service hooks](provider-observations.md#azure-devops-service-hooks).
Configure read access to the exact clone URL using a narrowly scoped credential
owned by your Azure DevOps account. A Factory API Credential does not authorize
Azure DevOps code access. Keep provider tokens in protected local files.

```powershell
node --env-file=C:/protected/factory-real.env --import tsx scripts/operator.ts repository-access C:/protected/tdp-access.json
node --env-file=C:/protected/factory-real.env --import tsx scripts/operator.ts source-put C:/protected/tdp-source.json
```

The operator supplies an externally reachable HTTPS observation endpoint for this
source. Azure DevOps cannot target `localhost`. If using a temporary ingress,
expose only the intended authenticated observation route and preserve request
bytes and headers. Do not publish the loopback evaluation identity provider or
its database. See [Microsoft webhook requirements](https://learn.microsoft.com/en-us/azure/devops/service-hooks/services/webhooks?view=azure-devops).

In Azure DevOps **Project settings > Service hooks**, configure Web Hooks for PR
created, updated and merged events, filtered to the selected Repository. Set
**Resource details to send: All** and Basic authentication username `factory`
with the independent source secret supplied by the operator. Confirm delivery
against the chosen actual PR, not just a sample event with another resource ID.
For an existing PR, an actual update/resend must deliver its real provider event;
there is no URL-only import or installed polling operation.

**Expected result:** A corresponding Work Item appears on the **Board**. Open its
title to inspect detail and history. Confirm the correct Repository, PR identity,
branches and commits. A manually created Work Item with a secondary URL is not
equivalent to an imported correspondence and cannot publish to that PR.

**If blocked:** HTTP 401 means source authentication failed; 422 means the payload
is invalid/incomplete; 409 indicates an identity or binding conflict. Fix the cause;
do not invent new event IDs to conceal a conflict.

## 4. Configure OpenRouter and start Review

The selected API model is `openai/gpt-6-luna`, with `reasoningEffort: "max"`.
`max` is a separate setting, not part of the model ID. The
[OpenRouter model catalog](https://openrouter.ai/api/v1/models) lists tools and
maximum reasoning support. Verify current account availability before running.

The operator uses the existing Organization AI configuration with these fields:

```json
{
  "adapter": "openrouter",
  "url": "https://openrouter.ai/api/v1",
  "model": "openai/gpt-6-luna",
  "upstream": "openai",
  "reasoningEffort": "max",
  "permittedModels": [
    { "id": "openai/gpt-6-luna", "tools": true, "reasoning": ["max"] }
  ]
}
```

Place that object under `ai` in the protected full configuration described in
[Configure resources](durable-private-reviews.md#configure-resources). The full
input also needs Organization, enabled state, resource mode, protected key,
limits, and rules. Agree call/time limits and an OpenRouter spending limit before
the paid run. Code and Review prompts reach OpenRouter and the selected upstream.
Do not substitute another model/effort if an error occurs.

The recommended starting budget is **USD 5 total** on a dedicated key, without
daily or monthly resets (`limit_reset: null`). The User will create this key and
set the spending limit locally; the recommendation is not yet a configured or
accepted budget. See [OpenRouter key limits](https://openrouter.ai/docs/api/api-reference/api-keys/create-a-new-api-key).
For the first small PR, propose 20 AI calls, 10 minutes of AI time, 20 minutes of
execution time, and no subordinate agents. Check actual consumption after the
first Review before repeating or raising limits. Calls/time limits alone do not
guarantee a dollar ceiling.

```powershell
node --env-file=C:/protected/factory-real.env --import tsx scripts/operator.ts review-configure C:/protected/real-review-ai.json
```

Imported pull requests enter the Review Intake Workflow. The operator checks its
current Service Identity, scoped permissions and repository/target-branch rules
before enabling the selected start. The returned Service Identity receives no
implicit grants. If required, add missing Review Facts in detail and approve the
specific generation Activity using your human account. Do not start another run
while intake already owns the Work Item.

**Expected result:** Workflow Run status progresses through intake/execution to
`waiting-review`. Factory state remains separate. The sandbox checks out fixed
commits, and a private report appears under **Private Review Reports**.
Use **Refresh review** under **Private Review Reports** to fetch updated reports
and execution state. Use **Refresh** under **Work Item actions** for current
transitions and Fact history. The page does not automatically poll the worker.

**If blocked:** Missing inputs are named in detail. Authorization/resource waits
require the corresponding permission or configuration repair. Exhausted limits
or uncertain calls stop visibly; do not blindly retry a paid or external effect.

## 5. Read and decide

Open the report and read its Findings. Confirm or reject every Finding, recording
reasons where requested, then submit the consolidated **Review Decision**. Review
and explicitly acknowledge an empty report too. Wait for Review completion.

**Expected result:** Your complete decision is retained with its report version.
Rejected Findings remain private. Review completion does not close the Work Item.
If the PR commits change, the previous evidence may be obsolete and need a new
Review and decision; do not publish stale conclusions.

## 6. Publish explicitly and finalize separately

Configure provider write access only for this step, following
[Azure publication configuration](confirmed-publication.md#configure-a-destination).
When you decide to post to the selected real PR, click **Request publication of
confirmed Findings** and complete any separate Activity-bound Approval. Verify
the comment in Azure DevOps. No confirmed Findings produces a recorded skipped
publication without a provider comment; do not fabricate Findings to force a post.

**Expected result:** Only confirmed content appears at the imported PR destination.
The full private report, rejected Findings and rejection reasons are not published.
If the outcome is uncertain, inspect reconciliation evidence before any new attempt.

Complete the allowed preparation/State Transitions, then use **finalize-review**
when current report, complete decision and confirmed publication outcome satisfy
the displayed prerequisites. The **Review Finalization Workflow** performs the
allowed final State Transition. This does not approve or merge the Azure DevOps PR.

## 7. Record the result

Record nonsecret installation, account identity, Repository/PR, source/target
commits, model/effort, configured limits, Work Item/Workflow Run/report IDs,
human decision, actual publication outcome and final Factory state in
[Issue 20](../../.scratch/factory-mvp/issues/20-guided-real-azure-devops-review.md).
Note errors and unresolved steps honestly. Revoke temporary credentials/hooks or
disable dispatch when finished, preserving immutable evidence. Close the ticket
and accept the reopened MVP only after the real walkthrough succeeds.
