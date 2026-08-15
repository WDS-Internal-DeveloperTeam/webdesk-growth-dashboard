---
tier: 2
load_when: ["code-production", "schema-work", "scaffold"]
description: "Sequelize migrations (sequelize-cli/umzug), forward/rollback, seeds/fixtures, zero-downtime patterns."
---

# Database 02 — Migrations & Rollback

> Every schema change is a reviewed, reversible migration — never a manual `ALTER` against a live DB. The migration runner is part of the G3 scaffold and the deploy abstraction (build → **migrate** → release → health-check → rollback, §15).

---

## Tooling

- **`sequelize-cli`** for the standard flow, or **umzug** when you need programmatic control (custom storage, running migrations from the app). Either way, migrations live in `src/db/migrations/`, timestamp-prefixed (`20260630120000-create-orders.js`).
- The runner is wired to npm scripts: `npm run migrate` (up), `npm run migrate:undo` (down).
- A migration record table (`SequelizeMeta`) tracks what's applied — never edit an already-applied migration; add a new one.

---

## Every migration is reversible

`up` and `down` both implemented and tested. CI runs a **migration dry-run** (apply on a throwaway DB, then roll back) on every PR (blueprint §19).

```js
// 20260630120000-create-sync-states.js
export async function up(queryInterface, Sequelize) {
  await queryInterface.createTable("sync_states", {
    id: {
      type: Sequelize.UUID,
      defaultValue: Sequelize.literal("gen_random_uuid()"),
      primaryKey: true,
    },
    tenant_id: {
      type: Sequelize.UUID,
      allowNull: false,
      references: { model: "tenants", key: "id" },
    },
    entity: { type: Sequelize.STRING, allowNull: false },
    watermark: { type: Sequelize.DATE }, // timestamptz, UTC
    last_run_at: { type: Sequelize.DATE },
    created_at: { type: Sequelize.DATE, allowNull: false },
    updated_at: { type: Sequelize.DATE, allowNull: false },
  });
  await queryInterface.addConstraint("sync_states", {
    type: "unique",
    fields: ["tenant_id", "entity"],
    name: "uq_sync_states_tenant_entity",
  });
}
export async function down(queryInterface) {
  await queryInterface.dropTable("sync_states");
}
```

`down` must truly reverse `up` (drop what was created, restore what was changed). A `down` that throws or no-ops is a broken rollback — caught by the dry-run.

---

## Seeds & fixtures

- **Seeds** (`db/seeders/`) bootstrap required reference data: the default modules, the Admin role with full VED, the master tenant. Idempotent (upsert, don't blind-insert) so re-running is safe.
- **Fixtures** for tests are separate from production seeders — load them in the test setup against a disposable DB, never against a shared one.
- Never seed real client data or secrets.

---

## Zero-downtime patterns

A migration runs against a live system mid-deploy; the old and new app versions briefly run together. Design migrations to be **backward-compatible across that window** — expand, then contract:

1. **Expand:** add the new nullable column / new table. Old code ignores it; new code can use it. Deploy.
2. **Backfill:** populate the new column in a batched, resumable job (not one giant `UPDATE` that locks the table).
3. **Migrate reads/writes:** new code reads/writes the new shape. Deploy.
4. **Contract:** once nothing references the old column, drop it in a later migration.

Rules that keep this safe:

- **Never rename or drop a column in the same deploy that stops using it** — split across two releases (the old version is still running during rollout).
- **Add columns nullable** (or with a default that doesn't rewrite the whole table on large tables) to avoid long locks. On Postgres, adding a column with a non-volatile default is cheap on modern versions, but test on production-sized data.
- **Create indexes `CONCURRENTLY`** on large tables so you don't lock writes (note: can't run inside a transaction — handle in the migration accordingly).
- **Backfills are batched + resumable** with their own watermark, like a sync.

---

## Rollback discipline

- Every release records the migration state it deployed; rollback re-runs `down` to the prior state **only when the down migrations are safe** (no data loss). For expand/contract, rolling back the _contract_ step requires the column still exists — which is why contract is a separate, later release.
- The `db-restore` runbook (`operations/`, blueprint §13) covers the case where forward-fix is safer than rollback (data already written in the new shape). Migrations get you schema rollback; the runbook covers data recovery.
- Practise the rollback before G6 — an untested rollback is not a rollback.
