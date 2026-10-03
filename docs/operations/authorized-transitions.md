# Authorized Transition Requests

The accepted [design](../../.scratch/factory-mvp/designs/authorized-transition-requests.md) specifies states, inputs, prerequisites, Approval, authorization, and migration boundaries. Version 1 remains available without transitions. Selecting version 2 affects only new Work Items; explicit migration belongs to Issue 11.

All routes below are under `/api/organizations/{organization}` and use existing browser sessions or Organization-restricted bearer API credentials. Mutations require JSON and a caller-generated `operationId`; an identical retry returns its previous result, while changed content conflicts. Browser mutations require the configured origin.

| Route | Method | Behavior / permission |
| --- | --- | --- |
| `/work-item-types` | GET | Available definitions and selected creation version; `organization.read` |
| `/work-item-types` | POST | `{operationId,type:"pull-request-review",version:1\|2,enabled:boolean}`; `type.manage` |
| `/board?type=pull-request-review` | GET | Paginated authorized cards with retained version, Factory state, separate active Workflow Run state, transition inputs, availability and Approval requirement |
| `/teams` | GET / POST | Paginated Team list / create `{operationId,name,members:[userId]}`; `team.manage` |
| `/teams/{team}` | POST | Replace name and membership list; same schema / permission |
| `/policies` | GET / POST | Paginated policy list / install `{operationId,user\|team,activity,scope,scopeId,effect}`; `policy.manage` |
| `/policies/{policy}/remove` | POST | `{operationId}`; `policy.manage` |
| `/work-items/{item}/transition-requests` | GET | Paginated request history; `work-item.read` |
| `/work-items/{item}/transition-requests` | POST | `{operationId,transition,expectedState,version,inputs}`; `transition.{transition}` |
| `/work-items/{item}/transition-requests/{request}/approve` | POST | `{operationId}`; browser-only `approval.{transition}` |
| `/work-items/{item}/transition-requests/{request}/execute` | POST | `{operationId}`; original Execution Identity and current `transition.{transition}` permission |

Policies target exactly one User or Team. Scopes are `organization`, `project`, `repository`, `team`, and `user`; effects are `allow`, `deny`, and `human`. All associated Teams are evaluated. Cross-Organization scopes and principals are rejected. Management permissions deliberately authorize Organization operators to change policies; they cannot bypass prohibitions on their own management Activities.

To prepare a version 2 Work Item, request `prepare-review` from `registered` with `inputs: {reviewBrief:"Inspect authorization"}`. A completed result has `accepted:true`, `completed:true`, the resulting Work Item, and its `state.transition` Fact. A human policy instead returns `completed:false` and `request.status:"pending-approval"`, with the previous Factory state. Approval changes the request to `approved`; a separate execute call rechecks current access and commits the transition. A browser cannot execute a request originally made by an API credential; that original credential must still be valid and sufficiently scoped.

`withdraw-review` requires `reason` and the current `readinessFact` from a successful prepare/reopen transition. `reopen-review` requires `reason`, `reviewBrief`, and the current successful `finalizationFact`. Notes, correction Facts, request Facts and Approval Facts are not confirmed State Transition prerequisites. Version/state/lifecycle changes invalidate pending Approval; unrelated Facts do not. `request-review` and `finalize-review` are visibly unavailable until their platform Workflows are installed by their own increments.

The application transaction commits current Factory state, the immutable successful Fact, completed request and operation receipt together. The existing SurrealDB transaction retry rereads authorization and expected state. A retained `activeRun` association prevents direct transitions, including suspended or cancellation-requested execution; later worker code must acquire/release this association transactionally. Issue 03 creates no Workflow Runs.

Run the dedicated persistent acceptance database from the [existing runbook](authenticated-work-items.md#runnable-acceptance-environment). Then use `npm run typecheck`, `npx tsx --test tests/transitions.test.ts`, `npm test`, `npm run build`, and `npm run acceptance`. The production acceptance script verifies that an approved pending request survives both web and database restart and then completes once. `npx tsx tests/acceptance.ts --serve` retains the isolated app and local identity provider for a board drill; sign in as `alice` and select Organization `alpha`. Stop the test app/provider and dedicated database after verification.
