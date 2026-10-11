# Improve the work interface with compact Kanban cards and Work Item detail

Status: ready-for-human
State: closed
Type: AFK
Assignee: Codex

## Parent

[TBFactory MVP specification](../spec.md)

## Approved scope

The User approved the auto-grill summary on 2026-10-08. The existing Docker
evaluation remains accepted evidence; overall MVP acceptance reopens for this
ticket and the real Azure DevOps walkthrough in Issue 20.

- Focus the home view on the Kanban Board and access to Work Item creation.
- Keep cards compact: title, Repository, Factory state, Workflow Run execution
  state, and pending attention. Move reports and forms to a detail view with its
  own URL. Return to the same Organization and board context.
- Separate administration: Teams, policies, Invitations, API Credentials, and
  Work Item Type selection.
- Preserve the light appearance and green accent, improving hierarchy, spacing,
  typography, responsive behavior, keyboard access, and visible errors/loading.
- Reuse existing operations and preserve authorization, input validation,
  idempotent requests, retained versions, publication recovery and immutable history.

## Acceptance

- [x] Cards contain no Review forms or report/history panels and remain compact
  with long titles and identifiers.
- [x] Detail links support reload, browser navigation, and return to the board.
- [x] Review, transitions, Approval, cancellation, migration, publication,
  finalization, notes, corrections and references remain available in detail.
- [x] Administration and creation no longer compete with the Board on the home view.
- [x] Verify empty, loading, error, desktop, small-laptop and narrow-screen states,
  plus keyboard focus and retained Organization isolation.
- [x] Record focused tests, build, typecheck, formatting, and browser evidence.

## Blocked by

None. The design direction and scope are approved.

## Comments

### User approval and implementation claim — 2026-10-08

The User answered “de acuerdo” to the complete two-ticket auto-grill summary.
Codex claims this implementation ticket. No new dependencies, identity merging,
domain redesign, or provider-side PR approval/merge are included.

### Implementation and local verification — 2026-10-08

The compact Board, distinct Work Item detail URL, creation and Administration are
implemented on `feat/mvp-first-review-experience`. The
[executed evidence](../evidence/compact-kanban-and-work-item-detail.md) records
162.75–183 px cards, long-title creation, Review Decisions including an empty
report, confirmed cancellation, explicit migration, current heading/history after
a State Transition, responsive viewports, visible loading/errors and Organization
isolation. All existing action forms remain in their appropriate detail/settings
views. No dependencies or public API contracts were replaced.

Root verification passes: 198 tests out of 199, zero failures/cancellations, one
expected Windows-only Unix-socket skip, plus typecheck, production build,
formatting and local links. Native keyboard navigation was exercised, but the
background T3 preview does not paint focus while its document is inactive.
Keep this ticket open for foreground keyboard-focus and User visual acceptance;
this is the remaining part of the unchecked interface criterion, not unfinished
implementation. The existing Docker installation has not been redeployed.

### Foreground focus and User visual acceptance — 2026-10-11

During the isolated real-provider walkthrough, after the actual Microsoft login
and explicit Membership provisioning, the User reported that authorization,
navigation, access and focus all looked correct. The User deliberately did not
activate action buttons, preserving the practical test's initial state. This
completes the outstanding foreground focus and User visual acceptance identified
above. It does not claim new Review, publication, finalization or other form
submissions; those remain covered by the dated implementation/fixture evidence
and, for real-provider execution, the open Issue 20.

The other interface acceptance criteria retain their executed 2026-10-08 evidence.
Issue 19 closes with that evidence and this explicit User visual acceptance.
Issue 20 and the reopened MVP remain open; the existing Docker evaluation and
all historical comments are retained.
