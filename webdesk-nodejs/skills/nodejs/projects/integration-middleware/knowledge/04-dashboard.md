---
tier: 2
load_when: ["pt-integration-middleware", "design", "designer-active", "frontend-active", "g2"]
description: The admin dashboard for the DDI↔BigCommerce integration-middleware pilot — SOW-DERIVED sync-status/health/mapping/logs modules (because THIS SOW defines ERP↔store sync), NOT universal defaults; per-client + master; JWT; per-module RBAC (VED minimum).
---

# The Admin Dashboard — Integration Middleware (DDI↔BigCommerce pilot)

> Dashboard design is **SOW-driven** — read `_spine/designer-agent/knowledge/01-dashboard-standards.md` first for the SOW-first rule, the cross-cutting minimum criteria, and the fixed platform contracts (JWT, per-client + master tenancy, per-module RBAC with View/Edit/Delete as the minimum, Settings-driven timezone), plus the per-module criteria in `dashboard-modules/*`.
>
> **These modules appear because THIS SOW defines ERP↔store sync; a different SOW yields different modules — see `_spine/designer-agent/knowledge/01-dashboard-standards.md` (SOW-driven).** The sync-status, health, field-mapping, and operational-logs/DLQ modules below are **SOW-DERIVED examples for the DDI↔BigCommerce pilot**, not universal defaults. For a non-sync SOW you would not build any of them. This file documents how they were derived from the pilot's sync scope; it is not a fixed module set.

---

## 1. From the standard (fixed contracts + SOW-derived home)

The fixed platform contracts apply to this pilot as to any build (see `01-dashboard-standards.md` §3):

- **Auth:** JWT (access + refresh), refresh rotation, server-side revocation.
- **Tenancy:** per-client instance + a master (super-admin) dashboard. Every query tenant-scoped at the repository; master is the only cross-tenant scope.
- **RBAC:** per-module permission matrix — **View/Edit/Delete is the minimum**, extended per module with Create/Approve/Export/Import/Run/Configure/Manage All where needed. No Role Status / Active-Inactive.
- **Timezone:** lives in Settings, drives all cron/activity (store UTC, display configured tz — see `02-sync-engine.md` §2).

SOW-derived for this pilot (because the DDI↔BigCommerce SOW defines these): a **Dashboard home** with sync-oriented KPI cards/charts/health/activity/alerts on the **centralized KPI/metrics framework** (the property that makes the modules below cheap to add — see §3), a **Roles & Permissions** module whose matrix rows are this SOW's modules, and a **Settings** module whose sections cover the pilot's platform/integration connections (a store connection + an ERP connection appear here **because this SOW names a store and an ERP** — that is not a default). Include only what the pilot's SOW calls for.

---

## 2. Modules SOW-DERIVED for this pilot (not universal defaults)

These four modules exist **because the DDI↔BigCommerce pilot's SOW defines ERP↔store sync**. They are examples of SOW-driven design for a sync project — a different SOW (no sync) would yield none of them. Each is a normal module — so it carries a **per-module permission set** (VED minimum, extended as needed) in Roles & Permissions and a **KPI card** on the home automatically (§3). Their operational detail (Process/Sync History, Scheduled Jobs) follows the generic criteria in `dashboard-modules/05-scheduled-jobs.md` and `dashboard-modules/06-process-history.md`, specialized here to sync.

### 2.1 Sync Status

The operational console for the sync engine.

- **Per-entity status table:** entity, direction, cadence (from the contract), **last run** (tz-aware), **last status** (ok/failed/skipped), records synced last run, current watermark, next scheduled run.
- **Controls (permission-gated):** **Sync now** (force a run for an entity — calls the same sync service the cron does, `02-sync-engine.md`), **Pause / Resume** an entity's cron, **view last-run log**.
- **Run history** (`sync_runs`): drillable per entity, with duration, counts, errors.
- The Sync-now and Pause controls are gated by the **Run / Execute** flag on the Sync Status module (the extended action for "run a job", not plain Edit); nobody without it can perturb the engine.

### 2.2 Health

The at-a-glance "is everything fine" view, and the source of the master dashboard's rollup.

- **Adapter health:** each external system's `healthCheck()` result (ok/latency/detail) — ERP and store.
- **Queue + DLQ depth:** pending jobs, in-flight, **dead-lettered count** (red if non-zero).
- **Drift indicators:** last reconciliation result per entity (parity ok / divergence count).
- **SLO/SLA status:** sync freshness vs target per entity (e.g. "inventory synced within 15 min: ✓").
- This module feeds the **Project Health Score** surfaced on the **master** dashboard for retainer monitoring (`_spine/pm-agent/knowledge/09-health-score.md`, `_contracts/health-score.schema.json`).

### 2.3 Field Mapping

The in-app view (and, where allowed, edit) of the client-approved mapping.

- **Per-entity mapping table:** ERP field → canonical field → store field → direction → transform (mirrors `<system>.fields.md` from `03-dual-integration.md`).
- **Read-only by default.** Editing a mapping is a **contract change** → it re-opens G-Contracts (client re-approval). The dashboard makes that explicit: an edit drafts a change and surfaces "requires G-Contracts re-approval," it does not silently mutate a live mapping.
- Shows each contract's `status` (draft / client-approved) and `approved_at`.

### 2.4 Logs & DLQ (operational)

Beyond the inherited Activity Logs (human actions), middleware needs **operational** logs:

- **Sync/integration logs:** structured, filterable by entity/tenant/severity/time-range, tz-aware.
- **Dead-letter list:** every DLQ entry — entity, record, failure reason, attempts, first-seen. **Replay** (permission-gated) re-enqueues an entry; safe because pushes are idempotent (`02-sync-engine.md` §4). Drives the `queue-recovery` / `webhook-replay` runbooks.

---

## 3. The KPI framework does the heavy lifting

The default home's **centralized KPI/metrics framework** is why these modules are cheap to add: a new module defines only its module-specific metrics and inherits the card, trend, empty/loading/error states, and the tz-aware "as of" label. Middleware metric cards that come for free this way:

- **Items synced today**, **inventory updates last 24h**, **orders pushed to ERP today**.
- **Failed syncs last 24h**, **DLQ depth**, **oldest un-synced record age**.
- **ERP / store adapter health** (up/down + latency).
- **Reconciliation drift** (records diverged at last reconcile).

Each is a KPI card on the per-client home and rolls up to the master dashboard. Monitoring is a platform feature here, not a per-module rebuild.

---

## 4. Per-client vs master — the middleware view

|             | Per-client dashboard                   | Master dashboard (super-admin)                                        |
| ----------- | -------------------------------------- | --------------------------------------------------------------------- |
| Scope       | one client's stores/ERP, tenant-scoped | cross-client, all instances                                           |
| Sync Status | this client's entities                 | rollup: which clients have failing/paused syncs                       |
| Health      | this client's adapters/DLQ/drift       | every client's Project Health Score (GREEN/YELLOW/RED) + alert rollup |
| Mapping     | this client's contracts                | (drill-in only)                                                       |
| Who         | client admins/managers + WebDesk       | WebDesk delivery/retainer team only                                   |

The master dashboard is where retainer monitoring lives (`pt-maintenance`): a grid of client instances, each with its health score, sync status, and an error/alert rollup, drillable into the per-client instance. **The master role is the only cross-tenant scope**; everything else is scoped by `tenant_id` at the repository layer (NODE-104, `nodejs/knowledge/database/03-multi-tenancy.md`).

---

## 5. RBAC for the new modules

Each SOW-derived module is a row in the per-module permission matrix (VED minimum, extended per module — e.g. Sync Status needs **Run/Execute** for sync-now, Logs & DLQ needs it for replay). Sensible default role grants (the client tunes these):

| Module        | Admin                    | Manager                 | Viewer (custom) |
| ------------- | ------------------------ | ----------------------- | --------------- |
| Sync Status   | V·E·D·Run                | V·Run (sync-now, pause) | V               |
| Health        | V                        | V                       | V               |
| Field Mapping | V·E (drafts re-approval) | V                       | V               |
| Logs & DLQ    | V·E·D·Run (replay)       | V·Run (replay)          | V               |

The **Run / Execute** flag on Sync Status and Logs & DLQ is the dangerous one — it's the extended action that lets a user perturb the running engine (force-sync, pause, replay). Grant it deliberately. The master/super-admin role spans tenants but obeys the same per-module RBAC (VED minimum, extended per module) within each.

---

## 6. At G2 (HTML mockup) — what to demonstrate

G2 ships a running HTML/CSS/JS mockup (D-DES-01 — not Figma). For this sync-scoped pilot the mockup must show, alongside the SOW-derived home/roles/settings and the fixed-contract screens (JWT login, master):

- The **Sync Status** table with the per-entity controls (sync-now, pause) wired as visible interactions.
- A **Health** view with adapter status + DLQ depth as KPI cards from the shared framework.
- The **Field Mapping** read-only table with the "edit requires re-approval" affordance.
- The **DLQ** list with a (mock) replay action.
- The **master** dashboard grid with per-client health-score chips.
- Timezone in Settings visibly driving a "last synced at" label somewhere (proves the tz wiring is understood).

Build it against the wowdash/upbond interaction vocabulary (structure, not pixels), per the default standard.

---

Last reviewed: 2026-06-30 by Claude (initial build)
