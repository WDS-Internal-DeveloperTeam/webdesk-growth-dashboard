---
tier: 2
load_when: ["integration-work", "sync-engine", "planning", "g1_5"]
description: "Failure Scenario Library — catalog of sync/integration failure modes and their handling. Pre-flight rule: list in-scope failures before integration code."
---

# Intelligence — Failure Scenario Library

> The catalog of failure modes a sync/integration must handle, with the standard handling for each (blueprint §10, #19). **Pre-flight rule:** before writing any integration code, the Backend role lists which of these are in-scope for the entity and states the handling for each. The chaos suite (`testing/02`) verifies them.

---

## The catalog

| #   | Failure mode                              | What happens                                                     | Standard handling                                                                                                                              |
| --- | ----------------------------------------- | ---------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------- |
| 1   | **API timeout / hang**                    | upstream doesn't respond                                         | per-call timeout; async (don't block the loop, NODE-009); retry with backoff → DLQ; map to **504** if it's a request path (`api-design`)       |
| 2   | **Duplicate webhook / re-delivery**       | same event twice (at-least-once)                                 | idempotent upsert keyed on external id (NODE-102); event-id dedupe; replay protection (`security/04`)                                          |
| 3   | **Partial / interrupted sync**            | run dies mid-way                                                 | watermark only advances past durably-persisted records → next tick resumes the tail exactly once (`integration/01`)                            |
| 4   | **Overlapping sync runs**                 | a slow run still going when the next tick fires                  | per-entity lock / job dedupe → next tick skips or coalesces, never runs concurrently (`integration/02`)                                        |
| 5   | **Rate limit (429)**                      | upstream throttles us                                            | proactive token-bucket throttle; honor `Retry-After`; backoff+jitter; circuit-break on sustained (`integration/03`)                            |
| 6   | **Token / credential expiry**             | auth fails mid-sync                                              | detect 401, refresh the token (rotation), retry once; alert if refresh fails; tokens stored encrypted (NODE-103)                               |
| 7   | **Ordering**                              | dependent arrives before its parent (order before customer)      | sync dependency first, or tolerate missing parent + reconcile; deterministic per-key ordering where required (`integration/02`)                |
| 8   | **Clock skew**                            | upstream timestamps disagree with ours                           | don't trust upstream clock blindly for last-write-wins; use server time or signed timestamps; tolerant watermark comparison (`integration/01`) |
| 9   | **Watermark gap**                         | a change is missed (no `updated_at` bump, or advanced too early) | advance watermark only after persistence; periodic **reconciliation** heals drift (`integration/01`); drift metric alerts (`integration/04`)   |
| 10  | **Malformed / partial upstream response** | ERP/store returns unexpected shape                               | validate external responses as untrusted (NODE-005); quarantine the bad record (DLQ), don't corrupt the batch                                  |
| 11  | **Upstream down (sustained 5xx)**         | provider outage                                                  | circuit opens, fail fast, defer the entity (watermark catches up on return); alert; map to **502/503** in request path                         |
| 12  | **Conflict (two-way)**                    | both sides changed the same record                               | apply the contract's conflict rule (source-of-truth / LWW / review queue); never silently drop data (`integration/01`)                         |
| 13  | **DB connection drop / pool exhaustion**  | write fails mid-tx                                               | transaction rolls back (no partial write); reconnect; the record retries next tick                                                             |
| 14  | **Queue/Redis unavailable**               | jobs can't enqueue/process                                       | degrade gracefully; don't lose work; recover and drain when it returns; alert on backlog (`integration/04`)                                    |

---

## The pre-flight rule (blueprint §10 #19)

Before integration code for an entity, write down (in the integration contract / PR description) the in-scope rows from this table and the concrete handling. This turns "did we think about duplicate webhooks?" from a hope into a checklist item the gate can verify.

> **No silent data loss** is the cardinal rule across every row: each failure either recovers or surfaces (DLQ + alert). None corrupts sync state quietly (NODE-006). If a failure mode here isn't handled, it's a Code Review block, not a known-gap.

---

## Links

Handling details: `integration/01` (sync/watermark/reconcile), `02` (queue/retry/DLQ/lock), `03` (rate limit/backoff/circuit), `04` (alerts). Verification: `testing/02` (chaos matrix). The DDI Inform pilot fires #1, #3, #4, #5, #6, #9 by design (poll-based ERP) — list them at discovery.
