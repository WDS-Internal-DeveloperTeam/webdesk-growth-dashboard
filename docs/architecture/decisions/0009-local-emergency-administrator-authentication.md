# ADR-0009 — Restricted Local Emergency-Administrator Authentication

**Status:** Accepted (formalizing an already-resolved decision — see below)

## Context

ADR-0008 makes Google Workspace SSO the primary authentication mechanism. If Google Workspace itself is unavailable (outage, account lockout, org-wide SSO misconfiguration), the dashboard would have no way for an administrator to log in and fix the problem — a single point of failure for the entire system's own recoverability.

## Decision

A restricted local (non-SSO) emergency-administrator authentication path exists, scoped narrowly:

- Available only to a small, explicitly-designated set of admin accounts (not a general local-login fallback for all users).
- Uses TOTP (time-based one-time password), not a password-only local login.
- Every use is logged as a distinct, high-visibility audit event (ADR-0017) — emergency-admin login is treated as a security-relevant event requiring follow-up review, not a routine login path.
- Not exposed in the normal login UI as an equally-weighted option alongside SSO — it exists for genuine emergencies, not day-to-day convenience.

## Alternatives considered

- **No local fallback at all (SSO-only)** — rejected: an SSO outage would leave the system with no recovery path, an unacceptable single point of failure for an internal operational tool.
- **A general local-login option available to all users at all times** — rejected: undermines the SSO-centralized-identity model ADR-0008 establishes and widens the attack surface (a second, separately-secured credential per user) for no operational benefit over the narrow emergency path.

## Consequences

Emergency-admin accounts require their own provisioning and TOTP-secret-distribution process, separate from the SSO onboarding flow — a Phase 1 setup task.

## Security considerations

This is one of the highest-sensitivity authentication paths in the system precisely because it bypasses the organization's centralized identity provider — TOTP secrets must be provisioned and stored per `docs/security/secrets-management-plan.md`, and the designated admin account list must itself be reviewed periodically (an operational, not architectural, requirement).

## Operational considerations

The designated emergency-admin account list should be small and explicitly documented (who, why, last-reviewed date) — exact names are a setup-time input, not invented here.

## Validation method

Reviewed against profile `knowledge/05-google-workspace-sso-and-local-admin.md`.

## Approval gate

G1 (architecture approval); the specific admin-account list requires PM/security-owner sign-off before Phase 1 provisioning.

## Related dashboard requirements

`06_Roles_and_Permissions.md`, `09_Security_Backup_Retention_Operations.md`.

## Related skill rules

Profile `knowledge/05-google-workspace-sso-and-local-admin.md`.

## Open setup values

The designated emergency-administrator account list and TOTP provisioning process are unconfirmed setup-time inputs — see `docs/project-state/setup-input-register.md`.
