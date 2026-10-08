# Diagnose worker ownership during crash recovery

Status: needs-info
Type: AFK
Labels: wayfinder:task, suspended
State: open

## Parent

[TBFactory MVP specification](../spec.md)

## Problem

The first complete integration suite on 2026-10-06 passed 178/179. The GitHub case
`worker crash after provider success preserves dispatch reservation until confirmed-stop reconciliation`
in `tests/publications.test.ts` failed when starting a worker with
`Installation worker already owns database; recover its stopped process first`.
The error came from the ownership guard in `src/server/review-worker.ts`.

The scenario kills the worker during a publication whose provider effect already
exists, confirms process exit, recovers the stopped worker identity/lock, and starts
a replacement before evidence-based publication reconciliation. The error identifies
an ownership rejection; it does not establish whether the product or test lifecycle
caused it, nor prove that overlapping execution occurred.

Three isolated repetitions and the final 179/179 invocation passed without changing
the ownership guard. The cause remains unknown. Historical local logs are
`.runtime/factory-mvp-final-tests.log` and
`.runtime/factory-mvp-final-tests-retry.log`; these ignored workspace files are
investigation inputs, not durable tracker evidence. See the
[installation delivery evidence](../evidence/persistent-shared-installation.md#final-package-verification).

## Original investigation and acceptance criteria

The criteria below were written before the User-directed suspension on 2026-10-07.
They remain open diagnostic work, but causal reproduction and correction are
suspended pending reproducible reporting conditions. This issue no longer blocks
Issue 12 or MVP closure. No cause or correction is claimed. Preserve all ownership
and confirmed-stop protections; Issue 12's deployment-specific restart and recovery
checks remain required.

- [ ] Preserve a nonsecret summary of the failed scenario, tested revision,
  environment, and error in committed evidence; retain the distinction between
  the original failure and successful later executions.
- [ ] Trace worker startup, process exit, database ownership, volume lock recovery,
  and fixture cleanup. Gather enough lifecycle evidence to establish the causal
  failure, distinguishing product behavior from the test harness. Do not label an
  uninvestigated failure as flaky or infer a cause from later passing tests.
- [ ] Correct the identified product or harness defect and explain why the change
  addresses the original failure. Preserve live-owner protection, host/path-bound
  recovery, confirmed-stop requirements, and single-run exclusivity.
- [ ] Demonstrate the failing causal condition before the correction and its
  expected behavior afterward using a focused regression or equivalent recorded
  causal evidence. A test that simply repeats successful executions is insufficient.
- [ ] Verify the two-provider crash/reconciliation scenario: one completed provider
  effect, retained dispatch reservation, no duplicate POST, and ownership release
  only after stopped-execution confirmation and authorized reconciliation.
- [ ] Run checks appropriate to the correction and the complete integration suite
  on the corrected revision, plus build, typecheck, and formatting checks. Record
  results and any remaining limits in the resolution.

Do not remove ownership protection or introduce blind retries to obtain a passing
test. The original causal diagnosis dependency was superseded by the User-directed
suspension above. Resolving this issue later does not itself complete Issue 12's
deployment checks.

## Comments

### User-approved follow-up — 2026-10-07

The User agreed to an open diagnostic issue and to keeping acceptance of the failed
recovery scenario pending. Passing isolated repetitions and a later complete suite
are historical evidence, not a demonstrated correction of the original failure.

### User-directed suspension — 2026-10-07

The User directed suspension because the reported worker-ownership startup failure
cannot be reproduced under the recorded follow-up runs. Set the tracker status to
`needs-info`, retain `State: open`, and add the `suspended` label. Reproduction
conditions sufficient to distinguish product behavior from test lifecycle are still
needed. The original cause remains unknown; no product or test-harness correction is
claimed. Preserve the ownership guard and confirmed-stop requirements. This open,
suspended diagnostic is not a current blocker for Issue 12 or MVP closure; Issue 12's
deployment-specific restart, recovery, and ownership checks remain mandatory.
