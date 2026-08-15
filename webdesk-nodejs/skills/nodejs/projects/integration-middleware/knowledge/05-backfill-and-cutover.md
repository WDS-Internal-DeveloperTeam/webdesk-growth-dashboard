---
tier: 2
load_when: ["pt-integration-middleware", "sync-engine", "g5", "g6", "launch", "backend-active"]
description: The initial historical full sync (first run), its validation, the go-live cutover, and post-cutover reconciliation — the riskiest hour of a middleware project.
---

# Backfill & Cutover — the riskiest hour

> Steady-state sync is the easy part once it's built; the **first** sync (loading all historical data) and the **cutover** (the moment the middleware becomes the live source of truth) are where projects go wrong. This file covers the initial full sync, how you validate it, how you cut over without breaking the client's store, and the reconciliation that confirms it landed. Read it with `02-sync-engine.md` (the engine) and the `operations/` runbooks (the recovery paths). Backfill happens around G5; cutover is the G6 launch.

---

## 1. Backfill = the first sync, at scale, against real data

The engine's first run for each `(tenant, entity)` has no watermark, so it's a **full sync** (`02-sync-engine.md` §3). For a real client this is **historical and large** — the whole catalog, all inventory, full pricing — and it runs against the real ERP and a (usually empty or staging) store. Treat it as its own phase, not "just the first cron tick."

Backfill rules:

- **Run it against a staging store first**, never straight into the live store. Validate there before touching production.
- **It must be resumable.** Backfill is long; it will get interrupted. The watermark/cursor that powers incremental sync also powers backfill resume — kill it, restart, it continues (watermark-resume). Don't write a separate non-resumable "import script."
- **Respect rate limits.** A full pull/push can blow past ERP or store rate limits. Throttle to the contract's `rate_limits` (or a conservative default if unverified — and flag that it's unverified). This is also why backfill runs off-hours in the client's timezone.
- **Stream, don't buffer.** `adapter.pull` is an async iterable for a reason — never load the whole ERP into memory.
- **Idempotent, like every run.** If you re-run backfill, it upserts by `externalId`; no duplicates.
- **Order matters for references.** Backfill parents before children: categories → items → inventory/pricing → (orders/customers as applicable). A pricing row that references a SKU needs the item present.

---

## 2. Validating the backfill (before cutover)

Backfill is "done" only when it's **proven correct**, not when it finishes without error. The validation set:

1. **Count parity per entity** — active SKU count, inventory rows, price rows, categories: ERP count == canonical count == store count (within a documented, explained tolerance). A mismatch is a blocker, not a warning.
2. **Spot-check field correctness** — sample N records per entity and diff every mapped field ERP↔store against the approved `<system>.fields.md`. Catches transform bugs (rounding, case, unit) that counts miss.
3. **Checksum parity** on the high-value fields (e.g. `{sku → qty}`, `{sku → price}`) for the whole set, not just samples, where feasible.
4. **Referential integrity** — every inventory/pricing row resolves to a present item; no orphans.
5. **The DLQ is empty (or fully explained).** Anything that dead-lettered during backfill is triaged before cutover — never carried into go-live.
6. **Reconciliation runs clean** — run the reconciler (`02-sync-engine.md` §7) against the staging store; zero unexplained divergence.

Record the results in a backfill validation report (counts, sample diffs, DLQ disposition). This is a G5 artifact and feeds the G6 sign-off.

---

## 3. Cutover — making the middleware live

Cutover is the moment the production store starts being driven by the middleware. It is a **planned, low-traffic-window, reversible** event — and it's part of the G6 pre-launch gate.

Pre-cutover checklist (in addition to universal G6):

- [ ] Backfill validated against staging (§2), report attached.
- [ ] Contracts `client-approved`, schema `client-approved`, no `draft` contract in the live path.
- [ ] Secrets in the secret manager (not in code/env files in the repo); production credentials for ERP + store verified live.
- [ ] **Rollback tested** — the `deploy-recovery` and `db-restore` runbooks rehearsed in staging.
- [ ] Crons **disabled** at deploy; you enable them deliberately after the first verified manual run.
- [ ] Timezone in Settings confirmed = the client's business timezone (cutover window and reconciliation boundaries depend on it).
- [ ] Observability live (G5.5): logs, metrics, alerts, dashboards, queue visibility wired and watched.
- [ ] Cutover window agreed with the client (low traffic, in their timezone), and a named person on call.

Cutover sequence:

1. **Freeze** competing writers if any (e.g. a manual store-update process the client was using).
2. **Backfill the production store** (or promote the validated staging data, per the agreed approach).
3. **Run one manual sync per entity** via the dashboard "Sync now" — watch the logs, confirm counts.
4. **Validate production parity** (the §2 checks against the live store).
5. **Enable the crons** (one entity at a time is fine — start with the slowest/safest, end with inventory).
6. **Watch** for the first full cadence cycle (see §5).

---

## 4. If cutover goes wrong

Theme of this project type: everything is reversible because everything is idempotent and the watermark is durable.

- **A bad sync** is recovered by fixing the cause and re-running — upserts are idempotent, so re-sync repairs.
- **A bad deploy** rolls back via `operations/deploy-recovery` (build→migrate→release→health-check→rollback abstraction); a bad migration rolls back via `operations/db-restore` (and migrations are reversible by G-Schema rule).
- **A backlog/DLQ pileup** is drained via `operations/queue-recovery`.
- **Pause the crons** from the dashboard the moment something looks wrong — Sync Status → Pause. Stopping the engine is one click and always safe; the watermark holds your place.

Never "push through" a failing cutover. Pause, diagnose, fix, re-run.

---

## 5. Post-cutover reconciliation & the M6 baseline

For the first 24–48 hours after go-live, reconciliation is the safety net that proves steady-state is healthy:

- **First cycle:** watch each entity complete one full cadence; confirm counts and DLQ stay clean.
- **First reconciliation pass:** must come back parity-clean (or with only explained divergence).
- **First 2 hours:** real-time watch (orders flowing both ways, no error spikes, no DLQ growth).
- **First 24 hours:** scheduled checks; any P1 (e.g. inventory diverging, orders not reaching the ERP) triggers the incident runbook and, if needed, a pause + rollback.
- **M6:** establish the **Project Health Score** baseline (`health-score.schema.json`) on the master dashboard — the steady-state monitoring that retainer (`pt-maintenance`) carries forward.

Cutover isn't "done" at go-live; it's done when the first reconciliation comes back clean and the health baseline is green.

---

Last reviewed: 2026-06-30 by Claude (initial build)
