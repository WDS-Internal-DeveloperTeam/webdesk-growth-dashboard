# `dashboard-web` Scan Center UI — Approval Checklist

**Status:** Built, fully validated. Reviewed at light tier (0 findings) per this project's
2026-08-27 "right-size the review pipeline" standing rule. Required second-role human review
complete. Gate `G4-dashboard-web-scan-center` approved (WebDesk Solution, CONFIRM). Not yet pushed
to `origin` at build time — pushed as part of this same gate action.

## Completion condition

Every item below must be genuinely true, verified against real evidence, before a gate decision
for this slice can be requested.

| #   | Item                                       | Status                                                                                                                                                                                                                                                                                                                                                                                                                        |
| --- | ------------------------------------------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1   | Authorization to build                     | ✅ Explicit "Scan Center - start the dashboard-web UI for it" instruction, following the backend's own build-to-production arc (PR #102, merge commit `fcd33f1b15e87abae483743cf047eaf548fb8042`)                                                                                                                                                                                                                             |
| 2   | Genuine scoping confirmed                  | ✅ No wireframe/spec exists for this module's UI — the IA (6 routes: definitions list → definition detail/edit → run detail with status actions and inline findings creation → finding detail with status actions and evidence) was designed against the backend's own real pipeline shape, mirroring Page Inventory (project-scoped list pattern) and Internal Linking Library (bespoke, non-8-value workflow badge pattern) |
| 3   | Required tests pass                        | ✅ 1691/1691 `dashboard-web` unit tests (68 new) — independently re-run by the orchestrating session, not trusted from the build agent's own report                                                                                                                                                                                                                                                                           |
| 4   | Full validation clean                      | ✅ `tsc --noEmit` clean; `eslint --max-warnings=0` + CSS-token check (88 files) clean; `next build` clean, all 6 new routes present; `prettier --check` clean on every touched file — all independently re-run                                                                                                                                                                                                                |
| 5   | Independent review complete (light tier)   | ✅ A direct read-through pass (not the 8-angle fan-out, per the 2026-08-27 standing rule for a small frontend-only slice) — 0 findings                                                                                                                                                                                                                                                                                        |
| 6   | Security review                            | Skipped per the same standing rule — diff touches nothing security-relevant (no new backend endpoint, no new sink; `scan_evidence.reference` client-side-guarded via the existing, already-audited `isSafeHttpUrl()` before both submit and render)                                                                                                                                                                           |
| 7   | Known out-of-scope gaps flagged, not fixed | A definition's own runs, a run's own findings, and a finding's own evidence are all rendered as flat, unpaginated sub-lists capped at 100 rows — matching `PageUrlsSection`'s/`ClaimSourcesSection`'s own already-accepted sub-resource precedent, documented in code                                                                                                                                                         |
| 8   | Live-rendered / verified                   | ✅ `next build` confirms all 6 new `/scan-center` routes compile and are present in the route table; status-actions/form/evidence-section unit tests cover every mutation path directly                                                                                                                                                                                                                                       |
| 9   | Documentation updated                      | This checklist; `CLAUDE.md` to be updated alongside the gate/push record                                                                                                                                                                                                                                                                                                                                                      |
| 10  | Exact branch/commit verified               | Branch `dashboard-web-scan-center`, built on top of `b1e69c7` (the commit recording PR #102's merge as live in production)                                                                                                                                                                                                                                                                                                    |

## Forbidden-actions check

- No new backend endpoint, RBAC action, or migration — reuses the already-live, already-reviewed
  `apps/dashboard-api/src/scan-center/*` surface exactly as built (PR #102). Only additive types
  in `packages/shared-types/src/index.ts` were added (`ScanType`, `ScanMode`, `ScanDefinition`,
  `ScanRunStatus`, `ScanRunTriggerType`, `ScanRun`, `ScanFindingSeverity`, `ScanFindingStatus`,
  `ScanFinding`, `ScanEvidence`), mirroring `packages/database/src/scan-center/entities.ts`
  exactly.
- No new npm dependency.
- No confidential-field/redaction mechanism needed — matches the module registry's own seeded
  `confidentialityLevel: null` for `scan_center`.
- No rich-text/HTML sanitization wiring added — `target`/`errorSummary`/finding `description`/
  evidence `notes` are all plain `<textarea>`s, deliberately not `RichTextEditor`, since the
  backend never sanitizes any of them as HTML (verified directly against
  `scan-runs.service.ts`/`scan-findings.service.ts`/`scan-evidence.service.ts` — none call
  `sanitizeNullableRichText()` or any sibling helper), matching the identical, already-established
  Ready for Claude Queue precedent for a module whose long-text fields are genuinely plain text.

## Light-tier review — summary

A single direct read-through pass verified: both hand-mirrored `ALLOWED_TRANSITIONS` tables
(`ScanRunStatusActions`, `ScanFindingStatusActions`) byte-for-byte against the real backend
`TRANSITIONS` tables in `scan-runs.service.ts`/`scan-findings.service.ts` — including the
`acknowledged → open` reopen edge on the finding workflow, which is real and correctly mirrored;
the findings-creation flow embedded in `ScanRunStatusActions`' `completed`/`partially_completed`
inline form (the only way any `ScanFinding` row is ever created, there being no standalone create
route) against `scanRunFindingInputSchema`'s own field list and length caps; `ScanEvidenceSection`'s
client-side `isSafeHttpUrl()` guard applied consistently before both submit and render of a stored
`reference`; the query-file split (`lib/scan-center-query.ts` zero-non-type-imports, `lib/scan-center.ts`
server-only) matching `page-inventory-query.ts`/`page-inventory.ts`'s own established convention;
reuse of every established shared helper (`postMutation()`, `withProjectId()`, `useSyncedState()`,
`PageSizeSelect`/`buildHrefBySize`, `ProjectPickerForm`, `list-filter-styles.ts`, `list-table-styles.ts`)
instead of re-implementing any of them; and the module registry's own seeded `route` value
(`/scan-center`, confirmed against migration `00035`). **0 findings.**

A separate `security-review` pass was skipped per the standing rule — the diff adds no new
backend endpoint, no new RBAC action, and no new sink; the one stored-URL field
(`scan_evidence.reference`) is already backend-validated via `safeHttpUrlSchema` and is
additionally client-guarded here via the existing, already-audited `isSafeHttpUrl()` helper before
being rendered as a link.

## Sign-off

**Required second-role human review:** Complete — via the direct "Gate it and push the branch"
instruction. Light tier, so the findings table above served as the review artifact rather than a
separately published Claude artifact packet, matching the Wireframe Library/Knowledge Library UI
precedent for a light-tier slice. There were no open findings of any kind on this branch to accept
as tracked debt.

**Gate:** `G4-dashboard-web-scan-center` approved — WebDesk Solution, decision CONFIRM (clean
pass, not an override), approved on branch `dashboard-web-scan-center`. See
`outputs/webdesk-growth-dashboard/project.json`'s `gates[]` (`current_gate` now
`G4-dashboard-web-scan-center`). This gate approval does not itself authorize opening a PR or
merging — each remains its own separate, not-yet-requested authorization, per this project's
standing "no auto-merge" rule.
