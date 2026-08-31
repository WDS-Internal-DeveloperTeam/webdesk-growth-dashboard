# `dashboard-web` Section and Pattern Library UI — Approval Checklist

**Status:** Built, fully validated, self-reviewed at light tier (per the 2026-08-27 right-sizing
rule — a small, frontend-only UI slice consuming an already-reviewed, already-gated backend with
no new endpoint or auth logic). **0 findings.** No separate security-review pass — nothing in
this diff is security-relevant. **Awaiting the required second-role human review.**

## Completion condition

| #   | Item                                       | Status                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                           |
| --- | ------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| 1   | Authorization to build                     | ✅ Explicit "Start the dashboard-web UI for it" instruction, closing this module's last named gap following the backend's own build-to-production arc (PR #78, live)                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                             |
| 2   | Genuine scoping decisions surfaced         | ✅ No approved wireframe exists for this module — sections mirror the backend's own field grouping, the same "smallest honest reading" precedent every prior unsourced-screen module already establishes. No `AskUserQuestion` needed — a direct file-for-file mirror of Design Token Library's already-reviewed UI, whose own design decisions already answer every open question here.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                         |
| 3   | Required tests pass                        | ✅ 1087/1087 `dashboard-web` unit tests (25 new — 14 form, 11 status-actions), independently re-run by the orchestrating session against a rebuilt `@webdesk/shared-types`, not just trusted from the build agent's own report                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                   |
| 4   | Full validation clean                      | ✅ typecheck (`dashboard-web`/`dashboard-api`/`dashboard-worker`) clean, `eslint --max-warnings=0` clean, CSS-token check clean (56 files), `next build` clean with all 4 new routes present, `prettier --check` clean                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                           |
| 5   | Independent code review complete           | ✅ Light tier — a direct read-through pass over every new file (form, status-actions, list page, detail page, both lib files) verified: the field-treatment split (`RichTextEditor` for the 3 backend-sanitized fields, plain monospace `<textarea>` for the 3 unsanitized code fields, `TagListField` for the 3 unvalidated arrays) against the actual backend source; the `TRANSITIONS`/`ALLOWED_TRANSITIONS` table byte-matched against `section-patterns.service.ts`'s own table, target-by-target; the version-history list's `isCurrent`-from-row (not a second live fetch) pattern; the `isSafeHttpUrl()` guard before rendering `designReference` as a link; the terminal-state edit-link hiding; reuse of every established shared helper (`list-filter-styles`, `list-table-styles`, `pagination`, `artifact-approval-status`, `detail-section-styles`, `api-errors`). **0 findings.** |
| 6   | Security review complete                   | ➖ Skipped per the 2026-08-27 light-tier rule — this diff touches nothing security-relevant: no new endpoint, no new auth logic, `designReference` reuses the existing `isSafeHttpUrl()` guard, rich-text fields route exclusively through the existing `SanitizedRichText`/`RichTextEditor` components, every mutation reuses the existing `fetch(credentials:"include")`/`OriginCheckGuard` pattern already vetted on every other module in this app.                                                                                                                                                                                                                                                                                                                                                                                                                                          |
| 7   | Known out-of-scope gaps flagged, not fixed | ✅ `ALLOWED_TRANSITIONS`/`ACTION_LABEL`/`CONFIRM_MESSAGE` are a 6th independent hand-copy of the shared approval-transitions table shape (already self-flagged in the component's own doc comment, matching the accepted, tracked pattern every sibling status-actions component already carries)                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                |
| 8   | Documentation updated                      | ✅ This checklist; the module's own backend doc (`docs/implementation/module-section-and-pattern-library.md`) is unaffected — this is a frontend-only slice with no backend change                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                               |
| 9   | Exact branch/commit verified and recorded  | ⏳ Uncommitted — not yet committed to its own branch, pushed, or opened as a PR                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                  |

## Forbidden-actions check

- No backend changes — `apps/dashboard-api/src/section-and-pattern-library/` and
  `packages/database/src/section-and-pattern-library/` are untouched by this slice.
- No new RBAC/permission logic — the frontend reuses the already-gated backend routes as-is.
- Rich-text fields render exclusively through the shared `SanitizedRichText` component — no
  `dangerouslySetInnerHTML` anywhere else in the diff.
- `designReference` is never rendered as a clickable link without first passing `isSafeHttpUrl()`
  — closes the same unrestricted-URL-scheme class this codebase hit once before on Projects'
  `environment.url`.

## Independent code review — summary

Direct read-through of every new file (light tier, not the 8-angle fan-out):

- **Field treatment** confirmed against `section-patterns.service.ts`/`.dto.ts` directly:
  `description`/`responsiveBehavior`/`accessibilityNotes` → `RichTextEditor` (backend calls
  `sanitizeNullableRichText()`/`sanitizeNullableRichTextIfChanged()` for exactly these three);
  `htmlStructure`/`scssReference`/`browserSupport` → plain monospace `<textarea>` (zero sanitize
  calls touch these — real code/notes fields); `designReference` → `type="url"` input,
  client-validated via `isSafeHttpUrl()`; `jsDependencies`/`tokenReferences`/
  `relatedComponentIds` → `TagListField` (unvalidated arrays, no backing entity yet, matching
  Design Token Library's own `usageReferences` precedent).
- **`TRANSITIONS` table**: byte-matched target-by-target against the backend's own constant —
  every one of the 8 states' allowed-target lists identical, including the deliberate
  `approved → ["archived"]`-only divergence (no `superseded` edge, since supersede is only an
  automatic side effect of a different version's own approval).
- **Version-history correctness**: `VersionEntry` reads `version.isCurrent` directly from the
  already-fetched version row rather than comparing against a second, independently-timed fetch —
  the exact code-review fix this codebase's own history already established for
  Website Strategy Center's and Design Token Library's detail pages, applied here proactively.
- **List page**: hidden `pageSize` field preserves the reader's choice across a filter submit;
  `key`-forced remounts on every filter `<select>`/`<input>` handle the Next.js `<Link>`
  soft-navigation stale-`defaultValue` gap this app's own history already found once.
- **Detail page**: terminal-state (`archived`/`superseded`) hides the Edit link rather than
  leaving it clickable only to 400 on submit, matching `SectionPatternStatusActions`'s own
  self-hiding behavior for the identical two statuses.
- **Reuse**: every shared helper this diff touches (`list-filter-styles`, `list-table-styles`,
  `pagination#buildHrefBySize`, `artifact-approval-status`, `detail-section-styles`,
  `api-errors#parseApiErrorMessage`, `rich-text#findOverLongRichTextField`/`richTextFieldValue`,
  `uuid#isUuid`, `format-timestamp`) is imported from its existing shared location, not
  re-declared locally.

**0 findings.**

## Required second-role human review — AWAITING

- [ ] Light-tier code review (0 findings)
- [ ] No separate security review (skipped per the standing rule — nothing security-relevant in
      this diff)

## Sign-off

_Pending._
