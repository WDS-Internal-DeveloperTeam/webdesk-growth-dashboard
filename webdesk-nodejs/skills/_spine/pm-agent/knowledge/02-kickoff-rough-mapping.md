---
tier: 2
load_when: ["discovery", "planning", "schema-work", "integration-work", "pm-active"]
description: How to turn the team's rough DB/field mapping + API-contract direction from kickoff/Discovery into a draft data-model.md and draft integration contracts. These are DRAFTS until client sign-off at G-Schema / G-Contracts.
---

# 02 — Kickoff Rough-Mapping → Draft Schema & Draft Contracts

> At kickoff and during Discovery the team and client sketch a rough DB/field mapping and a rough API-contract direction. This file is how the PM Agent formalizes those sketches into a **draft `data-model.md`** and **draft integration contracts**. The word **draft** is load-bearing: nothing here is approved by writing it. The data-model is client-approved at **G-Schema**; the contracts are client-approved at **G-Contracts**. **No persistence or integration code is written against a draft** (gate-format.md). The human PM secures the client approvals; you produce the formalized drafts.

---

## Inputs you start from

From `discovery-report.md` (sections 8 and 9):

- The **rough DB/field mapping** table (ERP field → store/DB field, per entity, with direction).
- The **rough API-contract direction** (per system: endpoints/entities, direction, cadence, auth).

Both arrive incomplete and partly unverified. That is expected — your job is to formalize the shape, not to invent the gaps. Carry every "unverified — confirm at Discovery" forward; do not silently resolve it.

---

## Part A — Draft `data-model.md`

Default stack: **PostgreSQL + Sequelize** (blueprint §10). Alternatives (MySQL/MongoDB, Prisma/TypeORM) only by justification at G-Schema.

### What the draft must contain

1. **Core entities** every instance needs (from blueprint §8/§16):
   - `users`, `roles`, `permissions` (the per-module **View/Edit/Delete** matrix: `role × module × {view, edit, delete}`).
   - `settings` (store name, email, store URL, API key, access token, client secret, API path, **timezone**) — per tenant.
   - `field_mappings` — the persisted form of the rough mapping (source field, target field, entity, direction, transform).
   - `sync_state` / watermarks — per entity, per direction: last-synced cursor/timestamp, last-run status.
   - `activity_logs`.
   - Tenancy columns: every tenant-scoped table carries a `tenant_id` (or equivalent); the master role is the only cross-tenant scope.

2. **Domain entities** from the rough mapping — the synced business objects (items, inventory, pricing, customers, orders) as the middleware persists/stages them. Only model what the sync actually needs; do not mirror the entire ERP.

3. **Per-table detail:** columns + types, PK, FKs, indexes (especially on `tenant_id`, sync watermarks, and natural keys like SKU), unique constraints (idempotency keys), and nullability.

4. **Migrations note:** reversible, via `sequelize-cli` / umzug. No raw queries outside repositories. Transactions for multi-write sync operations.

### Draft data-model.md skeleton

```markdown
# Data Model (DRAFT — client-approved at G-Schema) — [Project]

> Status: DRAFT. Not approved. No migration runs in any shared env until G-Schema passes.
> Stack: PostgreSQL + Sequelize. Migrations reversible (sequelize-cli/umzug).

## Tenancy model

[per-client tables carry tenant_id; master role = only cross-tenant scope]

## Entities

### users

| column | type | null | index | notes |

### roles / permissions (role × module × {view, edit, delete})

### settings (incl. timezone)

### field_mappings (source, target, entity, direction, transform)

### sync_state (entity, direction, watermark/cursor, last_run_at, last_status)

### activity_logs

### [domain entities from the rough mapping]

## Field mapping (persisted form of discovery §8)

| Entity | Source (ERP) | Target (store/DB) | Direction | Transform | Unverified? |

## Indexes & constraints

[tenant_id, watermarks, SKU/natural keys, idempotency unique keys]

## Open items / unverified

[carry forward every unverified field from Discovery]
```

---

## Part B — Draft integration contracts

Each external system gets one draft contract validating against `_contracts/integration-contract.schema.json` and listed in the Integration Contract Registry (`integration-contracts/_registry.md`). The architect refines these at G1.5 if it runs; the human PM secures client approval at G-Contracts.

### What each draft contract states (per system)

- **System + role** (system-of-record vs commerce; e.g. `erp:ddi-inform` = system-of-record for items/inventory/pricing).
- **Entities + direction(s)** — and the **conflict-resolution rule** for any two-way entity.
- **Auth** — type, where credentials live, refresh, rate limits (**mark unverified** until proven).
- **Sync pattern + cadence** — per entity, in the client's timezone (cron for ERP pull/push; webhook only where the store supports it).
- **Idempotency** — the key/strategy guarding duplicate processing (e.g. unique `(system, entity, external_id)` plus a processed-event log).
- **In-scope failure modes + handling** (the pre-flight list, blueprint §10): api-timeout, duplicate-webhook, partial-sync, overlapping-sync, rate-limit, token-expiry, out-of-order, clock-skew, watermark-gap, upstream-5xx.
- **Status:** `draft` (flips to `client-approved` at G-Contracts).

### Draft contract skeleton

```markdown
# Integration Contract IC-[SYS]-001 (DRAFT) — [system]

status: draft # → client-approved at G-Contracts
system: [erp:ddi-inform | bigcommerce]
role: [system-of-record | commerce]

## Entities & directions

| Entity | Direction | Conflict rule (two-way) | Cadence (client tz) |

## Auth

[type; credential location; refresh; rate limits — UNVERIFIED until sandbox/docs confirm]

## Sync pattern

[cron pull/push per entity | webhook where supported; first run = full, then incremental from watermark]

## Idempotency

[key + processed-event log]

## In-scope failure modes + handling

[api-timeout … upstream-5xx — one line of handling each]

## Open items / unverified

[every unproven API specific]
```

---

## The DRAFT discipline (do not skip)

- Mark both artifacts **DRAFT** at the top, in the filename context, and in `project.json` (`integration_contracts[].status = "draft"`).
- State explicitly: **no migration runs and no integration code is written until the relevant gate passes** (G-Schema for the model, G-Contracts for the contracts).
- You **formalize**; the **human PM secures client approval**. Capturing or formalizing a mapping never counts as approval.
- On approval, the human PM flips `status` to `client-approved` and records `approved_by` / `approved_at`; you do not.

---

## Anti-patterns

1. **Treating a formalized draft as done.** Formalizing ≠ approving. The client gate is the approval.
2. **Resolving unverified API specifics by guessing.** Carry the "unverified" forward; it's a blocker the client/sandbox resolves.
3. **Mirroring the whole ERP schema.** Model only what the sync needs.
4. **Omitting idempotency / watermark columns.** Without them, resumable incremental sync and duplicate protection are impossible — they belong in the first draft.
5. **Forgetting tenancy columns.** Per-client scoping must be in the model from the draft, not bolted on later.

---

Last reviewed: 2026-06-30 (initial Node.js build)
Next review due: 2026-09-30
