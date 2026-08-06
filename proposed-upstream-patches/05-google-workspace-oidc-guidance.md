# Proposed Patch 05 — Generic Google Workspace OIDC Guidance

**Status:** Proposed. Not merged. Not applied to the base skill by this task.

## Reason

This is the largest genuine knowledge gap found in the entire compatibility review (`docs/implementation/architecture-validation.md` §12): the base skill's authentication model, everywhere it appears, assumes local username/password credentials. No OIDC/SSO federation guidance exists anywhere. Any future project needing SSO (Google Workspace, Okta, Azure AD, or generic OIDC) currently has to build this from zero, as this project did in `profiles/webdesk-growth-dashboard/knowledge/05-google-workspace-sso-and-local-admin.md`.

## Current gap

`nodejs/knowledge/security/02-authn-authz.md` covers only local JWT-credential auth. `_spine/designer-agent/knowledge/dashboard-modules/08-login.md` assumes a password-entry login form. No file addresses issuer/audience validation, domain allowlisting, subject-ID identity mapping, or the "session model is reused unmodified downstream of SSO" pattern.

## Proposed files changed

- **New:** `nodejs/knowledge/security/06-sso-oidc.md` — generalized OIDC flow (Authorization Code + PKCE), token-verification checklist (issuer/audience/expiry), domain-allowlisting pattern, subject-ID-to-local-user mapping, and the "SSO establishes identity, the existing JWT access+refresh session model applies downstream unmodified" principle — provider-agnostic, with Google Workspace as the worked example (matching this project's `integrations/google-workspace/01-oidc-sso.md` structure, generalized).
- **Edit:** `nodejs/knowledge/security/02-authn-authz.md` — add a top-of-file note: "This file covers local-credential JWT auth. If the project uses SSO/OIDC, read `06-sso-oidc.md` first — the session/authorization model below still applies downstream of a successful SSO login."
- **Edit:** `_spine/designer-agent/knowledge/dashboard-modules/08-login.md` — add a note that an SSO-primary login flow (button-to-provider-redirect rather than a password form) is a valid alternative to the password-form pattern this file currently assumes as default, with a pointer to the new OIDC file.

## Compatibility impact

Additive. The existing local-credential guidance remains the default and is unchanged; this patch adds a parallel, equally-first-class path for SSO-primary projects.

## Regression risk

Low. Both edits are short top-of-file notes/pointers, not rewrites of existing guidance.

## Reusability scope

**Generally reusable, though the Google Workspace domain-allowlisting specifics in this project's version are WebDesk-specific** — the upstream patch should generalize "verify the hosted-domain claim against an allowlist" without hardcoding `webdesksolution.com`/`webdeskinc.com`.
