# `dashboard-web` Asset Library UI — Approval Checklist

**Status:** Built, fully validated, independently code-reviewed (6 findings, all 6 fixed), and
security-reviewed (0 findings above threshold) — escalated from the light tier this slice started
at once the code-review fix round touched real confidential-field redaction logic, per
`CLAUDE.md`'s 2026-08-27 right-sizing rule (a change becomes "genuinely risky," not light-tier,
the moment it touches authorization/confidentiality logic, even if the branch started as a small
UI slice). **Required second-role human review complete — Jitesh D, "Approved," no disputes
raised.** **Gate `G4-dashboard-web-asset-library` approved — WebDesk Solution, decision CONFIRM.**
Not yet pushed or merged.

Closes the Asset Library module's last named gap, following the backend's own build arc
(`module-asset-library`, gate `G4-asset-library`, merged to `main` via PR #74, 2026-08-28).

## Completion condition

| #   | Item                             | Status                                                                                                                                                                                                                                                                                                                                     |
| --- | -------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| 1   | Authorization to build           | ✅ Explicit "start dashboard-web ui for asset library module" instruction, after confirming the backend was genuinely merged and live (the local branch had been stuck on an unmerged, conflicting PR — the user resolved the conflict and merged it directly before this build began, independently verified via `/health`'s `commitSha`) |
| 2   | Backend confirmed live           | ✅ `dashboard-api`'s `/health` returned `commitSha == 1a1d2e9` (the PR #74 merge commit); `GET /asset-library/assets` returned a clean `401`, not `404`                                                                                                                                                                                    |
| 3   | Required tests pass              | ✅ 1015/1015 `dashboard-web` unit tests (72 new across 5 files) — full suite green after both build and fix commits                                                                                                                                                                                                                        |
| 4   | Full validation clean            | ✅ typecheck, lint (`--max-warnings=0`), CSS-token check (52 files), `next build` (all 4 new routes present), prettier all clean — re-verified after the fix commit                                                                                                                                                                        |
| 5   | Self-review complete (build)     | ✅ Single direct read-through pass at build time — found and fixed 1 real bug (the `isRedacted` visibility-only check, since superseded by the code review's own deeper finding on the same mechanism — see below)                                                                                                                         |
| 6   | Independent code review complete | ✅ Medium effort, 8-angle finder pass, 1-vote verify — 6 candidates, all 6 CONFIRMED, all 6 fixed. See "Independent code review" below                                                                                                                                                                                                     |
| 7   | Security review complete         | ✅ `security-review` skill run separately on the fixed branch — **0 findings above threshold**. See "Security review" below                                                                                                                                                                                                                |
| 8   | Known out-of-scope gaps flagged  | ✅ No real file upload (D1, backend-level — no Blob store provisioned); the module-key picker for related records is sourced from `session.navigation`, matching `ReviewForm`'s own already-fixed pattern, not the RBAC-gated registry endpoint                                                                                            |
| 9   | Live end-to-end verified         | ⚠️ Not verified in a live browser — port 3000 was occupied by an unrelated, non-matching process in this environment (confirmed via a 404 on a known-existing route, `/brand-library`), so live-rendering wasn't possible. Verified instead via a clean `next build` with all 4 routes present, and the full unit test suite               |
| 10  | Documentation updated            | ✅ This file                                                                                                                                                                                                                                                                                                                               |
| 11  | Exact branch/commit verified     | Branch `dashboard-web-asset-library`, commits `ee04e37` (build) → `080f54a` (fix round), off `main` at the PR #74 merge commit (`1a1d2e9`)                                                                                                                                                                                                 |
| 12  | Live in production               | ⛔ Not yet — gate approved; push/PR and merge each remain their own separate, not-yet-requested authorization                                                                                                                                                                                                                              |

## Self-review at build time — the one finding, later superseded

`AssetLibraryForm`'s `isRedacted` flag was initially computed as
`initial?.visibility === "restricted"` alone, which would have permanently hidden and blocked
editing `consentReference` for a caller who genuinely holds `view_confidential`. Fixed at build
time by requiring both `visibility === "restricted"` AND `consentReference === null`. **This fix
was itself still wrong** — see the code review below, which found the real redaction signal is
`undefined` (an omitted key), not `null`, so the build-time fix's own guard never actually engaged
either.

## Independent code review

This project's own `code-review` skill, medium effort (3+5 finder angles, 6 candidates each,
1-vote verify). **6 candidates surfaced, all 6 CONFIRMED, all 6 fixed.**

**Most severe (3 related findings, one root cause):** `AuthorizationService`'s real redaction
mechanism (`confidential-field.util.ts#redactConfidentialFields()`) does
`delete redacted[field]` — a genuinely redacted field is absent from the response entirely
(`undefined`), not `null`. Both the form's `isRedacted` check and the detail page's own redaction
notice checked `=== null`, which is therefore always `false` for an actually-restricted asset:

- The form's "never resubmit a redacted field as a clear" guard never engaged — saving an edit to
  a restricted asset could silently overwrite the real, caller-invisible confidential value with
  an explicit `null`.
- `fileReference` had no guard at all, independent of the null/undefined bug — only
  `consentReference` was ever wrapped.
- The detail page's "may be hidden" notice never rendered — it falsely showed "Not set." instead.

**Fixed** by widening `Asset.fileReference`/`consentReference` to genuinely optional in
`packages/shared-types` (matching `BusinessKnowledgeRecord.content`'s established
`undefined`-signals-redaction convention), checking `=== undefined` in both the form and detail
page, and adding the missing `fileReference` guard. The doc comments that had incorrectly claimed
"the backend redacts by nulling" were corrected.

**3 smaller findings, all fixed:**

- 3 new components hand-rolled a `useState`+`useEffect` prop-resync instead of the existing
  `useSyncedState()` hook, whose own doc comment states every module built after it should adopt
  it from the start — adopted in all 3 (and the hook's setter type widened to
  `Dispatch<SetStateAction<T>>` to support functional updates, verified backward-compatible
  against all 7 existing consumers).
- `AssetRelatedRecordsSection` re-sorted an already-server-sorted `modules` prop on every
  render/keystroke — memoized.
- `integerField()`'s `NaN`-sentinel-plus-unchecked-cast pattern, and three copy-pasted
  Width/Height/Duration JSX blocks — replaced with a discriminated result type and one
  array-driven render.

Re-validated after the fix commit: 1015/1015 `dashboard-web` unit tests (4 new/updated, covering
the redaction fix precisely), typecheck/lint/CSS-token-check/`next build`/prettier all clean.

## Security review

`security-review` skill run separately, against the fixed branch (commit `080f54a`). **0 findings
above threshold.** Focused specifically on whether the code review's redaction fix actually closes
the disclosure/data-loss risk, or introduces a new one, plus the standard injection/XSS/
authorization sweep for a frontend-only slice:

- The redaction decision stays entirely server-side; the frontend only controls display, which has
  no security consequence since the backend independently omits the key regardless of client
  behavior.
- `fileReference` only ever renders as a link behind `isSafeHttpUrl()` — closes the same
  unrestricted-URL-scheme class this codebase hit once before (Projects' `environment.url`).
- Zero `dangerouslySetInnerHTML` in the diff — every rich-text field routes exclusively through the
  sanctioned `SanitizedRichText` component.
- Related-records fields render as plain JSX text only; `recordId` is UUID-checked client-side with
  the backend as the real enforcement point.
- The module-key picker sources from already-authorized session data — no new authorization
  surface.
- The `Asset` shared-type change is type-level only, no runtime implication.

## Design notes

- **Confidential-field redaction, corrected.** `fileReference`/`consentReference` are genuinely
  OMITTED (not nulled) from the response for a caller lacking `view_confidential` — the same
  `undefined`-signals-redaction convention `BusinessKnowledgeRecord.content` already establishes.
  Both the form and the detail page now check for that unambiguously, closing the earlier
  hedged/uncertain handling this file's own first revision described.
- **Related records** (`asset_related_records`) built as a real sub-resource with full add/edit
  (note-only)/delete CRUD from day one, mirroring `ClaimSourcesSection`'s established pattern. The
  module-key picker reuses `ReviewForm`'s own already-fixed data source
  (`session.navigation`/`GET /me/navigation`) rather than the RBAC-gated
  `GET /authz/module-registry`, avoiding the identical bug that form's own code review already
  caught once.
- Every long-text field uses `RichTextEditor`, per the 2026-08-22 standing rule — no new backend
  sanitization work was needed since `AssetsService.create()`/`update()` already wired
  `sanitizeNullableRichText()`/`sanitizeRichTextHtml()` in from the backend's own original build.

## Required second-role human review (ADR-0010)

The implementing agent cannot also be its own reviewer. A review packet was published as a Claude
artifact covering the code-review findings and fixes, the security-review disposition, and the
validation evidence.

| Field           | Value                                                                                                                                                               |
| --------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Reviewer        | Jitesh D                                                                                                                                                            |
| Decision        | **Approved**                                                                                                                                                        |
| Date            | 2026-08-29                                                                                                                                                          |
| Review artifact | [Asset Library Review Packet](https://claude.ai/code/artifact/f8a87c8c-bc92-453e-83e5-c5d79d22b58e)                                                                 |
| Disputes raised | None — all 6 code-review findings were already fixed, and the security review found 0 findings above threshold, so there was no open item to accept as tracked debt |

## Sign-off — `G4-dashboard-web-asset-library` gate

| Field           | Value                                                                                                                             |
| --------------- | --------------------------------------------------------------------------------------------------------------------------------- |
| Decision        | **CONFIRM** — a clean pass, not an override, since the required second-role review was already complete beforehand                |
| Approver        | WebDesk Solution                                                                                                                  |
| Date            | 2026-08-29                                                                                                                        |
| Approved commit | `080f54a` on branch `dashboard-web-asset-library`                                                                                 |
| Recorded in     | `outputs/webdesk-growth-dashboard/project.json` — `gates[]` (`current_gate` now `G4-dashboard-web-asset-library`) and `audit_log` |

A gate approval does not itself authorize pushing the branch, opening a PR, or merging — each
remains its own separate, not-yet-requested authorization, per this project's standing
"no auto-merge" rule.
