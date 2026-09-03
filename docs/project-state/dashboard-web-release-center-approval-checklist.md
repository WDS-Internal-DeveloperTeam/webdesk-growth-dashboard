# `dashboard-web` Release Center UI — Approval Checklist

## Scope

Closes the Release Center module's last named gap, following the backend's own build-to-production
arc (PR #112, merged and live in production, `release_center`). No approved wireframe/screen spec
exists for this module — fields mirror `createReleaseSchema`/`updateReleaseSchema`/
`changeReleaseStatusSchema`/`createReleaseArtifactSchema`/`createDeploymentSchema`/
`createSmokeTestSchema` directly, the smallest honest reading of the backend's actual field set,
matching Technical Center's/Scan Center's own precedent for an unsourced screen. Four routes under
`app/(shell)/release-center/`: list (project-scoped, header-cookie fallback, filters on
`releaseType`/`status`/`search`), create, detail, edit. The detail page composes six sections:
Identity/Assignees (resolves `assignedDeveloperUserId`/`assignedReviewerUserId`/
`productionApproverUserId` via `getUsersByIds()`), Content (`notes`/`hotfixReason`, plain text),
`ReleaseStatusActions` (the real 14-status/23-edge workflow, hand-mirrored from
`ReleasesService`'s own `TRANSITIONS` map), `ReleaseArtifactsSection` (add/list/real-HTTP-`DELETE`),
`ReleaseApprovalsSection` (read-only, most-recent-first), `ReleaseDeploymentsSection`/
`ReleaseSmokeTestsSection` (append-only add/list), and a rollback-record block (read-only, renders
only when `GET .../rollback` returns a row).

`notes`/`hotfixReason`/status-transition `notes`/`reason` all stay plain `<textarea>`s, not
`RichTextEditor` — an explicit, documented exception to the 2026-08-22 rich-text standing rule,
since `createReleaseSchema`'s/`changeReleaseStatusSchema`'s own DTO comments state these fields are
"deliberately plain, unsanitized text — no `dashboard-web` UI exists yet," and no paired backend
sanitization change was made in this branch (it would be a backend change, out of scope for a
frontend-only slice). New `packages/shared-types` additions (`Release`/`ReleaseArtifact`/
`ReleaseApproval`/`Deployment`/`SmokeTest`/`RollbackRecord` and their enums) mirror
`packages/database/src/release-center/entities.ts` exactly. The two assignee `UserPicker` fields on
`ReleaseForm` use the established owner/`*Touched` data-loss-prevention pattern
(`ProjectForm`'s/`ReadyForClaudeTaskForm`'s own precedent).

Built by a background agent with a fully-specified prompt naming Technical Center's list page and
Case Study Studio's bespoke status-actions component as the literal structural templates, then
independently re-verified in full by the orchestrating session.

## Independent verification

(orchestrating session, not trusted from the build agent's own report)

- Read `packages/database/src/release-center/entities.ts`, `release-center.dto.ts`,
  `release-center.constants.ts`, and all 5 controllers' route/RBAC-decorator shapes directly before
  reviewing any frontend code.
- Read `ReleasesService`'s full `TRANSITIONS` map directly and diffed the frontend's
  `ALLOWED_TRANSITIONS` table in `release-status-actions.tsx` against it edge-for-edge — all 23
  `from->to` rows match exactly, including the `completed -> hotfix_required` re-entry and
  `rolled_back`'s zero outbound edges.
- Read every mutating `fetch()` call site in `lib/release-center.ts` and confirmed the URL/HTTP-verb
  shape matches the real controllers exactly — notably `POST .../releases/:id/update` (not
  `PATCH`), `POST .../releases/:id/status`, and the real `DELETE .../artifacts/:artifactId` (unlike
  several sibling sub-resources' own `POST .../delete` convention).
- Read `ReleaseForm` directly — confirmed `publicId`/`releaseType` are create-only (never sent on
  edit), matching `updateReleaseSchema`'s own contract exactly, and that the two assignee
  `UserPicker` fields correctly preserve an untouched, existing assignment on save rather than
  wiping it (the `developerTouched`/`reviewerTouched` guards).
- Read the edit-page redirect and the detail page's Edit-link visibility logic — both mirror
  `ReleasesService`'s own `EDIT_BLOCKED_STATUSES` (`completed`/`rolled_back`/`checks_failed`)
  exactly.
- Read `release-artifacts-section.tsx` — confirmed the client-side `repoOwner`/`repoName` regex
  matches the backend's own `repoOwnerOrName` pattern (`/^[\w.-]+$/`) exactly, and `prUrl` is
  guarded by `isSafeHttpUrl()` on both submit and render, matching every other stored-URL field in
  this app.
- Read `release-approvals-section.tsx` — confirmed `notes` renders as plain text, not via
  `SanitizedRichText`, correctly matching the backend's own unsanitized field.
- Read the new `packages/shared-types` block directly and confirmed every field name/type/
  nullability matches `packages/database/src/release-center/entities.ts` exactly.
- Read the list page's project-scoping — confirmed it reads `?projectId=` first, falls back to the
  header Project Switcher's `CURRENT_PROJECT_COOKIE`, and only falls back further to a
  `ProjectPickerForm` when neither resolves, matching Technical Center's/Scan Center's own
  established pattern from the 2026-09-02 current-project-propagation fix.
- Re-ran `pnpm --filter @webdesk/shared-types typecheck` — clean.
- Re-ran `pnpm --filter dashboard-web typecheck` — clean.
- Re-ran `pnpm --filter dashboard-web lint` (`eslint --max-warnings=0` + `check-css-tokens.mjs`,
  105 CSS Module files checked) — clean.
- Re-ran `pnpm --filter dashboard-web test` — 151 test files, 1878/1878 tests passing.
- Re-ran `pnpm --filter dashboard-web build` — clean; confirmed all 4 new routes present in the
  build output (`/release-center`, `/release-center/new`, `/release-center/[releaseId]`,
  `/release-center/[releaseId]/edit`).
- Re-ran `prettier --check` on every new/changed file — found and fixed one formatting drift on the
  list page (whitespace only), re-verified clean afterward.
- Re-ran `pnpm --filter dashboard-api typecheck` and `pnpm --filter dashboard-worker typecheck` —
  both clean, confirming the additive `packages/shared-types` change didn't regress either consumer.

## Review

Reviewed at **light tier**, per this project's own 2026-08-27 "right-size the review pipeline"
standing rule — a small, frontend-only UI slice consuming an already-reviewed, already-gated
backend (PR #112) with no new endpoint, no new RBAC action, and no new sink. A direct read-through
pass (not the 8-angle fan-out) verified the create/edit field contract against the real backend
DTOs, the 23-edge status-transition table byte-for-byte against the real backend `TRANSITIONS`
table, the artifact sub-resource's client-side validation against the real backend regex, the
route/HTTP-method shapes against the real controllers, the assignee-picker data-loss guards, the
terminal-state edit-blocking, and the field-treatment exception (plain text, not `RichTextEditor`)
against the backend's own DTO comments — **0 findings**. A separate security review was skipped per
the same standing rule — no new backend endpoint, no new RBAC/auth logic, and no new sink; every
rendered value (including `prUrl`) is plain JSX text or a guarded `<a>`, never
`dangerouslySetInnerHTML`.

## Sign-off

Required second-role human review (ADR-0010): **Approved as-is**, WebDesk Solution, 2026-09-03 —
via the direct "Approve as-is, gate it and push the branch" instruction; the approval checklist's
own findings summary above served as the review artifact, since there were no open findings of any
kind on this branch.

Gate `G4-dashboard-web-release-center`: **CONFIRM** — WebDesk Solution, 2026-09-03, approved commit
`a3e86c4` on branch `dashboard-web-release-center`.

This gate approval does not itself authorize opening a PR or merging — each remains its own
separate, not-yet-requested authorization, per this project's standing "no auto-merge" rule.
