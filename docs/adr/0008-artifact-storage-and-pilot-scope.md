---
status: accepted
---

# Keep Artifact files outside the primary database and bound the review pilot

SurrealDB stores Artifact metadata, while a persistent file volume stores Artifact content in the initial shared deployment; access is controlled by the Factory. This keeps unstructured content separate from primary database records without requiring an additional object-storage service initially.

The first functional process covers review, publication of findings, and Work Item finalization for GitHub and Azure DevOps. Modifying source code, approving provider pull requests, and merging are outside the pilot; the general Work Item and Workflow model remains extensible.
