---
status: accepted
---

# Define Work Item states by type and expose type-specific Kanban Boards

Each Work Item Type defines its Factory states and allowed State Transitions through code, rather than impose one lifecycle on pull requests, tasks, features, and future types. Each type has a specific Kanban Board representing that state flow; Factory states remain separate from Workflow Run execution states.

A Transition Request from the board follows the type definition: it either performs a permitted direct transition or starts the specified Workflow Run. Starting a Workflow may require input data or validation of confirmed prerequisite Facts; requests remain subject to permissions and run exclusivity. Each Work Item Type also declares possible Approval Points within its lifecycle; the MVP requires human confirmation of Findings as described in ADR 0009. Concrete type definitions remain to be designed; type version retention is covered by ADR 0007.
