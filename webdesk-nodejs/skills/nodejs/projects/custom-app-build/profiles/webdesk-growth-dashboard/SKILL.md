---
name: webdesk-growth-dashboard
description: Project-specific profile for the WebDesk Website Growth Dashboard, layered on top of the custom-app-build project-type skill. Intended for projects where project_type is "custom-app-build" and project_profile is "webdesk-growth-dashboard"; loaded through the project root CLAUDE.md's explicit skill-path list, not automatically by the base orchestrator (see SKILL.md §2). Resolves the dashboard's approved architecture (Turborepo, NestJS-on-Vercel, Vercel Queues/Workflows/Cron, Google Workspace SSO, GitHub App, WordPress REST/WP-CLI, Vercel Blob, Google Workspace SMTP) as fixed project decisions on top of the base Node.js skill's defaults. Does not replace, weaken, or fork the base skill.
version: 1.0.0
tier: 1
load_when: ["webdesk-growth-dashboard"]
tools: [Read, Write, Edit, Glob, Grep, Bash]
model: sonnet
color: teal
---

# WebDesk Growth Dashboard — Project Profile

> A **profile**, not a fork. This file and everything under it narrows and configures the existing `custom-app-build` project-type skill for one specific project. It does not duplicate the base skill's rules and does not introduce a competing delivery process. Where this profile is silent, the base skill governs. Where this profile speaks, it resolves a decision the base skill left open (a technology default, an unmodeled pattern) — it never contradicts a base-skill _rule_ (NODE-xxx, FG-xxx, the controller/service/repository layering, no-auto-deploy, no-self-approval).

---

## 1. What this profile is

This is the project-specific skill overlay produced by the compatibility review at `docs/implementation/` (see `node-skill-compatibility-review.md`, `requirements-traceability-matrix.md`, `architecture-validation.md`, `gap-analysis.md`, `phased-implementation-plan.md`, `open-questions.md` — all five companion review documents remain the record of _why_ every decision below was made; this profile is the record of _what to load and follow_ going forward).

**This task builds the skill overlay only.** No dashboard application code, no Turborepo scaffold, no NestJS/Next.js/PostgreSQL install, no database migration, no WordPress connection, and no deployment happens as part of producing this profile. See `knowledge/15-project-specific-forbidden-actions.md`.

---

## 2. Loading hierarchy

**Honesty check, stated plainly (corrected 2026-08-05 after external review):** steps 1–4 below are loaded by the base orchestrator's own existing behavior — it already reads `project.project_type` and `project.integration_targets` and scopes loading accordingly, unmodified by this profile. **Step 5 (this profile) is NOT loaded automatically by anything in the base orchestrator.** The base skill has no code path that reads `project.project_profile` — that field doesn't exist in its schema and it doesn't know to look for it. The way step 5 actually happens in Version 1 is: **the project's root `CLAUDE.md` — read first, every session, by the base orchestrator's own session-start protocol — explicitly lists this profile's `SKILL.md` path**, immediately after the `custom-app-build` project-type skill's path, in its "Required skill files" section (see `templates/CLAUDE.md.template`, which is the authoritative reference for this ordering until a real project `CLAUDE.md` exists). This is a **documented convention enforced by what's written in one file**, not automatic orchestrator behavior — if a future `CLAUDE.md` is written without that line, this profile silently never loads, and nothing in the base skill would notice or complain. Generic `project_profile` auto-routing is proposed as `proposed-upstream-patches/11-generic-project-profile-routing.md` (not applied, not required for this project to function).

The orchestrator loads files in this order for any WebDesk Growth Dashboard task. Each tier is loaded **before** the next, and only the parts of a later tier that the active task actually needs (context-budget discipline, `_spine/shared-knowledge/context-budget.md`, applies unchanged):

```
1. Shared spine and orchestrator
   _spine/orchestrator/SKILL.md, _spine/persona.md,
   _spine/shared-knowledge/{CONVENTIONS,context-budget,model-policy}.md

2. Relevant software-delivery role
   _spine/{pm-agent,architect-agent,designer-agent,qa-agent,code-review-agent,delivery-head}/SKILL.md
   (per the task at hand — see §6 of this file for the distinct dashboard-business-agent taxonomy,
   which is NOT loaded here)

3. Base Node.js skill
   nodejs/SKILL.md, nodejs/knowledge/{00-overview,01-coding-standards,02-naming-conventions,09-forbidden}.md,
   plus the domain-specific nodejs/knowledge/{backend,database,frontend,security,integration,testing,intelligence}/*
   files the active task touches

4. Custom App Build project-type skill
   nodejs/projects/custom-app-build/{SKILL.md,gates.md,knowledge/01-app-shapes.md}

5. WebDesk Growth Dashboard project profile  ← you are here
   this SKILL.md, then knowledge/00-15 on demand per the active task,
   per the precedence rules in knowledge/00-scope-and-precedence.md

6. Only the integrations required by the active task
   integrations/github/*      — only when the task touches GitHub App / webhook / PR / release work
   integrations/wordpress/*   — only when the task touches WordPress REST / WP-CLI / theme / migration work
   integrations/google-workspace/* — only when the task touches SSO/OIDC or SMTP
   integrations/vercel/*      — only when the task touches Functions/Queues/Workflows/Cron/Blob/hosting
   Never load an integration module the active task does not need — same discipline the base skill
   already applies to bigcommerce/shopify/erp (nodejs/SKILL.md §"Identity").

7. Canonical project documentation referenced by the active task
   Read by path from webdesk-dashboard-documentation-v1/, docs/implementation/, and any registered
   canonical project documents (WordPress Technical Discovery, Agent Specification Batch N, Service
   and SEO Library exports) — see knowledge/00-scope-and-precedence.md §"Canonical documents". This
   profile references those files; it does not copy their content into the skill tree.
```

Steps 1–4 are the existing base skill, entirely unmodified by this profile (see §5, Base-skill protection). Steps 5–7 are what this profile adds.

---

## 3. Instruction precedence

When two sources disagree, resolve in this order (highest wins):

1. **Approved WebDesk Dashboard Master Specification** (`webdesk-dashboard-documentation-v1/01_Dashboard_Master_Specification.md`)
2. **Approved detailed dashboard documentation** (the rest of `webdesk-dashboard-documentation-v1/*`, plus registered canonical documents — WordPress Technical Discovery, Agent Specification Batch N, Service/SEO Library exports)
3. **Approved WebDesk project decisions and ADRs** (produced under `docs/architecture/adr/` once Phase 0 begins — see `templates/architecture-adr-template.md`)
4. **This project profile** (`SKILL.md` + `knowledge/*` + `integrations/*` + `contracts/*` in this directory)
5. **WebDesk Node.js base skill** (`nodejs/SKILL.md` and everything under `nodejs/knowledge/`, `nodejs/projects/custom-app-build/`)
6. **General Claude Code conventions**

**On conflict:**

- Do not silently pick a source. Stop and name the conflict.
- Follow the higher-precedence approved source.
- Record the conflict (in the active task's package / handoff, and in `docs/skill-build/unresolved-items.md` if it's a standing, not one-off, conflict).
- If the higher-precedence source does not clearly resolve the conflict, **escalate** — do not guess. This mirrors the base skill's own "ask-if-missing" rule (`nodejs/knowledge/technology-selection.md`) applied one level up, to document conflicts rather than technology gaps.

Full detail and worked examples: `knowledge/00-scope-and-precedence.md`.

---

## 4. What this profile resolves that the base skill leaves open

The base skill's defaults (Express, node-cron/BullMQ, S3, local JWT auth, no monorepo model) are **not wrong** — they're defaults for projects that haven't stated an override. This project has. Per `docs/implementation/architecture-validation.md`, every item below is an **approved technology kept as approved**, not a rejection of the base skill's preference:

| Area               | This project's resolved choice                                                        | Detail                                                                          |
| ------------------ | ------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------- |
| Monorepo           | Turborepo, `apps/{dashboard-web,dashboard-api,dashboard-worker}` + `packages/*`       | `knowledge/01-approved-architecture.md`, `knowledge/02-turborepo-boundaries.md` |
| Backend framework  | NestJS                                                                                | `knowledge/03-nestjs-on-vercel.md`                                              |
| Compute/job model  | Vercel Functions + Vercel Queues/Workflows/Cron Jobs; **no permanent worker process** | `knowledge/04-serverless-queues-workflows-and-cron.md`                          |
| Authentication     | Google Workspace SSO (primary) + local TOTP emergency admin                           | `knowledge/05-google-workspace-sso-and-local-admin.md`                          |
| Git integration    | GitHub App + Octokit                                                                  | `knowledge/06-github-app-integration.md`                                        |
| CMS integration    | WordPress REST API + controlled WP-CLI, no ACF                                        | `knowledge/07-wordpress-integration.md`                                         |
| File storage       | Private Vercel Blob                                                                   | `knowledge/08-vercel-blob-and-file-handling.md`                                 |
| Notifications      | Google Workspace SMTP (not Resend)                                                    | `knowledge/09-google-workspace-smtp.md`                                         |
| Data/Git ownership | See ownership matrix                                                                  | `knowledge/10-data-ownership-and-audit.md`                                      |
| Retention/backup   | East Coast only, category-based retention                                             | `knowledge/11-retention-backup-and-operations.md`                               |
| Security controls  | Deny-by-default, extended RBAC, confidential-field axis                               | `knowledge/12-dashboard-security-controls.md`                                   |
| Testing            | Vitest/Jest + Supertest + Playwright                                                  | `knowledge/13-testing-and-acceptance.md`                                        |
| Phasing            | 10-phase build order                                                                  | `knowledge/14-implementation-phases.md`                                         |
| Forbidden actions  | Project-specific NEVERs on top of NODE-xxx/FG-xxx                                     | `knowledge/15-project-specific-forbidden-actions.md`                            |

None of these resolutions changes a base-skill **rule**. They configure the base skill's decision points (`technology-selection.md`'s "ask-if-missing," `intelligence/*`'s decision tables) with this project's already-approved answers, so no agent working this project should ever re-ask a question this profile already answers.

---

## 5. Base-skill protection

The base Node.js skill (everything under `nodejs/` outside this `profiles/webdesk-growth-dashboard/` directory) is a **stable upstream dependency** for this project, not a draft to edit. This profile:

- **Adds** files under `profiles/webdesk-growth-dashboard/` — it does not modify any existing base-skill file.
- **Never overrides a forbidden pattern** (NODE-001…NODE-104, FG-001…FG-012) — every project-specific NEVER in `knowledge/15-project-specific-forbidden-actions.md` is _additive_ to the base list, never a relaxation of it.
- **Proposes, never merges** generic improvements the base skill would benefit from regardless of this project — these live entirely outside the skill tree, in `proposed-upstream-patches/` at the repository root, and require separate human review before any base-skill file is touched. See `docs/skill-build/proposed-upstream-patches.md`.

If a future task seems to require editing a base-skill file directly, stop and treat that as its own decision requiring explicit approval — it is out of scope for how this profile works.

---

## 6. Two agent taxonomies — do not merge them

This project has **two distinct sets of "agents"** and this profile is intentionally silent on one of them:

1. **WebDesk Node.js Delivery System software-delivery roles** (PM, Architect, Backend, Frontend, Designer, QA, Code Review, Delivery Head) — these are the agents that **build and review the dashboard software itself**, per `_spine/orchestrator/SKILL.md`'s agent roster. This profile configures how _they_ work on _this_ project. Unchanged by this profile beyond the loading-hierarchy and precedence rules above.

2. **The dashboard's own fifteen website-growth and delivery business agents** (Website Growth Director, Site Intelligence and Inventory Agent, Search Strategy Agent, Content Strategy Agent, Case Study and Portfolio Agent, Creative Director, UX/CRO Agent, UI Design System Agent, WordPress Engineering Agent, Dashboard Application Engineering Agent, Code Review Agent, Security Assurance Agent, QA/Accessibility/Performance Agent, Release and Memory Coordinator, Product Documentation Agent) — these are **product records** the finished dashboard governs through its own Agent Directory and Agent Specification Library modules (dashboard modules #26–27), specified in the approved nineteen-section format. They are content the dashboard _manages_, not agents that build the dashboard.

**Do not conflate these.** A task to "invoke the Backend role to build the Notification Center" uses taxonomy 1. A task to "register the Website Growth Director's approved specification" is populating taxonomy 2's data, as a canonical-document task under loading-hierarchy step 7 — it does not invoke a software-delivery role to _act as_ that agent. See `knowledge/00-scope-and-precedence.md` §"Two agent taxonomies" and the Agent Directory/Specification Library rows in `docs/implementation/requirements-traceability-matrix.md` (DASH module rows #26–27, and `docs/implementation/open-questions.md` OQ-04 for the residual scope ambiguity that registering Batch 1 specifications does **not**, by itself, resolve — see `knowledge/00-scope-and-precedence.md`).

Batch 1 of the fifteen agent specifications, where supplied, is registered as a canonical project document (loading-hierarchy step 7) — referenced by path, not copied into this skill tree. Where a batch was not supplied to this task, it is tracked as a setup-time/discovery input, not fabricated. See `docs/skill-build/unresolved-items.md`.

---

## 7. Version 1 Claude execution boundary

Restated here because it governs how every knowledge file in this profile is meant to be used, not just how the finished dashboard behaves:

- Version 1 does **not** call the Anthropic API to run dashboard agents automatically.
- The dashboard creates a task marked **Ready for Claude**; an authorized human operator manually invokes Claude Code.
- Claude reads only the authorized task package for that stage, performs that stage, and **stops for approval at the required gate**.
- No fake automatic AI buttons. No autonomous background AI execution. The architecture may stay API-ready for a future approved version, but nothing in this profile authorizes building that now.

This is a restatement, not a new rule — it is the base skill's own no-auto-fix/no-self-approval/no-auto-deploy discipline (`_spine/orchestrator/SKILL.md` Critical Rules, `forbidden-global.md` FG-007), applied to the product this project happens to be building.

---

## 8. Files in this profile

```
profiles/webdesk-growth-dashboard/
├── SKILL.md                              ← you are here
├── README.md                             human-readable orientation
├── MANIFEST.txt                          full file listing
├── CHANGELOG.md                          profile version history
├── knowledge/
│   ├── 00-scope-and-precedence.md        precedence rules, conflict handling, two-agent-taxonomy detail
│   ├── 01-approved-architecture.md       the full approved stack, kept-not-replaced
│   ├── 02-turborepo-boundaries.md        monorepo structure, package ownership, build graph
│   ├── 03-nestjs-on-vercel.md            NestJS adaptation of the base skill's Express-shaped examples
│   ├── 04-serverless-queues-workflows-and-cron.md   resolved Vercel execution model — no permanent worker
│   ├── 05-google-workspace-sso-and-local-admin.md   OIDC, TOTP, session, recovery
│   ├── 06-github-app-integration.md      App auth, webhooks, Octokit, release SHA tracking
│   ├── 07-wordpress-integration.md       REST API, WP-CLI allowlist, no-ACF native content architecture
│   ├── 08-vercel-blob-and-file-handling.md   upload limits, formats, interim scan statuses
│   ├── 09-google-workspace-smtp.md       notification delivery, retry, distribution lists
│   ├── 10-data-ownership-and-audit.md    PostgreSQL/Git/WordPress/Blob/env-var ownership boundaries
│   ├── 11-retention-backup-and-operations.md   retention categories, backup targets, RPO/RTO
│   ├── 12-dashboard-security-controls.md deny-by-default RBAC, confidential-field axis, separation of duties
│   ├── 13-testing-and-acceptance.md      Vitest/Jest/Supertest/Playwright mapped to dashboard acceptance criteria
│   ├── 14-implementation-phases.md       pointer + profile-specific detail on the 10-phase build order
│   └── 15-project-specific-forbidden-actions.md   project NEVERs, additive to NODE-xxx/FG-xxx
├── integrations/
│   ├── github/            App auth, webhook, Octokit, release/PR/commit adapter knowledge
│   ├── wordpress/         REST/WP-CLI adapter knowledge, migration-specific detail
│   ├── google-workspace/  OIDC + SMTP adapter knowledge
│   └── vercel/            Functions/Queues/Workflows/Cron/Blob adapter knowledge
├── contracts/
│   ├── job-record.schema.json
│   ├── release-manifest.schema.json
│   ├── audit-event.schema.json
│   ├── webhook-event.schema.json
│   └── project-profile.schema.json
├── templates/
│   ├── project.json.example
│   ├── CLAUDE.md.template
│   ├── HANDOFF.md.template
│   ├── architecture-adr-template.md
│   ├── integration-contract-template.md
│   └── task-package-template.md
└── tests/
    ├── profile-validation.md
    ├── routing-validation.md
    ├── precedence-tests.md
    ├── context-loading-tests.md
    └── scenario-tests.md
```

---

## 9. Canonical documents this profile references (does not copy)

Read by path, on demand, per loading-hierarchy step 7:

- `webdesk-dashboard-documentation-v1/*` — the 12-document Dashboard Documentation Pack + README + manifest.
- `docs/implementation/*` — this project's compatibility review, traceability matrix, architecture validation, gap analysis, phased plan, open questions.
- `canonical-inputs/Current_WordPress_Technical_Discovery.md` — **registered; Part 1 supplied 2026-08-06 (native Markdown, source of record), Part 2 supplied 2026-08-05.** Confirms real environment/plugin/security/backup facts and resolved one direct conflict with the Master Specification (ACF — see `canonical-inputs/Owner_Clarifications_2026-08-05.md` and `knowledge/07-wordpress-integration.md` §"ACF conflict — resolved"). See `knowledge/00-scope-and-precedence.md` §4 for its full status.
- `canonical-inputs/agent-specifications-batch-1/*` — **registered 2026-08-05.** Draft 1.0, awaiting final approval per its own `00_README.md`. Confirms the 19-section format and a precedence order consistent with this profile's own.
- `canonical-inputs/WebDesk_Service_SEO_Library_Templates_v4.xlsm` — **registered 2026-08-06.** Status: Under Review — advisory sample/import structure, never approved business truth until reviewed; see `knowledge/00-scope-and-precedence.md` §"Spreadsheet and export data" and WDS-014.

---

Last reviewed: 2026-08-06 (V3 remediation)
Version: 1.3.0
