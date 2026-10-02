# Create an authenticated, Organization-scoped Work Item

Status: ready-for-human
Type: HITL
User stories covered: 1, 2, 3, 4, 9, 10, 11, 48, 49, 50, 51, 68

## Parent

[TBFactory MVP specification](../spec.md)

## What to build

Deliver the first usable Factory path: an authenticated User selects an Organization, creates a Work Item through protected UI operations or the public API, and inspects its persistent immutable Fact history. Include the Organization's Project and optional Repository ownership and independent Memberships.

Human checkpoint: Agree the external identity provider/protocol, User mapping, Membership bootstrap, external API authentication, and isolated secret-storage approach before dependent implementation. Record the initial persistence and command contracts before implementing them.

## Acceptance criteria

- [ ] A User can authenticate externally and access each Organization for which the User has an independent Membership; authentication alone grants no Activity permission.
- [ ] Protected UI operations and the public API can create and retrieve an authorized Work Item with its own identity, exactly one Organization and Project, and an optional Repository. No external source is required.
- [ ] Each Project belongs to one Organization and each Repository to one Project; mismatched ownership and cross-Organization access are rejected.
- [ ] Facts cannot be rewritten or deleted through Factory operations. Corrections append new Facts and retain the original occurrences.
- [ ] A Work Item can reference an external resource without claiming its unique primary correspondence.
- [ ] Persist Users, Memberships, ownership, Work Items, and history across restart; isolate Organization data, credentials, and policies.
- [ ] Provide a runnable public-operation check using two Organizations, independent Memberships, invalid ownership, and append-only corrections, plus a minimal UI create/history scenario.

## Blocked by

None - can start immediately

