# Durable resource coordination research

Status: evidence for specification work; no protocol selected.
Checked: 2026-10-06.
Question: durable shared-read and exclusive-write intentions on an exact Resource
identity across races, crashes, human waits, cancellation, and external effects.

## SurrealDB evidence

The upstream release page marked v3.3.0 as Latest when checked on 2026-10-06
(release entry dated 2026-09-28). SurrealDB documents `FOR UPDATE` as available
since v3.3.0. Confirm the actual candidate version before relying on it.
[SurrealDB releases](https://github.com/surrealdb/surrealdb/releases),
[SELECT reference](https://surrealdb.com/docs/reference/query-language/statements/select)

SurrealDB documents manual transactions as atomic and snapshot-isolated. Concurrent
transactions that modify the same key cannot both commit; the later commit fails
with a conflict and must be retried. Plain reads are not conflict-checked by
default. Since 3.3.0, `FOR UPDATE` registers named record IDs for commit-time
conflict validation, including an ID that is absent when read. It does not take a
blocking lock or wait, and it does not cover table ranges or predicates. The
documented isolation level is not serializable. [Transactions guide](https://surrealdb.com/docs/learn/querying/concepts-and-guides/transactions),
[SELECT / FOR UPDATE](https://surrealdb.com/docs/reference/query-language/statements/select)

**Inference, not a proved protocol:** one coordination record per exact Resource
could arbitrate claims if every acquire, release, conversion, and expiry operation
checks and writes that same record atomically, then reports a grant only after
commit. A shared claim must check for no active exclusive claim; an exclusive
claim must check for no incompatible active claim. Reading active grant Facts
without writing a common conflict record is unsafe under snapshot isolation:
concurrent decisions can both commit. SurrealDB documentation recommends a record
representing the set when protecting a set invariant. [Transactions guide](https://surrealdb.com/docs/learn/querying/concepts-and-guides/transactions)

Record IDs are unique within their table, and creating an existing ID errors.
Unique indexes reject duplicate indexed values. These primitives can enforce a
coordination-record or acquisition-request key, but do not implement reader sets,
writer exclusion, waiting, expiry, or fairness. Repeating a create is an error,
not a documented idempotent success. Safe retry after a lost response therefore
needs a stable request ID and a transaction that returns the existing grant for
the same request rather than creating a second one. [Record IDs](https://surrealdb.com/docs/learn/schema-management/tables-and-fields/record-ids-and-addressing),
[unique indexes](https://surrealdb.com/docs/learn/schema-management/indexes/index-types-and-strategies)

The transaction can append an immutable Fact and update coordination state
atomically if both writes are in the same successful transaction. This makes the
Fact evidence of the committed grant; it does not include a remote provider
effect. SurrealDB also documents asynchronous events as running after commit in a
separate transaction, so they are not the grant's atomicity boundary. [Transactions guide](https://surrealdb.com/docs/learn/querying/concepts-and-guides/transactions)

These docs establish database primitives, not a ready-made durable reader/writer
lock or TTL lease protocol. Durability depends on storage engine and sync settings.
They do not prove application retry behavior, failover behavior, or the proposed
protocol on a configured deployment. [Transactions guide](https://surrealdb.com/docs/learn/querying/concepts-and-guides/transactions)

## Facts, Resource identity, and contention

The [canonical glossary](../../../CONTEXT.md) defines Fact as immutable evidence.
Accepted [ADR 0004](../../../docs/adr/0004-serialized-durable-workflow-runs.md)
requires a Workflow Run to retain ownership through human waits/restarts and
distinguishes a Cancellation Request from evidence execution stopped.

A coordination record plus grant/release Facts separates current admission state
from audit history. It is sound only if the state change and Fact commit together,
all contenders for that Resource conflict on the same serialized record or
equivalent compare-and-set, and every protected write validates ownership. Facts
alone can arbitrate only if appending a grant is itself conditional on the current
per-Resource stream/version, checks active claims in that same atomic operation,
and rejects/retries on a concurrent append. Timestamps, append-only storage, and
read active Facts, then append do not create mutual exclusion.

The proposal allows multiple Workflow Runs to read the same exact Branch, while a
modifying claim conflicts with those readers. The claim key must identify that
Branch within its Repository/provider context, not just its display name; exact
identity and rename/deletion semantics remain open. Different Branch identities
need independent conflict points to allow independent work. [Parent proposal](../proposal.md)

SurrealDB's commit-conflict rule does not document FIFO order or writer preference.
If new readers continue joining while a writer waits, writers can starve. A queue,
ticket, or reader-admission policy would be additional protocol state with its own
progress guarantee and test. For bundles, claiming one Resource and holding it
while waiting for another can create an application-level wait cycle. An
all-or-nothing transaction over the bundle avoids retaining partial claims on a
normal conflict, subject to the target deployment supporting and passing that
multi-record transaction test. SurrealDB `FOR UPDATE` is optimistic and nonblocking,
so do not describe it as a database row-lock deadlock. [Transactions guide](https://surrealdb.com/docs/learn/querying/concepts-and-guides/transactions)

## Leases, fencing, and external outcomes

Expiry can restore admission availability; it cannot stop a paused or partitioned
worker. The Chubby paper documents shared-reader/exclusive-writer locks and the
delayed-request race: a former holder may send a request after a new holder has
acquired the lock. Chubby's sequencer carries lock, mode, and generation; the
recipient validates it and rejects stale generations. This is fencing, and works
only where each protected recipient checks the token. Chubby also calls locks
advisory. [Google Chubby paper](https://research.google.com/archive/chubby-osdi06.pdf)

etcd v3.6 ties a lock ownership key to a lease, expires the lock with that lease,
and treats repeated Lock calls with the same lease as one acquisition. Its
guidance warns that lease expiry can occur while a client still believes it owns
the lease, that the Lock API alone is not mutual exclusion, and that external
resources must validate versions/fencing themselves. A Factory token therefore
cannot fence a provider write unless the provider or a Factory-controlled write
gateway checks it on each mutation. etcd also documents that a client may be
uncertain whether a timed-out operation committed. [etcd concurrency API](https://etcd.io/docs/v3.6/dev-guide/api_concurrency_reference_v3/),
[etcd lock guidance](https://etcd.io/docs/v3.6/learning/why/),
[etcd API guarantees](https://etcd.io/docs/v3.6/learning/api_guarantees/)

A Cancellation Request does not prove the worker or its in-flight request stopped.
Release of an exclusive claim is safe only after stop is confirmed or all later
writes are fenced against the old generation. This matches ADR 0004.

A database cannot atomically commit with an unrelated provider API. A crash after
provider acceptance but before local confirmation leaves an uncertain outcome.
A transactional outbox can persist local intent atomically, but typical delivery
is at least once and needs idempotent consumers. Provider idempotency keys help
only within the provider's stated scope and retention; Stripe, for example, may
prune keys after at least 24 hours. Where the provider cannot deduplicate or fence
a write, reconcile against provider evidence before retrying; if the outcome
remains uncertain, use ADR 0004's human reconciliation rule. No exactly-once
external-effect claim follows from these sources. [AWS transactional outbox](https://docs.aws.amazon.com/prescriptive-guidance/latest/cloud-design-patterns/transactional-outbox.html),
[Stripe idempotency](https://docs.stripe.com/api/idempotent_requests),
[ADR 0004](../../../docs/adr/0004-serialized-durable-workflow-runs.md)

## Minimum falsification tests

| Test | Falsifier |
| --- | --- |
| Race two readers, reader versus writer, and two writers on one Branch. | Conflicting grants both commit/report success, or compatible readers are lost. |
| Claim two different Branches in one Repository concurrently. | One Branch blocks or invalidates the other without a broader claim rule. |
| Race creation of an absent coordination record and retry one request after dropping its commit response. | Duplicate logical grant, ambiguous outcome, or absent-record race admits incompatible claims. |
| Inject write conflicts and retry across the selected server, SDK, engine, and topology. | Retry omits a condition/Facts write, or a stale decision commits. |
| Crash/restart an all-or-nothing multi-Resource bundle; race overlapping bundles. | Partial claims remain, incompatible bundle commits, or retry cannot recover. |
| Keep readers arriving while a writer waits; check the declared fairness policy. | The promised progress bound is violated. |
| Pause a holder past expiry, admit a new holder, resume the old worker, and deliver a delayed write. | The stale generation changes Factory state or the external Branch. |
| Cancel during execution/in-flight publish, then reacquire; crash before/after provider acceptance and retry. | Reacquisition overlaps live writes, duplicate external effect, or uncertainty is reported as confirmed. |
| Rebuild claim state from immutable Facts and compare it with live coordination state after restart. | History cannot distinguish request/grant/release/expiry or rebuild disagrees with admission. |

## Evidence gaps

- Target SurrealDB version, SDK, storage engine, sync configuration, and topology
  are unspecified; the documented guarantees need deployment-specific validation.
- Exact Branch identity, claim conversion, fairness, expiry, cleanup, and bundle
  semantics are not selected.
- No source-control provider was selected; provider fencing/idempotency and
  outcome-reconciliation capabilities remain unknown.
- These sources do not establish exactly-once Workflow Run or external Activity
  execution.
