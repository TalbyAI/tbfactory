---
status: accepted
---

# Serialize Workflow Runs per Work Item and persist human waits

Initially, the Factory will allow only one simultaneous Workflow Run per Work Item because coordinated concurrent updates are not part of the initial design. A Workflow Run waiting for Approval retains this exclusivity while new Facts can still arrive. Each Workflow declares its relevant inputs, and Approval is bound to the specific Activity and versions of those inputs; relevant changes require revalidation and renewed Approval, whereas unrelated Facts do not automatically invalidate it.

While a Workflow Run is active or suspended, only that run may perform permitted Factory State Transitions; direct transitions through a User or an API are available only when no Workflow Run is active. Recording Facts remains possible in either case, so external synchronization does not bypass state-writing exclusivity.

Workflow Runs must support waiting days for Approval and continuing after a restart or deployment without repeating completed external Activities. This is an operational requirement, not a claim that Mastra storage alone provides exactly-once external effects; recovery and duplicate-effect prevention remain to be designed, and Workflow Runs retain their definition version as described in ADR 0007.

An authorized User may emit a Cancellation Request as a Fact; the Factory can use it as evidence to stop execution, and type-defined rules may also authorize automatic cancellation. Cancellation preserves history, Artifacts, and completed Activities. Recording a request is distinct from confirming execution has stopped; releasing exclusivity must not permit overlap with a run still executing.

When an external publication outcome is uncertain, the Factory first gathers evidence from the provider. If the provider lacks an idempotency mechanism, recovery requires User confirmation; unresolved outcomes must not trigger blind retries that could repeat a completed Activity. Implementation of publication tracking and reconciliation remains to be designed.
