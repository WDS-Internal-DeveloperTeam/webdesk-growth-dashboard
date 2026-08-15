---
tier: 2
load_when: ["pt-custom-app-build", "discovery", "g1"]
description: The four common shapes of a custom Node app — pure API, API + admin dashboard, worker/jobs service, internal tool — and how each maps to the layering and the fired/skipped gate set.
---

# 01 — App Shapes

> The first decision in a custom app build is **which shape it is**, because the shape decides both the layering and the gate set. Settle it at Discovery, before estimating. Four shapes cover almost every custom build; many real projects are a combination (e.g. "API + dashboard + a nightly jobs worker"), in which case you union their gate sets. Below: each shape, its layering, and exactly which gates fire.

All shapes share the non-negotiable Node arm defaults: **Node 22+, ES Modules, Express; controllers HTTP-only → services (business logic) → repositories (all data access); nothing touches the DB outside a repository.** Postgres + Sequelize is the default datastore when there is one. Scaffold every shape from `../../templates/service-skeleton/`.

---

## Shape 1 — Pure API service

A headless REST or GraphQL API. No rendered UI. Consumed by another frontend, a mobile app, or a third party.

**Layering:**

```
routes → controllers (HTTP only) → services (logic) → repositories (data) → datastore
                                          └→ external API adapter (only if integration_targets)
```

**Gates:**

| Gate                     | Fires?                           | Why                                                           |
| ------------------------ | -------------------------------- | ------------------------------------------------------------- |
| Discovery (G0.5)         | Yes                              | Always — fixes the shape                                      |
| G1.5                     | If complex                       | Only on a trigger (>80 hr, queue, multi-tenant, complex auth) |
| G-Contracts              | Only if it calls an external API | Usually skipped                                               |
| G-Schema                 | If stateful                      | Usually yes (an API over a datastore)                         |
| **G2**                   | **No**                           | **Headless — record skipped, "no UI in scope"**               |
| G4 / G5 / G5.5 / G6 / M6 | Yes                              | Per universal                                                 |

The signature skip here is **G2** — there is no mockup because there is no UI. The API contract (OpenAPI / GraphQL schema) is the design surface instead, reviewed at G1/scaffold, not via an HTML mockup.

---

## Shape 2 — API + admin dashboard

The most common full-feature shape. A backend API plus a React/Next.js admin dashboard over it. A client portal, a SaaS admin, an internal management console.

**Layering:** the API layering above, plus a frontend that talks to it. The dashboard ships the WebDesk fixed contracts: **JWT login, per-module RBAC (View/Edit/Delete minimum, extended per module where it needs Create/Approve/Export/Run/etc.), a Settings module including Timezone**, and (where relevant) master + per-client views. Which modules exist is SOW-derived (`_spine/designer-agent/knowledge/01-dashboard-standards.md`), not a fixed list.

**Gates:**

| Gate                     | Fires?                           | Why                                                                     |
| ------------------------ | -------------------------------- | ----------------------------------------------------------------------- |
| Discovery (G0.5)         | Yes                              | Always                                                                  |
| G1.5                     | Often                            | A dashboard usually brings auth + RBAC + multi-user → likely a trigger  |
| G-Contracts              | Only if it calls an external API | As needed                                                               |
| G-Schema                 | Yes                              | Users/roles/RBAC + settings + domain tables → stateful                  |
| **G2**                   | **Yes**                          | **HTML mockup required (D-DES-01), matching the §8 dashboard standard** |
| G4 / G5 / G5.5 / G6 / M6 | Yes                              | Per universal                                                           |

The signature gate here is **G2** — it's required and is a real design effort, plus G-Schema for the auth/RBAC tables.

---

## Shape 3 — Worker / jobs service

A backend that does scheduled or queued work — report generation, data processing, notifications, periodic cleanup — with little or no synchronous request surface. May expose a tiny health/admin API only.

**Layering:**

```
scheduler / queue consumer → job handlers → services (logic) → repositories (data) → datastore
```

Jobs are **idempotent and resumable**; retries are capped; overlapping runs are prevented. All schedules compute in the **Dashboard Settings timezone, stored UTC** — changing the timezone reschedules.

**Gates:**

| Gate                | Fires?                            | Why                                                           |
| ------------------- | --------------------------------- | ------------------------------------------------------------- |
| Discovery (G0.5)    | Yes                               | Always                                                        |
| **G1.5**            | **Usually yes**                   | **Async work (queues/jobs/cron) is an explicit G1.5 trigger** |
| G-Contracts         | Only if jobs call an external API | As needed                                                     |
| G-Schema            | If it persists state              | Usually yes (job state, results)                              |
| **G2**              | **No**                            | **No UI (or a trivial admin-only one) — usually skipped**     |
| G4                  | Yes                               | + job-retry and idempotency checks                            |
| G5 / G5.5 / G6 / M6 | Yes                               | G5.5 must include **queue visibility**                        |

Signature: **G1.5 fires** (async trigger), **G2 skips**, and observability must cover the queue.

---

## Shape 4 — Internal tool

A small bespoke tool for the team or the client's staff — a data-entry console, a one-page admin, a lightweight CRUD UI over a single table. Genuinely small. The shape this type exists to keep _light_.

**Layering:** the same controller/service/repository spine, just less of it. Still no DB access outside repositories — small is not flat.

**Gates:**

| Gate             | Fires?         | Why                                                        |
| ---------------- | -------------- | ---------------------------------------------------------- |
| Discovery (G0.5) | Yes            | Always (even a small tool gets a shape decision)           |
| **G1.5**         | **No**         | **Below the 80-hr threshold, no trigger — record skipped** |
| G-Contracts      | Rarely         | Usually no external system                                 |
| G-Schema         | If stateful    | Usually yes, but a small model                             |
| G2               | If it has a UI | Yes if there's a rendered UI (lighter mockup)              |
| G4 / G6 / M6     | Yes            | Per universal                                              |
| G5 / G5.5        | Light          | Sized down — minimal regression, basic observability       |

Signature: **most conditional gates skip**. This is the type's right-sizing in action. If an "internal tool" keeps growing past 80 hrs or sprouts an external integration, it has stopped being this shape — re-estimate at G1 and re-decide the shape.

---

## Combining shapes

Real projects mix shapes. **Union the gate sets.** Examples:

- _API + dashboard + nightly jobs worker_ → fires G-Schema, G2 (dashboard), G1.5 (async + auth), queue visibility at G5.5.
- _Pure API + one external call_ → fires G-Schema, G-Contracts (the one external system); skips G2.
- _Internal tool that grew a queue_ → G1.5 now fires (async trigger); re-estimate.

When in doubt, fire the gate. Skipping is only correct when the shape genuinely doesn't need it — and the skip is recorded with a reason on the gate entry.

---

## External integrations: sync vs. request/response (pick the right pattern)

A custom app's `integration_targets` are **not** always ERP-style sync. Two distinct integration shapes exist, and forcing an AI/API call into the sync mould is a design error:

- **Continuous sync (ERP/store):** the cron-scheduled, watermarked, reconciled pattern in `../../integrations/erp/_erp-adapter-pattern.md` + `../../knowledge/integration/01-sync-strategies.md`. Use it when you're keeping two datasets in agreement over time.
- **Request/response (AI platforms, most third-party APIs):** the app calls the external service _on demand_ — an LLM (OpenAI/Anthropic), a vector DB, a payment/geocode/enrichment API — gets a response, runs logic, returns. **No watermark, no reconciliation, no cron.** This is the common shape for standalone apps that integrate with AI platforms. See `../../knowledge/intelligence/integration-intelligence.md` for pattern selection.

A request/response integration still gets a **G-Contracts** contract, but the contract fields differ: auth, base URL, rate limits, **timeout + retry/backoff**, **idempotency for writes**, and — for AI platforms specifically — **token/cost limits, streaming vs. buffered, prompt/version management, and output validation** (never trust an LLM response as structured data without validating it). It does **not** carry `sync.cadence` / `watermark_field`. Mark the contract `pattern: request-response` so nobody wires a cron for it. Unverified endpoints/fields stay verify-at-discovery (NODE-008), same as any external system.

---

## Quick decision checklist (at Discovery)

1. Does it render a UI a human looks at? → if yes, **G2 fires**.
2. Does it persist data? → if yes, **G-Schema fires**.
3. Does it call any external system? → if yes, **G-Contracts fires** and verify that API now (NODE-008).
4. Does it run scheduled/queued work? → if yes, **G1.5 fires** (async trigger) and observability needs queue visibility.
5. Is the estimate > 80 hrs, multi-tenant, or beyond single-key auth? → if yes, **G1.5 fires**.
6. None of the above and it's small? → it's an internal tool; most conditional gates skip — record each skip.

---

Last reviewed: 2026-06-30 by Claude (initial build)
