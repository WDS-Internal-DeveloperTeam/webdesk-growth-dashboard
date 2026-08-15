---
tier: 2
load_when:
  [
    "monitoring",
    "observability",
    "g5_5",
    "integration-work",
    "integration-bigcommerce-active",
    "integration-shopify-active",
  ]
description: "Fill-in webhook-replay runbook: missed/failed store webhooks, re-fetch & replay, idempotency + dedupe window, parity verification."
---

# Webhook Replay Runbook — [FILL IN: project / client name]

**Store:** [FILL IN: BigCommerce | Shopify] **Webhook topics:** [FILL IN: orders/create, …]
**Dedupe store:** [FILL IN: idempotency table/repo] **Reconciliation cron:** [FILL IN: schedule]

## When to use this

Use this when store webhooks were **missed or failed**: the middleware was down /
deploying during delivery, the store reported delivery failures, signature
verification rejected a batch (secret rotation), or reconciliation shows the store
has events the middleware never processed (e.g. orders missing for a window). The
cron reconciliation is the safety net, but replay closes the gap faster and with
exact parity.

> **Idempotency guarantee:** webhook handlers dedupe on the store's stable event
> id and upsert by `externalId` (NODE-102). Re-delivering or re-fetching the same
> event is processed **exactly once**, so replay can't double-create orders or
> double-decrement inventory. This is what makes re-fetch-and-replay safe.

## Steps

1. **Identify the gap window.** Determine the start/end (UTC) of missed delivery:
   deploy/downtime window, or the period reconciliation flagged. Note affected
   `tenant_id`(s) and topic(s).
2. **Decide replay source:**
   - **Store redelivery** (preferred if available) — ask the store to resend
     webhooks for the window: [FILL IN: store admin / API redelivery steps].
   - **Re-fetch from the store API** — pull the affected records directly (e.g.
     orders modified within the window) via the adapter and run them through the
     same processing path: [FILL IN: endpoint/query].
3. **Confirm the dedupe window covers the replay.** The idempotency store must
   still hold (or correctly not hold) the event ids for the window so genuine
   duplicates are skipped and genuine misses are processed. Dedupe retention:
   [FILL IN: e.g. 30 days]. If the window predates retention, rely on
   upsert-by-externalId (still idempotent) and verify by parity afterward.
4. **Replay in bounded batches**, oldest-first, scoped to one tenant/entity at a
   time (NODE-104). Each event runs through the normal handler → service path so
   HMAC verification, validation, and dedupe all apply.
5. **Watch processing:** new vs. duplicate counts (duplicates are expected and
   harmless), no `ValidationError` spikes, DLQ not growing.

## Verification

- **Parity:** record counts for the window match between store and middleware
  (e.g. orders created in the window present in our DB, same totals). Run the
  reconciliation/checksum pass for the affected entity.
- Dedupe behaved: replayed-but-already-processed events were **skipped** (logged
  as duplicate), not re-applied.
- `sync_state` / watermark for the entity reflects the replayed window; next
  incremental run starts cleanly after it.
- No inventory/order double-application (spot-check a few replayed records).
- Affected tenant's dashboard shows the previously-missing records.

## If this doesn't work / escalate

- Store cannot redeliver and the window predates its retention → full
  re-fetch-and-upsert for the window; if records are genuinely gone upstream,
  escalate to [FILL IN: PM + client] — this is a data-source decision, not a
  middleware fix.
- Signatures still fail after replay → webhook secret mismatch; rotate/sync the
  secret ([FILL IN: where STORE_WEBHOOK_SECRET lives) and replay again. Never
  disable signature verification to "get it through" (NODE-005).
- Parity still off after replay → corruption suspected; go to **db-restore** +
  reconciliation and re-open the incident.

Last reviewed: 2026-06-30 by Claude (initial build)
