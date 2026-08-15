---
tier: 2
load_when: ["security-topic"]
description: "API/service security baseline for the Node.js delivery system. OWASP API Top 10, JWT, secrets, webhook HMAC, PII, PCI-scope avoidance, transport, input validation."
---

# Security Baseline — Node.js API / Service

> Cross-cutting security standard for every Node.js project: API services, ERP↔store middleware, dashboards. Platform/integration-specific rules layer on top in each integration arm. This is service/API security — not website/theme security.

---

## The baseline (non-negotiable)

### 1. OWASP API Security Top 10 — designed against, not hoped against

Every API endpoint is reviewed against the OWASP API Top 10. The ones that bite this system hardest:

- **API1 Broken Object Level Authorization (BOLA):** every query is scoped to the caller's tenant + permitted objects. A user requesting `/orders/:id` must be authorized for _that_ order, not just authenticated. In the multi-tenant dashboard, every repository method takes a tenant scope; only the master role crosses tenants.
- **API2 Broken Authentication:** JWT done right (see §JWT). No tokens in URLs, no unsigned tokens, no `alg: none`.
- **API3 Broken Object Property Level Authorization:** never return fields the caller isn't entitled to (mass-assignment in, over-fetch out). Whitelist request bodies; serialize responses through explicit DTOs, not the raw Sequelize model.
- **API4 Unrestricted Resource Consumption:** rate-limit + pagination caps + request-size limits; cron sync runs bounded batches.
- **API5 Broken Function Level Authorization:** per-module, per-action authorization checks on every route, server-side (View/Edit/Delete minimum, plus any extended actions the module defines). The UI hiding a button is not authorization.
- **API6 Unrestricted Access to Sensitive Business Flows:** protect bulk export, role changes, and sync-config changes behind elevated permission + audit.
- **API7 SSRF:** validate/allow-list any outbound URL the app fetches (webhook callbacks, ERP/store base URLs come from config, never from user input).
- **API8 Security Misconfiguration:** secure headers (helmet), no stack traces to clients, no default creds, CORS allow-list (never `*` with credentials).
- **API9 Improper Inventory Management:** version the API; deprecate old versions deliberately; document every route.
- **API10 Unsafe Consumption of 3rd-party APIs:** treat ERP/store responses as untrusted input — validate them, handle 4xx/5xx/timeouts, never blindly persist.

### 2. JWT handling (the dashboard auth model)

- **Access + refresh tokens.** Short-lived access (e.g. 15 min), longer refresh with **rotation** (a used refresh token is invalidated and replaced).
- **Server-side revocation list** (jti or token-family ID) so logout/compromise revokes immediately. A stateless JWT with no revocation is not acceptable for an admin dashboard.
- Sign with a strong secret/asymmetric key from env (never committed). Reject `alg: none`. Verify `exp`, `iss`, `aud`.
- Tokens in the `Authorization: Bearer` header, never in URLs or logs. Refresh tokens in `HttpOnly; Secure; SameSite=Strict` cookies where the architecture allows.

### 3. Secrets

- API keys, tokens, DB URLs, JWT keys, ERP/store credentials live in env / a secret manager — **never** in code, never committed. `.env` in `.gitignore`; ship `.env.example` with keys but no values.
- Secret scanning in CI (pre-commit + pre-merge). A committed secret is a P1 — rotate immediately, don't just delete the commit.
- Token rotation: on staff departure, suspected compromise, and at least annually. Scope tokens to least privilege.

### 4. Webhook HMAC verification

Any inbound webhook (store side — BigCommerce/Shopify) is verified **before** processing:

- Compute the HMAC over the **raw request body** with the shared secret; compare with `crypto.timingSafeEqual` (never `===`). Verify before JSON-parsing into business logic.
- Enforce idempotency: a dedupe key (event id) so a replayed webhook is a no-op. Reject stale timestamps where the source provides them.
- Webhooks are untrusted input — validate the payload shape after signature passes (API10).

### 5. Input validation

- Validate **all** external input at the boundary with a schema validator (zod/Joi/express-validator) — body, query, params, headers. Reject unknown fields; coerce/length-limit strings; bound numbers and array sizes.
- Parameterized queries only. With Sequelize: use the query interface / bind parameters; **no raw string-interpolated SQL**, and only inside repositories.
- Never trust ERP/store payloads — validate before persisting (sync-parity depends on this).

### 6. Transport

- HTTPS/TLS 1.2+ everywhere, including app↔ERP and app↔store. Verify upstream certs (no `rejectUnauthorized: false`).
- HSTS on the dashboard. Strong ciphers only.

### 7. PII handling

- PII (customer email, address, phone, names) **never** logged — not in app logs, not in error messages returned to clients, not in sync-debug dumps. Redact at the logger.
- PII encrypted at rest where the datastore/host supports it; transferred only over TLS.
- GDPR/CCPA per spec: access (export) and erasure (delete) paths exist if customer PII is stored. `data_sensitivity: high` in `project.json` raises the bar (field-level encryption, stricter retention).

### 8. PCI scope avoidance

- **Never touch card data.** Middleware syncs orders/inventory/customers — not card numbers. Payment capture stays in the store's hosted checkout (BigCommerce/Shopify) or a PCI-compliant processor's hosted fields.
- If a spec ever implies card data flows through our service, **stop and escalate** — that expands PCI scope dramatically and is almost never what's intended.

---

## Secure-header set (dashboard + API)

Use `helmet` defaults, then tune:

```
Strict-Transport-Security: max-age=31536000; includeSubDomains
X-Content-Type-Options: nosniff
X-Frame-Options: DENY              (admin dashboard is never iframed by 3rd parties)
Referrer-Policy: strict-origin-when-cross-origin
Content-Security-Policy: (dashboard-specific; no inline scripts — use nonces)
```

CORS: explicit origin allow-list; never `Access-Control-Allow-Origin: *` together with credentials.

---

## Forbidden patterns (auto-blocked by Code Review, P1)

```
eval(...) / new Function(...)              → dynamic code execution
child_process.exec(userInput)             → command injection (use execFile + arg array)
sequelize.query(`... ${userInput} ...`)   → SQL injection (bind params, repository only)
jwt.verify(token, key, {algorithms:['none']})  → unsigned JWT
rejectUnauthorized: false                 → disabled TLS verification
hmac === providedSig                      → timing-unsafe compare (use timingSafeEqual)
console.log(customer.email)               → PII in logs
process.env committed to git              → secret leak
```

---

## Where security is checked per stage

- **Spec (G0):** PM flags regulated/PII data, sets `data_sensitivity`, reserves security review time.
- **Architecture (G1.5):** auth model, tenant isolation, secret storage, webhook trust boundary decided + ADR'd.
- **Contracts (G-Contracts):** each integration contract states auth model + transport; unverified ERP auth marked `verify-at-discovery`.
- **Dev:** Backend role follows this baseline; Code Review blocks forbidden patterns (P1).
- **Sprint QA (G4):** OWASP-API checks, authz tests (BOLA/function-level), webhook idempotency/replay, dependency audit (OSV-Scanner), secret scan, SAST/DAST.
- **Pre-launch (G6):** secrets managed, headers verified, TLS verified, final dependency audit, rotation plan documented.
- **M6:** health score includes a security dimension; dependency scanner runs continuously.

---

## Incident response (P1–P4)

Identify → Contain (revoke token / disable account / pause sync) → Eradicate → Recover → Communicate (client per agreement; breach → regulatory notice within jurisdiction window, e.g. GDPR 72h) → Document (RCA → failure-modes + KB).

- **P1:** PII exposure, credential leak, auth bypass, fund/order tampering — respond within 1h, contain within 4h.
- **P2:** significant prod vuln — 24h / 48h.
- **P3:** staging/non-prod vuln — 1 week.
- **P4:** theoretical, no exploit path — normal cycle.

---

## Anti-patterns

1. Trusting ERP/store responses (API10). 2. Rolling custom crypto/auth without senior approval. 3. Hardcoded credentials. 4. Authorization in the UI only (must be server-side, per route). 5. Stateless JWT with no revocation on an admin dashboard. 6. Ignoring dependency CVE alerts. 7. PII in logs/errors. 8. Letting card data touch the service.

---

Last reviewed: 2026-06-30 (initial Node.js build)
Next review due: 2026-09-30
