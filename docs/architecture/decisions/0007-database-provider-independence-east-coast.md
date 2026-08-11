# ADR-0007 — Database Provider-Independence and East Coast Requirement

**Status:** Accepted. The stop-condition below did not trigger — see "Open setup values" for the
2026-08-07 resolution (dated addendum; the decision and rule below are unchanged from Phase 0
sign-off).

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

**Resolved 2026-08-07 (dated addendum):** two Marketplace providers were verified to genuinely
satisfy both constraints — Supabase (`us-east-1`/N. Virginia, `us-east-2`/Ohio) and Amazon Aurora
PostgreSQL (same two regions, via Vercel's native AWS integration). Neither is Neon, and both
offer a qualifying East Coast region, so the stop-condition above did not trigger — no escalation
was needed. The project owner chose **Supabase, `us-east-1`**, recorded in
`project.json.vercel_execution.{postgres_marketplace_provider,postgres_marketplace_region}`. See
`docs/project-state/setup-input-register.md` for the full record.

This resolves _which provider_, not provisioning — no database instance exists yet. Actual
provisioning remains gated on Phase 1B Task 3's own separate execution authorization
(`docs/task-packages/phase-1b-database-foundation.md` §24), consistent with the "PM/infrastructure-owner
sign-off before G2" requirement above.

## Resolution note — 2026-08-11: provider changed to Neon, overriding WDS-002

**The Neon exclusion in WDS-002 has been explicitly overridden by the project owner (WebDesk
Solution).** The confirmed provider is now **Neon, `us-east-1`** (N. Virginia), replacing the
2026-08-07 choice of Supabase above. This section is an appended, later decision — the original
"Decision"/"Context" text above, and WDS-002's own rule text in the Master Specification, are left
unmodified as an accurate historical record of what was decided and why at the time, not rewritten
to look as if Neon was always the plan.

- **What changed:** only the Neon-exclusion half of WDS-002. The North America East Coast region
  requirement (the other half of this ADR's own decision) still applies and was independently
  re-verified against Neon's own documented region list: Neon offers both `us-east-1` (N. Virginia)
  and `us-east-2` (Ohio), the same two AWS regions Supabase and Amazon Aurora PostgreSQL were
  verified against on 2026-08-07. `us-east-1` was chosen for continuity with the prior region
  choice.
- **Why:** not recorded — the project owner authorized this change directly without stating a
  reason, and none is assumed here.
- **What this does NOT do:** does not provision an actual Neon database instance (no database has
  been provisioned under either provider — see the paragraph above, still true); does not amend
  WDS-002's own text in the Master Specification, which remains a client-authored document outside
  this repository's control; does not reopen or relitigate the original 2026-08-07 Supabase
  decision's own reasoning, which was sound given the constraints as they stood at that time.
- **Recorded in:** `project.json.vercel_execution.{postgres_marketplace_provider,postgres_marketplace_region}`
  (now `neon`/`us-east-1`) and `project.json`'s `audit_log`; see
  `docs/project-state/setup-input-register.md` for the setup-input-register's own record of this
  change.
