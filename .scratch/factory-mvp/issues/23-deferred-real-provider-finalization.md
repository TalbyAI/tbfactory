# Complete the deferred real-provider finalization exercise

Status: needs-triage
State: open
Type: HITL
Labels: wayfinder:grilling

## Parent

[TBFactory MVP specification](../spec.md)

## Remaining live exercise

The User accepted the first MVP version on 2026-10-15 after successful real
Factory publication. The separate Review Finalization Workflow was not executed
for the real-provider Work Item in [Issue 20](20-guided-real-azure-devops-review.md).
This follow-up retains that unexecuted step without making it a blocker for the
User's first-version acceptance. Existing finalization tests and Docker evaluation
evidence remain separate; they do not prove this live exercise happened.

Factory and the experiment ngrok tunnel are stopped. Service hook
9e97c116-3354-4df6-bf66-923cdc78edff is disabledByUser; data, configuration,
Artifacts and history are retained. The target PR's deliberate fault was reverted
through b8d97f800d2332d3344bd05da7a59e078ee7789e. Its source/main conflicts are
target-project work, separate from Factory acceptance.

Before resuming, agree the desired live exercise with the User, verify current
processes/credentials/commits and installation health, then restore and verify
HTTPS ingress before re-enabling the retained hook. Import current inputs and
obtain any required renewed Review Decision and Approval through normal operations.
No additional paid Review is authorized; agree a budget if one is needed.

Record the actual finalization request, Workflow outcome, State Transition and
immutable Facts if executed. First-version acceptance must not silently change
the real Work Item from its retained registered state or fabricate completion.

## Comments

### Carried forward from the accepted walkthrough — 2026-10-15

This ticket records the remaining live exercise and its prerequisites. It does
not start Factory, authorize new external effects or alter existing runtime data.
