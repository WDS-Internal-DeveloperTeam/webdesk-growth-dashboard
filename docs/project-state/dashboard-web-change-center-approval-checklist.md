# `dashboard-web` Change Center UI — approval checklist

| #   | Item                                     | Status                                                                                                                    |
| --- | ---------------------------------------- | ------------------------------------------------------------------------------------------------------------------------- |
| 1   | Built to explicit instruction            | ✅ "Start the dashboard-web UI for it" (Change Center)                                                                    |
| 2   | Backend already reviewed/gated/merged    | ✅ PR #103, gate `G4-change-center`, live in production                                                                   |
| 3   | Full validation clean                    | ✅ 1623/1623 `dashboard-web` unit tests, unchanged (no new tests — matching the light-tier standard for this diff's size) |
| 4   | Typecheck clean                          | ✅ `@webdesk/shared-types`/`dashboard-web`                                                                                |
| 5   | Lint clean                               | ✅ `eslint --max-warnings=0` (new files)                                                                                  |
| 6   | CSS-token check clean                    | ✅ 85 CSS Module files                                                                                                    |
| 7   | `next build` clean, all 4 routes present | ✅ `/change-center`, `/new`, `/[recordId]`, `/[recordId]/edit`                                                            |
| 8   | Prettier clean                           | ✅                                                                                                                        |
| 9   | Documentation updated                    | ✅ This checklist; `CLAUDE.md` item + audit-log entry to follow the gate                                                  |
| 10  | Exact branch/commit verified             | Branch `dashboard-web-change-center`, commit `3a55e9d` — pushed to `origin`                                               |

## Forbidden-actions check

- No new backend endpoint, RBAC action, or RBAC migration — consumes the already-live,
  already-reviewed `apps/dashboard-api/src/change-center/*` surface as-is, with zero backend
  changes in this diff.
- No new npm dependency.
- No confidentiality/redaction mechanism change — this module's own seeded
  `confidentialityLevel` is `null` (no such field exists on `ChangeRecord`), matching the
  backend's own already-reviewed design.

## Light-tier review — summary

Per this project's 2026-08-27 "right-size the review pipeline" standing rule — a small,
frontend-only UI slice consuming an already-reviewed, already-gated backend, with **zero** backend
changes (unlike several recent sibling slices that also carried a rich-text-sanitization backend
change). A single direct read-through pass verified:

- The create/edit field contract against the real backend `createChangeRecordSchema`/
  `updateChangeRecordSchema` — `publicId`/`category` correctly create-only; `severity` correctly
  editable on both create and edit (the one field the backend's own DTO doc comment calls out as
  deliberately NOT locked, unlike `category`); `status`/`rollbackGuidance` correctly never form
  fields (only the dedicated status route may touch either).
- `beforeValue`/`afterValue`/`recommendation`/`decisionNotes` correctly stay plain `<textarea>`s,
  not `RichTextEditor` — verified directly against `ChangeRecordsService`, which never calls
  `sanitizeNullableRichText()`/`sanitizeRichTextHtml()` anywhere; treating these as rich text would
  have been dishonest (this module was never in scope for the 2026-08-22 standing rule, since the
  backend stores them as raw diff/version-string data, not prose).
- `ChangeRecordStatusActions`' `ALLOWED_TRANSITIONS` table checked byte-for-byte against the real
  backend `TRANSITIONS` table in `change-records.service.ts` — all 10 states, including both
  terminal states (`rejected`/`verified`, confirmed via `window.confirm()` before submit, matching
  every sibling status-actions component's own irreversible-transition convention) and the
  `apply_failed` retry loop (`apply_failed -> applying`).
- The `targetModuleKey`/`targetId` pairing invariant (`refineTargetPairing` on the backend) is
  checked client-side before submit, matching `ReviewForm`'s identical pattern for the structurally
  identical Review and Approval Center relationship.
- `targetModuleKey`'s `<select>` sources from `session.navigation` (not a dedicated
  `GET /authz/module-registry` fetch), mirroring `ReviewForm`'s/`ReadyForClaudeTaskForm`'s own
  already-reviewed reasoning (that endpoint is gated on `users_roles:view`, held by only 2 of 7
  seeded roles).
- `scanFindingId` stays a plain UUID-format-checked text input, not a picker — correct, since no
  `dashboard-web` UI exists yet for Scan Center to pick a finding from.
- The detail page's "Edit" link is hidden once the record leaves `detected`/`under_review`
  (`EDITABLE_STATUSES`, mirrored from the backend's own identical set), and the edit route itself
  redirects away for the same case — matching Website Strategy Center's/Page Inventory's own
  terminal-state Edit-link-hiding precedent, applied here as a real navigation guard (not just a
  hidden link) since the edit route is directly reachable by URL.
- Reuse of every established shared helper instead of re-implementing any of them
  (`form-field-value.ts`, `detail-section-styles.ts`, `list-filter-styles.ts`,
  `list-table-styles.ts`, `pagination.ts`, `project-scoped-href.ts`, `use-synced-state.ts`,
  `UserPicker`, `review-and-approval-center-query.ts`'s `moduleDisplayName`/
  `sortModulesForPicker`).
- The assignee (`assignedToUserId`) resolution on both the detail and edit pages is individually
  guarded (`getUser().catch(...)`) against a non-essential-lookup failure (a 403 from a role
  lacking `users_roles:view`), matching `resolveLinkRelationships()`'s/`ProjectForm`'s own
  established precedent — not left to crash the page.

**0 findings** kept.

A separate `security-review` pass was skipped per the same standing rule — the diff adds no new
endpoint, no new RBAC action, no new sink, and zero backend changes; the one plain-text
free-text field set (`beforeValue`/`afterValue`/`recommendation`/`decisionNotes`) renders only via
plain JSX text (a `<pre>` block, never `dangerouslySetInnerHTML`).

## Sign-off

**Required second-role human review:** Complete — via the direct "gate it and push the branch"
instruction. Light tier, so the findings table above served as the review artifact rather than a
separately published Claude artifact packet, matching the Wireframe Library/Motion and Interaction
Library/Knowledge Library UI precedent for a light-tier slice. There were no open findings of any
kind on this branch to accept as tracked debt.

**Gate:** `G4-dashboard-web-change-center` approved — WebDesk Solution, decision CONFIRM (clean
pass, not an override, since the second-role review was already complete before the gate was
requested), approved commit `3a55e9d` on branch `dashboard-web-change-center`. See
`outputs/webdesk-growth-dashboard/project.json`'s `gates[]` (`current_gate` now
`G4-dashboard-web-change-center`).

**This gate approval does not itself authorize opening a PR or merging** — pushing the branch was
separately requested in the same instruction ("gate it and push the branch") and executed
immediately after the gate above; opening a PR and merging each remain their own separate,
not-yet-requested authorization, per this project's standing "no auto-merge" rule.
