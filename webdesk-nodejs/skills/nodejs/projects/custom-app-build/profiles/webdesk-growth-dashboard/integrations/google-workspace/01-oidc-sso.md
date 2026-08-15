---
tier: 2
load_when: ["webdesk-growth-dashboard", "integration-work", "security-topic"]
description: "Google Workspace OIDC adapter — authorization code + PKCE flow, token verification, domain allowlisting, subject-ID mapping. Concrete implementation reference for the policy in knowledge/05-google-workspace-sso-and-local-admin.md."
---

# Google Workspace — OIDC SSO

> Concrete adapter reference. Policy (session model, TOTP local admin, audit events) lives in `../../knowledge/05-google-workspace-sso-and-local-admin.md` — read that first.

---

## Adapter interface

```ts
// packages/integrations/google-workspace/src/oidc-adapter.ts
export interface GoogleOIDCAdapter {
  getAuthorizationUrl(state: string, codeChallenge: string): string;
  exchangeCodeForTokens(
    code: string,
    codeVerifier: string,
  ): Promise<{ idToken: string; accessToken: string }>;
  verifyIdToken(idToken: string): Promise<{
    sub: string;
    email: string;
    hd?: string; // hosted domain claim
    emailVerified: boolean;
  }>;
}
```

---

## Flow

1. `dashboard-web` initiates login → redirects to `getAuthorizationUrl()` (Authorization Code + PKCE — code verifier/challenge generated and the verifier held server-side or in a secure short-lived cookie, never in a URL param that could leak via referrer).
2. Google redirects back to a `dashboard-api` callback route with an authorization code.
3. `dashboard-api` calls `exchangeCodeForTokens()`, then `verifyIdToken()`.
4. Verification checks, **in order, all required, none skippable**:
   - Signature valid against Google's published JWKS.
   - `iss` == `https://accounts.google.com` (or `accounts.google.com`, per Google's documented issuer values — **confirm both accepted forms at discovery**).
   - `aud` == this project's registered OAuth client ID.
   - `exp` not expired.
   - `hd` (or email-domain fallback) ∈ `{webdesksolution.com, webdeskinc.com}`.
5. On success: map `sub` → `user_identities` record (create on first login only if JIT provisioning is the confirmed decision — see `../../knowledge/05-google-workspace-sso-and-local-admin.md` §"Subject-ID identity mapping" and `docs/skill-build/unresolved-items.md`); mint the dashboard's own access+refresh token pair.
6. On any failure: generic rejection response, login-audit event recorded, no confirmation to the caller of which specific check failed.

---

## verify-at-discovery checklist

- [ ] Exact accepted `iss` claim value(s) — Google has historically used both `https://accounts.google.com` and `accounts.google.com` in different contexts.
- [ ] Whether `hd` is reliably present for every Workspace user in both authorized domains, or whether an email-domain fallback check is required for some account configurations.
- [ ] JWKS endpoint and key-rotation handling (cache with appropriate TTL, refresh on a `kid` miss).
- [ ] First-login provisioning decision (JIT vs. pre-provisioned-only) — this is a project decision to confirm before Phase 1, not an OIDC-protocol fact to verify.

See `pointers.md` for documentation anchors.
