---
tier: 2
load_when: ["g1_5", "g5", "architect-active"]
description: Define architecture fitness tests that prevent drift — boundary enforcement, no DB access outside repositories, API-version enforcement, queue retry caps, module boundaries. Mapped to dependency-cruiser / eslint-plugin-boundaries / custom checks. Gated at G5.
---

# 04 — Fitness-Test Planning

> Architecture fitness tests are automated checks that keep the codebase in the shape the architecture decided. They run in CI and are **gated at G5** (milestone regression + architecture fitness, gate-format.md §G5). The architect defines the plan at G1.5; each test maps to a real tool and ties to the ADR it enforces. A fitness-test plan that can't run is decoration — every test names its tool and its pass/fail rule. These results also feed `architecture_health` in the Project Health Score (`health-score.schema.json`).

---

## What to enforce (the minimum set for Node middleware)

### 1. Controller / service / repository boundaries

- **Rule:** Controllers depend on services; services depend on repositories; nothing skips a layer upward (a controller must not call a repository directly or contain business logic).
- **Tool:** `dependency-cruiser` rules (forbidden edges) or `eslint-plugin-boundaries` (element types: controller, service, repository, adapter, sync, model).
- **Fail:** any forbidden import edge.
- **Enforces:** the component-breakdown ADR / coding standards (controllers = HTTP only).

### 2. No direct DB access outside repositories

- **Rule:** Sequelize models / query APIs are imported only inside `repositories/`. No raw queries or model calls in controllers, services, adapters, or the sync engine.
- **Tool:** `dependency-cruiser` (only `repositories/**` may import `models/**` or the Sequelize instance) + an ESLint custom rule / restricted-imports for raw `sequelize.query`.
- **Fail:** a model/query import outside `repositories/`.
- **Enforces:** the datastore/ORM ADR (no raw queries outside repositories; transactions for multi-write sync).

### 3. API-version enforcement

- **Rule:** All HTTP routes live under the versioned prefix (`/api/v1`); no unversioned public routes. The pinned upstream API version (store/ERP) is referenced from one constant, not scattered.
- **Tool:** custom check scanning the router for the version prefix + a grep-style test that upstream API-version strings come from the single config constant.
- **Fail:** an unversioned route or a hard-coded upstream version string outside config.
- **Enforces:** the API-design + integration-contract ADRs.

### 4. Queue retry caps (no unbounded retry)

- **Rule:** Job/retry configuration has an explicit cap and backoff; no infinite retry loops; a DLQ (or skip-and-alert for node-cron) is defined.
- **Tool:** custom check on the queue config (BullMQ `attempts`/`backoff` set and bounded; for node-cron, a skip-if-running + missed-run alert is wired).
- **Fail:** missing/uncapped retry config.
- **Enforces:** the queue-choice ADR.

### 5. Module / tenancy boundaries

- **Rule:** Integration adapters don't import each other (each external system is isolated behind the common interface); dashboard modules don't reach into each other's internals; tenant-scoped repository methods require a tenant scope (no un-scoped finder on a tenant table).
- **Tool:** `dependency-cruiser` (no cross-adapter, no cross-module edges) + a custom check / lint that tenant-table repository methods take a tenant scope.
- **Fail:** a cross-adapter import, a cross-module reach-in, or an un-scoped tenant query.
- **Enforces:** the tenancy data-model ADR + the adapter-isolation decision.

---

## Optional / project-specific tests

- **Idempotency present:** every webhook handler/event consumer references the idempotency key (custom check / convention test) — enforces the idempotency ADR.
- **Timezone source:** the scheduler reads `project.json.timezone` / Settings, never `new Date()` server-local for scheduling (restricted-import or grep test) — enforces the scheduler-timezone ADR.
- **No inline secrets:** secrets come from env/secret-manager, not literals (secret-scan; overlaps security CI).

---

## Plan format (what to hand off at G1.5)

Write the plan to `architecture-tests/_plan.md`. One row per test:

| ID   | Rule (one line)                          | Tool                        | Pass/fail                                        | Enforces (ADR) | Gate |
| ---- | ---------------------------------------- | --------------------------- | ------------------------------------------------ | -------------- | ---- |
| FT-1 | controller→service→repository only       | dependency-cruiser          | no forbidden edge                                | ADR-0001       | G5   |
| FT-2 | DB access only in repositories           | dependency-cruiser + eslint | no model import outside repos                    | ADR-0003       | G5   |
| FT-3 | all routes under /api/v1                 | custom check                | no unversioned route                             | ADR-0004       | G5   |
| FT-4 | queue retries capped + DLQ/skip-alert    | custom check                | retry cap present                                | ADR-0002       | G5   |
| FT-5 | adapters isolated; tenant queries scoped | dependency-cruiser + custom | no cross-adapter edge; no un-scoped tenant query | ADR-0005       | G5   |

Backend implements these as runnable CI checks (Backend's scaffold + CI work, G3). At G5 they must be green to pass the milestone.

---

## How fitness tests relate to the rest of the system

- **Tied to ADRs:** each ADR's _Enforcement_ field should point at one of these tests (`03-adr-authoring.md`). An ADR without a corresponding test tends to erode.
- **Gated at G5:** failing fitness tests block the milestone (gate-format.md §G5).
- **Feeds health score:** `architecture_health` is computed from the fitness-test pass rate + boundary-violation count (`pm-agent/knowledge/09-health-score.md`); all-pass + no new boundary debt = GREEN.

---

## Anti-patterns

1. **A plan with no tool** — "enforce clean architecture" is not a test; name dependency-cruiser / eslint-plugin-boundaries / the custom check.
2. **Tests that don't run in CI** — if it's not gated at G5, drift happens between milestones.
3. **Enforcing boundaries but not tenancy** — an un-scoped tenant query is a cross-tenant data leak; test for it.
4. **Unbounded retries** — without a cap + DLQ/skip-alert, a poisoned job loops forever; FT-4 guards this.
5. **ADRs with no matching fitness test** — the decision will erode; close the loop.

---

Last reviewed: 2026-06-30 (initial Node.js build)
Next review due: 2026-09-30
