# ADR-0013 — Controlled Production WP-CLI

**Status:** Accepted (formalizing an already-resolved decision — see below)

## Context

WP-CLI provides powerful, low-level WordPress operations (cache clearing, rewrite flushing, database migrations, search-and-replace) that go well beyond what the REST API exposes. Unrestricted, ad hoc WP-CLI access against production is a significant operational risk — a single mistyped command can affect the live site directly.

## Decision

WP-CLI/SSH access is enabled for development and staging environments for routine use (cache clearing, rewrite flushing, version/status checks, approved imports, checksum verification, validated search-and-replace). **Production WP-CLI commands run only through the approved deployment workflow after authorization** — no unrestricted interactive production access, and no destructive ad hoc commands against production under any circumstance. This restates the Technical Discovery document's own recommendation as a hard rule, not a preference.

## Alternatives considered

- **No WP-CLI access at all, REST API only** — rejected: some legitimate operational tasks (cache/rewrite management, verified search-and-replace during migration) are impractical or unavailable through the REST API alone.
- **Unrestricted WP-CLI/SSH access for all environments including production** — rejected outright: the base skill's own verify-at-discovery and controlled-production-access conventions, and this project's own security posture, both require production changes to go through an approved, auditable workflow, not ad hoc command-line access.

## Consequences

Any WordPress-side production change requires a deployment-workflow step, even for operations that would be trivial via direct WP-CLI — a deliberate friction point, not an oversight.

## Security considerations

This is a direct mitigation against the highest-risk WordPress-side action available (destructive production commands) — production WP-CLI access, if ever granted interactively for an emergency, must be logged and treated with the same scrutiny as emergency-administrator dashboard access (ADR-0009).

## Operational considerations

The "approved deployment workflow" this ADR refers to is defined by the repository/branch/release plan (`docs/repository-plan/branch-and-release-plan.md`) and the GitHub-based deployment process (`10_WordPress_Integration_and_Migration.md`), not redefined here.

## Validation method

Reviewed against profile `knowledge/07-wordpress-integration.md` and `canonical-inputs/Current_WordPress_Technical_Discovery.md`.

## Approval gate

G-Contracts.

## Related dashboard requirements

`10_WordPress_Integration_and_Migration.md`.

## Related skill rules

Profile `knowledge/07-wordpress-integration.md`.

## Open setup values

Exact development/staging/production WP-CLI and SSH availability, and any WordPress.com-specific restrictions on WP-CLI access, are unconfirmed — see the Technical Discovery document's own "Remaining WordPress verification items" and `docs/project-state/setup-input-register.md`.
