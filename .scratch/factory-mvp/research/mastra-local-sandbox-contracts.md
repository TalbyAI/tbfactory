# Mastra local sandbox contracts

## Evidence boundary

The prototype lockfile pins `@mastra/core` to `1.74.0` ([lockfile](../../../prototypes/durable-workflow-storage/package-lock.json)). I checked the installed package declarations and docs against Mastra's matching source tag, commit [`b21e46e`](https://github.com/mastra-ai/mastra/tree/b21e46e19b469a25c8896bcee90afd58d6f1a890). The API and limitations below are checked pin evidence. Links to Mastra's live documentation are identified separately as current-doc context; they can evolve independently of the pin.

## Checked pin evidence

`Workspace` composes a filesystem and sandbox; `LocalFilesystem` takes a `basePath`, defaults `contained` to `true`, and supports read-only mode. `LocalSandbox` takes a `workingDirectory` and accepts an isolation setting. See the pinned [`LocalFilesystem`](https://raw.githubusercontent.com/mastra-ai/mastra/b21e46e19b469a25c8896bcee90afd58d6f1a890/packages/core/src/workspace/filesystem/local-filesystem.ts), [`LocalSandbox`](https://raw.githubusercontent.com/mastra-ai/mastra/b21e46e19b469a25c8896bcee90afd58d6f1a890/packages/core/src/workspace/sandbox/local-sandbox.ts), and [`Workspace`](https://raw.githubusercontent.com/mastra-ai/mastra/b21e46e19b469a25c8896bcee90afd58d6f1a890/packages/core/src/workspace/workspace.ts) implementations.

`LocalSandbox` defaults to `isolation: "none"`: commands execute on the host with host permissions. The package has optional Seatbelt isolation on macOS and Bubblewrap (`bwrap`) on Linux; these are OS-specific and not a portable Windows isolation mechanism. A working directory only sets the process cwd. `LocalFilesystem.contained` constrains that filesystem API, not shell commands. Thus neither `workingDirectory` nor filesystem containment is a security boundary for arbitrary code.

The generated Workspace tools include filesystem/search operations and command execution; the pinned [`tool list`](https://raw.githubusercontent.com/mastra-ai/mastra/b21e46e19b469a25c8896bcee90afd58d6f1a890/packages/core/src/workspace/constants/index.ts) contains no Git-specific tool. Workspace tools are enabled by default, so the product must explicitly disable the unrestricted default set. Provide only selected file-read/search capabilities and platform-authored Git actions. Do not expose the generated arbitrary `execute_command` tool to the agent. Prepare a unique checkout with trusted platform code before agent access, and do not pass checkout credentials into the sandbox environment. By default, LocalSandbox inherits `PATH`; additional environment variables are explicit inputs.

The smallest local composition is one Workspace per Workflow Run, with that run's checkout path as both `LocalFilesystem.basePath` and `LocalSandbox.workingDirectory`. This avoids cross-run checkout reuse by construction. The pinned Workspace also supports request-context resolvers, but the caller owns resolver-created sandbox instances and their cleanup; a resolver is unnecessary for an MVP that can construct one Workspace per run.

## Current-doc context and contract

Current Mastra docs describe `WorkspaceSandbox` as the sandbox adapter boundary and document third-party backends such as E2B, Daytona, and Docker ([sandbox overview](https://mastra.ai/docs/sandbox/overview), [sandbox interface](https://mastra.ai/reference/workspace/sandbox)). This supports keeping Organization/run policy and the restricted tool contract independent of the local implementation, then adding a backend adapter later. It does not establish that every listed provider is compatible with the pinned version or has equivalent isolation, persistence, network, or credential behavior; validate a specific adapter and version when selected.

Local integration is feasible for a controlled Linux worker with Bubblewrap installed, or macOS with Seatbelt. If the runtime cannot provide the configured OS isolation, reject sandbox creation instead of silently falling back to `none`. The pin offers no built-in Windows OS isolator. Do not run untrusted agent commands on a shared host. This is a material MVP deployment constraint, not a limitation that a per-run cwd can solve.
