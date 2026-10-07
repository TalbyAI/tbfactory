# Validate the extensible post-MVP Factory model

Status: ready-for-human
Labels: wayfinder:map
State: open

## Destination

Produce a human-approved specification for the first post-MVP Factory model,
supported by primary-source research and isolated prototypes of the agreed product
scenarios. The specification must make the route to implementation clear and
identify the evidence and acceptance criteria behind each adopted abstraction.

## Notes

- This effort concerns the future model, independently of the MVP's delivery.
  Accepted MVP foundations and ADRs remain in force for the existing application.
- Planning is the default. Research, isolated exploratory prototypes, and
  specification assets are included; production implementation is excluded.
- The [initial proposal and agreed directions](proposal.md) preserve the kickoff
  discussion. They are not a completed specification or replacement ADRs.
- Use the canonical terms in [CONTEXT.md](../../CONTEXT.md). Consult `wayfinder`,
  `grilling`, and `domain-modeling` for decision sessions, `research` for research,
  and `prototype` for prototypes. Never resolve a HITL ticket without the User.
- Capture agreed post-MVP terms in CONTEXT.md as live discussion proceeds. Partial
  agreements remain in the owning ticket's Comments; only closed-ticket resolutions
  enter Decisions so far, and they do not unblock dependents before closure.
- Use Assertion and Assertion Bundle for the post-MVP model. Fact retains its MVP
  meaning; kickoff discussion and completed research preserve their historical
  vocabulary. Consult the canonical glossary and owning ticket's latest agreements
  when interpreting those assets.
- Explore architectural Ports and adapters, with Effect 4 in the core as the
  User's requested direction. Research its exact release/API state and its division
  of responsibilities with Mastra; do not silently substitute Effect 3.
- Validate all three agreed scenarios: concurrent compatible pull request work;
  missing-input completion followed by another Workflow; and a message creating
  work associated with a Repository and a specifically claimed Branch.
- Factory Plugins can be local TypeScript contributions or published packages
  loaded by a hosting project. UI configuration is declarative, permission-bound,
  and restricted to capabilities exposed by the installation.
- Keep external observations, Factory state, rule results, authorization, Approval,
  Workflow Run state, and coordination decisions distinguishable.
- The User confirmed W3C SHACL as the intended ontology-validation technology.
  Investigate its validation scope, execution boundaries, and compatibility;
  confirmation of the technology does not settle those contracts.
- Claim a child ticket before work. Use local Markdown `Parent`, `Blocked by`,
  `Assignee`, and `State` conventions; the frontier is queried from child metadata
  in filename order. This map intentionally has no open-ticket list.
- Research branches are disposable `research/<name>` branches in separate Git
  worktrees. Link their evidence from the owning ticket. Research resolution is
  evidence, not approval of a downstream architectural decision.
- Each prototype belongs entirely under `prototypes/<prototype-name>/`, including
  dependencies, tooling, and formatting commands. Use fake external effects unless
  a separate ticket explicitly needs a live integration. No production imports or
  repository-root prototype commands are permitted.

## Decisions so far

- [Define shared element identity and the Assertion contract](issues/01-element-identity-and-fact-contract.md#resolution--2026-10-07): Elements share Resource/Work Item identity; Assertion Bundles are identified, Assertions have only Bundle-local names, and correction/state interpretation belongs to domain predicates and projection rules.
- [Research RDF, SHACL, and temporal Fact representation](issues/02-rdf-shacl-temporal-graphs.md): RDF and SHACL can encode and validate graphs, but Fact occurrence identity, temporal projections, and authority require explicit Factory contracts.
- [Research Effect 4 and Mastra execution boundaries](issues/03-effect4-and-mastra-boundaries.md): Effect 4 core facilities and unstable cluster Workflow APIs are documented; durability ownership, adapter interoperability, and recovery still need decisions and executed evidence.
- [Research durable shared-read and exclusive-write coordination](issues/04-durable-resource-coordination.md): atomic arbitration and stale-worker fencing are separate from immutable claim history; documented primitives still require a tested Factory protocol.
- [Research declarative rule and extension mechanisms](issues/05-declarative-rules-and-extension-mechanisms.md): validation, expression evaluation, graph inference, and Workflow dispatch remain distinct; the compared mechanisms supply parts of the contract.

## Not yet specified

- The breadth of the first shippable domain library beyond the three validation
  scenarios, and the criteria for admitting additional domain concepts.
- Operator experience for explaining classification, projection differences,
  blocked work, and failed or uncertain execution, once execution semantics exist.
- Deployment scale, indexing, incremental computation, and storage costs after the
  representative graphs and workload shape are known.
- Package discovery and distribution experience beyond loading local/published
  plugins and demonstrating composition; revisit after the plugin contract exists.
- The full treatment of approval policies and organizational variations beyond
  preserving authorization boundaries in the validation scenarios.

## Out of scope

- Changing, extending, or delaying the current MVP through this effort.
- Implementing or deploying the post-MVP Factory in production.
- Detailed production implementation ticket breakdown and delivery scheduling
  after the validated specification has been approved.
- Migrating current MVP data or active Workflow Runs; documenting compatibility
  implications remains in scope, executing migration does not.
- Building a marketplace, billing system, or exhaustive visual Workflow editor.
- Letting a UI User upload or execute arbitrary TypeScript as declarative
  configuration; installation-loaded Factory Plugins are a separate mechanism.
