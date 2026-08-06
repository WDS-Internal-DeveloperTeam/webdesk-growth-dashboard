# Proposed Upstream Patches — Summary Report

**Status:** Updated 2026-08-05 (remediation pass — added patch 11). Summarizes `proposed-upstream-patches/` (WDS-Dashboard repo root — **outside the skill tree**, not merged, not applied). See that directory's own files for full detail; this report is the cross-reference back to what gap each patch closes.

**Reminder, restated from `proposed-upstream-patches/README.md`:** none of these eleven patches have been applied to the base skill. This project's profile does not depend on any of them landing — every gap they'd close is already closed *locally*, inside `profiles/webdesk-growth-dashboard/`. These patches are a convenience for future projects, proposed for separate human review by a base-skill maintainer.

---

| # | Patch | Closes gap | Reusability | Risk |
|---|---|---|---|---|
| 01 | NestJS adaptation guidance | `docs/skill-build/gap-resolution-matrix.md` — no row directly (architecture-validation.md §3 origin) | Generally reusable | Low |
| 02 | Turborepo monorepo support | GAP-03 (migration ownership pattern) | Generally reusable | Low-medium |
| 03 | Vercel Functions deployment guidance | GAP-15 (deployment) | Generally reusable | Low |
| 04 | Vercel Queues/Workflows/Cron guidance | GAP-04 (queue processing) | Generally reusable | Low-medium |
| 05 | Google Workspace OIDC guidance | GAP-01 (authentication) | Generally reusable (Google-specific detail generalized) | Low |
| 06 | GitHub App integration guidance | GAP-08 (Git synchronization) | Generally reusable (two-repo SHA-pairing marked as a pattern example, not universal) | Low |
| 07 | WordPress integration guidance | GAP-09 (WordPress synchronization) | Generally reusable (no-ACF stance and migration content marked project-specific) | Low |
| 08 | SMTP adapter guidance | GAP-06 note / notification delivery | Generally reusable | Low |
| 09 | `host_target` schema: add `vercel` | GAP-15 / project-overrides.md host-target row | Generally reusable | Very low |
| 10 | `tech_stack.storage` schema: add `vercel-blob` | GAP-11 (file handling) | Generally reusable | Very low |
| 11 | Generic `project_profile` auto-routing in the orchestrator | Surfaced by the 2026-08-05 external review's routing-honesty finding | Generally reusable | **Medium** — touches the session-start protocol, exercised every session by every project |

---

## Recommended review order

1. **Patches 09 and 10** first — lowest risk (single enum-value additions), highest immediate reusability, bundle into one review since they touch the same file.
2. **Patches 01, 03, 05, 08** next — new-file-only additions with a single short pointer-edit to an existing file each; low regression risk, clear generalizable value.
3. **Patches 02, 04** — slightly higher risk (edit an existing file's substantive content, not just an index/pointer); review the edited sections carefully against the existing single-repo/persistent-process guidance they sit beside.
4. **Patches 06, 07** — largest new-content patches (full new integration-module directories); most valuable for future GitHub/WordPress-integrating projects, but also the most content to review, and each carries a flagged project-specific-vs-universal distinction (the two-repo SHA rule; the no-ACF stance) that a reviewer must decide how to generalize correctly.
5. **Patch 11 last, and with the most scrutiny** — the only patch in this set that changes orchestrator *behavior* (an optional new step in session-start) rather than purely adding knowledge or extending an enum. Recommend a dry run against at least one existing non-profiled project before merging, to confirm the no-op case for projects without `project_profile` set is genuinely a no-op.

## What this report is not

Not an approval. Not a merge request. Each patch requires its own review by whoever maintains `webdesk-nodejs/skills/` as a base-skill package, through that package's own change process — entirely separate from this project's approval checklist (`docs/skill-build/approval-checklist.md`), which does not require any of these patches to be accepted.
