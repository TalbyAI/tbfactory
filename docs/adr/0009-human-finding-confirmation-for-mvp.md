---
status: accepted
---

# Require human Finding confirmation in the MVP and defer configurable approval rules

Each Work Item Type declares the possible Approval Points within its Work Items' lifecycle. The longer-term model allows Organizations, Projects, and Repositories to define rules for the relevant points: one context may accept confirmation by another AI agent, while another may require human confirmation in addition to agent or integration evidence.

The pilot and MVP use a fixed rule requiring human validation of every Finding by a User authorized for the relevant Approval Point within the same Organization; only human-confirmed Findings are eligible for publication, and AI or integration confirmation alone is insufficient. Configurable approval-rule evaluation, combinations of confirmers, and agent-only confirmation are deferred, keeping the first implementation focused on human review while retaining the declared decision points. Finding confirmation and authorization to execute an Activity remain separate checks.

The User reviews a particular version of the report, marks Findings as confirmed or rejected, and submits the decisions together. Publication waits until all Findings have a human decision, includes only confirmed Findings, and retains rejected Findings and their reasons in internal history. Reports with no Findings also require human review in the MVP; the resulting Review Decision does not close the Work Item, which remains the responsibility of the Review Finalization Workflow.
