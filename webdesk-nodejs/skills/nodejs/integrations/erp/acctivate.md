---
tier: 2
load_when: ["integration-erp-active"]
description: "Acctivate — ERP roadmap stub (not the pilot). QuickBooks-companion inventory; API + SQL Server/ODBC. Verify whether a real write API exists. Implements _erp-adapter-pattern."
---

# Acctivate — roadmap stub

> Roadmap, not the pilot. Implements `_erp-adapter-pattern.md`. **Specifics unverified — verify at Discovery (NODE-008).**

Acctivate is an inventory/order-management system that runs alongside QuickBooks, backed by **SQL Server**. Integration is typically via its **API and/or direct SQL/ODBC** access to the underlying database; the existence and completeness of a supported **write** API (vs read-only reporting access) is the key unknown to confirm — direct DB writes are risky and may bypass business rules, so we only do that if there is genuinely no API. Cron/poll pull+push behind the adapter; no assumed webhooks.

## verify-at-discovery

- [ ] Supported API surface for read AND write per entity, vs SQL/ODBC read-only.
- [ ] Auth model; on-prem connectivity/VPN; QuickBooks coupling implications.
- [ ] Entity coverage (items, inventory, customers, orders, pricing) read+write.
- [ ] Incremental watermark; pagination; rate/throughput limits (record real values).
- [ ] Sandbox/test DB availability; whether writes must go through API to preserve business logic.

Implements `_erp-adapter-pattern`; config → an `IC-ACCTIVATE-001` contract, client-approved at G-Contracts.
