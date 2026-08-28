# `dashboard-web` Asset Library UI — Approval Checklist

**Status:** Built, fully validated. Reviewed at light tier — a single direct read-through pass,
per `CLAUDE.md`'s 2026-08-27 right-sizing rule (a small, frontend-only UI slice consuming an
already-reviewed, already-gated backend — `module-asset-library`, `G4-asset-library` — with no new
endpoint or auth logic). Not yet second-role human reviewed, gated, pushed, or merged.

Closes the Asset Library module's last named gap, following the backend's own build arc
(`module-asset-library`, gate `G4-asset-library`, merged to `main` via PR #74, 2026-08-28).

## Completion condition

| #   | Item                            | Status                                                                                                                                                                                                                                                                                                                                     |
| --- | ------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| 1   | Authorization to build          | ✅ Explicit "start dashboard-web ui for asset library module" instruction, after confirming the backend was genuinely merged and live (the local branch had been stuck on an unmerged, conflicting PR — the user resolved the conflict and merged it directly before this build began, independently verified via `/health`'s `commitSha`) |
| 2   | Backend confirmed live          | ✅ `dashboard-api`'s `/health` returned `commitSha == 1a1d2e9` (the PR #74 merge commit); `GET /asset-library/assets` returned a clean `401`, not `404`                                                                                                                                                                                    |
| 3   | Required tests pass             | ✅ 1013/1013 `dashboard-web` unit tests (69 new across 5 files: `asset-library.test.tsx`, `asset-library-form.test.tsx`, `asset-library-status-actions.test.tsx`, `asset-library-publish-actions.test.tsx`, `asset-related-records-section.test.tsx`) — full suite unaffected                                                              |
| 4   | Full validation clean           | ✅ typecheck, lint (`--max-warnings=0`), CSS-token check (52 files), `next build` (all 4 new routes present), prettier all clean                                                                                                                                                                                                           |
| 5   | Self-review complete            | ✅ Single direct read-through pass — found and fixed 1 real bug (see below); confirmed field length caps (`publicId` 64, `title` 255, `fileReference` 500, `checksum` 128, short-text fields 255, `INTEGER`/`BIGINT` bounds) match the backend DTO exactly                                                                                 |
| 6   | Security review                 | Skipped per the light-tier rule — no new endpoint, no new sanitization mechanism (reuses the already-vetted `RichTextEditor` + `sanitizeNullableRichText`/`SanitizedRichText` pattern), no new auth logic                                                                                                                                  |
| 7   | Known out-of-scope gaps flagged | ✅ No real file upload (D1, backend-level — no Blob store provisioned); the module-key picker for related records is sourced from `session.navigation`, matching `ReviewForm`'s own already-fixed pattern, not the RBAC-gated registry endpoint                                                                                            |
| 8   | Live end-to-end verified        | ⚠️ Not verified in a live browser — port 3000 was occupied by an unrelated, non-matching process in this environment (confirmed via a 404 on a known-existing route, `/brand-library`), so live-rendering wasn't possible. Verified instead via a clean `next build` with all 4 routes present, and the full unit test suite               |
| 9   | Documentation updated           | ✅ This file                                                                                                                                                                                                                                                                                                                               |
| 10  | Exact branch/commit verified    | Branch `dashboard-web-asset-library`, off `main` at the PR #74 merge commit (`1a1d2e9`)                                                                                                                                                                                                                                                    |
| 11  | Live in production              | ⛔ Not yet — second-role human review, a gate decision, push/PR, and merge each remain their own separate, not-yet-requested authorization                                                                                                                                                                                                 |

## Self-review — the one real finding

`AssetLibraryForm`'s `isRedacted` flag (governing whether `consentReference` renders as an inert
notice instead of an editable field, and whether it's omitted from the submit payload) was
initially computed as `initial?.visibility === "restricted"` alone. That's wrong: a caller who
genuinely holds `view_confidential` sees the real, non-null `consentReference` value on a
restricted asset (the backend only redacts for a caller _lacking_ the grant) — keying the check on
visibility alone would have permanently hidden and made un-editable-via-this-form a field that
caller can legitimately see and change. **Fixed** by requiring both
`visibility === "restricted"` AND `consentReference === null` — the same "both conditions"
discipline this form's own doc comment now explains. Two regression tests cover both branches
(a redacted `null` case, and a genuinely-visible non-null case).

## Design notes

- **Confidential-field ambiguity, honestly disclosed.** Unlike `Service.internalDescription`'s
  `undefined`-signals-redaction convention, this backend redacts `fileReference`/`consentReference`
  by nulling them — the same shape as a genuinely-unset value. Both the form and the detail page
  hedge accordingly rather than falsely claiming certainty either way.
- **Related records** (`asset_related_records`) built as a real sub-resource with full add/edit
  (note-only)/delete CRUD from day one, mirroring `ClaimSourcesSection`'s established pattern. The
  module-key picker reuses `ReviewForm`'s own already-fixed data source
  (`session.navigation`/`GET /me/navigation`) rather than the RBAC-gated
  `GET /authz/module-registry`, avoiding the identical bug that form's own code review already
  caught once.
- Every long-text field uses `RichTextEditor`, per the 2026-08-22 standing rule — no new backend
  sanitization work was needed since `AssetsService.create()`/`update()` already wired
  `sanitizeNullableRichText()`/`sanitizeRichTextHtml()` in from the backend's own original build.

## Sign-off

Awaiting the required second-role human review, gate decision, push/PR, and merge — each its own
separate, not-yet-requested authorization per this project's standing "no auto-merge" rule.
