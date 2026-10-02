---
status: accepted
---

# Execute Mastra Workflows in a separate worker

TanStack Start owns the frontend and public backend API, while a separate worker executes Mastra Workflows and agents using the same platform codebase and domain rules. This adds a deployment process but separates long-running execution and recovery from the HTTP request lifecycle. The initial installation remains shared across Organizations; worker coordination, startup recovery, and exact deployment configuration require a follow-up specification.
