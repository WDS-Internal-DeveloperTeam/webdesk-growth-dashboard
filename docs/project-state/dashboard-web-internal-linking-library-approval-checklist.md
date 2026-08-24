# `dashboard-web` Internal Linking Library UI — Approval Checklist

**Status:** Built, code review complete (8 candidates surfaced after dedup — 8 CONFIRMED, all
fixed). Security review complete (0 findings above threshold). Required second-role human review
complete — Jitesh D, "Approves," no disputes raised. A gate decision, push/PR, and merge
authorization each remain separate, not-yet-requested next steps.

## Completion condition

Every item below must be genuinely true, verified against real evidence, before a gate decision
for this slice can be requested.

| #   | Item                                       | Status                                                                                                                                                                                                                                                                                                                                                                                                      |
| --- | ------------------------------------------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1   | Authorization to build                     | ✅ Explicit "Start building it now" instruction, following the backend's own build-to-production arc (PR #61), confirmed via `AskUserQuestion`                                                                                                                                                                                                                                                              |
| 2   | Genuine scoping confirmed                  | ✅ No new architectural question — this module's own established project-scoped-UI pattern (Page Inventory's precedent) applied consistently. One genuinely new UI primitive built (`SinglePagePicker`, a single-value wrapper around `@webdesk/ui`'s `RelationshipPicker` — no prior single-value precedent in this codebase)                                                                              |
| 3   | Required tests pass                        | ✅ 791/791 `dashboard-api` unit tests (4 new, paired backend change), 312/312 `dashboard-api` e2e/integration tests (unchanged, confirms no regression), 667/667 `dashboard-web` unit tests (52 new across 3 files) — all re-verified independently against a real disposable database after every fix round                                                                                                |
| 4   | Full validation clean                      | ✅ typecheck/lint/CSS-token-check/`next build`/prettier all clean across `packages/shared-types`, `apps/dashboard-web`, `apps/dashboard-api`; all 4 new routes present in the build output                                                                                                                                                                                                                  |
| 5   | Independent code review complete           | ✅ This project's own `code-review` skill (high effort, 8-angle finder pass, 1-vote verification) — 8 candidates after dedup, all 8 CONFIRMED and fixed (most severe: unguarded `getUser()`/`getPage()` calls crashed the detail/edit pages for any role lacking cross-module RBAC grants)                                                                                                                  |
| 6   | Security review complete                   | ✅ `security-review` skill run separately, against the fixed branch — 0 findings above threshold, including dedicated focus on the rich-text sanitization loop, the deliberately-unvalidated `relatedStrategyRecordId` field, IDOR-adjacent picker paths, and the new error-catching's log hygiene                                                                                                          |
| 7   | Known out-of-scope gaps flagged, not fixed | ✅ None — every confirmed finding was fixed in this pass                                                                                                                                                                                                                                                                                                                                                    |
| 8   | Live end-to-end verified                   | ✅ Independently re-verified: every high-risk file read directly (the two `SinglePagePicker` instances, the `UserPicker`/`approverTouched` wiring, the RBAC-crash fix, the backend sanitization wiring), every test suite re-run against a fresh local disposable PostgreSQL 17 database, `next build` confirmed clean, all 4 routes live-rendered in the Browser pane with clean unauthenticated redirects |
| 9   | Documentation updated                      | ✅ `CLAUDE.md`'s "Recent decisions" entries updated                                                                                                                                                                                                                                                                                                                                                         |
| 10  | Exact branch/commit verified and recorded  | ✅ Branch `dashboard-web-internal-linking-library`, commits `9bf4179` (shared types + backend rich-text conversion) → `1263a8b` (frontend UI) → `1beb91d` (code-review fixes) — not yet pushed to `origin`                                                                                                                                                                                                  |

## Forbidden-actions check

- No new RBAC/permission-group migration added — reuses the already-seeded
  `keyword_internal_links` permission group verbatim (the same group Keyword & Entity Library
  uses).
- No new npm dependency was added.
- The picker option pools (`getPagesForInternalLinkPicker()`, `UserPicker`'s `GET /users` search)
  reuse already-authenticated, already-RBAC-gated endpoints — no new cross-module data exposure.
  Server-side `PagesService.existsInProject()`/`UsersService.findById()` (both unmodified by this
  branch) remain the real enforcement point regardless of what a tampered client submits.
- No confidential-field/redaction mechanism was needed — this module has none (task package D9).

## Independent code review — summary

Full record: this session's `ReportFindings` calls. 8-angle finder pass — 8 candidates survived
dedup after 1-vote verification, all 8 CONFIRMED and fixed:

1. **Unguarded `getUser()`/`getPage()` calls crashed the detail and edit pages** (most severe) —
   both throw on any non-404 response, and `GET /users/:userId` is gated on `users_roles:view`, a
   grant only 2 of the 7 seeded roles hold. Any other role viewing/editing a link with an assigned
   approver would 403 and crash the whole page, matching the exact bug class already fixed once in
   `projects/[projectId]/edit/page.tsx`. **Fixed**: extracted a new `resolveLinkRelationships()`
   helper (`lib/internal-linking-library.ts`) that guards each lookup independently and degrades
   to `null` — this also collapsed the detail and edit pages' previously byte-for-byte duplicated
   3-promise resolution block into one shared function, closing a second finding (below) in the
   same fix.
2. **The edit-mode "preserve an untouched approver assignment on save" path had zero test
   coverage**, despite being the exact data-loss bug class this codebase already shipped once
   (`ProjectForm`'s owner field) and already has a dedicated regression test for on that sibling
   component. **Fixed**: added the equivalent two tests (resolvable and unresolvable approver
   cases).
3. **The client-side self-link guard had zero test coverage** — the sole remaining backstop for a
   mixed-case duplicate page id, since the picker's own exclusion filter is case-sensitive.
   **Fixed**: added a test using a hex-letter page id so `.toUpperCase()` produces a genuinely
   different string, proving the case-insensitive comparison actually works.
4. **A local `UUID_PATTERN` regex was hand-declared instead of importing `lib/uuid.ts`'s canonical
   `isUuid()` helper** — which this same branch's own `internal-link-form.tsx` already imports for
   a different field, making the branch internally inconsistent. **Fixed**: imports `isUuid()`.
5. **The migration's and task package's own doc comments still described `context`'s old
   2000-char cap** after this branch raised it to 4000. **Fixed**: both updated.
6. **`getProject()` and `getPagesForInternalLinkPicker()` ran sequentially on the create page**
   even though the picker fetch has no dependency on the resolved `Project` entity. **Fixed**:
   fires concurrently via `tolerateDiscard()`, mirroring the edit page's own already-correct
   pattern.
7. **`sourcePage`/`targetPage` were re-fetched via two more real `getPage()` network calls on the
   edit page** even though the already-fetched `pages` array almost always already contains them.
   **Fixed**: `resolveLinkRelationships()` now accepts an optional `pagePool` and checks it first
   via `.find()`, falling back to a real `getPage()` call only on a genuine miss.
8. **The detail page and edit page contained a byte-for-byte identical 3-promise resolution
   block** — closed as a byproduct of fixing finding 1 above (the shared `resolveLinkRelationships()`
   helper collapses both call sites).

## Independent security review — summary

Full record: this session's transcript, run separately from the code review, against the fixed
branch (commit `1beb91d`). **0 findings above threshold.** Confirmed:

- The rich-text `context` field's write-time (`sanitizeNullableRichText()`/
  `sanitizeNullableRichTextIfChanged()`) and render-time (`SanitizedRichText`) sanitization loop
  has no bypass path — the sole `dangerouslySetInnerHTML` site in this app, matching every other
  rich-text field's established double-sanitization convention.
- `relatedStrategyRecordId` is rendered only as plain JSX text, never as a link `href`, never
  interpolated into a `fetch()` URL, query, or file path anywhere in the diff — purely inert
  stored data, matching its documented "no FK, no validation" design.
- The two page pickers' and the approver picker's option pools are fetched via already-scoped,
  already-RBAC-gated endpoints; server-side existence/RBAC re-validation (unmodified by this
  branch) remains the real enforcement point regardless of what a tampered client submits — no
  IDOR path exists.
- The new `resolveLinkRelationships()` error-catching logs only fixed descriptive strings plus a
  generic `Error` object — no response bodies, cookies, tokens, or PII are captured.
- Every mutation form submits via same-origin `fetch()` with `credentials: "include"`, relying on
  `dashboard-api`'s unmodified `OriginCheckGuard`/`PermissionGuard`/session-cookie enforcement —
  no security-boundary change in this branch.

## Required second-role human review — COMPLETE

- [x] Code-review findings (8 CONFIRMED and fixed) — reviewed by: **Jitesh D**, 2026-08-24,
      **Approves**.
- [x] Security-review findings (0 above threshold) — reviewed by: **Jitesh D**, 2026-08-24,
      **Approves**.

Review packet:
[Internal Linking Library UI Review Packet](https://claude.ai/code/artifact/7e03d0c3-2c0c-46df-9c29-510a05e9a68b)
(published as a Claude artifact — code review + security review findings, fixes, and validation
evidence, with a decision section).

## Sign-off

**Second-role human review: complete.** No disputes raised — every confirmed code-review finding
was already fixed, and the security review found 0 findings above threshold, so there was no open
item to accept as tracked debt.

| Field                         | Value                                                                                                                                     |
| ----------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------- |
| Reviewer (second-role review) | Jitesh D                                                                                                                                  |
| Review date                   | 2026-08-24                                                                                                                                |
| Decision                      | Approves                                                                                                                                  |
| Scope reviewed                | Full code-review disposition (8 findings fixed) and full security-review disposition (0 above threshold), per the published review packet |
| Disputes raised               | None recorded                                                                                                                             |

**The gate (G4-dashboard-web-internal-linking-library) was then separately requested and
approved** — WebDesk Solution, decision CONFIRM (a clean pass, not an override, since the
second-role review was already complete before the gate was requested), approved commit
`a43d3f0` on branch `dashboard-web-internal-linking-library` — see
`outputs/webdesk-growth-dashboard/project.json`'s `gates[]` (`current_gate` now
`G4-dashboard-web-internal-linking-library`).

| Field                    | Value                                                                                                                                    |
| ------------------------ | ---------------------------------------------------------------------------------------------------------------------------------------- |
| Gate                     | G4-dashboard-web-internal-linking-library                                                                                                |
| Approver (gate decision) | WebDesk Solution                                                                                                                         |
| Gate date                | 2026-08-24                                                                                                                               |
| Decision                 | CONFIRM (clean pass, not an override — the second-role review was already complete before the gate was requested)                        |
| Approved commit          | `a43d3f0` on branch `dashboard-web-internal-linking-library` — see `outputs/webdesk-growth-dashboard/project.json`'s `gates[]`           |
| Scope                    | `dashboard-web-internal-linking-library` only. Push/PR and merge authorization are each their own separate, not-yet-requested next step. |

This gate approval does not itself authorize pushing the branch, opening a PR, merging, or a
production deployment — each remains its own separate, not-yet-requested authorization, per this
project's standing "no auto-merge" rule.
