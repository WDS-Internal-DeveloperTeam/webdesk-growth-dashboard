---
tier: 2
load_when: ["qa-active", "bug-management"]
description: "Output template."
---

# Bug Report Template

> Every bug is stored in `/projects/[client]/qa-reports/bugs.json` and must validate against `_contracts/bug-tracker.schema.json`. This template is the authoring guide for one bug entry. IDs are `BUG-0001` (4+ digits, sequential, never reused). Severity P1–P4 per `02-bug-severity-matrix.md`. Categories are the Node/API/sync enum from the schema.

---

## Bug entry (JSON, validates against bug-tracker.schema.json)

```json
{
  "id": "BUG-0042",
  "title": "Inventory sync watermark gap after mid-run crash",
  "description": "On a SIGKILL during the inventory sync, the worker advanced the watermark before the batch committed, so the next run skipped ~30 SKUs. They remain stale on BigCommerce.",
  "severity": "P1",
  "status": "LOGGED",
  "category": "sync-engine",
  "affected_systems": ["erp:ddi-inform", "bigcommerce"],
  "affected_paths": ["src/services/inventory-sync-service.js", "job:inventory-sync"],
  "affected_entities": ["inventory"],
  "log_refs": ["job-run:8842", "trace:8f3a...e1"],
  "repro_steps": [
    "Seed mock ERP with 200 inventory deltas",
    "Start the inventory-sync job",
    "SIGKILL the worker ~halfway through the run",
    "Restart the worker and let the next scheduled run complete",
    "Reconcile inventory counts between ERP mock and BigCommerce sandbox"
  ],
  "expected": "On restart the job resumes from the last committed watermark; every delta is applied exactly once; reconciliation shows parity.",
  "actual": "~30 SKUs are skipped because the watermark advanced before the batch committed; reconciliation shows 30 stale SKUs on BigCommerce.",
  "logged_by": "qa-agent",
  "logged_at": "2026-07-14T09:12:00Z",
  "milestone": "M2",
  "sprint": "S2.3",
  "found_at_gate": "G5",
  "kb_candidate": true,
  "kb_candidate_notes": "Add a rule: watermark advances ONLY after batch commit. Feeds Failure Scenario Library + 09-forbidden.md.",
  "history": [
    {
      "from_status": "",
      "to_status": "LOGGED",
      "transitioned_by": "qa-agent",
      "transitioned_at": "2026-07-14T09:12:00Z",
      "notes": "Found in M2 chaos run (process-kill mid-sync)."
    }
  ]
}
```

---

## Required fields at creation (schema-enforced)

`id`, `title`, `severity`, `status` (`LOGGED`), `logged_by`, `logged_at`. Beyond the minimum, always populate for a usable report:

```
[X] description            (what's wrong, when, impact)
[X] category               (schema enum: api-contract | sync-engine | integration | webhook |
                            data-integrity | auth-rbac | performance | security | observability |
                            migration | dashboard-ui | accessibility | config | other)
[X] affected_systems       (integration_targets touched)
[X] affected_paths         (files / routes / job names)
[X] repro_steps            (≥ 2, specific)
[X] expected / actual
[X] log_refs               (trace/request/job-run IDs — what pins it down)
[X] found_at_gate, sprint, milestone
```

For `dashboard-ui` bugs also set `affected_viewports` (`mobile-375 | mobile-414 | tablet-768 | desktop-1280 | desktop-1920`). For sync/integration bugs set `affected_entities` (`items | inventory | orders | customers | pricing | categories | shipments | other`).

---

## Title conventions

Specific enough to identify the bug without the description.

Good:

- "Duplicate BigCommerce order webhook processed twice → order synced to ERP twice"
- "Overlapping inventory cron runs double-applied deltas (no single-flight lock)"
- "GET /api/items wraps array as {data,page} but spec declares bare array"
- "BOLA: GET /api/users/:id returns other tenants' users by guessed id"

Bad:

- "Sync broken" / "Bug in webhook" / "Doesn't work" — useless.

---

## Log refs are mandatory for API/sync bugs

A sync/API bug without a `trace`, `request`, or `job-run` id is hard to fix. Pin the occurrence: the request id, the trace id, the job-run id, or a log query link. For a contract failure, attach the failing request **and** response. Without something a dev can pull up, the bug goes back for evidence before triage.

---

## Severity (quick reference — full matrix in 02-bug-severity-matrix.md)

- **P1** — sync halted / data corruption / dashboard down / auth bypass. SLA 4 business hrs. Blocks launch.
- **P2** — a sync entity broken / an endpoint failing / webhook dropping. SLA 1 business day. Blocks PASS.
- **P3** — minor / cosmetic / log noise. SLA 3 business days. PASS_WITH_FLAGS ok.
- **P4** — nice-to-have. Best effort.

No inflation, no deflation.

---

## Lifecycle (full detail in 03-bug-lifecycle.md)

`LOGGED → FIXED → RETESTING → VERIFIED → CLOSED` (with `WONT_FIX` / `DUPLICATE` terminal). QA logs and verifies; a human commands the fix and merges; the dev role fixes; Code Review reviews. **No auto-fix.** Every transition appends to `history`. Recompute `stats` on every write.

---

## Anti-patterns

1. Vague title or no repro steps.
2. No `log_refs` on an API/sync bug.
3. Severity inflation/deflation.
4. Missing `category` (drives the Master-dashboard rollup).
5. Multiple unrelated issues in one entry — one bug per entry.
6. Marking VERIFIED without re-running the original failing scenario.

---

Last reviewed: 2026-06-30 by Claude (initial Node.js build)
Next review due: 2026-09-30
