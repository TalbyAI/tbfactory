# Authorized Transition Requests

The accepted [design](../../.scratch/factory-mvp/designs/authorized-transition-requests.md) specifies states, inputs, prerequisites, Approval, authorization, and the original version-1 to version-2 migration boundary. The Issue 11 [retained-version and migration contract](../../.scratch/factory-mvp/designs/retained-versions-and-explicit-migration.md) records the installed versions and the only additional migrations. Selection affects new Work Items; existing items change version only through the explicit migration operation below.

Issue 05 adds version 3 with installed Review Intake and Review Workflows. See
[durable private reviews](durable-private-reviews.md) for resources, worker setup,
exclusive ownership and report recovery. Versions 1 and 2 retain their original definitions.

All routes below are under `/api/organizations/{organization}` and use existing browser sessions or Organization-restricted bearer API credentials. Mutations require JSON and a caller-generated `operationId`; an identical retry returns its previous result, while changed content conflicts. Browser mutations require the configured origin.

| Route | Method | Behavior / permission |
| --- | --- | --- |
| `/work-item-types` | GET | Available definitions and selected creation version; `organization.read` |
| `/work-item-types` | POST | `{operationId,type:"pull-request-review",version:1\|2\|3\|4\|5,enabled:boolean}`; `type.manage` |
| `/board?type=pull-request-review` | GET | Paginated authorized cards with retained version, Factory state, separate active Workflow Run state, transition inputs, availability, Approval requirement, and an available explicit migration |
| `/teams` | GET / POST | Paginated Team list / create `{operationId,name,members:[userId]}`; `team.manage` |
| `/teams/{team}` | POST | Replace name and membership list; same schema / permission |
| `/policies` | GET / POST | Paginated policy list / install `{operationId,user\|team,activity,scope,scopeId,effect}`; `policy.manage` |
| `/policies/{policy}/remove` | POST | `{operationId}`; `policy.manage` |
| `/work-items/{item}/transition-requests` | GET | Paginated request history; `work-item.read` |
| `/work-items/{item}/transition-requests` | POST | `{operationId,transition,expectedState,version,inputs}`; `transition.{transition}` |
| `/work-items/{item}/transition-requests/{request}/approve` | POST | `{operationId}`; browser-only `approval.{transition}` |
| `/work-items/{item}/transition-requests/{request}/execute` | POST | `{operationId}`; original Execution Identity and current `transition.{transition}` permission |
| `/work-items/{item}/type-migrations` | POST | `{operationId,expectedState,expectedVersion,targetVersion,expectedTransitionSequence}`; `work-item.migrate` |

Policies target exactly one User or Team. Scopes are `organization`, `project`, `repository`, `team`, and `user`; effects are `allow`, `deny`, and `human`. All associated Teams are evaluated. Cross-Organization scopes and principals are rejected. Management permissions deliberately authorize Organization operators to change policies; they cannot bypass prohibitions on their own management Activities.

To prepare a version 2 Work Item, request `prepare-review` from `registered` with `inputs: {reviewBrief:"Inspect authorization"}`. A completed result has `accepted:true`, `completed:true`, the resulting Work Item, and its `state.transition` Fact. A human policy instead returns `completed:false` and `request.status:"pending-approval"`, with the previous Factory state. Approval changes the request to `approved`; a separate execute call rechecks current access and commits the transition. A browser cannot execute a request originally made by an API credential; that original credential must still be valid and sufficiently scoped.

`withdraw-review` requires `reason` and the current `readinessFact` from a successful prepare/reopen transition. `reopen-review` requires `reason`, `reviewBrief`, and the current successful `finalizationFact`. Notes, correction Facts, request Facts and Approval Facts are not confirmed State Transition prerequisites. Version/state/lifecycle changes invalidate pending Approval; unrelated Facts do not. Version 2 retains unavailable `request-review` and `finalize-review` operations. Version 3 installs `request-review`; `finalize-review` remains gated by its own increment.

The migration operation accepts only version 1 `registered`→version 2 `registered`, and version 3 `registered`→version 4 `registered` or `ready-for-review`→`ready-for-review`. It rejects 2→3, every version-5 migration, and version-3 `completed`. Pass the Work Item's current state, version, and transition sequence as expected values. Current scoped policy must allow `work-item.migrate`; active Workflow ownership (including pending cancellation) and any nonterminal Transition Request block migration. The Board repeats its availability check on the server; stale or unsupported requests receive `409`.

Migration atomically updates the Work Item version, appends `work-item.type-migrated`, and writes the operation receipt. Identical retries return the recorded result; changed content with the same operation identifier conflicts. A version-3 readiness migration preserves the original successful `state.transition` Fact and sequence with immutable migration provenance, so `withdraw-review` can validate that one retained prerequisite without rewriting it. Existing version-3 reports and Review Decisions remain in history but become noncurrent after migration. A fresh version-4 review and human Review Decision are required for publication or finalization.

The application transaction commits current Factory state, the immutable successful Fact, completed request and operation receipt together. The existing SurrealDB transaction retry rereads authorization and expected state. A retained `activeRun` association prevents direct transitions, including suspended execution. The review worker acquires, hands off and releases this association transactionally; request acceptance does not complete the owning Workflow or change Factory state.

Run the dedicated persistent acceptance database from the [existing runbook](authenticated-work-items.md#runnable-acceptance-environment). Then use `npm run typecheck`, `npx tsx --test tests/transitions.test.ts tests/type-migrations.test.ts`, `npm test`, `npm run build`, and `npm run acceptance`. The production acceptance scripts verify that an approved pending request survives restart and then completes once, and that a suspended old-version review resumes after deployment while a new selection creates a version-4 Work Item. Set `FACTORY_TEST_DATABASE_URL` to the dedicated SurrealDB endpoint; `FACTORY_TEST_DATABASE_CONTAINER` selects the matching Docker container for restart checks and defaults to `tbfactory-acceptance-db`. Run `node node_modules/tsx/dist/cli.mjs tests/review-acceptance.ts --hold` to retain the production app and local identity provider for the protected Board drill; sign in as `alice`, select Organization `alpha`, and open the Work Item ID recorded at `uiItems.migration` in the emitted acceptance evidence. Stop the held app/provider and dedicated database after verification.
