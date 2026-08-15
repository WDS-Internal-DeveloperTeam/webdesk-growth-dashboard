---
tier: 2
load_when: ["integration-shopify-active", "integration-work", "security-topic", "sync-engine"]
description: "Shopify webhooks (X-Shopify-Hmac-SHA256, at-least-once, versioned) + Billing API (only if WebDesk monetizes via Shopify). Webhooks apply store-side; pair with cron reconciliation. Verify at build."
---

# Shopify — Webhooks & Billing

> Store-side, like BigCommerce — **webhooks apply on the store, not the ERP** (`_erp-adapter-pattern.md`). Verified at the surface level; confirm exact topics/fields at build (NODE-008).

## Webhooks

- **Subscribe to topics** (e.g. `orders/create`, `orders/updated`, `products/update`, `inventory_levels/update`, `customers/*`) — confirm exact topic names at build.
- **Signature verification:** every payload includes an **`X-Shopify-Hmac-SHA256`** header — compute HMAC-SHA256 of the **raw** body with the app's **API secret** and compare **timing-safe**; reject on mismatch (NODE-005). Pair with `knowledge/security/04-webhook-security.md`.
- **At-least-once delivery + retries** → handlers must be **idempotent** (NODE-102); dedupe by event/webhook id or `{entity}:{externalId}:{updated_at}`.
- **Versioned:** webhooks carry **`X-Shopify-Api-Version`**; if it differs from your selected version, your version is being sunset — track in `pointers/deprecations.md`.
- **Ack fast, process async** (NODE-009): return `2xx` quickly, enqueue, do ERP work off the request path; slow handlers trigger retries → duplicates.
- **Never webhook-only** — always run the **cron reconciliation** safety net; failed events → DLQ + `webhook-replay` runbook (NODE-101).

Source verified: Shopify dev docs — webhooks HMAC verification + versioned webhooks (`shopify.dev/docs/apps/build/webhooks`, `shopify.dev/docs/api/usage/versioning`).

## Billing API — only if WebDesk monetizes through Shopify

Shopify's **Billing API** (recurring/usage/one-time app charges) is relevant **only if WebDesk charges clients via Shopify's billing** (e.g. a listed App Store app). For **per-client deployments billed directly by WebDesk**, this is **out of scope** — skip it. Decide at G1.5; default skip for the integration-middleware pilot.

## verify-at-build

- [ ] Exact webhook topics + payload fields for orders/products/inventory/customers.
- [ ] Current HMAC header + verification specifics (assume `X-Shopify-Hmac-SHA256`, confirm).
- [ ] Whether Shopify Billing is in scope at all (usually no).

See `pointers.md` for doc anchors.
