# `dashboard-web` Design Review Center UI — Approval Checklist

**Status:** Built, fully validated. Reviewed at light tier (0 findings) per this project's
2026-08-27 "right-size the review pipeline" standing rule. Required second-role human review
complete. Gate `G4-dashboard-web-design-review-center` approved (WebDesk Solution, CONFIRM). Not
yet pushed, opened as a PR, or merged.

## Completion condition

Every item below must be genuinely true, verified against real evidence, before a gate decision
for this slice can be requested.

| #   | Item                                       | Status                                                                                                                                                                                                                                                                                                                                        |
| --- | ------------------------------------------ | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1   | Authorization to build                     | ✅ Explicit "Start the dashboard-web UI for it" instruction (Design Review Center), following the backend's own build-to-production arc (PR #89)                                                                                                                                                                                              |
| 2   | Genuine scoping confirmed                  | ✅ File-for-file mirrors Review and Approval Center's already-reviewed UI structure (closest sibling — both are cross-cutting engines attaching to records in other modules via `targetModuleKey`/`targetId`), with only the differences the backend's own contract requires added on top                                                     |
| 3   | Required tests pass                        | ✅ 1334/1334 `dashboard-web` unit tests (51 new) — independently re-run by the orchestrating session, not trusted from any agent's own report                                                                                                                                                                                                 |
| 4   | Full validation clean                      | ✅ typecheck clean across `packages/shared-types`/`packages/database`/`apps/dashboard-api`/`apps/dashboard-worker`/`apps/dashboard-web` (re-run after rebuilding the `@webdesk/shared-types` dist); `eslint --max-warnings=0` clean; CSS-token check clean (66 files); `next build` clean, all 3 new routes present; `prettier --check` clean |
| 5   | Independent review complete (light tier)   | ✅ A direct read-through pass (not the 8-angle fan-out, per the 2026-08-27 standing rule for a small frontend-only slice) — 0 findings                                                                                                                                                                                                        |
| 6   | Security review                            | Skipped per the same standing rule — diff touches nothing security-relevant (no new endpoint, no new sink; `notes` routes exclusively through the existing, already-audited `RichTextEditor`/`SanitizedRichText` pairing with server-side sanitization already shipped and reviewed as part of the backend)                                   |
| 7   | Known out-of-scope gaps flagged, not fixed | None found                                                                                                                                                                                                                                                                                                                                    |
| 8   | Live-rendered / verified                   | ✅ `next build` confirms all 3 new `/design-review-center` routes compile and are present in the route table; form/decision-actions unit tests cover both mutation paths directly, including the module's own 3rd terminal status (`superseded`)                                                                                              |
| 9   | Documentation updated                      | ✅ `docs/implementation/dashboard-web-design-review-center.md`                                                                                                                                                                                                                                                                                |
| 10  | Exact branch/commit verified               | Branch `dashboard-web-design-review-center`, commit `2f67c75` — not yet pushed to `origin`                                                                                                                                                                                                                                                    |

## Forbidden-actions check

- No new backend endpoint, RBAC action, or migration — reuses the already-live, already-reviewed
  `apps/dashboard-api/src/design-review-center/*` surface as-is, with zero backend changes.
- No new npm dependency.
- No confidential-field/redaction mechanism needed — matches the module registry's own precedent
  for this RBAC domain (no confidentiality field on `DesignReviewEntity`).

## Light-tier review — summary

A single direct read-through pass verified: the create-payload field set and required/optional
split against the real backend `createDesignReviewSchema`; the 4-action `decide()` transition
table (`NEXT_STATUS_FOR_ACTION`) against the real backend `NEXT_STATUS_FOR_DECISION` in
`design-reviews.service.ts` — byte-for-byte match; the terminal-status set
(`approved`/`rejected`/`superseded`) against the real backend `DesignReviewStatus` (D3) —
`superseded` correctly added as a 3rd terminal value beyond `ReviewDecisionActions`' own 2 (this
module has an automatic-supersede mechanism Review and Approval Center doesn't, so a naive copy
of the sibling's 2-terminal-status check would have been a real bug: rendering live decision
buttons on an already-superseded review); every fetch route against the real backend controller
(`design-reviews.controller.ts`); reuse of every established shared helper (`postMutation()`,
`isUuid()`, `formatTimestamp()`, `findOverLongRichTextField()`/`isEmptyRichTextHtml()`,
`useSyncedState()`, `SanitizedRichText`, `RichTextEditor`, `UserPicker`, `PageSizeSelect`,
`buildHrefBySize()`, `primaryActionLinkStyle`, `filterSelectStyle`/`filterSubmitButtonStyle`,
`listTableCellStyle`/`listTableHeaderCellStyle`, `dlStyle`/`h2Style`/`mutedStyle`/`sectionStyle`)
instead of re-implementing any of them; `moduleDisplayName`/`sortModulesForPicker` re-exported
from `lib/review-and-approval-center-query.ts` rather than re-declared (2nd occurrence of the
identical cross-cutting-engine "target module" picker need, past this project's own "extract
after the 2nd occurrence" convention); CSS Modules `composes` from the existing shared bases and
from `review-form.module.css`/`review-decision-actions.module.css` directly; and the module
registry's own seeded `route` field (`/design-review-center`, migration `00035`). **0 findings.**

A separate `security-review` pass was skipped per the standing rule — the diff adds no new
endpoint and no new input reaching a dangerous render path; `notes` routes exclusively through the
existing, already-audited `RichTextEditor`/`SanitizedRichText` pairing, with unchanged
server-side sanitization (`design-reviews.service.ts#decide()`) and unchanged RBAC/CAS/
separation-of-duties enforcement, all already security-reviewed as part of the backend (PR #89).

## Sign-off

**Required second-role human review:** Complete — via the direct "gate it and push the branch"
instruction. Light tier, so the findings table above served as the review artifact rather than a
separately published Claude artifact packet, matching the Wireframe Library/Motion and
Interaction Library UI precedent for a light-tier slice. There were no open findings of any kind
on this branch to accept as tracked debt.

**Gate:** `G4-dashboard-web-design-review-center` approved — WebDesk Solution, decision CONFIRM
(clean pass, not an override), approved commit `2f67c75` on branch
`dashboard-web-design-review-center`. See `outputs/webdesk-growth-dashboard/project.json`'s
`gates[]` (`current_gate` now `G4-dashboard-web-design-review-center`).

**This gate approval does not itself authorize opening a PR or merging** — each remains its own
separate, not-yet-requested authorization, per this project's standing "no auto-merge" rule.
