# Proposed Upstream Patches — Index

> **None of these patches are merged.** This directory exists entirely outside the base skill's tree (`webdesk-nodejs/skills/`) so that proposing a change is structurally incapable of accidentally modifying the base skill. Per the skill-build task's §16 (Base-skill protection) and §21 (forbidden actions: "do not automatically merge proposed upstream patches"), every file here is a **proposal**, reviewed and applied by a human maintainer of the base skill through its own separate process — not by this project, not automatically, not as a side effect of this skill-overlay build.

Each patch below solves a real gap this project's skill-build hit while building `webdesk-nodejs/skills/nodejs/projects/custom-app-build/profiles/webdesk-growth-dashboard/`. Every gap was worked around *locally*, inside the project profile, without waiting for or depending on any of these patches landing — the profile is fully functional today with zero upstream changes. These patches exist purely to reduce the same rediscovery cost for the *next* project that needs NestJS, Turborepo, Vercel serverless, or Google Workspace SSO, since none of that is specific to WebDesk's dashboard.

## Patches

| # | File | Topic | Reusability |
|---|---|---|---|
| 01 | `01-nestjs-adaptation-guidance.md` | Generic NestJS adaptation of the Express-shaped base examples | Generally reusable |
| 02 | `02-turborepo-support.md` | Generic Turborepo monorepo support | Generally reusable |
| 03 | `03-vercel-functions-guidance.md` | Generic Vercel Functions deployment guidance | Generally reusable |
| 04 | `04-vercel-queues-workflows-cron-guidance.md` | Generic Vercel Queues/Workflows/Cron guidance | Generally reusable |
| 05 | `05-google-workspace-oidc-guidance.md` | Generic Google Workspace OIDC guidance | Generally reusable |
| 06 | `06-github-app-integration-guidance.md` | Generic GitHub App integration guidance | Generally reusable |
| 07 | `07-wordpress-integration-guidance.md` | Generic WordPress integration guidance | Generally reusable |
| 08 | `08-smtp-adapter-guidance.md` | Generic SMTP adapter guidance | Generally reusable |
| 09 | `09-host-target-vercel-schema-addition.md` | `project-json.schema.json` — add `vercel` to `host_target` enum | Generally reusable (schema-only) |
| 10 | `10-storage-vercel-blob-schema-addition.md` | `project-json.schema.json` — add `vercel-blob` to `tech_stack.storage` enum | Generally reusable (schema-only) |
| 11 | `11-generic-project-profile-routing.md` | Generic `project_profile` auto-routing in the orchestrator (added 2026-08-05, remediation pass) | Generally reusable — but higher regression risk than 01–10; touches the session-start protocol, a path exercised by every project every session |

## How to review one of these

1. Read the patch file — each states Reason, Current Gap, Proposed Files Changed, Compatibility Impact, Regression Risk, and Reusability Scope.
2. Confirm it doesn't weaken any NODE-xxx/FG-xxx forbidden pattern or the layering discipline (none of these eleven do — they add knowledge, extend an enum, or add an optional orchestrator step; none removes or relaxes a rule).
3. Apply it to the actual base skill files (`webdesk-nodejs/skills/...`) as a normal, reviewed edit to that repository — outside the scope of this project's own work.
4. This project's profile (`webdesk-growth-dashboard`) does not need any patch applied to keep working — it already contains the equivalent guidance (or, for #11, the equivalent manual `CLAUDE.md` convention) locally. Applying a patch upstream is a convenience for future projects, not a dependency of this one.

See `docs/skill-build/proposed-upstream-patches.md` for the summary report cross-referencing these against `docs/skill-build/gap-resolution-matrix.md`.
