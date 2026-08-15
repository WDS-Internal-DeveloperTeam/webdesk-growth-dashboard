---
tier: 2
load_when: ["discovery", "pm-active"]
description: Discovery is the DEFAULT (~90% of these projects). Deep requirements pass that captures the systems inventory, sync directions/cadence, auth reality, tenancy, dashboard needs, and the client's rough DB/field mapping + API direction. Output = discovery report feeding the spec.
---

# 01 — Discovery Protocol

> Discovery (G0.5) is the **default** for the Node.js Delivery System. Roughly 90% of these projects are ERP↔store middleware or custom-app builds where the requirements, the field mapping, and the API contracts _are_ the product — so they are discovered deliberately, not assumed. Discovery is skipped only for trivial maintenance tickets (record G0.5 `skipped` with a reason). Discovery output feeds `spec.md`.

---

## Why Discovery is default here (not conditional)

On the Shopify donor system Discovery was conditional. For Node middleware it is not, because:

- The deliverable is a mapping between two moving systems (an ERP and a store). Get the mapping wrong and you ship a doomed sync.
- External API surfaces (especially ERPs like DDI Inform, Sage, NetSuite, Acctivate, pc/MRP) are partner-gated and under-documented. You cannot scope from memory.
- Tenancy (per-client + master), timezone-driven cron, and two-way conflict resolution are all decided here.

The single highest-leverage error-prevention step in this system is getting the rough mappings and the sync shape right at Discovery, then client-approving the formalized versions at G-Contracts / G-Schema.

---

## Discovery deep-requirements pass — what you must capture

Work through every block. For anything touching an external API you have not verified, write **"unverified — confirm at Discovery"** and list the open question; never fill a plausible default.

### 1. Systems inventory

- **Which ERP/CRM?** (e.g. DDI Inform, Fishbowl, Sage 300, Sage 100, NetSuite, Acctivate, pc/MRP) — name + version/edition.
- **Which store?** (BigCommerce / Shopify) — plan tier.
- Anything else in the loop (PIM, 3PL/fulfillment, tax, marketing).
- For each: who owns the account, is there a **sandbox / test company**, and what is the auth model.

### 2. Entities to sync

- The concrete list: items, inventory, pricing, customers, orders, categories, images, tracking, etc.
- For each entity, the **system of record** (which side is authoritative).

### 3. Directions

- Per entity: pull, push, or both. If **both**, the **conflict-resolution rule** (last-write-wins by timestamp? source-of-record always wins? field-level merge?). This is load-bearing — write it down even if provisional.

### 4. Cadence expectations

- Per entity: how fresh must it be? ("inventory within 15 min during business hours", "items nightly", "orders near-real-time via store webhook").
- Translate vague asks into a draft per-entity cron cadence (in the client's timezone).

### 5. Data volumes

- Approximate counts: SKUs, customers, orders/day, catalog size. This sizes the first full sync and the load/capacity profile.
- Any known spikes (seasonal sales, catalog re-loads).

### 6. Auth / access reality

- ERP: credential type, where credentials live, token refresh, rate limits (**verify — do not assume**), IP allow-listing / VPN, on-prem vs cloud.
- Store: API key / OAuth, scopes, webhook support.
- The honest blocker question: **is a sandbox available now?** If not, integration code is built against docs + mocks and gated until access arrives.

### 7. Timezone

- The IANA timezone that is the operational clock for all cron schedules, sync windows, displayed timestamps, and report boundaries (blueprint §6). "Nightly at 2am" means the _client's_ 2am. Stored UTC, displayed local. One source of truth: this value + Dashboard Settings → Timezone.

### 8. Tenancy

- **Per-client** dashboard scoped to this client's stores/ERP — always.
- **Master** (super-admin, cross-client) dashboard for retainer monitoring — in scope or not? If yes, confirm it is a central app you host and where health data aggregates.
- Every query is tenant-scoped; only the master role has cross-tenant scope.

### 9. Dashboard module needs

- **SOW-derived modules + Settings** — capture the modules, KPIs, health items, and Settings sections/fields _this SOW_ defines; do not assert a fixed module or Settings-field list. A store/ERP-connection Settings section (Store URL, API Key, Access Token, Client Secret, API Path, …) appears **only because this SOW names a store/ERP**, not as a default. See `_spine/designer-agent/knowledge/01-dashboard-standards.md`.
- The only fixed system contracts: **JWT** auth (access + refresh, rotation, server-side revocation, show/hide password), **per-client + master tenancy**, **per-module RBAC** (View/Edit/Delete minimum, extended per module with Create/Approve/Export/Import/Run/Configure/Manage All where needed), and **Settings → Timezone**.
- Module-specific needs for this scope (e.g. for a sync SOW: sync-status views, mapping editors, reconciliation reports) — derived from what the SOW calls for.

---

## Capture the client's rough DB/field mapping + API direction (load-bearing)

This is the part unique to Node middleware Discovery. During kickoff / Discovery the team and client will sketch:

- **Rough DB / field mapping** — "Inform `ItemNumber` → BigCommerce `sku`", "Inform `QtyOnHand` → BC `inventory_level`", etc. Capture it as a table, even if incomplete or provisional. This becomes the input to draft `data-model.md` (formalized per `02-kickoff-rough-mapping.md`, client-approved at **G-Schema**).
- **API-contract direction** — per system: which endpoints/entities, which direction, expected cadence, auth. Capture it as the seed for draft integration contracts (formalized per `02-kickoff-rough-mapping.md`, client-approved at **G-Contracts**).

Record both **verbatim** in the discovery report. Mark every external-API assumption "unverified — confirm at Discovery" until proven against docs or a sandbox. These rough captures are explicitly DRAFTS — they are not approved by capturing them.

---

## HTML wireframes (D-DES-01)

For any UI in scope (per-client dashboard, master dashboard, mapping editor), deliver **HTML wireframes** — running HTML/CSS served from the preview server, not Figma frames, screenshots, or PSDs. Wireframes show structure and flow (login → dashboard home → module list → module detail), not final visual design. They feed G2 (full HTML design approval). For headless middleware with no UI, note "no UI in scope" and skip.

---

## Discovery process

1. **Confirm scope.** Discovery is default; confirm any constraints (which systems, whether master dashboard is in scope, sandbox availability).
2. **Batch a discovery questionnaire** for client-input items (systems, auth, volumes, cadence, tenancy) — one round, via the human PM. Draw missing-only questions from `03-clarification-questions.md`.
3. **Autonomous research** for what doesn't need the client: read the ERP's public API docs (flag gaps), read the store's API docs, confirm webhook support, note rate-limit documentation (and where it's silent).
4. **Produce the discovery report** (below).
5. **Open G0.5** for PM + client sign-off (CONFIRM / REVISE / RENEGOTIATE).

---

## Discovery report — structure

Save to `<workspace>/discovery-report.md`:

```markdown
# Discovery Report — [Project Name]

Client: [name] Date: [ISO] Build context: [nodejs+bigcommerce | ...]
Integration targets: [erp:ddi-inform, bigcommerce]

## Executive Summary

[3-5 paragraphs: what we're building, the data flow in one line, the biggest unknowns.]

## 1. Systems Inventory

[ERP + version, store + tier, anything else; account ownership; sandbox availability; auth model. Flag unverified items.]

## 2. Entities, Directions, Cadence

| Entity | System of record | Direction | Conflict rule (if two-way) | Draft cadence (client tz) | Verified? |
| ------ | ---------------- | --------- | -------------------------- | ------------------------- | --------- |

## 3. Data Volumes & Capacity Signals

[SKU/customer/order counts; spikes; first-full-sync sizing.]

## 4. Auth / Access Reality

[Per system: credential type, refresh, rate limits (verify), VPN/IP, on-prem/cloud, sandbox status.]

## 5. Timezone

[IANA string + why it matters here.]

## 6. Tenancy

[Per-client always; master dashboard in scope? hosting/aggregation answer.]

## 7. Dashboard Module Needs

[SOW-derived modules + Settings sections/fields + any module-specific needs; fixed-contract notes (JWT, per-client+master tenancy, per-module RBAC [VED min, extended per module], Settings-timezone).]

## 8. Rough DB / Field Mapping (DRAFT — feeds data-model.md, client-approved at G-Schema)

| ERP field | Store/DB field | Entity | Direction | Notes / unverified |
| --------- | -------------- | ------ | --------- | ------------------ |

## 9. Rough API-Contract Direction (DRAFT — feeds integration contracts, client-approved at G-Contracts)

[Per system: endpoints/entities, direction, cadence, auth — all marked draft/unverified as appropriate.]

## 10. HTML Wireframes

[Links to the running HTML wireframes, or "no UI in scope".]

## Key Recommendations & Suggested Spec Adjustments

[Concrete changes vs the initial ask, with rough cost/timeline impact.]

## Risks Identified

[New risks: no sandbox, undocumented rate limits, two-way conflict edge cases, on-prem connectivity.]

## Appendix

[Questionnaire responses, API-doc references, raw notes.]
```

---

## When Discovery should HALT for RENEGOTIATE

- The ERP has no usable API (file/ODBC only, e.g. pc/MRP risk) and the scope assumed REST sync.
- No sandbox and no path to one, blocking the whole integration.
- The client's freshness/throughput ask is impossible on the available API (rate limits make "15-minute inventory" infeasible).
- Tenancy or conflict requirements are fundamentally larger than the ask implied.

Set G0.5 → RENEGOTIATE, project on-hold, scope review with client. Better to halt here than ship a doomed sync.

---

## Discovery quality bar

Good Discovery surfaces what the ask didn't anticipate — an undocumented rate limit, a missing entity on the ERP side, a two-way conflict nobody named, an on-prem ERP behind a VPN. It produces specific data and concrete spec adjustments. A bad Discovery restates the ask, has no rough mapping, flags no risks, and changes nothing. If yours looks like the second, redo it.

---

## Anti-patterns

1. **Coding the ERP from memory.** DDI Inform / Sage / NetSuite specifics must be verified against docs or sandbox. Mark unverified, don't guess.
2. **Treating the rough mapping as approved.** It's a DRAFT until G-Schema / G-Contracts.
3. **Skipping HTML wireframes for a UI project** because "we'll design later" — D-DES-01 requires running HTML, not Figma.
4. **Vague cadence.** "Sync often" is not a cadence. Convert it to a per-entity cron in the client's timezone.
5. **Ignoring tenancy.** Per-client vs master changes the data model and RBAC scope; decide at Discovery.
6. **No volumes.** Without counts you cannot size the first full sync or the capacity profile that feeds SLO/SLA.

---

Last reviewed: 2026-06-30 (initial Node.js build)
Next review due: 2026-09-30
