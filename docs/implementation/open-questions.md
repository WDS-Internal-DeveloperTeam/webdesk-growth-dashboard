# Open Questions and Blockers — WebDesk Website Growth Dashboard

**Status:** Draft for review.
**Scope rule applied:** only questions that genuinely cannot be answered from the Dashboard Documentation Pack or the WebDesk Node.js Delivery System skill are listed here. Items the dashboard pack already acknowledges as deferred-to-setup (`12_Open_Items_and_Implementation_Inputs.md`) are **not** repeated here — they already have an answer ("resolve at setup, before the relevant gate"). Routine "verify-at-discovery" implementation details (exact GitHub API rate limits, exact WordPress plugin inventory) are also excluded — those are normal discovery work, not blockers, and are tracked in `gap-analysis.md` instead.

Each item states: the question, why it cannot be resolved from the documentation, what's actually at stake if it's answered wrong or left implicit, and who should decide.

---

## OQ-01 — Postgres provisioning path vs. the Neon exclusion

**Question:** Which specific Postgres product satisfies both "PostgreSQL provisioned through Vercel" (`01_Dashboard_Master_Specification.md §5`) and "Neon excluded" (same line) simultaneously?

**Why this can't be resolved from the documentation:** The two clauses sit in the same table row without reconciliation, and Vercel's own first-party Postgres offering has been built on Neon's underlying technology — the pack doesn't say whether "Neon excluded" means excluding Neon *as a standalone, self-managed product* (fine, use Vercel's integrated Postgres regardless of what powers it underneath) or excluding *any* Neon-based offering (in which case "provisioned through Vercel" and "Neon excluded" may be in direct tension, depending on what Vercel's Postgres marketplace/integration options look like at implementation time). Neither the dashboard pack nor the skill has any opinion on Vercel's product lineup.

**What's at stake:** This is a G-Schema blocker — the database provider must be selected before the data model is approved and before any migration runs. Choosing wrong means either violating an explicit exclusion or failing to meet the "through Vercel" requirement, either of which likely means a database migration (in the literal, painful sense) after data already exists.

**Who should decide:** WebDesk's infrastructure/DevOps owner, confirmed against Vercel's current marketplace integrations at setup time, before G-Schema.

---

## OQ-02 — Execution model for `apps/dashboard-api` and `apps/dashboard-worker` on Vercel

**Question:** Does `apps/dashboard-api` (NestJS) run as Vercel Functions with per-request cold starts, or on a persistent-compute path? Separately, is `apps/dashboard-worker` a long-running Node process (traditional BullMQ-style workers, node-cron-style in-process schedulers, with the skill's graceful-shutdown/connection-draining guidance applying as documented), or is it fully decomposed into Vercel Function handlers invoked by Vercel Queues/Workflows/Cron with no persistent process at all?

**Why this can't be resolved from the documentation:** The dashboard pack names the products (Vercel Functions, Queues, Workflows, Cron Jobs) but never states the execution topology. This is a materially different engineering decision each way: a NestJS app bootstrapping its full dependency-injection graph on every cold-started Function invocation has real latency/cost implications the pack doesn't address; a worker with no persistent process has no in-process lock to hold for overlapping-run prevention and must rely entirely on a database-row lock (`sync_states`/`scan_runs.locked_until`-style) instead. The skill has detailed guidance for the persistent-process model and none for the fully-serverless one — it cannot supply the missing answer, only describe the fork.

**What's at stake:** This decision reshapes the entire `dashboard-worker` codebase and the job-handling code in every later phase (Scan Center, Notification Center, Import/Export, the WordPress/GitHub sync work). Getting it wrong after Phase 1–2 code is written means a significant rewrite, not a config change. It may also surface a genuine infrastructure question worth escalating: if a persistent process turns out to be materially better for the worker (e.g., for a long-running WordPress migration job or a multi-hour initial scan), does "Vercel Pro" alone satisfy that, or does the approved architecture need a narrowly-scoped addition (e.g., a single long-running compute target) — which would itself need sign-off, since it's outside the technology list as currently approved.

**Who should decide:** The Architect role, at G1.5, in consultation with whoever holds Vercel platform expertise on the WebDesk side — this is a technical feasibility question as much as a design one, and may need a small technical spike (not full implementation) before the ADR can be written with confidence.

---

## OQ-03 — Relationship between the two authorized SSO domains

**Question:** `webdesksolution.com` and `webdeskinc.com` are both listed as verified Google Workspace domains for standard-user authentication (`01_Dashboard_Master_Specification.md §14`). Are these two email domains belonging to **one single organization** (e.g., a legal-entity or branding history reason for two domains), or do they represent **two related but distinct business entities** whose data might need some degree of separation within the dashboard?

**Why this can't be resolved from the documentation:** Nothing in the pack explains why two domains are named, and nothing describes any data-partitioning behavior tied to which domain a user authenticated from. The pack's V1 exclusions ("No public client portal," "No multi-client SaaS billing") rule out the skill's *default* multi-client-SaaS interpretation, but they don't by themselves rule out a narrower two-entity partitioning need specific to these two named domains.

**What's at stake:** This is the one place where the skill's tenant-scoping machinery (`nodejs/knowledge/database/03-multi-tenancy.md`, NODE-104) might turn out to be **literally applicable rather than just conceptually adjacent** — every other part of this review treats the dashboard as effectively single-tenant and reinterprets `project_id` as the scoping key instead of `tenant_id` (`requirements-traceability-matrix.md` Part C notes). If the two domains in fact represent entities whose data must not cross-contaminate, that changes the RBAC and repository-scoping design materially, and is far cheaper to build correctly from Phase 1 than to retrofit after Phase 3+ content modules exist.

**Who should decide:** WebDesk leadership/PM, confirmed at Discovery (G0.5) before Phase 1's RBAC and scoping design is finalized.

---

## OQ-04 — Scope and format of the Agent Directory and Agent Specification Library

**Question:** Do dashboard modules #26 (Agent Directory) and #27 (Agent Specification Library) exist to **govern the WebDesk Node.js Delivery System's own software-delivery agents** (PM, Architect, Backend, Frontend, QA, Code Review, Delivery Head — the roster this skill already defines in `_spine/orchestrator/SKILL.md`), or to define a **separate, dashboard-specific taxonomy of content-production agent personas** (e.g., a content-writing agent, an SEO agent, a design-review agent) invoked manually for website-page work through the Ready for Claude Queue — distinct from, and unrelated to, the delivery system's own agents?

**Why this can't be resolved from the documentation:** `03_Detailed_Module_Specifications.md §26–27` describes fields (agent name, mission summary, version, permissions, knowledge libraries, outputs, approval gates, test status) and mentions "the approved 19-section agent specifications" without ever defining what the 19 sections are or pointing to a template. No file in the skill uses a 19-section format for any agent definition (the skill's own agents are `SKILL.md` frontmatter + `knowledge/*.md` files, a different shape entirely). The two possible readings lead to genuinely different implementations — one is essentially a read-only mirror of the delivery system's existing agent roster; the other is a net-new content-taxonomy module with its own governance model to design from scratch.

**What's at stake:** Low implementation risk either way (`02_Version_1_Module_Inclusion_Matrix.md` marks both modules "Foundation Only" — records/views exist, automated execution deferred), but the ambiguity should be resolved before Phase 7 (where these modules are scheduled) rather than guessed at build time, since the two interpretations produce different data models.

**Who should decide:** PM role, at or before the Phase 7 kickoff for these two modules — low urgency, but should not be left to an implementer's guess given the undefined 19-section reference.

---

## Summary

| ID | Question | Blocks | Urgency |
|---|---|---|---|
| OQ-01 | Postgres provisioning path vs. Neon exclusion | G-Schema | Before Phase 1 |
| OQ-02 | Vercel execution model for API + worker apps | G1.5 architecture ADR, all job-handling code | Before Phase 0 exits |
| OQ-03 | Relationship between the two SSO domains | RBAC/scoping design | Before Phase 1 |
| OQ-04 | Agent Directory / Agent Specification Library scope | Phase 7 data model only | Before Phase 7 |

Everything else surfaced during this review — including every item in `gap-analysis.md` not listed above — has either an existing answer in one of the two source documents, an explicit "resolve at setup" deferral already recorded in `12_Open_Items_and_Implementation_Inputs.md`, or a clear owning role and gate identified in `phased-implementation-plan.md` that does not require new information from the client to proceed.
