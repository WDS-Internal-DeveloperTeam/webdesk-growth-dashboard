---
tier: 2
load_when: ["delivery-head-active", "g5_5", "g6", "monitoring"]
description: The five operations/ runbooks required before G6 — incident-runbooks, queue-recovery, webhook-replay, db-restore, deploy-recovery. What each must contain and the standard runbook shape.
---

# Runbooks

> A runbook is the procedure an on-call human follows at 3am when an alert fires — written _before_ the incident, when nobody is panicking. Five runbooks are **required before G6** and verified present at G5.5. Each lives under `/projects/[client]/operations/<name>/`. Every alert (G5.5 Pillar 4) references one. A runbook that's never been rehearsed is a draft — the deploy/rollback one is rehearsed at the pre-launch dry-run.

---

## Standard runbook shape

Every runbook follows the same structure so it's usable under stress:

```
# Runbook: <name>
Trigger:        which alert / symptom opens this runbook
Severity:       what incident severity this usually maps to
Owner / page:   who is paged
Prerequisites:  access/creds/tools needed (where the secret store is, dashboard links)

## Diagnose
  numbered steps to confirm what's actually happening (which queries, which dashboard panels, which logs by id)

## Mitigate (stop the bleeding)
  the fastest safe action to limit damage (pause the sync, drain/hold the queue, fail over)

## Recover (fix it)
  the steps to restore normal operation

## Verify
  how to confirm recovery (reconciliation clean, queue draining, health check green, SLO back in budget)

## Post-incident
  what to capture, who to notify, whether this becomes a KB candidate / bug
Rollback / escape hatch: if recovery makes it worse, how to back out
```

---

## 1. incident-runbooks (the index + the generic incident flow)

The umbrella: how to declare an incident, severity mapping, who's paged, comms (internal + client), and an index linking to the specific runbooks below. Plus the generic flow for an alert with no specific runbook (diagnose by trace/job-run id → mitigate → escalate). Includes the on-call rotation and the escalation ladder. This is the front door an on-call human opens first.

## 2. queue-recovery

For: queue depth runaway, stuck/stalled jobs, **DLQ filling**, a worker crash-looping.

- **Diagnose:** read queue depth / in-flight / DLQ from the Queue/Jobs surface; identify the failing job class by `job_run_id`; check whether the cause is an upstream outage (then see incident) or a poison message.
- **Mitigate:** pause the affected queue / stop intake so the backlog doesn't grow; isolate the poison message.
- **Recover:** drain the backlog once the cause is fixed; **replay the DLQ** in controlled batches (idempotent writes make this safe); remove/repair poison messages.
- **Verify:** queue depth returns to baseline, DLQ empty, reconciliation clean, no dupes.

## 3. webhook-replay

For: missed/dropped webhooks, a provider outage that buffered deliveries, suspected duplicate processing.

- **Diagnose:** confirm which events are missing (compare provider's delivery log to our processed log by event id); confirm idempotency is on (so replay is safe).
- **Mitigate / Recover:** replay the missing window from the provider or the stored raw-event log; because handlers are HMAC-verified + idempotent, a re-delivery of an already-processed event is a no-op.
- **Verify:** every event in the window is processed exactly once; parity check passes.
- **Guard:** never replay against client production blind — confirm idempotency and the time window first.

## 4. db-restore

For: data corruption, a bad migration in production, accidental deletion, disk/instance failure.

- **Prerequisites:** where backups live, retention/PITR window, restore credentials, the last-known-good timestamp.
- **Diagnose:** confirm the scope (one table? whole DB?) and the last-good point.
- **Mitigate:** stop writes (pause syncs + put the API in maintenance/read-only) so the corruption doesn't spread.
- **Recover:** restore to a point-in-time / from the latest good backup into a staging DB, verify, then cut over.
- **Verify:** integrity + reconciliation against the ERP/store; resume syncs from the correct watermark (re-derive if needed).
- This is the highest-stakes runbook — it pairs with the migrations being reversible (`code-review-agent/04-sensitive-paths.md`).

## 5. deploy-recovery

For: a failed deploy, a failed post-deploy health check, a release that's degrading the SLO.

- Ties directly to the deploy/rollback abstraction (`04-rollback-and-deploy.md`): build → migrate → release → health-check → **rollback**.
- **Diagnose:** which stage failed (build? migrate? health check?).
- **Recover/rollback:** execute the rollback for the target host; if a migration ran, follow the reversible down-path or restore (→ db-restore).
- **Verify:** previous version healthy, health check green, SLO back in budget.
- **Rule:** a failed health check triggers rollback automatically; no wait-and-see. After rollback, the project pauses for human investigation (never auto-resume). **This runbook is rehearsed at the pre-launch dry-run** so rollback is _tested_, not theoretical — a G6 requirement.

---

## Verification at G5.5 / G6

- **G5.5:** all five present, each follows the standard shape, each referenced by its alert.
- **G6:** runbooks **complete** (not stubs); deploy-recovery **rehearsed** (rollback tested on the target host); db-restore prerequisites confirmed (backups exist, restore path known).

Stub runbooks ("TODO: write recovery steps") fail the gate. The test of a runbook is whether a tired human can follow it without the author present.

---

Last reviewed: 2026-06-30 by Claude (initial Node.js build)
Next review due: 2026-09-30
