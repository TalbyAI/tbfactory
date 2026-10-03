# Authorized Transition Requests acceptance evidence

Checked on 2026-10-03 using Node.js 24.14.1, the pinned production dependencies, and a real persistent SurrealDB 3.3.0 container. The [accepted design](../designs/authorized-transition-requests.md) and [operation runbook](../../../docs/operations/authorized-transitions.md) define the contracts and reproduction commands.

## Automated verification

- `npm run typecheck`: passed throughout implementation and after review changes.
- `npx tsx --test tests/transitions.test.ts`: 8 public-behavior tests passed after the definition consolidation.
- `npm test`: all 24 tests passed on the final code, including the real TanStack Start HTTP boundary; no skipped tests.
- `npm run build`: passed on the final code. Existing TanStack `inputValidator` deprecation and dependency bundler directive warnings remain.
- `npx tsx tests/acceptance.ts --serve`: all 7 production acceptance groups passed on the final build, including OIDC, web/database restart, isolated database restoration, and current credential revocation. Runtime result: `.runtime/acceptance-1791045553214/results.json` (local, ignored recovery material).

| Required behavior | Observed result |
| --- | --- |
| Type selection and retained definitions | New Work Items use explicitly selected version 2; original version 1 cards retain `registered` and no transitions; executable configuration is rejected |
| Direct transitions and prerequisites | Prepare/withdraw/reopen use strict inputs; notes, invented identifiers and mismatched/superseded State Transition Facts do not satisfy prerequisites |
| Atomic state/history | Database event interruption at successful Fact creation leaves the previous Factory state, no successful Fact, no request or receipt; safe concurrent retry records one transition |
| Restrictive authorization | Default deny, inherited Team grants, all associated Teams, prevailing prohibitions, scoped human policies, and immediate membership/policy updates are exercised |
| Organization boundaries | Foreign Team members, policy scopes and approvers are rejected |
| Human intervention | Browser and bearer requests require separate activity-bound Approval where a policy requires it; bearer Approval and execution with a replacement identity are rejected |
| Current authorization | A prohibition added after Approval blocks execution; restoring permission permits execution; unrelated notes preserve Approval; lifecycle cycling invalidates it |
| Run ownership and Workflow availability | A retained suspended run blocks direct transitions while notes remain possible; review and finalization requests reject as unavailable without installing Workflows |
| Durability | An approved pending request survives web and persistent database restart, then completes once; old-version board semantics survive |

The retained-finalization/reopen and active-run integration fixtures seed the external future worker boundary. They verify public direct-operation behavior, not implementation of the future finalization Workflow or run scheduler.

## Board drill

Used the T3 collaborative preview against the real production application and locally hosted OIDC provider. Logged in as the isolated test User `alice` in Organization `alpha`.

1. Observed version 1 and version 2 cards together, separate Factory and Workflow Run execution states, and unavailable Review/Finalization Workflows.
2. Created a version 2 Work Item through the protected UI and verified that it appears automatically without a manual board refresh on the final build.
3. Submitted `prepare-review` with a human policy: accepted pending request, unchanged `registered` Factory state, explicit Approval control.
4. Approved and separately executed the request: `ready-for-review` card and successful `state.transition` Fact appeared together.
5. Installed a restrictive Project policy after loading a withdrawal form: the stale board submission returned `Activity denied`; Factory state and successful-transition Fact count remained unchanged. Refresh displayed the denial on the card.
6. Injected a SurrealDB Fact-creation failure for the isolated board Work Item: the board returned `Operation failed`, state stayed `ready-for-review`, and the successful-transition Fact count stayed at one. Removed the injection and retried through the same form: one withdrawal completed.
7. Prepared and approved another request, then revoked execution through an applicable prohibition. The board execution returned `Activity denied`, state stayed `registered`, and successful Fact count stayed at two. Removed the prohibition and retried: state became `ready-for-review` with three successful State Transition Facts total.

Preview host connections were intermittent; reopened the same T3 preview and checked authoritative public reads/DOM state after each action. The final refresh drill used the rendered form's submit event through T3 `preview_evaluate` where the focused click tool did not navigate. No alternate browser or mocked board backend was used.

Local screenshots were saved at `C:/Users/iskan/.t3/userdata/browser-artifacts/browser-screenshot-localhost-musm3k6q-5ab9e411.png` (completed transition) and `C:/Users/iskan/.t3/userdata/browser-artifacts/browser-screenshot-localhost-musmeqsv-92dd342f.png` (automatic creation refresh). These are local artifacts, not portable repository dependencies.

## Standards review

Independent `code-review` Standards axis against baseline `82f31fc6ee2fcdfe0fe6a4b136e1dd7c91f3aecc` identified:

- A historical issue comment still described the design as pending and implementation as not started. Clarified its historical timing and recorded the User's accepted checkpoint separately.
- Possible Duplicated Code: transition input names and strict input schemas had separate declarations. Consolidated schemas into the platform definition and derived board input names from those schemas.

The reviewer found no confirmed functional or security regression. Both findings are resolved; the focused and full suites and final build/acceptance checks pass after the changes.

## Spec review

Independent `code-review` Spec axis reported no findings. Source inspection found authorization, Team-policy composition, Approval rechecks, direct-transition validation, atomic persistence, idempotency, and retained-version behavior consistent with the accepted design, with no scope creep. Authoritative Review Decision/publication formats remain with their later issues; Issue 03 rejects every Workflow-backed request before persistence.

Unresolved findings: Standards 0; Spec 0. No worst unresolved issue in either axis.
