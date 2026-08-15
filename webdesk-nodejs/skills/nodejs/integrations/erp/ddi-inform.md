---
tier: 2
load_when: ["integration-erp-active"]
description: "DDI System Inform ERP — the pilot adapter (wholesale distribution). Documents what's KNOWN at a high level, an explicit verify-at-discovery checklist, and how it implements _erp-adapter-pattern. Exact endpoints/auth/fields are NOT verified — do not code from memory."
---

# DDI System — Inform ERP (PILOT)

> **Honesty first (NODE-008):** I have NOT verified DDI Inform's exact API endpoints, request/response shapes, auth flow, or rate limits. Everything specific below is marked **verify-at-discovery**. What follows is the high-level, defensible knowledge plus the checklist that turns "verify-at-discovery" into a real contract. The pilot is built against verified docs + a sandbox/test company, or against mocks until those exist — never from assumed endpoints.
>
> Implements `_erp-adapter-pattern.md`. Read that first.

---

## What is KNOWN (high level, defensible)

- **DDI Inform** is a wholesale-distribution ERP (now part of **Advantive**), used by 1000+ North American distributors across electrical, janitorial, packaging, HVAC, etc. It is the **system-of-record** for items, inventory, customer-specific pricing, and orders — the authoritative side for our middleware.
- DDI markets **APIs / web services** for connecting Inform to ecommerce, BI (an "ARW API" for reporting/BI tools), tax engines, and EDI. There is a documented pattern of integrating Inform via web services (e.g. third-party connectors). So **an integration surface exists** — its exact shape is what we verify.
- Access is **partner/credential-gated** in practice — not an open public API you self-serve. Getting credentials + (ideally) a sandbox/test company is a discovery dependency, and is one of the blueprint §20 confirm-points.
- **Most likely poll/cron pull+push, not webhook-driven.** Treat `capabilities.supportsWebhooks = false` as the working assumption. This is precisely why the cron sync engine + reconciliation is the load-bearing core of the pilot, and why the adapter interface matters more than DDI's specifics.

### Working assumptions for the adapter (until verified)

```js
// integrations/erp/ddi-inform/adapter.js — capability flags, ALL pending verification
static capabilities = {
  auth: 'unknown',            // verify: token? api-key? partner credential? OAuth?
  supportsWebhooks: false,    // assume poll/cron; verify there's truly no event push
  supportsIncremental: null,  // verify a modified-since watermark exists per entity
  supportsPush: null,         // verify we can write orders/customers back
  entities: [],               // verify coverage: items, inventory, customers, orders, pricing
  pagination: 'unknown',      // verify page/cursor/offset + page size
  rateLimits: null,           // DO NOT invent — verify and record
};
```

---

## verify-at-discovery checklist (the first task on this account)

Until each is confirmed against DDI docs or a sandbox, the matching contract field stays `null`/`unknown` and is flagged.

- [ ] **API surface** — which API? (Inform web services vs eCommerce Pro API vs ARW/BI API.) Base URL(s), protocol (REST/JSON? SOAP? other?), endpoint list per entity. Do NOT assume REST.
- [ ] **Auth** — mechanism (token / api-key / partner credential / OAuth2 / VPN+credential?), how credentials are issued, token lifetime + refresh/rotation (token-expiry is a named failure mode).
- [ ] **Rate limits** — documented limits, concurrency caps, throttling behavior, retry guidance. Record real numbers; leave `rate_limits` null until then.
- [ ] **Entity coverage** — confirm read/write for **items, inventory, customers, orders, pricing** (and categories/shipments if in scope). Note customer-specific & branch-level pricing — DDI is known for it; confirm how it's exposed.
- [ ] **Incremental support** — is there a reliable `modified-since` watermark per entity? Field name + semantics (does every edit bump it?). Determines `supportsIncremental` + `watermark_field`; gaps → reconciliation strategy.
- [ ] **Pagination** — style (page/cursor/offset), max page size, stable ordering for resumable pulls.
- [ ] **Multi-branch / multi-location** — inventory and pricing are branch-level; confirm how locations map to canonical `Inventory.locationCode`.
- [ ] **Push semantics** — can we write orders/customers back? Idempotency support (any provider idempotency key, or do we synthesize one)?
- [ ] **Sandbox / test company** — is a non-production environment available? (§20 confirm-point — unblocks the first adapter; until then, build against mocks.)
- [ ] **Connectivity** — cloud-hosted vs on-prem behind a VPN? On-prem changes deploy + runbook design (blueprint §15) and the `auth.type` (`vpn+credential`).
- [ ] **Error model** — HTTP/SOAP fault shapes, partial-failure behavior on batch writes, what a duplicate/rejected push looks like.

---

## How it implements `_erp-adapter-pattern`

Once verified, DDI is "just another adapter" behind the common interface — no engine changes.

- **`pull(entity, sinceWatermark)`** — calls the verified DDI read endpoint(s) for the entity, paginates per the verified style, yields raw records. `sinceWatermark === null` → full sync (first run); else incremental from the verified watermark field.
- **`normalize(entity, raw)`** — the ONLY place DDI field names appear. Maps DDI item/inventory/customer/order/pricing fields → the canonical model. Branch-level inventory/pricing map to `locationCode`/`priceListRef`. The row-by-row table is the contract's `field_mapping_ref`, **client-approved at G-Schema/G-Contracts**.
- **`push(entity, records)`** — denormalizes canonical → DDI payloads for write-back entities (orders/customers, if supported), idempotent per record (NODE-102), capped retries + backoff + DLQ (NODE-101).
- **`getSyncState`/`setSyncState`** — inherited base; per-tenant, per-entity watermark in `sync_state`.
- **`healthCheck()`** — a cheap authenticated call (verify which) for the dashboard + G5.5 monitoring.
- **Sync defaults** — `scheduled` pattern; per-entity cadence (e.g. inventory frequent, pricing/items less so — set with the client at G-Contracts), timezone from Dashboard Settings, `skip-if-running` overlap, nightly reconciliation.

### Pilot integration contract (skeleton — unverified fields null)

Validates against `_contracts/integration-contract.schema.json`. Status stays `draft` until **G-Contracts**; no integration code against a draft (NODE-008).

```jsonc
{
  "id": "IC-DDI-001",
  "system": "ddi-inform",
  "display_name": "DDI Inform ERP",
  "role": "system-of-record",
  "directions": ["pull", "push"], // verify push scope
  "entities": ["items", "inventory", "customers", "orders", "pricing"], // verify coverage
  "auth": { "type": "unknown", "credential_location": "env: DDI_API_TOKEN", "token_refresh": null },
  "base_url": null, // verify-at-discovery
  "api_version": null, // verify-at-discovery
  "rate_limits": null, // verify — do NOT invent
  "retry_policy": {
    "max_retries": 5,
    "backoff": "exponential-jitter",
    "base_delay_ms": 500,
    "dead_letter": true,
  },
  "idempotency_key": "{entity}:{externalId}:{modifiedAt}", // until a provider key is confirmed
  "pagination": null, // verify style + page_size
  "sync": {
    "pattern": "scheduled",
    "cron": null, // set per-entity with client
    "timezone_source": "project.timezone",
    "cadence_per_entity": [], // e.g. inventory */15, pricing hourly, items nightly — confirm
    "incremental": null, // verify watermark exists
    "watermark_field": null, // verify field name
    "conflict_resolution": "system-of-record wins (ERP) for items/inventory/pricing; store wins for orders",
    "overlap_policy": "skip-if-running",
  },
  "schema_version": "1.0.0",
  "field_mapping_ref": "integration-contracts/ddi-inform.fields.md", // client-approved
  "owner": "backend_lead",
  "failure_modes": [
    { "mode": "api-timeout", "handling": "capped retry + exponential-jitter; DLQ on exhaustion" },
    { "mode": "rate-limit", "handling": "respect verified limits; backoff; concurrency cap" },
    { "mode": "token-expiry", "handling": "refresh/rotate per verified flow; re-auth + resume" },
    {
      "mode": "watermark-gap",
      "handling": "nightly reconciliation re-pull window; divergence report",
    },
    { "mode": "partial-sync", "handling": "resume from persisted watermark; idempotent upsert" },
    { "mode": "overlapping-sync", "handling": "skip-if-running" },
    {
      "mode": "schema-drift",
      "handling": "normalize() throws + alerts; record to DLQ, do not silent-drop",
    },
  ],
  "status": "draft",
}
```

**Bottom line:** the adapter interface, cron engine, reconciliation, and contract are real and reusable now. DDI's exact endpoints/auth/fields are deliberately left unverified — confirm them at Discovery against docs + a sandbox, then fill the contract and the field map. Do not code against assumed DDI specifics.
