# Repository instructions

- Write all repository documentation in English, including this file, CONTEXT.md, glossary terms and definitions, ADRs, and design documents.
- Conversations with users may use any language; prefer Spanish unless the user requests another language.
- Use the canonical English glossary terms when referring to domain concepts, even when the surrounding conversation is in another language. Translate the user's terminology to the corresponding English term instead of introducing parallel names.
- Before defining or changing domain terminology, read [CONTEXT.md](CONTEXT.md) and record agreed terms there in English.
- Before changing the architecture or project scope, read [docs/foundations.md](docs/foundations.md) and the relevant [ADRs](docs/adr/). Keep accepted decisions distinct from proposals and unresolved questions.

## Git workflow

- Never commit directly to `main` or push changes directly to `origin/main`. All changes to `main` must go through an approved pull request.
- Before committing, check the current branch. If it is `main`, preserve any uncommitted changes, fetch `origin`, update local `main` to match `origin/main`, then create and switch to a new branch before restoring and committing the changes.
- If local commits or conflicts prevent synchronizing `main` safely, stop and resolve them without discarding work before creating the new branch.

## Prototypes

- Place each prototype in its own subdirectory under `prototypes/<prototype-name>/`.
- Keep prototype code, dependencies, manifests, lockfiles, configuration, and tooling inside that subdirectory. Do not add prototype dependencies to production code, repository-root manifests, or other prototypes.
- Production code and other prototypes must not depend on a prototype. Deleting its subdirectory must leave production code and other prototypes unaffected.
- Define all prototype commands inside its own subdirectory and run them from there. Do not add repository-root scripts, tasks, or commands for prototypes.

## Agent skills

### Formatting

- After editing code or Markdown files, run the appropriate formatting command from the owning package directory: `npm run format:code` for code and supported configuration files, or `npm run format:markdown` for Markdown. Use `npm run format` when editing both.
- Resolve any remaining Markdown violations manually without changing the document's meaning. Do not disable rules merely to make a check pass.
- Before delivering changes, creating a commit, or opening or updating a pull request, run `npm run format:check` in each affected package directory and require it to pass. Repeat formatting and verification after any subsequent edits.
- Root commands cover the application and repository documentation, including `.scratch/`, and exclude `prototypes/`. Run prototype commands inside the prototype's own directory; keep its dependencies and configurations independent.
- Do not format generated files, lockfiles, build output, installed dependencies, or captured prototype JSON evidence.

### Issue tracker

Issues and specs are tracked as local Markdown files under `.scratch/<feature>/`. See `docs/agents/issue-tracker.md`.

### Triage labels

Use the five default triage roles as status strings. See `docs/agents/triage-labels.md`.

### Domain docs

Single-context layout: root `CONTEXT.md` and `docs/adr/`. See `docs/agents/domain.md`.
