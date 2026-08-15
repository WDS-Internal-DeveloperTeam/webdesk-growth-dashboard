---
tier: 1
load_when: ["webdesk-growth-dashboard", "security-topic", "backend-active", "g1_5"]
description: "Google Workspace SSO/OIDC as the primary authentication path, TOTP local emergency-admin accounts, session model, recovery, and the resolved single-organization reading of the two authorized domains. New territory for the base skill — no prior OIDC content existed to extend."
---

# 05 — Google Workspace SSO and Local Admin

> The base skill's authentication model, everywhere it appears, is built around local username/password credentials. There is no OIDC/SSO federation guidance anywhere in the base skill. This file is genuinely new knowledge, not an adaptation of an existing pattern — written to the standard the base skill's `security/02-authn-authz.md` sets for rigor, but covering ground that file does not.

---

## Resolved: the two domains are one organization

`docs/implementation/open-questions.md` OQ-03 asked whether `webdesksolution.com` and `webdeskinc.com` represent one organization or two entities needing data separation. **Resolved for this project: both domains belong to one WebDesk organization. No tenant separation is created on email-domain grounds alone.** A user authenticating from either domain is a standard WebDesk user, subject to the same project-scoped RBAC as any other — domain membership determines _eligibility to authenticate_, not _data scope_. If a future approved decision changes this, it supersedes this file per the precedence rules in `knowledge/00-scope-and-precedence.md` — do not re-derive tenant separation from the domain list without such a decision on record.

---

## Standard-user authentication — Google Workspace SSO (OIDC)

### Flow

- **Authorization Code flow with PKCE.** The dashboard's `dashboard-web` frontend redirects to Google's OIDC authorization endpoint; the callback is handled server-side by `dashboard-api` (never in client-side JS, to keep the resulting tokens off the browser's exposed surface beyond what's needed).
- **Issuer and audience validation** — every ID token is verified against Google's published issuer (`https://accounts.google.com`) and the dashboard's registered OAuth client ID as audience. Reject any token failing either check outright; do not attempt to "recover" a mismatched issuer/audience.
- **Domain allowlisting** — the verified token's `hd` (hosted domain) claim, or the email domain as a fallback check, must be exactly `webdesksolution.com` or `webdeskinc.com`. Any other domain is rejected at the callback, before a session is created. Log the rejection as a login audit event (§"Audit events" below) without leaking to the rejected user _which_ check failed (generic "access denied" — do not confirm or deny domain membership to an unauthenticated caller, consistent with the base skill's OWASP-API-aligned "no user enumeration" posture).
- **Subject-ID identity mapping** — the dashboard's `user_identities` table maps Google's stable `sub` claim to a dashboard `users` record, not email address alone (email can change; `sub` does not). First-login provisioning behavior (just-in-time creation vs. admin-pre-provisioned-only) is a project decision to be recorded before Phase 1 implementation — see `docs/implementation/gap-analysis.md` item 1 and `docs/skill-build/unresolved-items.md`; this file does not silently assume one or the other.
- **MFA** is enforced by Google Workspace itself for standard users, not re-implemented by the dashboard — the dashboard trusts Workspace's own MFA policy as a precondition of a successful OIDC login, consistent with `01_Dashboard_Master_Specification.md §14`.

### Session, downstream of SSO

Once Google Workspace SSO succeeds, the base skill's session model applies **unmodified** as the dashboard's own first-party API session layer (`nodejs/knowledge/security/02-authn-authz.md`):

- Short-lived access token + longer-lived, rotating refresh token, minted by `dashboard-api` after OIDC success — this is a dashboard-issued token, not the Google ID token itself (the Google token proves identity at login; it is not carried forward as the ongoing API credential).
- **Maximum seven-day session expiry** — the refresh token's absolute lifetime is capped at seven days regardless of activity; a session does not silently renew forever.
- **Server-side revocation** — a `tokenVersion` per user, bumped on logout, role change, or account suspension, invalidating outstanding tokens immediately rather than waiting for natural expiry (unchanged from the base skill's pattern).
- **Logout** explicitly revokes the current session (adds to the revocation list / bumps `tokenVersion`) rather than merely discarding the client-side token.
- Token storage follows `nodejs/knowledge/frontend/01-react-next-standards.md`'s preference: httpOnly/Secure/SameSite cookies for the refresh token over `localStorage`.

### What happens if a Workspace account is suspended mid-session

The dashboard does not poll Google continuously for account status. Revocation is checked **at refresh time**: if a user's access token expires and the refresh flow runs, the dashboard-side session check (not a live Google API call on every request) determines whether the session remains valid. A suspended/removed Workspace account is caught at the _next_ refresh attempt within the seven-day window, not instantly — this is a bounded-staleness tradeoff, not an unbounded one, and is consistent with the seven-day maximum session policy already approved. If tighter revocation latency is later required, that is a new decision to record, not an assumption to bake in now.

---

## Local emergency-administrator accounts — TOTP

Reserved for emergency access only, not a routine alternative login path:

- **Local username/password + TOTP** (authenticator-app based) — password hashed with argon2id (base skill's own recommendation, `security/02-authn-authz.md`), TOTP secret encrypted at rest (NODE-103) with the same AES-256-GCM-plus-secret-manager-key pattern the base skill already specifies for any persisted secret (`security/03-secrets-and-config.md`), never logged or displayed in full once enrolled.
- **Enrollment** requires an existing authorized administrator to provision the account and TOTP secret initially — no self-service creation of an emergency-admin account.
- **Account lockout and rate limiting** apply to the local login path exactly as the base skill's `security/01-owasp-api.md` baseline requires for any credentialed endpoint.
- **Recovery requires identity verification and approval by a second authorized administrator** — a single administrator cannot recover their own or another's locked emergency account unilaterally (mirrors the base skill's separation-of-duties principle, `_contracts/gate-format.md` "self-approval" rule, applied to account recovery instead of gate approval).
- **Emergency-admin access alerts** — every successful login via the local emergency path fires a notification to the configured Security/DevOps operational area (per `knowledge/09-google-workspace-smtp.md`'s distribution-list mechanism), since use of this path is inherently unusual and worth a human noticing, not just an audit-log entry nobody reads until an incident review.

---

## Authorization — deny by default, reused from the base skill unmodified in mechanism

The base skill's extensible per-module RBAC (`role × module × action`, VED-minimum-extended, `security/02-authn-authz.md`) is the mechanism, entirely orthogonal to how identity was established. This project's action vocabulary (per the dashboard's own action legend) is:

```
View, Create, Edit, Submit, Review, Approve, Reject, Publish, Unpublish,
Release, Roll back, Export, Execute, Configure,
View confidential fields, Edit confidential fields
```

— a superset of the base skill's seeded VED + extended (Create/Approve/Export/Import/Run/Configure/Manage All) set. Extend the seeded action enum with `submit`, `review`, `reject`, `publish`, `unpublish`, `release`, `rollback` per module as needed; the `(role_id, module_id, action)` row-per-grant schema itself is unchanged. Full detail on the confidential-field axis and separation-of-duties enforcement: `knowledge/12-dashboard-security-controls.md`.

Permissions apply at **project level, module level, action level, and confidential-field level** — four axes, not two. A grant at one level does not imply a grant at another (a role with `view` on a module does not automatically get `view confidential fields` on that same module's confidential columns).

---

## Login audit events (required, not optional)

Every one of the following produces an audit event (`knowledge/10-data-ownership-and-audit.md`), regardless of authentication path:

- Successful SSO login (with domain, not full email if the confidentiality classification warrants restraint — record what's needed for security review without over-logging PII, per `nodejs/knowledge/security/05-pii-and-compliance.md`'s data-minimization principle).
- Rejected SSO login attempt (wrong domain, invalid token, issuer/audience mismatch) — logged without confirming to the caller which check failed.
- Local emergency-admin login (always, with an alert per §"Emergency-admin access alerts" above).
- Account lockout triggered.
- Account recovery request and its approval/denial, including which second administrator approved it.
- Logout / session revocation, and the reason (`user-initiated`, `role-change`, `admin-forced`, `security-incident`).

---

## What this file does not cover

- The confidential-field permission axis in detail and separation-of-duties enforcement mechanics → `knowledge/12-dashboard-security-controls.md`.
- Notification delivery for emergency-admin alerts → `knowledge/09-google-workspace-smtp.md`.
- OIDC client library specifics, exact Google endpoint URLs, and token-verification library choice → `integrations/google-workspace/` (loaded only when the active task implements this integration, per context-budget discipline — this file states the required behavior; that directory states the concrete how-to once the library/SDK choice is made at scaffold).
