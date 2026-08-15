---
tier: 2
load_when: ["qa-active", "g4", "g5", "bug-management"]
description: Bug lifecycle (LOGGED→FIXED→RETESTING→VERIFIED→CLOSED) and the NO-auto-fix separation of duties — QA reports, a human commands the fix, the dev role fixes, Code Review reviews, a human merges, QA verifies.
---

# Bug Lifecycle + No-Auto-Fix

> The lifecycle and required fields are defined by `_contracts/bug-tracker.schema.json`. This file explains the **flow** and the **separation of duties** that the schema encodes. The core rule: **QA never fixes its own findings, and nothing auto-merges.** Each role does one job; a human commands the transitions that matter.

---

## States

```
LOGGED → FIXED → RETESTING → VERIFIED → CLOSED
                                   │
        WONT_FIX ──────────────────┤  (terminal alternatives)
        DUPLICATE ─────────────────┘
```

| State         | Who sets it                               | Required fields (schema-enforced)                   |
| ------------- | ----------------------------------------- | --------------------------------------------------- |
| **LOGGED**    | QA                                        | `id, title, severity, status, logged_by, logged_at` |
| **FIXED**     | Dev role (after a human commands the fix) | + `fixed_by, fixed_at` (commit/PR encouraged)       |
| **RETESTING** | QA (picks the fixed bug back up)          | + `retest_by, retest_started_at`                    |
| **VERIFIED**  | QA                                        | + `verified_by, verified_at` (and `fixed_by/at`)    |
| **CLOSED**    | QA / PM                                   | + `verified_by, verified_at, closed_at`             |
| **WONT_FIX**  | human decision                            | + `wont_fix_reason`                                 |
| **DUPLICATE** | QA                                        | + `duplicate_of`                                    |

Every transition appends to the bug's `history` (`from_status, to_status, transitioned_by, transitioned_at, notes`).

---

## The separation of duties (NO auto-fix)

This is the load-bearing rule. Five distinct steps, with humans at the decision points:

1. **QA reports.** QA finds the bug and logs it (`LOGGED`). QA writes a precise, reproducible report (`templates/bug-report.md`). QA does **not** touch the code.
2. **A human commands the fix.** A developer/lead decides the bug gets fixed now and assigns it. QA does not self-assign fixes; the system does not auto-open a fix.
3. **The dev role fixes.** The Backend/Frontend role implements the fix on a branch and opens a PR → sets `FIXED` with `fixed_by/at` and the PR/commit.
4. **Code Review reviews.** The Code Review agent reviews the PR (and a human senior reviews sensitive paths — auth, payments/PII, sync write-paths, migrations). Code Review does **not** merge.
5. **A human merges.** Merge is a human action behind branch protection. Then QA moves the bug to `RETESTING`, re-runs the failing scenario, and sets `VERIFIED` → `CLOSED` only if the fix works **and** introduces no regression.

> QA → report. Human → command + merge. Dev → fix. Code Review → review. QA → verify. No step is skipped, nothing auto-merges, and the finder never grades their own fix.

---

## Why no auto-fix

- **Verification independence.** The agent that wrote the fix is the worst judge of whether it's correct. QA re-tests from the report, not from the diff.
- **Regression safety.** A "fix" for a P2 webhook race can introduce a P1 ordering bug. The merge-gate + re-run catches that; an auto-merge wouldn't.
- **Sensitive paths.** Auth, payments/PII, sync write-paths, and migrations require senior human review (Code Review `04-sensitive-paths.md`). Auto-fix would route around that.
- **Audit trail.** Every transition is a logged human decision, which is what the warranty SLA and the Master-dashboard rollup are built on.

---

## Retest = re-run the original failure, not just the happy path

When a bug returns from `FIXED`:

- Reproduce the **exact** original scenario (same request, same job-run conditions, same repro steps). If it no longer reproduces → that's necessary, not sufficient.
- Run the **regression neighbors**: the modules adjacent to the change (a sync-engine fix re-runs missed/overlapping/watermark; a webhook fix re-runs idempotency/replay/ordering).
- Only then `VERIFIED`. A bug that "can't be reproduced" without a code change is not VERIFIED — it's `LOGGED` with an investigation note.

---

## Terminal alternatives

- **WONT_FIX** — a human decision with a recorded `wont_fix_reason`; if warranty-eligible, communicated to the client. QA doesn't unilaterally won't-fix its own finding.
- **DUPLICATE** — points at the canonical `duplicate_of`. Fix once, verify once.

---

## Stats + rollup

On every write, recompute `stats` (`total`, `by_status`, `by_severity`, `open_by_severity`) in `bugs.json`. `open_by_severity` (anything not CLOSED/WONT_FIX/DUPLICATE) is what feeds the **Master dashboard** alert rollup and gates: an open P1/P2 blocks PASS at G4/G5 and blocks G6.

---

Last reviewed: 2026-06-30 by Claude (initial Node.js build)
Next review due: 2026-09-30
