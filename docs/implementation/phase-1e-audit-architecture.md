# Phase 1E — Audit Architecture (as-built)

**Status:** Describes what is actually built, not an aspirational design — every claim below is
backed by real source files, real migrations, and real-database tests referenced inline. Covers
two migrations: `00018-create-audit-events.ts` (the original ADR-0017 slice, "Start Phase 1E with
the audit foundation first") and `00019-expand-audit-events.ts` (this slice, closing the gap
between `00018`'s shape and the newer, more detailed Phase 1E authorization brief's §5/§8 field
list — see `docs/project-state/setup-input-register.md`-adjacent CLAUDE.md "Recent decisions" for
the request that triggered this).

## 1. Why a second migration, not a rewrite of the first

`00018`'s `audit_events` shape faithfully implemented the base skill's original
`contracts/audit-event.schema.json` — a separately-versioned asset that lives outside this repo's
own git history (`webdesk-nodejs/`, gitignored per this repo's own `.gitignore`; see CLAUDE.md's
"Identity" section). That original contract is narrower than the newer brief's §5 field list. Since
the contract file isn't this repo's to edit, and the original migration is already live in
production with real rows, the gap is closed additively: a second migration (`00019`) adds the
missing columns, backfills existing rows where the backfill can be exact, and this document records
the resulting as-built schema as the authoritative V1 shape — the thing this repo's own code
actually implements, regardless of what the out-of-repo contract file says.

## 2. Full column list (post-`00019`)

| Column                                         | Added by | Nullable                                     | Notes                                                                                                                                                                                      |
| ---------------------------------------------- | -------- | -------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `id`                                           | `00018`  | no                                           | UUID, app-generated (no DB-level default — see §4)                                                                                                                                         |
| `event_type`                                   | `00018`  | no                                           | STRING(64), controlled vocabulary validated in `AuditService`, not a Postgres ENUM (vocabulary expected to grow)                                                                           |
| `event_category`                               | `00019`  | no                                           | STRING(32), always derived by `AuditService`'s exhaustive `event_type`→category mapping — never left to the caller (§5)                                                                    |
| `actor_user_id`                                | `00018`  | yes                                          | FK → `users.id`, `SET NULL` on delete                                                                                                                                                      |
| `actor_type`                                   | `00018`  | no                                           | Real Postgres ENUM (`human`/`system`/`service_account`) — small, structurally stable set, unlike `event_type`                                                                              |
| `session_id`                                   | `00019`  | yes                                          | FK → `sessions.id`, `SET NULL` on delete — schema-ready only, see §4                                                                                                                       |
| `project_id`                                   | `00019`  | yes                                          | Not FK-constrained — no `projects` table exists yet, same precedent as `user_roles.project_id` (migration `00016`)                                                                         |
| `entity_type` / `entity_id` / `entity_version` | `00018`  | entity_type/entity_id no, entity_version yes | The record this event concerns                                                                                                                                                             |
| `action`                                       | `00018`  | no                                           | The specific action taken                                                                                                                                                                  |
| `before_state` / `after_state`                 | `00018`  | yes                                          | JSONB, redacted per confidentiality rules **before** the caller passes them in — no redaction happens inside this table or its repository                                                  |
| `reason`                                       | `00018`  | yes                                          | Free text                                                                                                                                                                                  |
| `related_gate_or_approval_id`                  | `00018`  | yes                                          | The approval/SoD linkage (§8) — narrower than a general "task/review/release ID"; see §5 below for why it wasn't widened                                                                   |
| `git_commit_sha`                               | `00018`  | yes                                          | CHECK-constrained to 40 lowercase hex chars                                                                                                                                                |
| `correlation_id`                               | `00019`  | yes                                          | Schema-ready only, see §4                                                                                                                                                                  |
| `source_application`                           | `00019`  | no                                           | STRING(64), defaulted by `AuditService` to `"dashboard-api"`                                                                                                                               |
| `environment`                                  | `00019`  | no                                           | STRING(32), same three-value vocabulary as `packages/configuration`'s already-approved `NODE_ENV` schema (`development`/`test`/`production`) — not an invented fourth value like "preview" |
| `confidentiality_classification`               | `00019`  | no                                           | STRING(32), defaulted by `AuditService` to `"internal"`                                                                                                                                    |
| `retention_category`                           | `00018`  | no                                           | e.g. `audit-7y`, `approval-audit-7y`, `security-log-1y`                                                                                                                                    |
| `legal_hold` / `legal_hold_reason`             | `00018`  | legal_hold no (default false), reason yes    | Overrides retention unconditionally                                                                                                                                                        |
| `created_at`                                   | `00018`  | no                                           | No `updated_at` exists on this table at all — append-only                                                                                                                                  |

Indexes: `entity_type+entity_id`, `event_type`, `actor_user_id`, `created_at`, `retention_category+created_at`
(all `00018`), plus `event_category`, `project_id+created_at`, `correlation_id`, `session_id`
(`00019`) — covering the query patterns the brief's §36 calls out (by project, by actor, by
resource) ahead of the `/audit` API surface that would actually issue them (not built yet — see §6).

## 3. `event_type` → `event_category` mapping

`AUDIT_EVENT_CATEGORIES` in `apps/dashboard-api/src/audit/audit.service.ts` is typed
`Record<AuditEventType, string>` — exhaustive over the full `AuditEventType` union, so adding a new
`event_type` to that union without deciding its category is a compile error, not a silent gap.
Current groupings: `authentication` (login/logout/session/emergency-admin events),
`access_control` (permission/confidential-field/activation changes), `content_lifecycle`
(data/publish/release/rollback), `approval` (approve/reject/revision-requested), `operational`
(backup/restore/scan/import/export/git-sync/webhook/job events), `security` (security exceptions),
`identity_recovery` (account recovery request/decision).

## 4. Why some new columns are NOT NULL with a backfill, and others are nullable

Migration `00019`'s own doc comment gives the full reasoning; summarized here:

- **`event_category`, `source_application`, `environment`, `confidentiality_classification`** —
  made `NOT NULL`, with existing rows backfilled via a deterministic `UPDATE` before the
  constraint was added. Each backfill is a provable fact about this project's real history, not a
  guess: `event_category` is a pure function of the already-stored `event_type`;
  `source_application` is `'dashboard-api'` because `AuditModule` has only ever been wired into
  `dashboard-api` (`AuthModule`/`AuthzModule`) — `dashboard-worker` has no audit wiring and
  `dashboard-web` never touches PostgreSQL (knowledge/01); `environment` is `'production'` because
  this project has never had a staging/preview deployment that wrote to the real database
  (CLAUDE.md's own "no staging environment exists"); `confidentiality_classification` is
  `'internal'`, the conservative default that grants no new visibility to any historical row.
- **`session_id`, `project_id`, `correlation_id`** — left nullable, no backfill attempted. Unlike
  the four columns above, there is no data already in this table (or reachable from it) that would
  make a backfill accurate rather than fabricated: no request-scoped correlation-ID propagation or
  session-linkage exists anywhere in the calling code yet (that's job/system-activity territory —
  §9 and §24 of the brief — not this slice). These are schema-ready slots only, the same
  "not FK-constrained, no business entity backing it yet" precedent `user_roles.project_id`
  established in migration `00016`. `AuditService.record()` accepts them as optional pass-through
  fields for any future caller that has real values to supply; none of the six existing call sites
  (`RoleAssignmentService`, `RecoveryService`) currently do.

## 5. What was deliberately NOT widened

The brief's §5 also lists "auth/session context reference" and "related task/review/release ID"
as fields. `session_id` (added here) covers the first. The second is left as the existing,
narrower `related_gate_or_approval_id` (from `00018`) rather than being renamed or widened to a
generic "related record ID" — no task/review/release entity exists in this codebase yet (those are
Phase 1E job-architecture and later-module concerns), so generalizing the column now would be
speculative schema design against nothing. When a real task/review/release entity exists, extend
this table's linkage then, against real requirements.

## 6. What this slice does NOT include

Matches the phased scope repeatedly stated in CLAUDE.md — schema and service-layer changes only:

- No `/audit` HTTP API (§28/§30/§31 of the brief) — no read/query/export endpoints, no
  `audit.view`/`audit.export` permissions defined yet.
- No independent code review or dedicated security review of this schema-expansion slice — those
  remain separate, not-yet-requested authorizations, same as the original audit-foundation slice.
- No traceability-matrix/HANDOFF/phase-plan update — tracked as still-open per the gap check that
  preceded this work.
- Jobs, notifications, retention (beyond the two `00018` columns), operational contacts, and system
  health remain entirely unbuilt.

## 7. Test coverage

`packages/database/test/phase1e-audit.integration.test.ts`'s "migration 00019 — expanded schema"
suite (real disposable database): new columns persist and round-trip correctly; `session_id`/
`project_id`/`correlation_id` default to `null` when omitted and round-trip a real value when
provided; a raw `INSERT` omitting `event_category` (and the other three `NOT NULL` columns) is
rejected at the database layer, not just by application code. `apps/dashboard-api/src/audit/audit.service.spec.ts`
adds: category derivation without the caller supplying one, pass-through of the three optional
context fields, and an explicit `confidentiality_classification` override. Full validation run
(this slice): typecheck/lint clean across all 9 workspace packages, 52/52 `packages/database`
tests (including a full migration `00001`→`00019` up/down round-trip), 152/152 `dashboard-api` unit
tests, 39/39 `dashboard-api` e2e tests, `pnpm audit` 0 vulnerabilities, prettier clean.
