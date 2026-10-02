# Issue tracker: Local Markdown

Issues and specs for this repo live as Markdown files in `.scratch/`.

## Conventions

- One feature per directory: `.scratch/<feature-slug>/`.
- The spec is `.scratch/<feature-slug>/spec.md`.
- Implementation issues are one file per ticket at `.scratch/<feature-slug>/issues/<NN>-<slug>.md`, numbered from `01`. Never use a single combined tickets file.
- Triage state is recorded as a `Status:` line near the top of each issue file. Use the role strings in [triage-labels.md](triage-labels.md).
- Comments and conversation history append to the bottom of the file under a `## Comments` heading.
- Write all issue and spec content in English, using the canonical domain terms from `CONTEXT.md`.

## When a skill says "publish to the issue tracker"

Create the appropriate spec or issue file using the paths above, creating directories as needed.

## When a skill says "fetch the relevant ticket"

Read the referenced issue file. Issue numbers are scoped to their feature directory; use the full path when ambiguous.

## Wayfinding operations

- An existing feature spec can serve as its parent map, with `Labels: wayfinder:map`. Its `Destination` and `Notes` describe the scope and whether execution is included.
- Child tickets link that spec under `Parent` and carry a `wayfinder:<type>` label. `Type: AFK` or `Type: HITL` describes human participation.
- Claim a ticket with `Assignee: <dev>` before work. An absent assignee means unclaimed.
- Record lifecycle separately as `State: open` or `State: closed`; an absent state means open. Keep `Status:` within the five triage role strings.
- This tracker has no native dependency relation. `Blocked by` links are the dependency convention; a ticket is unblocked when every linked blocker is closed.
- The frontier is the parent's open, unclaimed, unblocked child tickets in filename order. Read those metadata and dependency sections; no separate open-ticket index is maintained.
- Append answers under `Comments`, close the resolved ticket, and add a named link with a one-line gist under the parent's `Decisions so far`. Detailed evidence stays linked from the resolution comment.
