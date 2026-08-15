---
name: pt-frontend-tool
description: "Frontend tool project-type — an interactive tool, configurator, or live-preview customizer embedded on a real store frontend (BigCommerce/Shopify storefront), talking to a thin backend API. Design-heavy; the embedded widget is the product. Loaded when project_type == frontend-tool. Use for product configurators, live-preview customizers, calculators, and similar storefront-embedded widgets — not headless middleware, not a full app."
version: 1.0.0
tier: 1
load_when: ["pt-frontend-tool"]
tools: [Read, Write, Edit, Glob, Grep, Bash]
model: sonnet
color: green
---

# Frontend Tool — Project Type

> An **interactive tool embedded on a live store frontend** — a product configurator, a live-preview customizer, a sizing/pricing calculator — that renders on the client's real storefront (BigCommerce, Shopify) and talks to a **thin backend API**. The center of gravity is the **frontend**: this is a design-heavy build where the embedded widget _is_ the product. The backend is a small API, not the deliverable. It loads on a real, revenue-generating store, so the hard constraints are **don't break the host store**, **stay fast**, and **stay accessible**.

---

## When this is loaded

The orchestrator loads this skill when:

- `project.project_type == "frontend-tool"`

Cascade order (context-budget §1 — only what's in scope loads):

```
1. _spine/orchestrator/SKILL.md              (workflow + state)
2. relevant spine agent / role               (PM / Designer / Frontend / Backend / QA / Delivery)
3. nodejs/SKILL.md                           (the platform arm — for the thin backend)
4. nodejs/projects/frontend-tool/SKILL.md    ← you are here
5. this skill's knowledge/* (read on demand, tier 2)
6. nodejs/integrations/<target>/*            ONLY if the tool calls a store/ERP API
```

The weight is inverted vs the middleware pilot: here the **Designer and Frontend roles lead**, the Backend role builds a thin supporting API.

---

## What this project type is — and the constraint that defines it

A widget that:

- Embeds onto a storefront the client already runs and sells from.
- Lets a shopper configure / customize / preview a product interactively.
- Persists or computes via a small backend API (save a configuration, price a combination, fetch options).
- Hands a result back to the store's native flow (add-to-cart, a saved design, a quote).

**The defining constraint: it loads inside someone else's live store.** A bug in the widget can break the host page, slow it down, or leak styles into it. So three things dominate every decision:

1. **Don't break the host store.** Style isolation, scoped JS, no global leaks, graceful failure (the widget failing must never take down add-to-cart).
2. **Performance of the embedded widget.** It's extra weight on a page that already has a performance budget. Lighthouse on the _host page with the widget_ is the measure.
3. **Accessibility of the widget.** It's an interactive control a real shopper uses — axe-core clean, keyboard-operable, screen-reader sane.

Plus the embedding mechanics: **CORS, CSP, and the embedding method** (script tag / iframe / web component) are first-class concerns, not afterthoughts.

---

## Knowledge in this skill — read on demand

| File                                     | Read it when                                 | What it gives you                                                                                                                                                                                             |
| ---------------------------------------- | -------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `knowledge/01-frontend-tool-patterns.md` | Design + frontend build, embedding decisions | Embedding patterns (script tag / iframe / web component), talking to the backend API, widget state, live-preview rendering, the performance budget, accessibility, and the not-breaking-the-host-store rules. |
| `gates.md`                               | Every gate transition                        | The gate **differences** — G2 is the heavy required gate; backend gates are light.                                                                                                                            |

Read alongside the arm + spine:

- `_spine/designer-agent/knowledge/...` — the design standards; G2 lives here.
- `nodejs/SKILL.md` — for the thin backend API (still controllers/services/repositories).
- `nodejs/integrations/<target>/*` — only if the tool reads a store/ERP API (products, pricing).

---

## Critical rules for this project type

1. **G2 (HTML mockup) is the center of gravity and is REQUIRED.** This is a UI tool — the running HTML/CSS/JS mockup (D-DES-01) is the main design deliverable and the heaviest gate. It is never skipped. Design quality is the product.
2. **The backend is a thin API.** Keep it small: controllers/services/repositories per the arm, but the logic is "save/price/fetch options", not a sync engine. Don't over-build it. G-Schema is light (often a single configurations table) and may be skipped if the tool persists nothing.
3. **Never break the host store.** The widget must fail closed and silent — if the API is down or the widget errors, the host page (and its native add-to-cart) stays fully functional. No uncaught errors bubbling into the host. No global namespace pollution. Styles scoped (Shadow DOM / iframe / strict prefixing).
4. **Style + script isolation is mandatory.** Decide the embedding method (script tag / iframe / web component) at G2 and isolate accordingly so the widget can't leak CSS into the store or have the store's CSS deform it. See `knowledge/01-frontend-tool-patterns.md`.
5. **Performance budget is a hard target, not a hope.** The widget has an explicit size/CPU budget. Lighthouse runs on the **host page with the widget embedded** — before/after — and the widget must stay within budget. Lazy-load; don't block render.
6. **Accessibility is required — axe-core clean + keyboard + SR.** It's an interactive shopper-facing control. axe-core zero violations on the widget, full keyboard operability, sensible focus management and ARIA. Verified at G2 and G4.
7. **CORS and CSP are designed, not discovered.** The widget's origin, the API's CORS policy, and the host store's CSP (which may block inline script / external connect) are settled at G2/G-Contracts. A CSP that blocks the widget is a launch-blocker found late if you don't design for it.
8. **If it calls a store/ERP API, that's a contract.** Reading products/pricing from BigCommerce/Shopify or an ERP means G-Contracts fires and the API is verified at Discovery (NODE-008). A self-contained configurator with no external read may skip it.
9. **No auto-fix.** QA produces bug reports; fixes are human-commanded.
10. **Timezone drives any scheduling** (rare here — most of these have no jobs), stored UTC.

---

## Where the weight sits vs other types

| Concern               | Frontend Tool                    | Integration Middleware    |
| --------------------- | -------------------------------- | ------------------------- |
| Center of gravity     | **Frontend / design (G2)**       | Backend sync engine       |
| Backend               | Thin supporting API              | The product               |
| G2 (HTML mockup)      | **Required, heavy**              | Required (dashboard)      |
| G-Schema              | Light or skipped                 | Required, client-approved |
| G-Contracts           | Only if it reads a store/ERP API | Always (≥2 systems)       |
| Lighthouse / axe-core | **Central** (host page + widget) | N/A (headless)            |
| Load/chaos at G5      | Light (it's a widget)            | Heavy (soak + chaos)      |
| Dominant risk         | **Breaking the host store**      | Data drift at 3am         |

---

## Milestones (typical shape — PM tunes per project)

| Milestone | Work                                                                                         | Key gates                         |
| --------- | -------------------------------------------------------------------------------------------- | --------------------------------- |
| M1        | Discovery + tool concept + embedding method + plan/estimate                                  | G0.5, G0, G1                      |
| M2        | **HTML mockup of the widget** (the heavy design gate); CORS/CSP/embedding plan               | G2                                |
| M3        | Thin backend API (save/price/fetch); contract if it reads a store/ERP API                    | [G-Contracts], [G-Schema], G3, G4 |
| M4        | Widget build — live-preview rendering, state, isolation, accessibility                       | G4×n                              |
| M5        | Lighthouse + axe on host-page-with-widget; cross-store/browser QA                            | G5                                |
| M6        | Observability (light); pre-launch incl. "doesn't break host store" sign-off; health baseline | G5.5, G6, M6                      |

---

## Output artifacts (where things land in the project workspace)

| Artifact                                                | Path                                |
| ------------------------------------------------------- | ----------------------------------- |
| Widget HTML mockup (G2 deliverable)                     | served from the preview server      |
| Embedding + isolation decision                          | `embedding-plan.md`                 |
| Performance budget + Lighthouse before/after            | `performance-budget.md`             |
| Accessibility (axe-core) report                         | `accessibility-report.md`           |
| Integration contract (only if it reads a store/ERP API) | `integration-contracts/<system>.md` |
| Host-store safety checklist                             | `host-store-safety.md`              |

---

## Tone

This is design-led work running on someone else's livelihood. The widget can be beautiful, but if it breaks the store's add-to-cart, slows the page, or fails a screen reader, it's a liability. Treat the host store as sacred — fail closed, isolate hard, measure performance and accessibility for real. Push back on "we'll iframe it and figure out CSP later"; CSP and isolation are design inputs, not launch surprises.

---

Last reviewed: 2026-06-30 by Claude (initial build)
