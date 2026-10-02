# Generate a private report in a durable Review Workflow

Status: ready-for-human
Type: HITL
User stories covered: 19, 20, 21, 34, 36, 37, 38, 39, 41, 58, 59, 60, 61, 62, 65, 67, 68

## Parent

[TBFactory MVP specification](../spec.md)

## What to build

Start an authorized Review Workflow from a Transition Request, execute it in the separate Mastra worker using Organization-approved AI resources, persist a version-bound report Artifact with proposed Findings, and suspend for human review. Report generation does not change Factory state.

Human checkpoint: Agree and record supported AI providers/models, allowed Organization configuration, consumption accounting, time/call-count limit behavior, and the report/relevant-input contract before dependent implementation. Record scheduling, exclusive ownership, recovery, version retention, and private Artifact persistence/access contracts before implementing them.

## Acceptance criteria

- [ ] Organization operators configure isolated AI credentials, permitted models, and per-run time and call-count limits. Observable refusal or stopping behavior enforces model restrictions and both limits.
- [ ] Transition Requests start at most one active Workflow Run per Work Item, including under concurrent requests or worker attempts. Different Work Items may execute concurrently.
- [ ] Each run has an explicit Execution Identity; automatic starts use the Organization's Service Identity and all applicable Activity policies.
- [ ] Retain exclusive ownership while running or waiting for human review. Direct User/API transitions are blocked, while authorized new Facts remain admissible.
- [ ] Persist report version, declared relevant inputs, proposed Findings, and Artifact metadata in SurrealDB; store Artifact content on a persistent file volume with Factory-authorized private access.
- [ ] After application/worker and database restarts, load the same suspended run with retained outputs and its original Workflow version, without repeating completed work.
- [ ] UI/API distinguish Factory state, execution state, and the pending human review. Report generation or Review Workflow completion does not close or change the Work Item.
- [ ] Provide runnable public-flow checks with a separate worker, real persistent stores, controllable AI evidence, concurrent requests, human-wait restarts, cross-Organization Artifact denial, AI limits, and a minimal private-report UI scenario.

## Blocked by

- [Issue 01: Validate durable Workflow storage within one working day](01-validate-durable-workflow-storage.md)
- [Issue 03: Execute authorized Transition Requests from the Kanban Board and API](03-authorized-transition-requests.md)

