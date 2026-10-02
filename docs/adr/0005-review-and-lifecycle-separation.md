---
status: accepted
---

# Separate code review from Work Item lifecycle finalization

A Review Workflow reviews code and creates an Artifact containing findings; it neither closes the Work Item nor changes its Factory state. A Review Finalization Workflow can end the Work Item's lifecycle and perform the corresponding State Transition, separating analysis from lifecycle authority so that producing findings is not mistaken for completing the underlying task. Each Workflow defines its required results, and successful completion of a Workflow Run does not by itself imply closure of the Work Item.
