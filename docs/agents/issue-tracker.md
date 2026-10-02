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
