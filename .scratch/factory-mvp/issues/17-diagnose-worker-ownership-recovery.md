# Diagnose worker ownership during crash recovery

Status: ready-for-agent
Type: AFK
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

## Investigation and acceptance criteria

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

If causal diagnosis remains incomplete, keep this issue open and recovery acceptance
pending. Do not remove ownership protection or introduce blind retries to obtain a
passing test. [Issue 12](12-persistent-shared-installation.md) and MVP closure depend
on this resolution; resolving this issue does not itself complete deployment checks.

## Comments

### User-approved follow-up — 2026-10-07

The User agreed to an open diagnostic issue and to keeping acceptance of the failed
recovery scenario pending. Passing isolated repetitions and a later complete suite
are historical evidence, not a demonstrated correction of the original failure.
