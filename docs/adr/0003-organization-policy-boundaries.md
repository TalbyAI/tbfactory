---
status: accepted
---

# Organization isolation and restrictive policy composition

Each Organization is an independent customer boundary with isolated data, credentials, and policies; a User may hold independent Memberships in multiple Organizations. Activities are governed by applicable Organization, Project, Repository, Team, and User policies: authorization is denied by default, inherited grants are allowed, an explicit prohibition prevails, and any applicable requirement for human intervention prevents automatic execution. This favors customer isolation and restrictive authorization over permissive local overrides.

For the MVP, human Approval requires a specific approval permission, separate from execution permission, and the User must belong to the same Organization. The Workflow Run's authorization is checked again before execution; Approval cannot grant a missing permission or override a prohibition. Future scoped rules for Approval Points are addressed by ADR 0009; configurable confirmation policies are not part of the MVP.

Each Project belongs to one Organization and each Repository to one Project. Teams may operate across Projects and Repositories within their Organization; all Teams associated with the Execution Identity are evaluated, preserving the priority of any applicable prohibition.

Every Workflow Run has an explicit execution identity; automatic runs use an Organization-specific Service Identity. Artifacts are private by default, and publishing an external reference requires explicit, limited, revocable sharing rather than making its contents public merely because a link was published.

Human authentication uses an external identity provider, while Users, Memberships, and authorization remain owned by the Factory; the provider and authentication mechanism will be selected in a follow-up specification. Each Organization configures its AI providers, permitted models, and isolated credentials, with time and call-count limits per Workflow Run. These settings do not replace Activity authorization or MVP human Finding confirmation.
