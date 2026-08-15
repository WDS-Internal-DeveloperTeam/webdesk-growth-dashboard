---
tier: 2
load_when: ["qa-active", "g4", "g5", "bug-management"]
description: P1–P4 severity definitions, warranty SLAs, and classification rules — aligned to _contracts/bug-tracker.schema.json. Examples are sync/API/webhook oriented.
---

# Bug Severity Matrix

> Severity is P1–P4 exactly as defined in `_contracts/bug-tracker.schema.json` — this file is the human-readable companion, not a second source of truth. If they ever disagree, the schema wins. Classify by **impact**, not by how loud the reporter is. No inflation (to get attention), no deflation (to ship a clean-looking sprint).

---

## The matrix

| Sev    | Definition                                                                                                                                                                   | Warranty SLA         | Blocks launch?                     |
| ------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------- | ---------------------------------- |
| **P1** | Critical — **sync halted / data corruption / dashboard down / auth bypass**. The system is producing wrong data or not running.                                              | **4 business hours** | Yes — cannot G6 with an open P1    |
| **P2** | Significant — a sync entity broken, an endpoint failing, a webhook dropping events, a security weakness short of bypass. Workaround may exist but core function is impaired. | **1 business day**   | Yes — cannot PASS G4/G5, cannot G6 |
| **P3** | Minor — cosmetic dashboard issue, non-blocking log noise, an edge case with negligible impact.                                                                               | **3 business days**  | No — PASS_WITH_FLAGS allowed       |
| **P4** | Nice-to-have — polish, copy, a low-value enhancement surfaced as a bug.                                                                                                      | Best effort          | No                                 |

These SLAs match the `severity` enum description in `bug-tracker.schema.json`. They are warranty-period response targets; "4 business hours" is computed against the project timezone (Settings → Timezone), like every other operational clock.

---

## P1 — examples (sync/API oriented)

- **Duplicate webhook processed twice** → an order synced to the ERP twice (financial impact). `category: webhook`.
- **Watermark advanced before commit** → a mid-run crash skipped a batch; inventory now wrong on the store. `category: sync-engine / data-integrity`.
- **BOLA / object-level authz hole** → a user reads another tenant's data by guessing an id. `category: auth-rbac / security`.
- **Overlapping cron runs stacked** → two inventory syncs ran concurrently and double-applied deltas. `category: sync-engine`.
- **Dashboard down / login broken** → operators can't run or monitor syncs. `category: dashboard-ui / auth-rbac`.
- **Secret leaked** → an API key/token committed or logged. `category: security`.

A P1 stops the line. It is fixed and **VERIFIED** before the gate passes; there is no "ship and patch".

## P2 — examples

- **One sync entity broken** — pricing sync errors out while items/inventory still work. `category: sync-engine`.
- **An endpoint returns the wrong status code / shape** that a consumer depends on. `category: api-contract`.
- **Webhook drops events under retry** (idempotency works but a race loses one). `category: webhook`.
- **Rate-limit handling missing** — the integration gets 429-throttled and gives up instead of backing off. `category: performance / integration`.
- **Reconciliation finds drift** beyond tolerance after a sync window. `category: data-integrity`.

## P3 — examples

- A dashboard column mis-aligns at 768px. `category: dashboard-ui / accessibility`.
- Noisy non-actionable log lines at INFO that should be DEBUG. `category: observability`.
- An error message is unhelpful but the behavior is correct. `category: config / other`.

## P4 — examples

- Wording on an empty-state. `category: dashboard-ui`.
- A "would be nice" filter on the logs screen. `category: dashboard-ui`.

---

## Classification rules

1. **Data wrongness is at least P2, usually P1.** Anything that makes the two systems disagree, duplicates a record, or loses one is data integrity — never P3.
2. **Anything in `affected_systems` involving money** (orders, pricing) escalates a notch — a P2 ordering bug that double-charges becomes P1.
3. **Security findings** map to OWASP-API severity: authz bypass / injection / secret exposure = P1; weak-but-not-exploitable = P2.
4. **Dashboard cosmetics** are P3/P4 unless they block a core action (a broken "retry job" button is P2 — it stops an operator from recovering a sync).
5. **Set `kb_candidate: true`** when the bug is a _pattern_ the system should prevent (e.g. "watermark advanced before commit") so it feeds back into `09-forbidden.md` / the Failure Scenario Library. Note the rule it should inform in `kb_candidate_notes`.
6. **Record `found_at_gate`** (G2/G3/G4/G5/G5.5/G6/post-launch) and the `category` from the schema enum — both drive the Master-dashboard rollup.

---

## What does NOT change severity

- Deadline pressure. A P1 the day before launch is still a P1.
- Who wrote the code. Severity is about impact, not blame.
- Whether a fix is hard. A hard-to-fix P3 is still a P3; an easy P1 is still a P1.

---

## Downgrade discipline

Downgrading an open P1/P2 (to allow a PASS) requires written justification recorded on the bug (`history` note) and is a human decision, not QA's — QA reports the impact; the QA lead/Tech lead may accept a documented exception. Silent downgrade to make a sprint look clean is the single fastest way to erode trust in the severity system. Don't.

---

Last reviewed: 2026-06-30 by Claude (initial Node.js build)
Next review due: 2026-09-30
