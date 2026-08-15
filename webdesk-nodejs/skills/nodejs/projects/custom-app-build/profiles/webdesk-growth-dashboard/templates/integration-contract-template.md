---
tier: 2
load_when: ["g_contracts", "integration-work", "webdesk-growth-dashboard"]
description: "Fill-in integration contract for this project's four external systems (GitHub, WordPress, Google Workspace SSO, Google Workspace SMTP), adapted from the base skill's ERP/store-oriented integration-contract.template.md. Drafted at G1.5, client-approved at G-Contracts. No integration code runs against a draft."
---

# Integration Contract — WebDesk Growth Dashboard (fill-in template)

> Adapts `nodejs/templates/integration-contract.template.md` (base skill, ERP/store-shaped) for this project's four non-ERP integrations. Still maps to `_contracts/integration-contract.schema.json` field-for-field where the base schema's fields apply generically (auth, retry_policy, rate_limits, failure_modes); the sync-specific fields (`cadence_per_entity`, `watermark_field`, `conflict_resolution`) are **not applicable** to GitHub/SSO/SMTP (request/response or webhook-driven, not cron-sync) and only partially applicable to WordPress (poll-based reads are cron-adjacent; writes are request/response). Mark `pattern: request-response` or `pattern: webhook` explicitly per system so nobody wires a cron sync onto an integration that doesn't need one — same rule as `nodejs/projects/custom-app-build/knowledge/01-app-shapes.md`'s request/response-vs-sync distinction, applied here.

One contract file per system: `integration-contracts/github.md`, `integration-contracts/wordpress.md`, `integration-contracts/google-workspace-sso.md`, `integration-contracts/google-workspace-smtp.md`.

---

## Header (all four contracts)

```yaml
id: IC-[SYSTEM]-001 # e.g. IC-GITHUB-001
system: [github | wordpress | google-workspace-sso | google-workspace-smtp]
display_name: [FILL IN]
role:
  other # none of these are "system-of-record" for synced business
  # data in the ERP sense — role is descriptive here, not
  # a sync-direction driver
pattern:
  [request-response | webhook] # NEVER "scheduled" for these four — see note above;
  # WordPress reads may be poll-based (see its contract)
schema_version: "1.0.0"
status: draft # draft until G-Contracts; client-approved after
owner: backend_lead
```

---

## GitHub-specific fields (`integration-contracts/github.md`)

- **auth.type:** `unknown` until confirmed — GitHub App JWT + installation token (**verify-at-discovery**, see `integrations/github/pointers.md`).
- **auth.credential_location:** `env: GITHUB_APP_PRIVATE_KEY` (never the key value itself).
- **pattern:** `webhook` (primary — PR/check/deployment/push events) **and** `request-response` (secondary — commit-verification reads, PR-status reads) — a contract may declare both patterns are in use, with each endpoint/event documented under the relevant one.
- **rate_limits:** `null` until verified (`integrations/github/pointers.md`'s at-build checklist) — never invented.
- **retry_policy:** capped attempts + exponential backoff + jitter, terminal on 4xx (except 429), retryable on 429/5xx/timeout.
- **idempotency_key:** `X-GitHub-Delivery` header value, for webhook events; commit SHA / PR number + repo for request-response reads.
- **failure_modes:** api-timeout, duplicate-webhook, rate-limit, token-expiry (installation-token refresh), upstream-5xx — from `nodejs/knowledge/intelligence/failure-scenario-library.md`'s catalog, the subset relevant to a webhook+REST integration (not the ERP-sync-specific rows like watermark-gap or clock-skew, which don't apply to a request/response+webhook pattern).

## WordPress-specific fields (`integration-contracts/wordpress.md`)

- **auth.type:** `basic` (Application Passwords use HTTP Basic Auth) — confirm at discovery.
- **auth.credential_location:** `env: WORDPRESS_APP_PASSWORD_<ENV>` per environment.
- **pattern:** `request-response` for the REST read/draft-write path; `webhook` only if a WordPress webhook is confirmed to exist (`docs/implementation/gap-analysis.md` item 6 — leave this section `null`/absent until confirmed, do not assume).
- **rate_limits:** `null` until verified.
- **failure_modes:** api-timeout, rate-limit (if any), upstream-5xx, schema-drift (native meta field shape changing) — plus the migration-specific failure modes (partial-migration, ID/URL collision) documented separately in the migration's own runbook, not this contract.
- **field_mapping_ref:** for the Case Study/Portfolio migration specifically, points to the row-by-row meta-key mapping table (`knowledge/07-wordpress-integration.md` §"Case Study and Portfolio migration" references the source table in `10_WordPress_Integration_and_Migration.md §5–§6`).

## Google Workspace SSO-specific fields (`integration-contracts/google-workspace-sso.md`)

- **auth.type:** `oauth2` (OIDC Authorization Code + PKCE).
- **pattern:** `request-response` (the OIDC flow itself — authorization redirect, token exchange, token verification).
- **rate_limits:** Google's OIDC endpoints are not typically rate-limit-sensitive for normal login volume; note as `null`/not-applicable rather than inventing a number.
- **failure_modes:** token-expiry (ID token / access token — handled by the standard OIDC flow, not a sync retry), api-timeout on the token-exchange call.

## Google Workspace SMTP-specific fields (`integration-contracts/google-workspace-smtp.md`)

- **auth.type:** `unknown` until confirmed (app-password vs. OAuth2 service account — `integrations/google-workspace/pointers.md`'s at-build checklist).
- **pattern:** `request-response` (each send is a request/response SMTP transaction).
- **retry_policy:** capped attempts + backoff, terminal on permanent-rejection (invalid recipient, 5xx from the SMTP server), retryable on transient 4xx.
- **idempotency_key:** the notification's own dashboard-internal ID (`knowledge/09-google-workspace-smtp.md`'s idempotency note) — never the message content.

---

## Field-mapping table — not applicable to three of the four

Unlike the ERP/store template, GitHub, SSO, and SMTP have no row-by-row business-field mapping table (there is no "ERP field → store field" analog for a webhook event schema or an OIDC claim set) — omit that section for those three contracts. WordPress's contract retains a field-mapping table specifically for the Case Study/Portfolio migration's meta-key mapping, per `nodejs/templates/integration-contract.template.md`'s original stub format.

---

Last reviewed: 2026-08-05 (initial profile build)
