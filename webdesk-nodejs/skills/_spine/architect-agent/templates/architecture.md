---
tier: 2
load_when: ["g1_5", "architect-active"]
description: The architecture.md deliverable template — the G1.5 packet. Copy to <workspace>/architecture.md and fill every section. Approved by the Tech lead at G1.5.
---

# Architecture Template — the G1.5 Packet (Node.js Delivery System)

> Copy to `<workspace>/architecture.md`. This is the G1.5 deliverable, assembled by running `knowledge/01-architecture-review-protocol.md`. It is approved by the **Tech lead** at G1.5 (architect ≠ approver). The integration contracts and data-model it references are **drafts** until G-Contracts / G-Schema. Mark every unverified external-API specific **verify-at-discovery**.

---

# Architecture — [Project Name]

|                         |                                                                            |
| ----------------------- | -------------------------------------------------------------------------- |
| **Project ID**          | [WDS-N-2026-NNN]                                                           |
| **Build context**       | [nodejs+bigcommerce]                                                       |
| **Integration targets** | [erp:ddi-inform, bigcommerce]                                              |
| **Timezone**            | [America/Toronto] · **Tenancy**                                            | [per-client + master] |
| **G1.5 triggers fired** | [>1 external system, new datastore, cron sync, two-way sync, multi-tenant] |
| **Status**              | [proposed → accepted at G1.5] · **Tech lead**                              | [name]                |
| **Date**                | [2026-06-30]                                                               |

---

## 1. Context Diagram (systems + data flows)

> **Replace the systems and entities below with this project's own.** The DDI Inform → BigCommerce flow shown is an **example**, not a required topology — a different project has different systems, directions, and entities.

[Diagram (ASCII / mermaid) of the middleware in its environment. Every data flow labeled with entity + direction + cadence. Show system-of-record per entity, pull/push/webhook, the cloud/on-prem (VPN) boundary, the per-client tenant boundary, and the master oversight plane.]

```
[ DDI Inform (ERP, on-prem/VPN) ] --pull items/inventory/pricing (cron, client tz)--> [ Middleware ]
[ Middleware ] --push catalog/inventory (cron)--> [ BigCommerce ]
[ BigCommerce ] --orders/customers (webhook + scheduled pull)--> [ Middleware ]
[ Middleware ] --> [ PostgreSQL ]   [ Middleware ] --> [ per-client Dashboard ]  [ Master Dashboard ] --oversees--> all instances
```

## 2. Component Breakdown

| Component                 | Responsibility                                                                      | Depends on                          |
| ------------------------- | ----------------------------------------------------------------------------------- | ----------------------------------- |
| controllers               | HTTP only, no business logic                                                        | services                            |
| services                  | business logic                                                                      | repositories, adapters, sync engine |
| repositories              | ALL DB access (no raw queries elsewhere)                                            | models                              |
| integration adapters      | one per system; common pull/push/normalize/sync-state interface                     | — (isolated from each other)        |
| sync engine               | full-then-incremental, watermark/resume, overlap (skip-if-running), reconciliation  | adapters, repositories              |
| scheduler                 | timezone-aware cron from project.json.timezone                                      | sync engine                         |
| queue                     | node-cron now / BullMQ+Redis when concurrency/retries/DLQ needed                    | —                                   |
| auth + tenancy middleware | JWT (access+refresh, rotation, revocation), per-module VED RBAC, per-tenant scoping | repositories                        |

[State the dependency direction explicitly; this is what the fitness tests enforce.]

## 3. Chosen Stack + Justification

| Layer             | Choice                     | Justification                              | ADR                  | Approved at |
| ----------------- | -------------------------- | ------------------------------------------ | -------------------- | ----------- |
| Runtime/framework | Node 22 / Express          | default                                    | —                    | —           |
| DB / ORM          | PostgreSQL / Sequelize     | default; transactions for multi-write sync | [ADR if deviation]   | G-Schema    |
| Queue/scheduler   | [node-cron / BullMQ+Redis] | [why]                                      | ADR-000X             | G1.5        |
| Storage           | [s3/none]                  | [why]                                      | —                    | —           |
| Frontend          | [React/Next/none]          | [HTML-mockup-first if UI]                  | —                    | G2          |
| Host              | [target]                   | [local-first; VPN note if on-prem ERP]     | [ADR if non-trivial] | G1.5        |

## 4. Integration Contracts (draft — client-approved at G-Contracts)

[Per system, summarize and link the draft contract (`integration-contracts/<system>.md`, validates against integration-contract.schema.json): entities + direction + system-of-record, conflict rule, auth + credential location + rate limits (mark unverified), sync pattern + per-entity cadence, idempotency, in-scope failure modes + handling. status: draft.]

## 5. Data-Flow + Sync Strategy

| Entity    | Direction | Cadence (client tz)  | First run | Conflict rule      | Idempotency key       | Reconciliation   |
| --------- | --------- | -------------------- | --------- | ------------------ | --------------------- | ---------------- |
| inventory | Inform→BC | [q15m business hrs]  | full      | n/a (one-way)      | [sku]                 | [count/checksum] |
| pricing   | both      | [4h]                 | full      | [source-of-record] | [sku+source]          | [parity test]    |
| orders    | BC→Inform | [webhook + 1h sweep] | n/a       | n/a                | [order id + event id] | [count]          |

[Note overlap policy (skip-if-running), watermark/resume behavior, and what a reconciliation mismatch triggers.]

## 6. Non-Functional Requirements

- **Throughput/latency:** [full catalog sync of N SKUs within M min; incremental within X] → capacity profile feeds SLO/SLA at G5.
- **Security:** JWT; secrets in [vault/env, rotation]; per-tenant authz; OWASP-API baseline; data sensitivity = [level].
- **Compliance:** [PII handling / region constraints / none].
- **Availability/resilience:** [ERP/store-down handling: 502/503/504, backoff, queue behavior, alerting].

## 7. Risks + Mitigations

| ID  | Risk                                                 | Prob | Impact | Mitigation                                            | Enforced by  |
| --- | ---------------------------------------------------- | ---- | ------ | ----------------------------------------------------- | ------------ |
| AR1 | No DDI sandbox at start                              | Med  | High   | build vs docs+mocks; gate integration code on sandbox | gate + test  |
| AR2 | Inform rate limit stricter than assumed (unverified) | Med  | Med    | backoff + caching; confirm at discovery               | ADR + alert  |
| AR3 | Two-way pricing conflict edge cases                  | Med  | High   | explicit source-of-record rule; parity tests          | fitness test |
| AR4 | On-prem ERP connectivity (VPN)                       | Med  | Med    | VPN in deploy/runbook design                          | runbook      |

## 8. ADRs Produced

[List with one-line summary + link: `decisions/ADR-0001 …`. Each load-bearing decision (sync pattern, queue, conflict resolution, datastore, caching, tenancy, idempotency, scheduler timezone) gets one; each ties to a fitness test.]

## 9. Fitness-Test Plan

[Link `architecture-tests/_plan.md`. Summary table: boundary enforcement, no-DB-outside-repos, API-version enforcement, queue retry caps, module/tenancy boundaries — tool + ADR + gated at G5.]

## 10. Handoff to Backend

- Draft `data-model.md` (→ G-Schema): [link]
- Draft integration contracts (→ G-Contracts): [links]
- Fitness-test plan to implement in CI at scaffold (G3): [link]
- Open / unverified items the build must resolve (sandbox access, rate limits): [list]

---

> Approval: this packet is reviewed by the Tech lead at **G1.5** (CONFIRM / REVISE / REJECT / RENEGOTIATE). The architect does not approve it. The contracts and data-model remain `draft` until the client approves them at G-Contracts / G-Schema.

Last reviewed: 2026-06-30 (initial Node.js build)
