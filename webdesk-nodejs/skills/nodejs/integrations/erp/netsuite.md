---
tier: 2
load_when: ["integration-erp-active"]
description: "NetSuite — ERP roadmap stub (not the pilot). SuiteTalk REST + SOAP + RESTlets + SuiteQL; strongest/best-documented API of the roadmap. Implements _erp-adapter-pattern. Specifics unverified per-account."
---

# NetSuite — roadmap stub

> Roadmap, not the pilot. Implements `_erp-adapter-pattern.md`. Build only when a real NetSuite project is scoped; verify the account's specifics at Discovery (NODE-008).

NetSuite is Oracle's cloud ERP and likely the **easiest API on the roadmap**: it exposes **SuiteTalk REST Web Services** (modern HTTP/JSON, the path for new integrations), legacy **SuiteTalk SOAP**, custom **RESTlets** (SuiteScript endpoints for logic beyond CRUD), and **SuiteQL** for query. Auth is OAuth 2.0 or Token-Based Authentication (TBA is being phased out — prefer OAuth2 for new builds; confirm what the client's account supports). It is well-documented and sandbox-friendly, so it's the lowest-risk adapter — but it's still cron/poll for our purposes (no assume webhooks into our middleware) unless a specific event mechanism is verified.

## verify-at-discovery

- [ ] Which surface(s): SuiteTalk REST vs RESTlets vs SuiteQL for each entity (items/inventory/customers/orders/pricing).
- [ ] Auth: OAuth2 vs TBA on this account; token rotation; account ID / realm.
- [ ] Rate/concurrency limits (governance units) — record real numbers; do NOT invent.
- [ ] Watermark field for incremental (`lastModifiedDate`-style) per entity; pagination.
- [ ] Sandbox account availability; custom-record/custom-field coverage.

Implements `_erp-adapter-pattern` — `pull`/`push`/`normalize`/`denormalize`/`healthCheck` + capability flags; config → an `IC-NETSUITE-001` contract validating `integration-contract.schema.json`, client-approved at G-Contracts.
