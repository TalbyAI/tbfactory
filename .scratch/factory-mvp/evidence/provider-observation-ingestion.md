# Provider observation ingestion acceptance evidence

Checked on 2026-10-04 against baseline `d9b526175111b67a6e009163c373eae73e9667ac`
using the pinned application dependencies and persistent SurrealDB 3.3.0 acceptance
container. The [implementation contract](../designs/provider-observation-ingestion.md)
and [operation runbook](../../../docs/operations/provider-observations.md) describe
the interfaces and reproduction commands.

## Automated verification

- `npm run typecheck`: passed throughout implementation and after final review fixes.
- Focused `tests/observations.test.ts` runs verified each behavior and regression.
  The final suite includes 21 ingestion tests and exercises both provider variants.
- `npm test`: all 45 tests passed on the final implementation, with no skips.
- `npm run build`: passed after final code changes. Existing TanStack inputValidator
  deprecation and dependency bundler directive warnings remain.
- `npm run acceptance`: all 10 groups passed on the final production build. It invokes
  the actual `source-put` CLI, sends native provider-authenticated HTTP deliveries,
  restarts the web process and persistent database, and restores a database export
  with its compatible protected ring. Local ignored result:
  `.runtime/acceptance-1791102734039/results.json`.
- `git diff --cached --check`: passed before commit.

| Ticket behavior | Observed result |
| --- | --- |
| Native source authentication | GitHub exact-body HMAC-SHA256 and Azure HTTPS Basic; browser sessions do not substitute for source credentials; tampered/missing credentials fail |
| Scoped ownership | Factory Project/Repository ownership checked on installation and delivery; provider repository/base/project/collection mismatches fail; binding reassignment and credential reuse fail |
| Concurrent correspondence | Eight identical first deliveries across two hooks produce one Work Item and one observation; four distinct concurrent first events share one Work Item and retain all four Facts |
| Delivery deduplication | Repeated and concurrent subsequent delivery returns recorded IDs; changed normalized content for the same resource/event conflicts; unrelated envelope metadata does not duplicate evidence |
| Independent boundaries and references | The same provider resource independently corresponds in two Organizations; secondary references preserve their own manually created Work Item and do not claim correspondence; foreign history reads fail |
| Type boundaries | Correspondence/receipt keys include Work Item Type; unsupported executable types fail configuration; selected version 2 creates new items while retained versions survive selection changes |
| Immutable evidence and Factory state | New events append observation Facts; closed/completed/abandoned provider states do not transition Factory state or overwrite retained title/version; disabled selection still permits evidence for existing correspondence |
| Future worker ownership | Explicit running/suspended fixtures accept Facts without rewriting activeRun or Factory state; these are fixtures, not actual Workflow execution |
| Atomic failure | A real database event interrupts observation creation; the transaction leaves no Work Item, correspondence or successful receipt; retry creates one item and its two initial Facts |
| Secrets and recovery | Rotation invalidates old credentials, disabling blocks delivery, metadata/history omit credentials; both providers decrypt and deduplicate after web/database restart and protected database/ring restoration |
| Provider compatibility | Azure GUID samples do not need UUID version bits and normalize casing; unsupported/incomplete payloads, invalid media types and oversized bodies fail without evidence; GitHub ping creates no Fact |

TDD observed semantic failures before fixes: non-loopback HTTP was accepted instead of
rejected; the strict UUID validator rejected Microsoft's GUID samples; media types
such as application/jsonp were accepted instead of rejected. Each corresponding
regression passed after its implementation change. Initial route/module wiring also
failed before ingestion was installed.

## History UI drill

Used the T3 collaborative preview with the real production build and isolated local
OIDC provider, signed in as test User `alice`. Opened the restored GitHub and Azure
Work Items through the existing Organization/Work Item navigation. Public history
and rendered DOM both showed creation plus two external.observation Facts, their
source provenance, provider states and commit IDs. Factory state remained registered
and state-flow version 1 after GitHub closed/merged and Azure completed observations;
the Organization selection had subsequently moved to version 2. No product alerts
were present. No provider-specific UI or browser backend replacement was introduced.

The local UI drill used the earlier build before the server-only media-type/GUID
validation adjustments; no UI code changed afterward. The final production API,
CLI and recovery acceptance drill used the rebuilt final server.

## Standards review

Independent code-review Standards axis reviewed staged changes before committing.
It identified a media-type prefix validation defect and ambiguity about whether
operator source configuration introduced domain vocabulary. Exact media-type parsing
and a public regression fixed the defect; the design now explicitly treats source
as technical configuration/provenance, distinct from User, Service Identity and
Execution Identity. Existing actor strings are retained consistently with the
repository's persistence model. Own review corrected GUID validation and removed
an unnecessary dynamic SDK import from credential uniqueness checking.

The final Standards review found no remaining documented violation or clear
correctness/security issue. It retained one nonblocking Repeated Switches heuristic:
normalization and authentication branch on the two providers for separate purposes.
The current small branches were retained rather than introduce unused adapter layers.

## Spec review

Independent code-review Spec axis identified narrow CLI and concurrency verification
gaps and an overly strong history-order sentence. The final production drill invokes
source-put; distinct concurrent events have public-operation checks; the contract
now accurately describes the existing recording-timestamp/Fact-ID order without
promising provider-event or transaction-commit ordering. The reviewer confirmed
the final staged changes address those concerns and found no unresolved implementation
findings or scope creep.

Remaining actionable findings: Standards 0; Spec 0. Standards has one nonblocking
heuristic, with no confirmed defect; Spec has no unresolved implementation issue.

## Assigned runtime follow-up

Real running/suspended Workflow ingestion awaits Issue 05 and the deployment drill
in Issue 12, exactly as Issue 04's conditional acceptance wording requires. Both
issues now name the provider ingestion checks and recovery material to retain.
No real Workflow execution, scheduler or external publication is claimed by this
increment. Only pull-request-review is installed; no second executable Work Item
Type was invented to demonstrate the key's type boundary.
