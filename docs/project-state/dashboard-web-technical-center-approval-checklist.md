# `dashboard-web` Technical Center UI — Approval Checklist

## Scope

Closes the Technical Center module's last named gap, following the
backend's own build-to-production arc (PR #108, merged and live in
production, `technical_center`). File-for-file mirrors Scan Center's
`dashboard-web` UI — the closest sibling (identical project-scoped 3-level
definitions/runs/findings pipeline and `TRANSITIONS` tables). Six routes
under `app/(shell)/technical-center/`: definitions list (project picker,
filters), create, detail (with a "Trigger run" action), edit; run detail
(status actions with an inline findings-creation form embedded in the
`completed`/`partially_completed` transition — there is no standalone
create route for `technical_findings`); finding detail (its own 4-state
disposition status actions). New `packages/shared-types` additions
(`TechnicalCheckDefinition`/`TechnicalCheckRun`/`TechnicalFinding` and
their enums) mirror `packages/database/src/technical-center/entities.ts`
exactly. `target`/`environment`/`scheduleCron`/`errorSummary`/finding
`description` stay plain text (not `RichTextEditor`) — an explicit,
documented exception to the 2026-08-22 rich-text standing rule, since the
backend never sanitizes these fields as HTML (confirmed directly against
the DTO's own doc comments), matching Scan Center's own identical
precedent for the same field shapes.

Built by a background agent with a fully-specified prompt naming Scan
Center as the literal file-for-file template, then independently
re-verified in full by the orchestrating session.

## Independent verification

(orchestrating session, not trusted from the build agent's own report)

- Pulled 4 commits this session's local checkout was missing from
  `origin/main` (the Technical Center backend, PR #108, had already merged
  from another session) and independently confirmed it live in production
  before starting: `dashboard-api`'s `/health` matched the merge commit
  `8c6a4896...`, and `GET /technical-center/projects/:projectId/definitions`
  returned a clean `401` (route live, `SessionGuard` enforcing — not a
  `404`).
- Re-ran `pnpm --filter @webdesk/shared-types typecheck` — clean.
- Re-ran `pnpm --filter dashboard-web typecheck` — clean.
- Re-ran `pnpm --filter dashboard-web lint` (`eslint --max-warnings=0` +
  `check-css-tokens.mjs`, 99 CSS Module files checked) — clean.
- Re-ran `pnpm --filter dashboard-web test` — 143/143 test files, 1823/1823
  tests passing (52 new).
- Re-ran `pnpm --filter dashboard-web build` — clean; confirmed all 6 new
  routes present in the build output (`/technical-center`,
  `/technical-center/definitions/new`,
  `/technical-center/definitions/[definitionId]`,
  `/technical-center/definitions/[definitionId]/edit`,
  `/technical-center/runs/[runId]`, `/technical-center/findings/[findingId]`).
- Re-ran `prettier --check` on every new/changed file — clean.
- Read `TechnicalCheckRunStatusActions`' `ALLOWED_TRANSITIONS` table
  directly and diffed it byte-for-byte against the real backend
  `TRANSITIONS` table in `technical-check-runs.service.ts` — identical
  (`requested→[queued,cancelled]`, `queued→[running,cancelled]`,
  `running→[completed,partially_completed,failed,timed_out,cancelled]`, all
  five terminal statuses with no outbound edge).
- Read `TechnicalFindingStatusActions`' `ALLOWED_TRANSITIONS` table
  directly and diffed it against `technical-findings.service.ts`'s own
  `TRANSITIONS` table — identical (`open→[acknowledged,resolved,dismissed]`,
  `acknowledged→[open,resolved,dismissed]`, `resolved`/`dismissed`
  terminal).
- Read every mutating `fetch()`/`postMutation()` call site directly and
  confirmed the URL/HTTP-method shape matches the real controllers exactly
  — notably `POST .../definitions/:id/update` (not a `PATCH`), and that
  findings are submitted only as the `findings` array inside a run's own
  `POST .../runs/:id/status` body, never a standalone create call.
- Read `TechnicalCheckDefinitionForm` directly — confirmed `publicId`/
  `checkType` are create-only (never sent on edit), matching
  `updateTechnicalCheckDefinitionSchema`'s own contract exactly, and that
  `target`'s `textField()` helper correctly distinguishes "omit" (create,
  leaves the column at its default) from "explicit null" (edit, clears an
  existing value) from a real string.
- Read the new `packages/shared-types` block directly and confirmed every
  field name/type/nullability matches
  `packages/database/src/technical-center/entities.ts` exactly.

## Review

Reviewed at **light tier**, per this project's own 2026-08-27 "right-size
the review pipeline" standing rule — a small, frontend-only UI slice
consuming an already-reviewed, already-gated backend (PR #108) with no new
endpoint, no new RBAC action, and no new sink. A direct read-through pass
(not the 8-angle fan-out) verified the create/edit field contract against
the real backend DTOs, both status-transition tables byte-for-byte against
the real backend `TRANSITIONS` tables, the embedded-findings-on-completion
flow against `technicalCheckRunFindingInputSchema`'s own field caps, the
route/HTTP-method shapes against the real controllers, and the field-
treatment exception (plain text, not `RichTextEditor`) against the
backend's own doc comments — **0 findings**. A separate security review
was skipped per the same standing rule — no new backend endpoint, no new
RBAC/auth logic, and no new sink; every rendered value is plain JSX text,
never `dangerouslySetInnerHTML`.

## Sign-off

Required second-role human review (ADR-0010): _pending._

Gate `G4-dashboard-web-technical-center`: _pending._

This checklist itself does not authorize pushing the branch, opening a PR,
or merging — each remains its own separate, not-yet-requested
authorization, per this project's standing "no auto-merge" rule.
