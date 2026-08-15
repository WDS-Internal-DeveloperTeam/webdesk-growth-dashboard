---
tier: 2
load_when: ["integration-bigcommerce-active", "integration-work", "security-topic", "sync-engine"]
description: "BigCommerce store webhooks — events, signature verification, idempotency/replay, + cron reconciliation safety net. THIS is where webhooks apply (store side), unlike poll-only ERPs. Verify exact signing at build."
---

# BigCommerce — Store Webhooks

> **This is where webhooks DO apply.** The store side (BigCommerce) supports near-real-time event push; the **ERP side does not** (poll/cron — `_erp-adapter-pattern.md`, `ddi-inform.md`). That asymmetry is the whole reason the sync engine is cron-first with webhooks as an _enhancement on the store side only_. Verified at the surface level; **confirm the exact signing mechanism at build (NODE-008)** — see the caution below.

---

## Verified high-level facts

- BigCommerce lets an app/integration **subscribe to store webhooks** for events such as order, product (incl. inventory), customer, and category changes (scope-style event names like `store/order/*`, `store/product/*`, `store/customer/*` — **confirm the exact event list at build**).
- **Delivery is at-least-once with retries** — BigCommerce retries failed deliveries, so a consumer **must be idempotent** (the same event can arrive more than once).
- **Signature verification:** BigCommerce supports verifying webhook authenticity. Public guidance describes **HMAC-SHA256 over the raw request body using the app's client secret**, compared with a timing-safe comparison; BigCommerce also supports **custom headers** set at subscription time as an additional shared-secret check. **Caution:** the exact mechanism (a `signature`/secret field in the JSON payload vs an HMAC header, and the header name) has varied — **verify the current signing method against the live docs at build before relying on a specific header name.** Treat the HMAC-SHA256-over-raw-body approach as the working assumption, not gospel.

Source verified: BigCommerce Developer Center — Webhooks overview (`developer.bigcommerce.com/docs/integrations/webhooks`), event reference (`docs.bigcommerce.com/developer/docs/integrations/webhooks/event-reference/events`).

---

## How the middleware consumes them (rules)

1. **Verify before processing** — reject any callback that fails signature/secret verification (NODE-005). Use a **timing-safe** comparison; verify over the **raw** body (don't re-serialize). Pair with `knowledge/security/04-webhook-security.md`.
2. **Respond fast, process async** — ack with `2xx` quickly, enqueue the job (node-cron path or BullMQ), do the ERP work off the request path (NODE-009). A slow handler causes BigCommerce retries → duplicates.
3. **Idempotent handlers** (NODE-102) — dedupe by event id / `{entity}:{externalId}:{updated_at}` (the contract's `idempotency_key`). At-least-once delivery means duplicates are normal, not exceptional.
4. **Webhooks are an enhancement, never the source of truth** — always run the **cron reconciliation** (`_erp-adapter-pattern.md` §6, `integration/01`) so a missed/dropped webhook is caught. Webhook-only sync is forbidden by design.
5. **Replay + DLQ** — failed/poison events go to a DLQ drained by the `webhook-replay` runbook; never silently dropped (NODE-101).

## Contrast with ERPs (the load-bearing point)

|                 | BigCommerce (store)                | DDI Inform & most ERPs         |
| --------------- | ---------------------------------- | ------------------------------ |
| Event push      | **Yes — webhooks** (at-least-once) | **No** — poll/cron pull+push   |
| Default pattern | webhooks **+ cron reconciliation** | continuous cron-scheduled sync |
| Why             | store platform exposes events      | partner-gated, poll-only APIs  |

The adapter `capabilities.supportsWebhooks` flag encodes exactly this: `true` for the BigCommerce side, `false` for ERP adapters. The engine reads the flag and wires webhooks only where they exist.

## verify-at-build

- [ ] Exact event names + the entities/payload shapes for products/inventory/orders/customers.
- [ ] **Current signing mechanism** (HMAC header name + algorithm, or payload secret field) — do not assume.
- [ ] Retry policy/timeout window driving the ack-fast requirement.
- [ ] Custom-header secret setup at subscription time.

See `pointers.md` for the webhooks doc anchor.
