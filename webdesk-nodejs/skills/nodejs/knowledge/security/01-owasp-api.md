---
tier: 2
load_when: ["code-production", "security-topic", "code-review"]
description: "OWASP API Security Top 10 applied to this system, with the Node controls for each."
---

# Security 01 — OWASP API

> The OWASP API Security Top 10 (2023) mapped to concrete controls in this stack. QA's security suite (blueprint §7) tests against these; Code Review flags violations. Read alongside `02-authn-authz.md` and `04-webhook-security.md`.

---

| OWASP API risk                                            | What it means here                                                  | Control                                                                                                                                                         |
| --------------------------------------------------------- | ------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **API1: Broken Object Level Authorization (BOLA)**        | A user reads another tenant's / another user's object by ID         | Tenant scoping at the repository (NODE-104); object-level ownership check in the service, not just "is authenticated". The #1 risk for multi-tenant middleware. |
| **API2: Broken Authentication**                           | Weak/forgeable tokens, no expiry, no revocation                     | JWT access+refresh with rotation + server-side revocation (`02-authn-authz.md`); strong password hashing (argon2/bcrypt); rate-limit auth endpoints.            |
| **API3: Broken Object Property Level Authorization**      | Mass-assignment; over-returning fields                              | Validate + whitelist input properties (NODE-005); serialize responses through an explicit DTO, never `res.json(model)` with internal fields.                    |
| **API4: Unrestricted Resource Consumption**               | Unbounded payloads, pagination, queries                             | Body size limits, mandatory pagination caps, query timeouts, per-route rate limits; no unbounded retries (NODE-101).                                            |
| **API5: Broken Function Level Authorization**             | A non-admin hits an admin route                                     | Per-module RBAC checked server-side on every route (`02-authn-authz.md`); the UI gate is not the control.                                                       |
| **API6: Unrestricted Access to Sensitive Business Flows** | Abuse of sync/bulk endpoints                                        | Auth + rate-limit + idempotency on bulk/sync triggers; the master scope is the only cross-tenant flow and is audited.                                           |
| **API7: Server Side Request Forgery (SSRF)**              | A field that becomes an outbound URL (e.g. webhook/callback config) | Validate + allowlist outbound hosts; never fetch arbitrary user-supplied URLs from the server.                                                                  |
| **API8: Security Misconfiguration**                       | Default creds, verbose errors, missing headers                      | `helmet`, disabled `x-powered-by`, generic error bodies (no stack traces to clients), env-validated config, least-privilege DB user.                            |
| **API9: Improper Inventory Management**                   | Undocumented/old API versions, stale endpoints                      | Versioned routes (`/api/v1`); API surface documented in the contract registry; deprecate explicitly.                                                            |
| **API10: Unsafe Consumption of APIs**                     | Trusting ERP/store responses blindly                                | Validate **external API responses** as untrusted (NODE-005); timeouts, backoff, and circuit-breaking on upstream calls; verify-at-discovery (NODE-008).         |

---

## Baseline controls (apply to every service)

- **HTTPS/TLS everywhere**; HSTS at the edge.
- **`helmet`** for security headers; **CORS** locked to known origins (not `*`).
- **Rate limiting** globally + tighter on auth and bulk routes.
- **Input validation at the boundary** with a schema; reject on mismatch.
- **Output DTOs** — never serialize a raw model (avoids leaking `passwordHash`, internal flags, other tenants' joined data).
- **Generic client errors** + structured server logs with a correlation ID (NODE-007). Never return stack traces or SQL to a client.
- **Least privilege:** the app's DB user can't `DROP`; secrets are per-system and rotatable (`03-secrets-and-config.md`).
- **Dependency hygiene:** OSV/`npm audit` in CI blocks high/critical (blueprint §19).

These feed the QA security tests (CVE/secret/SAST/DAST, authz, data-integrity) at G4/G5.
