# `dashboard-web` Review and Approval Center UI — Approval Checklist

**Status:** Built, code review complete (9 candidates surfaced after dedup — 7 CONFIRMED, 2
PLAUSIBLE, 0 REFUTED — all 9 fixed). Security review complete (0 findings above threshold).
Required second-role human review complete — Jitesh D, "Approved," no disputes raised. Gate
(G4-dashboard-web-review-and-approval-center) approved — WebDesk Solution, decision CONFIRM,
approved commit `f5544ef` on branch `dashboard-web-review-and-approval-center`. Push/PR and merge
authorization remain separate, not-yet-requested next steps.

## Completion condition

Every item below must be genuinely true, verified against real evidence, before a gate decision
for this slice can be requested.

| #   | Item                                       | Status                                                                                                                                                                                                                                                                                                                        |
| --- | ------------------------------------------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1   | Authorization to build                     | ✅ Explicit "start wire dashboard-web UI" instruction, following the backend's own build-to-production arc ([PR #65](https://github.com/WDS-Internal-DeveloperTeam/webdesk-growth-dashboard/pull/65), merge commit `ff9352ceaf04a5fe4c087bcb0c1133830390ad49`)                                                                |
| 2   | Genuine scoping confirmed                  | ✅ No approved wireframe/screen spec exists for this module — a genuinely novel UI shape (a polymorphic `(targetModuleKey, targetId)` review engine attaching to records in OTHER modules, not a single content-record library) built to the smallest honest reading of `createReviewSchema`/`decideReviewSchema`             |
| 3   | Required tests pass                        | ✅ 878/878 `dashboard-api` unit tests (2 new this fix round), 371/371 `packages/database` integration tests, 362/362 `dashboard-api` e2e tests (all real disposable database + real seeded RBAC), 800/800 `dashboard-web` unit tests (4 new this fix round)                                                                   |
| 4   | Full validation clean                      | ✅ typecheck/lint/CSS-token-check/`next build`/prettier all clean across `dashboard-web` and `dashboard-api`; migration up/down round-trip clean; `pnpm audit` 0 vulnerabilities; all 4 new routes present in the build output                                                                                                |
| 5   | Independent code review complete           | ✅ This project's own `code-review` skill (high effort, 8-angle finder pass, 1-vote verification per surviving candidate) — 9 candidates after dedup, 7 CONFIRMED and 2 PLAUSIBLE, all 9 fixed, 0 REFUTED                                                                                                                     |
| 6   | Security review complete                   | ✅ `security-review` skill run separately, focused on the rich-text sanitization write/render pairing, the `session.navigation`-vs-`GET /authz/module-registry` authorization implication, `targetId`/`targetModuleKey` injection surface, cookie-forwarding, and client-side CAS-adjacent state — 0 findings above threshold |
| 7   | Known out-of-scope gaps flagged, not fixed | ✅ None — every CONFIRMED and PLAUSIBLE code-review finding was fixed in this round; no accepted tracked debt remains open on this branch                                                                                                                                                                                     |
| 8   | Live end-to-end verified                   | ⚠️ Not live-rendered in the Browser pane this round — no local `dashboard-api` was available in this environment; every route's unauthenticated-redirect path was already confirmed clean when the UI was first built (see the build commits' own account), and the fix round changed no route-level auth behavior            |
| 9   | Documentation updated                      | ✅ `CLAUDE.md`'s "Recent decisions" entry, this checklist, and `outputs/webdesk-growth-dashboard/project.json`'s `gates[]`/`audit_log`                                                                                                                                                                                        |
| 10  | Exact branch/commit verified and recorded  | ✅ Branch `dashboard-web-review-and-approval-center`, commits `7566e04` (backend rich-text sanitization for `review_comments.body`) → `c3cef45` (shared types) → `2058716` (UI build) → `1922f07` (unit tests) → `b2f9831` (code-review fixes, current `HEAD`) — not yet pushed to `origin`                                   |

## Forbidden-actions check

- No new RBAC/permission-group migration added — this slice touches no backend authorization
  logic beyond the already-existing `AuthorizationService.isValidModuleKey()` and the review's own
  per-action `@RequirePermission`/`decide()` dynamic gate, both pre-existing and unmodified by this
  branch.
- No new npm dependency was added.
- `getModuleRegistry()` was removed outright, not just deprecated — no dangling dead code or a
  second, unused fetch path left behind.
- The `notes`/`body` RichTextEditor conversion follows the exact write-time + render-time
  sanitization pattern every prior conversion in this codebase established — no new sanitizer, no
  bypass path.

## Independent code review — summary

Full record: this session's `ReportFindings` call (both the initial report and the
`outcome: "fixed"` re-report). 8-angle finder pass — 9 candidates survived dedup after 1-vote
verification, all 9 fixed:

1. **The list/create pages' `targetModuleKey` filter/picker was sourced from
   `GET /authz/module-registry`**, gated on `users_roles:view` (held by only 2 of 7 seeded
   roles) — silently empty for the other 5 roles today, not just under a hypothetical future RBAC
   change. **Fixed**: `getModuleRegistry()` removed entirely; both pages now source modules from
   `getServerSession()`'s already-fetched `session.navigation` (`GET /me/navigation`,
   `SessionGuard`-only, held by every authenticated session) — closes the RBAC gap and a redundant
   fetch in one change.
2. **`ReviewForm` navigated to the new review's detail page using `result.data.id` with no
   guard**, ignoring `postMutation()`'s own documented contract that success data may degrade to
   `undefined` on a missing/malformed response body. **Fixed**: an explicit null-data guard now
   shows a clear message ("The review was created, but its details couldn't be loaded...")
   instead of navigating to a literal `"undefined"` route.
3. **`ReviewProcessActions`' pause handler updated local `isPaused` from
   `result.data.isPaused`** instead of the locally-known target value — the same
   `postMutation()`-contract bug class. **Fixed**: updates from the locally-known `nextIsPaused`
   value, mirroring `ReviewDecisionActions`' own already-correct pattern.
4. **`ReviewProcessActions`' delegate handler updated local `assignedToUserId` from
   `result.data.assignedToUserId`** — the identical bug class. **Fixed**: updates from
   `selectedUser.id`, the locally-known target value.
5. **`review-decision-actions.tsx`'s own doc comment claimed a sibling `*StatusActions`
   component's reason field never uses `RichTextEditor` as precedent for keeping `notes` plain
   text** — no such comparable field exists anywhere in this codebase, and Website Strategy
   Center's own `notes` field already uses `RichTextEditor` under the 2026-08-22 standing rule.
   **Fixed**: `notes` converted to `RichTextEditor` (frontend), paired with a backend change —
   `reviews.service.ts#decide()` now sanitizes `dto.notes` via `sanitizeNullableRichText()` before
   writing it to both `review_decisions` and its `audit_events` mirror, `NOTES_MAX_LENGTH` raised
   2000→4000 (the same 2x markup-overhead ratio every prior rich-text conversion used), and the
   detail page's Decision History section now renders `notes` via the shared `SanitizedRichText`
   component.
6. **The prop-resync-via-`useEffect` pattern (pick up a sibling component's own
   `router.refresh()`) was hand-copied a 5th time** across `ReviewDecisionActions` and (twice)
   `ReviewProcessActions`, each citing the prior occurrence as precedent instead of importing a
   shared implementation — matching this project's own standing feedback about duplication/reuse
   misses. **Fixed**: extracted a new `useSyncedState()` hook (`lib/use-synced-state.ts`), migrated
   both components to it.
7. **`ReviewCommentsSection` nested `SanitizedRichText`'s block-level
   `<div dangerouslySetInnerHTML>` inside an inline `<span className={styles.rowMain}>`
   wrapper** — invalid HTML content, unlike every sibling row (e.g. `ClaimSourcesSection`) which
   only ever nests `<span>`/`<a>` children. **Fixed**: the wrapper changed to a `<div>` (verified
   safe — `.rowMain` composes from a flex-column base with no tag-specific styling).
8. **PLAUSIBLE, fixed anyway** (see finding 5 above — the notes-conversion doc-comment
   deviation was tracked as its own PLAUSIBLE finding before being resolved by the same fix).
9. **PLAUSIBLE, fixed anyway** (see finding 7 above — the DOM-nesting deviation was tracked as
   its own PLAUSIBLE finding before being resolved by the same fix).

No CONFIRMED or PLAUSIBLE finding was left as accepted, tracked debt on this branch.

## Independent security review — summary

Full record: this session's background finder-agent report. 8 focus areas checked directly
against the diff and the surrounding unchanged code paths (controllers, `SanitizedRichText`,
`reviews.service.ts#create()`). **0 findings above confidence 4** (i.e. 0 findings above the
report threshold). Confirmed:

- Write-time sanitization is correctly paired on both new rich-text fields —
  `review-comments.service.ts#create()` calls `sanitizeRichTextHtml()` before persisting `body`
  (with a new, correct post-sanitization empty-check); `reviews.service.ts#decide()` calls
  `sanitizeNullableRichText()` once and reuses the _sanitized_ value for both
  `review_decisions.notes` and the `audit_events` mirror, avoiding the classic bug of auditing raw
  unsanitized input.
- Render-time — both new render sites (Decision History's `notes`, `ReviewCommentsSection`'s
  comment body) route exclusively through the shared, unmodified `SanitizedRichText` component,
  which itself unconditionally re-sanitizes at render time. No `dangerouslySetInnerHTML` usage
  anywhere else in this diff, and no client-side render of raw HTML — the add-comment form
  deliberately avoids optimistic local rendering for exactly this reason, using
  `router.refresh()` instead.
- `session.navigation` is confirmed presentational-only — `POST /reviews` remains independently
  gated by `@RequirePermission(..., "create")` plus the server-side
  `AuthorizationService.isValidModuleKey()` call, both unchanged by this diff; nothing treats
  presence in `session.navigation` as an authorization decision.
- `targetId`/`targetModuleKey` have no injection surface — `targetId` is client-validated as a
  UUID shape only (advisory), stored, and rendered only as JSX text; `targetModuleKey` is
  validated server-side against the real module registry.
- The comments/decisions fetch functions' cookie-forwarding matches every sibling module's own
  established pattern exactly — nothing new or divergent.
- Every CAS-guard-relevant client-state update (`ReviewDecisionActions`/`ReviewProcessActions`)
  sends the real `expectedStatus`/`expectedIsPaused`/`expectedAssignedToUserId` values on every
  mutation; the backend's atomic compare-and-swap methods remain the sole real enforcement point,
  unmodified by this diff. The new `useSyncedState()` hook and post-success local state updates
  are purely cosmetic.

## Required second-role human review — COMPLETE

- [x] Code-review findings (9 CONFIRMED/PLAUSIBLE, all fixed) — reviewed by: **Jitesh D**,
      2026-08-25, **Approved**.
- [x] Security-review findings (0 above threshold) — reviewed by: **Jitesh D**, 2026-08-25,
      **Approved**.

Review packet:
[Review and Approval Center UI Review Packet](https://claude.ai/code/artifact/1e77aedd-e481-4340-bd8b-aa2302712d50)
(published as a Claude artifact — code review + security review findings, fixes, and validation
evidence, with a decision section).

## Sign-off

**Second-role human review: complete.** No disputes raised — every CONFIRMED and PLAUSIBLE
code-review finding was fixed in this round, so there was no open item to accept as tracked debt.

| Field                         | Value                                                                                                                                                   |
| ----------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Reviewer (second-role review) | Jitesh D                                                                                                                                                |
| Review date                   | 2026-08-25                                                                                                                                              |
| Decision                      | Approved                                                                                                                                                |
| Scope reviewed                | Full code-review disposition (9 findings, all fixed) and full security-review disposition (0 findings above threshold), per the published review packet |
| Disputes raised               | None recorded                                                                                                                                           |

**The gate (G4-dashboard-web-review-and-approval-center) was then separately requested and
approved** — WebDesk Solution, decision CONFIRM (clean pass, not an override, since the
second-role review was already complete before the gate was requested), approved commit
`f5544ef` on branch `dashboard-web-review-and-approval-center` — see
`outputs/webdesk-growth-dashboard/project.json`'s `gates[]` (`current_gate` now
`G4-dashboard-web-review-and-approval-center`).

| Field                    | Value                                                                                                                                      |
| ------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------ |
| Gate                     | G4-dashboard-web-review-and-approval-center                                                                                                |
| Approver (gate decision) | WebDesk Solution                                                                                                                           |
| Gate date                | 2026-08-25                                                                                                                                 |
| Decision                 | CONFIRM (clean pass, not an override — the second-role review was already complete before the gate was requested)                          |
| Approved commit          | `f5544ef` on branch `dashboard-web-review-and-approval-center` — see `outputs/webdesk-growth-dashboard/project.json`'s `gates[]`           |
| Scope                    | `dashboard-web-review-and-approval-center` only. Push/PR and merge authorization are each their own separate, not-yet-requested next step. |

This gate approval does not itself authorize pushing the branch, opening a PR, merging, or a
production deployment — each remains its own separate, not-yet-requested authorization, per this
project's standing "no auto-merge" rule.

## Push/PR — COMPLETE

**"Move ahead" was separately requested and executed.** Pushed to `origin`, opened as
[PR #66](https://github.com/WDS-Internal-DeveloperTeam/webdesk-growth-dashboard/pull/66). Merge
authorization remains a separate, not-yet-requested next step.
