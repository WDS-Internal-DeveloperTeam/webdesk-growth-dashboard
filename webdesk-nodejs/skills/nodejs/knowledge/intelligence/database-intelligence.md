---
tier: 2
load_when: ["schema-work", "planning", "g1_5", "g_schema"]
description: "Database Intelligence — decision support for DB / ORM / storage selection. Default Postgres + Sequelize. Output feeds data-model.md at G-Schema."
---

# Intelligence — Database

> Decision-support the agents consult when choosing the data layer (blueprint §10, #17). Choices are per-project from the approved lists and **justified at G-Schema**; the DBA verifies. The documented default is **PostgreSQL + Sequelize**.

---

## Decision: database

Approved set: **PostgreSQL (default) / MySQL / MongoDB.**

| Pick           | When                                                                                                                                                                                                                 |
| -------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **PostgreSQL** | default — relational integrity, transactions across multi-write sync, JSONB for raw ERP payloads, strong indexing. Choose unless there's a specific reason not to.                                                   |
| **MySQL**      | client mandate / existing infra is MySQL.                                                                                                                                                                            |
| **MongoDB**    | only genuinely document-shaped, schema-fluid data with no heavy relational joins. Rare in ERP↔store middleware (field mappings are relational). A document store for relational data is a flag, not a default — ask. |

## Decision: ORM

Approved set: **Sequelize (default) / Prisma / TypeORM.**

| Pick          | When                                                                                                                                                          |
| ------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Sequelize** | default. Models + migrations via `sequelize-cli`/umzug; **no raw queries outside repositories** (NODE-003); **transactions for multi-write sync operations**. |
| **Prisma**    | team wants a typed generated client and accepts its migration model.                                                                                          |
| **TypeORM**   | decorators / Active-Record style required by existing code.                                                                                                   |

Don't introduce a second ORM mid-system. Match existing team skill.

## Decision: object storage

Approved set: **S3 (default) / Cloudinary / GCS.**

| Pick           | When                                                        |
| -------------- | ----------------------------------------------------------- |
| **S3**         | default — general objects (exports, attachments, backups).  |
| **Cloudinary** | image transformation/CDN delivery is a product requirement. |
| **GCS**        | deploy target is GCP (colocation/egress).                   |

Follows the host target (§15).

---

## How to apply

1. Read the stack from `spec.md`; if a layer is missing or a new option is requested, **ASK** (`technology-selection.md`).
2. Apply the default where the spec is silent; record the choice + one-line justification.
3. Produce the schema per `database/01-modeling-and-indexing.md`, write it into **`data-model.md`** with the field-mapping table, and secure client approval at **G-Schema**.

## Sequelize specifics (baked in)

- Models `underscored: true` (JS camelCase ⇄ DB snake_case).
- Every tenant-owned table carries `tenant_id`; queries tenant-scoped at the repository (NODE-104).
- Unique index on `(tenant_id, external_id)` per synced entity → idempotency at the DB level (NODE-102).
- Transactions wrap multi-write sync operations so a partial sync rolls back, not corrupts.
- Migrations are reversible and dry-run in CI (`database/02`).
