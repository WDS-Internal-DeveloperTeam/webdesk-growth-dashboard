---
tier: 2
load_when: ["code-production", "integration-work", "sync-engine"]
description: "Handling upstream rate limits — respecting limits, exponential backoff with jitter, token-bucket throttling, circuit breaking."
---

# Integration 03 — Rate Limits & Backoff

> ERP and store APIs throttle. A sync engine that ignores limits gets blocked, back-pressures, and corrupts runs. Be a good client: stay under the limit proactively, back off correctly when told to, and never retry unbounded (NODE-101).

---

## Respect the documented limit (verify at discovery)

- Find the real limit (requests/sec, requests/window, concurrency, or a points/cost budget like some store APIs) at discovery — don't guess (NODE-008). Record it in the integration contract.
- **Proactively throttle** to stay under it (token bucket below) rather than firing freely and reacting to 429s. Reactive-only means you spend half your runs rejected.
- **Honor the response signals:** `Retry-After`, `X-RateLimit-Remaining`/`-Reset`, or the API's quota header. When the API tells you how long to wait, wait that long — don't back off less.

---

## Exponential backoff with jitter

For retryable failures (429, 503, timeouts), back off exponentially and add **jitter** so many workers don't retry in lockstep (a thundering herd that re-triggers the limit).

```js
// lib/retry-with-backoff.js
export async function retryWithBackoff(
  fn,
  { retries = 5, baseMs = 500, factor = 2, onExhausted } = {},
) {
  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      return await fn();
    } catch (err) {
      if (!isRetryable(err) || attempt === retries) {
        // terminal or out of attempts
        if (onExhausted) await onExhausted(err); // → DLQ
        throw err;
      }
      const retryAfter = retryAfterMs(err); // honor Retry-After if present
      const backoff = retryAfter ?? Math.round(baseMs * factor ** attempt * (0.5 + Math.random()));
      await sleep(backoff); // jitter: 50–150% of the computed delay
    }
  }
}
```

- **`isRetryable`:** 429, 502/503/504, network/timeout → retry. 400/401/403/422 → terminal, don't retry (DLQ).
- **Cap** attempts and total elapsed time; exhausted → DLQ, not an infinite loop (NODE-101).

---

## Proactive throttling — token bucket

Throttle outbound calls so you stay under the limit by design.

- A **token-bucket limiter** (e.g. `bottleneck`, or a small custom one): N tokens per window, each call consumes one, refill on schedule. Tune to ~80% of the documented limit to leave headroom.
- **Concurrency cap** alongside rate cap — many APIs limit in-flight requests, not just rate. BullMQ worker `concurrency` + a limiter together.
- For **points/cost-budget** APIs, deduct the _cost_ of each call from the budget, not a flat one — a bulk query costs more.

---

## Circuit breaking

When an upstream is hard-down (sustained 5xx/timeouts), stop hammering it:

- **Open the circuit** after a failure threshold — fail fast for a cool-off period instead of queuing thousands of doomed calls.
- **Half-open** probe after cool-off; close on success.
- While open, **defer** the entity's sync (the watermark means nothing is lost — it catches up when the upstream returns, `integration/01`). Alert on a sustained open circuit (`integration/04`).

---

## Interaction with the sync engine

- **Initial full sync** is the highest-volume moment — page through under the limiter, with a resumable cursor (`integration/01`).
- **Rate-limit hits are a capacity signal:** chronic throttling means the cadence is too aggressive for the quota — surface it at G5 (load/capacity) and tune cadence or request a higher quota.
- All of this is observable: emit metrics for 429 rate, backoff time, circuit state, and DLQ size (`integration/04`).
