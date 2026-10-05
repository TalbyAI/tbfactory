# Establish the Mastra local sandbox integration boundary

Status: ready-for-agent
Type: AFK
Labels: wayfinder:research
Assignee: Codex
State: closed

## Parent

[TBFactory MVP specification](../spec.md)

## Question

Which local filesystem, sandbox, and workspace APIs are available in the selected
Mastra runtime for per-run repository checkout and Git/read/search tools? Identify
the documented isolation limits and extension boundary for other Mastra-supported
sandbox backends after local MVP validation. Distinguish selected-version source
from current documentation; do not describe a working directory as an OS security
boundary or assume unsupported backends are already implemented.

## Blocked by

None - can start immediately.

## Comments

### 2026-10-05 — Research claimed

The User selected local sandbox validation for the MVP, followed by support for
other Mastra options. Codex claimed this feasibility question before specifying
the local integration. Evidence will be recorded in
[Mastra local sandbox contracts](../research/mastra-local-sandbox-contracts.md).

### Resolution — 2026-10-05

The [primary-source evidence](../research/mastra-local-sandbox-contracts.md) verifies
Workspace, LocalFilesystem, and LocalSandbox against the selected 1.74.0 source.
A per-run Workspace can compose a unique checkout, contained/read-only filesystem,
and local command sandbox. There is no built-in Git-specific tool; platform-authored
Git actions and explicitly selected read/search capabilities are needed rather
than exposing the default unrestricted Workspace tools.

LocalSandbox executes host commands with `none` isolation by default. The pin
supports Bubblewrap on Linux and Seatbelt on macOS, but no built-in Windows OS
isolator. Filesystem containment and working directory do not constrain shell
execution. Local MVP feasibility therefore requires a checked isolation mechanism
and must not silently fall back to unrestricted host execution. The proposed
Linux worker requirement is awaiting the User's product/deployment decision.

WorkspaceSandbox is the backend extension boundary. Current documentation lists
other sandbox integrations, but each later adapter needs version and capability
validation; this note does not certify every provider against the selected pin.

The research question is resolved. Concrete sandbox resource/network policy and
runtime validation remain part of the parent review implementation; no sandbox
has been implemented or tested by this research.
