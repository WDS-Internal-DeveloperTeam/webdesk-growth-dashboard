# `dashboard-web` Page Template Library UI — Approval Checklist

**Status:** Built, fully validated. Independent code review complete (10 findings kept in the
final report — 4 CONFIRMED and fixed, 6 PLAUSIBLE left as accepted, tracked debt). Security review
complete (0 findings above threshold). Pushed to `origin`, opened as
[PR #83](https://github.com/WDS-Internal-DeveloperTeam/webdesk-growth-dashboard/pull/83).
Awaiting required second-role human review.

## Completion condition

Every item below must be genuinely true, verified against real evidence, before a gate decision
for this slice can be requested.

| #   | Item                                       | Status                                                                                                                                                                                                                                                                                                                                                                                                                       |
| --- | ------------------------------------------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1   | Authorization to build                     | ✅ Explicit "Start the dashboard-web UI for it Page Template Library" instruction, following the backend's own build-to-production arc (PR #82)                                                                                                                                                                                                                                                                              |
| 2   | Genuine scoping confirmed                  | ✅ Mirrors Component Library's already-reviewed UI structure file-for-file; rich-text conversion for the 3 narrative fields applies the 2026-08-22 standing rule with a paired backend sanitization change, mirroring the already-reviewed Website Strategy Center/Section and Pattern Library pattern                                                                                                                       |
| 3   | Required tests pass                        | ✅ 1207/1207 `dashboard-web` unit tests (62 new: 59 from the initial build + 3 for the extracted `arrayFieldValue()` helper), 1299/1299 `dashboard-api` unit tests (2 new sanitization tests from the initial build; unchanged by the fix round, which was doc-comment-only on the backend), 572/572 `dashboard-api` e2e/integration tests (31 new), 572/572 `packages/database` integration tests, all independently re-run |
| 4   | Full validation clean                      | ✅ typecheck clean across `packages/shared-types`/`apps/dashboard-api`/`apps/dashboard-web`/`apps/dashboard-worker`; `eslint --max-warnings=0` clean; CSS-token check clean (60 files); `next build` clean, all 4 new routes present; `nest build` clean; `prettier --check` clean on all touched files                                                                                                                      |
| 5   | Independent code review complete           | ✅ This project's own `code-review` skill (high effort, 8-angle finder pass via parallel subagents, 1-vote self-verification) — 10 findings kept in the final report per the review's own cap, 4 CONFIRMED and fixed, 6 PLAUSIBLE left as accepted, tracked debt                                                                                                                                                             |
| 6   | Security review complete                   | ✅ `security-review` skill run separately, against the fixed branch — 0 findings above threshold                                                                                                                                                                                                                                                                                                                             |
| 7   | Known out-of-scope gaps flagged, not fixed | ✅ A real, previously-undiscovered bug in the already-merged Section and Pattern Library UI (PR #80) — its form wires `RichTextEditor` but its own backend cap was never raised to match — was found while verifying this branch's own doc-comment fix; flagged as a separate follow-up task, not fixed here (different module, needs its own review cycle)                                                                  |
| 8   | Live-rendered / verified                   | ✅ `next build` confirms all 4 new `/page-template-library` routes compile and are present in the route table; component/lib/form unit tests cover the RelationshipPicker/TagListField/RichTextEditor wiring and both mutation paths directly                                                                                                                                                                                |
| 9   | Documentation updated                      | ✅ `docs/implementation/module-page-template-library.md`'s new "As-built — `dashboard-web` UI" section                                                                                                                                                                                                                                                                                                                       |
| 10  | Exact branch/commit verified               | Branch `dashboard-web-page-template-library`, commits `685d4e3` (build) → `fdb4e3b` (code-review fix round) → `39e8deb` (docs) — pushed to `origin`, opened as [PR #83](https://github.com/WDS-Internal-DeveloperTeam/webdesk-growth-dashboard/pull/83)                                                                                                                                                                      |

## Forbidden-actions check

- No new backend endpoint, RBAC action, or migration — reuses the already-live, already-reviewed
  `apps/dashboard-api/src/page-template-library/*` surface, with only the sanitization wiring and
  a length-cap raise added to `create()`/`update()`.
- No new npm dependency.
- No confidential-field/redaction mechanism needed — matches the module registry's own precedent
  for this RBAC domain (no confidentiality field exists on `PageTemplateEntity`).
- The `arrayFieldValue()` extraction retrofit touched `section-and-pattern-library-form.tsx` (an
  already-shipped sibling file) — re-validated with the full `dashboard-web` unit suite afterward,
  not left unverified.
- The real bug discovered in Section and Pattern Library's own backend (stale rich-text length
  cap) was flagged as a separate task, not silently folded into or fixed by this PR.

## Independent code review — summary

Full record: this session's `ReportFindings` output, and `docs/implementation/module-page-template-library.md`'s
"As-built" section. 8-angle finder pass (line-by-line, removed-behavior, cross-file tracer,
reuse, simplification, efficiency, altitude, conventions) run via 8 parallel subagents. 10
findings kept in the final report:

**4 CONFIRMED, fixed:**

1. `arrayField()` was a byte-for-byte 2nd copy of `section-and-pattern-library-form.tsx`'s own
   helper, past this codebase's own 2-occurrence extraction threshold (already applied once to
   `richTextFieldValue()`). **Fixed**: extracted `arrayFieldValue()` into `lib/rich-text.ts`,
   retrofitted onto both consumers, 3 new regression tests.
2. The status-actions component's self-declared duplication ordinal ("8th independent hand-copy")
   was verified inaccurate — sibling files' own claimed ordinals have already drifted out of sync
   with each other (5th/6th/7th/7th claimed by 4 different files) and don't track a real count.
   **Fixed**: rewrote the comment to point at a grep command instead of asserting a number.
3. The `RICH_TEXT_MAX_LENGTH=40_000` doc comment claimed "the same 10x ratio every sibling
   module's own rich-text conversion already applies" — verified factually inaccurate (every
   other conversion actually did a 2x raise from a 20,000 starting cap; this field's 10x figure
   is an artifact of its own smaller 4,000 starting point) and cited Section and Pattern Library
   as an already-converted example when its own backend cap had not actually been raised.
   **Fixed**: corrected the comment to describe the real pattern (convergence on a 40,000-char
   ceiling, not a fixed ratio) and removed the incorrect citation.
4. (Same root cause as #3.) While verifying the fix, discovered Section and Pattern Library's own
   already-merged UI (PR #80) wires `RichTextEditor` but its backend cap was never raised — a
   real, live bug letting a user type content the backend will silently reject. **Not fixed here**
   (different module) — flagged as a separate follow-up task.

**6 PLAUSIBLE, left as accepted, tracked debt** (each already matching an established duplication
class elsewhere in this codebase, or too narrow/inherited to justify fixing in this branch):

5. The audit trail (`afterState`) logs raw, pre-sanitization HTML for the 3 rich-text fields —
   byte-identical to Website Strategy Center's/Section and Pattern Library's own already-shipped
   audit calls.
6. Three near-identical option-filtering `useMemo` blocks (required/optional sections,
   components) differing only in source array and exclusion set.
7. Selected-chip id-to-label resolution duplicated 3x across the same three relationship fields.
8. The `replacement` display value is resolved via a one-off `useState` initializer instead of a
   `useMemo` like its sibling lookups — low risk today since `props.pageTemplates` never refetches
   after mount in this page's own fetch-once pattern.
9. The create/edit empty-value sentinel ternary is independently re-derived by 3 field-type
   helpers and then inlined a 4th time for `replacementRecordId`.
10. `plainField()` is an 8th independent hand-copy of the same closure shape across 7 sibling
    forms with no shared helper — narrower fix scope (`arrayField()`, a 2nd copy) was judged
    proportionate for this branch; retrofitting `plainFieldValue()` onto all 8 already-shipped
    forms was not.

## Security review — summary

`security-review` skill run separately, against the fixed branch. **0 findings above threshold.**
Confirmed:

- All 3 write paths (`create()`, `update()`'s in-place branch, the fork branch) run sanitization
  with no gap — new unit tests explicitly prove a `<script>` payload is stripped on both create
  and fork.
- Every render site for the 3 rich-text fields (the current version and every version-history
  disclosure entry) routes exclusively through the shared, already-audited `SanitizedRichText`
  component; `phpTemplateRelationship` correctly renders as plain JSX text, never through it.
- The relationship pickers (`RelationshipPicker`/`TagListField`/`SinglePageTemplatePicker`) render
  only plain-text option labels; real enforcement is server-side
  (`assertReplacementExists()`, the `hasOverlappingSectionIds()` Zod refinement), not relied upon
  client-side alone.
- No IDOR — relationship ids surface only records already returned by the caller's own
  permission-filtered list endpoints.
- The picker-fetch functions target only a trusted, build-time API base URL plus hardcoded paths
  or a UUID-validated `recordId` — no SSRF or credential-leakage surface.
- The DTO length-cap raise (4,000→40,000) is a pure validation-bound relaxation, independent of
  and not weakening sanitization.

## Review packet

Published as a Claude artifact for the required second-role human review, since the implementing
agent cannot also be its own reviewer (ADR-0010):
[Page Template Library UI Review Packet](https://claude.ai/code/artifact/f6430b53-4c35-4973-bac3-b44872f42699).

## Sign-off

_Second-role human review pending._
