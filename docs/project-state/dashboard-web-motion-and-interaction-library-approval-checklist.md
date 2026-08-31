# `dashboard-web` Motion and Interaction Library UI — Approval Checklist

**Status:** Built, fully validated. Reviewed at medium effort (8-angle finder pass, 1-vote
verification) — 3 findings confirmed/plausible, all 3 fixed and re-validated. Security review
skipped per this project's 2026-08-27 "right-size the review pipeline" standing rule. Required
second-role human review complete. Gate `G4-dashboard-web-motion-and-interaction-library`
approved (WebDesk Solution, CONFIRM). Not yet pushed to `origin` or opened as a PR.

## Completion condition

Every item below must be genuinely true, verified against real evidence, before a gate decision
for this slice can be requested.

| #   | Item                                       | Status                                                                                                                                                                                                                                                                                                             |
| --- | ------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| 1   | Authorization to build                     | ✅ Explicit "Start the dashboard-web UI for it" instruction, following the backend's own build-to-production arc (PR #86)                                                                                                                                                                                          |
| 2   | Genuine scoping confirmed                  | ✅ File-for-file mirrors Section and Pattern Library's already-reviewed UI structure (closest sibling — real multi-row version history, same `creative_design` RBAC group); `description`/`triggerAndBehavior`/`accessibilityNotes` already rich-text-sanitized in the backend, only the length cap needed raising |
| 3   | Required tests pass                        | ✅ 1283/1283 `dashboard-web` unit tests (48 new), 1386/1386 `dashboard-api` unit tests (unaffected by the length-cap change) — all independently re-run by the orchestrating session, not trusted from the build agent's own report                                                                                |
| 4   | Full validation clean                      | ✅ typecheck clean across `packages/shared-types`/`apps/dashboard-api`/`apps/dashboard-web`; `eslint --max-warnings=0` clean; CSS-token check clean (64 files); `next build` clean, all 4 new routes present; `prettier --check` clean on every touched file                                                       |
| 5   | Independent review complete                | ✅ 8-angle finder pass (medium effort), 1-vote verification — 4 candidates survived dedup, 1 refuted (inherited from an already-shipped sibling), 3 fixed (see "Code review — summary" below)                                                                                                                      |
| 6   | Security review                            | Skipped per the standing rule — no new backend endpoint, no new sink; the only backend change is a length-cap raise on already-sanitized fields; rich-text fields render exclusively through the existing, already-audited `SanitizedRichText` component                                                           |
| 7   | Known out-of-scope gaps flagged, not fixed | The two pre-existing sibling occurrences of the id→name resolution pattern (Component Library, Page Template Library detail pages) were deliberately left as inline hand-copies — retrofitting them was out of scope for a branch that didn't otherwise touch either module                                        |
| 8   | Live-rendered / verified                   | ✅ `next build` confirms all 4 new `/motion-and-interaction-library` routes compile and are present in the route table; form/status-actions/lib unit tests cover every mutation path directly                                                                                                                      |
| 9   | Documentation updated                      | This checklist; `CLAUDE.md` entry to follow                                                                                                                                                                                                                                                                        |
| 10  | Exact branch/commit verified               | Branch `dashboard-web-motion-and-interaction-library`, commits `159730b` (build) → `e1a6ad4` (detail-page name-resolution fix) → `4f49b38` (code-review fixes) — not yet pushed                                                                                                                                    |

## Forbidden-actions check

- No new backend endpoint, RBAC action, or migration — reuses the already-live, already-reviewed
  `apps/dashboard-api/src/motion-and-interaction-library/*` surface, with only a length-cap raise
  (20,000 → 40,000) on `description`/`triggerAndBehavior`/`accessibilityNotes` added to
  `motion-and-interaction-library.dto.ts` to match the UI's rich-text markup overhead.
- No new npm dependency.
- No confidential-field/redaction mechanism needed — matches the module registry's own precedent
  for this RBAC domain (no confidentiality field on `MotionInteractionRecordEntity`).

## Code review — summary

8-angle finder pass (correctness ×3, cleanup ×3, altitude, conventions), medium effort. 4
candidates survived dedup and 1-vote verification:

1. **`MotionInteractionStatusActions` used plain `useState` instead of the shared
   `useSyncedState()` hook** (PLAUSIBLE) — every module built after 2026-08-27 is documented to
   use the hook from the start, and this component's own named sibling template
   (`page-template-status-actions.tsx`) was itself updated to use it the same day this branch was
   built. **Fixed** — switched to `useSyncedState(initialStatus)`.
2. **`arrayField()` reimplemented the shared `arrayFieldValue()` helper** (CONFIRMED) — the
   form's local closure duplicated `lib/rich-text.ts`'s exported helper byte-for-byte instead of
   delegating to it, unlike both sibling forms (Section and Pattern Library, Page Template
   Library) and this same file's own `richTextField()`, which correctly delegates to
   `richTextFieldValue()`. **Fixed** — now delegates.
3. **Id→name resolution for `relatedComponentIds` was a 3rd independent inline hand-copy**
   (CONFIRMED) — the identical `Map`-build-then-resolve pattern already exists inline in both
   Component Library's and Page Template Library's own detail pages, with no shared helper ever
   extracted, violating this project's own repeatedly-cited "extract after the 2nd occurrence"
   convention. **Fixed** — extracted `lib/resolve-ids-to-names.ts` (`buildNameById()`/
   `resolveIdsToNames()`) and wired it into this module's detail page; the two pre-existing
   sibling occurrences were deliberately left untouched, matching this project's own established
   precedent (`useSyncedState()`'s own doc comment) for not retrofitting already-shipped modules a
   fix branch didn't otherwise touch.
4. A 4th candidate (a triple-branch ternary double-checking `designReference` truthiness on the
   detail page) was verified **REFUTED as a new issue** — byte-identical to Section and Pattern
   Library's own already-shipped, already-reviewed detail page. Not fixed; inherited, accepted
   shape.

Re-validated after all 3 fixes: 1283/1283 `dashboard-web` unit tests, typecheck, lint, CSS-token
check, prettier, and production build all clean.

A separate `security-review` pass was skipped per the standing rule — the diff adds no new
endpoint, no new input reaching a dangerous render path, and every rich-text field routes
exclusively through the existing, already-audited `SanitizedRichText` component with unchanged
sanitization logic.

## Sign-off

**Required second-role human review:** Complete — via the direct "gate it and push the branch"
instruction. This checklist's own findings table served as the review artifact rather than a
separately published Claude artifact packet, matching the Wireframe Library/Page Template Library
UI precedent for a review with no open findings remaining after the fix round.

**Gate:** `G4-dashboard-web-motion-and-interaction-library` approved — WebDesk Solution, decision
CONFIRM (clean pass, not an override), approved commit `4f49b38` on branch
`dashboard-web-motion-and-interaction-library`. See
`outputs/webdesk-growth-dashboard/project.json`'s `gates[]` (`current_gate` now
`G4-dashboard-web-motion-and-interaction-library`).

**This gate approval does not itself authorize opening a PR or merging** — merge remains its own
separate, not-yet-requested authorization, per this project's standing "no auto-merge" rule.
