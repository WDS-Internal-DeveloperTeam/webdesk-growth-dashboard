---
tier: 2
load_when: ["code-production", "schema-work", "backend-active"]
description: "Schema design from spec — normalization, indexing, relationships, Sequelize models. Feeds the G-Schema data-model."
---

# Database 01 — Modeling & Indexing

> How to turn the spec's rough field mapping into a real Postgres + Sequelize schema. The output is `data-model.md`, **client-approved at G-Schema** (blueprint §5) before any DB code ships.

---

## From spec to model

Discovery captures a rough DB/field mapping; you formalize it. Steps:

1. **List entities** from the spec and the integration contracts (e.g. `users`, `roles`, `modules`, `role_module_permissions`, `stores`, `erp_settings`, `field_mappings`, `sync_states`, `activity_logs`, plus the synced business entities like `orders`, `products`, `inventory`).
2. **Define attributes + types** explicitly — including the **external system's ID** for every synced entity (you key idempotent upserts on it: NODE-102).
3. **Define relationships** and their cardinality.
4. **Add `tenant_id`** to every tenant-owned table (multi-tenancy, NODE-104).
5. **Write it up in `data-model.md`** with the field-mapping table (ERP field → column → store field, direction, cadence) and get client sign-off at G-Schema.

---

## Normalization

- Default to **3NF**: no repeating groups, no derived columns you can compute, FKs for relationships. This keeps the field-mapping truthful and updates single-sourced.
- **Denormalize deliberately, not accidentally** — only for a measured read-path need, and document why. A cached `order_count` is fine if a trigger/job keeps it correct; a duplicated address copied "to save a join" is a drift bug.
- **JSONB for genuinely semi-structured payloads** (a raw ERP response you store for audit/replay) — but promote the fields you query/sync into real columns. Don't model relational data as a JSON blob (`technology-selection.md`).

---

## Relationships (Sequelize)

```js
// db/models/role.js
Role.hasMany(RoleModulePermission, { foreignKey: "roleId", as: "permissions" });
// db/models/role-module-permission.js — EXTENSIBLE action matrix, not fixed VED columns
RoleModulePermission.belongsTo(Role, { foreignKey: "roleId" });
RoleModulePermission.belongsTo(Module, { foreignKey: "moduleId" });
// One row per GRANTED action, so any action a module needs has somewhere to live:
//   columns: { roleId, moduleId, action }   // action ∈ 'view'|'edit'|'delete' (seeded)
//                                            //   ∪ 'create'|'approve'|'export'|'import'|'run'|'configure'|'manage_all'
//   unique index (roleId, moduleId, action)
// VED is seeded for every (role, module); a SOW needing Approve/Run/Export just inserts more rows.
// Alternative shape: a single row per (roleId, moduleId) with a JSONB `permissions` string[] — same intent.
```

This replaces the old fixed `{ canView, canEdit, canDelete }` columns: those three could not store an extended action (Approve/Run/Export/…). The row-per-action (or JSONB set) model keeps VED as the seeded minimum while letting a module add any action the SOW defines.

- Use explicit `foreignKey` and `as` aliases — don't rely on Sequelize's pluralization guesses.
- Set models `underscored: true` so JS `camelCase` ⇄ DB `snake_case` (naming conventions).
- Define associations in one place (a `models/index.js` that wires them after all models load).

---

## Indexing

Index for the queries you actually run; every index costs write throughput, so justify each.

- **Foreign keys** used in joins/filters: index them (Postgres does _not_ auto-index FKs).
- **Tenant scoping:** because every query filters by `tenant_id`, lead composite indexes with it: `idx_orders_tenant_id_status (tenant_id, status)`, `idx_orders_tenant_id_updated_at (tenant_id, updated_at)`.
- **External-id lookups** (idempotent upserts): a **unique** index on `(tenant_id, external_id)` per synced entity — this enforces idempotency at the DB level, not just in app code.
- **Watermark queries** (`updated_at > :watermark`): index the column the incremental sync filters on.
- **Uniqueness as a constraint**, not an app check: unique index on `(tenant_id, email)` for users, etc.
- Avoid over-indexing wide low-selectivity columns (a boolean alone). Use partial indexes for hot subsets (`WHERE status = 'pending'`).

```sql
CREATE UNIQUE INDEX idx_orders_tenant_external ON orders (tenant_id, external_id);
CREATE INDEX idx_orders_tenant_updated ON orders (tenant_id, updated_at);
```

---

## Keys & types

- **Primary keys: UUID v4** (`gen_random_uuid()` via `pgcrypto`) by default — avoids cross-tenant enumeration and merge collisions when syncing from multiple sources. Use bigserial only when ordering/locality is a measured need.
- **Timestamps:** `timestamptz`, always stored in **UTC**; the app renders them in the configured timezone (blueprint §6). `created_at`/`updated_at` on every table; soft-delete with `deleted_at` where audit requires.
- **Money:** `numeric`/`decimal`, never float. **Enums:** Postgres enum or a check constraint, not free text.
- **`tenant_id`:** `not null` on every tenant-owned table, FK to `tenants`.

The Sequelize migration that creates each table is the source of truth (`database/02-migrations-and-rollback.md`); models reflect the migrated schema.
