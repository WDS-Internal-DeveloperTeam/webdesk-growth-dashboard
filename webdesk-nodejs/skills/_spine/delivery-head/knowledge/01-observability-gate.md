---
tier: 2
load_when: ["delivery-head-active", "g5_5", "observability"]
description: The G5.5 observability gate — the seven pillars (logs, metrics, tracing, alerts, dashboards, queue visibility, SLO/SLA) plus runbooks-present, each defined with what "wired" means and where the evidence lives. Required before G6.
---

# G5.5 — Observability Gate

> You cannot operate what you cannot see. G5.5 is the gate that proves the middleware is observable **before** it goes live — because a cron-sync engine that fails silently at 2am is worthless. CONFIRM requires every pillar **present and wired**, the SLO/SLA traced to QA's capacity profile, and the five runbooks present. Missing any one blocks G6. Evidence lives under `/projects/[client]/observability/`. The Delivery Head verifies; Delivery head + Tech lead approve (no self-approval).

The observability _tooling_ is target-aware (CloudWatch on AWS, GCP Ops on GCP, self-hosted Prometheus/Grafana/Loki/Tempo on a VPS) — the **checklist below is constant**; only the implementation differs. Record the chosen stack in the spec + runbooks.

---

## Pillar 1 — Logs

- **Structured** (JSON), not free-text. Each line carries `request_id` / `trace_id` and, for jobs, `job_run_id` and `tenant_id`.
- Correlatable: a webhook → its processing → the resulting sync write share an id you can grep/query.
- **No secrets in logs** (verified — a secret in a log is a P1).
- Levels sane: errors thrown + logged at the boundary, not `console.log`. Activity-log entries (the dashboard's Activity Logs) come from the same trail.
- **Wired** = you can pull the full story of one failed sync run by its `job_run_id` in the log backend.

## Pillar 2 — Metrics

- **API: RED** — Rate, Errors, Duration per endpoint (p50/p95/p99).
- **Sync engine:** job throughput, job duration, success/fail counts per entity, **queue depth**, in-flight, **DLQ size**, retry counts.
- **Business/freshness:** last-successful-sync-per-entity, sync-lag (now − last watermark), reconciliation drift count.
- **Host:** CPU, memory, DB connection-pool usage (the soak test said which saturates first — instrument it).
- **Wired** = these emit to the metrics backend and back the dashboard panels below.

## Pillar 3 — Tracing

- Distributed tracing (OpenTelemetry) across request → service → repository → external call, and across job → batch → external write.
- A trace shows where time goes and where an error originated (the ERP call? the DB? our code?).
- **Wired** = a sampled trace is viewable end-to-end for both an API request and a sync job.

## Pillar 4 — Alert rules

- Tied to the **SLOs / error-budget** from the capacity profile — not arbitrary thresholds.
- Minimum alert set: API error-rate breach, API latency-SLO breach, **sync-lag breach** (an entity hasn't synced within its freshness SLO), **DLQ non-empty / growing**, queue-depth runaway, job-failure spike, **cron missed-run** (expected tick didn't fire), DB-connection saturation, health-check failing.
- Each alert names a runbook (Pillar 8) and a destination (who gets paged).
- **Wired** = an alert actually fires to the destination in a test (force a condition, confirm it pages).

## Pillar 5 — Dashboards

- An operational dashboard showing the metrics above at a glance: API RED, sync freshness per entity, error rates, host health.
- Per-client instance dashboards feed the **Master dashboard** health rollup.
- **Wired** = the panels render real data from the metrics backend.

## Pillar 6 — Queue visibility

- The queue/jobs surface (the dashboard's Queue/Jobs module + the metrics): depth, in-flight, failed, **DLQ contents**, retry state, and the ability to **replay/retry** from the DLQ (permission-gated).
- **Wired** = an operator can see a stuck job and the DLQ, and the webhook-replay/queue-recovery runbooks act on what's visible here.

## Pillar 7 — SLO / SLA defined (from the capacity profile)

- The SLOs (availability, latency, **sync-freshness**) come from QA's `capacity-profile.md`, set inside the measured budget with margin. The SLA (client-facing) is looser than the SLO.
- The error-budget is derived and is what Pillar 4's alerts watch.
- **Wired** = the SLO targets are written into the dashboard (SLO panels) and the alert thresholds, and trace back to a real measurement — not an invented number.

## Pillar 8 — Runbooks present (gate dependency)

The five runbooks must exist under `operations/` before G6 (`02-runbooks.md`): incident-runbooks, queue-recovery, webhook-replay, db-restore, deploy-recovery. G5.5 confirms they're present and that each alert references one. (Their _content_ is verified here; their _use_ is tested at the deploy/rollback rehearsal.)

---

## G5.5 verification output

Write `/projects/[client]/observability/g5_5-verification.md` with a present/wired matrix:

```
Pillar              Present  Wired   Evidence
Logs (structured)     ✓        ✓     observability/logs/sample-trace-job-8842.json
Metrics (RED+queue)   ✓        ✓     observability/metrics/dashboard.json
Tracing               ✓        ✓     observability/traces/sync-job-trace.png
Alerts                ✓        ✓     observability/alerts/rules.yaml + fired-test.md
Dashboards            ✓        ✓     observability/dashboards/operational.json
Queue visibility      ✓        ✓     observability/queue/dlq-replay-demo.md
SLO/SLA               ✓        ✓     observability/slo.md (← capacity-profile.md)
Runbooks present      ✓        —     operations/{incident-runbooks,queue-recovery,webhook-replay,db-restore,deploy-recovery}/
```

Any ✗ blocks G6. Surface the G5.5 gate block (per `_contracts/gate-format.md`) for Delivery head + Tech lead. Do not self-approve.

---

Last reviewed: 2026-06-30 by Claude (initial Node.js build)
Next review due: 2026-09-30
