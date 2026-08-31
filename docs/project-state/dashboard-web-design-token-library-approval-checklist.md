# `dashboard-web` Design Token Library UI — Approval Checklist (light tier)

**Status:** Built, independently re-verified, light-tier review complete (1 finding, fixed; 0
open). No separate security review, per the 2026-08-27 "right-size the review pipeline" standing
rule — this diff touches nothing security-relevant. Not yet second-role human reviewed, gated,
pushed, or merged — each remains its own separate, not-yet-requested next step.

## Completion condition

| #   | Item                         | Status                                                                                                                                                                                                                                        |
| --- | ---------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1   | Authorization to build       | ✅ Explicit "Start the Design Token Library UI" instruction — closes the module's last named gap (backend merged via PR #75)                                                                                                                 |
| 2   | Right pipeline tier chosen   | ✅ Light tier — a frontend-only UI slice consuming an already-reviewed, already-gated backend (PR #75, live), no new endpoint, no new RBAC/auth logic, mirrors the already-reviewed Website Strategy Center UI file-for-file                 |
| 3   | Required tests pass          | ✅ 1062/1062 `dashboard-web` unit tests (47 new for this module), independently re-run by the orchestrating session, not trusted from the build agent's own report                                                                          |
| 4   | Full validation clean        | ✅ `dashboard-web`/`dashboard-api`/`dashboard-worker` typecheck all clean (independently re-run); `eslint --max-warnings=0` clean; CSS-token check clean (54 files); `next build` clean, all 4 new routes present; `prettier --check` clean |
| 5   | Light-tier review complete   | ✅ Single direct read-through pass — verified the `group`/`publicId` create-only contract against the real backend DTO, the `TRANSITIONS` table against the real backend table, the plain-text-vs-rich-text field decision against the real backend (no sanitization call for `semanticPurpose`/`responsiveVariation`), the `isCurrent`-from-version-row convention, and reuse of shared helpers. **1 finding, fixed.** |
| 6   | Security review              | Skipped, per the standing rule — pure frontend UI, no new sink, no new auth logic                                                                                                                                                            |
| 7   | Live end-to-end verified     | Not yet — pending push/merge                                                                                                                                                                                                                 |
| 8   | Documentation updated        | This checklist; `docs/implementation/module-design-token-library.md` still shows its pre-merge "As-built" snapshot from the backend build (predates the actual security-review/gate/merge) — not amended by this slice                    |
| 9   | Exact branch/commit verified | Branch `dashboard-web-design-token-library`, commits `1c3180c` (build) → `6a51f75` (dedup fix) — not yet pushed                                                                                                                              |

## Forbidden-actions check

- No new backend endpoint, RBAC action, or migration — reuses the already-live, already-reviewed
  `apps/dashboard-api/src/design-token-library/*` surface verbatim.
- No new npm dependency.
- No confidential-field/redaction mechanism needed — matches the module registry's own seeded
  `confidentialityLevel: null`.

## Light-tier review — summary

A single direct read-through pass against the full diff and the real backend files it consumes
(`design-token-library.dto.ts`, `.service.ts`, `.controller.ts`, `entities.ts`) — not the 8-angle
finder fan-out, per the standing rule for small UI slices. Confirmed:

- `DesignTokenLibraryForm` correctly treats `group`/`publicId` as create-only, matching
  `updateDesignTokenSchema`'s real contract (neither field accepted on update).
- `semanticPurpose`/`responsiveVariation` are correctly kept as plain `<textarea>`s, not
  `RichTextEditor` — verified directly against `design-tokens.service.ts` that neither
  `sanitizeNullableRichText()` nor any sanitization call exists for these fields, so wrapping them
  in the rich-text editor would misrepresent what the backend actually stores. Matches
  `design-reference-library-form.tsx`'s own already-established reasoning for its own
  `desktopBehavior`/`mobileBehavior` fields.
- `DesignTokenStatusActions`'s `ALLOWED_TRANSITIONS` table matches `DesignTokensService`'s real
  `TRANSITIONS` table exactly, including the deliberate omission of the `approved -> superseded`
  edge (supersede is an automatic side effect of a different version's own approval, never a
  direct user action) and both terminal states.
- The detail page's `VersionEntry` reads `isCurrent` directly from each version row rather than
  cross-referencing a separately-timed fetch — the same race-avoidance convention
  `WebsiteStrategyCenterDetailPage`'s own code-review fix already established.
- Every established shared helper (`getApiBaseUrl`, `parseApiErrorMessage`, `isUuid`,
  `formatTimestamp`, `detail-section-styles.ts`, `list-filter-styles.ts`, `list-table-styles.ts`,
  `pagination.ts#buildHrefBySize`, `artifact-approval-status.ts`, `TagListField`) is reused, not
  reimplemented.
- All named behaviors above are directly exercised in the three new test files.

**1 finding, fixed**: `THEME_VARIATION_LABEL` (a 3-entry `light`/`dark`/`both` map) was
independently declared twice — once in `design-token-library-form.tsx`, once in the detail page.
Extracted into `lib/design-token-library-query.ts` alongside `GROUP_VALUES`/`GROUP_LABEL`, both
consumers updated to import instead of redeclaring. Re-validated after the fix: typecheck/lint/
CSS-token-check clean, 1062/1062 unit tests passing, `next build` clean, prettier clean.

## Sign-off

**Awaiting the required second-role human review** — since the implementing agent cannot also be
its own reviewer (ADR-0010), even under the light tier. A gate decision, push/PR, and merge
authorization each remain their own separate, not-yet-requested next steps.
