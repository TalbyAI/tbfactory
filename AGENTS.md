# Repository instructions

- Write all repository documentation in English, including this file, CONTEXT.md, glossary terms and definitions, ADRs, and design documents.
- Conversations with users may use any language; prefer Spanish unless the user requests another language.
- Use the canonical English glossary terms when referring to domain concepts, even when the surrounding conversation is in another language. Translate the user's terminology to the corresponding English term instead of introducing parallel names.
- Before defining or changing domain terminology, read [CONTEXT.md](CONTEXT.md) and record agreed terms there in English.
- Before changing the architecture or project scope, read [docs/foundations.md](docs/foundations.md) and the relevant [ADRs](docs/adr/). Keep accepted decisions distinct from proposals and unresolved questions.

## Agent skills

### Issue tracker

Issues and specs are tracked as local Markdown files under `.scratch/<feature>/`. See `docs/agents/issue-tracker.md`.

### Triage labels

Use the five default triage roles as status strings. See `docs/agents/triage-labels.md`.

### Domain docs

Single-context layout: root `CONTEXT.md` and `docs/adr/`. See `docs/agents/domain.md`.
