# Module: Asset Library

> Single-file module record, per `CLAUDE.md`'s 2026-08-27 collapsed-template rule. The `## Scope`
> section below was authored **before** any code was written; `## As-built` is appended after.

Module #15 on `canonical-inputs/Recommended_Module_Roadmap.md`. The 14th real business-module
backend built on the Phase 1F application shell / canonical module registry, after Projects,
Business Knowledge Center, Service Library, Persona Library, Proof and Claims Library, Website
Strategy Center, Page Inventory, Keyword & Entity Library, Internal Linking Library, Content
Template Library, Review and Approval Center, Page Workspace, and Brand Library.

## Scope

### Sources

Unlike most modules in this project, real spec material exists and was read directly:

- `03_Detailed_Module_Specifications.md §12` — the field list ("asset ID, file reference, MIME
  type, size, checksum, dimensions, duration, licence, consent, alt guidance, visibility, related
  records, retention, scan status") and the storage rule ("direct authenticated upload to private
  Blob for files above function request limits. Secret URLs are time-limited").
- `canonical-inputs/Recommended_Module_Roadmap.md:49` — "Track ownership/licence/alt text/file
  status/usage. Private assets remain private until approved."
- `packages/database/src/migrations/00035-populate-module-registry-fields.ts:217-228` — the seeded
  registry row: route `/asset-library`, navigation group `libraries` (order 8),
  `dependencies: null` (no blocking dependency — buildable now), and, notably,
  `confidentialityLevel: "record-level; files may show 'Scan Not Configured' — never claimed
malware-free"`.
- `packages/database/src/migrations/00015-seed-module-registry.ts:39` — RBAC permission group
  `creative_design`, the same group Brand Library uses. **No new RBAC migration is needed.**
- `packages/database/src/migrations/00013-seed-rbac-matrix.ts:136-144` — `creative_design` grants:
  `super_admin: VCERAPX`, `owner_growth_approver: VERAPX`, `designer_creative_reviewer: VCERAS`,
  `marketing_editor: VR`, `developer: V`, `qa_security_reviewer: VR`, `read_only: V`.

### Design decisions

Three genuine architectural forks were put to the project owner directly (`AskUserQuestion`)
before any code was written, rather than silently resolved. All three were decided as recommended.

**D1 — File storage: metadata-only in this pass.** `fileReference` is a plain nullable URL string,
validated as a safe `http(s)` URL at the DTO layer via `safeHttpUrlSchema` (`@webdesk/validation`)
— exactly Brand Library's own already-reviewed D2 choice, and the same DTO-layer-not-DB-constraint
split `projects.environments.url` / `proof_claims.claim_sources.source_url` already use.

This is a **deliberate, flagged deviation from spec §12's own headline rule** ("direct
authenticated upload to private Blob... secret URLs are time-limited"), not an oversight. The
reason is concrete: **no Vercel Blob store is provisioned for `webdesk-growth-dashboard-7v1u`** —
`BLOB_READ_WRITE_TOKEN` does not exist among that project's env vars. This is a standing open
blocker in `CLAUDE.md`, and it already caused a real, confirmed production `500` on
`POST .../attachments/upload-route` on 2026-08-21, the first genuine upload attempt in production.
Building the full upload pipeline now would ship a headline feature that fails on every use.

The already-reviewed machinery for real uploads exists and is reusable once the blocker clears
(`packages/integrations`'s `VercelBlobAdapter`, and Business Knowledge Center's own
upload-route/confirm/content-proxy/delete endpoint set). Wiring it here is its own separate,
not-yet-authorized slice.

Consequence, recorded honestly: `mimeType`, `fileSizeBytes`, `checksum`, `widthPx`/`heightPx`, and
`durationSeconds` are **caller-supplied metadata in this pass, not values this system derived from
a file it actually holds.** Once real upload lands, those become server-derived and should stop
being writable. Their DTO comments say so.

**D2 — Real record-level confidentiality enforcement.** Unlike Brand Library (whose registry
`confidentialityLevel` is genuinely `null`, which is why its build correctly omitted any such
mechanism), `asset_library`'s seeded value is a real one: `"record-level; ..."`. Combined with the
roadmap's "Private assets remain private until approved," that is a real requirement, not an
approval-workflow description.

So this module wires the existing, already-shared redaction mechanism —
`AuthorizationService.canViewConfidential()` plus `redactConfidentialFields()`
(`apps/dashboard-api/src/authz/confidential-field.util.ts`) — mirroring Service Library's and
Business Knowledge Center's own `redactIfRestricted()` / `redactRestrictedRecords()` controller
helpers.

- `visibility` is a real 3-value column (`public` | `internal` | `restricted`), matching Service
  Library's own `confidentiality` vocabulary.
- Redacted fields on a `restricted` asset, for a caller lacking `view_confidential`:
  **`fileReference`** (the actual location of a private asset — the single thing the roadmap's
  "private assets remain private" sentence is most directly about) and **`consentReference`**
  (consent evidence routinely names real people). Deliberately conservative and name-driven, the
  same selection discipline Service Library's own single-field `internalDescription` choice used.
  Everything else (title, licence terms, alt guidance, dimensions) reads as ordinary cataloguing
  metadata and stays visible.
- As with every prior module, `view_confidential` is **zero-seeded for every role today** (see
  `00013-seed-rbac-matrix.ts`'s own header comment — confidential-field access is an explicit
  future grant, never pre-seeded). So today this redacts for _everyone_ on a `restricted` asset.
  That is the correct, fail-closed behavior, not a bug.

**D3 — Related records as a real polymorphic child table.** Spec §12 names "related records" with
nothing constraining which module they point at. Modeled as `asset_related_records` rows carrying
`(module_key, record_id)`, mirroring Review and Approval Center's own already-reviewed
`(targetModuleKey, targetId)` polymorphic pattern, with `module_key` validated against the real
module registry via `AuthorizationService.isValidModuleKey()`.

No foreign key to the target record — deliberately, and for the same reason R&AC has none: the
target may live in any of the 43 modules, most of which have no table yet. Chosen over Service
Library's unvalidated `string[]` precedent because a bare id array loses _which module_ the id
belongs to, which is genuinely ambiguous for a field that can point anywhere. This also satisfies
the roadmap's "usage" tracking requirement.

**D4 — `scanStatus` reports honestly, and never claims clean.** The registry's own seeded text is
explicit: "files may show 'Scan Not Configured' — never claimed malware-free." So `scan_status` is
an enum defaulting to `not_configured`, and **no code path in this module ever sets it to
`clean`** — no malware scanner exists anywhere in this system. The enum carries the other real
values (`pending`, `infected`, `failed`) so a future scanner integration has somewhere to write,
but nothing fabricates a result today. It is server-managed and never accepted as caller input.

**D5 — Approval workflow reused verbatim.** The standard 8-value `ArtifactApprovalStatus`
vocabulary and the `TRANSITIONS` table are reused byte-for-byte from Brand Library's own (already
code-reviewed) version, including its atomic compare-and-swap `updateApprovalStatus()` and both
terminal states. This is now the 6th occurrence of this shape — an already-accepted,
already-flagged tracked-debt duplication in this codebase; extracting a shared abstraction is
noted again here but stays out of scope for a single-module pass, matching every prior module's
own identical reasoning.

**D6 — Real publish/unpublish.** The seeded `creative_design` group carries a real `P` grant
(`publish`/`unpublish`), held by `super_admin` / `owner_growth_approver`. Brand Library already
built the mechanism for this exact group; Asset Library reuses it verbatim, including `publish()`'s
"only an `approved` record may be published" gate, the `COALESCE(published_at, NOW())` stamp-once
contract, and both CAS guards. This directly serves the roadmap's "private assets remain private
until approved."

**D7 — `retentionNote` is plain text, not a foreign key.** Spec §12 names "retention," and a real
`retention_policies` table exists from Phase 1E. A nullable FK was considered and rejected: no UI
or API anywhere creates a retention policy, so the field would be permanently unusable — the exact
"required `categoryId` with zero seeded rows and no way to create one" defect Service Library's own
UI code review already surfaced. A plain note keeps the spec's field real and usable today; a real
FK is a clean follow-up once retention policies are actually manageable.

**D8 — `title` is added, beyond the spec's flat field list.** §12 names "asset ID" but nothing
human-readable. Every sibling module has a title, list/search UX needs one, and an asset catalogue
keyed only by an opaque id is not usable. Flagged as an addition, not as spec-sourced.

**D9 — Organization-wide, not project-scoped.** No `project_id` column. The registry seeds no
project-scoping signal for this module and `dependencies: null`; this matches every other
creative/library module (Brand Library, Content Template Library, Persona Library, Service
Library). Page Inventory and Keyword & Entity Library are project-scoped, but both are inherently
per-client-website; an asset catalogue is not.

### Explicitly out of scope

- **Real file upload/download.** Per D1 — needs the Blob blocker cleared first, then its own slice.
- **Malware scanning.** Per D4 — no scanner exists; nothing is faked.
- **Time-limited secret URLs.** Part of spec §12's storage rule; belongs with the upload slice.
- **Any `dashboard-web` UI.** Backend-only, matching every prior module's own backend-first
  precedent. A separate, not-yet-requested next step.
- **Hard delete.** No module in this codebase has one; `archived` is the retirement mechanism
  (ADR-0016).

### Review tier

**Full pipeline**, per `CLAUDE.md`'s 2026-08-27 right-sizing rule: this is a new backend module
introducing a new endpoint class, a new confidential-field enforcement surface, and a new
polymorphic cross-module reference — squarely in the "genuinely risky" bucket, not the light tier.

## As-built

Built on branch `module-asset-library`, off `main` at `c85dba3`. Backend only — `apps/dashboard-web`
is untouched, matching every prior module's own backend-first precedent.

### What exists

- **Migrations `00072`/`00073`** — `assets` + `asset_related_records`, then the registry's
  `implementation_status` flip to `in_development`.
- **`packages/database/src/asset-library/`** — entities, models, `AssetRepository`,
  `AssetRelatedRecordRepository`. Exported from **both** barrels (`index.ts` AND `index.cjs.ts`) —
  the separately-maintained CommonJS entrypoint Vercel's bundler actually `require()`s in
  production, per this project's own documented outage.
- **`apps/dashboard-api/src/asset-library/`** — DTOs, `AssetsService`, `AssetRelatedRecordsService`,
  `AssetsController`, `AssetRelatedRecordsController`, DI providers, module. Wired into
  `app.module.ts`.
- **Routes** — `GET/POST /asset-library/assets`, `GET|POST /asset-library/assets/:id`,
  `POST .../:id/{update,status,publish,unpublish}`, and the nested
  `GET|POST /asset-library/assets/:assetId/related-records` plus `POST .../:id/{update,delete}`.

Every `@RequirePermission` is method-level, never class-level — `PermissionGuard` reads only
`context.getHandler()`, so a class-level decorator silently fails closed (the exact bug Service
Library's dimensions controller shipped with once).

### Verification

All run against a real, disposable local PostgreSQL 17 database (`webdesk_asset_test`), not mocked:

| Check                                                           | Result                                                         |
| --------------------------------------------------------------- | -------------------------------------------------------------- |
| `dashboard-api` unit tests                                      | **1044/1044** (74 new: 34 service, 12 related-records, 28 DTO) |
| `packages/database` integration                                 | **440/440**, 25/25 files (24 new)                              |
| `dashboard-api` e2e                                             | **442/442**, 25/25 files (33 new)                              |
| Migration up/down round-trip                                    | clean — 73 applied, `00073` reverted                           |
| `validate:module-registry`                                      | 43 modules, 21 permission groups                               |
| typecheck / lint (`--max-warnings=0`) / `nest build` / prettier | clean                                                          |
| `boundaries:check`                                              | 0 errors (8 pre-existing `dashboard-web` warnings)             |
| `pnpm audit`                                                    | 0 vulnerabilities                                              |

### Two real test-writing lessons

**1. `updated_by` is a UUID foreign key, not a label.** Two integration race tests initially passed
`"actor-a"`/`"actor-b"` as `updatedBy`, which Postgres rejected outright
(`invalid input syntax for type uuid`). The sibling Brand Library suite passes `null` for exactly
this reason, and the CAS guard is on `(id, approvalStatus)` anyway — actor identity plays no part
in which concurrent caller wins. Test bug, not a code bug.

**2. A failing suite corrupts the shared database for every other suite.** Those same two failures
also broke an unrelated, pre-existing suite
(`phase1e-audit-migration-00019-regression`, which does `migrator.up({ to: "00018-..." })` and fails
if the database is already migrated past that point). This was diagnosed rather than assumed:
that suite passes alone on a clean database; the full run passes 24/24 with this module's file
excluded; and it returned to green once the two real bugs above were fixed. Every integration file
shares one database with `fileParallelism: false`, so a broken `afterAll` teardown is felt
downstream. The same hazard is already on record from Page Workspace's own test-execution pass.

### Not verified

Nothing outstanding for this module. The one caveat is environmental, not code: this was validated
against local PostgreSQL 17, not against production — the production migration is, as always, a
separate step the project owner runs themselves.
