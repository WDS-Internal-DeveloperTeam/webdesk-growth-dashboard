---
tier: 2
load_when: ["monitoring", "launch", "pm-active"]
description: Technical master document the PM Agent generates at project close. The "read this first" onboarding doc for any future developer of a Node.js middleware / custom-app build.
---

# Master Doc Template (Node.js Delivery System)

> Generated at project close (after G6 confirmed, status `delivered`). The single document a future developer reads to understand the project end-to-end. Save to `<workspace>/final-deliverables/master-doc.md` and copy into the repo as `AGENCY-MASTER-DOC.md`. Generate it by reading `project.json`, `spec.md`, `architecture.md` + ADRs, `data-model.md`, the integration contracts, CI/QA reports, and the audit log.

---

# [Project Name] — Technical Master Document

|                         |                               |
| ----------------------- | ----------------------------- |
| **Client**              | [name]                        |
| **Project ID**          | [WDS-N-2026-NNN]              |
| **Project type**        | [integration-middleware]      |
| **Build context**       | [nodejs+bigcommerce]          |
| **Integration targets** | [erp:ddi-inform, bigcommerce] |
| **Launched**            | [date] · **Closed**           | [date] |
| **Warranty**            | [N] days, ends [date]         |
| **Timezone**            | [America/Toronto]             |
| **Tenancy**             | [per-client + master]         |
| **Doc version**         | 1.0 · **Updated** [date]      |

> Purpose: any developer can read this to understand the project. Start here before making changes.

---

## 1. Project Overview

### What this system does

[2-3 paragraphs, plain language. State the data flow in one line: "Inform is system-of-record for items/inventory/pricing; BigCommerce owns orders/customers; the middleware keeps them in sync on a per-entity cron and surfaces a per-client dashboard + master dashboard."]

### Why these technology choices

[Why Node/Express, why PostgreSQL+Sequelize, why cron-sync vs webhook for the ERP, why this queue, why this host. Rationale invisible in the code — link the ADRs.]

### Timeline & team

[Discovery → launch dates; PM / architect / backend / frontend / QA / delivery head.]

## 2. Tech Stack

- Runtime/framework: [Node 22, Express] · DB/ORM: [PostgreSQL + Sequelize] · Queue/scheduler: [node-cron | BullMQ+Redis] · Storage: [s3/none] · Frontend: [React/Next/none] · Host: [target].
- API: REST, versioned `/api/v1`, OpenAPI at [path]; full status codes incl. 502/503/504 for upstream ERP/store failures.
- Migrations: reversible via [sequelize-cli/umzug].

### External services (active)

| System         | Role             | Direction    | Auth + credential location   | Contract   |
| -------------- | ---------------- | ------------ | ---------------------------- | ---------- |
| erp:ddi-inform | system-of-record | pull+push    | [partner credential — vault] | IC-DDI-001 |
| bigcommerce    | commerce         | webhook+push | [API key — vault]            | IC-BC-001  |

## 3. Repository Structure

```
[repo]/
├── src/
│   ├── controllers/      ← HTTP only
│   ├── services/         ← business logic
│   ├── repositories/     ← all DB access (no raw queries elsewhere)
│   ├── integrations/     ← adapters behind the common pull/push/normalize/sync-state interface
│   │   ├── erp/ddi-inform/
│   │   └── bigcommerce/
│   ├── sync/             ← scheduler + sync engine (watermarks, reconciliation, overlap policy)
│   ├── models/           ← Sequelize models
│   └── middleware/       ← auth (JWT), tenancy scoping, error handling
├── migrations/
├── architecture-tests/   ← fitness tests (boundaries, no-DB-outside-repos, api-version, queue retry caps)
├── operations/           ← runbooks (incident, queue-recovery, webhook-replay, db-restore, deploy-recovery)
├── integration-contracts/ ← _registry.md + per-system
├── agency/               ← spec.md, data-model.md, architecture.md, decisions/ (ADRs), rfcs/
├── .github/workflows/
└── AGENCY-MASTER-DOC.md  ← this file
```

### Naming conventions

kebab-case filenames; camelCase vars/functions; PascalCase classes (CONVENTIONS / coding standards).

## 4. Architecture & Key Decisions

- Link `architecture.md` and each ADR (`decisions/ADR-NNNN`), summarizing the decision + trade-off: sync pattern per source, queue choice, conflict-resolution policy, tenancy data-model approach, idempotency strategy, caching/rate-limit strategy.
- Context diagram + component breakdown (controllers/services/repositories + sync engine + queue + scheduler).

## 5. Sync Engine & Integrations

For each integration: how connected (adapter), entities + direction, **per-entity cron cadence (client tz)**, conflict-resolution rule, idempotency key, watermark/resume behavior, reconciliation, and the in-scope failure modes + handling. Note sandbox vs production credentials.

## 6. Data Model

Core entities (users, roles, per-module permissions [VED minimum, extended per module], settings incl. timezone, field_mappings, sync_state/watermarks, activity_logs) + domain entities; key indexes/constraints; tenancy columns. Link `data-model.md`.

## 7. Dashboard

Per-client modules — the SOW-derived module + Settings set actually built (fixed contracts: JWT, per-client+master tenancy, per-module RBAC [VED minimum, extended per module], Settings-timezone) + master dashboard (cross-client list, health score, alert rollup, drill-in). Auth: JWT (access+refresh, rotation, revocation). What's merchant-editable vs requires-dev.

## 8. Security

Auth (JWT), secrets management (vault/env, rotation, no inline), authz scoping per tenant, OWASP-API baseline, CVE/secret/SAST/DAST in CI, data sensitivity = [level].

## 9. Performance / Capacity & Observability

Throughput targets + the load/soak capacity profile; SLO/SLA. Observability: logs, metrics, tracing, alerts, dashboards, queue visibility. Link the G5/G5.5 reports.

## 10. Local Development Setup

```bash
git clone [URL] && cd [repo]
cp .env.example .env          # fill DB, ERP, store, JWT secrets
docker compose up             # app + Postgres + queue + mock ERP/store
npm run migrate
npm run dev
```

Git workflow: main = production, develop = integration, feature/[sprint-id]. Required reviewers per branch.

## 11. Deployment & CI/CD

Deploy adapter for [host] (build → migrate → release → health-check → rollback). GitHub Actions: install/typecheck/test/audit(OSV)/migration-dryrun/deploy. Backup before release.

## 12. Operations (Runbooks)

Link each runbook: incident, queue-recovery, webhook-replay, db-restore, deploy-recovery. Rollback procedure + authorized approver.

## 13. Project Health Score

Baseline at M6 + latest snapshot (5 axes + rollup). Where it surfaces on the master dashboard; recompute cadence (monthly).

## 14. Known Limitations, Open Bugs, Accepted Trade-offs

Honest list with severity, status, and when to revisit.

## 15. Maintenance Guidance

Common tasks (add a mapping, add an entity, change a cadence/timezone, add an ERP adapter) and which require dev. Warranty escalation + SLA.

## 16. Closure Summary

Estimated vs actual hours + variance; sprints/milestones; RFCs approved; bugs by severity; lessons learned; estimation-accuracy notes for future projects.

## Appendices

spec.md · approved RFCs/ADRs · risk-log final state · adherence/QA reports · load/chaos results · references (verified ERP/store API docs, anchored to version).

---

Generated by: pm-agent v1.0 · Last reviewed: 2026-06-30 (initial Node.js build)
