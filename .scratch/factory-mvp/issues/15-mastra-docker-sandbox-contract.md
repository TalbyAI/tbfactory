# Establish the Mastra Docker sandbox integration contract

Status: ready-for-agent
Type: AFK
Labels: wayfinder:research
Assignee: Codex
State: closed

## Parent

[TBFactory MVP specification](../spec.md)

## Question

How should the User-selected installation-local Docker sandbox integrate with the
selected Mastra runtime for isolated per-run repository exploration, controlled
Git/read/search tools, credential-free agent access, and recreatable checkouts?
Verify the official Docker adapter package/API and version compatibility, filesystem
placement, lifecycle, and isolation boundaries from primary sources. Distinguish
supported facts from unexecuted runtime validation. Do not replace Docker with
the earlier Linux/Bubblewrap proposal.

## Blocked by

None - can start immediately.

## Comments

### 2026-10-05 — Research claimed

The User selected Docker as the local isolated MVP sandbox. Codex claimed this
integration prerequisite; evidence will be retained in
[Mastra Docker sandbox contracts](../research/mastra-docker-sandbox-contracts.md).

### Resolution — 2026-10-05

The [primary-source evidence](../research/mastra-docker-sandbox-contracts.md) verifies
the official DockerSandbox adapter at the source commit matching core 1.74.0.
`@mastra/docker` 0.9.2 declares a peer range including that core version; package
metadata confirms it. This is declared compatibility, not executed runtime proof.

DockerSandbox supports per-ID container lifecycle, reconnect, file upload, and
Docker mounts. It does not implement the generic Workspace filesystem mount at
this pin. A host LocalFilesystem is therefore not implicitly visible inside the
container. The selected design prepares a container-native checkout and routes
platform-authored Git/read/search tools through the run's sandbox.

Trusted platform code owns Docker access, controlled credential use, image choice,
resource/network settings, and container stop/cleanup. Agents do not receive daemon
access, credentials, or an arbitrary command tool. The default image must not be
assumed to include Git/search tools. Separate container IDs and writable layers
preserve per-run checkout separation; runtime isolation and recovery still require
integration validation.

The research question is resolved. No production dependency was installed and
no Docker execution, prototype, or compatibility test is claimed. The parent
review implementation owns those checks and remains open.
