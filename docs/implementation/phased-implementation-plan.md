# Phased Implementation Plan — WebDesk Website Growth Dashboard

**Status:** Draft for review. No scaffolding, migrations, or code implied by this plan has been executed. This is a planning artifact only, produced to support the G1/G1.5 planning gates in the WebDesk Node.js Delivery System — it is not itself an approval to start Phase 0.
**Companion documents:** `node-skill-compatibility-review.md`, `requirements-traceability-matrix.md`, `architecture-validation.md`, `gap-analysis.md`, `open-questions.md`.

## Sequencing principles

1. **Follows the skill's gate order**, not the dashboard's module-number order: `Discovery(G0.5) → G0 → G1 → G1.5 → G-Contracts → G-Schema → G2 → G3 → G4×n (per phase) → G5 → G5.5 → G6 → M6`.
2. **Governance/workflow backbone before content modules.** Nearly every P0 module (`02_Version_1_Module_Inclusion_Matrix.md`) depends on Users/Roles/Permissions, the generic workflow-state-machine engine, and the audit log existing first — building content libraries before the backbone would mean rebuilding their approval/audit wiring later.
3. **Integrations are gated, not incidental.** GitHub and WordPress each get their own G-Contracts approval before any integration code is written (NODE-008), per `architecture-validation.md` §14–15. They are scheduled as soon as their contracts can realistically be verified, not bundled arbitrarily with unrelated modules.
4. **The open architecture questions in `gap-analysis.md` (queue execution model, SSO, deployment target) are resolved in Phase 0**, because nearly every later phase's job-handling, auth-gating, and CI/CD design depends on their answers. No phase after Phase 0 should start writing job-handling or auth code against an unresolved model.
5. **Every phase closes with its own G4 sprint QA and ends at a real, demo-able increment** — consistent with the skill's "no auto-fix, gate every stage" discipline.

---

## Phase 0 — Discovery, Architecture Decisions, and Governance Setup

**Gates:** Discovery (G0.5) → G0 → G1 → G1.5

| Field | Detail |
|---|---|
| **Modules** | None (pre-module). Produces: `project.json` (schema-valid, `project_type: custom-app-build`, shape = API+dashboard+worker union per `nodejs/projects/custom-app-build/knowledge/01-app-shapes.md`), `architecture.md`, ADRs. |
| **Dependencies** | None — this is the entry point. Depends on this review's four companion documents being read and the Open Questions in `open-questions.md` being answered by the client/PM where marked as genuine blockers. |
| **Repository changes** | None yet — `project.json` and architecture docs are delivery-process artifacts, not application code. Repositories (`webdesk-growth-dashboard`, `webdesk-wordpress-website`) are created empty, with branch protection configured per `git-branch-strategy.md`. |
| **Database entities** | None. |
| **APIs** | None. |
| **Tests** | `validate-spec` auto-check at G0 (per `_contracts/gate-format.md`). |
| **Acceptance criteria** | (a) `project.json` passes schema validation against `_contracts/project-json.schema.json` (extended locally with `vercel` as a `host_target` value and `vercel-blob` as a storage value, per `architecture-validation.md`). (b) ADRs exist and are approved for: Turborepo monorepo structure (`architecture-validation.md` §1), NestJS-on-Vercel adaptation (§3, §9), job execution model (§9), Google Workspace SSO/OIDC (§12), deployment model (§9/gap-analysis §15), threat model (gap-analysis §17). (c) All Blocking and Gate-blocking(G1.5) items in `gap-analysis.md`'s summary table are resolved or have an explicit, dated decision-deferral recorded. |
| **Risks** | Underestimating this phase compresses all downstream estimates — the skill's own G1.5 trigger list (new datastore + async/cron + auth-beyond-single-key + likely >80hr estimate) fires unambiguously here, so this is a real architecture-review effort, not a formality. Getting the queue-execution-model ADR wrong is the highest-cost mistake to make late (it reshapes `dashboard-worker`'s entire structure). |
| **Required approvals** | Tech lead (G1.5, architecture); PM lead (G1, estimate→ticket recorded); client (per gate SLA — G1.5 does not require client sign-off per the canonical gate set, but the SSO and deployment ADRs should be shared with the client given their operational impact). |

---

## Phase 1 — Platform Foundation: Auth, RBAC, Settings, Scaffold

**Gates:** G-Schema (core entities) → G2 (auth/shell UI) → G3 (scaffold) → G4

| Field | Detail |
|---|---|
| **Modules** | #40 Users, Roles and Permissions; #42 System Settings (core: timezone, environments); #43 Audit Logs and System Health (write path only — the audit event pipeline, not yet the full module UI); dashboard shell (nav, theme customizer, login). |
| **Dependencies** | Phase 0's ADRs (SSO/OIDC, monorepo structure) must be approved before this phase's auth work starts. |
| **Repository changes** | Turborepo workspace scaffolded per Phase 0's ADR: `apps/dashboard-web`, `apps/dashboard-api`, `apps/dashboard-worker` (skeleton only — job handlers come later), `packages/database`, `packages/shared-types`, `packages/validation`, `packages/ui`, `packages/configuration`. CI pipeline wired (`turbo run lint test build`, migration dry-run, dependency audit) per `git-branch-strategy.md` + `testing/01-api-and-integration-tests.md`. |
| **Database entities** | `users`, `user_identities` (Google Workspace subject ID mapping), `roles`, `permissions`, `role_permissions` (or `role_module_permissions` per module — see below), `user_role_assignments`, `project_role_assignments`, `sessions`, `account_recovery_requests`, base-entity mixin/columns established as the pattern every later migration follows (per `architecture-validation.md` §7). |
| **APIs** | `/auth` (OIDC callback, session mint, refresh, logout), `/users`, `/roles`, `/permissions`, `/health/live`, `/health/ready`, `/health/dependencies`. |
| **Tests** | Auth test suite from `11_Acceptance_Criteria_and_Test_Plan.md §2` (SSO success/reject by domain, TOTP local admin, session expiry ≤7 days, lockout/rate-limit) — all of it, since this is the highest-security-sensitivity phase; permission tests from `§3` (read-only cannot mutate, confidential-field exclusion). |
| **Acceptance criteria** | A user can log in via Google Workspace SSO on an allowed domain and is rejected on a non-allowed domain; a local emergency-admin account requires TOTP; deny-by-default is provably true (a role with no grants can view nothing); the dashboard shell renders with RBAC-gated nav and the theme customizer persists a choice. |
| **Risks** | This phase concentrates nearly all of the genuinely new (non-skill-precedented) security work identified in `gap-analysis.md` items 1 and 2 — schedule slack accordingly rather than estimating it like a routine CRUD module. |
| **Required approvals** | G-Schema (PM + client, DBA verifies); G2 (Design lead + client, per D-DES-01 HTML-mockup rule — note the dashboard's own mockup does **not** need the skill's default "Master dashboard with per-instance health score" checklist item, since there is no multi-tenant master concept here — see `open-questions.md` OQ-04); G4 sprint QA. |

---

## Phase 2 — Governance & Workflow Backbone

**Gates:** G-Schema (extends) → G4×n

| Field | Detail |
|---|---|
| **Modules** | #37 Decision and Activity Log (full module, building on Phase 1's write path); #39 Notification Center; #1 Home (partial — health/status widgets only, full version waits until later phases populate real data); generic workflow-state-machine engine (`workflow_definitions`, `workflow_states`, `workflow_transitions`, `workflow_instances`) that every subsequent lifecycle-bearing module (Case Studies, Page Workspace, Design Review, Release Center, etc.) will register against, per `05_Workflow_State_Machines.md §1`'s general rules and `gate-format.md`'s CONFIRM/REJECT/REVISE/RENEGOTIATE semantics. |
| **Dependencies** | Phase 1 (users/roles/audit pipeline must exist for workflow transitions to attribute actors and enforce approver≠doer). |
| **Repository changes** | `packages/workflow` (or equivalent shared logic) if the generic state-machine engine is factored as a reusable package across `dashboard-api`; email adapter in `packages/integrations` for Notification Center's SMTP path. |
| **Database entities** | `workflow_definitions`, `workflow_states`, `workflow_transitions`, `workflow_instances`, `approvals`, `review_assignments`, `comments`, `audit_events` (full table, with `retention_category`/legal-hold columns per `gap-analysis.md` item 10), `notifications`, `notification_recipients`, `notification_delivery_events`, `operational_areas`, `operational_contacts`. |
| **APIs** | `/workflows`, `/approvals`, `/comments`, `/notifications`, `/audit`. |
| **Tests** | Workflow-stage-order enforcement (required approval blocks next stage, revision creates a new draft version — `11 §4`); separation-of-duties tests (`06 §4`, `11 §3`); notification retry/failure-state tests per `integration/02-queues-and-jobs.md`'s idempotency/DLQ pattern. |
| **Acceptance criteria** | A generic artifact can move through Draft→Submitted→Under Review→Approved with an audit event per transition and no self-approval possible; a failed notification retries per policy and lands in a visible failed/DLQ state rather than disappearing silently. |
| **Risks** | Getting the generic workflow engine's design wrong here is expensive — nearly every later phase's module builds its specific lifecycle (Page, Case Study, Release, Security Finding, etc. — `05_Workflow_State_Machines.md §3–§11`) on top of it. Invest in making the engine genuinely generic (configurable states/transitions per entity type) rather than hardcoding the Page lifecycle and retrofitting others. |
| **Required approvals** | G4 sprint QA per sprint; no client-facing gate required at this layer specifically (it's plumbing), but the resulting Page lifecycle (Phase 3) does reach G2/client-facing gates. |

---

## Phase 3 — Strategy & Content Libraries (P0 backbone content)

**Gates:** G-Schema (extends) → G2 (Page Workspace UI) → G4×n

| Field | Detail |
|---|---|
| **Modules** | #2 Projects; #3 Business Knowledge Center; #4 Website Strategy Center; #5 Page Inventory; #6 Page Workspace; #20 Service Library; #21 Persona Library; #22 Proof and Claims Library; #23 Keyword and Entity Library; #24 Internal Linking Library; #25 Content Template Library; #28 Knowledge Library; #29 Workflow and Task Template Library. |
| **Dependencies** | Phase 2's workflow engine and audit pipeline (every module here has an approval-gated lifecycle); Phase 1's confidential-field permission model (Business Knowledge, Proof/Claims, and pricing-adjacent Service fields are confidentiality-tiered per `04 §6`). |
| **Repository changes** | No new apps/packages — this phase is primarily `dashboard-api` controllers/services/repositories and `dashboard-web` module UIs, built on Phase 1–2 foundations. |
| **Database entities** | `projects`, `project_environments`, `project_repositories`, `project_users`, `project_objectives`, `roadmap_items`, `pages`, `page_urls`, `page_artifacts`, `page_artifact_versions`, `page_relationships`, `page_component_usage`, `service_categories`, `services`, `service_deliverables`, `deliverables`, `platforms_technologies`, `service_platforms`, `engagement_models`, `service_engagement_models`, `personas`, `service_personas`, `proof_claims`, `claim_sources`, `keywords`, `entities`, `keyword_entity_relationships`, `page_keyword_assignments`, `internal_links`, `content_templates`, `search_briefs`, `schema_recommendations`, `knowledge_sources`, `task_templates`. |
| **APIs** | `/projects`, `/pages`, `/artifacts`, `/services`, `/personas`, `/claims`, `/keywords`, `/entities`, `/internal-links`, `/knowledge`. |
| **Tests** | Page workflow tests (`11 §4` — full battery, this is where the Page lifecycle from `05 §3` is implemented); unique-canonical-URL-per-project constraint test (`03 §5` acceptance criterion); "roadmap status never implies deployment" test (`03 §1`, `11 §4`). |
| **Acceptance criteria** | The full existing-page/new-page workflow (`01 §9`) is operable end-to-end through Page Workspace's tabs with versioned artifacts per stage and exact-version approvals; Page Inventory enforces one canonical active page per URL. |
| **Risks** | Page Workspace is the largest single UI surface in the dashboard (16 tabs); do not compress its QA cycle to fit a deadline — under-testing the stage-order enforcement here is the most likely source of a "roadmap confused with built" regression, which is explicitly the #1 failure mode the dashboard was commissioned to fix (`01 §3`). |
| **Required approvals** | G2 for Page Workspace's UI (Design lead + client); G4 per sprint. |

---

## Phase 4 — Design System & Asset Libraries

**Gates:** G-Schema (extends) → G4×n

| Field | Detail |
|---|---|
| **Modules** | #10 Brand Library; #11 Design Reference Library; #12 Asset Library; #13 Design Token Library; #14 Component Library; #15 Section and Pattern Library; #16 Page Template Library; #17 Wireframe Library; #18 Motion and Interaction Library; #19 Design Review Center. |
| **Dependencies** | Phase 1's Vercel Blob integration (Asset Library is Blob-heavy); Phase 2's workflow engine (Design Review Center's approve/revise/reject/supersede lifecycle). |
| **Repository changes** | Vercel Blob adapter in `packages/integrations` (direct-upload authorization, checksum, signed URLs — `architecture-validation.md` §11). |
| **Database entities** | `brand_assets`, `design_references`, `design_tokens`, `design_token_versions`, `components`, `component_versions`, `patterns`, `page_templates`, `wireframes`, `motion_specs`, `design_reviews`. |
| **APIs** | `/design`. |
| **Tests** | File upload/type/size tests (`11 §8` full battery); direct-to-Blob large-file upload path; `Scan Not Configured` honesty check (asset status never silently reads as "clean"). |
| **Acceptance criteria** | Every active brand/design asset carries status, version, approval, and a resolvable file reference; large files use direct authenticated Blob upload, not proxy-through-API. |
| **Risks** | The upload-size threshold gap flagged in `gap-analysis.md` item 11 needs a concrete number before this phase's upload flow is built — resolve it at Phase 4 kickoff if not already settled in Phase 0. |
| **Required approvals** | G4 per sprint; no distinct client gate beyond normal Design Review Center approvals (which are the module's own product function, not a delivery gate). |

---

## Phase 5 — External Integrations: GitHub, WordPress, Google Workspace SMTP

**Gates:** G-Contracts (one per integration) → G4×n → G5 (integration-heavy milestone)

| Field | Detail |
|---|---|
| **Modules** | #41 Integrations (module UI/config surface); the GitHub half of #30 Ready for Claude Queue and #36 Release Center (SHA verification, PR/deployment status); the WordPress half of #7 Case Study Studio, #8 Case Study Library, #9 Portfolio Library (native structured-content publishing) and the standalone WordPress migration workstream (`10_WordPress_Integration_and_Migration.md`); notification delivery via SMTP (completing #39 from Phase 2). |
| **Dependencies** | Phase 0's WordPress current-state audit (`gap-analysis.md` item 9, `12_Open_Items §2` — this is a hard prerequisite, not just a recommended order); new adapter knowledge authored per `architecture-validation.md` §14–15 (`nodejs/integrations/github/`, `nodejs/integrations/wordpress/`); Phase 2's Notification Center plumbing for the SMTP adapter. |
| **Repository changes** | `packages/integrations/github`, `packages/integrations/wordpress`, `packages/integrations/smtp` (or equivalent per the monorepo's chosen package boundary from Phase 0's ADR); the separate `webdesk-wordpress-website` repository's custom theme work begins here per `10 §2–§3`, gated on the Theme Migration & Reconciliation Report being complete first (`10 §9`). |
| **Database entities** | `webhook_events`, `secret_metadata` (encrypted credential references), `integration_environments`, `integrations`; WordPress-side native meta-schema (`register_post_meta` definitions per `10 §4`) is a WordPress-repo artifact, not a dashboard Postgres table, but its field-mapping documentation lives in `data-model.md` per the ownership matrix (`04 §3`). |
| **APIs** | `/integrations`; GitHub webhook receiver endpoint(s); WordPress REST client calls (outbound, no new inbound endpoint unless WordPress-side webhooks are confirmed in scope per `gap-analysis.md` item 6). |
| **Tests** | GitHub tests (`11 §9` full battery — webhook signature validation, duplicate-webhook safety, commit verification, PR status sync, release-manifest SHA accuracy, protected-branch respect); WordPress tests (`11 §10` full battery — least-privilege REST reads, authorized draft creation, WP-CLI blocklist enforcement, migration preservation of IDs/URLs/terms/media, flat Case Study/Portfolio URL preservation). |
| **Acceptance criteria** | GitHub App reads repo metadata/commits, verifies webhook signatures, and records accurate PR/deployment status without ever auto-merging a protected branch; WordPress integration reads/writes only through the least-privilege Application Password account, and the CaseStudy/Portfolio migration dry-run reproduces exact before/after counts on staging before any production cutover is scheduled (`10 §7`, step-by-step). |
| **Risks** | This is the phase most exposed to "verify-at-discovery" surprises (NODE-008) — GitHub App rate limits and permission scopes, and WordPress's actual REST/WP-CLI capabilities, are both explicitly unverified going in. Budget discovery time inside this phase, not just before it, and treat the WordPress migration specifically as high-risk given it touches live production content structure. |
| **Required approvals** | G-Contracts per integration (PM + client, before any integration code is written against it); G5 milestone regression covering the full integration battery; WordPress production cutover requires its own explicit approval per `10 §7` step 6, separate from and in addition to G-Contracts. |

---

## Phase 6 — Delivery Operations: Ready for Claude Queue, Release Center, Scan Center, Change Center, Technical Center

**Gates:** G-Schema (extends) → G4×n → G5

| Field | Detail |
|---|---|
| **Modules** | #30 Ready for Claude Queue (full); #31 Review and Approval Center; #32 Scan Center; #33 Change Center; #35 Technical Center; #36 Release Center (full, both dashboard and WordPress SHA tracking). |
| **Dependencies** | Phase 5's GitHub integration (Release Center and Ready for Claude Queue are GitHub-dependent for SHA/PR/deployment data); Phase 2's workflow engine (every module here has an approve/reject/revise lifecycle); Phase 0's job-execution-model ADR (Scan Center's scan runs are background jobs). |
| **Repository changes** | `apps/dashboard-worker` job handlers for scan runs and scheduled scans, built against whichever execution model Phase 0 selected (Vercel Queues/Workflows/Cron, per `architecture-validation.md` §9). |
| **Database entities** | `background_jobs`, `background_job_attempts`, `workflow_runs`, `scheduled_jobs`, `job_progress_events`, `job_failures`, `scan_definitions`, `scan_runs`, `scan_findings`, `scan_evidence`, `change_sets`, `change_items`, `change_decisions`, `pull_requests`, `code_reviews`, `security_findings`, `qa_findings`, `test_runs`, `compatibility_reports`, `releases`, `release_artifacts`, `deployments`, `rollback_records`, `smoke_tests`. |
| **APIs** | `/tasks`, `/scans`, `/changes`, `/releases`, `/deployments`. |
| **Tests** | Ready for Claude tests (`11 §5` full battery — task package contains only authorized files, dependency blockers work, completion requires remote commit verification, no auto-merge); Scan/Change Center tests (`11 §7`); Release tests (`11 §11` full battery including rollback and hotfix flows). |
| **Acceptance criteria** | A task cannot be marked complete without a verified remote commit SHA where Git artifacts changed; a scan never silently overwrites an approved record; a production release records exact approved dashboard + WordPress SHAs together and a rollback correctly records the rolled-back SHA and reason. |
| **Risks** | This phase operationalizes the dashboard's most novel product concept (product-level reimplementation of the skill's own gate discipline — see `requirements-traceability-matrix.md` DASH-GOV-01/DASH-GOV-04) — resist the temptation to under-scope its QA because "we already tested this pattern building the dashboard itself." The dashboard's Ready-for-Claude-Queue is a *different* instance of the pattern (governs future website-page work) and needs its own full test battery, not inherited confidence from the delivery-system's own gate mechanics. |
| **Required approvals** | G5 milestone regression (Tech lead + PM); Release Center's production-release action itself requires the dashboard's own configured release-approval authority (per `06 §3` Releases row), independent of any skill-level gate. |

---

## Phase 7 — Import/Export, Help Center, Remaining P1 Libraries

**Gates:** G-Schema (extends) → G4×n

| Field | Detail |
|---|---|
| **Modules** | #34 Import and Export Center; #38 Help Center; #26 Agent Directory and #27 Agent Specification Library (Foundation Only — pending the scope clarification in `open-questions.md` OQ-03). |
| **Dependencies** | `gap-analysis.md` item 7's file-format/rollback-scope questions resolved; Phase 0–6 modules whose data Import/Export will target must already exist (this phase intentionally runs late so it has real target schemas to import into, not speculative ones). |
| **Repository changes** | None new structurally; import/export processing runs as background jobs per Phase 0's execution model. |
| **Database entities** | `import_templates`, `import_runs`, `import_rows`, `import_errors`, `export_runs`. |
| **APIs** | `/imports`, `/exports`. |
| **Tests** | Import tests (`11 §6` full battery — correct/wrong template version handling, dry-run row errors, duplicate policy, idempotency-key re-upload safety, partial-success reporting, rollback-limitation disclosure). |
| **Acceptance criteria** | A dry run surfaces row-level errors before any data is written; re-uploading the same file with the same idempotency key does not duplicate records; rollback limitations are shown and require explicit acknowledgment before apply. |
| **Risks** | Low relative to earlier phases — this is the most "standard CRUD + async job" work remaining, per `requirements-traceability-matrix.md` Part C's compatibility assessment. |
| **Required approvals** | G4 per sprint. |

---

## Phase 8 — Observability, Security Hardening, Backup/Retention, Pre-Launch

**Gates:** G5.5 → G6 → M6

| Field | Detail |
|---|---|
| **Modules** | Completion of #43 Audit Logs and System Health (full module, retention job); operational hardening across all prior phases — no new dashboard modules, this phase is cross-cutting. |
| **Dependencies** | Every prior phase (this is explicitly the "everything must already exist to be observed/protected/backed-up" phase). `gap-analysis.md` items 12 (retention), 13 (backups), 16 (observability), 17 (security residuals) all resolve here if not already closed earlier. |
| **Repository changes** | Runbooks under `operations/{incident,queue-recovery,webhook-replay,db-restore,deploy-recovery}/`, filled in from the skill's templates (`nodejs/templates/operations/*.template.md`) with dashboard-specific RPO/RTO targets, providers, and procedures (`architecture-validation.md` §13/`gap-analysis.md` item 13); a new retention-run runbook authored from scratch (no skill template exists for this). |
| **Database entities** | `retention_rules`, `legal_holds`, `deletion_runs`, `backup_records`, `restore_tests`, `system_health_checks`, `incident_records`, `incident_updates`. |
| **APIs** | `/health` (all three tiers, complete); no other new endpoints — this phase is operational, not feature-adding. |
| **Tests** | Backup and retention tests (`11 §12` full battery); performance tests (`11 §14`); accessibility/UI tests (`11 §13`, WCAG 2.2 AA per `architecture-validation.md` §10 and `gap-analysis.md`-adjacent note); full security review with no unresolved critical findings (`09 §10` exception-approval process exercised if needed). |
| **Acceptance criteria** | Every item in the Production Launch Checklist (`11 §15`) passes: all P0 modules accepted, operational contacts configured with multiple emails, SMTP tested, GitHub App installed, WordPress credentials verified, backups and restore test complete, retention job enabled, audit export verified, no unresolved critical security issue, Help Center published, production release and rollback rehearsal complete. |
| **Risks** | The retention job (Gap #12) and the RPO-satisfying backup mechanism (Gap #13) are the two items in this phase most likely to reveal they should have been designed earlier (both touch schema/infrastructure decisions that are expensive to retrofit) — if either was deferred past Phase 0/1, expect schedule risk here specifically. |
| **Required approvals** | G5.5 (Delivery Head + Tech lead — full observability checklist, runbooks present); G6 (Delivery Head + client — secrets managed, rollback tested, sign-off); this maps directly onto the dashboard pack's own `19_Definition_of_Done`-equivalent (`01 §19`). |

---

## Phase 9 — Launch and Health-Score Baseline

**Gate:** M6

| Field | Detail |
|---|---|
| **Modules** | None new — production cutover of both repositories per their approved SHAs (`01 §6`, `01 §11`). |
| **Dependencies** | Phase 8 complete and G6 passed for both the dashboard and the WordPress custom theme migration cutover (`10 §7` step 7). |
| **Repository changes** | Tag `v1.0.0` on both repositories; deploy adapter executes build→migrate→release→health-check per the chosen Vercel deployment model (Phase 0 ADR). |
| **Database entities** | None new. |
| **APIs** | None new. |
| **Tests** | Post-launch smoke tests; monitoring dashboards confirmed live and alerting. |
| **Acceptance criteria** | Production is serving on the approved SHAs; the dashboard's own Home module correctly reflects real Git/release status (not roadmap intent) for the newly-launched system itself. |
| **Risks** | Standard launch-day risk; mitigated by the rollback rehearsal already completed in Phase 8. |
| **Required approvals** | M6 (Delivery Head) — establishes the Project Health Score baseline per `_contracts/health-score.schema.json`, even though this dashboard has no Master/cross-client rollup to surface it on (see `open-questions.md` OQ-04) — record it in `project.json` regardless, as the skill's own internal delivery-quality record for this engagement. |

---

## Cross-phase dependency summary

```
Phase 0 (Architecture ADRs) ──────────────────────────────┐
   │                                                        │
   ▼                                                        │
Phase 1 (Auth/RBAC/Scaffold) ──────────────┐                │
   │                                        │                │
   ▼                                        ▼                │
Phase 2 (Workflow/Audit/Notifications) ──► Phase 4 (Design/Asset Libraries)
   │                                        │
   ▼                                        │
Phase 3 (Strategy/Content Libraries) ◄──────┘
   │
   ▼
Phase 5 (GitHub/WordPress/SMTP integrations) ──► Phase 6 (Ready for Claude / Release / Scan / Change)
   │                                                  │
   ▼                                                  ▼
Phase 7 (Import/Export, Help Center) ──────────► Phase 8 (Observability/Security/Backup/Pre-launch)
                                                       │
                                                       ▼
                                                  Phase 9 (Launch / M6)
```

Phases 3 and 4 can run partially in parallel once Phase 2 is done (both depend on Phase 2, not on each other). Phase 5's WordPress workstream has its own internal gate (current-state audit → migration dry-run → staging verification → production cutover) that runs on a longer, partially-independent timeline within the phase — do not treat "Phase 5 complete" as a single milestone; track the GitHub and WordPress workstreams separately within it.
