# Authenticated Work Item implementation plan

Baseline: `4430b8c`. Implement the accepted design without changing its decisions.

The accepted test seams are public HTTP operations, protected UI server operations,
OIDC login/callback, operator provisioning, and protected key-ring recovery commands.
Use a real persistent SurrealDB 3.3.0 process; no in-memory replacement for acceptance.

1. Establish the production TanStack Start application and persistent schema; test
   valid OIDC login, exact identity mapping, and explicit operator provisioning.
2. Add transactional Work Item creation and immutable history, ownership checks,
   current policy evaluation, and operation receipts with concurrency retries.
3. Add bounded Invitations and self-owned API credentials, including revocation,
   one-time secrets, verified-recipient confirmation, and replay safety.
4. Add protected key-ring setup, rotation, verified external export, restore and
   Organization/purpose-bound secret encryption. Exercise restart and failure paths.
5. Expose the shared operations through protected UI server functions and public
   routes. Verify a real self-hosted OIDC login/create/history UI flow.
6. Review Standards and Spec separately against the baseline, correct findings,
   run typechecking/build and the full tests, then record evidence and resolution.

Each increment starts with a failing behavioral test, followed by the implementation
and focused checks. The deployment ticket retains scheduling, monitoring and measured
recovery objectives; this ticket delivers runnable manual backup and restore.
