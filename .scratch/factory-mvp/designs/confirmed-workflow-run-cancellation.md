# Confirmed Workflow Run cancellation

Issue: [09](../issues/09-confirmed-workflow-run-cancellation.md).
Implementation contract under accepted ADRs 0003, 0004, and 0010 and the
durable Review Workflow, publication, and persistent-installation contracts.

## Request and authorization

An authenticated User may request cancellation through the public Factory
operation and protected application UI. Both call the same Work Item-scoped
operation and require the `workflow.cancel` Activity under current Membership and
policy evaluation. A scoped API Credential represents its User and may request
cancellation when current policy allows it; the existing authorization seam denies
it when an applicable policy requires human intervention. This preserves
default-deny and applicable prohibitions. Service Identities do not call this
User operation. The operation is idempotent by its operation identifier.

The operation atomically appends an immutable `workflow.cancellation-requested`
Fact and records its Fact identifier on the Workflow Run. It does not change the
Workflow Run to a stopped state or clear the Work Item's active-run association.
The response and protected read model expose cancellation-request state separately
from confirmed-stop state. New Facts remain admissible while cancellation is
pending. Existing Work Item Type definitions gain no cancellation rule or Approval
Point; none currently defines automatic cancellation.

## Worker stop confirmation

The installation's single Review Worker owns cancellation processing. It checks
persisted requests before scheduling work and every execution boundary checks the
request before starting another step or handoff. For active model, tool, or sandbox
work, the worker aborts the run's shared signal, drains agent calls, stops the
sandbox, and awaits the execution task. It appends an immutable
`workflow.cancellation-confirmed` Fact and atomically marks the Workflow Run
`cancelled` and clears active-run ownership only after those stop operations
succeed. Failure to establish a stop leaves the request and ownership in place for
manual recovery. A suspended human/input wait can be confirmed only after the
worker verifies there is no execution task and the retained Mastra snapshot is
suspended; cancellation leaves that snapshot and all history intact and prevents
future resume.

If a process stops after the request but before confirmation, startup recovery does
not resume the run. Operators use the existing worker-lock and sandbox-stop
confirmation path. `recoverStoppedRun` then records cancellation confirmation and
releases ownership. Reserved model calls become uncertain and remain counted;
completed calls and outputs, Facts, decisions, and Artifacts remain retained, and
none is replayed as part of cancellation.

## Publication boundary

Cancellation also applies while publication owns the Work Item. Before any
provider POST has been authorized, the worker prevents dispatch, drains its local
task, and may confirm cancellation using the durable `dispatchAuthorized: false`
evidence. If a POST was authorized or may have reached a provider, aborting the
local request does not prove the external outcome: ownership remains active and
the cancellation is shown as awaiting publication resolution. The existing
read-only provider reconciliation and explicit User confirmation are required.
While cancellation is pending, a new publication attempt is prohibited.

If reconciliation identifies a completed provider effect, the effect remains
completed and cancellation is recorded as not applied. If the User confirms
nonpublication with current complete evidence and confirms the provider execution
stopped, the same transaction records confirmed cancellation and releases
ownership. Unavailable evidence or a missing positive/negative resolution retains
ownership. Cancellation never erases a publication Activity, its attempts, Facts,
report content, or prior completed effect.

## Verification seams

Behavior is verified through the approved public Factory HTTP operation and
protected review UI with a real SurrealDB test database, a separate worker, and
durable Workflow/Artifact stores. The AI and provider HTTP endpoints and sandbox
are controlled system boundaries. Checks cover browser and scoped API authorization,
human-intervention denial for API Credentials, active and suspended cancellation,
request versus confirmed stop, blocked replacement starts and direct transitions,
restart recovery, preservation of completed work, and publication dispatch and
uncertainty. No test reaches private operation helpers or queries storage to
substitute for the public behavior.
