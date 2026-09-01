# `dashboard-web` Knowledge Library UI — approval checklist

| # | Item | Status |
|---|------|--------|
| 1 | Built to explicit instruction | ✅ "Start the dashboard-web UI for it" (Knowledge Library) |
| 2 | Backend already reviewed/gated/merged | ✅ PR #96, gate `G4-knowledge-library`, live in production |
| 3 | Full validation clean | ✅ 1571/1571 `dashboard-api` unit (3 new), 1540/1540 `dashboard-web` unit (37 new) |
| 4 | Typecheck clean | ✅ `dashboard-api`/`dashboard-web`/`dashboard-worker`/`@webdesk/shared-types` |
| 5 | Lint clean | ✅ `eslint --max-warnings=0` (new files) |
| 6 | CSS-token check clean | ✅ 79 CSS Module files |
| 7 | `next build` clean, all 4 routes present | ✅ `/knowledge-library`, `/new`, `/[recordId]`, `/[recordId]/edit` |
| 8 | Prettier clean | ✅ |
| 9 | Documentation updated | ✅ `docs/implementation/module-knowledge-library.md`'s new "As-built — `dashboard-web` UI" section |
| 10 | Exact branch/commit verified | Branch `dashboard-web-knowledge-library` — not yet pushed to `origin` |

## Forbidden-actions check

- No new backend endpoint, RBAC action, or RBAC migration — reuses the already-live, already-
  reviewed `apps/dashboard-api/src/knowledge-library/*` surface, with only a length-cap raise
  (10,000 → 20,000) on `notes` plus real write-time sanitization (`sanitizeNullableRichText()`/
  `sanitizeNullableRichTextIfChanged()`) added to `knowledge-library-records.service.ts`, matching
  the identical pattern already shipped for Persona Library, Service Library, Website Strategy
  Center, Internal Linking Library, and others.
- No new npm dependency.
- No confidential-field/redaction *mechanism* change — the redaction contract
  (`sourceType`/`location`/`notes` → `undefined` when redacted) was already built and reviewed on
  the backend (PR #96); this UI only honors that existing contract, the same way
  `BusinessKnowledgeRecordForm`/`ServiceLibraryForm` already do for their own redacted fields.

## Light-tier review — summary

Per this project's 2026-08-27 "right-size the review pipeline" standing rule — a small,
frontend-only UI slice consuming an already-reviewed, already-gated backend, plus a well-
established, low-risk backend pattern (rich-text sanitization wiring) already used identically in
6+ prior modules. A single direct read-through pass verified: the create/edit field contract
against the real backend `createKnowledgeLibraryRecordSchema`/`updateKnowledgeLibraryRecordSchema`
(no create-only field exists for this module, unlike most siblings); `KnowledgeLibraryStatusActions`'
transition table against the backend's real `ALLOWED_TRANSITIONS` table byte-for-byte, including
the single `deprecated`-is-terminal confirmation; the redaction contract (`undefined` vs `null`)
against the real controller's `redactIfRestricted()`/`CONFIDENTIAL_RESTRICTED_FIELDS`; the
`ownerUserId`/`UserPicker`/`ownerTouched` wiring against `ProjectForm`'s own established
precedent; reuse of every established shared helper instead of re-implementing any of them
(`form-field-value.ts`, `rich-text.ts`, `datetime-local.ts`, `detail-section-styles.ts`,
`list-filter-styles.ts`, `list-table-styles.ts`, `pagination.ts`, `SanitizedRichText`,
`UserPicker`, `TagListField`); the terminal-state "Edit" link hiding on the detail page (matching
Website Strategy Center's own precedent); and the list page's `search` clamping being fixed to
match the Persona/Service Library convention (clamp, not reject) rather than Business Knowledge
Center's stricter one, since this module's own backend query schema allows any length up to 255
and clamping is the more common sibling behavior. **0 findings** kept after that one fix.

A separate `security-review` pass was skipped per the same standing rule — the diff adds no new
endpoint, no new RBAC action, and no new input reaching a dangerous render path; the sole backend
change (a length-cap raise plus sanitization wiring) is identical in shape to 6+ already-reviewed
prior modules, and the one rich-text render site routes exclusively through the existing,
already-audited `SanitizedRichText` component.

## Sign-off

**Required second-role human review:** Not yet requested.

**Gate:** Not yet requested.

**Note on push/PR/gate/merge:** Committed to branch `dashboard-web-knowledge-library`, off `main`
at the commit recording the Knowledge Library backend's production migration incident. Pushing
the branch, opening a PR, requesting the required second-role human review, requesting the gate,
and merging are each their own separate, not-yet-requested authorization, per this project's
standing "no auto-merge" rule — none of the four has happened yet.
