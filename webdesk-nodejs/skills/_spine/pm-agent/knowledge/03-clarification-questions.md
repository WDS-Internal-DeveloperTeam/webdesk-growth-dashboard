---
tier: 2
load_when: ["discovery", "intake", "planning", "pm-active"]
description: The clarification question bank for Node.js middleware / custom-app projects. Ask ONLY what is missing from spec.md (tech stack / integrations). Batch into one round.
---

# 03 — Clarification Questions Bank

> The library the PM Agent draws from when `spec.md` has gaps. **Ask only what's missing** — primarily from the **Tech Stack** and **Integrations** sections of the spec, plus the G0 intake fields. Read the spec frontmatter and body first; never re-ask a field the spec already answers. Batch all selected questions into ONE structured round, then proceed. Do not drip questions.

---

## Selection rule

```
read spec.md (frontmatter + Tech Stack §5 + Integrations §6 + G0 intake fields)
selected = []
for each required field that is blank, "TBD" without a decided-at gate, or contradictory:
    selected.append(question_for(field))
filter selected by project_type + integration_targets   # don't ask Shopify Qs on a BigCommerce job
batch selected into one request, grouped by severity
```

Severity: **Critical (C)** blocks G0/G1 · **Important (I)** lowers spec quality · **Conditional (X)** only for certain project types/targets.

---

## A. Project identity & stack

### Q1 — Project type [C]

integration-middleware · custom-app-build · frontend-tool · version-upgrade · maintenance?

### Q2 — Build context [C]

`nodejs` · `nodejs+bigcommerce` · `nodejs+shopify`? (Node is always the primary arm; the store suffix loads only that commerce KB.)

### Q3 — Framework [I]

Express (default) · Fastify · Nest · Next? Any reason to deviate from Express?

### Q4 — Database + ORM [C if a datastore exists]

PostgreSQL + Sequelize is the default. Any reason to choose MySQL/MongoDB or Prisma/TypeORM? (Justified at G-Schema.)

### Q5 — Storage [I]

Object storage needed (exports, backups, images)? S3 · Cloudinary · GCS · none?

### Q6 — Queue / scheduler [I]

Start with node-cron for simple schedules and escalate to BullMQ+Redis when concurrency / retries / DLQ are needed — confirm, or is heavy concurrency known up front (decide at G1.5)?

### Q7 — Frontend [C if UI in scope]

React · Next · none (headless middleware)? If a dashboard is in scope, it's HTML-mockup-first (D-DES-01) then React/Next.

### Q8 — Host target [C]

local (default, local-first) · AWS · GCP · Cloudflare · Heroku · VPS? Any on-prem/VPN connectivity (e.g. on-prem ERP)?

---

## B. Integrations (load-bearing for middleware)

### Q9 — Integration targets [C]

Which external systems exactly? ERP/CRM (DDI Inform, Fishbowl, Sage 300, Sage 100, NetSuite, Acctivate, pc/MRP, ...) and which store (BigCommerce / Shopify)?

### Q10 — Entities + system of record [C]

For each system, which entities sync (items, inventory, pricing, customers, orders, ...) and which side is authoritative per entity?

### Q11 — Directions + conflict resolution [C]

Per entity: pull, push, or both? For any two-way entity, what is the conflict-resolution rule (last-write-wins / source-of-record-wins / field-level)?

### Q12 — Cadence [C]

Per entity, how fresh must the data be? (Drives the per-entity cron cadence in the client's timezone.)

### Q13 — Auth + rate limits + sandbox [C]

Per system: auth type, where credentials live, token refresh, documented rate limits, and **is a sandbox/test company available now?** (No sandbox = integration code is built against docs + mocks and gated.)

### Q14 — Data volumes [I]

Approximate SKU / customer / order counts and known spikes — to size the first full sync and the capacity profile.

### Q15 — Webhooks [X — store side]

Does the store support webhooks for the relevant entities (e.g. orders)? ERPs are usually poll/cron, not webhook — confirm.

---

## C. Operational / G0 intake

### Q16 — Timezone [C]

IANA timezone (e.g. America/Toronto)? It is the operational clock for all cron, sync windows, timestamps, and report boundaries.

### Q17 — Tenancy [C]

Per-client only, or per-client **+ master** (cross-client super-admin) dashboard? If master, is it a central app you host and where does health data aggregate?

### Q18 — Data sensitivity [C]

low · medium · high? (Drives PII handling, secrets, encryption-at-rest depth.)

### Q19 — RBAC scope [I]

Confirm per-module **View/Edit/Delete** RBAC; which roles beyond Admin/Manager, and any custom roles?

### Q20 — Timeline & budget [C]

Hard launch deadline driven by a real event, or aspirational? Fixed-price or hourly? Budget envelope?

### Q21 — Approval rounds [I]

Rounds of HTML-design revision included? QA-fix rounds per sprint? Change-request process (RFC) understood?

### Q22 — Warranty & post-launch [I]

Warranty period (30/60/90 days)? Retainer / ongoing monitoring expected (drives the master-dashboard health-score cadence)?

---

## Presenting to the developer

- Group by severity (Critical / Important / Conditional).
- Number each with its Q-id and a one-line **why it matters**.
- One round only — batch everything.
- For external-API items (auth, rate limits, entity coverage), explicitly note these are **verify-at-Discovery** and a missing sandbox is a blocker, not a nice-to-have.

---

## Maintenance

Reviewed quarterly. Add new questions with the next free Q-id (Q23, Q24, ...) when recurring gaps appear; never renumber. Owner: PM lead.

---

Last reviewed: 2026-06-30 (initial Node.js build)
Next review due: 2026-09-30
