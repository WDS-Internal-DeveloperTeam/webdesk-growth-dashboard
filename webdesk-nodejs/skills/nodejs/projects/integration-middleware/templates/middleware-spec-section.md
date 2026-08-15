---
tier: 2
load_when: ["pt-integration-middleware", "discovery", "g0", "planning", "pm-active"]
description: Drop-in spec section for an integration-middleware project — integration targets, entities, directions, per-entity cadence, tenancy, timezone. Fills the middleware-specific part of spec.md.
---

# Spec Section — Integration Middleware

> Copy this block into the project's `spec.md` and fill it in. It captures the middleware-specific intake the spec validator (G0) and the contract/schema gates depend on. Anything not yet verified against real ERP docs/sandbox is recorded as **[VERIFY-AT-DISCOVERY]**, never invented (NODE-008). Pair with `templates/sync-job-checklist.md` (per entity) and `nodejs/templates/integration-contract.template.md` (per system).

---

## 1. Build context

| Field                 | Value                                                                         |
| --------------------- | ----------------------------------------------------------------------------- |
| `project_type`        | integration-middleware                                                        |
| `build_context`       | [ nodejs+bigcommerce                                                          | nodejs+shopify ]    |
| `integration_targets` | [ e.g. ["erp:ddi-inform", "bigcommerce"] ]                                    |
| `timezone`            | [ client business timezone, e.g. America/Toronto — drives ALL cron/activity ] |
| `tenant.mode`         | [ per-client                                                                  | per-client+master ] |
| `tenant.master`       | [ is there a master/super-admin dashboard? yes/no + who hosts it ]            |
| Host target           | [ AWS                                                                         | GCP                 | Cloudflare | Heroku | VPS | local-first ] |
| Data sensitivity      | [ PII present? PCI scope? — keep PCI scope out where possible ]               |

## 2. Tech stack (justified at G1.5 / G-Schema)

| Layer     | Choice                                                                   | Justification                                  |
| --------- | ------------------------------------------------------------------------ | ---------------------------------------------- |
| Runtime   | Node.js 22+, ESM                                                         | system default                                 |
| Framework | Express                                                                  | system default                                 |
| DB        | PostgreSQL                                                               | default (alt: MySQL/MongoDB by justification)  |
| ORM       | Sequelize                                                                | default (alt: Prisma/TypeORM by justification) |
| Queue     | [ node-cron (start) → BullMQ+Redis when concurrency/retries/DLQ needed ] | ADR at G1.5                                    |
| Storage   | [ S3                                                                     | Cloudinary                                     | GCS | none ] | if files involved |
| Dashboard | React / Next.js                                                          | system default                                 |

## 3. Systems (one row per external system — each becomes one contract)

| System          | role             | directions     | entities                                                   | auth                    | sync.pattern                  | sandbox?           |
| --------------- | ---------------- | -------------- | ---------------------------------------------------------- | ----------------------- | ----------------------------- | ------------------ |
| [ ddi-inform ]  | system-of-record | [ pull, push ] | [ items, inventory, pricing, categories ]                  | [ VERIFY-AT-DISCOVERY ] | scheduled                     | [ yes/no/unknown ] |
| [ bigcommerce ] | commerce         | [ pull, push ] | [ orders, customers, +write-back inventory/pricing/items ] | oauth2/api-token        | webhook + scheduled reconcile | yes                |

> Each system gets an `integration-contracts/<system>.md` (validated against `integration-contract.schema.json`), client-approved at **G-Contracts**. No integration code against a `draft` contract.

## 4. Per-entity sync plan (the cadence + direction matrix)

| Entity     | Authoritative system | Direction | Cadence (cron, in `timezone`)       | Incremental? | Watermark field | Conflict rule (if two-way)               |
| ---------- | -------------------- | --------- | ----------------------------------- | ------------ | --------------- | ---------------------------------------- |
| inventory  | ERP                  | ERP→store | [ */15 * * * * ]                    | yes          | [ modifiedAt ]  | n/a                                      |
| pricing    | ERP                  | ERP→store | [ 0 * * * * ]                       | yes          | [ modifiedAt ]  | n/a                                      |
| items      | ERP                  | ERP→store | [ 0 2 * * * ]                       | yes          | [ modifiedAt ]  | n/a                                      |
| categories | ERP                  | ERP→store | [ 0 2 * * * ]                       | yes          | [ modifiedAt ]  | n/a                                      |
| orders     | store                | store→ERP | [ webhook + 0 */1 * * * reconcile ] | yes          | [ modifiedAt ]  | store-of-record                          |
| customers  | store                | store→ERP | [ webhook + nightly reconcile ]     | yes          | [ modifiedAt ]  | [ system-of-record-wins / lww / manual ] |

> Reconciliation cadence (coarser, per entity): [ nightly parity + windowed re-pull ]. Overlap policy: [ skip-if-running ].

## 5. Dashboard scope

- Inherits the default dashboard standard (modules, JWT, per-module VED RBAC, Settings incl. Timezone, master+per-client).
- Adds middleware modules: **Sync Status, Health, Field Mapping, Logs & DLQ** (`knowledge/04-dashboard.md`).
- G2 mockup required (HTML/CSS/JS per D-DES-01).

## 6. Known unknowns (flag, don't fill with guesses)

| Item                                                     | Status                       | Resolve at         |
| -------------------------------------------------------- | ---------------------------- | ------------------ |
| ERP API auth/rate limits/entity coverage                 | [ VERIFY-AT-DISCOVERY ]      | Discovery          |
| ERP sandbox/test-company access                          | [ have / requesting / none ] | Discovery          |
| Two-way conflict rules per entity                        | [ TBD ]                      | G1.5 / G-Contracts |
| Queue runtime escalation point                           | [ TBD ]                      | G1.5               |
| Production host + connectivity (on-prem ERP behind VPN?) | [ TBD ]                      | G1.5               |

---

Last reviewed: 2026-06-30 by Claude (initial build)
