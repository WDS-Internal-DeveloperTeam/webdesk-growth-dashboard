---
tier: 2
load_when: ["integration-shopify-active", "integration-work", "security-topic"]
description: "Shopify app auth — OAuth 2.0 install flow, access tokens, HMAC-verified OAuth callbacks. App Bridge is embedded-admin UI (rarely needed for headless middleware). API-only. Verify at build."
---

# Shopify — OAuth & App Bridge

> How the middleware authenticates to a Shopify store. **API-only** — we authenticate as an app to use the Admin API; we never build embedded theme/storefront UI. Verified at the surface level; confirm exact flow at build (NODE-008).

## OAuth 2.0 install flow (how we get a token)

Shopify apps authenticate via **OAuth 2.0 (authorization-code grant)**:

1. Merchant initiates install; app redirects to Shopify's authorize URL with the requested **scopes**.
2. Shopify redirects back to the app's callback with a temporary `code` (and an `hmac` query param).
3. **Verify the callback** — recompute **HMAC-SHA256** over the remaining query params with the app's **API secret** and compare (timing-safe). Reject if it doesn't match (NODE-005).
4. Exchange the `code` for a per-shop **access token**, used in **`X-Shopify-Access-Token`** on Admin API calls (`01`).

- **Per-shop token**, stored encrypted at rest (NODE-103), in env/secret manager (NODE-004), scoped per tenant (NODE-104).
- **Scopes** are least-privilege for the entities in scope (e.g. `read_orders`, `write_products`, `read/write_inventory`) — set at G-Contracts, confirmed at build.
- For a single known store, a **custom/admin app** token can be provisioned directly (the simpler analogue to BigCommerce's store API account); for many stores, the public-app OAuth flow above.

## App Bridge — usually NOT needed here

**App Bridge** is Shopify's library for **embedded apps that render inside Shopify admin**. Our middleware + WebDesk dashboard is a **separate React/Next app** (blueprint §8), not embedded in Shopify admin, so App Bridge is typically **out of scope**. Load it only if a project specifically requires an embedded-admin surface — decide at G1.5. Default: skip.

## verify-at-build

- [ ] Custom/admin-app token (single store) vs public-app OAuth (multi-store).
- [ ] Exact authorize/callback URLs + the current OAuth/session-token specifics.
- [ ] Minimal scope set for the entities in scope.
- [ ] Whether any embedded-admin UI (App Bridge) is genuinely required (usually no).

See `pointers.md` for the auth doc anchor.
