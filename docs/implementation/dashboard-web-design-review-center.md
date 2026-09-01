# `dashboard-web` Design Review Center UI

## Scope

Closes the Design Review Center module's last named gap, following the backend's own
build-to-production arc ([PR #89](https://github.com/WDS-Internal-DeveloperTeam/webdesk-growth-dashboard/pull/89),
`docs/implementation/module-design-review-center.md`). Built directly on the explicit "Start the
dashboard-web UI for it" instruction.

No approved wireframe exists for this module — sections mirror the backend's own field/action
grouping (Target, Review type, Identity, Version compare, Decisions, Decision history), matching
every sibling module's own "smallest honest reading" precedent for an unsourced screen.

Design Review Center is structurally close to Review and Approval Center (module #11, already
live) — a cross-cutting engine attaching to records owned by OTHER modules via
`targetModuleKey`/`targetId`, not a single content-record library of its own. This UI mirrors
`ReviewAndApprovalCenterListPage`/`ReviewDetailPage`/`NewReviewPage`/`ReviewForm`/
`ReviewDecisionActions` file-for-file, with the differences the backend's own DTO/entity shape
requires:

- A required `reviewType` field (the 9-value vocabulary from
  `03_Detailed_Module_Specifications.md §19`), immutable after creation — Review and Approval
  Center has no equivalent field.
- A 3rd terminal status, `superseded` (reached only as the automatic side effect of a DIFFERENT
  review being approved for the same `(targetModuleKey, targetId, reviewType)` tuple — never a
  directly-requested `decide()` action) — `DesignReviewDecisionActions` renders nothing once
  `status` is `approved`/`rejected`/`superseded`, one more terminal value than
  `ReviewDecisionActions`' own 2.
- No comments capability — the spec names none for this module (unlike Review and Approval
  Center's own spec line, which explicitly names "comments") — no `DesignReviewCommentsSection`
  exists.
- No process-management actions (`pause`/`resume`/`delegate`) — the spec names none for this
  module either — no `DesignReviewProcessActions` exists, and the detail page has no "Process"
  section.

`moduleDisplayName`/`sortModulesForPicker` are re-exported from
`lib/review-and-approval-center-query.ts` rather than re-declared — this is the second
cross-cutting-engine module needing the identical "target module" picker behavior, past this
project's own "extract after the 2nd occurrence" convention, and neither function has any
review-and-approval-center-specific content (both operate on the generic `ModuleRegistrySummary`
shape).

New `packages/shared-types` additions: `DesignReviewType`, `DesignReviewStatus`,
`DesignReviewDecisionAction`, `DesignReview`, `DesignReviewDecision` — mirror
`packages/database/src/design-review-center/entities.ts` exactly.

Four routes under `app/(shell)/design-review-center/`: list (`page.tsx`), create (`new/page.tsx`),
detail (`[reviewId]/page.tsx`) — no generic edit route, since design reviews have no update
endpoint; every change is a `decide()` action, matching Review and Approval Center's own precedent.

## As-built

**Reviewed at light tier**, per this project's 2026-08-27 "right-size the review pipeline"
standing rule — a small, frontend-only UI slice consuming an already-reviewed, already-gated
backend (PR #89, gate `G4-design-review-center`) with no new endpoint, no new sink, and every
component built as a direct, line-by-line mirror of an already-reviewed sibling
(`ReviewAndApprovalCenterListPage`/`ReviewDetailPage`/`ReviewForm`/`ReviewDecisionActions`), not a
novel implementation. A single direct read-through pass (not the 8-angle fan-out) verified:

- The create-payload field set and required/optional split against the real backend
  `createDesignReviewSchema` (`apps/dashboard-api/src/design-review-center/
design-review-center.dto.ts`).
- The 4-action `decide()` transition table (`NEXT_STATUS_FOR_ACTION`) against the real backend
  `NEXT_STATUS_FOR_DECISION` in `design-reviews.service.ts` — byte-for-byte match.
- The terminal-status set (`approved`/`rejected`/`superseded`) against the real backend
  `DesignReviewStatus` (D3) — `superseded` correctly added as a 3rd terminal value beyond
  `ReviewDecisionActions`' own 2, closing what would otherwise be a real bug (rendering live
  decision buttons on an already-superseded review).
- Every fetch route (`GET /design-reviews`, `GET /design-reviews/:id`,
  `GET /design-reviews/:id/decisions`, `POST /design-reviews`,
  `POST /design-reviews/:id/decide`) against the real backend controller
  (`design-reviews.controller.ts`).
- Reuse of every established shared helper: `postMutation()`, `isUuid()`, `formatTimestamp()`,
  `findOverLongRichTextField()`/`isEmptyRichTextHtml()`, `useSyncedState()`,
  `SanitizedRichText`, `RichTextEditor`, `UserPicker`, `PageSizeSelect`, `buildHrefBySize()`,
  `primaryActionLinkStyle`, `filterSelectStyle`/`filterSubmitButtonStyle`, `listTableCellStyle`/
  `listTableHeaderCellStyle`, `dlStyle`/`h2Style`/`mutedStyle`/`sectionStyle` — no new duplicate of
  any of these was introduced.
- CSS Modules `composes` from the existing shared bases (`form-fields.module.css`,
  `status-actions.module.css`) and from `review-form.module.css`/
  `review-decision-actions.module.css` directly (a 2nd consumer of each, matching this project's
  own extraction convention).
- The module registry's own seeded `route` field (`/design-review-center`, migration `00035`).

**0 findings** from this pass. A separate security-review pass was skipped per the same standing
rule — the diff touches nothing security-relevant: no new endpoint, no new sink, `notes` routes
exclusively through the existing, already-audited `RichTextEditor`/`SanitizedRichText` pairing
with server-side sanitization already shipped and security-reviewed as part of the backend
(`design-reviews.service.ts#decide()`), and every RBAC/CAS/separation-of-duties enforcement point
is unchanged, unmodified backend code.

Validation, independently re-run by the orchestrating session:

- `packages/shared-types` rebuilt (`pnpm --filter @webdesk/shared-types run build`) — the new
  types weren't visible to `dashboard-web`'s own `tsc` until the dist was regenerated.
- 1334/1334 `dashboard-web` unit tests (51 new: 28 in `design-review-center.test.tsx` — query
  parsing/href-building/status-badge/decision-action-label/fetch-function coverage mirroring
  `review-and-approval-center.test.tsx`'s own structure; 11 in `design-review-form.test.tsx`; 12
  in `design-review-decision-actions.test.tsx`, including a dedicated "superseded: renders
  nothing" test the sibling module has no equivalent for).
- `tsc --noEmit` clean across `dashboard-web`, `dashboard-api`, `dashboard-worker`, and
  `packages/database` (all re-typechecked after the shared-types rebuild, confirming no
  regression from the additive shared-types change).
- `eslint --max-warnings=0` clean on every new file.
- `check-css-tokens.mjs` clean (66 CSS Module files).
- `next build` clean — all 3 new routes (`/design-review-center`,
  `/design-review-center/new`, `/design-review-center/[reviewId]`) present in the build output.
- `prettier --check` clean after one `--write` pass.

Committed to branch `dashboard-web-design-review-center`. **Required second-role human review
complete** — via the direct "gate it and push the branch" instruction; light tier, so the
approval checklist's own findings table
(`docs/project-state/dashboard-web-design-review-center-approval-checklist.md`) served as the
review artifact rather than a separately published packet, since there were no open findings of
any kind on this branch. **The gate (G4-dashboard-web-design-review-center) was then separately
requested and approved** — WebDesk Solution, decision CONFIRM, approved commit `2f67c75` on
branch `dashboard-web-design-review-center`. **"Push the branch" and "Open a PR" were then
separately requested and executed** — pushed to `origin`, opened as
[PR #91](https://github.com/WDS-Internal-DeveloperTeam/webdesk-growth-dashboard/pull/91). A
concurrent merge conflict against `origin/main` (Case Study Studio's own backend + UI, PRs
#88/#90, landed while this branch was in review) was resolved by merging `origin/main` in —
`packages/shared-types/src/index.ts` and `outputs/webdesk-growth-dashboard/project.json` both
conflicted on purely additive appends from both sides; resolved by keeping both sides in full and
re-sequencing `project.json`'s `audit_log` version counters. Fully re-verified after the merge,
independently by the orchestrating session: 1409/1409 `dashboard-web` unit tests,
typecheck/lint/CSS-token-check (71 files)/`next build` (both `/design-review-center` and
`/case-study-studio` routes present)/`prettier --check` all clean. **"Merge PR #91" was then
separately requested and executed** — all 14 CI checks confirmed green beforehand, merged with a
real merge commit (not squash/rebase), matching every prior merge in this project's history —
merge commit `2814c06a7b816659060c52662f54a533cf99e8a0`. Both Vercel projects auto-deployed on
push to `main` and were verified live directly, not just via CI's own Vercel status check —
`dashboard-api`'s `/health` returned `build.commitSha ==
2814c06a7b816659060c52662f54a533cf99e8a0`, confirming the exact merged commit is what's serving;
`GET /design-reviews` returned a clean `401` (route live, `SessionGuard` enforcing — not a `404`,
which would mean the module never actually deployed); and `dashboard-web`'s `/design-review-center`
correctly redirects (307) an unauthenticated visitor to `/auth/sign-in`. **The `dashboard-web`
Design Review Center UI is now genuinely live in production**, closing out this slice's full
build-to-production arc — backend and now the full UI (list, create form, detail page with
decision actions) are both live for the Design Review Center module.
