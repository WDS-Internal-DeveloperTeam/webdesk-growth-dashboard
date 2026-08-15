---
tier: 2
load_when: ["code-production", "integration-work", "observability", "sync-engine"]
description: "Observability for the sync engine — logs, metrics, tracing, queue visibility. Feeds the G5.5 gate."
---

# Integration 04 — Observability

> You cannot operate a continuous sync you can't see. This is the observability the sync engine must emit; it's the substance of the **G5.5 gate** (logs/metrics/tracing/alerts/dashboards/queue-visibility/SLO-SLA, blueprint §13) and feeds the master dashboard health rollup (§14).

---

## Structured logging

- **`pino`** structured JSON logs, one line per event, with a **correlation id** that threads request → service → repository → outbound call, and a **sync-run id** for each tick.
- Every log carries context: `tenantId`, `entity`, `syncRunId`, `attempt`. **Never** PII or secrets in logs (redaction — `security/03`, `05`).
- **Displayed timestamps in the configured timezone**, stored in UTC (blueprint §6) — "last synced at" must read in the client's clock.
- Levels used correctly: `error` for failures that need attention, `warn` for handled-but-notable (a retry, a conflict), `info` for run boundaries, `debug` off in prod.

---

## Metrics (the sync engine's vital signs)

Emit (Prometheus-style counters/gauges/histograms, or the platform's metrics):

| Metric                                  | Why it matters                                                 |
| --------------------------------------- | -------------------------------------------------------------- |
| `sync_run_total{entity,status}`         | throughput + success/fail rate per entity                      |
| `sync_run_duration_seconds`             | is a run outgrowing its interval? (overlap risk)               |
| `sync_records_processed/skipped/failed` | volume + error rate                                            |
| `sync_watermark_lag_seconds`            | how far behind real-time the sync is — the key freshness SLI   |
| `reconciliation_drift_count`            | divergence between source and target (should trend to 0)       |
| `queue_depth`, `queue_oldest_age`       | backlog building up                                            |
| `dlq_size`                              | failed jobs awaiting attention — alert on any sustained growth |
| `upstream_429_total`, `circuit_state`   | rate-limit pressure / upstream health (`integration/03`)       |
| `job_retries_total`                     | hidden instability even when runs "succeed"                    |

---

## Tracing

- Distributed tracing (OpenTelemetry) across the chain: inbound request / cron tick → service → ERP/store call → DB write. A trace shows _where_ a slow or failed sync spent its time (the upstream? the DB? our mapping?).
- Propagate the trace/correlation id into outbound calls where the provider supports it, and always into our own logs.

---

## Queue visibility

- The dashboard surfaces **queue depth, in-flight jobs, retry counts, and the DLQ** (contents + replay action) — operators must see and act on stuck work (queue-recovery / webhook-replay runbooks, blueprint §13).
- Per-entity **sync status**: last run, last success, watermark lag, current lock state — so "is the sync healthy?" is answerable at a glance.

---

## Alerts & SLO/SLA

Define and alert on the SLIs (capacity profile from G5 load tests sets the thresholds):

- **Freshness SLO:** watermark lag under a threshold per entity (e.g. inventory < 20 min). Alert when breached.
- **Success SLO:** sync success rate over a window.
- **DLQ alert:** any non-trivial DLQ growth pages someone.
- **Stalled-scheduler alert:** `now - last_run_at > expected_interval` (cron stopped firing).
- **Reconciliation-drift alert:** drift count rising instead of healing.
- **Circuit-open alert:** an upstream sustained-down.

Alerts route to the on-call path; the **incident runbook** (blueprint §13) says what to do for each.

---

## Master dashboard rollup (§14)

Per-instance: sync status, watermark lag, DLQ size, error/alert count, and the **Project Health Score** — aggregated server-side and surfaced cross-tenant on the master dashboard for retainer monitoring (`frontend/02`). This is where the observability data becomes the retainer's at-a-glance health view.

---

## G5.5 checklist

- [ ] Structured logs with correlation + sync-run id; tz-aware display; no PII/secrets
- [ ] Metrics: run rate/duration, watermark lag, drift, queue depth, DLQ size, retries, 429/circuit
- [ ] Tracing across request/tick → upstream → DB
- [ ] Dashboard queue + DLQ visibility with replay
- [ ] Alerts on freshness, success rate, DLQ, stalled scheduler, drift, circuit-open
- [ ] SLO/SLA defined from the load/capacity profile
- [ ] Runbooks present for each alert (G5.5 requires runbooks)
