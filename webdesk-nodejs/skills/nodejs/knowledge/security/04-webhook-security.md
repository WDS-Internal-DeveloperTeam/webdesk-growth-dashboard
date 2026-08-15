---
tier: 2
load_when: ["code-production", "security-topic", "integration-work"]
description: "Webhook security — HMAC signature verification, replay protection, and idempotency."
---

# Security 04 — Webhook Security

> Webhooks come from the store side (BigCommerce/Shopify support them; most ERPs don't — they're poll/cron). An inbound webhook is **untrusted input from the public internet** until proven otherwise. Three controls, in order: verify the signature, reject replays, process idempotently.

---

## 1. Verify the HMAC signature

The sender signs the **raw request body** with a shared secret and sends the signature in a header. You recompute it and compare. **You must verify over the exact bytes received** — so capture the raw body _before_ JSON parsing (`backend/01` middleware order).

```js
import { createHmac, timingSafeEqual } from "node:crypto";

export function verifyWebhook(rawBody, signatureHeader, secret) {
  const expected = createHmac("sha256", secret).update(rawBody).digest("base64");
  const a = Buffer.from(expected);
  const b = Buffer.from(signatureHeader ?? "");
  // constant-time compare — never ===, which leaks timing
  return a.length === b.length && timingSafeEqual(a, b);
}
```

- **Constant-time comparison** (`timingSafeEqual`) — a `===` compare leaks timing.
- Reject with **401** if it fails; log the rejection (without the body's sensitive contents).
- The signing secret is per-integration, from the secret manager (`03-secrets-and-config.md`).
- Use the **provider's documented scheme** (algorithm, header name, encoding) — verify it at discovery, don't assume (NODE-008).

---

## 2. Reject replays

A captured valid webhook can be resent by an attacker. Defend with both:

- **Timestamp window:** if the provider includes a signed timestamp, reject deliveries older than a small window (e.g. 5 min). The signature must cover the timestamp, or it's forgeable.
- **Event-id dedupe:** record processed event IDs (with TTL); a repeat ID is acknowledged but not re-processed. This also handles the provider's legitimate at-least-once retries.

---

## 3. Process idempotently (NODE-102)

Even with replay protection, providers deliver **at least once** — the same event legitimately arrives twice (their retry after a slow ack). The handler must be idempotent: same event, same end state.

- **Upsert keyed on the external id**, never blind-insert (`integration/02`).
- **Ack fast, work async:** return 2xx quickly (within the provider's timeout) by enqueuing the work, then process from the queue. A slow handler causes the provider to retry, multiplying load.
- Dedupe at the queue too (job id = event id) so a re-enqueued event collapses.

```js
router.post(
  "/webhooks/bigcommerce/orders",
  captureRawBody, // before json()
  (req, res, next) =>
    verifyWebhook(req.rawBody, req.get("X-Signature"), secret) ? next() : res.sendStatus(401),
  express.json(),
  async (req, res) => {
    await webhookQueue.add("bc-order", req.body, { jobId: req.body.id }); // jobId = dedupe
    res.sendStatus(202); // ack fast, process async
  },
);
```

---

## Summary

| Threat                        | Control                                                |
| ----------------------------- | ------------------------------------------------------ |
| Forged webhook                | HMAC verify over raw body, constant-time compare → 401 |
| Replay of a captured webhook  | signed-timestamp window + event-id dedupe              |
| Duplicate legitimate delivery | idempotent upsert keyed on external id (NODE-102)      |
| Slow handler → retry storm    | ack 202 fast, process from queue                       |
| Leaked secret                 | per-integration secret in secret manager, rotatable    |

Tested by QA's webhook idempotency/replay suite (blueprint §7).
