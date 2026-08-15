---
name: pt-custom-app-build
description: "Custom application build project-type — a greenfield Node app built from scratch. A REST/GraphQL API, optionally an admin dashboard, optionally background jobs. Not necessarily an integration, not necessarily a commerce store, may have no ERP. Loaded when project_type == custom-app-build. Use for any build whose deliverable is a bespoke Node application rather than middleware keeping two systems in sync."
version: 1.0.0
tier: 1
load_when: ["pt-custom-app-build"]
tools: [Read, Write, Edit, Glob, Grep, Bash]
model: sonnet
color: green
---

# Custom App Build — Project Type

> A **greenfield Node application** built from scratch. The deliverable is a bespoke app — a REST or GraphQL API, optionally an admin dashboard, optionally a worker/jobs service or an internal tool. Unlike the middleware pilot, there is **not necessarily a second system to keep in sync**: many of these builds have no ERP and no commerce store at all. That changes which gates fire — several of the middleware-heavy gates commonly **skip** here. Read this skill to know the app's shape, then let that shape decide the gate set.

---

## When this is loaded

The orchestrator loads this skill when:

- `project.project_type == "custom-app-build"`

Cascade order (context-budget §1 — only what's in scope loads):

```
1. _spine/orchestrator/SKILL.md                  (workflow + state)
2. relevant spine agent / role                   (PM / Architect / Backend / QA / Code Review / Delivery)
3. nodejs/SKILL.md                               (the platform arm)
4. nodejs/projects/custom-app-build/SKILL.md     ← you are here
5. this skill's knowledge/* (read on demand, tier 2)
6. nodejs/integrations/<target>/*                ONLY if integration_targets non-empty (often empty here)
```

A custom-app-build with no `integration_targets` never loads any `integrations/` KB. A custom-app-build with no datastore never loads schema KB. Load what the shape needs, nothing more.

---

## What this project type is — and is not

**Is:** a custom Node application we own end to end. Examples: a SaaS API for a client product, an internal admin tool over a Postgres database, a customer-facing portal (API + dashboard), a scheduled report/jobs service.

**Is not:** middleware whose job is keeping an ERP and a store in agreement (that's `pt-integration-middleware`), an embedded storefront widget (`pt-frontend-tool`), a dependency/runtime upgrade (`pt-version-upgrade`), or a retainer ticket (`pt-maintenance`).

The defining trait is **greenfield and self-contained**. The app may call an external API, but the integration is a feature, not the product. If keeping two systems in agreement IS the product, you're in the wrong skill — route to `pt-integration-middleware`.

---

## The common shapes — read the knowledge file

The single highest-leverage thing to settle early is **which shape this app is**, because the shape decides the layering and the gate set. The four common shapes — pure API service, API + admin dashboard, worker/jobs service, internal tool — and exactly which gates each one fires are in:

- `knowledge/01-app-shapes.md` — **read this at Discovery.** It maps each shape to the controller/service/repository layering and to a fired/skipped gate list, so you don't run G2 on a headless API or G-Schema on a stateless proxy.

Read alongside the arm's reusable _how_:

- `nodejs/SKILL.md` — the platform standards (Node 22+, ESM, Express, the layering).
- `nodejs/knowledge/...` — observability, jobs/queues, database patterns, as the shape needs them.
- `_spine/designer-agent/knowledge/01-dashboard-standards.md` — only if the shape includes a dashboard.

Use the **service-skeleton template** at `../../templates/service-skeleton/` as the scaffold for any of these shapes — it ships the controller/service/repository layout, `.env.example`, migration runner, and test harness the arm expects. This skill points at it; it does not duplicate it.

---

## Critical rules for this project type

1. **Settle the app shape at Discovery, before estimating.** Which of the four shapes (and which gates fire) is the first decision. `knowledge/01-app-shapes.md` is the reference. Estimating before the shape is fixed produces a wrong number.
2. **The layering is non-negotiable even greenfield.** Controllers are HTTP-only; business logic lives in services; all data access goes through repositories; nothing touches the DB outside a repository. Greenfield is not a license to flatten the layers — fitness tests still enforce them at G5.
3. **G-Schema fires only if the app is stateful.** If there's a datastore (the common case — Postgres + Sequelize by default), the data model is client-approved at G-Schema before any shared-environment migration. A stateless app (e.g. a pure transform/proxy) records G-Schema `skipped`.
4. **G-Contracts fires only if `integration_targets` is non-empty.** Many custom apps call no external system — record G-Contracts `skipped` with reason "no integration targets". If the app does call an external API, that API is verified at Discovery (NODE-008), never coded from memory, and gets a contract.
5. **G2 fires only if the app has a UI.** An admin dashboard or any rendered frontend means a G2 HTML mockup (per D-DES-01), matching the §8 dashboard standard if it's a dashboard. A headless API records G2 `skipped` with reason "no UI in scope".
6. **G1.5 fires only if the build is complex.** Architecture review runs when any G1.5 trigger holds (estimate > 80 hrs, a new datastore, async jobs/cron, multi-tenancy, auth beyond a single static key). A small single-shape app commonly skips G1.5 — but document the skip, don't assume it.
7. **Auth + RBAC if there's a dashboard.** A dashboard ships JWT login and per-module RBAC (View/Edit/Delete minimum, extended per module where it needs Create/Approve/Export/Run/etc.) by default, with a Settings module (including Timezone). Don't bolt auth on later.
8. **Timezone drives any scheduling.** If the app has cron/jobs, all schedules compute in the Dashboard Settings timezone, stored UTC. Changing the timezone reschedules.
9. **No auto-fix.** QA produces bug reports; the agent does not silently auto-fix and re-run. Fixes are human-commanded, per the system-wide rule.
10. **Don't gold-plate a simple app.** The point of this type is that small self-contained apps shouldn't carry the full middleware gate ceremony. Fire the gates the shape needs; skip (and record) the rest.

---

## Which gates commonly skip — at a glance

| Gate             | Fires when                        | Commonly skipped for a simple app?                   |
| ---------------- | --------------------------------- | ---------------------------------------------------- |
| Discovery (G0.5) | Default                           | No — keep it (it's where the shape is decided)       |
| G1.5             | Complexity triggers / >80 hr      | **Yes**, for a small single-shape app                |
| G-Contracts      | `integration_targets` non-empty   | **Yes / N/A**, when the app calls no external system |
| G-Schema         | App is stateful (has a datastore) | Skipped only if truly stateless                      |
| G2               | App has a UI                      | **Yes**, for a headless API or jobs service          |

Full detail and per-shape gate lists in `gates.md`.

---

## Milestones (typical shape — PM tunes per project)

| Milestone | Work                                                                       | Key gates            |
| --------- | -------------------------------------------------------------------------- | -------------------- |
| M1        | Discovery + app-shape decision + plan/estimate; architecture if complex    | G0.5, G0, G1, [G1.5] |
| M2        | Data model approved if stateful; scaffold from service-skeleton + Compose  | [G-Schema], G3       |
| M3        | Dashboard mockup approved if UI; auth + RBAC + settings shell if dashboard | [G2], G4             |
| M4        | Core feature build — API endpoints / jobs / tool flows                     | G4×n                 |
| M5        | Milestone regression + architecture fitness + load (sized to the app)      | G5                   |
| M6        | Observability + runbooks; launch; health baseline                          | G5.5, G6, M6         |

Bracketed gates are conditional — fire them only if the shape calls for them.

---

## Output artifacts (where things land in the project workspace)

| Artifact                                              | Path                                                |
| ----------------------------------------------------- | --------------------------------------------------- |
| App-shape decision                                    | `app-shape.md`                                      |
| Data model (if stateful, client-approved)             | `data-model.md`                                     |
| Integration contracts (only if `integration_targets`) | `integration-contracts/<system>.md`                 |
| Architecture + ADRs (if G1.5 ran)                     | `architecture.md`, `decisions/ADR-*.md`             |
| Architecture fitness config                           | `architecture-tests/`                               |
| Runbooks                                              | `operations/{incident,db-restore,deploy-recovery}/` |

---

## Tone

Right-size the process to the build. The middleware pilot's heavy contract/schema ceremony exists because the mapping _is_ the product there — most custom apps don't have that, and forcing the full gate set on a small internal tool is waste. Decide the shape, fire the gates the shape needs, record the skips with reasons, and keep the layering honest even when nobody's making you. Be explicit when an external API is involved that its surface is verified, not assumed.

---

Last reviewed: 2026-06-30 by Claude (initial build)
