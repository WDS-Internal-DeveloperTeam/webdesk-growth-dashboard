---
name: pt-integration-middleware
description: "Integration middleware project-type — ERP/CRM ↔ Node middleware + admin dashboard ↔ commerce store (BigCommerce/Shopify). Continuous cron-scheduled sync is the core. The PILOT project-type. Loaded when project_type == integration-middleware. Use for any build whose deliverable is keeping a system-of-record ERP and a commerce store in agreement, with an admin dashboard over it."
version: 1.0.0
tier: 1
load_when: ["pt-integration-middleware"]
tools: [Read, Write, Edit, Glob, Grep, Bash]
model: sonnet
color: green
---

# Integration Middleware — Project Type (the pilot)

> The flagship project-type of this system. A client runs an **ERP/CRM as their system-of-record** (items, inventory, pricing) and a **commerce store** (orders, customers). Our deliverable is the **middleware that keeps the two in agreement** — a continuous, timezone-aware, cron-scheduled sync — plus an **admin dashboard** to operate it. The mapping _is_ the product, which is why this type has client-approved contract and schema gates.
>
> **Pilot context:** DDI System's **Inform ERP ↔ middleware + dashboard ↔ BigCommerce** for a real wholesale-distribution client. Inform is poll/cron-driven (verify at Discovery — NODE-008), which is exactly why the cron sync engine + reconciliation is the load-bearing core. See blueprint v3 §16.

---

## When this is loaded

The orchestrator loads this skill when:

- `project.project_type == "integration-middleware"`

Cascade order (context-budget §1 — only what's in scope loads):

```
1. _spine/orchestrator/SKILL.md                      (workflow + state)
2. relevant spine agent / role                       (PM / Architect / Backend / QA / Code Review / Delivery)
3. nodejs/SKILL.md                                   (the platform arm)
4. nodejs/projects/integration-middleware/SKILL.md   ← you are here
5. this skill's knowledge/* (read on demand, tier 2)
6. nodejs/integrations/<target>/*                    ONLY targets in project.integration_targets
   (pilot: integrations/erp/ddi-inform.md + integrations/bigcommerce/*)
```

A middleware project never loads `pt-frontend-tool` or `pt-version-upgrade` KB, and a `nodejs+bigcommerce` project never loads `integrations/shopify/`.

---

## What this project type is — in one diagram

```
   ┌──────────────────┐       cron pull/push        ┌──────────────────────────────┐       push/webhook       ┌──────────────────┐
   │  ERP / CRM       │  ◄────────────────────────► │   WebDesk Middleware (Node)  │ ◄──────────────────────► │  Commerce store  │
   │  system-of-record│   (items, inventory,        │   controllers → services →   │   (orders, customers,    │  BigCommerce /   │
   │  e.g. DDI Inform │    pricing, categories)     │   repositories + SYNC ENGINE │    inventory write-back) │  Shopify         │
   └──────────────────┘                             │   + admin DASHBOARD          │                          └──────────────────┘
                                                     └──────────────┬───────────────┘
                                                                    │
                                                            ┌───────▼────────┐
                                                            │ Postgres        │  users/roles/RBAC, settings (+timezone),
                                                            │ (Sequelize)     │  field mappings, sync_state, logs, DLQ
                                                            └─────────────────┘
```

The ERP is authoritative for items/inventory/pricing/categories; the store is authoritative for orders and usually customers. Two-way flows need a conflict-resolution rule. Every external system is wired through a contract (`integration-contracts/`) and behind an adapter interface — the engine never imports an ERP SDK.

---

## Knowledge in this skill — and when to read each

All knowledge files are **tier 2** — read on demand by the role doing the work, not auto-loaded.

| File                                   | Read it when                                         | What it gives you                                                                                                                                                                                                                   |
| -------------------------------------- | ---------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `knowledge/01-architecture.md`         | G1.5 architecture, scaffold, any structural decision | The reference architecture: controllers/services/repositories + the sync engine subsystems (scheduler, sync-state/watermarks, reconciliation, queue, DLQ) + dashboard. Text diagram of every box.                                   |
| `knowledge/02-sync-engine.md`          | Any sync/integration/`sync-engine` work              | **The heart.** Per-entity cron cadence from the contract, timezone-aware scheduling, initial full → incremental from watermark, idempotency, conflict resolution, overlapping-run prevention, per-run reconciliation.               |
| `knowledge/03-dual-integration.md`     | G-Contracts, wiring any system                       | Why every project wires **≥2 contracts** (system-of-record ERP + commerce store), each registered in `integration-contracts/`, and how field mapping ERP↔store works.                                                               |
| `knowledge/04-dashboard.md`            | G2 design, frontend build                            | The admin dashboard for this type: SOW-derived modules — this pilot's SOW yields sync-status / health / mapping / logs alongside home/roles/settings; per-client + master; JWT; per-module RBAC (VED minimum, extended per module). |
| `knowledge/05-backfill-and-cutover.md` | First sync, go-live                                  | Initial historical full sync, validation, go-live cutover, post-cutover reconciliation.                                                                                                                                             |
| `gates.md`                             | Every gate transition                                | The gate **differences** for this type vs the universal set (`_contracts/gate-format.md`).                                                                                                                                          |

Read alongside the arm's files (they own the reusable _how_):

- `nodejs/integrations/erp/_erp-adapter-pattern.md` — the adapter interface (load-bearing).
- `nodejs/knowledge/integration/01-sync-strategies.md`, `02-queues-and-jobs.md`, `03-rate-limits-and-backoff.md`, `04-observability.md`.
- `nodejs/knowledge/intelligence/{integration,database,failure-scenario-library}.md`.
- `_spine/designer-agent/knowledge/01-dashboard-standards.md` — the default dashboard standard this type extends.

---

## Templates in this skill

```
templates/
├── middleware-spec-section.md     drop-in spec section: targets, entities, directions, cadence, tenancy, tz
└── sync-job-checklist.md          per-entity pre-flight checklist before any sync code is written
```

The scaffolding templates the agents copy into a repo live one level up, in `nodejs/templates/` (service skeleton, migration, webhook handler, contract doc, runbooks, architecture-tests). This skill points at them; it does not duplicate them.

---

## Critical rules for this project type

1. **No integration code against a `draft` contract.** Every external system has an `integration-contracts/<system>.md` validating against `_contracts/integration-contract.schema.json`, **client-approved at G-Contracts** (NODE-008). The pilot has at least `IC-DDI-001` (DDI Inform) and `IC-BIGCOMMERCE-001`.
2. **No migration in a shared environment before G-Schema.** The data model (users/roles/RBAC, settings+timezone, field mappings, `sync_state`, logs, DLQ) is client-approved first.
3. **The sync engine is adapter-agnostic.** It imports the adapter interface and the canonical model only — never an ERP SDK, never an ERP-specific field. Each ERP differs only inside its adapter (`_erp-adapter-pattern.md`).
4. **Timezone is the Dashboard Settings value, stored UTC.** All cron cadences, sync windows, reconciliation boundaries, and displayed "last synced at" compute in `project.timezone`. Changing the timezone reschedules crons.
5. **Cron sync is the default; webhooks are store-side only, with cron reconciliation as the safety net.** ERPs are poll/cron (DDI included — verify). Never assume an ERP supports webhooks.
6. **Idempotent and resumable.** First run = full sync; subsequent runs incremental from the persisted watermark. A killed run resumes without double-applying (watermark-resume). Overlapping runs are prevented (`skip-if-running` default).
7. **Reconciliation every run-cycle.** Incremental sync drifts; a periodic parity/checksum pass repairs it and reports divergence to the dashboard + DLQ.
8. **Two external systems → G1.5 fires.** This type almost always triggers architecture review (multi-system + new datastore + cron sync + two-way + multi-tenant). See `gates.md`.
9. **Dashboard has a UI → G2 fires.** Unlike headless middleware, this type ships the admin dashboard, so G2 (HTML mockup) is required, matching the §8 default dashboard standard.
10. **Verify external APIs at Discovery, never code from memory.** DDI Inform's surface, auth, rate limits, entity coverage, and sandbox availability are confirmed at Discovery; unverified specifics stay `null` in the contract and are flagged.

---

## Milestones (typical shape — PM tunes per project)

| Milestone | Work                                                                              | Key gates                 |
| --------- | --------------------------------------------------------------------------------- | ------------------------- |
| M1        | Discovery + rough field mapping + contract/schema drafts + architecture           | G0.5, G0, G1, G1.5        |
| M2        | Contracts + schema client-approved; scaffold + Compose + sandboxes                | G-Contracts, G-Schema, G3 |
| M3        | Dashboard mockup approved; auth + RBAC + settings + dashboard shell               | G2, G4                    |
| M4        | Sync engine: adapter, scheduler, watermark/sync-state, queue, DLQ, reconciliation | G4×n                      |
| M5        | Backfill (initial full sync) + validation; load + chaos + fitness                 | G5                        |
| M6        | Observability + runbooks; cutover; go-live; health baseline                       | G5.5, G6, M6              |

---

## Output artifacts (where things land in the project workspace)

| Artifact                           | Path                                                                                       |
| ---------------------------------- | ------------------------------------------------------------------------------------------ |
| Integration contracts (per system) | `integration-contracts/_registry.md` + `integration-contracts/<system>.md`                 |
| Field-mapping tables               | `integration-contracts/<system>.fields.md`                                                 |
| Data model (client-approved)       | `data-model.md`                                                                            |
| Architecture + ADRs                | `architecture.md`, `decisions/ADR-*.md`                                                    |
| Sync-job checklists (per entity)   | `sync-jobs/<entity>-checklist.md`                                                          |
| Runbooks                           | `operations/{incident-runbooks,queue-recovery,webhook-replay,db-restore,deploy-recovery}/` |
| Architecture fitness config        | `architecture-tests/`                                                                      |

---

## Tone

This is operational software that runs forever, not a one-off launch. The client's catalog, stock, and orders depend on it being correct at 3am with nobody watching. Favor correctness, resumability, and observability over cleverness. Be explicit about what's verified vs assumed on the ERP side — getting that wrong is the most expensive failure in this type.

---

Last reviewed: 2026-06-30 by Claude (initial build)
Version: 1.0.0
