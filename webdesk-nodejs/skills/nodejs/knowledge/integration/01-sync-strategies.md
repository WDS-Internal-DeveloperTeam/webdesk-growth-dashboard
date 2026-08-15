---
tier: 2
load_when: ["code-production", "integration-work", "sync-engine"]
description: "Continuous cron-scheduled sync — one-way vs two-way, conflict resolution, watermarks/sync-state, reconciliation, full-then-incremental."
---

# Integration 01 — Sync Strategies

> The steady state for ERP/CRM is a **permanent, cron-scheduled sync** (blueprint §6, §10) — not a one-time migration. This file is how that engine is designed: cadence, direction, watermarks, conflict resolution, and reconciliation. Timezone-aware throughout.

---

## Default pattern: continuous cron-scheduled sync

ERPs are usually **poll/cron pull+push**, not webhook-driven (DDI Inform included — verify at discovery, NODE-008). So the engine runs on a schedule, per entity:

- **Per-entity cadence** stored in the integration contract (e.g. inventory every 15 min, orders every 5 min, customers hourly). Different entities, different frequencies.
- **First run = full sync; subsequent runs = incremental** from the watermark. The full sync establishes the baseline; incrementals keep it current cheaply.
- **Idempotent and resumable** — a run killed midway resumes correctly on the next tick (NODE-102, NODE-104).

```js
// jobs/sync-job.js — one tick for one entity
export async function runSyncTick(tenantId, entity) {
  const state = await syncStateRepo.get(tenantId, entity); // watermark + last run
  const since = state?.watermark ?? null; // null → full sync
  const changes = await erpAdapter.pull(entity, { since }); // incremental from watermark
  for (const record of changes) {
    const mapped = mapErpToInternal(entity, validate(entity, record)); // validate external input
    await repo(entity).upsertByExternalId(tenantId, mapped.externalId, mapped); // idempotent
  }
  await syncStateRepo.advance(tenantId, entity, {
    watermark: maxUpdatedAt(changes),
    lastRunAt: now(),
  });
}
```

---

## Timezone-aware scheduling (blueprint §6)

- The schedule is computed in the **Dashboard Settings timezone** (`project.json.timezone`), **stored/compared in UTC.** "Sync nightly at 2am" means the _client's_ 2am.
- The scheduler reads the configured tz, never the server's local tz. **Changing the timezone reschedules the crons.**
- Reconciliation/report **day boundaries** also use the configured tz so a "daily" run lines up with the client's business day, not the server's.

```js
// node-cron with explicit timezone
cron.schedule("0 2 * * *", () => enqueueSync(tenantId, "orders"), { timezone: settings.timezone });
```

---

## Direction: one-way vs two-way

- **One-way** (source → target) is simpler and the default per entity unless the spec needs both. E.g. ERP inventory → store (store never writes inventory back).
- **Two-way** (e.g. orders flow store → ERP, fulfillment status flows ERP → store) needs explicit **per-field ownership**: each field has one authoritative system. Decide ownership at G-Contracts and record it in the contract.
- Mixing directions per field within an entity is common — document which system owns which field.

---

## Conflict resolution (two-way only)

When both sides change the same record between syncs, you need a deterministic rule, chosen at G1.5 and recorded in the contract:

- **Source-of-truth wins** (per field): the owning system always wins for its fields — usually the cleanest.
- **Last-write-wins** by timestamp: needs reliable, comparable timestamps and **clock-skew handling** (don't trust the upstream clock blindly — `failure-scenario-library.md`).
- **Manual/queue for review:** unresolvable conflicts go to a review queue surfaced on the dashboard rather than guessing.

Never resolve a conflict silently in a way that loses data — log it, and prefer surfacing over guessing.

---

## Watermarks & sync-state

Per-entity `sync_states` (see `database/01`): `{ tenant_id, entity, watermark, last_run_at, last_status, cursor? }`.

- **Watermark** = the high-water mark of processed change (max `updated_at`, or the provider's change-cursor). Next incremental pulls `> watermark`.
- **Advance the watermark only after a record is durably persisted** — advancing too early drops records on a mid-run failure (watermark-gap failure mode). Advance per-batch, not per-record-then-crash.
- **Resumability:** because the watermark only moves past persisted records, a killed run re-pulls the unfinished tail next tick. QA tests this (kill mid-sync, confirm resume — blueprint §7).

---

## Reconciliation

Incremental sync drifts (a missed change, a clock skew, an upstream that didn't bump `updated_at`). So run a **periodic reconciliation** (e.g. nightly, in the client's tz):

- Compare source vs target for the entity over a window (counts, then checksums/field-level for mismatches).
- **Heal** detected drift (re-pull and upsert the diverged records) and **report** the drift to observability (`integration/04`) — a rising drift count is an alert, not a silent fix.
- Reconciliation is the safety net that makes "eventually consistent" actually converge.

---

## Initial full sync

The first run can be large. Make it:

- **Paginated + batched** (respect rate limits — `integration/03`), with its own resumable cursor so a multi-hour initial sync survives restarts.
- **Backgrounded** (queued), not blocking the dashboard.
- Followed automatically by incremental mode once the watermark is established.

The common pull/push/normalize/sync-state shape lives behind the **ERP adapter interface** (`integrations/erp/_erp-adapter-pattern.md`) so each ERP differs only in the adapter — the engine stays the same.
