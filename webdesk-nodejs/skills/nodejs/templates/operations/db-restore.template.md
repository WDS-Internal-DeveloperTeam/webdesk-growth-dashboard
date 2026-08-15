---
tier: 2
load_when:
  [
    "monitoring",
    "observability",
    "g5_5",
    "destructive-op",
    "state-mutation",
    "delivery-head-active",
  ]
description: "Fill-in DB restore runbook: backup verification, point-in-time restore, post-restore reconciliation of sync_state + watermarks, validate before resuming crons."
---

# Database Restore Runbook — [FILL IN: project / client name]

**DB:** [FILL IN: Postgres host / managed service] **Backups:** [FILL IN: schedule, retention, PITR window]
**Restore target:** [FILL IN: new instance / in-place] **Approver:** [FILL IN: delivery head — restore is destructive]

> **Restore is destructive and high-stakes.** A restore rolls the database back in
> time; events between the restore point and "now" are lost unless replayed.
> Requires explicit sign-off ([FILL IN: delivery head + client per the comms
> plan]) and a declared incident. Never restore in-place without a fresh backup of
> the current (even if corrupt) state first.

## When to use this

Use this for data loss or corruption that DLQ replay can't fix: a bad migration
that mangled data, corrupted `sync_state`/watermarks causing repeated bad syncs,
accidental deletion, or confirmed cross-tenant contamination (NODE-104). For
missing store events use **webhook-replay** first; for a bad release use
**deploy-recovery** first — restore is the heavier instrument.

## Steps

1. **Declare & freeze.** Open/raise the incident (likely SEV-1). **Pause all
   crons and queue workers** for affected tenants (or globally) so no new writes
   land during/after restore and broken syncs stop compounding the corruption.
2. **Snapshot current state first.** Take a fresh backup of the present database
   _before_ restoring — even if corrupt, it's your only record of events since the
   restore point and may be needed to replay them back in.
3. **Verify the backup you intend to restore.** Confirm it exists, is complete,
   and is **restorable** — check size/checksum and, ideally, restore it to a
   scratch instance and run a smoke query. Never trust an unverified backup.
4. **Choose the restore point.** For point-in-time recovery (PITR), pick the
   timestamp just **before** corruption began ([FILL IN: how to find it — first bad
   migration time, first corrupt write]). Confirm it's inside the PITR window.
5. **Restore.** Execute the restore to [FILL IN: new instance preferred, then cut
   over]:
   [FILL IN: managed-service restore command / pg_restore steps]. Restoring to a
   **new instance** and cutting over is safer than in-place.
6. **Point the app at the restored DB** (update `DATABASE_URL`) but keep crons/
   workers **still paused**.

## Post-restore reconciliation (do NOT skip)

7. **Reset `sync_state` + watermarks deliberately.** The restored `sync_state`
   reflects the restore point, so the next incremental run would start from an old
   watermark and could miss or re-process the gap. For each affected `(tenant_id,
entity)`, decide:
   - Re-pull the gap window (set watermark back to the restore point and let
     incremental sync close the gap — safe because upserts are idempotent), or
   - Force a full re-sync for that entity if the gap is large/uncertain.
8. **Replay events lost since the restore point** where the source still has them:
   re-fetch store webhooks for the window (**webhook-replay**), re-pull ERP changes
   since the watermark. Idempotency makes this safe (NODE-102).
9. **Run reconciliation/parity** for every affected entity: counts + checksums
   between ERP, store, and the restored DB must agree.

## Verification (before resuming crons)

- Backup restored cleanly; row counts for key tables sane vs. expectation.
- `sync_state` watermarks set to the intended re-sync points (not stale).
- Reconciliation parity passes for all affected `(tenant_id, entity)`.
- **No cross-tenant contamination** — affected tenants' data is their own.
- A controlled manual sync for one tenant/entity completes correctly **before**
  re-enabling the full cron schedule.
- Only then: **re-enable crons and queue workers**, staged (one tenant first),
  watching the dashboard.

## If this doesn't work / escalate

- Backup is not restorable / outside PITR window → escalate immediately to
  [FILL IN: DBA + delivery head]; this becomes a data-loss conversation with the
  client.
- Parity still diverges after reconciliation → keep crons paused, escalate to
  [FILL IN: backend lead], investigate per-entity before resuming.
- Restore introduced a schema mismatch with current code → see **deploy-recovery**
  (migration alignment) before resuming.

Last reviewed: 2026-06-30 by Claude (initial build)
