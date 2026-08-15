---
tier: 2
load_when: ["integration-bigcommerce-active", "integration-work", "security-topic"]
description: "BigCommerce app auth model — store API accounts (single-store, the pilot default) vs OAuth apps (multi-store / App Store). Where credentials live. Verify exact flow at build."
---

# BigCommerce — App Auth Model

> Two ways to authenticate to a BigCommerce store. Pick per project; the pilot uses a single-store API account. Verified at the surface level; confirm the exact OAuth flow at build (NODE-008).

## 1. Store API account (single-store) — pilot default

Created in the store's control panel; yields **client id, client secret, access token**, and the store hash. The middleware uses the **access token in `X-Auth-Token`** for Management API calls (`01`). Simplest model — right when we integrate **one known store** (the DDI pilot). No OAuth dance; the token is a long-lived credential the client provisions for us.

## 2. OAuth app (multi-store / App Store)

For an app installable across many stores (e.g. listed on the BigCommerce App Store), BigCommerce uses an **OAuth 2.0 install flow**: the merchant installs the app, BigCommerce calls the app's auth callback with a temporary code, the app exchanges it for a per-store **access token**, and BigCommerce sends `load`/`uninstall`/`remove-user` signed callbacks for app lifecycle. This is the model if WebDesk packages the middleware as a reusable installable app rather than a per-client deployment.

## Which to use

- **Per-client deployment (the WebDesk default, blueprint §8 per-client instances):** store API account — one set of credentials per client install, stored in that instance's secrets.
- **One central installable app across clients:** OAuth app. Decide at G1.5; it changes secret storage + the master-dashboard tenancy story.

## Credential handling (non-negotiable)

- Secrets in **env / secret manager**, never in code or logs (NODE-004); **tokens encrypted at rest** (NODE-103).
- Contract `auth.credential_location` records _where_ (e.g. `env: BC_ACCESS_TOKEN`), never the value.
- Per-tenant isolation: each client instance's BigCommerce token is scoped to that tenant (NODE-104).

## verify-at-build

- [ ] Single-store API account vs OAuth app for this project.
- [ ] Exact OAuth callback/exchange + lifecycle-callback shapes (if app route).
- [ ] Required scopes/permissions for the entities in scope.

See `pointers.md` for the auth doc anchor.
