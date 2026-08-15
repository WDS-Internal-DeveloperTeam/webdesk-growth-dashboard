---
tier: 2
load_when: ["integration-erp-active"]
description: "Fishbowl Inventory — ERP roadmap stub (not the pilot). Modern REST/JSON API plus a legacy JSON/CSV-over-TCP API. Implements _erp-adapter-pattern. Specifics unverified."
---

# Fishbowl Inventory — roadmap stub

> Roadmap, not the pilot. Implements `_erp-adapter-pattern.md`. Verify specifics at Discovery (NODE-008).

Fishbowl is an inventory/manufacturing system common with QuickBooks shops. It offers a **modern REST API with JSON** (Fishbowl Advanced) covering parts, inventory, purchase orders, and sales orders, and also a **legacy API** that speaks a mix of JSON/CSV over a raw **TCP socket (commonly port 28192)** — awkward and to be avoided where the REST API suffices. Which one a given client has depends on their Fishbowl version/edition, so the first job is confirming that. Treat as cron/poll pull+push behind the adapter; do not assume webhooks into our middleware.

## verify-at-discovery

- [ ] Edition/version → REST (Advanced) vs legacy TCP API; base URL/host+port.
- [ ] Auth (API client/token vs legacy login handshake); session lifetime.
- [ ] Entity coverage (parts/items, inventory, sales/purchase orders, customers) read+write.
- [ ] Incremental watermark availability; pagination; rate limits (record real values — do NOT invent).
- [ ] On-prem/LAN connectivity (legacy is often LAN-local) → deploy/runbook impact.

Implements `_erp-adapter-pattern`; config → an `IC-FISHBOWL-001` contract, client-approved at G-Contracts.
