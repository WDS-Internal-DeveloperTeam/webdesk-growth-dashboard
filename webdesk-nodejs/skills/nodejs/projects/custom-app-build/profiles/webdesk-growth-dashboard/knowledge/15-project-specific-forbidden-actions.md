---
tier: 1
load_when: ["webdesk-growth-dashboard", "code-production", "code-review"]
description: "CRITICAL — project-specific NEVERs for the WebDesk Growth Dashboard, additive to NODE-xxx and FG-xxx. Read before any code touching this project. Code Review loads this alongside the base skill's forbidden files, never instead of them."
---

# 15 — Project-Specific Forbidden Actions

> **Additive, never a relaxation.** Every rule below sits on top of `nodejs/knowledge/09-forbidden.md` (NODE-001…NODE-104) and `_spine/shared-knowledge/forbidden-global.md` (FG-001…FG-012), which apply to this project in full, unmodified. Nothing in this file weakens or overrides either. IDs are prefixed `WDS-xxx` to keep them distinct from the base skill's `NODE-xxx`/`FG-xxx` numbering — never renumber, never reuse an ID.

---

## WDS-001 — Never use ACF, ACF Local JSON, or any ACF-based architecture for new development

**Severity:** P1
**What:** No ACF plugin, no ACF Local JSON, no ACF-pattern custom-field abstraction of any kind, for any new field or new theme development, in any environment.
**Why:** Explicit, absolute project exclusion (`01_Dashboard_Master_Specification.md`'s "Important exclusions: No ACF or ACF Local JSON"; also `10_WordPress_Integration_and_Migration.md §2`) — the WordPress implementation is native structured content by design (`register_post_meta()`, native meta boxes, custom taxonomies). **This rule was tested against a real conflict, not just an untested statement:** the registered Technical Discovery document (`canonical-inputs/Current_WordPress_Technical_Discovery.md`, supplied 2026-08-05) originally proposed the opposite — free-tier ACF with ACF Local JSON — and originally reported ACF 6.8.6 as installed and active on the live site. The project owner resolved this conflict the same day, in two stages: (1) target architecture — the Master Specification's exclusion stands; (2) current-state — a further clarification confirmed WebDesk is not currently using ACF for structured content, so no ACF data dependency is assumed. See `knowledge/07-wordpress-integration.md` §"ACF conflict — resolved" for the full two-stage record.
**Right way:** `knowledge/07-wordpress-integration.md` §"Native structured content." **No ACF data migration is assumed or planned** — the corrected position is that no confirmed ACF dependency exists, not that one exists and must be migrated. Verify actual plugin presence once at implementation kickoff; if ACF is found installed but unused, remove it through the approved plugin-cleanup process (a cleanup action, not a migration project). If it's found installed _and_ in active use, that contradicts the current-state clarification and should be escalated as a fresh conflict, not silently folded back into a migration plan.

## WDS-002 — Never select Neon as a directly chosen PostgreSQL provider

**Severity:** P1
**What:** No application configuration, infrastructure script, or documentation may directly select Neon as this project's PostgreSQL provider.
**Why:** Explicit exclusion (`01_Dashboard_Master_Specification.md §5`). If Vercel's own Postgres offering turns out to be Neon-based under the hood in a way that cannot be avoided, that is the stop-condition in `knowledge/01-approved-architecture.md` §"Database" — escalate, do not silently proceed either way.
**Right way:** Confirm the actual provisioned provider at setup time; if it conflicts with this rule, stop and escalate per `knowledge/01-approved-architecture.md`.

## WDS-003 — Never provision or store production data outside North America East Coast

**Severity:** P1
**What:** No Vercel application, PostgreSQL instance, Upstash Redis instance, Vercel Blob store, WordPress.com instance, or backup target may be provisioned in India, Singapore, or any region outside North America East Coast, for production data.
**Why:** Explicit region policy (`01_Dashboard_Master_Specification.md §12`), a hard constraint not weighed against cost/convenience.
**Right way:** Confirm region at every provisioning step; treat a default region setting from any provider as something to verify, never assume.

## WDS-004 — Never use Resend, or any transactional-email API provider, for notification delivery

**Severity:** P1
**What:** No SMTP-alternative transactional-email API (Resend or otherwise) is wired as the Notification Center's delivery mechanism.
**Why:** Explicit exclusion (task brief §10) — Google Workspace SMTP is the approved provider.
**Right way:** `knowledge/09-google-workspace-smtp.md`.

## WDS-005 — Never assume `dashboard-worker` is, or design it as, a permanent process

**Severity:** P1
**What:** No code, configuration, or architecture document may introduce a long-lived `server.js`-style listener, an in-process BullMQ `Worker`, or an in-memory advisory lock for `dashboard-worker`.
**Why:** The resolved execution model (`knowledge/04-serverless-queues-workflows-and-cron.md`) is fully serverless — a permanent-process assumption anywhere in the worker's design is a direct contradiction of a resolved architecture decision, not a stylistic choice.
**Right way:** `knowledge/04-serverless-queues-workflows-and-cron.md` in full, especially §"Locking without a persistent process."

## WDS-006 — Never claim a file is malware-free, "clean," or "scanned" absent a configured scanner

**Severity:** P1
**What:** No UI copy, API response, or notification may state or imply that an uploaded file has been confirmed free of malware while malware scanning remains unconfigured.
**Why:** Explicit honesty rule (`01_Dashboard_Master_Specification.md §16`, `09_Security_Backup_Retention_Operations.md §3`) — this project must never assert a security guarantee it hasn't actually verified.
**Right way:** Use the interim status vocabulary in `knowledge/08-vercel-blob-and-file-handling.md` exactly as specified — `Scan Not Configured` is the honest default, never silently upgraded to an implied "safe."

## WDS-007 — Never auto-merge, auto-push to a protected branch, or auto-deploy production

**Severity:** P1
**What:** No automation path — including any Ready-for-Claude task, any Vercel deploy-preview promotion, any GitHub Action — merges to `main`/`staging` automatically, pushes directly to a protected branch, or promotes a Vercel deployment to production without the explicit human approval the dashboard's Release Center records.
**Why:** Restated project-specific instance of the base skill's FG-007 and `_spine/orchestrator/SKILL.md` Critical Rules #7–#9, made explicit here because Vercel's own default behavior (auto-deploying preview environments on push) sits close enough to this line that it is worth stating unambiguously: Preview/Development auto-deploy is fine; Staging→Production promotion is never automatic.
**Right way:** `knowledge/06-github-app-integration.md` §"What Claude must never do," `docs/implementation/gap-analysis.md` item 15.

## WDS-008 — Never treat a local commit, or an unverified remote SHA, as proof of task completion

**Severity:** P1
**What:** No Ready-for-Claude task, code-review approval, or release record may be marked complete based on a locally reported commit hash without confirming that hash exists on the remote repository via a live GitHub read.
**Why:** `01_Dashboard_Master_Specification.md §11`'s Git completion rule, restated as a hard block rather than a general principle because it is the literal mechanism by which the dashboard proves what the base skill calls "SHA-is-proof-of-completion."
**Right way:** `knowledge/06-github-app-integration.md` §"Commit SHA verification."

## WDS-009 — Never invoke the Anthropic API automatically to run a dashboard business agent

**Severity:** P1
**What:** No scheduled job, webhook handler, or background process calls the Anthropic API to execute any of the fifteen dashboard business agents (Website Growth Director, Search Strategy Agent, etc.) without a human operator manually invoking Claude Code against an authorized, Ready-for-Claude-marked task package.
**Why:** `SKILL.md §7`'s Version 1 Claude execution boundary — explicit V1 scope limit, restated here as a hard forbidden action because it is easy to build "just one small automatic trigger" that violates it incrementally.
**Right way:** Every dashboard agent invocation in V1 is a manually-triggered Ready-for-Claude task, full stop. The architecture may stay API-ready for a future approved version; nothing in this profile authorizes building the automatic trigger now.

## WDS-010 — Never let `dashboard-api`'s NestJS validation diverge from `packages/validation`'s Zod schemas

**Severity:** P2
**What:** No new `class-validator` DTO may duplicate a shape already defined as a Zod schema in `packages/validation` — every NestJS pipe validates against the shared schema.
**Why:** Schema drift between a shared Zod schema and a parallel Nest DTO is exactly the failure mode `docs/implementation/architecture-validation.md` §8 and §3 flagged as the one real risk in the Zod+NestJS pairing.
**Right way:** `knowledge/03-nestjs-on-vercel.md` §"Validation: one schema, two consumers."

## WDS-011 — Never run a Sequelize migration from `dashboard-worker`, `dashboard-web`, or any package other than the designated migration owner

**Severity:** P1
**What:** No second migration path forms alongside `packages/database`'s canonical one.
**Why:** Two independent migration paths against a shared environment is a direct route to schema drift and a corrupted `SequelizeMeta` history — restated here because a Turborepo monorepo makes it structurally easy for a second app to accidentally acquire its own migration runner unless this is explicit.
**Right way:** `knowledge/02-turborepo-boundaries.md` §"Package ownership rules."

## WDS-012 — Never hard-delete an `audit_events` row through application code, regardless of retention status

**Severity:** P1
**What:** Only the retention-deletion job (`knowledge/11-retention-backup-and-operations.md`), operating on a fully-elapsed retention period and `legal_hold = false`, may remove an audit event. No admin UI action, no manual data-fix script, no ad hoc query deletes an audit row.
**Why:** Immutability is the entire point of an audit trail intended to satisfy a 7-year regulatory-style retention requirement — a "just this once" manual deletion defeats it completely and is unrecoverable once done.
**Right way:** `knowledge/10-data-ownership-and-audit.md` §"Audit events."

## WDS-013 — Never merge the two agent taxonomies

**Severity:** P2
**What:** No code, data model, or documentation treats a dashboard business agent (Website Growth Director, etc.) as if it were a software-delivery role, or vice versa — including reusing the same table, the same permission-grant mechanism keyed identically, or the same "agent" terminology without disambiguating context.
**Why:** `SKILL.md §6` — conflating them produces confused ownership (who approves what, who's accountable for a bug) and was explicitly called out as a boundary to preserve.
**Right way:** `knowledge/00-scope-and-precedence.md` §5, `SKILL.md §6`.

## WDS-014 — Never treat Service and SEO Library spreadsheet/export data as approved business content

**Severity:** P2
**What:** No import or seed script writes spreadsheet-sourced service/keyword/persona/claim data directly into a Full-V1-classified library as if it had already passed the dashboard's own approval workflow.
**Why:** Explicit instruction (skill-build task §20/§21) not to treat incomplete spreadsheet sample data as approved business truth; also consistent with `03_Detailed_Module_Specifications.md §23`'s own "SEO-team data is advisory until... human approval" rule.
**Right way:** `knowledge/00-scope-and-precedence.md` §6.

---

## Code Review checklist addition (project-specific — scan alongside the base skill's NODE-xxx/FG-xxx checklist)

- [ ] No ACF reference anywhere in the WordPress repository (WDS-001)
- [ ] No direct Neon provider selection in config/IaC (WDS-002)
- [ ] No non-East-Coast region in any provisioning config (WDS-003)
- [ ] No Resend (or other transactional-email API) client/SDK import (WDS-004)
- [ ] No `server.js`/persistent-listener pattern in `dashboard-worker` (WDS-005)
- [ ] No "clean"/"malware-free"/"scanned" copy without a configured scanner (WDS-006)
- [ ] No auto-merge/auto-push-to-protected-branch/auto-deploy-production code path (WDS-007)
- [ ] No completion marked without a live remote-SHA verification call (WDS-008)
- [ ] No unattended Anthropic API call triggering a dashboard business agent (WDS-009)
- [ ] No duplicate `class-validator` DTO shadowing a `packages/validation` Zod schema (WDS-010)
- [ ] No migration runner outside `packages/database` (WDS-011)
- [ ] No `audit_events` `DELETE`/`UPDATE` outside the retention job (WDS-012)
- [ ] No cross-taxonomy conflation of software-delivery roles and dashboard business agents (WDS-013)
- [ ] No unreviewed spreadsheet data written directly into an approved-status library record (WDS-014)
