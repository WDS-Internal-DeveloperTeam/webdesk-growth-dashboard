---
tier: 2
load_when: ["integration-shopify-active", "integration-work"]
description: "Shopify anchored doc URLs + API version. GraphQL-first; REST is legacy. Confirm current quarterly version at build."
---

# Shopify — Doc Pointers

> Anchored entry points. **Confirm the current API version at build** (NODE-008) — Shopify ships quarterly. Verified reachable at authoring time (2026-06-30).

## API version

- **Date-based, quarterly:** `YYYY-MM` (e.g. `2026-01`). Pin one; roll it forward each quarter; old versions sunset on schedule.
- **GraphQL Admin API is the build target;** REST Admin API is **legacy since 2024-10-01**.
- **Confirm the current version + sunset dates at build** → record in `pointers/deprecations.md`.

## Doc anchors

- Dev docs (root): https://shopify.dev/docs
- GraphQL Admin API reference: https://shopify.dev/docs/api/admin-graphql
- REST Admin API (legacy) + versioning: https://shopify.dev/docs/api/admin-rest/usage/versioning
- API versioning policy: https://shopify.dev/docs/api/usage/versioning
- OAuth / access tokens: https://shopify.dev/docs/apps/build/authentication-authorization/access-tokens
- Webhooks (build + HMAC verification): https://shopify.dev/docs/apps/build/webhooks
- GraphQL rate limits (calculated cost): https://shopify.dev/docs/api/usage/rate-limits
- Billing API: https://shopify.dev/docs/apps/launch/billing
- App Bridge (embedded admin — usually out of scope): https://shopify.dev/docs/api/app-bridge

## At-build checklist

- [ ] Confirm current quarterly version; pin in the contract `api_version`.
- [ ] Confirm GraphQL types/fields for entities in scope (GraphQL-first).
- [ ] Confirm webhook topics + HMAC header (`X-Shopify-Hmac-SHA256`).
- [ ] Read GraphQL cost extensions for throttling; do not hard-code limits.
- [ ] Note any sunset version → `pointers/deprecations.md`.
- [ ] API-only — never theme/Liquid.
