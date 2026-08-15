---
tier: 2
load_when: ["code-production", "schema-work", "security-topic"]
description: "Per-client + master tenancy, tenant scoping at the repository layer, isolation options."
---

# Database 03 — Multi-Tenancy

> This system is **per-client + master** (blueprint §8/§12). Every data access is tenant-scoped except the explicit master/super-admin path. A single unscoped query is the most damaging bug class here (NODE-104) — this file is how you prevent it structurally.

---

## The model

- **Per-client instance:** each client's dashboard is scoped to their stores/ERP. Operationally there may be one app per client or one app serving many tenants — either way the **data is logically partitioned by `tenant_id`.**
- **Master (super-admin):** the only cross-tenant scope. Used for the master dashboard's health/sync rollup and drill-in. It is a _separate, explicit, audited_ code path — not "the normal query with the tenant filter removed."

---

## Isolation options (pick at G1.5 / G-Schema, record the choice)

| Strategy                                        | Isolation | Cost   | When                                           |
| ----------------------------------------------- | --------- | ------ | ---------------------------------------------- |
| **Shared schema, `tenant_id` column** (default) | logical   | low    | most projects; the default for this system     |
| **Schema-per-tenant**                           | stronger  | medium | client demands separation, modest tenant count |
| **Database-per-tenant**                         | strongest | high   | regulatory/contractual hard isolation, on-prem |

Default to **shared-schema with `tenant_id`** + disciplined scoping; escalate only when the spec demands it (justify at the gate). For a single client install, the master is effectively the one cross-scope reader.

---

## Scoping at the repository layer (the enforcement point)

DB access lives only in repositories (NODE-003), so tenant scoping is enforced there — one place, testable by fitness tests.

**Every repository function takes `tenantId` and includes it in the filter:**

```js
// repositories/order-repository.js
export async function findById(tenantId, id) {
  return Order.findOne({ where: { id, tenantId } }); // never { id } alone
}
export async function list(tenantId, filter = {}) {
  return Order.findAll({ where: { ...filter, tenantId } });
}
export async function upsertByExternalId(tenantId, externalId, data) {
  return Order.upsert({ ...data, tenantId, externalId }); // keyed on (tenant_id, external_id)
}
```

**Belt and suspenders — a Sequelize default scope / hook** so a forgotten filter still can't run unscoped:

```js
// a beforeFind hook (or default scope) that refuses an un-tenanted query
sequelize.addHook("beforeFind", (options) => {
  if (options.__masterScope) return; // explicit opt-out, audited
  if (!options.where || options.where.tenantId == null) throw new Error("TENANT_SCOPE_MISSING"); // fail closed
});
```

- **Fail closed:** a missing tenant scope throws, it doesn't silently return everything.
- **`tenantId` is set once in auth middleware** (`req.tenantId`) and threaded through service → repository. Never re-derived from request input the user controls.

---

## The master scope (the one exception)

- Gated behind the super-admin role's permission check (`security/02-authn-authz.md`).
- Opts out of the tenant hook **explicitly** (`__masterScope: true`) so the exception is greppable and auditable — every use is logged to `audit_log`.
- Returns aggregates/summaries for the rollup; drill-in into one tenant re-applies that tenant's scope rather than streaming raw cross-tenant rows.

---

## Testing tenancy

- A fitness/integration test asserts that a repository call **without** `tenantId` throws, and that tenant A's credentials can never read tenant B's rows (cross-tenant isolation test — QA security suite, `testing/01`).
- Seed two tenants in tests; assert every list/get is partitioned. This is a required check before G4 sign-off on any multi-tenant module.
