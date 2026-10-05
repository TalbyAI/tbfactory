# Submit and revalidate a consolidated Review Decision

Status: ready-for-agent
Assignee: Codex
State: closed
Type: AFK
User stories covered: 18, 21, 22, 23, 24, 26, 27, 28, 29, 30, 31, 34, 56, 57

## Parent

[TBFactory MVP specification](../spec.md)

## What to build

Let an authorized User review a particular report version, confirm or reject all Findings together, and submit a consolidated Review Decision. Keep the decision and activity-bound Approval usable only while their declared relevant inputs remain current; expose renewed review and rerun behavior through the agreed lifecycle.

## Acceptance criteria

- [x] Only a User authorized for the relevant Approval Point in the same Organization can submit a Review Decision.
- [x] UI/API reject incomplete or mismatched report-version submissions. A report with no Findings still requires explicit human review.
- [x] Retain rejected Findings and their reasons privately. Agent proposals, Review Decisions, and subsequent corrections are separate immutable Facts.
- [x] CI results, AI output, and other source evidence cannot substitute for human Finding confirmation.
- [x] Bind a Review Decision to its report version and relevant inputs and bind an Approval to its Activity and relevant input versions.
- [x] Relevant changes prevent reuse of superseded decisions or Approval and require revalidation and renewed human confirmation. The authorized rerun/review path creates replacement versions or decisions while preserving history and run exclusivity.
- [x] Unrelated new Facts leave an otherwise valid decision usable. Recheck current execution authorization and relevant versions immediately before an Activity proceeds.
- [x] Persist the human decision and resume the same waiting run as appropriate. A decision does not itself authorize publication, and Review Workflow completion leaves Factory state unchanged.
- [x] Provide public API and minimal UI checks for mixed decisions, rejection reasons, incomplete submissions, empty reports, cross-Organization denial, relevant/unrelated updates, and resumed review after restart.

## Blocked by

- [Issue 05: Generate a private report in a durable Review Workflow](05-durable-private-review-report.md)

## Comments

### Resolution — 2026-10-05

Implemented on `feature/consolidated-review-decisions`. Version 3 declares the
`review.decide` Approval Point with `approval.review-decide` authority. Browser
session submissions validate the report version, exact Finding coverage and
rejection reasons, including explicit review of empty reports. API Credentials,
foreign Organizations and unauthorized Users cannot supply human confirmation.
The decision and any complete corrective replacement are separate immutable Facts;
proposed reports and private Markdown remain intact.

Reports and decisions expose currentness against the latest report and declared
input Fact versions. Generation Approval is Activity/run/input-bound. Relevant
changes prevent stale Approval dispatch and Review Decision reuse; unrelated Facts
remain admissible. Stopped wait supersession and authorized Transition Requests
create replacement reports requiring renewed human confirmation. Corrections
identify the latest decision with `replaces` and preserve history through
`correctedFact`.

The worker resumes the same persisted human checkpoint, rechecks current execution
authority and inputs, and retains exclusivity through `review-submitted`,
`waiting-revalidation` and `waiting-authorization`. Restored execution authority
allows continuation without repeating model calls. Completion records its own
Fact and releases ownership without changing Factory state or granting publication
authority. The accepted confirmed-stop recovery path remains in effect for crashes
and unavailable or damaged retained snapshots/Artifacts.

Verification:

- `npm test`: 69 passing checks, including six new public API scenarios using real
  SurrealDB, LibSQL, private files, Docker and a separate worker. Coverage includes
  concurrent submissions, mixed decisions, reasons, incomplete/foreign inputs,
  empty reports, separate Approval/execution authority, revocation, relevant and
  unrelated updates, renewed reports, corrections and restart continuation.
- `npm run typecheck`, `npm run build` and `npm run format:check`: pass.
- `npm run acceptance`: all ten built-application scenarios pass.
- The built review acceptance flow rejects incomplete decisions, preserves a mixed
  submission through web/database restart, resumes the same waiting run and makes
  one provider call with no replay. Factory state remains `registered`.
- The collaborative browser verifies disabled incomplete/blank-reason submissions,
  mixed and empty human decisions, private rejection reasons, cross-Organization
  denial and relevant/unrelated changes. The final build also verifies wrapped
  report identifiers and a normally sized confirmation checkbox in narrow cards.
- Independent Standards and Spec reviews report no actionable findings.

Final production evidence is in ignored
`.runtime/review-d36984b1-0d03-4549-beb7-c745d063cb40/acceptance.json`;
the detailed browser flow is in
`.runtime/review-8f6afe6f-4b6e-441d-b5cc-db955415b7bd/browser-checks.json`.
General acceptance evidence is in
`.runtime/acceptance-1791207511483/results.json`.
Contracts and revalidation procedures are documented in
[durable private reviews](../../../docs/operations/durable-private-reviews.md#consolidated-human-decisions-and-revalidation).
Publication and Review Finalization Workflow implementation remain subsequent
issues. This issue is closed.
