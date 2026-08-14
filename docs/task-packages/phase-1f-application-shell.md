# Task Package — Phase 1F: Application Shell, Canonical 43-Module Registry, Navigation, Observability & Staging Foundation

**Authorization:** Full authorization brief received 2026-08-13 ("WebDesk Growth Dashboard — Phase
1F Application Shell, Module Registry, Observability & Staging Foundation"), 49 numbered sections.
Scope is explicitly limited to: dashboard application shell, canonical 43-module registry,
permission-aware navigation, shared UI states, dashboard design-system foundation, observability,
CI completion for the shell, preview/staging deployment foundation, feature-module registration
architecture, and the module-implementation roadmap (planning document only). **Does not authorize
implementation of the business functionality of any of the 43 modules** — shell routes/registry
records are not feature implementation. Wave 1 (or any module wave) must not begin automatically.
This document is the internal task package formalizing that brief, per this project's standing
pattern of writing one before implementation begins (see every prior phase's own
`docs/task-packages/phase-1*.md`).

## Approved Phase 1E remote commit SHA

The authorization brief's own SHA field was left as a placeholder
(`<INSERT APPROVED PHASE 1E REMOTE SHA>`). Filled in here after independent verification against
`outputs/webdesk-growth-dashboard/project.json`'s `gates[]` (authoritative) and real git history,
not assumed from the brief:

**`6ae8a36116f70ed0f4d429af12774e05b2092e70`** — PR #22 merge commit, the exact commit the G4-1E
gate approved (see `project.json`'s `gates[]`, entry `G4-1E`, and
`docs/project-state/phase-1e-approval-checklist.md`'s "Sign-off" section).

Verified 2026-08-13: `git merge-base --is-ancestor 6ae8a36116f70ed0f4d429af12774e05b2092e70 HEAD`
confirms this SHA is an ancestor of `main`'s current HEAD (`dc94d9111fc7321ed2a717925676cdf5044a5227`
at branch-creation time); `git diff 6ae8a36...HEAD --name-only` shows only 6 documentation files
changed since (`CLAUDE.md`, both Phase 1E docs, the threat-model doc, `HANDOFF.md`,
`project.json`) — recording the G4-1E gate decision itself. **Zero application code has changed
since the approved commit.** The `phase-1f-application-shell` branch was created from `main`'s
current HEAD, which is code-identical to the approved SHA.

## Required context — read in precedence order

Per the brief's own §1, in this order: `CLAUDE.md`, `outputs/webdesk-growth-dashboard/project.json`,
`outputs/webdesk-growth-dashboard/HANDOFF.md`,
`webdesk-dashboard-documentation-v1/01_Dashboard_Master_Specification.md`,
`webdesk-dashboard-documentation-v1/02_Version_1_Module_Inclusion_Matrix.md`,
`webdesk-dashboard-documentation-v1/03_Detailed_Module_Specifications.md`,
`webdesk-dashboard-documentation-v1/06_Roles_and_Permissions.md`,
`webdesk-dashboard-documentation-v1/07_Low_Fidelity_Wireframes.md`, relevant workflow/state-machine
specs, approved Phase 0 ADRs/contracts, approved Phase 1A–1E validation reports/approval checklists,
`docs/phase-plans/phase-1-foundation-plan.md`, the WebDesk Growth Dashboard project profile, the
WebDesk Node.js base skill. The first three were already current in-session; the module/wireframe
docs are read via dedicated research passes given their size (see "Module registry data source"
below) rather than loaded wholesale into every working turn, consistent with this project's
standing context-budget discipline (`_spine/shared-knowledge/context-budget.md`).

## Conflict recorded — original Foundation Plan Tasks 8/10/11/12/13 vs. this brief

Per the brief's own §1 instruction ("If approved documents disagree: follow project precedence
rules, record the conflict, do not silently invent a resolution"), and following the exact
precedent already set in `docs/phase-plans/phase-1-foundation-plan.md`'s own 2026-08-13 addendum
for Tasks 7 and 9 (a later, more detailed authorization brief superseding the original plan's
task-by-task granularity):

- **Task 10 ("Basic dashboard shell")** originally specified "a single real page (e.g., a project
  list) calling `dashboard-api`" with **real, data-backed** project data as its acceptance
  criterion. This Phase 1F brief explicitly restricts Projects business functionality (§11, §47) to
  "a minimal project-context selector/foundation... if required for shell operation" — no real
  Project CRUD or list. **Resolution: this brief supersedes Task 10's specific acceptance
  criterion.** The application shell will not present a real, data-backed project list; the
  project-context foundation will be minimal (active project ID/name/availability/access check
  only), matching the later, more specific authorization.
- **Task 8 ("Project and user foundations")** — full Project/User CRUD — remains **not**
  authorized by this brief. Only the minimal project-context read/validation slice described above
  is in scope here.
- **Tasks 11 (health/observability), 12 (CI validation), 13 (staging deployment foundation)** are
  each expanded substantially by this brief's §19–§32 (structured logging with redaction, Sentry,
  correlation IDs, a much longer CI checklist, explicit environment-isolation and staging-smoke-test
  requirements). Following the same precedent, **this brief supersedes and absorbs Tasks 11–13's
  original scope** rather than being layered on top of it as a separate later task.
- No other conflicts found between this brief and Phase 0 ADRs, Phase 1A–1E approvals, or the
  project profile.

## Pre-implementation verification (brief §2) — completed 2026-08-13, before any code changed

| Check                                                      | Result                                                                                                                                                                                                                                                                                                                        |
| ---------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Phase 1E formally approved                                 | ✅ G4-1E, CONFIRM, WebDesk Solution, 2026-08-13                                                                                                                                                                                                                                                                               |
| Branch starts from exact approved SHA                      | ✅ confirmed via `git merge-base --is-ancestor`, zero code drift                                                                                                                                                                                                                                                              |
| Authentication works                                       | ✅ proven by passing auth unit/e2e suites (below)                                                                                                                                                                                                                                                                             |
| Session management works                                   | ✅ proven by passing session tests                                                                                                                                                                                                                                                                                            |
| RBAC works                                                 | ✅ proven by passing `authz` unit/e2e suites                                                                                                                                                                                                                                                                                  |
| Confidential-field controls work                           | ✅ `confidential-field.util.spec.ts` + authz e2e passing                                                                                                                                                                                                                                                                      |
| Audit persistence works                                    | ✅ `audit.service.spec.ts` + database integration tests passing                                                                                                                                                                                                                                                               |
| Operational job foundation works                           | ✅ `idempotency.service.spec.ts` + jobs migrations/tests passing                                                                                                                                                                                                                                                              |
| Notification-record foundation works                       | ✅ notification unit + e2e tests passing                                                                                                                                                                                                                                                                                      |
| Retention/hold foundation works                            | ✅ retention unit tests passing                                                                                                                                                                                                                                                                                               |
| Existing database migrations pass                          | ✅ all 33 migrations, clean apply, on a fresh disposable database                                                                                                                                                                                                                                                             |
| Existing automated tests pass                              | ✅ 279/279 unit + 108/108 database integration + 72/72 e2e (459 total)                                                                                                                                                                                                                                                        |
| No Critical/High unresolved security issue blocks Phase 1F | ✅ Phase 1E threat model: 8/10 findings fixed, 2 accepted as tracked debt by explicit low-severity decision (retention-hold approver verification, `projectId` query-filter scoping) — neither Critical/High, neither touches shell/navigation/observability surface                                                          |
| `pnpm audit`                                               | ✅ 0 vulnerabilities                                                                                                                                                                                                                                                                                                          |
| Secret-pattern scan                                        | ✅ clean, 485 tracked files                                                                                                                                                                                                                                                                                                   |
| Production build                                           | ✅ 9/9 packages build clean, including `dashboard-web`/`dashboard-api`                                                                                                                                                                                                                                                        |
| Staging configuration can remain isolated from production  | Architectural precondition, not yet tested live — no staging environment is provisioned yet (see "Staging" below). Design commitment: separate env vars/credentials per environment, no shared secrets, per brief §30 — verified structurally as Phase 1F's staging-foundation work proceeds, not asserted as already proven. |

**Result: no blocking gap found. Phase 1F is cleared to proceed** on the scope below.

## Module registry data source

The 43-module list, navigation groupings, and permission-group mappings are extracted from
`webdesk-dashboard-documentation-v1/01_Dashboard_Master_Specification.md`,
`02_Version_1_Module_Inclusion_Matrix.md`, `03_Detailed_Module_Specifications.md`, cross-referenced
against the already-seeded permission-group registry from migrations `00014`/`00015`
(`packages/database/src/migrations/`) — the 21 permission groups are authorization boundaries only
and must not be collapsed into or confused with the 43 product modules (brief §3). Role list and
per-role navigation expectations come from `06_Roles_and_Permissions.md`. Application-shell layout
comes from `07_Low_Fidelity_Wireframes.md`. See `docs/implementation/phase-1f-module-registry.md`
(to be written) for the full extracted table and its exact source citations.

## Scope of this task package (condensed from the brief's 49 sections — see the brief itself,

## recorded verbatim in this session's transcript, as the authoritative full text)

1. **Canonical 43-module registry** — one machine-readable source of truth (packages/database-backed
   or a shared config package consumed by both `dashboard-web` and `dashboard-api`, not two
   competing registries), stable machine IDs, the full field list from brief §5, controlled
   implementation-status vocabulary (§6), Version 1 inclusion status distinct from implementation
   status (§7), automated registry validation (§26) and permission-mapping validation (§27).
2. **Application shell** (`dashboard-web`) — authenticated frame, primary/secondary navigation,
   header, project context, breadcrumbs, page-title/contextual-actions/status areas, notification
   entry point, help entry point, responsive behavior — built from approved wireframes, neutral
   foundations where visual detail isn't yet approved (§8).
3. **Registry-driven, permission-aware navigation** — derives from the registry + inclusion status +
   effective capabilities (via the Phase 1D/1D-expanded `AuthorizationService`) + project context;
   backend route authorization remains authoritative regardless of what navigation shows (§9, §10).
4. **Minimal project-context foundation** — active project id/name/availability/access check only,
   not full Projects CRUD (§11; see "Conflict recorded" above).
5. **Feature-module registration pattern** — a reusable way for a future module to declare metadata/
   route/permissions/navigation/help/status/dependencies without editing shared shell files (§12).
6. **Controlled placeholders** for not-yet-built Version 1 modules — true status only, no fake
   CRUD/analytics/AI/scan/approval/data-table/integration/automation UI (§13).
7. **Shared page-shell components + shared UI states** (loading/empty/error/forbidden/not-found/
   not-configured/degraded/blocked) reusable by future modules (§14, §15).
8. **Isolated dashboard design-system foundation** — tokens only (typography, spacing, layout,
   borders, radius, shadow, focus, status, control sizing, breakpoints, z-index, motion); no
   WordPress CSS/SCSS import; not the full website Design Token Library module (§16).
9. **Accessibility** — WCAG 2.2 AA target, both automated (Axe) and manual verification (§17).
10. **Responsive behavior** across desktop/laptop/tablet/mobile, dashboard's own breakpoints (§18).
11. **Observability** — Pino structured logging with redaction, Sentry per-environment config,
    correlation/request IDs, safe error context, environment/version metadata (§19–§22).
12. **System-health shell integration** — consumes the existing Phase 1E system-health foundation
    only; does not build the full Audit Logs & System Health module (§23).
13. **Build/release metadata** — version, commit SHA, build timestamp, environment, deployment ID,
    safe to expose (§24).
14. **CI foundation completion** — the fuller checklist in §25, including module-registry and
    permission-mapping validation, no auto production deploy.
15. **Staging environment foundation** — use existing approved Vercel projects if present; stop at
    the provisioning boundary and document what's missing rather than inventing resources (§29–§32).
16. **Dashboard home** — shell-level landing only, no fabricated business data (§34).
17. **Help and notification shell foundations** — reference-only / real-record-only, no content
    authoring, no SMTP delivery, no fabricated data (§35, §36).
18. **Module implementation roadmap** (`docs/phase-plans/module-implementation-roadmap.md`) and the
    **module task-package template**
    (`docs/task-packages/templates/module-implementation-task-template.md`) — planning artifacts
    only, produced but not executed (§42–§44).
19. **Required documentation set** (§41) — validation report, approval checklist, and the 9
    `docs/implementation/phase-1f-*.md` documents, plus updates to `HANDOFF.md`, the traceability
    matrix, the foundation plan, and the setup-input register.

## Explicitly out of scope

Business functionality of any of the 43 modules (brief §47 lists them by name); full Projects/Users
CRUD beyond the minimal context foundation; real SMTP/GitHub/WordPress/Blob-business/Queues/
Workflows/Cron/analytics integrations beyond what's already authorized; production deployment;
automatic PR merge; Wave 1 or any module wave starting automatically (§33, §48).

## Git workflow

Dedicated branch `phase-1f-application-shell`, created from `main` at
`dc94d9111fc7321ed2a717925676cdf5044a5227` (code-identical to the approved
`6ae8a36116f70ed0f4d429af12774e05b2092e70`). No direct push to `main`. Full validation suite,
documentation, and this task package's completion checklist run before any PR is opened, per the
brief's own §46. No auto-merge, no production deploy.
