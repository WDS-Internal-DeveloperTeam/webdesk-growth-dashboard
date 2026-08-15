---
tier: 2
load_when: ["nodejs", "schema-work", "planning"]
description: "Supported stacks per layer, the documented defaults, and the ask-if-missing rule. Choices are read from spec.md and justified at the gate."
---

# Technology Selection

> The supported stacks and the rule for choosing. **Read the tech stack from `spec.md`.** Defaults below apply when the spec is silent. If a layer is missing from the spec, or a new/unlisted option is requested, **ASK** — then record the choice + justification for the gate (G1.5 for architecture, G-Schema for the data layer).

---

## Supported stacks

| Layer              | Default                  | Approved alternatives     | Gate where justified |
| ------------------ | ------------------------ | ------------------------- | -------------------- |
| Runtime            | **Node.js 22+ LTS, ESM** | —                         | —                    |
| Backend framework  | **Express**              | (ask before substituting) | G1.5                 |
| Frontend           | **React / Next.js**      | —                         | G2 (design)          |
| Database           | **PostgreSQL**           | MySQL, MongoDB            | **G-Schema**         |
| ORM / data layer   | **Sequelize**            | Prisma, TypeORM           | **G-Schema**         |
| Object storage     | **S3**                   | Cloudinary, GCS           | G1.5                 |
| Queue / scheduling | **node-cron** (simple)   | **BullMQ + Redis**        | G1.5                 |

---

## How to choose

1. **Read `spec.md`.** It carries the `tech_stack` decided at intake/architecture. Use it.
2. **If the spec names a layer, use that** — don't second-guess an approved decision.
3. **If a layer is absent, default** to the table above, and note the default you applied.
4. **If a new or unlisted option is requested** (e.g. Fastify, MongoDB for a relational problem, Kafka), **ASK** rather than silently adopting or refusing. Surface the trade-off, recommend, and let the human decide.
5. **Record the choice + one-line justification** in the artifact for the relevant gate. The DBA verifies data-layer choices at G-Schema; the tech lead verifies architecture choices at G1.5.

The intelligence modules carry the decision criteria: `intelligence/database-intelligence.md` (DB/ORM/storage), `intelligence/integration-intelligence.md` (sync pattern + queue).

---

## Layer-by-layer guidance

### Database — PostgreSQL (default)

Choose Postgres unless the spec has a specific reason not to. Relational integrity, transactions across multi-write sync operations, JSONB for semi-structured ERP payloads, mature indexing. **MySQL** if the client mandates it / existing infra. **MongoDB** only for genuinely document-shaped, schema-fluid data with no heavy relational joins — rare in ERP↔store middleware, where field mappings are inherently relational. A document store for relational data is a flag, not a default.

### ORM — Sequelize (default)

Models + migrations via `sequelize-cli`/umzug; transactions for multi-write sync; **no raw queries outside repositories**. **Prisma** when the team wants typed queries and a generated client and accepts its migration model; **TypeORM** when decorators/Active-Record style is required by existing code. Match the team's existing skill — don't introduce a second ORM mid-system.

### Object storage — S3 (default)

S3 for general object storage (exports, attachments, backups). **Cloudinary** when image transformation/CDN delivery is a product requirement. **GCS** when the deploy target is GCP and egress/colocation favor it. Selection follows the host target (`§15` hosting).

### Queue / scheduling — start simple, escalate by need

Default to **node-cron** for straightforward timezone-aware schedules (the common case: nightly/periodic ERP sync). **Escalate to BullMQ + Redis** the moment you need any of: concurrency control across workers, automatic retries with backoff, a **dead-letter queue**, job prioritization, or overlapping-run prevention at scale. Don't reach for BullMQ before the need is real; don't stay on node-cron once retries/DLQ are required. Details: `integration/02-queues-and-jobs.md`.

### Backend framework — Express (default)

Express unless the spec justifies otherwise. If a different framework is requested, ASK and capture the reasoning at G1.5 — the layering (controller/service/repository) and middleware-order discipline (`backend/01`) hold regardless of framework.

---

## Ask-if-missing rule (summary)

> A missing or new stack layer is a **question for the human, not a guess.** Default where the table allows, ask where it doesn't, and always record the decision + justification for the gate. Silent adoption of an unlisted technology is a process violation.
