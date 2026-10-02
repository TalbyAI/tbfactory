---
status: accepted
---

# Required TBFactory stack

At the project owner's explicit request, TanStack Start will provide the frontend and backend, SurrealDB will be the primary database, and Mastra will execute workflows and agents. These choices constrain the design of an extensible Factory for complex processes with human and artificial intelligence assistance; they were not selected through a comparative evaluation during this interview.

Mastra may use SurrealDB through a compatible storage adapter if integration and validation costs are reasonable; reuse of an existing adapter is preferred over implementing another one. A prototype will evaluate the existing adapter within one working day, checking compatibility, persistence across process restarts, and concurrent snapshot updates. If that route fails validation or requires substantial development beyond the timebox, the Factory will use a Mastra-supported storage provider while retaining SurrealDB as its primary database; the concrete fallback remains to be selected.
