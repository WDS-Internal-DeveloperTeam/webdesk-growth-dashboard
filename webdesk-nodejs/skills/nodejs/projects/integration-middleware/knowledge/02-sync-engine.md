---
tier: 2
load_when:
  ["pt-integration-middleware", "sync-engine", "integration-work", "backend-active", "g1_5"]
description: The heart of the project type — per-entity timezone-aware cron, initial full → incremental from watermark, idempotency, conflict resolution, overlapping-run prevention, per-run reconciliation. The correctness rules for the sync engine.
---

# The Sync Engine — the heart of integration middleware

> This is the load-bearing subsystem. Everything else (dashboard, auth, even the data model) exists to operate and observe what this engine does. Get this right and the project works at 3am unattended; get it wrong and you corrupt the client's catalog, stock, or orders. Read it with `nodejs/integrations/erp/_erp-adapter-pattern.md` (the interface the engine drives), `nodejs/knowledge/integration/01-sync-strategies.md` and `02-queues-and-jobs.md` (mechanics), and `nodejs/knowledge/intelligence/failure-scenario-library.md` (the pre-flight rule). The engine never imports an ERP SDK — it only touches the adapter interface and the canonical model.

---

## 1. Per-entity cadence comes from the contract, never hard-coded

Different entities need different freshness. Inventory going stale costs oversells; an item description being an hour late costs nothing. So cadence is **per entity**, declared in the integration contract (`sync.cron` + `sync.cadence_per_entity`), client-visible at G-Contracts, and read by the scheduler at runtime:

```jsonc
// from integration-contracts/ddi-inform.md → the contract object
"sync": {
  "pattern": "scheduled",
  "timezone_source": "project.timezone",
  "cadence_per_entity": [
    { "entity": "inventory", "cron": "*/15 * * * *" },   // every 15 min — stock is the perishable one
    { "entity": "pricing",   "cron": "0 * * * *"     },   // hourly
    { "entity": "items",     "cron": "0 2 * * *"     },   // nightly at the client's 2am
    { "entity": "categories","cron": "0 2 * * *"     }
  ],
  "overlap_policy": "skip-if-running",
  "incremental": true,
  "watermark_field": "modifiedAt"
}
```

The engine never contains a literal cron string. If the client wants inventory every 5 minutes, that's a contract change (and a re-approval), not a code change.

---

## 2. Timezone: the Dashboard Settings value is the only clock

Blueprint §6 is non-negotiable here. **Every operational time is computed in `project.timezone`** (the Settings → Timezone value), stored in UTC.

- Cron schedules are interpreted in the configured zone. `0 2 * * *` fires at **2am in the client's timezone**, not the server's.
- Sync windows, reconciliation boundaries ("today's business day"), report ranges, and the displayed "last synced at" all use the configured zone.
- Storage is always UTC; display and scheduling convert to the configured zone.
- **The scheduler reads the timezone from Settings, never `process.env.TZ` or the host clock.**
- **Changing the timezone reschedules all crons.** The settings-update service emits a change the scheduler subscribes to; on change it tears down and re-registers every cron in the new zone. (Tested: change tz → next fire lands at the new local time.)

Implementation note: schedule with a tz-aware scheduler (node-cron supports a `timezone` option; BullMQ repeatable jobs take a `tz`). Pass `settings.timezone` explicitly on every registration. Never rely on the default.

```js
// jobs/scheduler.js — illustrative, ESM
import cron from "node-cron";

/** @param {{timezone: string}} settings */
export function registerEntitySync(entity, cronExpr, settings, runner) {
  // timezone is ALWAYS the configured value, never server-local (blueprint §6)
  return cron.schedule(cronExpr, () => runner.run(entity), {
    timezone: settings.timezone,
    scheduled: true,
  });
}
```

---

## 3. Initial full sync → incremental from watermark

The first run for a `(tenant, entity)` has no watermark → it is a **full sync** (pull everything). Every subsequent run is **incremental**: pull only records changed since the persisted watermark.

```
state = syncStateRepo.get(tenantId, entity)        // {watermark, cursor} or null
since = state?.watermark ?? null                    // null ⇒ first run ⇒ full sync
for await (const raw of adapter.pull(entity, since)) {
  const record = adapter.normalize(entity, raw)     // → canonical
  await syncService.upsert(tenantId, entity, record) // idempotent, tenant-scoped
  watermark = max(watermark, record.modifiedAt)     // advance high-water mark
  cursor = raw.__cursor ?? cursor                    // opaque resume point
}
await syncStateRepo.set(tenantId, entity, { watermark, cursor })
```

- **`adapter.pull` streams/paginates** — never buffer the whole ERP in memory (`_erp-adapter-pattern.md`).
- The **watermark advances as records are applied**, not at the end, so a mid-run kill leaves the watermark at the last applied record → resume picks up correctly.
- The cursor handles providers whose pagination can't be expressed as a timestamp.

The full historical first sync (backfill) and its validation/cutover are detailed in `05-backfill-and-cutover.md`.

---

## 4. Idempotency — the property that makes everything else safe

Every operation must be safe to run twice. This is what lets us retry, resume, and replay without fear.

- **Pulls upsert by `externalId`** (the ERP's primary key), tenant-scoped. Re-applying a record is a no-op. So re-processing after a crash or a watermark overlap is harmless.
- **Pushes are deduped by an idempotency key** — `{entity}:{externalId}:{modifiedAt}` (or a provider-supplied key where one exists, e.g. an `X-Idempotency-Key`). The push path checks the key before writing; a duplicate push returns the prior result (NODE-102).
- **Webhook handlers (store side) dedupe on an idempotency key** before doing work, returning `200` for a duplicate (see `nodejs/knowledge/security/04-webhook-security.md` and the `webhook-handler-template.js`).

Because pulls are idempotent, the safe failure posture is **at-least-once with idempotent apply**, not exactly-once-with-no-retry. Retries are cheap and correct; lost records are not.

---

## 5. Conflict resolution (only when an entity is two-way)

Most entities are one-way (ERP → store, or store → ERP). When `directions` includes both `pull` and `push` for an entity, the contract **must** define `sync.conflict_resolution` (the schema requires it). The supported policies:

| Policy                          | When to use                                                      | Rule                                                                                                        |
| ------------------------------- | ---------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------- |
| `system-of-record wins`         | The ERP is authoritative for the field                           | On conflict, the ERP value overwrites the store value. The store can never win for items/inventory/pricing. |
| `last-write-wins by updated_at` | Both sides legitimately edit (rare)                              | Compare `modifiedAt`; the newer write wins. Requires trustworthy clocks → clock-skew handling.              |
| `manual review queue`           | Conflicts are business-meaningful and shouldn't be auto-resolved | Divergent records go to a review queue surfaced on the dashboard; a human decides.                          |

Default for this type: **the ERP is system-of-record for items/inventory/pricing/categories** (ERP wins), the **store is authoritative for orders and usually customers** (store wins). Anything genuinely two-way is an explicit ADR + a contract `conflict_resolution` value, client-approved.

---

## 6. Overlapping-run prevention

A run that takes longer than its cadence must **not** stack on the next tick — that doubles load and can interleave writes. `overlap_policy` (default `skip-if-running`) governs it:

- **`skip-if-running`** (default) — acquire a per-`(tenant, entity)` lock at run start; if held, skip this tick and log a "skipped, prior run in progress" event. The skipped tick is not lost — the next tick picks up from the watermark.
- **`queue`** — defer the tick behind the running one (BullMQ; bounded, with a max backlog).
- **`allow-overlap`** — only for genuinely independent, idempotent, partitioned work. Rare; ADR-justified.

The lock is real (a DB row lock, a Redis lock via BullMQ, or `SELECT … FOR UPDATE` on `sync_state`), not an in-process boolean — because there can be more than one process. QA covers this with **overlapping-run tests** (a slow run must not stack).

---

## 7. Reconciliation every cycle

Incremental sync **drifts** — that is a certainty, not a risk. Causes: ERP edits that don't bump `modifiedAt`, clock skew, a watermark window that misses a record, a push that half-succeeded. So a **reconciler** runs on a coarser cadence (e.g. nightly), independent of incremental ticks:

1. **Parity check per entity** — compare counts and/or field checksums between ERP and store (e.g. active SKU count; hash of `{sku, qty}` for inventory). Cheap, catches gross drift.
2. **Windowed re-pull** where the watermark can miss edits — re-pull a trailing window (e.g. last 48h) to repair `watermark-gap`.
3. **Divergence report** to the dashboard; records that can't be auto-reconciled go to the DLQ for a human.
4. Reconciliation is a cron entry in the contract like any other cadence.

QA covers reconciliation with **sync-parity** tests; resumability with **watermark-resume** tests (kill mid-sync, confirm correct resume).

---

## 8. The pre-flight failure-mode rule (do this before writing sync code)

Per the Failure Scenario Library (`nodejs/knowledge/intelligence/failure-scenario-library.md`), **before** writing integration code for an entity, list the in-scope failure modes and state the handling. Each maps to a `failure_modes[]` entry in the contract. The canonical list for cron sync:

| Failure mode        | Handling                                                                                       |
| ------------------- | ---------------------------------------------------------------------------------------------- |
| `api-timeout`       | bounded retry + exponential-jitter backoff; then DLQ                                           |
| `rate-limit`        | respect the limit (token bucket / Retry-After); back off; never hammer                         |
| `token-expiry`      | refresh/rotate per the contract `auth.token_refresh`; retry once after refresh                 |
| `duplicate-webhook` | idempotency key dedupe → `200`, no double-apply                                                |
| `partial-sync`      | watermark only advances past applied records; resume completes it                              |
| `overlapping-sync`  | `skip-if-running` lock                                                                         |
| `out-of-order`      | upsert by `externalId` + compare `modifiedAt`; don't let an older record overwrite a newer one |
| `clock-skew`        | tolerance window on watermark comparisons; reconciliation as the backstop                      |
| `watermark-gap`     | trailing-window re-pull in reconciliation                                                      |
| `upstream-5xx`      | treat as transient: retry + backoff; alert if sustained                                        |
| `schema-drift`      | `normalize` throws on unexpected shape (NODE-005); surfaces loudly, never silently maps wrong  |

Skipping this step is the most common way correctness bugs reach production in this project type.

---

## 9. The run loop, end to end

```
scheduler tick (cron, in project.timezone)
  └─► syncRunner.run(tenant, entity)
        ├─ acquire lock        → held? skip + log, done.       (overlap protection §6)
        ├─ state = syncStateRepo.get(tenant, entity)
        ├─ for await raw in adapter.pull(entity, state.watermark):   (§3, full first run)
        │     record = adapter.normalize(entity, raw)               (canonical; throws on drift §8)
        │     syncService.upsert(record)                            (idempotent, tenant-scoped §4)
        │     advance watermark/cursor
        ├─ for push entities: adapter.push(collectOutbound())       (idempotent §4)
        │     on exhausted retries → DLQ                            (never drop §8)
        ├─ syncStateRepo.set(tenant, entity, {watermark, cursor})
        ├─ emit metrics + activity_log (tz-aware "as of")           (dashboard reads this §04-dashboard)
        └─ release lock
periodically (coarser cron):
  └─► reconciler.run(tenant, entity)   → parity + windowed re-pull + divergence report   (§7)
```

---

## 10. What QA verifies (so build it testable)

From blueprint §7, the sync-specific tests this engine must pass at G4/G5:

- **Contract/integration tests** against the ERP sandbox/mock and the store sandbox.
- **Sync-parity** — after a run, ERP and store agree per entity.
- **Missed-run** — a skipped tick is recovered by the next run.
- **Overlapping-run** — a slow run does not stack on the next tick.
- **Watermark-resume** — kill mid-sync; on restart it resumes from the persisted watermark with no double-apply and no gap.

Design the engine so these are testable: inject the clock, inject the adapter (use the mock-erp/mock-store from Docker Compose), make `sync_state` inspectable, make the lock observable.

---

Last reviewed: 2026-06-30 by Claude (initial build)
