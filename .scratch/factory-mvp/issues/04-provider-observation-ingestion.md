# Ingest deduplicated pull request observations from both providers

Status: ready-for-agent
Type: AFK
Assignee: Codex
State: closed
User stories covered: 5, 6, 7, 8, 12, 38

## Parent

[TBFactory MVP specification](../spec.md)

## What to build

Accept authenticated GitHub and Azure DevOps pull request observations, associate each resource with its corresponding Work Item, and expose immutable observation Facts in Factory history. Both providers are variants of the same ingestion behavior.

## Acceptance criteria

- [x] Record provider identifiers, authenticated ingestion and credential scope, command contracts, and duplicate-delivery handling before dependent implementation.
- [x] GitHub and Azure DevOps observations create or locate at most one corresponding Work Item per Organization and Work Item Type, including under concurrent delivery.
- [x] Repeated delivery of the same event produces one Fact. Independent Organization/type correspondences and permitted secondary references remain possible.
- [x] Provider state changes are recorded as observation Facts and do not themselves change Factory state or grant execution permission.
- [x] Facts can arrive during active or suspended Workflow Runs once those runs are available.
- [x] Reject invalid source authentication and mismatched Organization, Project, or Repository ownership; Organization credentials cannot be used across boundaries.
- [x] Provide provider-parameterized public-operation checks for repeated/concurrent events, unique correspondence, independent boundaries, secondary references, and unchanged Factory state. Verify active-run ingestion in the durable review and deployment scenarios.

## Blocked by

- [Issue 03: Execute authorized Transition Requests from the Kanban Board and API](03-authorized-transition-requests.md)

## Comments

### 2026-10-04 — Implementation contract

Issue 03 is closed. The User requested implementation of this AFK ticket. The
[ingestion contract](../designs/provider-observation-ingestion.md) records provider
identifiers, authenticated repository-bound source configuration, encrypted credential
scope, transactional correspondence/delivery handling, and the public-operation
verification seams already required by this ticket. Implementation runs on
`feature/provider-observation-ingestion`; the review baseline is its starting `main`.

### Resolution — 2026-10-04

Delivered native authenticated GitHub/Azure DevOps observation ingestion, immutable
repository-bound operator configuration and encrypted source credentials, atomic
resource correspondence/delivery receipts, and normalized immutable Facts exposed
through the existing history UI/API. Provider evidence does not change Factory state,
retained versions or Workflow ownership, and grants no execution permission.

The [acceptance and review evidence](../evidence/provider-observation-ingestion.md)
records 45 passing tests (21 ingestion tests), typecheck/build, 10 final production
acceptance groups including actual source-put CLI, web/database restart and protected
ring/database restore, and rendered history checks for both providers. Standards
and Spec have no remaining actionable findings; one nonblocking Standards heuristic
is documented. Issue 04 is closed.

The conditional active/suspended compatibility requirement is verified with explicit
future-worker fixtures. Real Workflow runtime validation remains assigned in Issues
05 and 12, where the durable review and deployment scenarios become available.
Those runtime drills have not been executed or claimed here. Only the supported
pull-request-review type is installed; keys preserve independent type boundaries
without adding an unsupported executable type.
