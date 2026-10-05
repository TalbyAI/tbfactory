# Explicitly bind a manual Work Item to a provider pull request

Status: needs-triage
State: open
Type: HITL

## Parent

[TBFactory MVP specification](../spec.md)

## What to investigate

Design an explicit authorized correspondence operation for an existing manual
Work Item. A secondary URL reference must not redirect publication. Provider
ingestion currently creates or finds the corresponding Work Item rather than
binding an existing manual Work Item.

## Required contracts

- Validate current Membership and scoped authority separately from execution and
  Approval permissions; specify the Activity governing binding before implementation.
- Verify provider resource identity and Organization, Project and Repository ownership.
- Enforce unique correspondence per Organization and Work Item Type and define
  conflict behavior when the pull request already corresponds to another Work Item.
- Respect active-run ownership and invalidate affected report, Review Decision and
  Approval inputs without rewriting immutable history.
- Record the authorized binding as immutable history and verify concurrent requests,
  invalid references, unauthorized access and retained publication destinations.

## Comments

### Deferred by User approval — 2026-10-05

The User approved retaining provider correspondence as the publication destination
authority and deferring explicit binding for manual Work Items. Until this follow-up
is designed and approved, those Work Items cannot publish through a secondary URL.
This ticket records the gap; it does not authorize implementation of binding.
