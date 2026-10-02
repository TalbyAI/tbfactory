# Submit and revalidate a consolidated Review Decision

Status: ready-for-agent
Type: AFK
User stories covered: 18, 21, 22, 23, 24, 26, 27, 28, 29, 30, 31, 34, 56, 57

## Parent

[TBFactory MVP specification](../spec.md)

## What to build

Let an authorized User review a particular report version, confirm or reject all Findings together, and submit a consolidated Review Decision. Keep the decision and activity-bound Approval usable only while their declared relevant inputs remain current; expose renewed review and rerun behavior through the agreed lifecycle.

## Acceptance criteria

- [ ] Only a User authorized for the relevant Approval Point in the same Organization can submit a Review Decision.
- [ ] UI/API reject incomplete or mismatched report-version submissions. A report with no Findings still requires explicit human review.
- [ ] Retain rejected Findings and their reasons privately. Agent proposals, Review Decisions, and subsequent corrections are separate immutable Facts.
- [ ] CI results, AI output, and other source evidence cannot substitute for human Finding confirmation.
- [ ] Bind a Review Decision to its report version and relevant inputs and bind an Approval to its Activity and relevant input versions.
- [ ] Relevant changes prevent reuse of superseded decisions or Approval and require revalidation and renewed human confirmation. The authorized rerun/review path creates replacement versions or decisions while preserving history and run exclusivity.
- [ ] Unrelated new Facts leave an otherwise valid decision usable. Recheck current execution authorization and relevant versions immediately before an Activity proceeds.
- [ ] Persist the human decision and resume the same waiting run as appropriate. A decision does not itself authorize publication, and Review Workflow completion leaves Factory state unchanged.
- [ ] Provide public API and minimal UI checks for mixed decisions, rejection reasons, incomplete submissions, empty reports, cross-Organization denial, relevant/unrelated updates, and resumed review after restart.

## Blocked by

- [Issue 05: Generate a private report in a durable Review Workflow](05-durable-private-review-report.md)

