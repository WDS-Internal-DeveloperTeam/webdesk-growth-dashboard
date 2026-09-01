# `dashboard-web` Workflow and Task Template Library UI — approval checklist

| #   | Item                                     | Status                                                                                                         |
| --- | ---------------------------------------- | -------------------------------------------------------------------------------------------------------------- |
| 1   | Built to explicit instruction            | ✅ "Start the dashboard-web UI for it" (workflow and task template library)                                    |
| 2   | Backend already reviewed/gated           | ✅ Gate `G4-workflow-and-task-template-library` (WebDesk Solution, CONFIRM), commit `f3d2516` — not yet merged |
| 3   | Full validation clean                    | ✅ 1602/1602 `dashboard-api` unit (2 new), 1578/1578 `dashboard-web` unit (38 new)                             |
| 4   | Typecheck clean                          | ✅ `dashboard-api`/`dashboard-web`                                                                             |
| 5   | Lint clean                               | ✅ `eslint --max-warnings=0` (new files)                                                                       |
| 6   | CSS-token check clean                    | ✅ 81 CSS Module files                                                                                         |
| 7   | `next build` clean, all 4 routes present | ✅ `/workflow-and-task-template-library`, `/new`, `/[templateId]`, `/[templateId]/edit`                        |
| 8   | Prettier clean                           | ✅                                                                                                             |
| 9   | Documentation updated                    | ✅ `docs/implementation/module-workflow-and-task-template-library.md`'s new "As-built — `dashboard-web` UI"    |
| 10  | Exact branch/commit verified             | Branch `module-workflow-and-task-template-library` — committed on top of `5d0f480`                             |

## Forbidden-actions check

- No new backend endpoint or RBAC action/migration — reuses the already-built, already-gated
  `apps/dashboard-api/src/workflow-and-task-template-library/*` surface (gate
  `G4-workflow-and-task-template-library`).
- The one backend change is **new** write-time HTML sanitization
  (`sanitizeNullableRichText()`/`sanitizeNullableRichTextIfChanged()`, `@webdesk/validation`)
  wired into `create()`/`update()` for the 4 long-text fields, plus a `LONG_TEXT_MAX_LENGTH`
  raise (4,000 → 8,000) — unlike some prior UI slices, this backend had never sanitized these
  fields before (a deliberate deferral in the original backend-only pass), so this is genuinely
  new sanitization wiring, not a length-cap raise on an already-sanitizing field.
- No new npm dependency.
- No confidential-field/redaction mechanism — this module has none (matches the backend's own
  design, `confidentialityLevel: null`).

## Code review — summary

This project's own `code-review` skill ran at **high effort** (8 finder angles, 1-vote
verification) given the diff wires genuinely new sanitization for the first time — see the
"Forbidden-actions check" above. 3 candidates survived dedup to verification; 2 were **REFUTED**:

- A theoretical post-sanitize length-cap overflow (`dto.ts`'s `LONG_TEXT_MAX_LENGTH`) — refuted:
  `sanitizeRichTextHtml()` only ever strips disallowed content, never expands it, and the DB
  columns are unbounded `TEXT` with no real consequence even in the theoretical case.
- The frontend's hand-copied `TRANSITIONS`/`ALLOWED_TRANSITIONS` mirror — refuted as an
  already-repeatedly-accepted, zero-drift codebase-wide convention (22 sibling `*status-actions.tsx`
  files do this identically), not something this diff worsens.

1 candidate came back **PLAUSIBLE** and is accepted here as tracked debt (per explicit
instruction, not fixed):

- `WorkflowAndTaskTemplateLibraryService.update()`'s audit event
  (`workflow-and-task-template-library.service.ts:194`) logs the raw, pre-sanitization patch —
  not the sanitized values actually persisted — for the 4 rich-text fields. Verified as
  byte-identical, already-accepted behavior in Brand Library/Persona Library/Service Library/
  Website Strategy Center's own `update()` methods, with no live exploit path (no audit-log
  viewer anywhere in `dashboard-web` renders `afterState` as HTML). Flagged because this diff is
  the one that first makes these 4 fields genuinely HTML-renderable in this module — accepted as
  the same class of tracked debt already carried by 4+ shipped sibling modules; fixing only this
  module would diverge from that established, already-accepted pattern.

No separate `security-review` skill run — the high-effort code review's own Angle B
(removed-behavior) and Altitude passes specifically probed the new sanitization boundary (write
path on both `create()`/`update()`, the length-cap interaction, the audit-trail interaction) and
found nothing beyond the one accepted-debt item above; the render side is unchanged from the
already-shipped, already-audited `SanitizedRichText` component pattern every sibling rich-text
field uses.

## Sign-off

**Required second-role human review:** Complete — via the direct "Accept as tracked debt and
gate it" instruction. The findings table above served as the review artifact rather than a
separately published Claude artifact packet, matching the light-tier precedent for a small UI
slice with one accepted-debt finding.

**Gate:** `G4-dashboard-web-workflow-and-task-template-library` approved — WebDesk Solution,
decision CONFIRM, accepting the 1 open PLAUSIBLE finding as tracked debt. See
`outputs/webdesk-growth-dashboard/project.json`'s `gates[]` (`current_gate` now
`G4-dashboard-web-workflow-and-task-template-library`).

**This gate approval does not itself authorize pushing the branch, opening a PR, or merging** —
each remains its own separate, not-yet-requested authorization, per this project's standing "no
auto-merge" rule.
