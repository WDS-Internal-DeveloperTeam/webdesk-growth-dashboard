# `dashboard-web` Proof and Claims Library UI — Approval Checklist

**Status:** Built. Independent code review complete (8 candidates verified after dedup, 7
CONFIRMED + 1 PLAUSIBLE, 6 fixed and 2 accepted as tracked debt). Security review complete (0
findings above threshold). Required second-role human review complete — **Jitesh D**, decision
**"Approved"**, 2026-08-23, accepting the 2 open findings as tracked debt. Branch pushed and
[PR #54](https://github.com/WDS-Internal-DeveloperTeam/webdesk-growth-dashboard/pull/54) opened,
all 14 CI checks green. **The gate (`G4-dashboard-web-proof-and-claims-library`) was then
separately requested and approved** — WebDesk Solution, decision CONFIRM (clean pass, not an
override, since the second-role review was already complete before the gate was requested),
approved commit `0361c1e` on branch `dashboard-web-proof-and-claims-library`. **This gate approval
does not itself authorize merging PR #54 or a production deployment** — merge remains its own
separate, not-yet-requested authorization, per this project's standing "no auto-merge" rule.

## Completion condition

Every item below must be genuinely true, verified against real evidence, before a gate decision
for this slice can be requested.

| #   | Item                                       | Status                                                                                                                                                                                                                                                                                            |
| --- | ------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1   | Authorization to build                     | ✅ Explicit "Start the dashboard-web UI for it" instruction, following the Proof and Claims Library backend's own build-to-production arc (PR #53)                                                                                                                                                |
| 2   | Genuine scoping confirmed                  | ✅ No approved wireframe/screen spec exists for this module — built to `04_Data_Model_and_Ownership.md:119-120`'s own field grouping, matching the Projects/BKC/Service Library/Persona Library list/detail/form pages' own precedent for an unsourced screen                                     |
| 3   | Required tests pass                        | ✅ 423/423 `dashboard-web` unit tests (53 new); 49/49 `dashboard-api` unit tests in this module (1 new); 23/23 `dashboard-api` e2e tests (real disposable database)                                                                                                                               |
| 4   | Full validation clean                      | ✅ typecheck/lint/`check-css-tokens.mjs`/`next build`/`nest build`/prettier all clean across `packages/shared-types`, `dashboard-web`, and `dashboard-api`                                                                                                                                        |
| 5   | Independent code review complete           | ✅ This project's own `code-review` skill (8-angle finder pass via parallel subagents, 1-vote self-verification) — 8 candidates after dedup (7 CONFIRMED, 1 PLAUSIBLE), 6 fixed and re-validated with a new regression test; 2 left as accepted, tracked debt                                     |
| 6   | Security review complete                   | ✅ `security-review` skill run separately — 0 findings above threshold                                                                                                                                                                                                                            |
| 7   | Known out-of-scope gaps flagged, not fixed | ✅ The `update()` exception-ordering race (finding 07) and the 5th independent status-transitions-table copy (finding 08) are both real but left as accepted debt, recorded directly in code for the second-role reviewer                                                                         |
| 8   | Standing rich-text rule applied correctly  | ✅ `claim`/`approvedWording`/`restrictions` converted to `RichTextEditor` with real backend sanitization (write-time + render-time); `claim_sources.source` deliberately stays plain text, now with its own dedicated, decoupled max-length constant making that reading unambiguous (finding 03) |
| 9   | Documentation updated                      | ✅ This checklist and `CLAUDE.md`'s Active tasks/Recent decisions entries                                                                                                                                                                                                                         |
| 10  | Exact branch/commit verified and recorded  | ✅ Branch `dashboard-web-proof-and-claims-library`, latest commit `551e0af` — pushed to `origin`, [PR #54](https://github.com/WDS-Internal-DeveloperTeam/webdesk-growth-dashboard/pull/54) opened                                                                                                 |

## Forbidden-actions check

- No new RBAC/permission-group migration added — reuses the already-seeded
  `service_persona_proof` permission group verbatim (matching the backend's own precedent).
- No hard-delete route or UI for the parent `proof_claims` entity — matches ADR-0016's
  project-wide no-hard-delete policy. `claim_sources` (a genuine sub-resource, not the primary
  entity) does support real deletion via `POST .../:id/delete`, matching the backend's own
  already-reviewed contract.
- `approvalStatus` is never a form field — only the dedicated `ProofClaimStatusActions` component
  (via `POST .../:id/status`) may change it, matching `updateProofClaimSchema`'s own contract.
- The `LONG_TEXT_MAX_LENGTH`/`RichTextEditor` scope question for `claim_sources.source` was
  surfaced explicitly during code review (a real candidate violation of the 2026-08-22 standing
  rich-text rule) and resolved with a real code change (a dedicated, decoupled constant), not
  argued away with a comment alone.
- Both accepted-debt findings were recorded explicitly in code (`claims.service.ts`'s own doc
  comment on the `update()` pre-fetch; `proof-claim-status-actions.tsx`'s own doc comment), not
  silently dropped.
- No backend RBAC/route file was touched by this branch — `claims.controller.ts`/
  `claim-sources.controller.ts` are unmodified, confirmed via `git log`/`git diff` during the
  security review.

## Independent code review — summary

Full record: this session's `ReportFindings` output. 8-angle finder pass (correctness ×3,
cleanup/reuse/simplification/efficiency, altitude, CLAUDE.md conventions) surfaced 8 candidates
after dedup (7 CONFIRMED, 1 PLAUSIBLE):

1. **`VERIFICATION_STATUS_LABEL` was hand-typed independently in the list page, detail page (with
   a weaker `Record<string, string>` type, losing exhaustiveness checking), and the create/edit
   form** — 2 finder angles independently converged on this. **Fixed**: extracted into
   `lib/proof-and-claims-library-query.ts` alongside the existing `APPROVAL_STATUS_LABEL`,
   imported by all three consumers.
2. **`tolerateDiscard()` was redeclared privately** even though the identical function is already
   exported from `lib/business-knowledge.ts` for exactly this reuse — the 3rd independent copy
   across `lib/projects.ts`, `lib/business-knowledge.ts`, and this new file. 2 finder angles
   independently converged on this too. **Fixed**: now imports it instead.
3. **`claim_sources.source` shared the parent module's rich-text-sized `LONG_TEXT_MAX_LENGTH`
   constant (40,000)**, silently widening `source`'s own validation ceiling as a byproduct, and
   making it genuinely ambiguous whether this brand-new long-text field should have used
   `RichTextEditor` per the 2026-08-22 standing rule. **Fixed**: gave `source` its own dedicated
   `CLAIM_SOURCE_MAX_LENGTH` (2,000 chars) on both backend and frontend, decoupling it from the
   rich-text constant.
4. **The `expiryReviewDate` ternary in the submit handler hand-reimplemented the omit-vs-null
   nullish contract already encoded in the same function's `textField()` helper.** **Fixed**: now
   calls `textField(expiryReviewDate)` directly.
5. **`sanitizeRequiredRichTextIfChanged()` hand-copied `sanitizeNullableRichTextIfChanged()`'s
   branching logic instead of delegating to it with a type-narrowing cast**, even though the two
   produce identical output for `claim`'s actual input domain. **Fixed**: now a one-line
   delegation.
6. **No test proved `restrictions` actually gets sanitized on create with real dirty HTML** — the
   existing test only proved a tag is stripped from `claim`/`approvedWording`, and only proved
   `restrictions` passes through unchanged when explicitly `null`. **Fixed**: added a dedicated
   test.
7. **`claims.service.ts`'s `update()` pre-fetch runs `findById(id)` and
   `assertServiceIdsExist()` concurrently via `Promise.all`** — if the id is missing and
   `relatedServiceIds` is also invalid, the caller gets whichever exception settles first rather
   than deterministically the 404. **Accepted, tracked debt** — real, but inherited from
   `PersonasService.update()`'s/`ServicesService.update()`'s own identical, already-shipped
   shape; recorded directly in code.
8. **`ProofClaimStatusActions`'s `ALLOWED_TRANSITIONS`/`ACTION_LABEL` is now the 5th independent
   hand-copy of the backend's transition table.** **Accepted, tracked debt** — already
   self-flagged in the component's own doc comment; a real fix (the backend's `GET` response
   computing legal next transitions) is a larger architectural change out of scope here.

1 new regression test added (the `restrictions`-on-create sanitization coverage gap).

## Independent security review — summary

Full record: this session's transcript. Focused specifically on whether this diff's usage of the
already-vetted RichTextEditor + write-time + render-time sanitization pattern deviates from that
pattern, plus the new `claim_sources` sub-resource's own validation/authorization/IDOR surface.
**0 findings above threshold.** Confirmed:

- `sourceUrl` still goes through `safeHttpUrlSchema` server-side and `isSafeHttpUrl()`
  client-side before ever rendering as a clickable link; the new `CLAIM_SOURCE_MAX_LENGTH` change
  tightens validation, not weakens it.
- `claims.controller.ts`/`claim-sources.controller.ts` (the actual route/RBAC decorators) are
  outside this diff and unmodified — every route retains its original decorators.
- Zero `dangerouslySetInnerHTML` occurrences in this diff — rich-text fields render exclusively
  through the existing, unmodified `SanitizedRichText` component.
- Write-side sanitization correctly overrides the raw spread in both `create()` and `update()`.
- This module has no confidentiality field by design; the new shared types are a straightforward
  1:1 mirror with no redaction-signal fields to get wrong.
- `claim_sources` IDOR scoping (`(id, claimId)`) is unchanged and unmodified by this diff.

## Required second-role human review — COMPLETE

- [x] Code-review findings (8 kept — 7 CONFIRMED (6 fixed, 1 accepted as debt) + 1 PLAUSIBLE
      (accepted as debt)) — reviewed by: **Jitesh D**, 2026-08-23, **Approved**, accepting the 2
      open findings (07–08) as tracked debt.
- [x] Security-review findings (0 above threshold) — reviewed by: **Jitesh D**, 2026-08-23,
      **Approved**.

Review packet: published as a Claude Artifact —
[Proof and Claims Library UI Review Packet](https://claude.ai/code/artifact/5eb99c71-3bd4-41fa-9140-e443cd1320d1).

## Sign-off

Required second-role human review complete — **Jitesh D**, decision **"Approved"**, 2026-08-23,
accepting the 2 open findings (the `update()` exception-ordering race and the 5th independent
status-transitions-table copy) as tracked debt. No disputes raised.

**The gate (`G4-dashboard-web-proof-and-claims-library`) was then separately requested and
approved** — WebDesk Solution, decision **CONFIRM** (a clean pass, not an override, since the
second-role review was already complete before the gate was requested), approved commit
`0361c1e` on branch `dashboard-web-proof-and-claims-library` — recorded in
`outputs/webdesk-growth-dashboard/project.json`'s `gates[]` (`current_gate` now
`G4-dashboard-web-proof-and-claims-library`).

**This gate approval does not itself authorize merging PR #54 or a production deployment** —
merge remains its own separate, not-yet-requested authorization, per this project's standing
"no auto-merge" rule.
