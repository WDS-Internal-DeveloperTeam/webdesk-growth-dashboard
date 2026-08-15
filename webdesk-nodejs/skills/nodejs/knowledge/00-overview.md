---
tier: 2
load_when: ["nodejs"]
description: "Orientation for the Node.js arm — what we build, the stack defaults, and the controller/service/repository layering."
---

# 00 — Node.js Arm Overview

> Read this second (after `09-forbidden.md`) to orient before any Node work. It tells you what kind of projects this system builds, the default stack, and the layering every project follows.

---

## What this system builds

Three project shapes, all Node.js, all loaded by `project_type` (KB is scoped per type — never load another type's KB):

1. **Custom app builds** (`pt-custom-app-build`) — bespoke Node services and the admin dashboards that drive them: REST APIs, internal tools, client portals. Backend + Frontend roles both active.
2. **Integration middleware** (`pt-integration-middleware`) — the flagship shape. A Node service that keeps an external system (ERP/CRM such as DDI Inform) in sync with a store (BigCommerce/Shopify) via a **continuous cron-scheduled sync engine**, plus a dashboard for monitoring/config. The pilot (DDI Inform ↔ BigCommerce) is this type.
3. **Frontend tools** (`pt-frontend-tool`) — React/Next dashboards, calculators, and admin UIs that talk to an existing API. Frontend role primary.

Plus two lighter types: `pt-version-upgrade` (Node/dep upgrades) and `pt-maintenance` (trivial tickets, discovery skippable).

---

## Tech stack defaults

Read the actual stack from `spec.md`; these are the documented defaults you start from and justify deviations against (see `technology-selection.md`):

| Layer              | Default                                                                               | Approved alternatives                 |
| ------------------ | ------------------------------------------------------------------------------------- | ------------------------------------- |
| Runtime            | **Node.js 22+ LTS**, **ES Modules** (`import`/`export`)                               | —                                     |
| Web framework      | **Express**                                                                           | (ask if a different one is requested) |
| Database           | **PostgreSQL**                                                                        | MySQL, MongoDB                        |
| ORM                | **Sequelize**                                                                         | Prisma, TypeORM                       |
| Object storage     | **S3**                                                                                | Cloudinary, GCS                       |
| Queue / scheduling | **node-cron** (simple) → **BullMQ + Redis** (when concurrency / retries / DLQ needed) | —                                     |
| Frontend           | **React / Next.js**                                                                   | —                                     |
| Auth               | **JWT** (access + refresh, rotation, server-side revocation)                          | —                                     |

The pilot stack: Node 22 + Express + Postgres + Sequelize; React/Next dashboard; JWT; per-module RBAC; per-client + master tenancy.

---

## The layering (controller / service / repository)

Every Node service follows a strict three-layer split. This is not a style preference — it is enforced by **architecture fitness tests at G5** and by Code Review (NODE-003).

```
HTTP request
   │
   ▼
┌──────────────┐   controllers/   HTTP only: parse/validate input, call a service,
│  Controller  │                  shape the response, map errors to status codes.
└──────┬───────┘                  No business logic. No DB access.
       ▼
┌──────────────┐   services/      Business logic + orchestration: rules, transactions,
│   Service    │                  calling repositories and integrations, enforcing
└──────┬───────┘                  invariants. No HTTP objects (req/res) here.
       ▼
┌──────────────┐   repositories/  The ONLY place that touches the database. Returns
│  Repository  │                  domain objects. Every query is tenant-scoped.
└──────┬───────┘
       ▼
   Database (Sequelize models)
```

Cross-cutting pieces sit beside these layers:

- `integrations/` — adapters to external systems (ERP pull/push/normalize, store API clients). Called by services, never by controllers.
- `jobs/` — cron/queue entry points (sync runs, reconciliation). Call services.
- `lib/` — pure, reusable helpers (no I/O side effects where avoidable).
- `config/` — env-driven configuration, bootstrap.
- `db/migrations/`, `db/models/` — Sequelize migrations and model definitions.

Why it matters: in middleware the sync engine touches every layer. Keeping DB access in repositories means tenant-scoping and transactions are enforced in one place, fitness tests can assert "no Sequelize import outside `repositories/` or `db/`", and a swapped ORM or datastore changes one layer, not the codebase.

---

## Where to go next

- Standards + full project layout → `01-coding-standards.md`
- Naming → `02-naming-conventions.md`
- What never to do → `09-forbidden.md` (read first)
- Choosing a stack layer → `technology-selection.md`
- Decision support → `intelligence/{database,integration,api-design}-intelligence.md`, `intelligence/failure-scenario-library.md`
