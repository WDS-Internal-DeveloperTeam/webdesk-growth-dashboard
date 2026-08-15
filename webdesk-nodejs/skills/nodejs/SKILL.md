---
name: nodejs
description: Node.js platform arm for the WebDesk Node.js Delivery System. Owns Node coding standards, naming, forbidden patterns, the intelligence modules (db/integration/api/failure), and backend/frontend/database/security/integration/testing knowledge for custom apps, integration middleware, and frontend tools. Loaded for every Node project.
version: 1.0.0
tier: 1
load_when: ["nodejs"]
tools: [Read, Write, Edit, Glob, Grep, Bash]
model: sonnet
color: green
---

# Node.js Platform Arm

> Platform-specific knowledge, standards, and intelligence for every Node.js project this system builds. Loaded by the orchestrator for all projects (`build_context` ∈ `nodejs`, `nodejs+bigcommerce`, `nodejs+shopify`). Cascades from `_spine/` (universal workflow/process) and from project-type skills under `projects/`.

---

## When this is loaded

Loaded whenever a project is active — this is a Node-only system, so the `nodejs` tag is always on. The orchestrator loads, in order:

```
1. _spine/orchestrator/SKILL.md          (workflow + state)
2. relevant spine agent / role            (PM / Architect / QA / Code Review)
3. nodejs/SKILL.md                        ← you are here
4. nodejs/knowledge/*                      (read on demand by the role)
5. nodejs/projects/[project_type]/*        (project-type skill)
6. nodejs/integrations/[target]/*          (ONLY targets in project.json.integration_targets)
```

**Backend and Frontend are ROLES fed by this arm — not separate spine agents.** When a role produces or reviews Node code, it reads this arm's files. The arm owns the _what_ (standards, patterns, forbidden rules); the spine owns the _how_ (gates, state, audit, handoff).

---

## Identity — what this arm owns

- **Node coding standards** (`knowledge/01-coding-standards.md`) and **naming conventions** (`knowledge/02-naming-conventions.md`).
- **Forbidden patterns** (`knowledge/09-forbidden.md`) — the highest-leverage file. NODE-xxx rules enforced by Code Review on every PR.
- **The four intelligence modules** the agents consult for decisions:
  - `knowledge/intelligence/database-intelligence.md` — DB / ORM / storage selection (default Postgres + Sequelize).
  - `knowledge/intelligence/integration-intelligence.md` — sync-pattern selection (default cron-scheduled sync).
  - `knowledge/intelligence/api-design-intelligence.md` — REST design + full status codes.
  - `knowledge/intelligence/failure-scenario-library.md` — catalog of failure modes + handling (pre-flight rule).
- **Domain knowledge** under `knowledge/{backend,frontend,database,security,integration,testing}/`.
- **Integration modules** under `integrations/{bigcommerce,shopify,erp}/` — **loaded ONLY when the target is in `project.json.integration_targets`.** Never load an integration not in scope (context-budget rule §1).

It does **not** own workflow, gates, state, or model routing — that's `_spine/`.

---

## Files in this arm

```
SKILL.md                                      ← you are here
knowledge/
├── 00-overview.md                            what we build, stack defaults, layering
├── 01-coding-standards.md       [tier 1]     the §11 standards + project layout
├── 02-naming-conventions.md                  files/vars/classes/tables/env/branches
├── 09-forbidden.md              [tier 1]     CRITICAL — read before any code
├── technology-selection.md                   supported stacks + ask-if-missing
├── intelligence/
│   ├── database-intelligence.md              (decision support — DB/ORM/storage)
│   ├── integration-intelligence.md           (decision support — sync patterns)
│   ├── api-design-intelligence.md            (decision support — REST + status codes)
│   └── failure-scenario-library.md           (decision support — failure modes)
├── backend/
│   ├── 01-runtime-and-frameworks.md          Express structure, middleware, shutdown
│   └── 02-node-lts-and-engines.md            Node 22 LTS, engines, lockfile, ESM
├── frontend/
│   ├── 01-react-next-standards.md            React/Next for dashboards
│   └── 02-admin-dashboards.md                dashboard modules, RBAC UI, theme, tenancy
├── database/
│   ├── 01-modeling-and-indexing.md           schema, normalization, indexing, models
│   ├── 02-migrations-and-rollback.md         Sequelize migrations, rollback, zero-downtime
│   └── 03-multi-tenancy.md                   per-client + master, repo-layer scoping
├── security/
│   ├── 01-owasp-api.md                        OWASP API Top 10
│   ├── 02-authn-authz.md                      JWT access+refresh, rotation, per-module RBAC
│   ├── 03-secrets-and-config.md              env, secret managers, no secrets in code
│   ├── 04-webhook-security.md                HMAC verify, replay/idempotency
│   └── 05-pii-and-compliance.md              GDPR/CCPA, PCI-scope avoidance
├── integration/
│   ├── 01-sync-strategies.md                 cron sync, one/two-way, watermarks, reconcile
│   ├── 02-queues-and-jobs.md                 node-cron vs BullMQ, idempotency, retries, DLQ
│   ├── 03-rate-limits-and-backoff.md         rate-limit handling, backoff, token bucket
│   └── 04-observability.md                   logs/metrics/tracing/queue visibility (G5.5)
└── testing/
    ├── 01-api-and-integration-tests.md       node:test/vitest, supertest, contract tests
    ├── 02-load-and-chaos.md                  k6/Artillery, soak, chaos/fault injection
    └── 03-dashboard-ui-tests.md              Playwright, axe, responsive, Lighthouse
```

(Project-type skills live in `projects/`; integration modules in `integrations/` — both loaded conditionally, not part of this CORE arm doc.)

---

## Critical reading order

When a role is invoked on a Node task, read in this order:

1. **`knowledge/09-forbidden.md` — read this FIRST, before writing or reviewing any code.** It is the highest-leverage file. Every NODE-xxx violation is a Code Review reject.
2. `knowledge/00-overview.md` — orient: what we build, the stack, the layering.
3. `knowledge/02-naming-conventions.md` — naming rules.
4. `knowledge/01-coding-standards.md` — code style + project layout.
5. Then read on demand for the specific task:
   - DB/schema work → `knowledge/database/*` + `intelligence/database-intelligence.md`
   - Integration/sync work → `knowledge/integration/*` + `intelligence/integration-intelligence.md` + `intelligence/failure-scenario-library.md`
   - API design → `intelligence/api-design-intelligence.md`
   - Auth/security → `knowledge/security/*`
   - Dashboard/frontend → `knowledge/frontend/*`
   - Tests → `knowledge/testing/*`
   - Choosing a stack layer → `knowledge/technology-selection.md`

---

## Critical rules

1. **Read `09-forbidden.md` before any code.** No exceptions. Code Review loads it on every PR.
2. **Controllers HTTP-only, business logic in services, DB access in repositories.** Enforced by architecture fitness tests (G5). No raw DB access leaks out of repositories.
3. **Never invent an external API endpoint or field.** ERP/store specifics are verified at discovery against real docs/sandbox, never coded from memory (verify-at-discovery, NODE-008). Flag uncertainty explicitly.
4. **Load integration KB only for targets in `project.json.integration_targets`.** A `nodejs+bigcommerce` project never loads `integrations/shopify/`.
5. **Timezone is the Dashboard Settings value, stored in UTC.** All cron schedules, sync windows, and displayed timestamps are computed in `project.json.timezone`, never the server's local tz. Changing it reschedules crons.
6. **Read the tech stack from `spec.md`. If a layer is missing or a new one is requested, ASK** — record the choice + justification for the gate (`technology-selection.md`).
7. **Self-check at the end.** State which KB files you consulted and which patterns you applied (per `_spine/shared-knowledge/ai-output-verification.md`).

---

## Project-specific configuration (read from `project.json` / `spec.md`)

- `build_context` — `nodejs` | `nodejs+bigcommerce` | `nodejs+shopify`
- `project_type` — `integration-middleware` | `custom-app-build` | `frontend-tool` | `version-upgrade` | `maintenance`
- `integration_targets[]` — drives which `integrations/*` modules load
- `tech_stack` — backend/db/orm/storage/queue choices (justified at G1.5 / G-Schema)
- `timezone` — system clock for all cron/sync/reporting
- `tenant: {mode, master}` — per-client + optional master dashboard

---

Last reviewed: 2026-06-30 by Claude (initial build)
Version: 1.0.0
