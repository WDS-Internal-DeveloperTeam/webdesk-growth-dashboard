# `dashboard-web` System Settings UI — Approval Checklist (light tier)

**Status:** Built, light-tier review complete (0 findings), no separate security review needed per
the 2026-08-27 "right-size the review pipeline" standing rule. Required second-role human review
complete — WebDesk Solution, "Approve as-is." Gate `G4-dashboard-web-system-settings` approved
(WebDesk Solution, CONFIRM). Pushed to `origin` on branch `dashboard-web-system-settings`. Not yet
opened as a PR or merged — each remains its own separate, not-yet-requested authorization.

## Completion condition

| #   | Item                         | Status                                                                                                                                                                                                                                                                                                                                                                                                                 |
| --- | ---------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1   | Authorization to build       | ✅ Explicit "start System Settings - dashboard-web UI" instruction — closes this module's last named gap, following the backend's own build-to-production arc (PR #122, live)                                                                                                                                                                                                                                          |
| 2   | Right pipeline tier chosen   | ✅ Light tier — a small, frontend-only UI slice consuming an already-reviewed, already-gated backend, no new endpoint, no new RBAC/auth logic, mirrors an already-reviewed sibling (Brand Library) file-for-file                                                                                                                                                                                                       |
| 3   | Required tests pass          | ✅ 2030/2030 `dashboard-web` unit tests overall (39 new — 21 lib/query, 11 form, 7 status-actions), independently re-run in an isolated worktree, not trusted from a build agent's own report (built directly, not delegated)                                                                                                                                                                                          |
| 4   | Full validation clean        | ✅ `@webdesk/shared-types`/`dashboard-web`/`dashboard-api`/`dashboard-worker` typecheck all clean; `eslint --max-warnings=0` clean; CSS-token check clean (110 files); `next build` clean, all 4 new routes present; `prettier --check` clean                                                                                                                                                                          |
| 5   | Light-tier review complete   | ✅ Single direct read-through pass (not the 8-angle fan-out) — verified the `publicId`/`settingType` create-only contract against the real backend DTO (`updateSystemSettingSchema`'s `.omit({publicId, settingType})`), the JSON-value client-side parse/validate flow, the `isActive` CAS-toggle payload shape against the real `changeSystemSettingActiveStateSchema`, and reuse of shared helpers. **0 findings.** |
| 6   | Security review              | Skipped, per the standing rule — this diff touches nothing security-relevant; no new endpoint, no new sink, `description` renders as plain JSX text (never `dangerouslySetInnerHTML`)                                                                                                                                                                                                                                  |
| 7   | Live end-to-end verified     | Not yet — not merged/deployed                                                                                                                                                                                                                                                                                                                                                                                          |
| 8   | Documentation updated        | This checklist; `CLAUDE.md` item 92 (backend) is updated separately once this UI merges                                                                                                                                                                                                                                                                                                                                |
| 9   | Exact branch/commit verified | Branch `dashboard-web-system-settings`, commit `8b9f940` — built and committed in an isolated git worktree (another session was concurrently active on the main checkout), pushed to `origin`. Not yet opened as a PR.                                                                                                                                                                                                 |

## Forbidden-actions check

- No new backend endpoint, RBAC action, or migration — reuses the already-live, already-reviewed
  `apps/dashboard-api/src/system-settings/*` surface verbatim.
- No new npm dependency.
- No confidential-field/redaction mechanism needed — matches the module registry's own seeded
  `confidentialityLevel: null`.

## Light-tier review — summary

A single direct read-through pass against the full diff and the real backend files it consumes
(`system-settings.dto.ts`, `.service.ts`, `.controller.ts`, `packages/database/src/system-settings/entities.ts`)
— not the 8-angle finder fan-out, per the standing rule for small UI slices. Confirmed:

- `SystemSettingForm` correctly treats `publicId`/`settingType` as create-only, matching
  `updateSystemSettingSchema`'s real `.omit({publicId, settingType})` contract.
- `value` (a raw-JSON `<textarea>`) is required on create (matching the backend's own non-nullish
  `value` field) and, on edit, is omitted from the payload entirely when left blank rather than
  sent as an empty object — matching `updateSystemSettingSchema`'s optional-but-non-nullable
  `value` contract exactly (there is no way to "clear" it, by design).
- `description` stays a plain `<textarea>`, never `RichTextEditor` — the backend's own DTO
  comment is explicit this field is "internal config, not authored content," with no
  sanitization wired; treating it as rich text would be dishonest, matching the
  `ReadyForClaudeTaskForm` precedent for a genuinely plain-text field.
- `SystemSettingActiveStateActions` posts `{isActive, expectedIsActive}` to
  `POST .../settings/:id/active-state`, matching `changeSystemSettingActiveStateSchema` exactly;
  the route itself is gated only on `view` at the guard level (the real `configure` gate runs
  dynamically inside the service), so the component correctly relies on the backend's own 403
  as the sole enforcement point — matching the established pattern for every sibling
  `*StatusActions`/`*PublishActions` component's own relationship to its backend gate.
- Uses the shared `useSyncedState()` hook from the start (built after it was extracted), matching
  every module built after 2026-08-27.
- Every established shared helper (`postMutation`, `getApiBaseUrl`, `isUuid`, `formatTimestamp`,
  `detail-section-styles.ts`, `list-filter-styles.ts`, `list-table-styles.ts`,
  `pagination.ts#buildHrefBySize`, `search-params.ts#firstValue`) is reused, not reimplemented.
- All named behaviors above are directly exercised in the three new test files.

**0 findings.**

## Sign-off

**WebDesk Solution reviewed and returned "Approve as-is,"** via the direct "Approve as-is, gate
it, and push the branch" instruction — light tier, so this checklist's own findings table (0
findings) served as the review artifact itself rather than a separately published packet, per
the standing rule that a light-tier change still needs the required second-role human review,
just not a separate packet.

**The gate (G4-dashboard-web-system-settings) was then separately approved** — WebDesk Solution,
decision CONFIRM (clean pass, not an override, since the second-role review was already complete
before the gate was requested), approved commit `8b9f940` on branch
`dashboard-web-system-settings` — see `outputs/webdesk-growth-dashboard/project.json`'s `gates[]`
(`current_gate` now `G4-dashboard-web-system-settings`).

**This gate approval does not itself authorize opening a PR or merging** — pushing the branch is
executed alongside this gate per the explicit combined instruction; opening a PR and merging
remain their own separate, not-yet-requested authorizations, per this project's standing
"no auto-merge" rule.
