---
tier: 2
load_when: ["qa-active", "g5"]
description: How to design load+soak and chaos/fault-injection tests for the middleware and turn the results into a capacity profile and proposed SLO/SLA numbers. Runs at G5; the profile feeds the Delivery Head's G5.5 observability gate.
---

# Load + Chaos → Capacity Profile → SLO/SLA

> At G5 you don't just confirm it works — you find out **how much** it can take and **how** it fails, then turn that into numbers the business can commit to. The output is a **capacity profile** and a proposed **SLO/SLA**, which the Delivery Head uses to define alert thresholds and the observability gate (G5.5). Run all of this against the **local stack** (Docker Compose: app + Postgres + queue + mock ERP/store) or a dedicated load env — **never** against a client production system.

---

## 1. Load testing (find the knee)

**Tools:** k6 or Artillery. Pick one per project; keep the scripts in the repo (`tools/load/`).

**Two surfaces to load — they fail differently:**

- **The API** (dashboard + webhook endpoints): ramp concurrent requests. Watch p50/p95/p99 latency and error rate per endpoint.
- **The sync engine** (cron jobs + queue): ramp the _volume_ of entities to sync and the _arrival rate_ of webhooks/jobs. Watch job throughput, queue depth, and how long the backlog takes to drain.

**Method:**

1. Define a budget up front (e.g. "p95 < 500ms for dashboard reads; webhook ack p95 < 200ms; inventory sync of 50k SKUs completes within the cadence window").
2. Ramp in stages (e.g. 10 → 50 → 100 → 200 RPS, or 1k → 10k → 50k entities). Hold each stage long enough to read steady-state.
3. Find the **knee** — the load where p95 latency or error rate breaks the budget. That's your max sustainable throughput.
4. Record what saturates first: CPU, DB connection pool, queue concurrency, external rate limit. That's the scaling lever.

## 2. Soak testing (find the slow leaks)

Run a sustained, realistic load for **1–2 hours** (longer for a retainer-critical system).

- **Memory:** flat or sawtooth-with-GC = fine; monotonic climb = a leak (P2).
- **DB connections:** pool should recycle; a climbing open-connection count means handles aren't released.
- **Queue:** depth should stay bounded; steady growth means consumers can't keep up at this rate (a capacity finding, not necessarily a bug).
- **Latency drift:** p95 creeping up over the soak = degradation under sustained load.

## 3. Chaos / fault-injection (find the failure behavior)

The goal is to _prove the resilience patterns work_, not just that they exist in code. For each scenario, assert the recovery.

| Scenario                    | How to inject                       | Must observe                                                                             |
| --------------------------- | ----------------------------------- | ---------------------------------------------------------------------------------------- |
| **Dependency down**         | stop the ERP/store mock mid-sync    | retry w/ backoff; circuit-breaker opens; failed work → **DLQ**; no partial/corrupt write |
| **429 / rate limit**        | mock returns 429 with `Retry-After` | `Retry-After` honored; bounded retries; no thundering herd on recovery                   |
| **Slow upstream / timeout** | mock delays past the client timeout | request times out cleanly (504 surfaced, not a hang); job retried, not duplicated        |
| **DB drop**                 | kill Postgres mid-write             | in-flight txn rolls back; job is retryable; no half-applied sync                         |
| **Process kill mid-sync**   | SIGKILL the worker                  | resume from watermark; no dupes, no gap (overlaps Module 8 watermark-resume)             |
| **Recovery**                | bring the dependency back           | circuit closes; DLQ drains on command; reconciliation shows no permanent divergence      |

A resilience pattern that isn't exercised under chaos is assumed broken. If there's no DLQ, no circuit-breaker, or unbounded retries, that's a finding (P2) — the architecture fitness tests (Code Review `02-architecture-fitness-enforcement.md`) cap retries; chaos proves the cap behaves.

## 4. The capacity profile (the deliverable)

Write `/projects/[client]/qa-reports/load/capacity-profile.md`. It states, with numbers:

```
Capacity Profile — [project] — [milestone] — [date]

API
  Dashboard reads:   p50 __ms  p95 __ms  p99 __ms  @ __ RPS (knee at __ RPS)
  Webhook ingest:    p50 __ms  p95 __ms  ack @ __ RPS; error rate __% at knee
Sync engine
  Inventory full sync of __ entities: __ min  (cadence window: __ min)  → headroom __%
  Incremental sync of __ deltas:      __ s
  Max sustainable job throughput:     __ /min before queue grows unbounded
Saturation
  First resource to saturate: [DB pool / CPU / queue concurrency / external rate limit]
Soak (Nh)
  Memory: [flat / leak __MB/h]   DB connections: [stable / climbing]   p95 drift: [none / +__ms]
Chaos
  Dependency-down recovery: [PASS/FAIL]  DLQ drains: [PASS/FAIL]  watermark-resume: [PASS/FAIL]
```

## 5. Propose SLO / SLA from the profile

Translate the measured numbers into commitments — set the SLO **inside** the measured budget with margin, never at the knee.

- **Availability SLO** — e.g. "API 99.9% monthly" (informed by chaos recovery behavior + redundancy).
- **Latency SLO** — e.g. "dashboard read p95 < 400ms" (measured p95 was 280ms at target load → set 400ms with headroom).
- **Sync freshness SLO** — e.g. "inventory reflected within 15 min" (full sync runs in 6 min within a 30-min cadence → 15 min is safe).
- **Error-budget** — derive from the availability SLO; this is what the Delivery Head wires alerts against at G5.5.
- **SLA** (the client-facing promise) is set **looser** than the SLO (the internal target), so the team has room before breaching the contract.

Hand the proposed SLO/SLA + the capacity profile to the Delivery Head. At **G5.5** these become the alert thresholds and the dashboard's SLO panels; without a capacity profile there is no defensible SLO, and G5.5 cannot pass.

---

## Rules

1. Never load/chaos against client production. Local stack or a dedicated load env only.
2. Keep load + chaos scripts in the repo (`tools/load/`, `tools/chaos/`) so they're re-runnable and reviewed.
3. Set SLO inside the measured budget with margin; SLA looser than SLO. Numbers, not adjectives.
4. A resilience pattern not proven under chaos is treated as absent — file it.
5. The capacity profile is a living artifact; re-run and update it when the architecture or load assumptions change.

---

Last reviewed: 2026-06-30 by Claude (initial Node.js build)
Next review due: 2026-09-30
