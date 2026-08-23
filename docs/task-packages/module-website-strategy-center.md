# Task Package: Website Strategy Center module backend

**Status:** Authorized to build. Not yet built.

Module #6 in the project-owner-supplied `canonical-inputs/Recommended_Module_Roadmap.md` — the
6th real business-module backend on the Phase 1F application shell / canonical module registry,
after Projects, Business Knowledge Center, Service Library, Persona Library, and Proof and Claims
Library.

## 1. Source material

- **Module registry seed** (`packages/database/src/migrations/00035-populate-module-registry-fields.ts:119-130`):
  `key: "website_strategy_center"`, `route: "/website-strategy-center"`,
  `dependencies: ["page_inventory", "internal_linking_library"]` (both unbuilt — see §6),
  `confidentialityLevel: null` (same as Persona Library/Proof and Claims Library — no
  confidential-field mechanism needed).
- **Canonical spec** (`03_Detailed_Module_Specifications.md:40-44`, quoted verbatim — the entirety
  of this module's spec text):
  > **Primary records:** navigation plan, page clusters, pillar strategy, platform strategy,
  > industry strategy, location strategy, conversion plan, search plan, internal-link plan.
  > **Actions:** create recommendation, compare versions, submit, approve, supersede.
- **Roadmap's own special instruction**: "Growth Director's main strategic workspace. Marketing
  plan + website strategy + service priorities + channel/search direction. Preserve versions when
  WebDesk changes business direction."
- **RBAC permission group** (`packages/database/src/migrations/00013-seed-rbac-matrix.ts:109-116`):
  `website_strategy` — `super_admin: VCERAMX`, `owner_growth_approver: VCERAX`,
  `marketing_editor: VCESR`, `designer_creative_reviewer: VCR`, `developer: V`,
  `qa_security_reviewer: VR`, `read_only: V`. Already seeded — no new RBAC migration.
- **Base entity standard / versioning convention** (`04_Data_Model_and_Ownership.md §1, §5`):
  `public_id` "human-readable stable identifier, unique"; §5 — "Approved artifacts are immutable.
  Editing an approved artifact creates a new draft version. `lock_version` prevents silent
  overwrites. Every approval references an exact entity version."

No field list, no explicit table names, and no wireframe exist for this module anywhere in the
doc set (confirmed — none of the 5 already-built sibling modules have a dedicated wireframe
either, so this is consistent with the doc set's own coverage, not a gap unique to this module).

## 2. Decisions confirmed directly with the user (`AskUserQuestion`, 2026-08-23)

**D1 — Schema shape: single generic table.** One table with a `recordType` enum discriminating
the 9 named "primary record" kinds — mirrors Business Knowledge Center's own precedent, the
closest structural analog given the spec names 9 record kinds with zero field list to
differentiate them (not 9 separate tables, which would have nothing beyond shared base fields to
justify their own schemas).

**D2 — Real version history, not a single mutable row.** Every sibling module built so far
(Business Knowledge Center, Service Library, Persona Library, Proof and Claims Library) uses one
mutable row per record with no real history. This module instead implements the project's own
documented general versioning convention (§5 above) for real: editing an APPROVED record creates
a genuinely new row (a new version), not an in-place mutation — so "compare versions" (a named
spec Action) has real prior versions to compare against, and "Preserve versions when WebDesk
changes business direction" is actually true, not just asserted.

## 3. Design decisions made by the implementer (flagged, not spec-sourced)

**D3 — Versioning mechanism, concretely.** Every version is its own row in
`website_strategy_records`:

- `id` (UUID PK) — unique per physical row/version.
- `recordId` (UUID) — the stable logical-record identity, shared by every version row of the same
  record. Generated fresh when a record is first created; copied forward unchanged onto every
  subsequent version. This is the grouping/history key — NOT the same as `id`.
- `publicId` — the human-readable identifier. Also stable across every version of the same
  record (copied forward, identical value on every version row), since its whole purpose is a
  stable reference a human uses over the record's lifetime, not a per-snapshot label. **Uniqueness
  is enforced via a partial unique index `WHERE is_current = true`**, not a bare `UNIQUE(public_id)`
  column constraint — a plain unique index would incorrectly reject version 2+ of the same record
  (which legitimately repeats the same `publicId`). This is the standard, idiomatic Postgres
  mechanism for "unique among only the currently-active rows."
- `versionNumber` (integer, starts at 1, increments per new version within the same `recordId`).
- `isCurrent` (boolean) — true for exactly one row per `recordId` at any time (the latest version,
  whether draft or approved). List/detail queries default to `isCurrent = true`. Flipped
  atomically (old current → false, new row → true) in the same transaction that creates a new
  version.
- `recordType` (enum, 9 values below) — set once at creation, immutable across a record's own
  version chain (a record's type never changes between its own versions; a real type change is a
  different record, not a new version of this one — enforced server-side).

**D4 — "Supersede" is not a separate user action; it's an automatic consequence of approving a new
version.** The spec names `supersede` as one of 5 actions ("create recommendation, compare
versions, submit, approve, supersede"), but there is no sourced description of it as a distinct
user gesture. The standard artifact-approval semantic (you can't have two simultaneously-approved
versions of the same logical record) makes the cleanest reading: when a new version's own
`approved` transition succeeds, the SAME transaction also flips whichever OTHER version of the
same `recordId` currently holds `approvalStatus = "approved"` (if any) to `"superseded"` — reusing
the existing generic-lifecycle `approved -> superseded` edge (already a legal transition in the
shared `TRANSITIONS` table every sibling module uses) rather than inventing a new one. The
superseded row is never deleted — it remains permanently readable via the version-history route,
satisfying "preserve versions."

**D5 — `recordType` enum (9 values, from the spec's own "Primary records" list, snake_case):**
`navigation_plan`, `page_clusters`, `pillar_strategy`, `platform_strategy`, `industry_strategy`,
`location_strategy`, `conversion_plan`, `search_plan`, `internal_link_plan`.

**D6 — Approval workflow reuses the shared generic-lifecycle `TRANSITIONS` table verbatim** — the
identical shape already used by Service Library/Persona Library/Proof and Claims Library (their
own `TRANSITIONS` tables are themselves each a direct copy of the one before). This is now
deliberately the 4th occurrence — self-flagged as accepted, tracked debt in code, matching every
prior module's own identical disposition, not silently duplicated without acknowledgment.

**D7 — Content fields stay plain text for this backend-only pass** — matching the exact,
consistent precedent of every prior module's own original backend build (Persona Library, Service
Library, Proof and Claims Library all shipped plain unsanitized text first, converting to
`RichTextEditor` + real sanitization only once a `dashboard-web` UI was later authorized and
built). No `dashboard-web` UI exists yet for this module.

**D8 — No cross-module relationship fields fabricated.** The module registry's own
`dependencies: ["page_inventory", "internal_linking_library"]` names two modules that don't exist
yet (and there is a real circular metadata dependency between this module and
`internal_linking_library` in the registry's own seed data — each names the other). Unlike Service
Library's `icpIds`/Persona Library's `relatedServiceIds`, the spec gives **no field list at all**
for this module, so there is nothing named to store as an unvalidated placeholder id-list either —
no such field is invented. If a real relationship field is ever named for this module later, it
follows the same unvalidated-array-until-the-target-module-exists precedent already established.

**D9 — No `project_id` scoping** — organization-wide, matching every other business-content
module (Business Knowledge Center, Service Library, Persona Library, Proof and Claims Library).

**D10 — `lock_version` vs. `version`.** The base standard names both `version` (a plain
incrementing integer) and a separate `lock_version` (specifically for optimistic locking) as two
distinct fields. This module's real multi-row version history already IS what `version` would
have tracked in a single-row design — a redundant bare-integer `version` column would be
meaningless here (it's `versionNumber`, doing that job at the row level). No `lock_version`
either: every sibling module's own `update()` already relies on an atomic single-statement
`UPDATE ... WHERE id = ...` (or, here, "does this row's `approvalStatus` allow in-place edit")
rather than a numeric optimistic-lock token, and this module's own atomic compare-and-swap
`updateStatus()` (mirroring every sibling's identical pattern) already prevents the concurrent-
status-write race that `lock_version` would otherwise guard against.

## 4. Schema

Single table, `website_strategy_records` (migration `00056`, plus `00057` marking the module
`in_development` in `module_registry`, mirroring every prior module's own two-migration pattern):

```
id                UUID PK
recordId          UUID NOT NULL           -- stable across all versions of one record
publicId          TEXT NOT NULL           -- stable across all versions; partial-unique WHERE is_current
recordType        ENUM (9 values, D5)     -- immutable across a record's own version chain
versionNumber     INTEGER NOT NULL        -- starts at 1, increments per recordId
isCurrent         BOOLEAN NOT NULL DEFAULT true
title             TEXT NOT NULL
content           TEXT NULL               -- plain text, D7
notes             TEXT NULL               -- plain text
approvalStatus    ENUM (8-value generic lifecycle, D6) DEFAULT 'draft'
createdBy         UUID NULL
updatedBy         UUID NULL
createdAt         timestamptz
updatedAt         timestamptz
```

Indexes: partial unique `(publicId) WHERE isCurrent = true`; `(recordId, versionNumber)` unique
(no two versions of the same record share a version number); `(recordId, isCurrent)` for the
common "find the current version" lookup; a `pg_trgm` GIN index on `title` for search, matching
Service Library's own precedent.

## 5. RBAC & routes

`MODULE_KEY = "website_strategy"`. Every route method-level `@RequirePermission` (never
class-level — the exact bug Service Library's own dimensions controller had once and fixed).

- `GET /website-strategy-center/records` (`view`) — lists CURRENT versions only, filtered by
  `recordType`/`approvalStatus`/`search`, paginated (mirrors every sibling `list()`).
- `GET /website-strategy-center/records/:recordId` (`view`) — the CURRENT version of a record (by
  `recordId`, not row `id`).
- `GET /website-strategy-center/records/:recordId/versions` (`view`) — the full version history
  for a record, all rows, ordered by `versionNumber`.
- `POST /website-strategy-center/records` (`create`) — creates a new record: `versionNumber = 1`,
  `isCurrent = true`, `approvalStatus = "draft"`.
- `POST /website-strategy-center/records/:recordId/update` (`edit`) — updates the CURRENT
  version: if its `approvalStatus` is NOT `"approved"`, mutates that row in place (matching every
  sibling module's own `update()`); if it IS `"approved"`, creates a new draft version instead
  (D3/D4) — `recordType` may never differ from the current version's own.
- `POST /website-strategy-center/records/:recordId/status` (route-level `view`, the real
  per-transition action — `submit`/`review`/`approve` — checked dynamically inside the service,
  mirroring every sibling's own layered pattern) — transitions the CURRENT version's
  `approvalStatus`. A successful `-> approved` transition additionally, atomically, flips the
  record's previously-current-approved version (if one exists) to `"superseded"` (D4).

## 6. Explicitly out of scope for this pass

- No `dashboard-web` UI (backend-only, matching every prior module's own precedent).
- No real relationship to `page_inventory`/`internal_linking_library` — neither exists yet (§D8).
- No computed "diff" between two versions — `GET .../versions` returns the raw list; any visual
  comparison is a `dashboard-web`-side concern for a later, separate authorization.
- No rich-text/sanitization (D7) — deferred to the eventual UI-build pass, matching every prior
  module's own identical precedent.
