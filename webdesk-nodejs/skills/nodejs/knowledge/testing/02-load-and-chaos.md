---
tier: 2
load_when: ["qa-active", "g5"]
description: "Load and chaos testing — k6/Artillery for load/soak, fault injection for the sync engine. Feeds the G5 capacity profile and SLOs."
---

# Testing 02 — Load & Chaos

> At G5, prove the system holds under load and degrades safely under failure. Load tests produce the **capacity profile** that sets the SLO/SLA thresholds (blueprint §7, §13). Run these **locally first** (Docker Compose is the cheapest place — blueprint §15).

---

## Load testing

- **Tools:** **k6** (scriptable, JS, good CI integration) or **Artillery**. Pick one per project.
- **Targets:** the dashboard/API endpoints _and_ the sync engine throughput (records/sec the sync sustains within rate limits).
- **Scenarios:**
  - **Baseline load** — expected concurrent dashboard users + normal sync cadence.
  - **Peak** — initial full sync running while the dashboard is in use; the worst realistic moment.
  - **Stress** — ramp until something breaks; find the ceiling and _how_ it breaks (graceful 503 vs falling over).
- **Assert SLOs:** p95/p99 latency, error rate, and **sync watermark lag stays within the freshness SLO** under load. Record the numbers — they become the alert thresholds (`integration/04`).

```js
// k6 sketch
import http from "k6/http";
import { check } from "k6";
export const options = {
  stages: [
    { duration: "2m", target: 50 },
    { duration: "5m", target: 50 },
  ],
};
export default function () {
  const res = http.get(`${__ENV.BASE}/api/v1/sync-states/orders`, { headers: auth });
  check(res, { "status 200": (r) => r.status === 200, "p95 ok": (r) => r.timings.duration < 400 });
}
```

---

## Soak testing

- Run baseline load for an **extended period** (hours) to catch what short runs miss: memory leaks, connection-pool exhaustion, a watermark that drifts, file descriptors, slowly growing queue depth.
- Watch the metrics from `integration/04` over the soak — flat is healthy; a rising line (memory, queue depth, lag) is a leak/back-pressure bug.

---

## Chaos / fault injection

Verify the failure handling the code claims to have (it pairs with `failure-scenario-library.md`). Inject, observe, assert safe behavior:

| Injected fault                         | Expected behavior                                                                  |
| -------------------------------------- | ---------------------------------------------------------------------------------- |
| Upstream ERP/store returns 429 / 503   | backoff + retry, then DLQ if exhausted; circuit opens on sustained down (NODE-101) |
| Upstream timeout / hang                | request times out, doesn't block the event loop (NODE-009), retries                |
| Duplicate webhook / re-delivered event | idempotent — no double effect (NODE-102)                                           |
| Kill the sync mid-run                  | resumes from watermark, exactly-once tail (`integration/01`)                       |
| Slow run overruns its interval         | next tick skips/coalesces, no stacking (`integration/02`)                          |
| DB connection drop                     | reconnect/pool recovery; in-flight tx rolls back, no partial write                 |
| Redis/queue unavailable                | jobs aren't lost; degrade and recover when it returns                              |
| Clock skew on upstream timestamps      | conflict resolution doesn't corrupt; watermark logic tolerant                      |

- **How:** toxiproxy (latency/drops), a fault-injecting mock adapter, container kills (`docker compose kill`), and feature-flagged fault hooks in test builds.
- **Assert no silent data loss** — the cardinal rule. Every injected failure either recovers or surfaces (DLQ + alert); none corrupts sync state quietly (NODE-006).

---

## Output

A **capacity + resilience report** for G5: the throughput ceiling, latency under load, soak result, and the chaos matrix with pass/fail. The SLO numbers from this report flow into the G5.5 observability alerts and the master dashboard health score.
