# Setup-Time Input Register

**Status:** Draft. Collects every unconfirmed setup-time input flagged across the 20 ADRs and 7 integration contracts into one register. None of these block Phase 0 documentation itself (which uses type-valid placeholders throughout); several do block specific Phase 1 tasks, marked below.

| Input | Blocks | Source |
|---|---|---|
| Exact Vercel Postgres Marketplace provider (must satisfy East Coast region + Neon exclusion, WDS-002) | **Phase 1 Task 3** (database package) | ADR-0007 |
| ~~Actual GitHub repository URL~~ | **Resolved 2026-08-06** — `https://github.com/WDS-Internal-DeveloperTeam/webdesk-growth-dashboard.git`, registered in `project.json` and as a local git remote (`origin`). Not yet pushed to; Phase 1 Task 1 still needs to confirm the remote repository actually exists on GitHub and configure branch protection. | ADR-0001, `project.json.project.repository` |
| Actual Vercel project IDs / topology | Phase 1 deployment tasks (10, 13) | ADR-0001 |
| GitHub App creation (App ID, private key, installation ID, target repository list) | **Phase 1 Task 1, 4** (any GitHub-dependent work) | ADR-0011 |
| Google Workspace OAuth client (client ID, authorized redirect URIs) | **Phase 1 Task 4** (authentication) | ADR-0008 |
| First-login provisioning model (JIT vs. pre-provisioned) | **Phase 1 Task 4** (authentication) — PM/client decision required | ADR-0008 |
| Emergency-administrator account list and TOTP provisioning process | Phase 1 Task 4 (can proceed without it, but must exist before G5.5) | ADR-0009 |
| WordPress Application Password accounts, per environment | Phase 1 WordPress-integration work | ADR-0012 |
| REST API (`/wp-json/`) actual availability | Phase 1 WordPress-integration work | ADR-0012, Technical Discovery document |
| WP-CLI/SSH actual provisioning and WordPress.com restrictions | Phase 1 WordPress-integration work | ADR-0013 |
| Actual SMTP credentials and dedicated sending account | Phase 1 notification work | ADR-0015 |
| Operational contacts (Security Owner, WordPress Technical Lead, infrastructure owner) | G5.5 (pre-launch) | `knowledge/11-retention-backup-and-operations.md` |
| Actual GA4/GTM/Clarity analytics IDs | Phase 1+ analytics work | Technical Discovery document |
| Upload-size threshold for Vercel Blob | Phase 4 upload-flow implementation | ADR-0014, `gap-analysis.md` item 11 |
| Future malware-scanning provider | Post-V1, explicitly deferred | ADR-0014 |
| Complete Service and SEO Library production data | Phase 3 content population | `knowledge/00-scope-and-precedence.md §6` |
| Real client timezone (currently defaulted to America/Toronto) | Non-blocking — cosmetic until confirmed | `project.json.project.timezone` |
| Exact form/Podio field mapping | Phase 1+ forms work | Technical Discovery document |
| Whether Wordfence/WPScan/UptimeRobot are actually installed/configured | G5.5 (pre-launch security verification) | ADR-0012, `docs/security/security-verification-plan.md` |
| File-integrity check (core/plugin/vendor file modifications) | Phase 5 WordPress migration work | Technical Discovery document |
| Plugin licensing/ownership | Non-blocking, operational housekeeping | Technical Discovery document |
| Jetpack version and complete plugin inventory reconfirmation | Phase 5 WordPress migration work | Technical Discovery document |
| Whether Vercel Queues/Workflows are sufficient, or the Upstash QStash fallback is needed | **Phase 1 Task 9** (background-job foundation) | ADR-0005 |
| Assigned team members (PM, Architect, Designer, Backend/Frontend/QA leads, DBA, Delivery Head) | Non-blocking for Phase 0/1 planning, needed before real staffing | `project.json.project.assigned_team` |
| Dashboard Documentation Pack availability at the Phase 0 workspace path | **Already confirmed present** as of this Phase 0 session — restored after a local file-loss incident; re-verify at the start of any future session per `docs/project-state/phase-0-approval-checklist.md`'s reviewer checklist | This session's own workspace-readiness check |

## What is explicitly NOT a Phase 0 blocker

None of the above prevented Phase 0's own documentation from being produced — every ADR/contract that references an open input uses a type-valid placeholder (`null`, a clearly-marked TBD string, or a placeholder URL) and states plainly that it is not a confirmed value. This register exists so Phase 1 knows exactly what to resolve, and in what order, rather than discovering blockers one at a time mid-implementation.
