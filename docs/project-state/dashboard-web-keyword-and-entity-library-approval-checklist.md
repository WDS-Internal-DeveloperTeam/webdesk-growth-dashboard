# `dashboard-web` Keyword & Entity Library UI — Approval Checklist

**Status:** Built, code review complete (5 candidates surfaced after dedup — 5 CONFIRMED, all
fixed). Security review complete (0 findings above threshold). Required second-role human review
complete — Jitesh D, "Approves," no disputes raised. Gate
(G4-dashboard-web-keyword-and-entity-library) approved — WebDesk Solution, decision CONFIRM,
approved commit `4126d29` on branch `dashboard-web-keyword-and-entity-library`. Merged
([PR #60](https://github.com/WDS-Internal-DeveloperTeam/webdesk-growth-dashboard/pull/60), merge
commit `b54fc51b437da4f7df6d84db36d0c035ecb41059`) — **now genuinely live in production.**

## Completion condition

Every item below must be genuinely true, verified against real evidence, before a gate decision
for this slice can be requested.

| #   | Item                                       | Status                                                                                                                                                                                                                                                                                              |
| --- | ------------------------------------------ | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1   | Authorization to build                     | ✅ Explicit "Start the dashboard-web UI for it" instruction, following the backend's own build-to-production arc (PR #59)                                                                                                                                                                           |
| 2   | Genuine scoping confirmed                  | ✅ No new architectural question — this is the module's own established project-scoped-UI pattern (Page Inventory's precedent), applied consistently. Entities scoped as a secondary, independently-browsable resource (task package D3: full CRUD, no workflow) rather than folded into a picker   |
| 3   | Required tests pass                        | ✅ 615/615 `dashboard-web` unit tests, 745/745 `dashboard-api` unit tests, 283/283 `dashboard-api` integration/e2e tests — all re-verified independently against a real disposable database after every fix round                                                                                   |
| 4   | Full validation clean                      | ✅ typecheck/lint/CSS-token-check/`next build`/prettier all clean across `packages/shared-types`, `apps/dashboard-web`, `apps/dashboard-api`; all 8 new routes present in the build output                                                                                                          |
| 5   | Independent code review complete           | ✅ This project's own `code-review` skill (high effort, 8-angle finder pass, 1-vote verification) — 5 candidates after dedup, all 5 CONFIRMED and fixed                                                                                                                                             |
| 6   | Security review complete                   | ✅ `security-review` skill run separately, against the fixed branch — 0 findings above threshold, including dedicated focus on the two RelationshipPicker cross-module/cross-project data paths and the new hard-delete route                                                                       |
| 7   | Known out-of-scope gaps flagged, not fixed | ✅ None — every confirmed finding was fixed in this pass, unlike several prior slices with accepted-debt items                                                                                                                                                                                      |
| 8   | Live end-to-end verified                   | ✅ Independently re-verified: every high-risk file read directly (backend sanitization wiring, terminal-state edit guard, cross-module existence checks, `RelationshipPicker` usage), every test suite re-run against a fresh local disposable PostgreSQL 17 database, `next build` confirmed clean |
| 9   | Documentation updated                      | ✅ `CLAUDE.md`'s "Recent decisions" entry written                                                                                                                                                                                                                                                   |
| 10  | Exact branch/commit verified and recorded  | ✅ Branch `dashboard-web-keyword-and-entity-library`, commits `587e13d` (backend sanitization) → `258cf6c` (shared types) → `ba4bd9b` (lib split) → `e949dd6` (keywords UI) → `c72767e` (entities UI) → `772885f` (tests) → `9918861` (code-review fixes) — not yet pushed to `origin`              |

## Forbidden-actions check

- No new RBAC/permission-group migration added — this slice's one backend change (rich-text
  sanitization wiring) touches no authorization logic.
- No new npm dependency was added.
- `EntityDeleteButton`'s hard-delete route (`POST .../entities/:id/delete`) is real, pre-existing,
  already-gated backend behavior (`@RequirePermission(MODULE_KEY, "edit")`, IDOR-scoped) — this
  slice only adds the UI trigger, confirmed by the security review as correctly relying on
  server-side enforcement, not the client-side `window.confirm()`.
- The two `RelationshipPicker`-based sub-resource sections POST client-supplied ids, but the
  backend independently re-validates both `entityId` and `pageId` against the same project before
  accepting either — confirmed directly by the security review, not assumed.

## Independent code review — summary

Full record: this session's `ReportFindings` call (commit `9918861`). 8-angle finder pass — 5
candidates survived dedup after 1-vote verification, all 5 CONFIRMED and fixed:

1. **The keywords list page's `TextFilter` hardcoded `maxLength={255}` for
   `keywordType`/`intent`/`funnelStage`/`country`**, but `parseKeywordLibrarySearchParams`
   silently `.slice(0, 100)`s those same 4 fields to match the backend's 100-char column limit,
   with no error shown (most severe). **Fixed**: `TextFilter` gained an optional `maxLength` prop
   (default 255, matching `search`'s own backend limit), passed as 100 explicitly for the 4
   short-text fields — matching the entities list page's own already-correct handling of
   `entityType` in this same PR.
2. **`EntityForm` hand-rolled a local `textField()`** that was a byte-for-byte reimplementation of
   `plainTextFieldValue()` (`lib/form-field-value.ts`), which the sibling `KeywordForm` in this
   same branch correctly imports. **Fixed**: now imports and uses the shared helper directly.
3. **Three pages (entity detail, keyword edit, entity edit) awaited `getProject()` before fetching
   their primary resource**, even though the resource fetch only needs the already-known
   `projectId` string — an avoidable extra sequential round trip on 3 real page loads, when the
   identical `tolerateDiscard()` concurrency fix was already correctly applied elsewhere in this
   same module. **Fixed**: all 3 now fire the resource fetch concurrently with the project check.
4. **`KeywordEntityRelationshipsSection` and `KeywordPageAssignmentsSection` independently
   reimplemented ~150 near-identical lines of state/fetch logic each** — past this same branch's
   own 2-copy extraction threshold (`project-scoped-href.ts`, `use-pending-ids.ts`). **Fixed**:
   extracted the shared add/remove/query state machine into a new `useRelationshipSection()` hook;
   the row-rendering JSX (including each component's own secondary-line source and
   page-assignments' extra `assignmentNote` field) stays per-component. Both components' existing
   tests passed unchanged after the refactor, confirming behavior was preserved exactly.
5. **`EntityDeleteButton` hand-rolled inline styles for a danger button** instead of using
   `@webdesk/ui`'s `Button` component (`variant="danger"`), which already exists, is documented as
   mandatory for exactly this, and is already used identically for `ApprovalBlock`'s Reject button.
   **Fixed**: now uses `Button` directly.

## Independent security review — summary

Full record: this session's transcript, run separately from the code review, against the fixed
branch (commit `9918861`). **0 findings above threshold.** Dedicated focus areas, all confirmed
clean:

- **Rich-text sanitization end-to-end** — every write path (`KeywordsService`/`EntitiesService`
  `create()`/`update()`) sanitizes via `sanitizeNullableRichText()`/
  `sanitizeNullableRichTextIfChanged()`; every render site goes through the shared
  `SanitizedRichText` component, the only sanctioned `dangerouslySetInnerHTML` site — no new raw
  render site introduced.
- **Cross-project tampering via the two `RelationshipPicker` sections** — a malicious client
  POSTing an arbitrary `entityId`/`pageId` from another project gets a clean `400`, since the
  backend independently re-validates both against the caller's own project
  (`entities.findByIds([entityId], projectId)`/`pages.existsInProject(pageId, projectId)`) before
  accepting either.
- **`EntityDeleteButton`'s hard-delete route** — genuinely gated server-side
  (`@RequirePermission`, IDOR-scoped via `findById(id, projectId)` before delete); the client-side
  confirm is UX only.
- **`CURRENT_PROJECT_COOKIE`/`withProjectId()`/`project-scoped-href.ts`** — no injection or
  open-redirect surface; every `projectId` traces back to a server-validated `Project.id`, never a
  raw unvalidated query-string value.

## Required second-role human review — COMPLETE

- [x] Code-review findings (5 CONFIRMED and fixed, 0 accepted debt) — reviewed by: **Jitesh D**,
      2026-08-24, **Approves**.
- [x] Security-review findings (0 above threshold) — reviewed by: **Jitesh D**, 2026-08-24,
      **Approves**.

Review packet:
[Keyword & Entity Library UI Review Packet](https://claude.ai/code/artifact/65fb0609-4320-4e42-8037-777af14e0b3e)
(published as a Claude artifact — code review + security review findings, fixes, and validation
evidence, with a decision section).

## Sign-off

**Second-role human review: complete.** No disputes raised — every confirmed code-review finding
was already fixed, none were accepted as tracked debt, and the security review found 0 findings
above threshold.

| Field                         | Value                                                                                                                                                      |
| ----------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Reviewer (second-role review) | Jitesh D                                                                                                                                                   |
| Review date                   | 2026-08-24                                                                                                                                                 |
| Decision                      | Approves                                                                                                                                                   |
| Scope reviewed                | Full code-review disposition (5 findings fixed, 0 accepted debt) and full security-review disposition (0 above threshold), per the published review packet |
| Disputes raised               | None recorded                                                                                                                                              |

A gate decision, push/PR, and merge authorization each remain separate, not-yet-requested next
steps, per this project's standing "no auto-merge" rule.

**The gate (G4-dashboard-web-keyword-and-entity-library) was then separately requested and
approved** — WebDesk Solution, decision CONFIRM (a clean pass, not an override, since the
second-role review was already complete before the gate was requested), approved commit
`4126d29` on branch `dashboard-web-keyword-and-entity-library` — see
`outputs/webdesk-growth-dashboard/project.json`'s `gates[]` (`current_gate` now
`G4-dashboard-web-keyword-and-entity-library`).

| Field                    | Value                                                                                                                                      |
| ------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------ |
| Gate                     | G4-dashboard-web-keyword-and-entity-library                                                                                                |
| Approver (gate decision) | WebDesk Solution                                                                                                                           |
| Gate date                | 2026-08-24                                                                                                                                 |
| Decision                 | CONFIRM (clean pass, not an override — the second-role review was already complete before the gate was requested)                          |
| Approved commit          | `4126d29` on branch `dashboard-web-keyword-and-entity-library` — see `outputs/webdesk-growth-dashboard/project.json`'s `gates[]`           |
| Scope                    | `dashboard-web-keyword-and-entity-library` only. Push/PR and merge authorization are each their own separate, not-yet-requested next step. |

This gate approval does not itself authorize pushing the branch, opening a PR, merging, or a
production deployment — each remains its own separate, not-yet-requested authorization, per this
project's standing "no auto-merge" rule.

## Push/PR — COMPLETE

**"Push the branch and open a PR" was separately requested and executed.** Pushed to `origin`,
opened as
[PR #60](https://github.com/WDS-Internal-DeveloperTeam/webdesk-growth-dashboard/pull/60). All 14
CI checks confirmed green.

## Merge — COMPLETE

**"Merge PR #60" was separately requested and executed.** All 14 CI checks green first. Merged
with a real merge commit (not squash/rebase), matching every prior merge in this project's
history — merge commit `b54fc51b437da4f7df6d84db36d0c035ecb41059`. Both Vercel projects
auto-deployed on push to `main` and were verified live directly, not just via CI's own Vercel
status check:

- `dashboard-api`'s `/health` returned `build.commitSha ==
b54fc51b437da4f7df6d84db36d0c035ecb41059`, confirming the exact merged commit is what's serving.
- `dashboard-web`'s `/keyword-and-entity-library` correctly redirects (307) an unauthenticated
  visitor to `/auth/sign-in`, confirming the session gate is intact.

**The `dashboard-web` Keyword & Entity Library UI is now genuinely live in production** — closing
out this slice's full build-to-production arc, and the Keyword & Entity Library module's own
overall arc: backend and now the full UI (keywords list/detail/create/edit, status actions,
entities list/detail/create/edit, both sub-resource sections) are all live.
