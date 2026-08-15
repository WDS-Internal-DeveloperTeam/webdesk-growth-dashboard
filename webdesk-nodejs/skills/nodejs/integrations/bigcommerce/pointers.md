---
tier: 2
load_when: ["integration-bigcommerce-active", "integration-work"]
description: "BigCommerce anchored doc URLs + API version. Confirm current version at build — endpoints/fields change."
---

# BigCommerce — Doc Pointers

> Anchored entry points. **Confirm the current API version at build** before pinning a contract's `api_version` (NODE-008). Verified reachable at authoring time (2026-06-30); BigCommerce reorganizes docs, so treat exact paths as starting points.

## API version

- **Management API: `v3`** (path-versioned: `/stores/{store_hash}/v3/...`). A few legacy `v2` resources remain — confirm per-resource at build.
- **Confirm current version + any v2-only resources at build.**

## Doc anchors

- Developer Center (root): https://developer.bigcommerce.com/docs
- Authentication: https://developer.bigcommerce.com/docs/start/authentication
- API Accounts / fundamentals: https://docs.bigcommerce.com/developer/docs/overview/api-fundamentals/api-accounts
- REST Management API reference (catalog/products/inventory/orders/customers/pricing): https://developer.bigcommerce.com/docs/rest-management
- Catalog / Products: https://developer.bigcommerce.com/docs/rest-catalog
- Orders: https://developer.bigcommerce.com/docs/rest-management/orders
- Customers v3: https://developer.bigcommerce.com/docs/rest-management/customers
- Price Lists / pricing: https://developer.bigcommerce.com/docs/rest-management/price-lists
- Storefront GraphQL API: https://developer.bigcommerce.com/docs/storefront/graphql
- Webhooks overview: https://developer.bigcommerce.com/docs/integrations/webhooks
- Webhook event reference: https://docs.bigcommerce.com/developer/docs/integrations/webhooks/event-reference/events
- Rate limits: https://developer.bigcommerce.com/docs/start/best-practices/api-rate-limits

## At-build checklist

- [ ] Confirm `v3` is still current; note deprecations → `pointers/deprecations.md`.
- [ ] Confirm exact endpoint paths + field names for entities in scope.
- [ ] Confirm webhook signing mechanism + event names (see `04-webhooks.md`).
- [ ] Read live rate-limit headers; do not hard-code limits.
