# `dashboard-web` Import and Export Center UI — Approval Checklist

**Status:** Built, fully validated. Reviewed at light tier (0 blocking findings) per this
project's 2026-08-27 "right-size the review pipeline" standing rule. Required second-role human
review complete. Gate `G4-dashboard-web-import-and-export-center` approved (WebDesk Solution,
CONFIRM). Not yet pushed to `origin` at build time.

## Completion condition

Every item below must be genuinely true, verified against real evidence, before a gate decision
for this slice can be requested.

| #   | Item                                       | Status                                                                                                                                                                                                                                                                                                                                                                                                                                                                                      |
| --- | ------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1   | Authorization to build                     | ✅ Explicit "Import/Export - Start the dashboard-web UI for it" instruction, following the backend's own build-to-production arc (PR #106, merge commit `705fe117e5a27a103d88a80bdfc6b8b943b48bc3`)                                                                                                                                                                                                                                                                                         |
| 2   | Genuine scoping confirmed                  | ✅ No wireframe/spec exists for this module's UI — a 9-route IA was designed directly against the real backend contract (read the DTOs/controllers/services first), mirroring Scan Center's list→detail-with-a-create-action→run-detail-with-embedded-row-creation shape and Ready for Claude Queue's organization-wide, `session.navigation`-backed target-module picker                                                                                                                   |
| 3   | Required tests pass                        | ✅ 1771/1771 `dashboard-web` unit tests (80 new) — independently re-run by the orchestrating session, not trusted from the build agent's own report                                                                                                                                                                                                                                                                                                                                         |
| 4   | Full validation clean                      | ✅ `tsc --noEmit` clean (`@webdesk/shared-types` and `dashboard-web`); `eslint --max-warnings=0` + CSS-token check (95 files) clean; `next build` clean, all 9 new routes confirmed present in the route table; `prettier --check` clean on every touched file — all independently re-run                                                                                                                                                                                                   |
| 5   | Independent review complete (light tier)   | ✅ A direct read-through pass (not the 8-angle fan-out, per the 2026-08-27 standing rule) against the actual backend source — see "Light-tier review — summary" below                                                                                                                                                                                                                                                                                                                       |
| 6   | Security review                            | Skipped per the same standing rule — no new backend endpoint, no new RBAC action, no new sink; the one stored, backend-unvalidated reference field rendered as a link (`ExportRun.fileReference`) is client-side-guarded via the existing, already-audited `isSafeHttpUrl()`, and every JSON value (`columnMapping`/`filterCriteria`/row `rawData`) is rendered via `JSON.stringify()` inside a `<pre>`, never `dangerouslySetInnerHTML`                                                    |
| 7   | Known out-of-scope gaps flagged, not fixed | A run's own rows/errors are rendered as flat, unpaginated sub-lists capped at 100 entries — matching `ScanEvidenceSection`'s/`ClaimSourcesSection`'s own already-accepted sub-resource precedent; the run detail page's Rows/Errors tables use their own local `thStyle`/`tdStyle` objects (denser padding than the shared `listTableHeaderCellStyle`/`listTableCellStyle`) rather than the shared list-table styles — a minor, non-blocking styling inconsistency, not a correctness issue |
| 8   | Live-rendered / verified                   | ✅ `next build` confirms all 9 new `/import-and-export-center` routes compile and are present in the route table; status-actions/form unit tests cover every mutation path directly, including an exhaustive `allowedTargets(status, isDryRun)` test matrix                                                                                                                                                                                                                                 |
| 9   | Documentation updated                      | This checklist; `CLAUDE.md` to be updated alongside the gate/push record                                                                                                                                                                                                                                                                                                                                                                                                                    |
| 10  | Exact branch/commit verified               | Branch `dashboard-web-import-and-export-center-ui`, built on top of `4f749ec` (the commit recording PR #106's merge as live in production), commit `13c5933`                                                                                                                                                                                                                                                                                                                                |

## Forbidden-actions check

- No new backend endpoint, RBAC action, or migration — reuses the already-live, already-reviewed
  `apps/dashboard-api/src/import-and-export-center/*` surface exactly as built (PR #106). Only
  additive types in `packages/shared-types/src/index.ts` were added (`ImportDuplicateStrategy`,
  `ImportExportFileFormat`, `ImportTemplate`, `ImportRunStatus`, `ImportRun`, `ImportRowStatus`,
  `ImportRowResolution`, `ImportRow`, `ImportError`, `ExportRunStatus`, `ExportRun`), mirroring
  `packages/database/src/import-and-export-center/entities.ts` exactly.
- No new npm dependency.
- No confidential-field/redaction mechanism needed — `export_runs.excludesConfidentialFields` is
  shown as a plain read-only `Fact` ("Yes"/"No"), matching the module registry's own seeded
  `confidentialityLevel` note (an export-behavior constraint, not an access-control tier), the same
  reasoning Persona Library's/Ready for Claude Queue's own reviews already established for a module
  with no real confidential business field.
- No rich-text/HTML sanitization wiring added — every long-text field on this module
  (`sourceFileReference`, `errorSummary`, `rollbackNotes`, row `externalId`/error messages, etc.)
  is plain, unsanitized text on the backend (confirmed directly against the DTO — none of these
  fields route through `sanitizeNullableRichText()` or any sibling helper), so none was converted
  to `RichTextEditor`, matching the Scan Center/Ready for Claude Queue precedent for a module whose
  long-text fields are genuinely plain text, not prose.

## Light-tier review — summary

A direct read-through pass, backed by reading the actual backend source first (not assumed),
verified:

- **`ImportRunStatusActions`'s `allowedTargets(status, isDryRun)`** exactly matches
  `ImportRunsService`'s real `TRANSITIONS` table, including the dry-run asymmetry
  (`validating -> dry_run_completed` only legal when `isDryRun`, `validating -> importing` only
  legal when not) — confirmed line-by-line against `import-runs.service.ts`, not inferred from a
  sibling module's shape.
- **The `rows`/`runErrors` inline-editor gating** (`needsRowsForm(target, fromStatus)`) correctly
  requires `fromStatus === "validating"`, so the separate `dry_run_completed -> importing` "promote"
  transition never offers the rows editor — matching the backend's own real guard
  (`ImportRunsService.changeStatus()`'s `hasRowsPayload` check) exactly, not just the target status
  alone.
- **No `expectedStatus`/CAS field** is sent in either status-transition request body — confirmed
  directly against `changeImportRunStatusSchema`/`changeExportRunStatusSchema` (neither declares
  one), correctly diverging from Ready for Claude Queue's own `{status, expectedStatus}` shape
  rather than copying it blindly.
- **Both JSON-shaped fields** (`ImportTemplateForm`'s `columnMapping`, `ExportRunForm`'s
  `filterCriteria`) and the rows editor's per-row `rawData` are parsed with `JSON.parse()` inside a
  try/catch, rejecting a non-object/array result and surfacing a clear client-side error before
  `postMutation()` is ever called — never lets a malformed value reach the backend's own
  `boundedJsonObjectSchema()` rejection blind.
- **`ExportRun.fileReference`** is rendered as a clickable `<a href>` only when `isSafeHttpUrl()`
  passes, matching every other stored-URL field in this app's own convention (the backend
  deliberately does not URL-validate this field server-side, same as `ImportRun.sourceFileReference`).
- **A real bug the build agent caught and fixed during its own test-writing pass**: a `min`/`step`
  HTML constraint on two number inputs (the rows editor's Row #, the export-completed `rowCount`)
  silently blocked native form submission on an invalid value, meaning the component's own clearer
  JS-side error message would never show and a real submit would silently no-op — both `min`
  attributes were removed in favor of the existing JS-side validation, with an explanatory comment
  at each site; independently confirmed present in the final diff.
- Reuse of every established shared helper (`postMutation()`, `useSyncedState()`, `isUuid()`,
  `formatTimestamp()`, `PageSizeSelect`/`buildHrefBySize`, `list-filter-styles.ts`,
  `moduleDisplayName`/`sortModulesForPicker` re-exported rather than redeclared) instead of
  reimplementing any of them; the query-file split (`lib/import-and-export-center-query.ts`
  zero-non-type-imports, `lib/import-and-export-center.ts` server-only) matching the established
  convention; and the module registry's own seeded `route` value
  (`/import-and-export-center`, confirmed against migration `00035`).
- One non-blocking style inconsistency noted (item 7 above, run detail page's local
  `thStyle`/`tdStyle`) — not a correctness issue, left as-is rather than fixed inline.

**0 blocking findings.**

A separate `security-review` pass was skipped per the standing rule — the diff adds no new
backend endpoint, no new RBAC action, and no new sink; the one stored-URL field is already
backend-validated-as-opaque-by-design and additionally client-guarded here.

## Sign-off

**Required second-role human review:** Complete — via the direct "Approve as-is, gate it"
instruction. Light tier, so the findings summary above served as the review artifact rather than a
separately published Claude artifact packet, matching the Scan Center/Wireframe Library UI
precedent for a light-tier slice. There were no open blocking findings on this branch to accept as
tracked debt beyond the one non-blocking styling note (item 7).

**Gate:** `G4-dashboard-web-import-and-export-center` approved — WebDesk Solution, decision
CONFIRM (clean pass, not an override), approved on branch
`dashboard-web-import-and-export-center-ui`, commit `13c5933`. See
`outputs/webdesk-growth-dashboard/project.json`'s `gates[]` (`current_gate` now
`G4-dashboard-web-import-and-export-center`). This gate approval does not itself authorize opening
a PR or merging — each remains its own separate, not-yet-requested authorization, per this
project's standing "no auto-merge" rule.
