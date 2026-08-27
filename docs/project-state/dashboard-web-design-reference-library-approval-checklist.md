# `dashboard-web` Design Reference Library UI — Approval Checklist

**Status:** Built, independently re-verified, code review complete (2 CONFIRMED findings, both
fixed; 0 open), security review complete (0 findings above threshold). Required second-role human
review complete — Jitesh D, "Approved," no disputes raised. Awaiting a gate decision, then
push/PR/merge — each its own separate authorization per this project's standing "no auto-merge"
rule.

## Completion condition

| #   | Item                              | Status                                                                                                                                                                                                                                                    |
| --- | ---------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1   | Authorization to build              | ✅ Explicit "Start the dashboard-web UI for it" instruction, following the backend's own build-to-production arc (PR #72, live)                                                                                                                          |
| 2   | Genuine scoping confirmed           | ✅ No approved wireframe exists for this module — sections mirror `03_Detailed_Module_Specifications.md §11`'s own field grouping (Identity, Reference, Assessment, Status), matching every prior module's own "smallest honest reading" precedent      |
| 3   | Required tests pass                 | ✅ 943/943 `dashboard-web` unit tests (57 new), typecheck clean across `@webdesk/shared-types`/`dashboard-web`/`dashboard-api`/`dashboard-worker` — all independently re-run by the orchestrating session, not trusted from the build agent's own report |
| 4   | Full validation clean                | ✅ lint (`--max-warnings=0`) and `check-css-tokens.mjs` clean (48 CSS Module files, independently re-run); `next build` clean with all 4 new `/design-reference-library` routes present; `prettier --check` clean                                       |
| 5   | Independent code review complete    | ✅ This project's own `code-review` skill (high effort, 8-angle finder pass, 1-vote verification) — 2 CONFIRMED findings kept after dedup (status-actions/publish-actions each hand-rolling a prop-resync pattern instead of the existing `useSyncedState()` hook); **both fixed** in commit `b1c46bc`. 0 open findings. |
| 6   | Security review complete            | ✅ `security-review` skill run separately — 0 findings above threshold                                                                                                                                                                                    |
| 7   | Known out-of-scope gaps flagged      | ✅ None — this UI covers the full backend surface (CRUD, status transitions, publish/unpublish)                                                                                                                                                          |
| 8   | Live end-to-end verified             | ✅ Independently re-verified by the orchestrating session: every high-risk file read directly (form, detail page's image-preview/rich-text-vs-plain-text split, status/publish actions against the real backend `TRANSITIONS` table), every validation command re-run fresh |
| 9   | Documentation updated                | ✅ `docs/implementation/module-design-reference-library.md` already records the backend's Scope/As-built; this UI slice's own account is captured here and in `CLAUDE.md`                                                                                |
| 10  | Exact branch/commit verified          | Branch `dashboard-web-design-reference-library`, commits `781f944` (build) → `b1c46bc` (code-review fix) — not yet pushed to `origin`                                                                                                                    |

## Design decisions worth recording

- **No `recordType` discriminator** — unlike Brand Library, this module has no record-type field
  (D1 in the backend's own Scope doc), so the form/list/detail pages are simpler than Brand
  Library's equivalent.
- **Two URL fields** (`sourceUrl`, `screenshotUrl`) instead of Brand Library's one
  (`fileReference`) — both validated client-side via the existing `isSafeHttpUrl()` guard before
  submit, mirroring the established pattern exactly.
- **A genuinely new UI pattern**: the detail page renders `screenshotUrl` as an inline `<img>`
  preview (gated behind the same `isSafeHttpUrl()` check used for the link-out), not just a link —
  no sibling module renders an image from a URL field, and no existing image component exists in
  this codebase to reuse, confirmed via a dedicated codebase-wide grep before building it as a
  one-off.
- **Two plain-text fields** (`desktopBehavior`, `mobileBehavior`) deliberately stay plain
  `<textarea>`/text render, never `RichTextEditor`/`SanitizedRichText` — the backend stores these
  two fields unsanitized as plain text (D5 in the backend's Scope doc), so treating them as HTML
  would be dishonest.
- **Five rich-text fields** (`likes`, `dislikes`, `motionNotes`, `accessibilityConcerns`,
  `performanceConcerns`) use `RichTextEditor`/`SanitizedRichText`, per the 2026-08-22 standing
  rule — the backend already wired write-time sanitization in from day one (the backend build was
  sanitize-ready even before this UI existed).

## Forbidden-actions check

- No new backend endpoint or RBAC change — this branch is `dashboard-web` only.
- No new npm dependency was added.

## Independent code review — summary

8-angle finder pass — 2 candidates kept in the final report after dedup and 1-vote verification:

1. **`DesignReferenceLibraryStatusActions` hand-rolled prop-resync** (CONFIRMED) — used a local
   `useState`/`useEffect` pair to re-sync `approvalStatus` from its prop instead of the existing
   `useSyncedState()` hook (`lib/use-synced-state.ts`), extracted specifically to eliminate this
   exact duplication after it recurred 5 times across 4 sibling files. Since this is a
   from-scratch build (not a retrofit of pre-existing code), there was no scope reason to skip the
   shared hook. **Fixed** — commit `b1c46bc`.
2. **`DesignReferenceLibraryPublishActions`'s identical pattern for `isPublished`** (CONFIRMED) —
   same fix, same commit.

Every other finder angle (line-by-line scan, template-fidelity vs. Brand Library, cross-file
tracer verifying the hand-copied `TRANSITIONS` table and publish-gating logic against the real
backend, simplification/efficiency, altitude/conventions) returned no findings — the diff was
confirmed to correctly reuse every other established shared helper (`richTextFieldValue`,
`findOverLongRichTextField`, `postMutation`, `isSafeHttpUrl`, `TagListField`,
`artifact-approval-status.ts`, `detail-section-styles.ts`, `list-filter-styles.ts`) and to
field-for-field match the real backend DTO/entity, not a guess.

## Security review — summary

0 findings above threshold. Confirmed: the new `<img src={record.screenshotUrl}>` render is
genuinely gated behind `isSafeHttpUrl()` with no bypass path; both rich-text render sites route
through the unmodified, already-sanitizing `SanitizedRichText` component; `sourceUrl`/
`screenshotUrl` link-outs share the identical safe-URL gate; every new fetch targets a fixed
`getApiBaseUrl()` plus hardcoded path literals or a UUID-validated `recordId` (no SSRF/
open-redirect surface); and client-side visibility checks are UI convenience only, with the
backend's unmodified RBAC/state-machine logic remaining the real enforcement point.

## Sign-off

**Required second-role human review** — Jitesh D reviewed the published review packet
(code review + security review findings, fixes, and validation evidence) and returned
**"Approved,"** no disputes raised. 0 open findings of any kind on this branch.

A gate decision, push/PR, and merge authorization remain separate, not-yet-requested next steps.
