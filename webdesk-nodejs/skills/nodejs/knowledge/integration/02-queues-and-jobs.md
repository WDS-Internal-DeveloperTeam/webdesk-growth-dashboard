---
tier: 2
load_when: ["code-production", "integration-work", "sync-engine"]
description: "node-cron vs BullMQ, idempotency, retries, backoff, DLQ, ordering, overlapping-run prevention."
---

# Integration 02 — Queues & Jobs

> How sync work is scheduled and executed reliably. Start simple (node-cron), escalate by need (BullMQ + Redis). The non-negotiables: idempotency, capped retries with backoff, a DLQ, and no overlapping runs.

---

## node-cron vs BullMQ — choose by need

|               | **node-cron**                                    | **BullMQ + Redis**                                                                                     |
| ------------- | ------------------------------------------------ | ------------------------------------------------------------------------------------------------------ |
| Good for      | simple timezone-aware schedules, single instance | concurrency, retries, DLQ, prioritization, many workers                                                |
| Gives you     | a timer that fires a function                    | a durable job queue with retry/backoff/DLQ/events                                                      |
| Escalate when | —                                                | you need any of: retries-with-backoff, a DLQ, concurrency control, job dedupe at scale, multi-instance |

**Default to node-cron**; **escalate to BullMQ the moment retries/DLQ/concurrency are required** (`technology-selection.md`). A common shape even with node-cron: cron _enqueues_ work, a small worker _processes_ it — so you get scheduling + controlled processing without prematurely adopting Redis.

---

## Idempotency (NODE-102 — the most important property)

Every job must be safe to run twice. At-least-once is the rule (cron overlaps watermarks; queues retry; webhooks redeliver).

- **Upsert keyed on a stable external id**, never blind-insert.
- **Job-level dedupe:** set `jobId` to the natural key (event id / `tenant:entity:window`) so a duplicate enqueue collapses.
- **Effects must be idempotent too:** sending an email or pushing to the store on retry must not duplicate — guard with a processed-marker / idempotency key on the outbound call.

```js
await syncQueue.add(
  "sync-orders",
  { tenantId, entity: "orders" },
  { jobId: `${tenantId}:orders:${windowStart}` },
); // duplicate window collapses
```

---

## Retries, backoff, DLQ (NODE-101)

Never retry unbounded; never retry instantly in a tight loop.

- **Cap attempts** (e.g. 5) with **exponential backoff + jitter** (`integration/03`).
- **Distinguish retryable vs terminal:** a 429/503/timeout is retryable; a 400/validation error is terminal — send it straight to the DLQ, don't burn retries.
- **Dead-letter queue:** exhausted/terminal jobs land in a DLQ with the error and payload, surfaced on the dashboard and alerted (`integration/04`). The DLQ is replayable after a fix (the `webhook-replay`/`queue-recovery` runbooks, blueprint §13).

```js
new Worker("sync-orders", handler, {
  connection,
  concurrency: 4,
  // BullMQ: capped attempts + exponential backoff
}); // job opts: { attempts: 5, backoff: { type: 'exponential', delay: 1000 } }, then → DLQ
```

---

## Overlapping-run prevention

A run that takes longer than its interval must **not** stack on the next tick (the "slow run stacks" failure mode — QA tests it, blueprint §7).

- **Per-entity lock** (Redis lock, BullMQ job dedupe by `jobId`, or a `sync_states.locked_until` row): if a run for `(tenant, entity)` is in progress, the next tick **skips or coalesces**, it doesn't run concurrently.
- Set a **lock TTL / visibility timeout** so a crashed run's lock eventually releases and the next tick recovers.
- Record skipped/coalesced ticks as a metric — chronic skipping means the cadence is too tight or the run too slow (capacity signal for G5).

---

## Ordering

- Within an entity, process in a deterministic order where it matters (e.g. by `updated_at` then id) so replays converge the same way.
- Across entities with dependencies (a customer must exist before its order), either sync the dependency first or make the dependent upsert tolerate a missing parent and reconcile later — don't assume arrival order.
- BullMQ concurrency reorders work; if strict per-key ordering is required, partition by key (one in-flight job per key) rather than relying on global FIFO.

---

## Missed runs

- On startup / after downtime, the next tick's incremental (watermark-based) naturally catches up — the watermark, not the wall clock, decides what to pull (`integration/01`). Don't try to "replay every missed cron time"; pull everything since the watermark in one catch-up run.
- Alert if the gap since `last_run_at` exceeds the expected interval (a stalled scheduler — `integration/04`).

---

## Summary of the guarantees this layer must provide

| Property                  | Mechanism                                           |
| ------------------------- | --------------------------------------------------- |
| Safe to run twice         | idempotent upsert + jobId dedupe (NODE-102)         |
| Survives upstream failure | capped retries + backoff + DLQ (NODE-101)           |
| No stacking               | per-entity lock / dedupe + TTL                      |
| No silent loss            | terminal errors → DLQ, surfaced + alerted           |
| Catches up after downtime | watermark-driven incremental, not wall-clock replay |
