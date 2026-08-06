# Trust Boundary Map

**Status:** Draft, derived from the architecture decisions and integration contracts already recorded — this document collects the trust boundaries each ADR/contract already states individually into one map, for reviewer convenience; it does not introduce new boundaries.

## Boundaries

| Boundary | Trusted side | Untrusted / lower-trust side | Enforced by |
|---|---|---|---|
| Browser ↔ `dashboard-web` | `dashboard-web` server-side code | End-user browser input | Standard web input validation; no DB access from this side at all (ADR-0002) |
| `dashboard-web` ↔ `dashboard-api` | `dashboard-api` | `dashboard-web` (still an internal app, but not authorization-authoritative) | `dashboard-api`'s own RBAC checks — never trusts that `dashboard-web` already authorized the request (ADR-0002, ADR-0010) |
| `dashboard-api`/`dashboard-worker` ↔ GitHub | `dashboard-api`/`dashboard-worker`'s GitHub adapter | GitHub webhook payloads, GitHub API responses | Webhook signature verification; response-shape validation (`docs/contracts/github-integration-contract.md`) |
| `dashboard-api` ↔ WordPress | `dashboard-api`'s WordPress adapter | WordPress REST API responses | Response-shape validation; least-privilege Application Password scope (`docs/contracts/wordpress-integration-contract.md`) |
| `dashboard-api` ↔ Google Workspace | `dashboard-api`'s auth adapter | OIDC callback data | ID token signature/claims validation (`docs/contracts/google-workspace-auth-contract.md`) |
| `dashboard-worker` ↔ job trigger system | Handler code | Queue/workflow/cron trigger payload | Per-handler payload validation, trigger-authenticity verification (`docs/contracts/vercel-background-jobs-contract.md`) |
| `dashboard-api`/`dashboard-worker` ↔ `packages/database` | `packages/database` | Calling application code | Model-level validation; connection credentials never leave this package (ADR-0006) |
| Any dashboard code ↔ Service/SEO Library workbook | Dashboard's own schema/import logic | Workbook content | Advisory-only treatment (WDS-014) — the workbook is always the untrusted side, regardless of its own internal "Approval Status" column values (`knowledge/00-scope-and-precedence.md §4`) |
| Any dashboard code ↔ uploaded files | Dashboard's own file-handling logic | Uploaded file content | Type/size validation only — not malware-scanned in V1, an accepted gap (ADR-0014) |

## Special-case boundary: emergency-administrator path

The emergency-admin TOTP login (ADR-0009) crosses the organization's own identity boundary (Google Workspace) — it is trusted only because it is narrowly scoped, logged with high visibility, and limited to a small, explicitly-designated account set. It is the one boundary in this map that intentionally bypasses another boundary (SSO) rather than sitting alongside it, and is treated with correspondingly higher scrutiny in `docs/security/threat-model-plan.md`.

## What this map does not cover

Internal boundaries within a single app's own module structure (e.g., between two NestJS modules inside `dashboard-api`) are not separate trust boundaries for this document's purposes — they share the same authorization context once a request has passed `dashboard-api`'s own RBAC check.
