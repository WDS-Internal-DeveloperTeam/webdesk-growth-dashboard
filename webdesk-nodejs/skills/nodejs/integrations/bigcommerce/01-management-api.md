---
tier: 2
load_when: ["integration-bigcommerce-active", "integration-work", "g1_5", "g_contracts"]
description: "BigCommerce v3 REST Management API — catalog/products/inventory/orders/customers/pricing, store API-account auth (X-Auth-Token + store hash), versioning. High-level; verify exact endpoints at build (NODE-008)."
---

# BigCommerce — Management API (v3 REST)

> The store side of the pilot. BigCommerce is the **commerce** system (authoritative for orders, often customers); the ERP is system-of-record for items/inventory/pricing. This file is the high-level shape of BigCommerce's server-to-server REST API. **Exact endpoint paths and field names are confirmed at build against the live docs (NODE-008)** — what's below is verified at the API-surface level and stable enough to plan and draft contracts from.

---

## Verified high-level facts

- BigCommerce exposes a **v3 REST Management API** (server-to-server) covering **catalog (products, variants, options), inventory, orders, customers, and pricing/price-lists**, alongside a separate Storefront API (see `02-storefront-graphql.md`). Versioned in the path (`/stores/{store_hash}/v3/...`); older `v2` endpoints still exist for a few areas — **pin v3, confirm any v2-only resource at build**.
- **Auth (store API account):** requests send the access token in the **`X-Auth-Token`** header. A store API account is created in the store control panel and yields a **client id, client secret, access token**, and the request path includes the **store hash**. (BigCommerce notes the client id is no longer a required header value; the access token is the credential that matters on Management API calls. B2B endpoints additionally take an `X-Store-Hash` header.)
- **Rate limits** exist and are **plan-dependent**, communicated via response headers (`X-Rate-Limit-*`) — **read them at runtime; do NOT hard-code a number** (NODE-008). Back off on `429`.

Sources verified: BigCommerce Developer Center — Authentication (`developer.bigcommerce.com/docs/start/authentication`), API Accounts (`docs.bigcommerce.com/developer/docs/overview/api-fundamentals/api-accounts`).

---

## How the middleware uses it

- **Pull from store:** orders (and customers, if store-authoritative) on the store→ERP direction.
- **Push to store:** items, inventory, pricing from the ERP (system-of-record) → BigCommerce catalog/inventory/price-lists.
- **Inventory** has its own tracking model (location/variant-level) — confirm the exact resource at build before mapping ERP branch inventory to it.
- **Pricing** maps to BigCommerce **price lists / customer groups** for customer-specific pricing (relevant to DDI's branch/customer pricing) — confirm the resource shape at build.
- All writes are **idempotent + capped-retry + DLQ** (NODE-101/102); rate-limit headers drive backoff (`integration/03`).

### Contract mapping (`integration-contract.schema.json`)

```jsonc
{
  "id": "IC-BIGCOMMERCE-001",
  "system": "bigcommerce",
  "display_name": "BigCommerce Store",
  "role": "commerce",
  "directions": ["pull", "push"],
  "entities": ["products", "inventory", "orders", "customers", "pricing"], // canonical: items/inventory/orders/customers/pricing
  "auth": {
    "type": "token",
    "credential_location": "env: BC_ACCESS_TOKEN (+ BC_STORE_HASH, BC_CLIENT_ID/SECRET)",
  },
  "base_url": "https://api.bigcommerce.com/stores/{store_hash}/", // confirm host at build
  "api_version": "v3", // confirm current at build
  "rate_limits": null, // plan-dependent; read X-Rate-Limit-* headers at runtime — do NOT invent
  "retry_policy": {
    "max_retries": 5,
    "backoff": "exponential-jitter",
    "base_delay_ms": 500,
    "dead_letter": true,
  },
  "idempotency_key": "{entity}:{externalId}:{modifiedAt}",
  "pagination": {
    "style": "page",
    "page_size": 250,
    "notes": "confirm max page size + meta.pagination at build",
  },
  "sync": {
    "pattern": "webhook",
    "incremental": true,
    "watermark_field": "date_modified (confirm at build)",
    "reconcile_cadence": "scheduled cron — confirm per entity at G-Contracts",
    "timezone_source": "dashboard.settings.timezone",
    "conflict_resolution": "store wins for orders; ERP wins for items/inventory/pricing",
    "overlap_policy": "skip-if-running",
  },
  "schema_version": "1.0.0",
  "owner": "backend_lead",
  "status": "draft",
}
```

Webhooks (store-side, near-real-time) are detailed in `04-webhooks.md`; the contract pairs webhook events with a **cron reconciliation** safety net (never webhook-only). Exact endpoint paths, field names, inventory/price-list resource shapes, and the current max page size are **confirmed at build** — see `pointers.md`.
