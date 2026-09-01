# Knowledge Library module (`knowledge_library`)

## Scope

Built directly on the explicit "Start Knowledge Library module" instruction. Module #28 on the
advisory `Recommended_Module_Roadmap.md`; the dependency-computed
`docs/phase-plans/module-implementation-roadmap.md` places `knowledge_library` in **Wave 1 (no
dependencies)** — the registry's own seeded `dependencies` is `null`.

The canonical spec (`03_Detailed_Module_Specifications.md §28`) is a thin, flat field list with no
workflow/state-machine section and no sub-resources — the same thin-spec situation Design Token
Library / Section and Pattern Library / Motion and Interaction Library each hit:

> source type, title, URL/file, owner, date, confidentiality, approved for agent use,
> mandatory/advisory, related entities, version, last review.

The seeded `module_registry` row uses permission group `business_knowledge` — **the identical RBAC
group Business Knowledge Center (`business_knowledge_center`) already uses** — with description
"Reference sources with type, title, location, owner, date, confidentiality, and an
approved-for-agent-use flag." Its `confidentialityLevel` seed value is an unusual free-text
placeholder ("explicit per-record confidentiality field, enum values not yet specified") rather
than `null` or a real enum, flagging a genuine design gap rather than a settled decision.

### Design decisions confirmed with the project owner (`AskUserQuestion`)

- **D1 — Confidentiality model**: a real `public | internal | restricted` enum (Service Library's
  own already-reviewed pattern), gated via `AuthorizationService.canViewConfidential()` — the same
  mechanism Service Library/Proof and Claims Library use. **Chosen over** a 2-value
  public/internal-only enum, and over a no-enforcement plain string label.
- **D2 — Table shape**: a single generic table, matching Business Knowledge Center's own precedent
  (same RBAC group, same flat unstructured field list, no described sub-resources). **Chosen over**
  a more normalized multi-table shape.

### Design decisions made directly (same pattern as every prior thin-spec module)

- **D3 — Status vocabulary**: since this module shares Business Knowledge Center's exact RBAC
  group, and the spec explicitly names a `mandatory/advisory` field distinct from confidentiality
  (unlike BKC, where `restricted` doubles as both lifecycle and confidentiality), Knowledge
  Library's own lifecycle status is modeled as a 4-value vocabulary —
  `draft | mandatory | advisory | deprecated` — BKC's own vocabulary with `restricted` removed,
  since confidentiality is now a real, separate field per D1. `deprecated` is terminal (no hard
  delete, ADR-0016, matching every sibling module). The status-change route is gated on the
  `approve` action only (a static gate, not a dynamic per-transition check) — mirroring BKC's own
  already-reviewed, already-accepted shape exactly, since both modules share the identical RBAC
  grant matrix.
- **D4 — `sourceType`**: the spec names this field but gives no taxonomy of values anywhere (no
  enumerated list the way `pageType`/`recordType` had one for other modules) — modeled as a plain,
  uncapped free-text field rather than a fabricated closed enum, to avoid inventing spec content
  that doesn't exist.
- **D5 — `location` (the spec's "URL/file" field)**: modeled as a plain text field, not a validated
  URL — a reference source's location may genuinely be a URL, an internal file path, or a
  citation, and forcing `safeHttpUrlSchema` on it would reject legitimate non-URL values. Not
  rendered as a clickable link by this backend-only pass (no XSS/open-redirect surface as a
  result) — a `dashboard-web` UI build would need to decide separately whether/how to linkify it,
  the same URL-scheme caution Projects' `environment.url` and Proof and Claims Library's
  `sourceUrl` already established for genuine link fields.
- **D6 — `ownerUserId`**: a real, existence-validated FK into `users`, mirroring
  `ProjectService.assertOwnerExists()`'s own pattern.
- **D7 — `relatedEntityIds`**: a plain, unvalidated string array — "related entities" isn't scoped
  to any single other module in the spec, so no existence-check target exists.
- **D8 — `version`**: a server-managed integer counter incremented on every `update()`, mirroring
  Persona Library's own pattern — not real multi-row version history (Website Strategy Center's
  own mechanism), since nothing in this module's spec names a "compare versions" action the way
  Website Strategy Center's spec explicitly did.
- **D9 — `lastReviewedAt`**: a plain, caller-settable nullable timestamp field via the ordinary
  `update()` route — no dedicated "mark reviewed" action is described anywhere in the spec.
- **D10 — `approvedForAgentUse`**: a plain boolean, defaulting to `false`. No enforcement point
  exists yet (no consuming "agent memory" mechanism is built anywhere in this codebase) — stored,
  not yet acted on, matching this module's own roadmap note ("do not permanently feed unapproved
  ... data into agent memory") as a future consumer's responsibility, not this backend's.

Reuses the `business_knowledge` RBAC group verbatim — no new RBAC migration. No confidentiality
redaction test/precedent exists for a _third_ field beyond `content` the way BKC has one field —
Knowledge Library redacts `location`/`notes` (its own analogues of "the sensitive content") when
`confidentiality = "restricted"` and the caller lacks `view_confidential`, mirroring
`redactIfRestricted()`'s shape from Service Library/BKC.

## As-built

Backend built directly on branch `module-knowledge-library`, off `main`. `KnowledgeLibraryRecordEntity`
(single table `knowledge_library_records`) with `title`/`sourceType`/`location`/`ownerUserId`/
`sourceDate`/`confidentiality`/`approvedForAgentUse`/`status`/`notes`/`relatedEntityIds`/`version`/
`lastReviewedAt` per D1–D10. Migration `00095-create-knowledge-library` (table, three plain indexes,
plus a `pg_trgm` GIN trigram index on `title` mirroring Section and Pattern Library/Design Token
Library/Website Strategy Center's own precedent) and `00096-mark-knowledge-library-in-development`.

`KnowledgeLibraryRecordRepository` mirrors `PersonaRepository`'s own already-reviewed pattern for
the server-managed `version` counter (`literal("version + 1")` inside `update()`'s own `UPDATE`
statement, `returning: true` to avoid a second round trip) and the atomic compare-and-swap
`updateStatus()` (also `returning: true`) — an improvement over Business Knowledge Center's own
slightly older re-fetch-after-write shape, since Persona Library is the more recent, already-
reviewed precedent for this exact pattern.

`KnowledgeLibraryRecordsService.create()`/`update()` existence-validate a real, changed `ownerUserId`
via the shared `UsersService.assertUserExists()` helper (already extracted during the Review and
Approval Center module's own code review, specifically to retire the repeated hand-copies of this
check across `ProjectService`/`ServicesService`/`InternalLinksService`) — Knowledge Library is the
first new module to consume that shared helper directly from day one rather than hand-copying its
own private version. `changeStatus()` mirrors Business Knowledge Center's `ALLOWED_TRANSITIONS`/
audit-event shape exactly, adapted to the 4-value status vocabulary (D3).

`KnowledgeLibraryRecordsController` mirrors `BusinessKnowledgeRecordsController`'s exact route
shape (`GET /knowledge-library/records`, `GET /:id`, `POST /`, `POST /:id/update`,
`POST /:id/status`) and its confidential-field redaction pattern (`redactIfRestricted()`/
`redactRestrictedRecords()`), keyed on `record.confidentiality === "restricted"` rather than
`record.status === "restricted"` (D1 — confidentiality is a real, separate field here, unlike BKC,
so a record can be `restricted` at any lifecycle stage including `draft` — verified directly by a
dedicated e2e test). `MODULE_KEY = "business_knowledge"` — the real RBAC permission-group key
reused verbatim from Business Knowledge Center, distinct from the module-registry navigation key
`knowledge_library`.

No `packages/shared-types` additions — confirmed directly that Business Knowledge Center's own
backend-only pass added none either (shared-types entries land with the `dashboard-web` UI build,
not the backend), matching every prior module's own backend-first precedent. No `dashboard-web` UI
exists yet for this module.

**Validation, all independently run against a real disposable local PostgreSQL 17 database
(`webdesk_knowledge_library_dev`), not assumed:**

- `packages/database` typecheck/build: clean.
- Migration round-trip: `up` (all 96 migrations, including `00095`/`00096`), `down` (reverting
  `00096` then `00095`), `up` again — clean both directions.
- `packages/database/test/module-knowledge-library.integration.test.ts`: 15/15 new tests, against
  a real database — covers create defaults, full field round-trip (including the `confidentiality`
  enum and `sourceDate` DATEONLY column), `list()` filtering (status/confidentiality/exact-match
  `sourceType`/`approvedForAgentUse`), the `MAX_LIST_LIMIT` clamp, `update()`'s atomic version
  increment (including a genuine concurrent-call race proving no lost updates), `relatedEntityIds`
  null-to-empty-array clearing, `lastReviewedAt` setting, the atomic `updateStatus()`
  compare-and-swap (`updated`/`not_found`/`conflict` outcomes), and both real DB-level ENUM
  constraints (`status`, `confidentiality`). Full `packages/database` integration suite: 705/705
  (36 files), confirming no regression to any other module's own migration lifecycle.
- `apps/dashboard-api/src/knowledge-library/knowledge-library-records.service.spec.ts`: 21/21 new
  unit tests — create (with/without `ownerUserId`, a malformed/nonexistent owner rejected cleanly),
  update (audit event, `ownerUserId` re-validation only when changed, no re-validation when
  cleared to `null` or resent unchanged, `NotFoundException` when the record has since
  disappeared), and the full `changeStatus()` matrix (no-op same-status, invalid transition,
  allowed transition with the right audit `eventType`/`retentionCategory`, not_found, conflict,
  and audit-failure resilience). Full `dashboard-api` unit suite: 1515/1515 (90 files).
- `apps/dashboard-api/test/knowledge-library.e2e-spec.ts`: 14/14 new e2e tests against a real
  disposable database with real seeded RBAC roles — 401 with no session; a full `super_admin`
  create/read/list/update round trip (confirming default `status: draft`/`confidentiality:
public`/`version: 1`/`approvedForAgentUse: false`); `read_only` denied create (403) but allowed
  list (200); `marketing_editor` (VCES) can create/edit but is denied the status route (403,
  static `approve` gate, not a dynamic per-transition check); `super_admin` approving
  `draft -> mandatory`; an invalid `deprecated -> mandatory` transition rejected (400, terminal
  state); 404 on a nonexistent id; 400 (not a raw 500) on a malformed id;
  `OriginCheckGuard` rejecting a mutating request with no `Origin` header (403); `ownerUserId`
  existence-validation rejected on both create and update (400 each); and two dedicated D1 tests
  proving a record can be created directly as `restricted` with `location`/`notes` redacted across
  create/get/list responses for a caller with no `view_confidential` grant (zero-seeded — same as
  Business Knowledge Center), and that `confidentiality` is independent of `status` (a `restricted`
  record can also be `draft`). Full `dashboard-api` e2e/integration suite: 704/704 (36 files).
- `pnpm --filter @webdesk/dashboard-api typecheck`/`lint --max-warnings=0`, `pnpm --filter
@webdesk/database lint`: all clean.
- `pnpm exec prettier --check` on every new/touched file: clean.
- `pnpm audit`: 0 vulnerabilities (no new npm dependency was added).
- `pnpm validate:module-registry`: 43 modules, 21 permission groups, all references resolve —
  unaffected.
- Both `packages/database/src/index.ts` and `index.cjs.ts` (the separately-maintained CommonJS
  barrel Vercel's Function bundler actually consumes in production) updated with the new
  `./knowledge-library/index.js` export — verified present in both files directly, per this
  project's own documented Cautions-section lesson about that exact class of production outage.

No deviations from the build prompt's spec beyond what the prompt itself explicitly left to
judgment: `sourceType` list-filter is an exact match (not a fuzzy `ILIKE` search) since it's a
free-text field with no taxonomy (D4) — a "filter" on such a field is only meaningful as an
exact-value match, the same reasoning Business Knowledge Center's own `recordType` enum filter
already established; `notes` uses `DataTypes.TEXT` at the model/migration layer (matching BKC's
own `notes` column) with the 10,000-character cap enforced only at the Zod DTO layer, not a
DB-level `VARCHAR` bound.
