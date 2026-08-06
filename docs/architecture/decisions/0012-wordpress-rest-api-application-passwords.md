# ADR-0012 — WordPress REST API and Application Password Integration

**Status:** Accepted (formalizing an already-resolved decision — see below)

## Context

The dashboard's WordPress Engineering module needs to read from and write to the WordPress site (`webdesksolution.com`, hosted on WordPress.com Business Plan). WordPress.com does not permit arbitrary server-side plugin installation the way a self-hosted WordPress install would, which constrains the integration approach to what the platform's REST API and Application Passwords feature actually support.

## Decision

Integrate via the WordPress REST API (`/wp-json/`), authenticated with WordPress Application Passwords — one dedicated integration account per environment (development, staging, production), each assigned a custom least-privilege role permitting only the specific REST API actions the dashboard needs, never a personal or administrator account. Credentials are stored in environment variables, excluded from Git, and independently rotatable/revocable per environment. This mirrors the already-registered Technical Discovery document's own recommendation exactly (`canonical-inputs/Current_WordPress_Technical_Discovery.md`), which this ADR formalizes rather than re-decides.

## Alternatives considered

- **A custom WordPress plugin exposing a bespoke API** — rejected: WordPress.com's Business Plan hosting model constrains custom server-side plugin deployment in ways that make the REST API + Application Passwords approach more reliable and lower-maintenance.
- **Direct database access to the WordPress MySQL database** — rejected: not exposed by WordPress.com hosting, and would bypass WordPress's own validation/hooks even if it were, an integration anti-pattern regardless of platform.

## Consequences

Every dashboard-to-WordPress write goes through REST endpoints WordPress itself validates — no direct database manipulation, which is both a platform constraint and (independently) the correct integration pattern.

## Security considerations

Least-privilege, per-environment Application Password accounts limit the blast radius of a leaked credential to one environment and one restricted role's permissions — never a full-admin account. Credential rotation procedure is part of `docs/security/secrets-management-plan.md`.

## Operational considerations

REST API availability (`/wp-json/` actually enabled, not restricted by a security layer) is explicitly still unconfirmed per the Technical Discovery document's own verification checklist — this is a Phase 1 kickoff verification task, not assumed working.

## Validation method

Reviewed against profile `knowledge/07-wordpress-integration.md` and `canonical-inputs/Current_WordPress_Technical_Discovery.md`.

## Approval gate

G-Contracts (formalized into `docs/contracts/wordpress-integration-contract.md`).

## Related dashboard requirements

`10_WordPress_Integration_and_Migration.md`, `08_API_and_Integration_Contracts.md`.

## Related skill rules

Profile `knowledge/07-wordpress-integration.md`.

## Open setup values

REST API actual availability, Application Password actual enablement, and per-environment account creation are all unconfirmed setup-time/kickoff-verification inputs — see `docs/project-state/setup-input-register.md`.
