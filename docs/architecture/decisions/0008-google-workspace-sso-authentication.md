# ADR-0008 — Authentication Through Google Workspace SSO

**Status:** Accepted (formalizing an already-resolved decision — see below)

## Context

The dashboard needs a primary authentication mechanism for its normal user population (WebDesk staff across the `webdesksolution.com` and `webdeskinc.com` domains). The base skill's documented default is local JWT-based login; the Master Specification instead requires Google Workspace SSO as the primary mechanism.

## Decision

Primary authentication is Google Workspace OIDC/SSO. Both `webdesksolution.com` and `webdeskinc.com` are treated as one WebDesk organization for authentication purposes — no tenant separation is created on email-domain grounds alone (this resolves what was open-question OQ-03 in the original compatibility review). User-record creation on first login (JIT provisioning vs. requiring pre-provisioned accounts) is an open setup decision — see Open setup values below; it is explicitly listed as blocking Phase 1 auth implementation, not something this ADR guesses at.

## Alternatives considered

- **Local JWT login (base skill default)** — overridden per the Master Specification's explicit SSO requirement, recorded here as an approved override rather than silently applied, per the base skill's own "ask-if-missing, record the override" convention.
- **A third-party identity provider (e.g., Auth0, Clerk) fronting Google as one option among several** — rejected: adds a vendor and a cost line for no capability need, when Google Workspace OIDC alone satisfies the requirement given all users are already Google Workspace accounts.

## Consequences

Authentication implementation depends on a Google Workspace OAuth client being created and configured before any login flow can be built or tested — a hard Phase 1 dependency, tracked as a setup-time input.

## Security considerations

Session handling, token storage, and CSRF protection for the SSO callback flow are Phase 1 implementation concerns, informed by `12-dashboard-security-controls.md`'s threat-modelling requirements (see ADR-0020's counterpart security document, `docs/security/threat-model-plan.md`) — not fully designed in this ADR.

## Operational considerations

Google Workspace SSO outage or misconfiguration would lock out all normal users — this is the specific operational risk ADR-0009 (local emergency-administrator authentication) exists to mitigate.

## Validation method

Reviewed against profile `knowledge/05-google-workspace-sso-and-local-admin.md`.

## Approval gate

G1 (architecture approval); the JIT-vs-pre-provisioned decision specifically requires a PM/client decision before G2 (implementation) begins on the user-record creation logic.

## Related dashboard requirements

`06_Roles_and_Permissions.md`.

## Related skill rules

Profile `knowledge/05-google-workspace-sso-and-local-admin.md`; WDS-003 (Google Workspace only for SSO — no other IdP).

## Open setup values

**Blocking Phase 1 auth implementation:** first-login provisioning model (JIT vs. pre-provisioned-only) — needs a PM/client decision, tracked in `docs/project-state/setup-input-register.md` and originally surfaced in `docs/skill-build/unresolved-items.md §C`. Google Workspace OAuth client details (client ID, authorized redirect URIs) are also unconfirmed setup-time inputs.
