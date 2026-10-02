---
status: accepted
---

# Start with platform-owned definitions and retain active versions

Initial Workflows and Work Item Types are trusted platform code deployed with the application; Organizations select and configure the available definitions. Customer-authored Workflows are a future objective, so the initial platform does not execute arbitrary customer-supplied code.

Existing Workflow Runs retain the Workflow version with which they started, and Work Items retain their state-flow definition version until an explicit migration. This requires keeping definitions needed by existing runs and items available across deployments, rather than silently reinterpret suspended execution or existing states using the latest code.
