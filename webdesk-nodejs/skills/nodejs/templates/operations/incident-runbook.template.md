---
tier: 2
load_when: ["monitoring", "observability", "g5_5", "launch", "delivery-head-active"]
description: "Fill-in incident runbook for a middleware incident (sync stalled, store API down). Severity classes, triage, comms, mitigation, postmortem."
---

# Incident Runbook — [FILL IN: project / client name]

**System:** ERP ↔ store middleware (sync_state, watermarks, DLQ, crons, per-tenant)
**On-call:** [FILL IN: rotation / contact] **Escalation:** [FILL IN: tech lead, delivery head]
**Dashboards:** [FILL IN: links — sync health, DLQ depth, cron status]

## When to use this

Use this when middleware sync is degraded or down for one or more tenants:
sync stalled, store API returning errors, ERP unreachable, DLQ filling, a cron
not firing, or a tenant reporting stale/incorrect data. For a specific failure
class, jump to the focused runbook (queue-recovery, webhook-replay, db-restore,
deploy-recovery) and use this one to frame severity, comms, and postmortem.

## Severity classes

| Sev       | Definition                                                          | Example                                                                    |
| --------- | ------------------------------------------------------------------- | -------------------------------------------------------------------------- |
| **SEV-1** | Data corruption or cross-tenant leak; multiple tenants down         | Wrong tenant's inventory pushed to a store; all syncs failing              |
| **SEV-2** | One tenant's sync down, or store/ERP integration fully unavailable  | Store API 5xx for hours; a tenant's cron not firing; DLQ growing unbounded |
| **SEV-3** | Degraded but flowing; elevated retries/latency; single entity stale | Inventory lagging cadence; intermittent ERP timeouts                       |
| **SEV-4** | Cosmetic / no customer impact                                       | Dashboard widget mislabeled                                                |

Default to the **higher** severity when unsure. Any suspected cross-tenant leak
(NODE-104) is **SEV-1** until proven otherwise.

## Steps

1. **Detect & acknowledge.** Confirm the alert in [FILL IN: alerting tool].
   Note time (UTC), affected tenant(s), and entity(ies). Acknowledge so the page
   stops escalating.
2. **Scope blast radius.** Is it one tenant or many? One entity or all? Check the
   sync-health dashboard: last successful run per `(tenant_id, entity)`,
   `sync_state.updated_at` staleness, DLQ depth, cron last-fire times.
3. **Classify severity** from the table. Declare it explicitly in the incident
   channel.
4. **Open comms.** Create the incident channel [FILL IN: channel/ticket]. Post:
   severity, affected tenants, suspected cause, current impact, next update time.
   For SEV-1/SEV-2 notify [FILL IN: delivery head + client contact per the comms
   plan]. Designate an **incident lead** and a **scribe**.
5. **Triage root cause.** Work outward from the symptom:
   - Store API down → check store status page + recent `IntegrationError` logs.
   - ERP unreachable → adapter `healthCheck`, auth/token expiry, VPN/credential.
   - Sync stalled → is the cron firing? is a run stuck/overlapping? (→ queue-recovery)
   - Watermark gap / stale data → `sync_state.watermark` per entity (→ db-restore reconciliation if needed).
   - After a deploy → suspect the release first (→ deploy-recovery).
6. **Mitigate (stop the bleeding before fixing root cause).** Options:
   - **Pause the affected cron(s)** for the affected tenant/entity so a broken run
     stops re-corrupting state (set the schedule disabled / feature flag).
   - For SEV-1 suspected leak: **halt all pushes** to externals immediately; do not
     let bad data propagate.
   - Fail over / circuit-break the failing integration so healthy tenants keep
     flowing (overlap_policy `skip-if-running` should already prevent stacking).
7. **Resolve.** Apply the fix (rollback, config change, contract/token rotation,
   DLQ replay). Re-enable crons **only after** verification (next section).
8. **Stand down.** Post the all-clear with final impact summary and confirm with
   the client contact for SEV-1/SEV-2.

## Verification

- Last successful sync per affected `(tenant_id, entity)` is **recent** and
  `sync_state.updated_at` is advancing again.
- DLQ depth is **draining**, not growing; no new entries for the incident cause.
- Reconciliation parity check passes for affected entities (counts/checksums
  match between ERP and store).
- **No cross-tenant contamination:** spot-check that affected tenants' data is
  their own (NODE-104).
- Error rate / latency back to baseline on the dashboard.

## If this doesn't work / escalate

- Cannot identify root cause within [FILL IN: e.g. 30 min] for SEV-1/SEV-2 →
  escalate to [FILL IN: tech lead], then [FILL IN: delivery head].
- Suspected data corruption that DLQ replay won't fix → go to **db-restore**.
- Caused by a bad release → go to **deploy-recovery**.
- Vendor outage (store/ERP) with no workaround → open a vendor ticket, post the
  vendor incident link, keep affected crons paused, update the client per the
  comms cadence.

## Postmortem

Within [FILL IN: 48h] of resolution, write a blameless postmortem:
timeline (UTC), detection gap, root cause, blast radius (which tenants/entities),
what mitigated it, and **action items** (with owners) — especially any missing
alert, missing fitness test, or missing runbook step this incident revealed.
Link the postmortem from the incident ticket.

Last reviewed: 2026-06-30 by Claude (initial build)
