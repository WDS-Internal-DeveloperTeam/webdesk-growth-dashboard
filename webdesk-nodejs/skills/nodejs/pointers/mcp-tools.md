---
tier: 2
load_when: ["nodejs", "qa-active", "g4", "g5", "design"]
description: "Which MCP tools/connectors the system may use and when — e.g. claude-in-chrome for dashboard QA, web search/fetch for verify-at-build API checks. Availability is environment-dependent; degrade gracefully."
---

# MCP Tools & Connectors

> Notes on external tooling the agents _may_ use. **Availability is environment-dependent** — a tool listed here may not be connected in a given session. If a tool is unavailable, fall back to the manual path and flag it; never block on a missing connector.

## Dashboard QA — `claude-in-chrome` (browser MCP)

- **Use for:** QA of the React/Next dashboard (blueprint §8) — navigate the per-client + master dashboards, exercise JWT login/show-hide password, per-module RBAC (View/Edit/Delete), Settings (incl. Timezone), Activity Logs, Theme Customizer; read console/network for errors; verify responsive/accessibility behavior alongside Playwright/axe/Lighthouse (the §7 dashboard-UI QA stack).
- **When:** G4 sprint QA and G5 regression on any project with a dashboard UI. Not for headless middleware with no UI.
- **DOM-aware** and faster than pixel clicking for web QA. Prefer it over computer-use for the dashboard.
- **Note:** automated tests (Playwright) remain the source of truth for CI; the browser MCP is for interactive QA/triage, not a replacement for the gated test suite.

## API fact-checking — web search / web fetch

- **Use for:** the `verify-at-build` / `verify-at-discovery` checks throughout the integration KB — confirming a store platform's current API version, that an endpoint/field exists, an ERP's API surface at a high level.
- **Boundary:** confirm **high-level facts** and **current versions** only. Do **not** treat search results as authoritative for exact request/response shapes — verify those against the official docs (the `pointers.md` anchors) or a sandbox. Never fabricate an endpoint from a blog (NODE-008).

## Not used / out of scope by default

- **Theme/storefront tooling** — Shopify is API-only here; no theme/Liquid MCP work.
- **Computer-use (desktop)** — only if a task genuinely needs native-app control; web QA uses claude-in-chrome.
- **Design-tool MCPs (Figma/Canva, etc.)** — the system delivers **HTML mockups** (D-DES-01); these are not part of the delivery pipeline unless a project explicitly calls for them.

## Rule

Record which MCP tools a project actually relies on in its `project.json` / spec so QA and review know what was used. Degrade gracefully when a connector is absent and surface the gap rather than silently skipping verification.
