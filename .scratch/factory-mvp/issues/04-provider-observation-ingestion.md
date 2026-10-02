# Ingest deduplicated pull request observations from both providers

Status: ready-for-agent
Type: AFK
User stories covered: 5, 6, 7, 8, 12, 38

## Parent

[TBFactory MVP specification](../spec.md)

## What to build

Accept authenticated GitHub and Azure DevOps pull request observations, associate each resource with its corresponding Work Item, and expose immutable observation Facts in Factory history. Both providers are variants of the same ingestion behavior.

## Acceptance criteria

- [ ] Record provider identifiers, authenticated ingestion and credential scope, command contracts, and duplicate-delivery handling before dependent implementation.
- [ ] GitHub and Azure DevOps observations create or locate at most one corresponding Work Item per Organization and Work Item Type, including under concurrent delivery.
- [ ] Repeated delivery of the same event produces one Fact. Independent Organization/type correspondences and permitted secondary references remain possible.
- [ ] Provider state changes are recorded as observation Facts and do not themselves change Factory state or grant execution permission.
- [ ] Facts can arrive during active or suspended Workflow Runs once those runs are available.
- [ ] Reject invalid source authentication and mismatched Organization, Project, or Repository ownership; Organization credentials cannot be used across boundaries.
- [ ] Provide provider-parameterized public-operation checks for repeated/concurrent events, unique correspondence, independent boundaries, secondary references, and unchanged Factory state. Verify active-run ingestion in the durable review and deployment scenarios.

## Blocked by

- [Issue 03: Execute authorized Transition Requests from the Kanban Board and API](03-authorized-transition-requests.md)

