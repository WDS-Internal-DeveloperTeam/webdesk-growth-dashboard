---
tier: 2
load_when: ["pt-custom-app-build", "g0", "g1", "g_schema", "g2"]
description: Gate differences for the custom-app-build project-type vs the universal set — which gates fire and which commonly skip, driven by the app shape.
---

# Gates — Custom App Build (vs Universal)

> Inherits the universal gate model and format from `_contracts/gate-format.md`. This file documents only the **differences**. The defining difference for this type: it is greenfield and often self-contained, so several middleware-heavy gates **skip**. Which ones depends on the app shape (`knowledge/01-app-shapes.md`). Every skip is recorded on the gate entry with a reason — a skipped gate is a decision, not an omission.

---

## Discovery (G0.5) — kept, and load-bearing

Default per universal. Do **not** skip it. For this type Discovery does one extra job: **it fixes the app shape** (pure API / API + dashboard / worker-jobs / internal tool — `knowledge/01-app-shapes.md`). The shape decides every conditional gate below, so settling it here is what lets you skip correctly downstream. If the app calls any external API, verify it here (NODE-008) — surface, auth, rate limits, sandbox.

---

## G1 (Plan + Estimate) — shape-aware estimate

The plan deliverable records the **chosen app shape** and the **resulting gate set** (which conditional gates fire, which are recorded skipped and why). This is what the estimate is built against. On CONFIRM the estimate is recorded as a ticket per universal G1.

---

## G1.5 (Architecture Review) — conditional, often skipped

Fires only when a universal G1.5 trigger holds: estimate > 80 hrs, a new datastore, async jobs / cron-scheduled work, multi-tenancy, auth beyond a single static key, or a caching/rate-limit strategy. A **small single-shape app commonly skips G1.5** — record it `skipped` with the reason (e.g. "single API service, 40 hr, single datastore, single-key auth — no trigger met"). A worker/jobs service that introduces a queue **does** fire it (async trigger).

---

## G-Contracts — only if `integration_targets` non-empty

Many custom apps call no external system. When `project.integration_targets` is empty, record G-Contracts **`skipped`, reason "no integration targets"**. When the app does call an external API, that system gets an `integration-contracts/<system>.md` validating against `_contracts/integration-contract.schema.json`, client-approved here, and **no integration code is written against a `draft` contract**. This gate is the exception, not the norm, for this type.

---

## G-Schema — only if the app is stateful

If the app has a datastore (the common case — Postgres + Sequelize default), the data model is client-approved here before any shared-environment migration runs, exactly per universal. A **stateless app** (pure transform, proxy, or a tool that persists nothing) records G-Schema **`skipped`, reason "no datastore in scope"**.

---

## G2 (Design Approval) — only if there's a UI

- **API + dashboard / internal tool with UI:** G2 fires. The deliverable is a running HTML/CSS/JS mockup (D-DES-01). If it's a dashboard, it matches the §8 dashboard standard (JWT login, per-module VED RBAC, Settings incl. Timezone).
- **Pure API service / worker-jobs service:** no UI → record G2 **`skipped`, reason "no UI in scope"**.

---

## G3 (Scaffold) — service-skeleton

Per universal G3, plus: scaffold from the **service-skeleton template** (`../../templates/service-skeleton/`) so the controller/service/repository layout, `.env.example`, migration runner (if stateful), and test harness are present from the start. Compose comes up healthy (app + Postgres if stateful).

---

## G4 (Sprint QA) — per universal, no special additions

Standard sprint QA. No middleware-specific sync/watermark tests unless the app actually has scheduled sync (it usually doesn't). If the shape is worker-jobs, G4 includes job-retry and idempotency checks.

---

## G5 (Milestone Regression) — fitness sized to the app

Architecture fitness tests still run (controller/service/repository boundaries, no DB access outside repositories) — greenfield does not exempt the layering. Load/chaos is **sized to the app's real capacity profile**, not a blanket middleware soak.

---

## G5.5 / G6 / M6 — per universal

Observability + runbooks (sized to the shape — a jobs service needs queue visibility; a headless API needs request metrics + alerts), pre-launch sign-off, and the M6 health-score baseline all run per universal. The health score (`_contracts/health-score.schema.json`) is baselined at M6 like every delivered project.

---

## Gates summary

| Gate             | Universal               | Custom App Build behavior                                                                                                   |
| ---------------- | ----------------------- | --------------------------------------------------------------------------------------------------------------------------- |
| Discovery (G0.5) | Default                 | **Kept** + fixes the app shape                                                                                              |
| G0               | Spec validation         | Per universal                                                                                                               |
| G1               | Plan + estimate         | + records chosen shape and resulting gate set                                                                               |
| G1.5             | Conditional             | **Often skipped** for a small single-shape app; fires on any trigger (>80 hr, datastore, async, multi-tenant, complex auth) |
| G-Contracts      | When integrations exist | **Skipped / N/A** unless `integration_targets` non-empty                                                                    |
| G-Schema         | When a datastore exists | Skipped only if the app is stateless                                                                                        |
| G2               | If UI                   | **Skipped** for headless API / jobs service; fires for dashboard / UI tool                                                  |
| G3               | Scaffold                | + scaffold from service-skeleton template                                                                                   |
| G4               | Sprint QA (×n)          | Per universal (+ job-retry/idempotency if worker shape)                                                                     |
| G5               | Milestone regression    | Fitness still enforced; load sized to the app                                                                               |
| G5.5             | Observability           | Sized to the shape                                                                                                          |
| G6               | Pre-launch              | Per universal                                                                                                               |
| M6               | Health-score baseline   | Per universal                                                                                                               |

---

Last reviewed: 2026-06-30 by Claude (initial build)
