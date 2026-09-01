# Case Study Studio `dashboard-web` UI — Approval Checklist

**Status:** Code review complete (8 candidates surfaced, medium effort, 8-angle finder pass — 4
CONFIRMED/PLAUSIBLE and fixed with re-validation, 4 accepted as tracked debt matching established
precedent elsewhere in this app). Security spot-check complete (no new endpoint or sink; not a
full separate skill run, per the 2026-08-27 review-pipeline right-sizing standing rule). Required
second-role human review complete (Jitesh D, "Approved"). Gate
`G4-dashboard-web-case-study-studio` approved (WebDesk Solution, CONFIRM). Push/PR complete
([PR #90](https://github.com/WDS-Internal-DeveloperTeam/webdesk-growth-dashboard/pull/90), all 14
CI checks green). Merge remains its own separate, not-yet-requested next step.

## Completion condition

Every item below must be genuinely true, verified against real evidence, before a gate decision
for this slice can be requested.

| #   | Item                                       | Status                                                                                                                                                                                                                                 |
| --- | ------------------------------------------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1   | Authorization to build                     | ✅ Explicit "Start the dashboard-web UI for it" instruction, following the backend's own build (this same branch, gated under `G4-case-study-studio`)                                                                                  |
| 2   | Structural template confirmed              | ✅ Mirrors Proof and Claims Library's UI structure (relationship pickers, sub-resource CRUD, status actions), read in full before building, per the build agent's own instructions                                                     |
| 3   | Required tests pass                        | ✅ 108/108 test files, 1358/1358 `dashboard-web` unit tests passing (4 new) — independently re-run by the orchestrating session after every fix, not just trusted from the build agent's own report                                    |
| 4   | Full validation clean                      | ✅ typecheck (`dashboard-web`/`dashboard-api`/`dashboard-worker`), `eslint --max-warnings=0`, CSS-token check (69 files), `next build` (all 4 new routes present), `prettier --check` — all independently re-run                       |
| 5   | Independent code review complete           | ✅ Medium effort, 8-angle finder pass — 8 candidates, 4 fixed and re-validated, 4 accepted as tracked debt                                                                                                                             |
| 6   | Security review complete                   | ✅ Spot-check (frontend-only slice, no new endpoint/sink) — confirmed the sole `dangerouslySetInnerHTML` routes through `SanitizedRichText`, and `consentEvidenceReference` is guarded by `isSafeHttpUrl()` before rendering as a link |
| 7   | Known out-of-scope gaps flagged, not fixed | ✅ 4 tracked-debt findings recorded below, each matching an already-accepted pattern elsewhere in this app, not silently dropped                                                                                                       |
| 8   | Documentation updated                      | ✅ This checklist; `outputs/webdesk-growth-dashboard/project.json`'s `gates[]`/`audit_log`                                                                                                                                             |
| 9   | Exact branch/commit verified and recorded  | ✅ Commit `4506bf7` on branch `module-case-study-studio`, pushed to `origin`, [PR #90](https://github.com/WDS-Internal-DeveloperTeam/webdesk-growth-dashboard/pull/90), all 14 CI checks green                                         |

## Forbidden-actions check

- No backend files touched — the `dashboard-web` UI consumes the already-gated backend on this
  same branch (`G4-case-study-studio`) without modification.
- No new endpoint, no new RBAC decorator, no new sink — every mutation posts to an
  already-reviewed, already-gated backend route; the UI's own gating (hiding the Edit link on an
  archived record, disabling buttons mid-transition) is convenience only, never enforcement.
- The status-actions component's 14-state transition table was byte-verified against the real
  backend `TRANSITIONS` map in `case-studies.service.ts` before being trusted, not assumed from
  the design doc alone.
- The crash bug (unguarded `getUser()` on the edit page) was a genuine gap caught only by
  independent review, not silently left unaddressed — fixed with a real regression test proving
  the page no longer crashes when the lookup rejects.
- Every accepted-debt finding was recorded explicitly as inherited, already-accepted precedent
  from a named sibling component/module, not silently dropped.
- The build agent's own report was independently re-verified in full by the orchestrating session
  before any review began — every fix re-validated with real command output, not trusted at face
  value.

## Independent code review — summary

Full record: `docs/implementation/module-case-study-studio.md` and this session's
`ReportFindings` output. Medium effort, 8-angle finder pass (3 correctness angles, 3 cleanup
angles, altitude, CLAUDE.md conventions) surfaced 8 candidates:

1. **Unguarded `getUser()` call crashed the edit page** for any role lacking `users_roles:view`
   (`GET /users/:userId` requires it, held by only 2 of 7 seeded roles) — confirmed independently
   by 3 of the 8 finder angles. Most severe. **Fixed**: wrapped in try/catch, mirroring
   `ProjectForm`'s own edit-page guard; a new regression test asserts the page still renders when
   the lookup rejects.
2. **`toDateTimeLocalValue()`/`fromDateTimeLocalValue()` duplicated byte-for-byte** across
   `case-study-studio-form.tsx` and `case-study-consents-section.tsx`. **Fixed**: extracted into a
   new `lib/datetime-local.ts`.
3. **Detail-page id→name resolution hand-rolled** instead of using the existing
   `lib/resolve-ids-to-names.ts`, whose own doc comment instructs new detail pages to use it
   instead. **Fixed**.
4. **Case study fetch not run concurrently with picker fetches** on the edit page, adding a full
   round-trip to every load. **Fixed**: combined into one `Promise.all`.
5. **A stale, disabled reviewer id can block unrelated edit saves** — real, but the identical
   shape already exists in `ProjectForm`'s/`InternalLinkForm`'s own owner/approver fields. **Left
   as accepted, tracked debt.**
6. **Add/edit asset fields duplicated instead of a shared component** (unlike the sibling
   consents section's `ConsentFields`). **Left as accepted, tracked debt** — a moderate refactor
   out of proportion for this review pass.
7. **Resync `useEffect` duplicated across two sub-resource sections.** **Left as accepted, tracked
   debt** — a 3rd occurrence of an already-accepted duplication class elsewhere in this app.
8. **`router.refresh()` fires on every status transition**, not just ones that touch the Approval
   History sub-resource. **Left as accepted, tracked debt** — the same inherited pattern this
   codebase's other status-actions components already carry.

Re-validated after the fix round: typecheck/`eslint --max-warnings=0`/CSS-token-check/`next
build`/`prettier --check` all clean, 108/108 test files, 1358/1358 `dashboard-web` unit tests
passing.

## Security review — summary

Spot-check, not a full separate `security-review` skill run, per the 2026-08-27 "right-size the
review pipeline" standing rule — a small, frontend-only UI slice consuming an already-reviewed,
already-gated backend with no new endpoint or sink. Confirmed: the only `dangerouslySetInnerHTML`
in the diff routes through the existing, already-audited `SanitizedRichText` component;
`consentEvidenceReference` is guarded by `isSafeHttpUrl()` client-side before ever rendering as a
link, on top of the backend's own `safeHttpUrlSchema`; and every mutation posts to an
already-gated backend route with no new authorization logic in this diff.

A review packet (published as a Claude artifact, "Case Study Studio UI Review Packet" — code
review findings, fixes, and validation evidence, with a decision section) was prepared for the
required second-role human review, since the implementing agent cannot also be its own reviewer
(ADR-0010). See
[Case Study Studio UI Review Packet](https://claude.ai/code/artifact/03d18bbe-a6d8-466c-bd7c-8ddac76e434a).

## Sign-off

**Required second-role human review complete** — Jitesh D reviewed the packet and returned
**"Approved,"** no disputes raised. The 4 open findings (a stale-reviewer edge case, add/edit
field duplication, a duplicated resync effect, and unconditional `router.refresh()`) were
accepted as tracked debt.

**The gate (`G4-dashboard-web-case-study-studio`) was then separately requested and approved** —
WebDesk Solution, decision **CONFIRM** (a clean pass, not an override, since the second-role
review was already complete before the gate was requested), approved commit `4506bf7` on branch
`module-case-study-studio` — see `outputs/webdesk-growth-dashboard/project.json`'s `gates[]`
(`current_gate` now `G4-dashboard-web-case-study-studio`).

**This gate approval does not itself authorize merging PR #90 or a production deployment** —
merge remains its own separate, not-yet-requested authorization, per this project's standing
"no auto-merge" rule.
