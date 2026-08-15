---
tier: 2
load_when:
  ["pt-integration-middleware", "integration-work", "g_contracts", "backend-active", "planning"]
description: Why every middleware project wires ≥2 contracts (system-of-record ERP + commerce store), each registered in integration-contracts/, and how the ERP↔store field mapping works. The product is the mapping.
---

# Dual Integration — two contracts, one canonical model

> An integration-middleware project is, by definition, **at least two integrations**: the **system-of-record** (an ERP/CRM) and the **commerce store**. Neither is optional — middleware with one side is just an API client. This file covers why there are two contracts, how they're registered, and how the field mapping between them works. Read it with `nodejs/integrations/erp/_erp-adapter-pattern.md` (the adapter interface), `_contracts/integration-contract.schema.json` (the contract shape), and the `gates.md` for this type (G-Contracts is where the client signs the mapping). **No integration code runs against a `draft` contract** (NODE-008).

---

## 1. Always ≥2 contracts

The pilot has two; many projects have exactly two; some have more (e.g. two stores against one ERP, or a CRM + an ERP). The rule is: **every external system is one contract**, registered and client-approved.

|                        | System-of-record (ERP/CRM)                         | Commerce store                                                |
| ---------------------- | -------------------------------------------------- | ------------------------------------------------------------- |
| Pilot example          | DDI Inform                                         | BigCommerce                                                   |
| `role`                 | `system-of-record`                                 | `commerce`                                                    |
| Authoritative for      | items, inventory, pricing, categories              | orders, and usually customers (confirm per contract)          |
| Typical `sync.pattern` | `scheduled` (poll/cron — ERPs rarely do webhooks)  | `webhook` where supported + `scheduled` reconciliation        |
| Typical directions     | pull (read from ERP), push for write-back (orders) | webhook/pull orders & customers, push inventory/pricing/items |
| Contract id            | `IC-DDI-001`                                       | `IC-BIGCOMMERCE-001`                                          |

The asymmetry is the whole point: the ERP **owns** what a product is and how much stock/price it has; the store **owns** what was bought and by whom. The middleware moves the ERP's truth _to_ the store and the store's truth _back to_ the ERP, each in the direction that respects who owns the data.

---

## 2. The registry + per-system contracts

Contracts live in the project workspace, not in the skill:

```
integration-contracts/
├── _registry.md              index: every contract, id, system, role, status, owner
├── ddi-inform.md             IC-DDI-001 (validates against integration-contract.schema.json)
├── ddi-inform.fields.md      the row-by-row ERP→store field mapping (client signs this)
├── bigcommerce.md            IC-BIGCOMMERCE-001
└── bigcommerce.fields.md     the row-by-row store→ERP field mapping
```

- Each `<system>.md` is one contract object validating against `_contracts/integration-contract.schema.json`.
- Each carries `status: draft` until **G-Contracts**, where the PM secures **client approval** and `status` flips to `client-approved` with `approved_by` / `approved_at`.
- The `_registry.md` is the human index; `project.json.integration_contracts[]` references them for the loader.
- Use `nodejs/templates/integration-contract.template.md` to author each one.

**Unverified specifics stay `null`.** Rate limits, endpoints, and entity coverage we have not confirmed against real ERP docs or a sandbox are left `null` and tagged _verify-at-discovery_. Do not fabricate them to make the contract look complete (NODE-008). The schema explicitly permits nulls pre-Discovery for this reason.

---

## 3. The canonical model is the meeting point

Neither system's field names leak into the engine. Each side's adapter `normalize`s its records into the **canonical model** (defined in `_erp-adapter-pattern.md` §3), and the field-mapping table is really two mappings that meet in the middle:

```
   DDI Inform fields ──(adapter.normalize)──►  CANONICAL  ◄──(adapter.normalize)── BigCommerce fields
   item_no, descr, ...                          Item{sku,name,...}                 sku, name, ...
```

So the "ERP field → store field" mapping the client signs off on is, mechanically, **ERP field → canonical field → store field**. The canonical field is the stable spine; either side can change its native names without touching the other side. This is why the engine is portable across ERPs.

Every canonical record carries:

- `externalId` — the source system's primary key (the join key).
- `source` — `'erp:ddi-inform'` / `'bigcommerce'` (provenance + conflict resolution).
- `modifiedAt` — UTC; the watermark source.

---

## 4. The field-mapping table (the deliverable the client signs)

This table **is** the product. Author it per system in `<system>.fields.md`; the client approves it at G-Contracts. One row per field, per entity:

| Entity    | ERP field    | Canonical field               | Store field       | Direction | Transform       | Notes               |
| --------- | ------------ | ----------------------------- | ----------------- | --------- | --------------- | ------------------- |
| items     | `item_no`    | `Item.sku`                    | `sku`             | ERP→store | trim, uppercase | join key            |
| items     | `descr`      | `Item.name`                   | `name`            | ERP→store | —               |                     |
| items     | `web_desc`   | `Item.description`            | `description`     | ERP→store | strip HTML      | optional            |
| inventory | `qty_avail`  | `Inventory.quantityAvailable` | `inventory_level` | ERP→store | clamp ≥ 0       | per-location        |
| pricing   | `list_price` | `Pricing.unitPrice`           | `price`           | ERP→store | 2dp, currency   |                     |
| orders    | —            | `Order.externalId`            | `id`              | store→ERP | —               | store-authoritative |
| customers | —            | `Customer.email`              | `email`           | store→ERP | lowercase       | store-authoritative |

(Field names above are **illustrative** — DDI Inform's real field names are confirmed at Discovery against the actual API/sandbox, never coded from memory.)

Rules for the table:

- **Direction is explicit per row.** A row's direction must be consistent with the contract's `directions` and the entity's authority. You cannot map `orders.id` ERP→store — orders are store-authoritative.
- **Transforms are explicit** (trim, case, currency rounding, HTML strip, unit conversion). A silent transform is a bug waiting to surprise the client.
- **The join key is marked.** Usually `sku` for items/inventory/pricing, `externalId` for orders/customers.
- **No silent drops.** A field the client expects that we don't map is called out, not omitted.

---

## 5. How the two contracts drive one engine

The sync engine (`02-sync-engine.md`) loops over `(tenant, entity)` and asks the contract two things: _which adapter_ and _which direction_. Worked flow for the pilot:

```
inventory (every 15 min):  pull DDI Inform → normalize → upsert canonical → push BigCommerce
pricing   (hourly):        pull DDI Inform → normalize → upsert canonical → push BigCommerce
items     (nightly):       pull DDI Inform → normalize → upsert canonical → push BigCommerce
orders    (webhook+poll):  BigCommerce webhook/poll → normalize → upsert canonical → push DDI Inform (write-back)
customers (webhook+poll):  BigCommerce → normalize → upsert canonical → push DDI Inform
```

Notice the engine code is identical per entity — only the **adapter** and **direction** (from the contract) differ. There is no `if (system === 'ddi-inform')` branch anywhere in the engine.

---

## 6. Adding a third system (or swapping the store)

Because each system is a contract + an adapter behind one interface:

1. Draft a new contract (`integration-contracts/<system>.md`), leave unverified fields `null`.
2. Write the field-mapping table; get client sign-off at G-Contracts.
3. Implement the adapter against the interface; the engine is untouched.
4. Add its cadence to the scheduler via the contract.

Swapping BigCommerce for Shopify is exactly this: a new contract + the `integrations/shopify/` module (loaded only if it's in `integration_targets`), zero engine changes. That portability is the return on keeping the canonical model and the two-contract discipline.

---

Last reviewed: 2026-06-30 by Claude (initial build)
