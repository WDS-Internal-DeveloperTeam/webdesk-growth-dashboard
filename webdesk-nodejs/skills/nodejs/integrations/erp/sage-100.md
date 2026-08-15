---
tier: 2
load_when: ["integration-erp-active"]
description: "Sage 100 — ERP roadmap stub (not the pilot). Integration path varies (provider/object-model, web services where licensed, ODBC); verify per deployment. Implements _erp-adapter-pattern."
---

# Sage 100 — roadmap stub

> Roadmap, not the pilot. Implements `_erp-adapter-pattern.md`. **Specifics unverified — verify at Discovery (NODE-008).** I am not confident of Sage 100's exact modern API surface; treat the path as unknown until confirmed.

Sage 100 (formerly MAS 90/200) is a separate product line from Sage 300 with a **different and less uniform** integration story. Historically it's reached through a **business-object/provider model (the Sage 100 Business Object Interface / `ProvideX`-based objects)**, third-party connectors, web-services add-ons where licensed, and **ODBC** to the data files. Whether a clean HTTP/JSON API exists for a given install is exactly what we confirm first — do not assume one. Cron/poll pull+push behind the adapter.

## verify-at-discovery

- [ ] Available surface: business-object/provider, any web-services API, or ODBC-only? Which is licensed/enabled?
- [ ] Auth model for the chosen surface; on-prem connectivity/VPN.
- [ ] Entity coverage (items, inventory, customers, sales orders, pricing) read+write vs read-only.
- [ ] Incremental watermark; pagination; throughput limits (record real values — do NOT invent).
- [ ] Sandbox/test company availability.

Implements `_erp-adapter-pattern`; config → an `IC-SAGE100-001` contract, client-approved at G-Contracts.
