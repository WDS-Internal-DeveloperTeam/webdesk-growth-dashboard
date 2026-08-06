# Integration Contract — Google Workspace Authentication (SSO)

**Status:** Draft. No adapter code exists yet; no Google Workspace OAuth client has been created. This contract defines the intended shape so implementation can proceed against an agreed interface, not so integration can begin.

## Purpose

Provide the dashboard's primary authentication mechanism via Google Workspace OIDC/SSO, per ADR-0008, plus the restricted emergency-administrator fallback per ADR-0009.

## Trust boundary

`dashboard-api` owns the OIDC callback handling and session issuance. `dashboard-web` redirects to Google's login and receives the resulting session cookie; it never handles OAuth tokens directly.

## Authentication

Google Workspace OIDC (OAuth 2.0 / OpenID Connect), restricted to the `webdesksolution.com` and `webdeskinc.com` domains (treated as one organization, no tenant separation, per ADR-0008). Emergency-administrator TOTP-based local authentication per ADR-0009, for a narrow, explicitly-designated account set only.

## Authorization

Successful SSO authentication establishes identity only — role/permission assignment (ADR-0010) is a separate, dashboard-side authorization step performed after authentication, not implied by domain membership alone.

## Inputs and outputs

- **Inbound:** OIDC callback with an authorization code, exchanged server-side for tokens; ID token claims (email, name, domain) used to establish or match a user record.
- **Outbound:** session cookie issued to the browser after successful authentication.

## Validation

ID token signature and claims (issuer, audience, expiry) are validated per standard OIDC practice before any session is issued; a token from an unexpected issuer or audience is rejected, not trusted.

## Error handling

Authentication failures (denied consent, invalid state parameter, expired code) redirect to a clear error state, never to a default-authenticated fallback.

## Retry and idempotency

Not typically applicable to interactive login flows; the OAuth `state` parameter is single-use and validated to prevent CSRF/replay.

## Rate limits

Governed by Google's own OAuth rate limits; not expected to be a practical constraint at this project's user scale.

## Audit events

Every successful and failed login attempt is recorded as an audit event (ADR-0017), with emergency-administrator logins flagged as high-visibility events requiring follow-up review, per ADR-0009.

## Secret handling

OAuth client secret managed per `docs/security/secrets-management-plan.md`. Emergency-admin TOTP secrets are provisioned and stored with equivalent or higher care, given the sensitivity of the path they protect.

## Environment separation

Separate OAuth client registrations (or at minimum separate authorized redirect URIs) per environment — a development callback URL must not be a valid redirect target for a production-issued authorization code.

## Failure recovery

If Google Workspace SSO is unavailable, the emergency-administrator path (ADR-0009) is the designated recovery mechanism — not a general local-login fallback.

## Test requirements

Authentication flow tested against a test Google Workspace account in a non-production environment; emergency-admin TOTP flow tested independently, including the "wrong TOTP code" rejection case.

## Production approval requirements

Any change to the OAuth client configuration or the emergency-admin account list requires PM/security-owner sign-off.

## Open items

Google Workspace OAuth client details (client ID, authorized redirect URIs), first-login provisioning model (JIT vs. pre-provisioned), and the emergency-administrator account list are all unconfirmed setup-time inputs — see `docs/project-state/setup-input-register.md`. The provisioning-model decision specifically blocks Phase 1 auth implementation.
