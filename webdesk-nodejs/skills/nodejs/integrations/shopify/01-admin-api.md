---
tier: 2
load_when: ["integration-shopify-active", "integration-work", "g1_5", "g_contracts"]
description: "Shopify Admin API (GraphQL-first, REST legacy) — products/inventory/orders/customers/pricing, X-Shopify-Access-Token, date-based versioning. API-only (never theme). Verify exact fields at build."
---

# Shopify — Admin API

> **API-only. We never touch Shopify themes/Liquid** — this skill integrates Shopify as a commerce backend, not a storefront build. Shopify is the **commerce** system (authoritative for orders, often customers); the ERP is system-of-record for items/inventory/pricing. Verified at the surface level; confirm exact fields at build (NODE-008).

---

## Verified high-level facts

- **GraphQL-first.** The **GraphQL Admin API** is the path for all new integrations. The **REST Admin API is legacy as of October 1, 2024**, and new Admin features are GraphQL-exclusive — so **build against GraphQL Admin**; treat REST as legacy/interop only.
- **Auth header:** Admin API requests send the access token in **`X-Shopify-Access-Token`** (obtained via OAuth — see `02-oauth-and-app-bridge.md`).
- **Date-based versioning:** Shopify ships a new API version **quarterly**, named `YYYY-MM` (e.g. `2026-01`). **Pin a version; plan to roll it forward** — old versions are sunset on a schedule (track in `pointers/deprecations.md`).
- **Coverage:** products/variants, inventory (inventory levels per location), orders, customers, and pricing/discounts. Exact GraphQL types/fields confirmed at build.

Sources verified: Shopify dev docs — GraphQL Admin API reference (`shopify.dev/docs/api/admin-graphql`), REST versioning/legacy notice (`shopify.dev/docs/api/admin-rest/usage/versioning`), API versioning (`shopify.dev/docs/api/usage/versioning`).

---

## How the middleware uses it

- **Pull from store:** orders (and customers, if store-authoritative) on store→ERP.
- **Push to store:** items, inventory levels, pricing from the ERP (system-of-record) → Shopify.
- **Inventory** is per-**location** in Shopify — map ERP branch/location to Shopify locations explicitly at G-Contracts.
- **GraphQL cost-based rate limiting:** Shopify GraphQL uses a **calculated-query-cost / leaky-bucket** model (not simple request counts). Read the cost extensions in responses and throttle accordingly — **do not hard-code a number** (NODE-008); see `integration/03`.
- Writes are idempotent + capped-retry + DLQ (NODE-101/102).

### Contract mapping (`integration-contract.schema.json`)

```jsonc
{
  "id": "IC-SHOPIFY-001",
  "system": "shopify",
  "display_name": "Shopify Store",
  "role": "commerce",
  "directions": ["pull", "push"],
  "entities": ["products", "inventory", "orders", "customers", "pricing"],
  "auth": {
    "type": "oauth2",
    "credential_location": "env: SHOPIFY_ACCESS_TOKEN (+ shop domain)",
    "scopes": [
      "read_products",
      "write_products",
      "read_orders",
      "read_inventory",
      "write_inventory",
    ],
  },
  "base_url": "https://{shop}.myshopify.com/admin/api/{version}/graphql.json", // confirm at build
  "api_version": "2026-01", // CONFIRM current quarter at build
  "rate_limits": null, // GraphQL cost-based — read cost extensions at runtime; do NOT invent
  "retry_policy": {
    "max_retries": 5,
    "backoff": "exponential-jitter",
    "base_delay_ms": 500,
    "dead_letter": true,
  },
  "idempotency_key": "{entity}:{externalId}",
  "pagination": {
    "style": "cursor",
    "notes": "GraphQL cursor connections; confirm page sizes at build",
  },
  "sync": {
    "pattern": "webhook",
    "incremental": true,
    "conflict_resolution": "store wins for orders; ERP wins for items/inventory/pricing",
    "overlap_policy": "skip-if-running",
  },
  "schema_version": "1.0.0",
  "owner": "backend_lead",
  "status": "draft",
}
```

Webhooks + billing in `03-webhooks-and-billing.md`; pair webhooks with cron reconciliation (never webhook-only). Exact GraphQL types, fields, and the current API version are **confirmed at build** — see `pointers.md`.
