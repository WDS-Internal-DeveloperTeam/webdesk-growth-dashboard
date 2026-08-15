---
tier: 2
load_when: ["integration-bigcommerce-active", "integration-work"]
description: "BigCommerce Storefront GraphQL API — use cases (read-mostly storefront data with a storefront token), and why the middleware uses the REST Management API for sync, not this. Verify at build."
---

# BigCommerce — Storefront GraphQL API

> BigCommerce provides a **Storefront GraphQL API** (distinct from the v3 REST **Management** API in `01`). Verified at the surface level; specific query fields confirmed at build (NODE-008).

## What it's for

The Storefront GraphQL API is for **reading storefront-facing data in the shopper context** — products, categories, pricing as the storefront sees it, cart/checkout building blocks — typically from a custom storefront or headless frontend, authenticated with a **storefront token** (scoped, often shorter-lived) rather than the server-to-server Management credential.

## Why the middleware mostly does NOT use it

Our middleware is a **server-to-server sync** between an ERP and the store. The authoritative read/write of catalog, inventory, orders, customers, and price lists is the **REST Management API** (`01`). The Storefront GraphQL API is **read-mostly and storefront-scoped**, so it's the wrong tool for writing ERP data into the store.

It's relevant only if a project also builds or augments a **headless/custom storefront** that should reflect ERP-driven data (e.g. showing customer-specific pricing live). In that case the middleware exposes data the storefront queries; it still syncs via the Management API. Decide per project at G1.5 — most middleware-only pilots (including the DDI pilot) won't load this beyond awareness.

## verify-at-build

- [ ] Storefront token issuance + scopes/expiry.
- [ ] Which fields (pricing in shopper context, customer-group pricing) are needed.
- [ ] Whether the project has a headless storefront at all (else this stays unused).

See `pointers.md` for the doc anchor.
