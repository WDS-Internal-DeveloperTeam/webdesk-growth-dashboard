---
tier: 2
load_when: ["integration-erp-active"]
description: "Sage 300 — ERP roadmap stub (not the pilot). Sage 300 Web API (HTTP/JSON, Swagger/OpenAPI) plus older COM/.NET and ODBC. Implements _erp-adapter-pattern. Specifics unverified."
---

# Sage 300 — roadmap stub

> Roadmap, not the pilot. Implements `_erp-adapter-pattern.md`. Verify specifics at Discovery (NODE-008).

Sage 300 (formerly Accpac) exposes a **Sage 300 Web API** over HTTP(S) returning **JSON, documented with Swagger/OpenAPI**, supporting GET/POST/PATCH against AR/AP/IC/OE modules — a usable modern surface where it's installed and enabled. Older integrations also reach Sage 300 through its **COM/.NET object model (SDK)** or directly via **ODBC** to the database; expect to confirm which path a client's deployment supports, since the Web API has to be installed/configured server-side and isn't always present. Cron/poll pull+push behind the adapter; no assumed webhooks.

## verify-at-discovery

- [ ] Web API installed + reachable? Base URL (`/sage300webapi`), version, auth (basic/token).
- [ ] If no Web API: COM/.NET SDK vs ODBC fallback (read-only risk; write path?).
- [ ] Entity/module coverage (items/IC, inventory, customers/AR, orders/OE, pricing) read+write.
- [ ] Incremental watermark per entity; pagination; rate/throughput limits (record real values).
- [ ] On-prem connectivity/VPN → deploy + runbook impact.

Implements `_erp-adapter-pattern`; config → an `IC-SAGE300-001` contract, client-approved at G-Contracts.
