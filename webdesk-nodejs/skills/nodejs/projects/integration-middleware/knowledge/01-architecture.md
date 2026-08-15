---
tier: 2
load_when: ["pt-integration-middleware", "g1_5", "architect-active", "scaffold", "backend-active"]
description: Reference architecture for integration middleware — controllers/services/repositories + the sync engine subsystems (scheduler, sync-state/watermarks, reconciliation, queue, DLQ) + dashboard. The structural map every other knowledge file hangs off.
---

# Reference Architecture — Integration Middleware

> This is the structural map of a WebDesk integration-middleware build. Read it at G1.5 (it seeds `architecture.md`), at scaffold (it's the layout you stand up), and whenever you're deciding where a piece of code belongs. The other knowledge files in this skill go deep on individual subsystems; this one shows how they fit together and what imports what. Read it with `nodejs/integrations/erp/_erp-adapter-pattern.md` (the adapter interface) and `nodejs/knowledge/integration/01-sync-strategies.md` (the engine mechanics).

---

## 1. The layered request path + the background path

A middleware build has **two execution paths**, and they share the same lower layers (services, repositories, DB, adapters):

1. **The synchronous HTTP path** — the admin dashboard and any external API. `controller → service → repository → DB`.
2. **The asynchronous sync path** — the cron-scheduled sync that runs forever with nobody watching. `scheduler → sync runner → service → repository → DB`, and `scheduler → sync runner → adapter → external system`.

Keeping these two paths on the same service/repository layer is deliberate: a "force a sync now" button in the dashboard and the 2am cron tick call the _same_ sync service. There is one implementation of the work; the trigger differs.

```
                          HTTP path                                          Background path
                          ─────────                                          ───────────────
  browser ── JWT ──► [ controller ] ──► [ service ] ◄────────────────────── [ sync runner ] ◄── [ scheduler (cron, tz-aware) ]
   (dashboard)          HTTP only          business logic                       per tenant/entity         reads cadence from contract
                                               │                                     │
                                               ▼                                     ├──► [ adapter ] ──► external ERP / store
                                         [ repository ]  ◄── ONLY layer that         │      (pull/push/normalize)
                                               │            touches the DB           ├──► [ queue / worker ] ──► retries, DLQ
                                               ▼                                     └──► [ reconciler ] ──► parity, divergence report
                                        ┌─────────────┐
                                        │  Postgres   │  users·roles·RBAC · settings(+tz) · field_mappings ·
                                        │ (Sequelize) │  sync_state · entity tables · activity_log · dead_letter
                                        └─────────────┘
```

**Boundary rules (enforced by architecture fitness tests at G5 — `architecture-tests/`):**

- Controllers are HTTP-only: parse/validate input, call a service, shape the response. No business logic, **no repository imports**, no DB.
- Services hold business logic and orchestration. They call repositories and adapters. They never import controllers.
- Repositories are the **only** code that touches the DB / Sequelize. No raw queries leak elsewhere (NODE-104 is tenant-scoping; the boundary itself is the fitness rule `no-db-outside-repositories`).
- The sync engine imports the **adapter interface** and the **canonical model** — never an ERP SDK or an ERP-specific field (`no-erp-sdk-in-engine`).

---

## 2. The sync engine — subsystem by subsystem

The sync engine is the part that makes this a middleware project rather than a CRUD app. Five subsystems, each with one job. Details live in `02-sync-engine.md`; here is the inventory and how they connect.

### 2.1 Scheduler (timezone-aware cron)

- Owns _when_ sync runs. Reads each entity's cadence from the integration contract (`sync.cron` / `sync.cadence_per_entity`).
- Interprets every cron expression in `project.timezone` (the Dashboard Settings → Timezone value), **not** the server's local tz. "Nightly at 2am" means the client's 2am. Stored UTC, computed in the configured zone.
- Changing the timezone in Settings **reschedules** all crons. The scheduler subscribes to the settings change.
- Default runtime: **node-cron**; escalates to **BullMQ + Redis** when concurrency / retries / DLQ semantics are needed (`nodejs/knowledge/integration/02-queues-and-jobs.md`). The rest of the engine is agnostic to which.

### 2.2 Sync runner (the per-tenant, per-entity loop)

- Triggered by the scheduler (or a dashboard "sync now"). For one `(tenant, entity)`:
  1. Acquire the run lock (overlap protection — `skip-if-running`). If a prior run for this key is still going, skip this tick.
  2. Load `sync_state` for the key → get the watermark/cursor.
  3. Stream `adapter.pull(entity, watermark)` (first run: watermark `null` → full sync).
  4. For each raw record: `adapter.normalize` → `service.upsert` (idempotent, tenant-scoped) → advance the watermark.
  5. For push directions: `service.collectOutbound` → `adapter.push` (idempotent per record) → record results.
  6. Persist `sync_state`.
  7. Hand divergence/failures to the queue/DLQ; trigger the reconciler per its own (coarser) cadence.

### 2.3 Sync-state / watermark store

- A `sync_state` table keyed by `(tenant_id, entity)`: `watermark` (the `modifiedAt` high-water mark), `cursor` (opaque pagination resume point), `last_run_at`, `last_status`, `last_error`.
- This is what makes sync **resumable**: kill the process mid-run, restart, and it resumes from the persisted watermark without double-applying (watermark-resume — a QA-tested property).
- Repository-owned like every table. The adapter base class's `getSyncState`/`setSyncState` go through this repository.

### 2.4 Queue + workers

- Push operations, retries, and any record that needs out-of-band processing flow through a queue.
- **Capped** retries with exponential-jitter backoff — caps come from the contract's `retry_policy`, enforced by a fitness rule (queue retry caps). Never unbounded retry (NODE-101).
- node-cron in-process for simple cases; BullMQ + Redis when you need concurrency control, scheduled retries, and a durable DLQ.

### 2.5 Dead-letter queue (DLQ)

- Records that exhaust retries land in a `dead_letter` table / BullMQ failed set — **never silently dropped**.
- Surfaced on the dashboard (a KPI card + a drillable list) and drained by the `queue-recovery` / `webhook-replay` runbooks. Replaying a DLQ entry is safe because pushes are idempotent.

### 2.6 Reconciler

- Independent of the incremental ticks, on a coarser cadence (e.g. nightly). Catches what incremental sync misses: edits that don't bump `modifiedAt`, clock skew, watermark-window gaps.
- Does count/checksum parity per entity between ERP and store; emits a divergence report to the dashboard and pushes unreconcilable records to the DLQ.
- Reconciliation is itself a cron entry in the contract.

---

## 3. Where the dashboard fits

The admin dashboard is a first-class subsystem, not a bolt-on (full spec in `04-dashboard.md`). Architecturally:

- It is served by the **HTTP path** — its API is `controller → service → repository`, the same layers the sync engine uses for persistence.
- It reads sync health from the **same** `sync_state`, `activity_log`, and `dead_letter` tables the engine writes. There is no separate "monitoring database" — the operational truth and the displayed truth are one store.
- It writes operational commands (force-sync, pause-cron, replay-DLQ-entry, edit-field-mapping) back through services — so a human action and a scheduled action share one code path and one audit trail.
- Auth is JWT (access + refresh); authorization is per-module RBAC (VED minimum, extended per module). Every query is tenant-scoped at the repository layer; the **master** dashboard role is the only cross-tenant scope.

---

## 4. The persistence model (finalized at G-Schema, client-approved)

Illustrative table inventory — the exact columns are approved at G-Schema. Group them by concern:

| Concern           | Tables (illustrative)                                                                                                               |
| ----------------- | ----------------------------------------------------------------------------------------------------------------------------------- |
| Identity & access | `users`, `roles`, `role_module_permissions` (the extensible per-module action matrix — VED minimum, extended per module), `tenants` |
| Configuration     | `settings` (store name/url/api creds/api path/**timezone**), `integration_contracts` (or file-backed registry)                      |
| Mapping           | `field_mappings` (the ERP↔store row-by-row, client-signed)                                                                          |
| Sync runtime      | `sync_state` (per tenant/entity watermark+cursor), `sync_runs` (history)                                                            |
| Canonical data    | per-entity tables: `items`, `inventory`, `customers`, `orders`, `pricing`, `categories` (canonical shape)                           |
| Operations        | `activity_log` (the dashboard's Activity Logs surface), `dead_letter`                                                               |

Every business table carries `tenant_id`; the repository layer scopes every query by it (NODE-104). See `nodejs/knowledge/database/03-multi-tenancy.md`.

---

## 5. External systems are wired through contracts + adapters only

The middleware talks to **at least two** external systems (ERP + store — see `03-dual-integration.md`). Each is:

- Configured by one **integration contract** (`integration-contracts/<system>.md`, validated against `_contracts/integration-contract.schema.json`, client-approved at G-Contracts).
- Implemented behind one **adapter** (the ERP adapter interface from `_erp-adapter-pattern.md`; the store has the analogous module under `integrations/<store>/`).

The engine never branches on "if DDI Inform … else BigCommerce …". It drives every adapter through the same interface. Adding the next ERP is "write an adapter," not "re-architect the engine."

---

## 6. The directory shape (what scaffold stands up)

Copied from `nodejs/templates/service-skeleton/` and extended for this type:

```
src/
├── controllers/        HTTP only (auth, users, roles, settings, sync, mappings, health)
├── services/           business logic (auth-service, sync-service, mapping-service, reconcile-service)
├── repositories/       ONLY DB access (user-repo, sync-state-repo, mapping-repo, dead-letter-repo, ...)
├── routes/             route → controller wiring
├── jobs/               scheduler + sync runner + reconciler entry points (cron registration)
├── integrations/
│   ├── erp/<erp>/       adapter implementing the interface (pilot: ddi-inform)
│   └── <store>/         store module (pilot: bigcommerce)
├── lib/                errors, error-handler, logger, crypto, tz helpers
├── config/             env loading + validation (incl. timezone, db, redis)
└── db/
    ├── models/         Sequelize models
    └── migrations/     reversible migrations (none run in a shared env before G-Schema)
integration-contracts/  _registry.md + per-system contract + .fields.md mapping tables
architecture-tests/     dependency-cruiser config + fitness node:tests (gated G5)
operations/             runbooks (incident, queue-recovery, webhook-replay, db-restore, deploy-recovery)
decisions/              ADRs
```

---

## 7. What to decide at G1.5 (this architecture's open questions)

The architecture review produces `architecture.md` + ADRs answering at least:

- **Queue runtime:** node-cron (start) vs BullMQ+Redis (when concurrency/retries/DLQ needed). ADR it.
- **Conflict resolution** for any two-way entity (system-of-record-wins / last-write-wins / manual queue).
- **Per-entity cadence** (inventory frequent, pricing/items coarser) — drafted into the contract.
- **Tenancy data model** (shared-schema with `tenant_id` vs schema-per-tenant) — almost always shared-schema + `tenant_id`.
- **Idempotency strategy** per push (`{entity}:{externalId}:{modifiedAt}` vs a provider key).
- **Host/connectivity** if the ERP is on-prem behind a VPN (changes the deploy + runbooks).

Each becomes an ADR under `decisions/` with an enforcing fitness test where one applies.

---

Last reviewed: 2026-06-30 by Claude (initial build)
