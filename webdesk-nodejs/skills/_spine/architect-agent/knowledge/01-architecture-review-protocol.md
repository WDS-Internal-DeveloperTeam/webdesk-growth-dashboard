---
tier: 2
load_when: ["g1_5", "architect-active"]
description: The G1.5 Architecture Review protocol. Context diagram, component breakdown, stack justification, integration contracts, data-flow + sync strategy, NFRs, risks + mitigations. Produces architecture.md.
---

# 01 — Architecture Review Protocol (G1.5)

> The step-by-step for the G1.5 Architecture Review. Each step maps to a section of the `architecture.md` deliverable (`templates/architecture.md`). Specific to Node/Express/PostgreSQL/Sequelize ERP↔store middleware with timezone-aware cron sync. Do not invent external-API specifics — mark them **verify-at-discovery**.

---

## Inputs

`spec.md`, `discovery-report.md` (esp. systems inventory + rough mappings), the PM's kickoff draft `data-model.md` and draft contracts, and the list of triggers that opened G1.5 (`02-complexity-triggers.md`).

---

## Step 1 — Context diagram (systems + data flows)

Draw the system in its environment: the middleware in the center, each external system (the ERP, the store, any 3PL/PIM/tax) as a boundary, and **every data flow labeled with entity + direction + cadence**. Show:

- Which side is system-of-record per entity.
- Pull vs push vs webhook per flow.
- The trust/connectivity boundary (cloud vs on-prem ERP behind a VPN — a real flow, not a footnote).
- The per-client tenant boundary and the master (cross-client) oversight plane.

A text/ASCII or mermaid diagram is fine; the labels (entity, direction, cadence) are the point.

## Step 2 — Component breakdown

Decompose the middleware into components and their responsibilities:

- **Controllers** — HTTP only (no business logic).
- **Services** — business logic.
- **Repositories** — all DB access (no raw queries outside repositories).
- **Integration adapters** — one per external system behind the common **pull / push / normalize / sync-state** interface (so the next ERP differs only inside its adapter).
- **Sync engine** — orchestrates per-entity sync: full-then-incremental, watermark/resume, overlap policy (skip-if-running), reconciliation.
- **Scheduler** — timezone-aware cron driven by `project.json.timezone` (never server local tz); reschedules on timezone change.
- **Queue** — node-cron for simple schedules; BullMQ+Redis when concurrency/retries/DLQ are needed (decide here, record as an ADR).
- **Auth + tenancy middleware** — JWT (access+refresh, rotation, revocation), per-module VED RBAC, per-tenant query scoping.

State the dependency direction (controllers → services → repositories; adapters used by services/sync engine; nothing reaches into the DB except repositories). This dependency rule is later enforced by fitness tests (`04`).

## Step 3 — Chosen stack justification

Justify each layer against the spec and the defaults (Node 22 + Express + PostgreSQL + Sequelize). Justify any deviation (MySQL/MongoDB, Prisma/TypeORM, Fastify/Nest, BullMQ vs node-cron, host target). Non-default DB/ORM/storage is justified here and approved at G-Schema; queue/runtime is justified here. Each non-obvious choice becomes an ADR.

## Step 4 — Integration contracts per external system

Refine the PM's draft contracts into one `draft` contract per system (validating against `integration-contract.schema.json`), each stating:

- Entities + direction(s) + system-of-record; conflict-resolution rule for two-way entities.
- Auth + credential location + token refresh + **rate limits (mark unverified)**.
- Sync pattern + per-entity cadence (client tz).
- Idempotency key/strategy.
- In-scope failure modes + handling (api-timeout, duplicate-webhook, partial-sync, overlapping-sync, rate-limit, token-expiry, out-of-order, clock-skew, watermark-gap, upstream-5xx).
  These stay `draft` until G-Contracts; the human PM secures client approval.

## Step 5 — Data-flow + sync strategy (the core of a middleware architecture)

For each synced entity, specify:

- **Cron cadence** (in client tz) and why (driven by the freshness requirement and the rate limit).
- **First run = full sync; subsequent = incremental from the watermark.**
- **Conflict resolution** for two-way entities — the exact rule (source-of-record-wins / last-write-wins by timestamp / field-level merge) and how convergence is verified (parity tests).
- **Idempotency** — the key that makes re-processing safe; the processed-event log for webhooks.
- **Reconciliation** — the per-run integrity check (counts/checksums) and what a mismatch triggers.
- **Overlap policy** — a slow run must not stack on the next tick (skip-if-running) and must resume from the watermark if killed.

## Step 6 — NFRs

State the non-functional requirements with numbers where possible:

- **Throughput / latency** — e.g. full catalog sync of N SKUs within M minutes; incremental within X; the capacity profile that feeds SLO/SLA at G5.
- **Security** — JWT, secrets management, per-tenant authz, OWASP-API baseline, data sensitivity handling.
- **Compliance** — PII handling, region constraints if any.
- **Availability / resilience** — what happens when the ERP or store is down (502/503/504 handling, backoff, queue draining, alerting).

## Step 7 — Risks + mitigations

List the architecture risks with probability/impact and a concrete mitigation, and link each to an ADR and/or a fitness test or alert. Typical: no sandbox (build against docs+mocks, gate code), undocumented/stricter rate limits (backoff + caching, confirm at discovery), two-way conflict edge cases (explicit rule + parity tests), on-prem connectivity (VPN/deploy/runbook impact), clock skew (timezone single-source + tolerance).

---

## Outputs of the review

1. `architecture.md` (assembled from `templates/architecture.md`).
2. The first ADRs in `decisions/` (`03-adr-authoring.md`).
3. The fitness-test plan in `architecture-tests/` (`04-fitness-test-planning.md`), gated at G5.
4. Draft integration contracts + draft `data-model.md` handed to Backend (still `draft`).

Hand the packet to the Tech lead for G1.5 approval (CONFIRM / REVISE / REJECT / RENEGOTIATE). You do not approve it.

---

## Anti-patterns

1. **A context diagram without cadence/direction labels** — the labels are the architecture.
2. **Designing around an impossible requirement** (a freshness target the rate limit forbids) instead of routing it back to the PM as an RFC.
3. **Skipping conflict resolution** for a two-way entity because "it'll rarely happen" — name the rule.
4. **No reconciliation** — without an integrity check you can't trust the sync.
5. **Stack choices with no justification** — every non-default layer needs a reason and usually an ADR.
6. **Treating the contracts/model as approved** — they're drafts until the client gates.

---

Last reviewed: 2026-06-30 (initial Node.js build)
Next review due: 2026-09-30
