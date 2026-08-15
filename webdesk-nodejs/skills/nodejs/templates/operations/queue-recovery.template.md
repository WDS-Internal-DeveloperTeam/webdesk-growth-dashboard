---
tier: 2
load_when: ["monitoring", "observability", "g5_5", "sync-engine", "integration-work"]
description: "Fill-in queue-recovery runbook: DLQ inspection, safe replay (idempotency makes replay safe), draining backlog, stuck/overlapping jobs, when to pause crons."
---

# Queue Recovery Runbook — [FILL IN: project / client name]

**Queue runtime:** [FILL IN: node-cron | BullMQ + Redis] **Redis:** [FILL IN: REDIS_URL host]
**DLQ:** [FILL IN: queue/table name] **Dashboard:** [FILL IN: queue depth + DLQ link]

## When to use this

Use this when the job/queue layer is unhealthy: the **DLQ is filling**, a backlog
is growing faster than it drains, a **job is stuck** (running far past its
expected duration), runs are **overlapping** despite `skip-if-running`, or you
need to **replay dead-lettered jobs** after fixing their root cause. It pairs with
the incident runbook (use that to frame severity/comms).

> **Why replay is safe here:** every sync/push handler is idempotent (NODE-102) —
> pulls upsert by `externalId`, pushes dedupe on the idempotency key. Re-running a
> dead-lettered job re-applies the same effect at most once. That is what makes
> the steps below safe to repeat; if a handler were NOT idempotent, stop and fix
> that first.

## Steps

### A. Inspect the DLQ

1. List DLQ entries with their failure reason and original payload:
   [FILL IN: command/dashboard]. Group by failure mode (api-timeout, rate-limit,
   upstream-5xx, schema-drift, validation).
2. Confirm the **root cause is resolved** before replaying — otherwise items will
   just dead-letter again (replay storm). If the cause is still live, keep crons
   paused (section D) and resolve the cause first.
3. Note the affected `tenant_id`(s) and entity(ies); scope every replay to them —
   never blind-replay the whole DLQ across tenants (NODE-104).

### B. Replay dead-lettered jobs safely

4. Replay a **small batch first** ([FILL IN: e.g. 10 jobs]) for one tenant/entity.
   Idempotency guarantees no double-apply, but a small batch limits blast radius
   if the fix was incomplete.
5. Watch that batch land: success rate, no new DLQ entries, parity moving toward
   correct. Then replay the remainder in bounded batches.
6. For each replayed job, the handler must re-check its idempotency key /
   upsert-by-external-id so re-processing is a no-op where the effect already
   applied.

### C. Drain a backlog

7. If the backlog is large, increase worker concurrency **within** the
   integration contract's rate limits ([FILL IN: requests_per_window]) — do not
   exceed them or you'll trip rate-limit failures (NODE-101 backoff still applies).
8. Drain oldest-first so watermarks advance monotonically and out-of-order
   effects are minimized.
9. Watch queue depth trend down on the dashboard; if it plateaus, a poison
   message is likely re-queuing — pull it to the DLQ and inspect.

### D. Stuck / overlapping jobs & when to pause crons

10. **Stuck job:** identify the run (id, tenant, entity, start time). Confirm it's
    truly hung (no progress in `sync_state.updated_at`), then cancel/kill it. Its
    next cron tick resumes from the persisted watermark — no data lost.
11. **Overlapping runs:** if runs are stacking despite `overlap_policy:
skip-if-running`, a stale lock is the usual cause. Clear the lock
    ([FILL IN: lock key/mechanism]) and confirm only one run per `(tenant,
entity)` proceeds.
12. **Pause crons when:** the upstream (ERP/store) is down, the DLQ is filling
    from an unresolved cause, you're mid-replay, or you're reconciling after a
    restore. Pausing stops broken runs from re-corrupting `sync_state`. Re-enable
    only after verification.

## Verification

- DLQ depth is **0 or steadily draining**; no new entries for the resolved cause.
- Queue depth back to baseline; no job running past its expected duration.
- Exactly one active run per `(tenant_id, entity)` — no overlaps.
- `sync_state.updated_at` advancing for affected tenants/entities.
- Reconciliation/parity check passes for replayed entities.

## If this doesn't work / escalate

- Items keep dead-lettering after replay → root cause not actually fixed; stop,
  re-open the incident, escalate to [FILL IN: backend lead].
- A poison message can't be processed even after the fix → quarantine it
  ([FILL IN: where], capture payload for the postmortem) rather than blocking the
  queue.
- Suspected double-apply / corrupted state from a non-idempotent handler →
  **db-restore** + reconciliation, and file a P1 to fix the handler.

Last reviewed: 2026-06-30 by Claude (initial build)
