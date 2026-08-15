---
tier: 2
load_when: ["integration-work", "planning", "g1_5", "g_contracts", "sync-engine"]
description: "Integration Intelligence — sync-pattern selection. Default for ERP/CRM is continuous cron-scheduled sync; webhooks only where the source supports them."
---

# Intelligence — Integration

> Decision-support for choosing the integration pattern (blueprint §10, #18). Feeds architecture (G1.5) and the contract registry (G-Contracts). The default for ERP/CRM is **continuous cron-scheduled sync**.

---

## Pattern selection

| Source capability                                             | Pattern                                                                            | Notes                                                                                                                        |
| ------------------------------------------------------------- | ---------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------- |
| **ERP/CRM (poll-only, partner-gated APIs — the common case)** | **continuous cron-scheduled sync** (default)                                       | pull+push on a per-entity cadence; full-then-incremental; watermarks; reconciliation (`integration/01`). DDI Inform is this. |
| **Store side that supports webhooks** (BigCommerce/Shopify)   | **webhooks** for near-real-time events **+ cron reconciliation** as the safety net | webhooks are at-least-once → idempotent + replay-protected (`security/04`, NODE-102). Never webhook-only; reconcile.         |
| **File/ODBC-only source** (e.g. pc/MRP risk)                  | scheduled file/ODBC pull behind the adapter interface                              | highest risk; confirm at discovery.                                                                                          |

**Verify the source's real capability at discovery (NODE-008)** — don't assume an ERP has webhooks or a usable REST API. Record the chosen pattern + per-entity cadence + direction in the integration contract.

---

## Direction & conflict

- **One-way per entity** by default; **two-way** only where the spec needs it, with **per-field ownership** decided at G-Contracts.
- Two-way needs a **conflict-resolution rule** (source-of-truth-wins / last-write-wins-with-clock-skew-handling / manual review queue) chosen at G1.5 (`integration/01`). Never resolve by silently dropping data.

---

## Queue / runtime

- Default **node-cron**; escalate to **BullMQ + Redis** when concurrency / retries / DLQ are needed (`integration/02`, `technology-selection.md`).
- Mandatory properties regardless: idempotency, capped retries + backoff, DLQ, overlapping-run prevention, timezone-aware scheduling.

---

## The adapter interface (why it matters more than any one ERP)

Every ERP sits behind a common **pull / push / normalize / sync-state** interface (`integrations/erp/_erp-adapter-pattern.md`). The sync engine is written once against that interface; each ERP differs only in its adapter. The ERP roadmap (DDI Inform pilot → Fishbowl, Sage 300/100, NetSuite, Acctivate, pc/MRP — blueprint §16) all plug in the same way. Build the interface right; the DDI specifics are replaceable.

---

## Output

- Chosen pattern, per-entity cadence + direction, conflict rule, queue choice → into the **integration contract** (`integration-contracts/`), **client-approved at G-Contracts**.
- Pair with `failure-scenario-library.md`: before integration code, list the in-scope failure modes and their handling (the pre-flight rule).
