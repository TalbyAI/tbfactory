# Establish Mastra AI provider configuration constraints

Status: ready-for-agent
Type: AFK
Labels: wayfinder:research
Assignee: Codex
State: closed

## Parent

[TBFactory MVP specification](../spec.md)

## Question

Which AI provider configuration mechanisms does Mastra support for platform-provided
and Organization-provided AI, including API keys, custom URLs, model selection,
reasoning effort, tool calling, structured report output, and per-call usage?
Distinguish current documentation from the selected `@mastra/core` 1.74.0 pin.
Identify capability constraints and the smallest supported integration boundary;
do not replace the User's choice with an OpenAI-compatible-only restriction.

## Blocked by

None - can start immediately.

## Comments

### 2026-10-04 — Research claimed

The User directed provider restrictions to follow Mastra. Codex claimed this
research prerequisite for [Generate a private report in a durable Review Workflow](05-durable-private-review-report.md).
The research uses primary documentation and source code and will be retained in
[Mastra AI provider contracts](../research/mastra-ai-provider-contracts.md).

### Resolution — 2026-10-04

The [primary-source evidence](../research/mastra-ai-provider-contracts.md) checks
current official documentation separately from the selected `@mastra/core` 1.74.0
source and local lockfile. Mastra accepts router IDs, supported native AI SDK model
instances, and explicit OpenAI-compatible configurations; it does not impose a
single OpenAI-compatible-only provider boundary. Per-Organization model resolution
can use explicit credentials without mutating process-wide environment settings.

Custom URLs and reasoning options are adapter-specific. Tool calling, structured
output, and usage fields depend on provider/model capabilities; unsupported
configuration cannot be treated as universally available. The selected initial
model's live availability and exact capability compatibility are not proved here.

Mastra provides cancellation and timeout controls, but Factory must persist and
enforce summed model-call time across parent/subordinate/concurrent calls separately
from active execution time. Retries and any additional report-structuring call
must be observable and counted. Secret isolation and run authorization remain
Factory responsibilities.

The research question is resolved. Supported adapter/model validation and runtime
verification remain implementation requirements of the parent review ticket;
closing this research issue does not approve its remaining design or complete
any review implementation criterion.
