---
tier: 2
load_when: ["g_contracts", "integration-work", "integration-erp-active", "planning", "g1_5"]
description: "Fill-in integration-contract DOC mapping 1:1 to integration-contract.schema.json. Drafted at G1.5, CLIENT-APPROVED at G-Contracts. No integration code runs against a draft."
---

# Integration Contract — fill-in template

> One contract per external system (one ERP, or one store). This doc maps 1:1 to
> `_contracts/integration-contract.schema.json` — each heading is a schema field.
> Replace every `[FILL IN]`. Fields tagged **verify-at-discovery** must be left
> `null` until confirmed against real docs or a sandbox — **never invent** API
> surface (NODE-008). The matching JSON entry goes in the Integration Contract
> Registry; this Markdown is the human-readable, client-signed companion.
>
> **Lifecycle.** Drafted at **G1.5** from Discovery/kickoff mappings →
> **client-approved at G-Contracts** (PM + client) → only then may integration
> code be written. A contract with `status: draft` is off-limits for code
> (NODE-008). Two-way contracts (`pull` and `push`) MUST define
> `sync.conflict_resolution`.

---

## Worked example header (partial)

```yaml
id: IC-DDI-001 # ^IC-[A-Z0-9-]+$
system: ddi-inform # matches project.integration_targets
display_name: DDI Inform ERP
role: system-of-record # ERP is authoritative for items/inventory/pricing
schema_version: "1.0.0" # const — do not change
status: draft # draft until G-Contracts; client-approved after
owner: backend_lead
```

---

## Required fields

### id

`[FILL IN]` — Contract ID, pattern `^IC-[A-Z0-9-]+$` (e.g. `IC-DDI-001`, `IC-BIGCOMMERCE-001`).

### system

`[FILL IN]` — Canonical system key matching `project.integration_targets` (e.g. `ddi-inform`, `bigcommerce`, `shopify`, `netsuite`).

### role

`[FILL IN]` — one of `system-of-record` | `commerce` | `other`. ERP → `system-of-record`; store → `commerce`.

### directions

`[FILL IN]` — array, non-empty, from `pull` | `push`. `pull` = middleware reads FROM this system; `push` = middleware writes TO it. List both for two-way (then `conflict_resolution` is required).

### entities

`[FILL IN]` — array from `items` | `inventory` | `orders` | `customers` | `pricing` | `categories` | `shipments` | `other`. Which business entities this contract covers.

### auth

- **type**: `[FILL IN]` — `api-key` | `oauth2` | `basic` | `token` | `mtls` | `vpn+credential` | `unknown`. `unknown` is valid pre-Discovery — **verify-at-discovery** (DDI Inform is often partner/credential-gated).
- **credential_location**: `[FILL IN]` — where the secret lives, e.g. `env: DDI_API_TOKEN`. Never the secret value itself (NODE-004).
- **scopes**: `[FILL IN or omit]` — OAuth scopes / permission grants.
- **token_refresh**: `[FILL IN or omit]` — refresh/rotation strategy (token-expiry is a known failure mode). **verify-at-discovery.**
- **notes**: `[FILL IN or omit]`.

### sync

- **pattern**: `[FILL IN]` — `scheduled` (cron pull/push — ERP default) | `webhook` (store side) | `polling`.
- **cron**: `[FILL IN or null]` — 5-field expression, interpreted in `timezone_source`, NOT server-local (e.g. `0 2 * * *` = the client's 2 a.m.).
- **timezone_source**: `[FILL IN]` — defaults to `project.timezone` (Dashboard Settings → Timezone). Never the server's local tz.
- **cadence_per_entity**: `[FILL IN or omit]` — per-entity cron overrides (e.g. inventory every 15 min, items nightly).
- **incremental**: `[FILL IN]` — `true` if subsequent runs sync from a watermark (first run = full). Must be resumable on kill.
- **watermark_field**: `[FILL IN or null]` — e.g. `modified_at`. Guards the watermark-gap failure mode. **verify-at-discovery.**
- **conflict_resolution**: `[FILL IN or null]` — REQUIRED if `directions` has both `pull` and `push` (e.g. `system-of-record wins`, `last-write-wins by updated_at`).
- **overlap_policy**: `[FILL IN]` — `skip-if-running` (default) | `queue` | `allow-overlap`. A slow run must not stack on the next tick.

### schema_version

`"1.0.0"` — const. Do not change.

### owner

`[FILL IN]` — internal owner (role/email), e.g. `backend_lead`.

### status

`[FILL IN]` — `draft` | `client-approved`. Stays `draft` until G-Contracts. **No integration code against a draft (NODE-008).**

---

## Important optional fields

### display_name

`[FILL IN or omit]` — human-readable name, e.g. `DDI Inform ERP`.

### base_url

`[FILL IN or null]` — API base URL. **verify-at-discovery** — leave `null` if unconfirmed.

### api_version

`[FILL IN or null]` — pinned API version (e.g. BigCommerce `v3`). Enforced by architecture fitness tests. **verify-at-discovery.**

### rate_limits

`[FILL IN or null]` — `{ requests_per_window, window_seconds, concurrency, notes }`. **verify-at-discovery — leave null, do NOT invent.**

### retry_policy

- **max_retries**: `[FILL IN]` — cap per request (enforced by fitness tests; never unbounded — NODE-101).
- **backoff**: `[FILL IN]` — `fixed` | `linear` | `exponential` | `exponential-jitter`.
- **base_delay_ms**: `[FILL IN or omit]`.
- **dead_letter**: `[FILL IN]` — `true` if exhausted retries go to a DLQ (feeds queue-recovery / webhook-replay runbooks).

### idempotency_key

`[FILL IN or null]` — dedupe strategy for pushes/webhooks, e.g. `X-Idempotency-Key` header or `{entity}:{external_id}:{updated_at}`. Guards duplicate-webhook (NODE-102).

### pagination

`[FILL IN or null]` — `{ style: page|cursor|offset|link-header|none, page_size, notes }`. **verify-at-discovery.**

### field_mapping_ref

`[FILL IN or null]` — path to the row-by-row field-mapping table (e.g. `integration-contracts/ddi-inform.fields.md`) the client signs off on at G-Contracts. See the stub below.

### deprecation_date

`[FILL IN or null]` — date the contract/API version sunsets, if known.

### failure_modes

`[FILL IN]` — list each in-scope failure mode + handling (pre-flight rule: list BEFORE writing integration code). Each entry: `{ mode, handling }` where `mode` ∈ `api-timeout` | `duplicate-webhook` | `partial-sync` | `overlapping-sync` | `rate-limit` | `token-expiry` | `out-of-order` | `clock-skew` | `watermark-gap` | `upstream-5xx` | `schema-drift` | `other`.

### approved_by / approved_at

`[FILL IN at G-Contracts]` — internal approver (PM) and timestamp. Client approval evidence is referenced in the gate notes.

---

## Field-mapping table (stub → `field_mapping_ref`)

The row-by-row mapping the client approves at G-Contracts. This is the **only**
place ERP-specific field names appear (the adapter's `normalize` reads it); the
sync engine and dashboard speak canonical only.

| ERP field    | Store field       | Direction   | Transform                       | Notes                             |
| ------------ | ----------------- | ----------- | ------------------------------- | --------------------------------- |
| `[FILL IN]`  | `[FILL IN]`       | pull/push   | `[FILL IN: e.g. trim, uom map]` | `[FILL IN: required? nullable?]`  |
| `ItemNumber` | `sku`             | pull        | uppercase, trim                 | join key; ERP is system-of-record |
| `QtyOnHand`  | `inventory_level` | pull        | clamp ≥ 0                       | inventory entity; 15-min cadence  |
| `[FILL IN]`  | `[FILL IN]`       | `[FILL IN]` | `[FILL IN]`                     | `[FILL IN]`                       |

> Add one row per mapped field. Unverified ERP field names stay `[FILL IN]` and
> are flagged **verify-at-discovery** — do not guess them (NODE-008).

---

Last reviewed: 2026-06-30 by Claude (initial build)
