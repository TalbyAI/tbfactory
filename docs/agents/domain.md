# Domain Docs

This repo uses a single-context layout:

- `CONTEXT.md` at the repo root contains the canonical domain glossary.
- `docs/foundations.md` records the accepted architecture, invariants, and MVP scope.
- `docs/adr/` contains architecture decisions.

## Before exploring, read these

Read `CONTEXT.md` before exploring the domain and the ADRs relevant to the area being investigated.

Before changing architecture or project scope, also read `docs/foundations.md` and the relevant ADRs. Keep accepted decisions distinct from proposals and unresolved questions.

If a referenced domain document does not exist, proceed silently. Do not create speculative domain documentation; record terms or decisions when they are agreed.

## Use the glossary's vocabulary

Use the canonical English terms from `CONTEXT.md` in issue titles, proposals, hypotheses, tests, and documentation. Avoid synonyms the glossary explicitly excludes.

Before defining or changing domain terminology, read `CONTEXT.md` and record agreed terms there in English.

If a needed concept is absent, reconsider whether it belongs to the domain or identify the gap for domain modeling.

## Flag ADR conflicts

Explicitly identify any proposal that contradicts an existing ADR and explain why reopening that decision may be appropriate. Do not silently override accepted decisions.
