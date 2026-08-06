# ADR-0007 — Database Provider-Independence and East Coast Requirement

**Status:** Accepted, with one open stop-condition (see Open setup values)

## Context

The Master Specification requires the production database to run in a North America East Coast region, and explicitly excludes Neon as a Postgres provider (WDS-002). Vercel's Postgres Marketplace offers multiple third-party-backed provider options, not a single first-party database — the actual provider must be chosen from that marketplace, and that choice must simultaneously satisfy the region requirement and the Neon exclusion.

## Decision

The database is provisioned through the Vercel Postgres Marketplace, choosing whichever available provider satisfies both: (a) a North America East Coast region option, and (b) is not Neon. `project.json.vercel_execution.postgres_marketplace_provider` is `null` until this is confirmed — `null` is a valid, honest placeholder (not "neon" or any other unconfirmed value) per the patched project schema.

**Stop-condition, restated from the profile's own architecture knowledge:** if, at provisioning time, no Marketplace provider can satisfy both the East Coast region requirement and the Neon exclusion simultaneously, this is a genuine conflict between two approved requirements and must be escalated to the project owner rather than silently resolved by relaxing either constraint. Do not default to Neon because it's the most prominent Marketplace option, and do not default to a non-East-Coast region because it's the only non-Neon option — surface the conflict.

## Alternatives considered

- **Self-hosted Postgres (e.g., on a separate VM or a non-Vercel-Marketplace managed Postgres)** — rejected: adds an operational surface (patching, backups, networking) the Vercel Marketplace model is meant to avoid, and complicates the "single hosting platform" story the Master Specification establishes.
- **Neon directly** — explicitly excluded (WDS-002); not reconsidered here, since this is a restated absolute rule, not an open question.

## Consequences

Database provisioning cannot proceed until a specific provider is confirmed — this is intentionally listed as a Phase 0/setup-time blocker (not fabricated a value to unblock Phase 0 authoring) rather than resolved by guessing.

## Security considerations

Provider selection affects available security features (encryption at rest, network isolation options, backup encryption) — these should be confirmed against `09_Security_Backup_Retention_Operations.md`'s requirements once a provider is chosen, not assumed.

## Operational considerations

Region choice affects latency to Vercel Function regions and to the WordPress hosting environment (WordPress.com) — East Coast is specified precisely because the dashboard's primary user base and the WordPress site's hosting are both East-Coast-proximate.

## Validation method

Reviewed against profile `knowledge/01-approved-architecture.md`'s "Database" stop-condition and WDS-002.

## Approval gate

G-Schema, and this specific provider choice additionally requires PM/infrastructure-owner sign-off before G2 (implementation) can proceed with any database-dependent code.

## Related dashboard requirements

`01_Dashboard_Master_Specification.md`, `09_Security_Backup_Retention_Operations.md`.

## Related skill rules

Profile `knowledge/01-approved-architecture.md`; WDS-002 (absolute rule, never select Neon).

## Open setup values

**Blocking:** the exact Vercel Postgres Marketplace provider is not yet chosen. Tracked in `docs/project-state/setup-input-register.md` as a blocker for database-dependent implementation work (not a blocker for Phase 0 documentation itself, which can proceed with `postgres_marketplace_provider: null`).
