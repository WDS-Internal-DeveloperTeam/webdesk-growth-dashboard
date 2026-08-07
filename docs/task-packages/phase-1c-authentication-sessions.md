# Phase 1C Task Package — Authentication and Session Management

**Status:** Authorized to execute. Unlike Phase 1B (which went through a separate plan-then-approve
step), this package is written concurrently with execution: the user supplied the Phase 1C brief
directly in chat and explicitly confirmed "begin Phase 1C now" plus the one blocking setup
decision (provisioning model) in the same turn. This document is the scope-of-record for that
authorization — grounded in the already-approved Phase 0 sources below, not a new architecture
decision.

**A note on provenance:** the original conversational brief text is not repeated verbatim here
because it was not itself persisted to a file mid-session and this document was authored after a
context compaction. Rather than reconstruct it from memory of a summary, this package re-derives
scope directly from the primary, already-approved sources it must have been grounded in (ADR-0008,
ADR-0009, ADR-0017, `docs/contracts/google-workspace-auth-contract.md`,
`docs/security/threat-model-plan.md`, profile `knowledge/05-google-workspace-sso-and-local-admin.md`,
and `docs/phase-plans/phase-1-foundation-plan.md` Tasks 4/5) plus the two decisions the user
confirmed directly in this session. If anything below conflicts with the user's actual original
intent, it supersedes this document — flag and correct rather than silently defer to this text.

---

## 1. Task ID

`PHASE-1C-TASK-4-5-AUTHENTICATION-SESSIONS`

Corresponds to `docs/phase-plans/phase-1-foundation-plan.md`'s **Task 4 — Authentication** and
**Task 5 — Sessions**, executed together as one phase (the same renaming pattern Phase 1A/1B
already established for Tasks 1 and 3).

## 2. Dependencies — verified, not assumed

| Check                                  | Result                                                                                                                                                                                                                     |
| -------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Phase 1B approved, SHA recorded        | **Confirmed.** `docs/project-state/phase-1b-approval-checklist.md` Sign-off: approved 2026-08-07, commit `80bd118b252ba2292af40d2ac8cecd217257ebc4`, merged `df8cb6f`. `project.json.gates[]` has `G-Schema: passed`.      |
| First-login provisioning model decided | **Confirmed this session** — pre-provisioned only. Google SSO links/activates an existing admin-created `users` record matched by email; an unmatched login is rejected with a generic message, never auto-creates a user. |
| Explicit go-ahead to begin Phase 1C    | **Confirmed this session**, in chat.                                                                                                                                                                                       |
| Google Workspace OAuth client details  | **Still unconfirmed** (client ID, redirect URIs) — does not block code-level completion; implementation is built and tested against mocked/test OIDC configuration per §12 below, real credentials wired at deploy time.   |
| Emergency-administrator account list   | **Still unconfirmed** — does not block building the emergency-auth _mechanism_; no real admin accounts are seeded, only a provisioning script an operator can run once a real list exists (§9).                            |

## 3. Purpose

Turn ADR-0008/ADR-0009's already-approved architecture into a real, tested authentication and
session-management foundation: Google Workspace OIDC login, a narrow restricted local
emergency-administrator TOTP path, and dashboard-issued session cookies — the first thing every
later module (RBAC, audit, business modules) will sit behind.

## 4. In scope

- Minimal `users` table — identity only (email, display name, account status, last login,
  timestamps, soft delete). **Not** the full user-management CRUD/admin UI (`docs/phase-plans/phase-1-foundation-plan.md`
  Task 8 — separate, later authorization).
- `external_auth_identities` — Google `sub` claim → `users` row mapping.
- `emergency_admin_credentials` — argon2id password hash, AES-256-GCM-encrypted TOTP secret,
  lockout counters, linked to a `users` row.
- `sessions` — opaque, server-hashed session tokens; ≤7-day absolute expiry; revocation with
  reason; the two-step emergency-login flow modeled as a pending→elevated session, not a separate
  table.
- `auth_lockout_state` — generic scope+identifier lockout/rate-limit tracking (DB-backed, not
  in-memory — Vercel Functions are stateless).
- `recovery_requests` — foundation only: request + second-distinct-administrator approval/denial
  for a locked emergency account, per knowledge/05's separation-of-duties requirement. No
  self-service recovery, no full workflow UI.
- `auth_events` — narrow, login-scoped event log covering exactly the events knowledge/05 §"Login
  audit events" requires. **Not** the general-purpose ADR-0017 audit-log subsystem (Task 7,
  separate authorization) — structured so Task 7 can later adopt/migrate it, not a competing
  system.
- `dashboard-api` `AuthModule`: Google OIDC start/callback, logout, session-info, emergency
  login (password step), emergency TOTP (second step) endpoints.
- Session cookie: httpOnly, Secure, SameSite — following `nodejs/knowledge/frontend/01-react-next-standards.md`'s
  preference over `localStorage`.
- CSRF defense: OAuth `state` + PKCE for the SSO flow; SameSite cookies + an Origin-header
  validation guard for the other state-changing endpoints (no `csurf`/deprecated CSRF library —
  unmaintained, and the OAuth flow's own `state` parameter already covers its own risk).
- Emergency-admin provisioning: a non-HTTP, operator-run CLI script only — no self-service
  account creation (ADR-0009 is explicit on this).
- `dashboard-web` minimal auth UI: sign-in, callback landing, error/access-denied, session-expired,
  logout, emergency-admin login + TOTP challenge.
- Unit + integration + e2e tests per §21-style coverage (password/TOTP correct and incorrect,
  forged/expired token rejection, lockout, session expiry/revocation, domain rejection).
- STRIDE pass for "Authentication" and "Session handling" per `docs/security/threat-model-plan.md`'s
  required coverage (Task 4/5's own explicit security-check requirement).

## 5. Out of scope — explicitly, to prevent scope creep

- RBAC / roles / permissions (Task 6, separate authorization).
- The general-purpose ADR-0017 audit-log subsystem and any audit admin UI (Task 7).
- User-management CRUD/admin UI beyond the minimal identity table (Task 8).
- Vercel Function handler deployment wiring (infra, not auth logic).
- Creating a real Google OAuth client, or testing against a real Workspace account (no credentials
  exist; `docs/contracts/google-workspace-auth-contract.md` "Test requirements" is satisfied here
  via mocked/test OIDC configuration, consistent with that contract's own "Production approval
  requirements" gate not yet being reached).
- Provisioning the actual Supabase database.
- Emergency-admin SMTP alert delivery (`knowledge/05` §"Emergency-admin access alerts") — the
  service records the requirement and calls a single injectable notification hook, but does not
  wire a working SMTP send, since Google Workspace SMTP integration (`knowledge/09-google-workspace-smtp.md`)
  is its own separate, not-yet-built integration. Documented as a known gap, not fabricated.

## 6. Test requirements

Per `docs/contracts/google-workspace-auth-contract.md` "Test requirements": SSO flow tested
against mocked OIDC discovery/token responses (issuer/audience/expiry/signature validated for
real, against test keys — not skipped); emergency-admin TOTP flow tested independently, including
wrong-password and wrong-TOTP-code rejection as distinct cases. Migration/repository tests run
against a real disposable PostgreSQL database, never mocked, matching the Phase 1B precedent.

## 7. Security checks

STRIDE pass for "Authentication" and "Session handling" (`docs/security/threat-model-plan.md`),
reviewed against: token forgery/replay, emergency-path compromise, session fixation/hijacking,
CSRF on state-changing endpoints, no user enumeration on rejected logins, secrets never logged.

## 8. Approval gate

G4 (per `docs/phase-plans/phase-1-foundation-plan.md` Tasks 4/5). No production OAuth client used
in any test, per Task 4's own forbidden-actions list.

## 9. Forbidden actions

- No self-service emergency-admin account creation.
- No JIT user provisioning (resolved decision, §2).
- No RBAC/role assignment logic.
- No general audit-log subsystem beyond the narrow `auth_events` table.
- No real Google OAuth client, no real Supabase provisioning.
- No long-lived, self-contained browser JWT used as a substitute for a revocable server session.
- No merge without a separate, explicit "merge" instruction.
