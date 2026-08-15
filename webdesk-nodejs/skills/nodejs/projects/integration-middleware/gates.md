---
tier: 2
load_when: ["pt-integration-middleware", "g1_5", "g_contracts", "g_schema", "g2", "g5", "g5_5"]
description: Gate DIFFERENCES for integration middleware vs the universal gate set. This type fires almost every conditional gate — G1.5, G-Contracts, G-Schema, G2, plus a heavier G5/G5.5.
---

# Gates — Integration Middleware (vs Universal)

> Gate adjustments specific to integration middleware. Inherits the universal gate model from `_contracts/gate-format.md` — read that for the canonical format, lifecycle, SLAs, and decision semantics. This file documents only the **differences**. The headline: this is the heaviest project type for gates — it fires nearly every conditional gate, because the field mapping and contracts _are_ the product and the cron sync engine is real production infrastructure.

---

## Discovery (G0.5) — default, and load-bearing here

Default for this type (not skippable — these are never trivial). Discovery must additionally capture:

- [ ] **Both integration targets** identified (system-of-record ERP + commerce store) → `integration_targets[]`.
- [ ] **Rough field mapping** per entity (the seed of the G-Contracts mapping table).
- [ ] **API direction** per entity (which side is authoritative; pull vs push).
- [ ] **ERP API surface confirmed against real docs/sandbox** — auth, rate limits, entity coverage, pagination, sandbox availability (DDI Inform is partner/credential-gated; verify — NODE-008). Unverified specifics are recorded as `null` + flagged, never invented.
- [ ] **Timezone** (the client's business tz — drives all cron/activity).
- [ ] **Tenant mode** (per-client + master).
- [ ] **Per-entity cadence intent** (e.g. inventory frequent, items nightly).

This is the highest-leverage gate in the type: getting the ERP surface and the mapping right here prevents the most expensive class of rework.

---

## G1.5 (Architecture Review) — FIRES (don't expect to skip it)

This type trips multiple G1.5 triggers at once: **>1 external system**, **new datastore**, **cron-scheduled sync**, **two-way sync with conflict resolution**, and **multi-tenancy**. Assume G1.5 runs. It produces `architecture.md` + ADRs deciding at least: queue runtime (node-cron → BullMQ+Redis escalation), conflict-resolution policy per two-way entity, per-entity cadence, tenancy data model, idempotency strategy, and (if the ERP is on-prem) connectivity/VPN — plus the fitness-test plan (`architecture-tests/`) and the **draft** contracts/data-model. See `knowledge/01-architecture.md` §7.

---

## G-Contracts — REQUIRED + client-approved

`integration_targets` is non-empty by definition, so G-Contracts always fires and is **client-approved**. The PM formalizes the Discovery mappings into the Integration Contract Registry (`integration-contracts/_registry.md` + one `<system>.md` per system validating against `integration-contract.schema.json` + the `<system>.fields.md` mapping table). The **client signs the field mapping** ("this ERP field maps to this store field, this direction, this cadence"). CONFIRM flips each contract's `status` to `client-approved`. **No integration code may be written against a `draft` contract** (NODE-008). See `knowledge/03-dual-integration.md`.

---

## G-Schema — REQUIRED + client-approved

A datastore is introduced (Postgres + Sequelize default), so G-Schema always fires and is **client-approved** (DBA/tech-lead verifies migrations reversible, indexes sound). The PM formalizes the rough mapping into `data-model.md`: users/roles/**per-module VED permissions**, store/ERP **settings (incl. timezone)**, **field_mappings**, **sync_state**, canonical entity tables, **activity_log**, **dead_letter**. **No migration runs in a shared environment before this passes.**

---

## G2 (HTML Design Approval) — FIRES (this type has a UI)

Unlike headless middleware, this type **ships the admin dashboard**, so G2 is required. The G2 deliverable is a running HTML/CSS/JS mockup (D-DES-01 — not Figma) matching the §8 default dashboard standard **plus** the middleware modules: **Sync Status, Health, Field Mapping, Logs & DLQ**, the master dashboard grid, and visible timezone-driven "last synced at". See `knowledge/04-dashboard.md` §6. (Record G2 as `skipped`/"no UI in scope" only in the rare headless-middleware case.)

---

## G3 (Scaffold) — middleware additions

In addition to universal G3, the scaffold must bring up:

- [ ] **Docker Compose: app + Postgres + Redis + mock-erp + mock-store**, all healthy (`nodejs/templates/service-skeleton/`).
- [ ] **Both sandboxes wired** — ERP sandbox/mock + store sandbox.
- [ ] **Contract stubs present** for every system in `integration_targets` (still `draft` is fine at scaffold; code against them isn't).
- [ ] **Migration runner** works; `sync_state` migration present.
- [ ] **Scheduler skeleton** registers a no-op tz-aware cron (proves the tz wiring).

---

## G4 (Sprint QA) — sync-specific tests added

Per universal G4, plus the cron-sync test set (blueprint §7):

- [ ] Contract/integration tests vs ERP **and** store sandboxes.
- [ ] Webhook **idempotency/replay** (store side).
- [ ] **Sync-parity** — ERP and store agree per entity after a run.
- [ ] **Missed-run** — a skipped tick is recovered next run.
- [ ] **Overlapping-run** — a slow run does not stack on the next tick.
- [ ] **Watermark-resume** — kill mid-sync, resume correctly with no double-apply/gap.
- [ ] Security (OWASP-API, authz, secret/SAST/DAST) on the dashboard + API.

---

## G5 (Milestone) — adds load + chaos + fitness

Per universal G5, this type **must** run:

- [ ] **Architecture fitness tests** — controller/service/repository boundaries; **no DB access outside repositories**; **no ERP SDK in the sync engine**; API-version pin; queue retry caps (`architecture-tests/`).
- [ ] **Load + soak** — the capacity profile (sustained sync throughput) feeds the SLO/SLA. Backfill-scale runs included.
- [ ] **Chaos / fault injection** — kill the DB mid-sync, drop the ERP connection, expire a token, inject a 5xx/rate-limit; confirm retry/backoff/DLQ/resume behave.
- [ ] **Backfill validated** against staging (`knowledge/05-backfill-and-cutover.md`).

---

## G5.5 (Observability) — REQUIRED, with runbooks present

Always fires before G6 for this type. CONFIRM requires the full observability stack wired **and** the runbooks present:

- [ ] **logs, metrics, tracing, alerts, dashboards, queue visibility, SLO/SLA defined** — including sync freshness per entity, DLQ depth, adapter health, reconciliation drift.
- [ ] **Runbooks present** under `operations/{incident-runbooks,queue-recovery,webhook-replay,db-restore,deploy-recovery}/` (`nodejs/templates/operations/`).

Missing any one blocks G6.

---

## G6 (Pre-launch) — cutover-aware

Per universal G6 + the cutover checklist (`knowledge/05-backfill-and-cutover.md` §3): backfill validated, secrets in a manager, **rollback tested**, crons disabled-at-deploy then enabled deliberately, timezone confirmed = client business tz, low-traffic cutover window agreed, on-call named. Client co-approves go-live.

---

## M6 — health baseline + reconciliation watch

Per universal M6, plus the post-cutover watch (`05-backfill-and-cutover.md` §5): first-cycle + first-reconciliation must come back clean; establish the **Project Health Score** baseline on the master dashboard. Retainer monitoring (`pt-maintenance`) carries it forward.

---

## Gates summary

| Gate               | Universal                 | Integration-middleware difference                                                                         |
| ------------------ | ------------------------- | --------------------------------------------------------------------------------------------------------- |
| G0.5 Discovery     | Default                   | **Load-bearing** — both targets, rough mapping, directions, **ERP surface verified**, tz, tenant, cadence |
| G0 Spec            | Always                    | Intake must carry `integration_targets`, tz, tenant.mode                                                  |
| G1 Plan            | Always                    | Estimate→ticket; almost always >80hr (so G1.5 fires)                                                      |
| G1.5 Architecture  | Conditional               | **FIRES** — multi-system + datastore + cron sync + two-way + multi-tenant                                 |
| G-Contracts        | When targets non-empty    | **REQUIRED + client-approved** — the field mapping is the product                                         |
| G-Schema           | When datastore introduced | **REQUIRED + client-approved** — Postgres+Sequelize model                                                 |
| G2 Design          | When UI present           | **FIRES** — admin dashboard (default standard + Sync/Health/Mapping/DLQ + master)                         |
| G3 Scaffold        | Always                    | + Compose (app/pg/redis/mock-erp/mock-store) + both sandboxes + contract stubs + tz-cron skeleton         |
| G4 Sprint QA       | Always (×n)               | + sync-parity / missed-run / overlapping-run / watermark-resume / webhook-idempotency                     |
| G5 Milestone       | Per milestone             | + fitness (boundaries, no-ERP-SDK-in-engine, retry caps) + load/soak + chaos + backfill validated         |
| G5.5 Observability | Always before G6          | **REQUIRED** — full stack incl. sync freshness/DLQ/drift + runbooks present                               |
| G6 Pre-launch      | Always                    | + cutover checklist + rollback tested + crons-deliberate + tz confirmed                                   |
| M6 Monitoring      | Always                    | + post-cutover reconciliation watch + health-score baseline on master dashboard                           |

---

Last reviewed: 2026-06-30 by Claude (initial build)
