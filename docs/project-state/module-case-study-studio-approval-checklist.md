# Case Study Studio Module Backend — Approval Checklist

**Status:** Code review complete (9 candidates surfaced after dedup, 7 CONFIRMED and 1 PLAUSIBLE, 7
fixed and re-validated with new regression tests, 1 accepted as tracked debt matching established
precedent). Security review complete (0 findings above threshold). Required second-role human
review complete (Jitesh D, "Approved"). Gate G4-case-study-studio approved (WebDesk Solution,
CONFIRM). Push/PR and merge remain each their own separate, not-yet-requested next step.

## Completion condition

Every item below must be genuinely true, verified against real evidence, before a gate decision
for this slice can be requested.

| #   | Item                                       | Status                                                                                                                                                                                                                                                                                     |
| --- | ------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| 1   | Authorization to build                     | ✅ Explicit "start Case Study Studio" instruction — module #23 on the Recommended Module Roadmap, both real dependencies (`proof_and_claims_library`, `asset_library`) already live                                                                                                        |
| 2   | Genuine scoping decisions surfaced         | ✅ Three questions confirmed directly with the user via `AskUserQuestion` before building: full 14-stage bespoke workflow (not trimmed); claims/sources reuse Proof and Claims Library via a real relationship; a real `case_study_assets` join table for D3                               |
| 3   | Required tests pass                        | ✅ 51/51 `dashboard-api` unit tests for this module, 28/28 e2e tests for this module, 650/650 `packages/database` integration tests — all independently re-run against a real disposable PostgreSQL 17 database, not just trusted from the delegated build                                 |
| 4   | Full validation clean                      | ✅ typecheck/lint/prettier clean across `packages/database` and `apps/dashboard-api`; a full migration down/up round-trip on both new migrations (90 migrations, 0 pending); `pnpm validate:module-registry` unaffected (43 modules, 21 permission groups); `pnpm audit` 0 vulnerabilities |
| 5   | Independent code review complete           | ✅ High-effort 8-angle finder pass — 9 candidates after dedup, 7 CONFIRMED / 1 PLAUSIBLE, 7 fixed and re-validated with 4 new regression tests; 1 left as accepted, tracked debt (inherited precedent)                                                                                     |
| 6   | Security review complete                   | ✅ `security-review` skill run separately — 0 findings above threshold                                                                                                                                                                                                                     |
| 7   | Known out-of-scope gaps flagged, not fixed | ✅ The same-status no-op RBAC-check ordering (finding 8, below) is real but byte-identical to Service Library's own already-reviewed, already-gated ordering — left as accepted debt, not fixed                                                                                            |
| 8   | Documentation updated                      | ✅ `docs/implementation/module-case-study-studio.md` (combined scope + as-built, per the 2026-08-27 collapsed-template rule)                                                                                                                                                               |
| 9   | Exact branch/commit verified and recorded  | Branch `module-case-study-studio` — not yet pushed to `origin` or opened as a PR                                                                                                                                                                                                           |

## Forbidden-actions check

- No `dashboard-web` UI built — backend only, matching every prior module's own backend-first
  precedent.
- No new RBAC/permission-group migration added — reuses the already-seeded `case_studies`
  permission group verbatim.
- No hard-delete route on `case_studies` itself — matches ADR-0016's project-wide no-hard-delete
  policy (the `case_study_assets` join row itself is hard-deletable, since a join row has no
  dependent records of its own — mirroring `ClaimSourceRepository`'s own precedent).
- `@RequirePermission` is placed on every individual controller method, never at class level.
- The most severe code-review finding (a workflow-integrity bug letting a caller with `edit`+
  `approve` silently bypass the mandatory `client_approval` stage by toggling
  `clientApprovalRequired` mid-workflow) was a genuine gap caught only by independent review, not
  silently left unaddressed — fixed by excluding the field from the update schema entirely
  (create-only, immutable), not just patched around.
- The one accepted-debt finding (the same-status no-op RBAC-check ordering) was recorded
  explicitly as inherited, already-accepted precedent from Service Library's own identical shape,
  not silently dropped.
- The build agent's own report was independently re-verified in full by the orchestrating
  session before any review began — every high-risk file read directly (RBAC decorator
  placement, the full `TRANSITIONS` map against the confirmed design, both barrel exports,
  sub-resource IDOR scoping), and every reported test count re-run against a real local database
  rather than trusted at face value.

## Independent code review — summary

Full record: `docs/implementation/module-case-study-studio.md` and this session's
`ReportFindings` output. 8-angle finder pass (3 correctness angles, 3 cleanup angles, altitude,
CLAUDE.md conventions) surfaced 9 candidates after dedup; 7 CONFIRMED and 1 downgraded to
PLAUSIBLE (an inherited, already-accepted precedent):

1. **`update()` accepted `clientApprovalRequired` as an ordinary patchable field with only a
   terminal-state (`archived`) guard** — letting a caller holding both `edit` and `approve` (a
   real seeded combination: `super_admin`/`owner_growth_approver` both hold `VCERAPX`) flip the
   flag to `false` immediately before transitioning `internal_approval->scheduled`, silently
   skipping the `client_approval` stage with no `case_study_approvals` "client" decision ever
   recorded. Most severe. **Fixed**: excluded `clientApprovalRequired` from
   `updateCaseStudySchema` entirely — it is now a one-time intake decision, immutable once set.
2. **`publishedAt` was unconditionally overwritten on every `->published` transition**,
   contradicting the migration's own documented "stamp once, never overwrite" invariant — a
   republish (`unpublished->published`) would silently erase the original first-publish date.
   **Fixed**: the write now preserves the existing `publishedAt` if already set.
3. **`unpublishReason` was never cleared on any transition back to `published`**, leaving a stale
   reason on a currently-live record. **Fixed**: cleared to `null` on every `->published`
   transition.
4. **`case-study-assets.service.ts#create()` ran two independent existence checks sequentially**
   instead of via `Promise.all`. **Fixed**.
5. **The three update DTOs were hand-duplicated instead of derived via `.omit({...}).partial()`**
   from their create-schema counterparts. **Fixed**.
6. **The unique-constraint-violation catch in `create()` (both the parent and the asset
   sub-resource) hand-rolled `error.name === "SequelizeUniqueConstraintError"`** instead of the
   shared `isSequelizeUniqueConstraintError()` helper `@webdesk/validation` already exports.
   **Fixed**.
7. **The `TRANSITIONS` map was keyed by plain, untyped template strings** with no compile-time
   connection to the real `CaseStudyStatus` union — a typo'd key would have compiled cleanly and
   silently made that transition permanently unreachable. **Fixed**: introduced a
   `` `${CaseStudyStatus}->${CaseStudyStatus}` `` template-literal key type.
8. **`changeStatus()`'s same-status no-op early-return happens before the per-transition RBAC
   action check runs**, letting a `view`-only caller get a 200 on a same-status re-request with no
   authorization check. **Left as accepted, tracked debt** — independently verified as
   byte-identical to `ServicesService.changeApprovalStatus()`'s own already-reviewed,
   already-gated ordering; not a risk newly introduced by this branch.

Re-validated after the fix round: `tsc --noEmit`/`eslint --max-warnings=0`/`prettier --check`
clean, 51/51 `dashboard-api` unit tests for this module, 28/28 e2e tests for this module, 650/650
`packages/database` integration tests, `pnpm audit` 0 vulnerabilities.

## Security review — summary

`security-review` skill run separately from the code review, against the fixed branch — **0
findings above threshold**. Confirmed: every repository query is parameterized; every
`@RequirePermission` decorator is method-level; both sub-resource repositories scope
`update()`/`remove()` by the compound `{id, caseStudyId}`; `existingAssetIds()`/
`existingClaimIds()` expose only a bare `Set<string>` of ids; `consentEvidenceReference` is
validated via `safeHttpUrlSchema`; no DTO accepts a server-governed field; rich-text fields are
sanitized on every write path.

A review packet was published as a Claude artifact — code review + security review findings,
fixes, and validation evidence, with a decision section — for the required second-role human
review, since the implementing agent cannot also be its own reviewer (ADR-0010). See
[Case Study Studio Review Packet](https://claude.ai/code/artifact/c06a6f5c-f161-4876-8230-37bfadf0efe2).

## Sign-off

**Required second-role human review complete** — Jitesh D reviewed the packet and returned
**"Approved,"** no disputes raised. The 1 open PLAUSIBLE finding (the same-status no-op
RBAC-check ordering, inherited from Service Library's own already-accepted precedent) was
accepted as tracked debt.

**The gate (G4-case-study-studio) was then separately requested and approved** — WebDesk
Solution, decision **CONFIRM** (a clean pass, not an override, since the second-role review was
already complete before the gate was requested), on branch `module-case-study-studio` (base
`main@103c532`, not yet pushed to `origin`) — see
`outputs/webdesk-growth-dashboard/project.json`'s `gates[]` (`current_gate` now
`G4-case-study-studio`).

**This gate approval does not itself authorize pushing the branch, opening a PR, or merging** —
each remains its own separate, not-yet-requested authorization, per this project's standing
"no auto-merge" rule.
