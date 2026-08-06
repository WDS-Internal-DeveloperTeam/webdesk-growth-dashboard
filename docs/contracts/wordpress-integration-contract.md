# Integration Contract — WordPress

**Status:** Draft. No adapter code exists yet; REST API availability and Application Password enablement are unconfirmed. This contract defines the intended shape so implementation can proceed against an agreed interface, not so integration can begin.

## Purpose

Provide the dashboard's WordPress Engineering module with read/write access to the WordPress site (`webdesksolution.com`), per ADR-0012 and ADR-0013.

## Trust boundary

`dashboard-api`'s WordPress adapter (`packages/integrations`) is the only code that holds WordPress Application Password credentials or calls the WordPress REST API / WP-CLI directly.

## Authentication

WordPress Application Passwords, one dedicated least-privilege integration account per environment, per ADR-0012. WP-CLI access (development/staging only for routine use; production only through the approved deployment workflow) per ADR-0013.

## Authorization

The Application Password account's WordPress-side role is the outer bound (least-privilege, REST-API-actions-only); `dashboard-api`'s own RBAC further restricts which dashboard users may trigger WordPress-affecting actions.

## Inputs and outputs

- **Outbound (REST API):** read/write custom post types (Services, Case Studies, Testimonials, Team Members, FAQs) and their native-metadata fields (ADR-0020), per the exact meta-key mappings confirmed in `canonical-inputs/Current_WordPress_Technical_Discovery.md`'s CaseStudy/Portfolio resolution.
- **No inbound webhooks from WordPress are assumed in V1** — WordPress.com's webhook capabilities are not confirmed; if needed, this contract will be revised once confirmed.

## Validation

All WordPress REST responses are validated against expected shapes before being trusted; the adapter does not assume WordPress-side data is always well-formed (WordPress.com plugin behavior can change independent of this project's control).

## Error handling

REST API errors are surfaced distinctly from "no data" states — a failed WordPress call must not be silently treated as "site has no content."

## Retry and idempotency

Write operations (e.g., publishing a Case Study) are designed to be safely retryable — the adapter checks for an existing record via a stable identifier before creating a duplicate on retry.

## Rate limits

WordPress.com's REST API rate limits (exact figures unconfirmed) are respected; the adapter backs off on 429-class responses.

## Audit events

Every WordPress-affecting dashboard action generates an audit event per ADR-0017, including the specific post/field changed.

## Secret handling

Application Password credentials managed per `docs/security/secrets-management-plan.md` — environment variables only, independently rotatable/revocable per environment, per ADR-0012.

## Environment separation

Separate Application Password accounts per environment (development, staging, production) is a hard requirement, not a convenience — a development credential must never be able to write to the production WordPress site.

## Failure recovery

WordPress-side content changes made through this integration should be recoverable via WordPress.com's own backup/restore mechanism (`knowledge/11-retention-backup-and-operations.md`'s cadence), not a separate dashboard-side undo system for V1.

## Test requirements

Adapter tests against the staging WordPress environment (`staging-7a61-wdsstage2.wpcomstaging.com`) only — never against production for automated tests, per the CI-safe testing strategy gap flagged in `docs/skill-build/unresolved-items.md §C`.

## Production approval requirements

Any WordPress production write triggered through this integration follows the approved deployment workflow (ADR-0013); no direct, unreviewed production write path exists.

## Open items

REST API (`/wp-json/`) actual availability, Application Password actual enablement, exact field/Podio mapping for forms, and per-environment account creation are all unconfirmed — see `docs/project-state/setup-input-register.md`. This contract's implementation is blocked on these being confirmed at implementation kickoff, not on this contract document itself.
