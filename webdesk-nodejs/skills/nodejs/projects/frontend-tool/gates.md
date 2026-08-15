---
tier: 2
load_when: ["pt-frontend-tool", "g2", "g_contracts", "g4"]
description: Gate differences for the frontend-tool project-type vs the universal set — G2 is the heavy required gate; backend gates (G-Schema, G5 load) are light; Lighthouse/axe apply.
---

# Gates — Frontend Tool (vs Universal)

> Inherits the universal gate model and format from `_contracts/gate-format.md`. This file documents only the **differences**. The defining difference: the weight is on the **frontend**, so **G2 is the heavy, required gate**, while the backend-heavy gates (G-Schema, G5 load/chaos) are light. Two frontend-specific checks — **Lighthouse and axe-core** — are gating here in a way they are not for headless types.

---

## Discovery (G0.5) — embedding method + host store

Default per universal. For this type, Discovery additionally establishes:

- The **host store platform** (BigCommerce / Shopify) and its CSP posture.
- The intended **embedding method** (script tag / iframe / web component) — provisional, finalized at G2.
- Whether the tool **reads a store/ERP API** (decides whether G-Contracts fires). If it does, verify that API now (NODE-008).

---

## G1 (Plan + Estimate) — design-weighted

The estimate is weighted toward design/frontend, with a thin backend line. The plan names the performance budget and the accessibility target as deliverables, not nice-to-haves.

---

## G1.5 (Architecture Review) — usually skipped

A thin-backend widget rarely meets a G1.5 trigger. Record `skipped` unless something unusual holds (multi-tenant widget config, a queue, auth beyond a simple token). The architecture risk here is on the **frontend isolation**, which is settled at G2, not G1.5.

---

## G-Contracts — only if the tool reads a store/ERP API

If the widget fetches products / pricing / options from BigCommerce, Shopify, or an ERP, that system gets an `integration-contracts/<system>.md`, client-approved here, and **no read code runs against a `draft` contract**. A self-contained configurator that computes everything client-side or against its own small API records G-Contracts **`skipped`, reason "no external read"**.

---

## G-Schema — light, sometimes skipped

The backend is thin. If the tool persists anything it's usually a single `configurations` (or `saved_designs`) table — a small data model, still client-approved per universal if a datastore is introduced. A tool that persists **nothing** (pure compute / preview, result handed straight to the store cart) records G-Schema **`skipped`, reason "no datastore in scope"**.

---

## G2 (Design Approval) — THE heavy gate, REQUIRED

This is the type's defining gate and it is **never skipped**. The deliverable is a running **HTML/CSS/JS mockup of the widget** served from the preview server (D-DES-01) — not Figma, not screenshots. G2 here additionally locks:

- [ ] **Embedding method** chosen and isolation strategy committed (Shadow DOM / iframe / strict-prefixed) — the widget cannot leak CSS into the host store, nor be deformed by the store's CSS.
- [ ] **CORS + CSP plan** — the API's CORS policy and the host store's CSP are reconciled here; a CSP that would block the widget is caught now, not at launch.
- [ ] **Live-preview interaction** demonstrated in the mockup.
- [ ] **Accessibility baseline** — keyboard operability + focus/ARIA shown; axe-core run on the mockup.
- [ ] **Graceful-failure behavior** — what the widget does when the API is down (it must fail closed without harming the host page).

---

## G3 (Scaffold) — widget + thin API

Per universal, sized down: the thin backend scaffolds from the service-skeleton; the widget build pipeline (bundling, isolation harness) comes up. CSP/CORS config present in `.env.example`.

---

## G4 (Sprint QA) — Lighthouse + axe gate here

Per universal sprint QA, **plus** the frontend-specific gating checks that make this type distinct:

- [ ] **Lighthouse on the host page with the widget embedded** — performance within the agreed budget (before/after on the real host page, not the widget in isolation).
- [ ] **axe-core: zero violations** on the widget.
- [ ] **Keyboard + screen-reader** pass on every interactive control.
- [ ] **Host-store safety:** widget errors do not propagate to the host page; native add-to-cart still works with the widget present and with the widget's API forced down.
- [ ] **Cross-browser + cross-device** render of the widget.

Failed Lighthouse/axe checks bounce the work back to the frontend dev before the human review opens.

---

## G5 (Milestone Regression) — light load, real cross-store

Load/chaos is **light** — it's a widget, not a sync engine. What matters at G5 here is **regression across host-store contexts**: the widget still renders and behaves on every targeted storefront theme/template, and still fails closed. Architecture fitness on the thin backend still runs.

---

## G5.5 / G6 / M6 — per universal, with host-store sign-off

- **G5.5:** observability sized to the type — frontend error tracking for the widget + basic API metrics/alerts; runbooks lighter.
- **G6:** universal pre-launch **plus** a "**does not break the host store**" sign-off — Lighthouse-in-budget confirmed, axe clean, graceful-failure verified on the live theme. Client co-approves embedding on their storefront.
- **M6:** health-score baseline per universal; monitor widget error rate post-embed.

---

## Gates summary

| Gate             | Universal               | Frontend Tool behavior                                                     |
| ---------------- | ----------------------- | -------------------------------------------------------------------------- |
| Discovery (G0.5) | Default                 | + host store + embedding method + external-read decision                   |
| G0               | Spec validation         | Per universal                                                              |
| G1               | Plan + estimate         | Design-weighted; perf budget + a11y target named                           |
| G1.5             | Conditional             | **Usually skipped** (thin backend, no trigger)                             |
| G-Contracts      | When integrations exist | **Only if** the tool reads a store/ERP API                                 |
| G-Schema         | When a datastore exists | **Light**; skipped if it persists nothing                                  |
| **G2**           | If UI                   | **REQUIRED + heavy** — mockup, isolation, CORS/CSP, a11y, graceful-failure |
| G3               | Scaffold                | Widget pipeline + thin API                                                 |
| G4               | Sprint QA (×n)          | **+ Lighthouse + axe + host-store safety + cross-browser**                 |
| G5               | Milestone regression    | **Light load**; cross-store regression is the focus                        |
| G5.5             | Observability           | Sized down — widget error tracking + basic API metrics                     |
| G6               | Pre-launch              | **+ "does not break the host store" sign-off**                             |
| M6               | Health-score baseline   | Per universal + widget error-rate monitoring                               |

---

Last reviewed: 2026-06-30 by Claude (initial build)
