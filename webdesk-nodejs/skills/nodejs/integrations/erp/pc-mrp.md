---
tier: 2
load_when: ["integration-erp-active"]
description: "pc/MRP — ERP roadmap stub (not the pilot). HIGHEST RISK: FoxPro VFP files via ODBC, likely no real REST API. Implements _erp-adapter-pattern via a file/ODBC adapter. Specifics unverified."
---

# pc/MRP — roadmap stub (HIGHEST RISK)

> Roadmap, not the pilot. Implements `_erp-adapter-pattern.md`. **Specifics unverified — verify at Discovery (NODE-008).** Flag this one to the client early: it is the riskiest ERP on the roadmap.

pc/MRP is a low-cost integrated MRP/accounting system whose data lives in **Visual FoxPro (VFP) free tables**. The realistic integration path is **ODBC via the Microsoft FoxPro VFP driver** (a DSN such as `pcMRPVFP` pointing at the pc/MRP file directory) — i.e. **file/database-level access, very likely with no real REST API and no event/webhook mechanism**. That makes it the highest-risk adapter: read access may be straightforward but **writes directly to FoxPro tables can bypass application logic and corrupt data**, so write-back must be treated with extreme caution (possibly read-only, or staged exports the application imports). This is exactly the "file/ODBC-only source" case the adapter interface anticipates.

## verify-at-discovery

- [ ] Confirm there is genuinely **no supported REST/SOAP API** (don't assume — but expect none).
- [ ] ODBC reachability: VFP driver, DSN, file/directory location, on-prem/LAN connectivity.
- [ ] Table/schema mapping for each entity (items, inventory, customers, orders, pricing) — VFP free-table layout.
- [ ] **Write path** — is any write safe, or read-only? Does pc/MRP offer an import the app validates? (Prefer that over raw table writes.)
- [ ] Incremental: is there a reliable modified-timestamp column, or must we diff full snapshots?
- [ ] Concurrency/locking risks of reading the live VFP files while the app is in use.

Implements `_erp-adapter-pattern` via a **file/ODBC adapter** — `pull` reads VFP tables, `normalize` maps columns to canonical, `push` is gated (read-only or staged import) until a safe write path is verified; config → an `IC-PCMRP-001` contract, client-approved at G-Contracts.
