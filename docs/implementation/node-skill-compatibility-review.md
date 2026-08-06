# Node.js Skill Compatibility Review — WebDesk Website Growth Dashboard

**Status:** Draft for review. This review, and the five companion documents it summarizes, contain **no production application code, database migrations, or scaffolding**. Nothing described here has been built. This package exists to support a **human approval decision** before implementation begins.

**Inputs reviewed in full:**
- Dashboard Documentation Pack v1 (2026-08-04) — all 12 documents plus README and manifest, `webdesk-dashboard-documentation-v1/`.
- WebDesk Node.js Delivery System skill v0.2.4 — the `nodejs/` platform arm in full (SKILL.md, all `knowledge/*` including intelligence modules, `projects/custom-app-build/*`), the `_spine/` shared machinery relevant to a custom-app-build project (orchestrator, gate-format, forbidden-global, security-baseline, CONVENTIONS, model-policy, git-branch-strategy, the designer agent's dashboard-standards), and the system's `_contracts/` schemas (`project-json.schema.json`, `gate-format.md`).

**Companion documents produced alongside this one:**
1. [`requirements-traceability-matrix.md`](requirements-traceability-matrix.md) — every major dashboard requirement mapped to skill instructions, with a compatibility status per requirement.
2. [`architecture-validation.md`](architecture-validation.md) — the 16 approved architecture components validated one by one, on the explicit ground rule that an approved technology is never replaced merely because the skill prefers something else.
3. [`gap-analysis.md`](gap-analysis.md) — specifications missing from both sources, organized by the 17 areas called out in the review brief.
4. [`phased-implementation-plan.md`](phased-implementation-plan.md) — a 10-phase build plan (Phase 0–9) mapped to the skill's own gate sequence.
5. [`open-questions.md`](open-questions.md) — four genuine blockers that cannot be answered from either source document.

---

## 1. Executive summary

**The dashboard as specified is buildable using this skill as its governing delivery process, with no changes to the skill's core rules.** Across roughly 70 requirement-level comparisons in the traceability matrix, **zero true conflicts** were found between the dashboard's approved architecture/requirements and the skill's forbidden patterns, layering discipline, or process rules. Every divergence from the skill's stated *defaults* — NestJS instead of Express, a Turborepo monorepo, Vercel's serverless job/queue/hosting primitives, Google Workspace SSO instead of local credentials, pnpm instead of npm — falls into one of three buckets, and none of them is "conflict":

- **Already anticipated** by the skill as an approved alternative (NestJS is literally enumerated in `project-json.schema.json`'s framework list; pnpm is explicitly named as an acceptable package manager). These need only a recorded justification at the relevant gate, which the skill's own "ask-if-missing" rule already expects.
- **A straightforward extension** of an existing pattern (Vercel Blob is behaviorally S3; the dashboard's RBAC action vocabulary is a superset of the skill's own extensible action model, which was purpose-built by the skill's maintainers to avoid exactly this kind of hardcoded ceiling — see `_decisions/decision-inventory.md` D-013/D-015).
- **Genuinely new territory** for the skill (Vercel's serverless job execution model, Google Workspace OIDC, GitHub/WordPress as product integrations) — these need new knowledge authored *within* the skill's existing structure (new files under `nodejs/knowledge/security/`, `nodejs/integrations/`), not a change to the skill's architecture or rules.

The dashboard pack's own operating philosophy — human-gated approval at every stage, no self-approval, immutable audit events, commit-SHA-is-proof-of-completion, "no automatic Anthropic API execution" — is not merely *compatible* with this skill; it is, in several places, a direct product-level reimplementation of the skill's own gate discipline (Ready for Claude Queue mirrors the skill's own G3→G4→G5 manual-execution and branch/PR/staging/production tracking; the dashboard's seven-state approval semantics mirror `gate-format.md`'s CONFIRM/REJECT/REVISE/RENEGOTIATE almost exactly). This is the strongest compatibility signal in the entire review: the two systems were designed by different people for different purposes and converged on the same governance shape independently.

**Where real work remains** is not in reconciling disagreements but in **filling gaps neither source has addressed yet** — most concentrated in one architecture question (how background jobs and API compute actually execute on Vercel — see `open-questions.md` OQ-02) and one authentication question (Google Workspace SSO has no precedent anywhere in the skill's ~200 files — see `architecture-validation.md` §12). Both are scoped as Phase 0 architecture decisions in the implementation plan, not open-ended risks.

---

## 2. Node.js Skill Reuse Assessment

This section classifies every relevant part of the skill for this specific project, per the review brief's five categories. "This project" means the WebDesk Website Growth Dashboard build specifically — a `custom-app-build` project (Shape 2: API + admin dashboard, unioned with Shape 3: worker/jobs service, per `nodejs/projects/custom-app-build/knowledge/01-app-shapes.md`).

### 2.1 Reused unchanged

These apply to the dashboard build exactly as written, with no adaptation:

- **`_spine/shared-knowledge/CONVENTIONS.md`, `gate-format.md`, `model-policy.md`, `context-budget.md`** — the delivery-process machinery (gate lifecycle, tiered file loading, model-selection policy) is entirely process-level and platform-agnostic; nothing about this project's technology choices affects it.
- **`_spine/shared-knowledge/git-branch-strategy.md`** — the `main`/`staging`/`feature`/`fix`/`hotfix`/`chore` branch model and protection rules apply to both project repositories unmodified.
- **`_spine/shared-knowledge/forbidden-global.md` (FG-001 through FG-012)** — every cross-cutting NEVER (no secrets in code, no unvalidated input, no silent catch, no direct DB access outside repositories, no fabricated API calls, no unscoped queries) applies to this project exactly as stated.
- **`nodejs/knowledge/09-forbidden.md` (NODE-001 through NODE-104)** — same, at the Node-arm level. NODE-104's literal "tenant" language is reinterpreted as "project" scoping (see §2.2), but the *rule* — every repository query is scoped, fail closed on a missing scope, the master/cross-scope path is explicit and audited — is reused unchanged in substance.
- **`nodejs/knowledge/01-coding-standards.md`, `02-naming-conventions.md`** — ESM, `async/await`-only, `const`/`let`, kebab-case files, camelCase identifiers, snake_case DB columns, versioned kebab-case API routes all apply unmodified.
- **`nodejs/knowledge/database/01-modeling-and-indexing.md`, `02-migrations-and-rollback.md`** — Sequelize modeling, indexing, and the reversible-migration/zero-downtime-expand-contract discipline apply unmodified; this is the single strongest unmodified-reuse area in the entire skill, since Sequelize+Postgres is the skill's own default and the dashboard's requirement is identical.
- **`nodejs/knowledge/security/01-owasp-api.md`, `03-secrets-and-config.md`, `04-webhook-security.md`, `05-pii-and-compliance.md`** — OWASP API Top 10 controls, env-based secrets with encryption-at-rest for persisted tokens, HMAC webhook verification, and PII-handling baseline all apply unmodified.
- **`nodejs/knowledge/frontend/01-react-next-standards.md`** — Next.js App Router structure, server-component data fetching, TanStack Query/SWR client state, and form validation patterns apply unmodified.
- **`nodejs/knowledge/testing/01-api-and-integration-tests.md` (contract-test shape), `03-dashboard-ui-tests.md`** — the test-layer structure (unit/repository/API-contract/integration) and the Playwright+axe+Lighthouse dashboard-UI stack apply unmodified.

### 2.2 Reused with project-specific configuration

These apply with a recorded parameter/decision, not a rewrite:

- **`nodejs/knowledge/database/03-multi-tenancy.md`** — the *mechanism* (repository-layer scoping, fail-closed default scope, explicit-and-audited master path) is reused, but the scoping key changes from `tenant_id` to `project_id`, and the "master" concept is reinterpreted as this system's Super Admin role rather than a cross-client SaaS oversight dashboard (pending confirmation of `open-questions.md` OQ-03 — if the two SSO domains turn out to need real separation, this file's guidance becomes *more* literally applicable, not less).
- **`nodejs/knowledge/security/02-authn-authz.md`** — the JWT access+refresh/rotation/revocation session model and the extensible per-module RBAC matrix are reused as the **post-SSO session layer**; the front-door authentication mechanism is not (see §2.4).
- **`nodejs/knowledge/frontend/02-admin-dashboards.md`, `_spine/designer-agent/knowledge/01-dashboard-standards.md`** — the SOW-driven module philosophy, RBAC-gated UI, and theme-customizer implementation pattern are reused; the "Master dashboard with per-instance health score" checklist item does not apply to this single-organization system and should be dropped from the G2 mockup acceptance checklist for this project specifically.
- **`nodejs/knowledge/technology-selection.md`, `intelligence/database-intelligence.md`, `intelligence/integration-intelligence.md`** — the *decision framework* ("read the stack from spec.md, default where silent, ask where a layer is new") is reused; the actual choices it's applied to (NestJS, Vercel Blob, Vercel Queues) are project-specific configurations recorded at the relevant gate, not defaults.
- **`nodejs/knowledge/testing/02-load-and-chaos.md`** — the load/soak/chaos-testing *discipline* is reused; the specific tooling and target (k6/Artillery against a running server) needs configuring once `open-questions.md` OQ-02 resolves whether there's a persistent server process to load-test in the traditional sense, or whether load testing targets Vercel's platform-managed concurrency instead.

### 2.3 Extended

These need genuinely new content added *within* the skill's existing structure, following its existing patterns:

- **`nodejs/integrations/`** — needs three new sibling modules to `bigcommerce/`, `shopify/`, `erp/`: a `github/` module (App auth, Octokit conventions, PR/commit/deployment verification), a `wordpress/` module (REST API + Application Passwords, WP-CLI allowlisting, the native structured-content adapter pattern), and (optionally, low-priority) a small `email/` note for SMTP delivery patterns. All three follow the existing adapter-behind-an-interface shape already established by `integrations/erp/_erp-adapter-pattern.md`.
- **`nodejs/knowledge/security/`** — needs a new file covering Google Workspace OIDC verification, domain allowlisting, and TOTP for local emergency accounts (`architecture-validation.md` §12) — the largest genuinely new security pattern this project introduces to the skill.
- **`nodejs/knowledge/integration/02-queues-and-jobs.md`** — needs a new row/section covering Vercel Queues/Workflows/Cron Jobs alongside the existing node-cron/BullMQ comparison, once `open-questions.md` OQ-02 is resolved.
- **`nodejs/projects/custom-app-build/knowledge/01-app-shapes.md`** — would benefit from (not strictly required, but recommended given this project's structure) a note on combining Shape 2 and Shape 3 *within a single Turborepo workspace* rather than as separate repos, since the existing "combining shapes" guidance (`§ Combining shapes`) assumes shared code, not a formal monorepo package boundary.
- **`_contracts/project-json.schema.json`** — needs `vercel` added to the `host_target` enum and (for this project's local use, not necessarily proposed upstream) `vercel-blob` added to the storage enum, per `architecture-validation.md` §9/§11.

### 2.4 Overridden for this project

These are cases where the skill's stated *default* is explicitly not used, replaced by an approved alternative, with the override recorded at the appropriate gate per the skill's own process (not a rule violation — the skill's "ask-if-missing"/"record the choice" rule is exactly the mechanism that makes this a normal, sanctioned outcome rather than an exception):

- **Backend framework:** NestJS instead of Express (schema-anticipated; record at G1.5).
- **Runtime version:** Node 24 instead of the skill's worked-example pin of Node 22 (satisfies the underlying "active LTS, 22+" rule; record at G1.5/G3).
- **Test runner:** Vitest as the primary runner instead of `node:test` (an explicitly sanctioned escalation under the skill's own "vitest when its features are actually needed" allowance, given the TypeScript+monorepo context).
- **Object storage:** Vercel Blob instead of S3/Cloudinary/GCS (behaviorally equivalent; record at G1.5/G-Schema).
- **Background job/queue infrastructure:** Vercel Queues/Workflows/Cron Jobs (+ Upstash QStash fallback) instead of node-cron/BullMQ, once the execution-model ADR resolves the mechanism (`open-questions.md` OQ-02).
- **Authentication front door:** Google Workspace SSO instead of local username/password as the primary path (local credentials retained only for TOTP-secured emergency admin access — the inverse of the skill's assumed default weighting).
- **Package manager:** pnpm instead of npm (explicitly sanctioned in `backend/02-node-lts-and-engines.md`).

None of these overrides touches a *forbidden pattern* (NODE-xxx/FG-xxx) or the layering discipline — they are all default-technology-choice overrides, which is exactly the category the skill's process is designed to accommodate via gate-recorded justification, not the category (architectural/layering rule) where an override would actually be concerning.

### 2.5 Excluded

Parts of the skill that do not apply to this project and should not be loaded/followed, per the skill's own context-budget discipline (`CONVENTIONS.md §6`: "load KB only for the active project_type + integration_targets... never load another project-type's or platform's KB"):

- **`nodejs/integrations/bigcommerce/`, `nodejs/integrations/shopify/`, `nodejs/integrations/erp/*`** — none of these integration targets apply; this project's `integration_targets` are `github`, `wordpress`, `google-workspace` (SSO+SMTP), none of which match the skill's existing e-commerce/ERP integration roster. Only the *adapter pattern* (`_erp-adapter-pattern.md`) is reused as a structural template (§2.3); the specific BigCommerce/Shopify/ERP content itself is excluded from loading.
- **`nodejs/projects/integration-middleware/`, `nodejs/projects/frontend-tool/`, `nodejs/projects/version-upgrade/`, `nodejs/projects/maintenance/`** — this is a `custom-app-build` project; the other four project-type skills do not apply and should not be loaded during implementation (per the orchestrator's own refusal rule, `_spine/orchestrator/SKILL.md` Critical Rule #10).
- **`nodejs/knowledge/integration/01-sync-strategies.md`'s continuous-cron-ERP-sync framing** — the *specific* "permanent ERP↔store sync engine" framing this file is built around does not apply (this project has no ERP), though its generalizable sub-patterns (reconciliation/drift-healing, watermark discipline) are directly useful as design references for the Scan Center and Change Center (`requirements-traceability-matrix.md` Part C, modules #32–33) — reused as a *pattern reference*, not as the literal ERP-sync content.
- **`nodejs/knowledge/intelligence/failure-scenario-library.md`'s ERP-specific failure catalog entries** — entries 6 (token/credential expiry mid-*ERP*-sync) and 12 (two-way ERP↔store conflict) are ERP-sync-specific; the general failure-mode categories they represent (timeout, duplicate delivery, partial/interrupted run, overlapping runs, rate limiting) remain directly applicable to the GitHub/WordPress integrations and are reused; the ERP-specific framing around them is not.

---

## 3. Architecture validation (summary)

Full detail in `architecture-validation.md`. All 16 approved architecture components were validated **as approved and kept** — the review found no basis to recommend replacing any of them with a skill-preferred default. Summary:

| Outcome | Components |
|---|---|
| Exact match to skill default | Next.js App Router, Sequelize+migrations, Zod validation, Pino logging |
| Schema-anticipated / explicitly sanctioned alternative | NestJS, pnpm |
| Behaviorally equivalent to a skill default, different provider name | PostgreSQL (via Vercel), Upstash Redis, Vercel Blob |
| Compatible, needs a new structural pattern authored | Turborepo monorepo, worker app inside the monorepo, TypeScript adaptation of skill examples |
| Compatible, largest adaptation effort | Vercel Functions/Queues/Workflows/Cron Jobs (properties transfer, mechanism needs an ADR) |
| Compatible, largest new-knowledge effort | Google Workspace SSO, GitHub App integration, WordPress REST/WP-CLI integration |
| Fully compatible, policy already aligned | Separate dashboard/WordPress repositories, Google Workspace SMTP |

**No conflicts. No recommended replacements.**

---

## 4. Gap analysis (summary)

Full detail in `gap-analysis.md`, organized across the 17 areas in the review brief (Authentication, Permissions, Database migrations, Queue processing, Idempotency, Webhooks, Import/export, Git synchronization, WordPress synchronization, Audit logging, File handling, Retention, Backups, Testing, Deployment, Observability, Security). The pattern across nearly every gap is the same: **the skill supplies a mechanism or discipline that generalizes correctly, but no worked example yet exists for this project's specific instance of it** (e.g., idempotency-by-external-ID generalizes to idempotency-by-internal-action; the generic Cron-job mechanism generalizes to a retention-deletion job, but no retention-job *design* exists in the skill to copy). Three areas are the exception, where the gap is a genuinely new capability with no adjacent skill pattern to extend: **retention/legal-hold lifecycle design**, **SSO/OIDC authentication**, and **the Vercel-native job-execution model**.

---

## 5. Proposed implementation phases (summary)

Full detail in `phased-implementation-plan.md`. Ten phases (0–9), sequenced: architecture decisions first (Phase 0) → auth/RBAC/scaffold (Phase 1) → governance/workflow backbone (Phase 2) → content libraries (Phases 3–4) → external integrations, gated per-integration at G-Contracts (Phase 5) → delivery-operations modules that depend on those integrations (Phase 6) → import/export and remaining libraries (Phase 7) → observability/security/backup/retention hardening (Phase 8) → launch (Phase 9). Each phase specifies modules, dependencies, repository/database/API changes, required tests, acceptance criteria, risks, and required gate approvals.

---

## 6. Questions and blockers (summary)

Full detail in `open-questions.md`. Four genuine blockers, none of them a disagreement between the dashboard pack and the skill — all four are places where **neither source has an answer at all**:

1. Postgres provisioning path vs. the Neon exclusion (apparent contradiction, needs setup-time confirmation).
2. The execution model for API and worker compute on Vercel (persistent process vs. serverless-native) — the single highest-leverage unresolved architecture question in the whole review.
3. Whether the two authorized SSO domains represent one organization or two entities that may need data separation.
4. Whether the Agent Directory/Agent Specification Library modules govern this skill's own delivery agents or a separate content-production agent taxonomy.

---

## 7. Recommendation

This review found the dashboard's approved architecture and the WebDesk Node.js Delivery System skill to be **substantially compatible**, with alignment strong enough in the governance/workflow area to suggest the two were built with a shared philosophy even though they were authored independently. The remaining work is concentrated, identifiable, and schedulable: two architecture ADRs (job-execution model, SSO), a handful of new integration-adapter knowledge files following an existing pattern, and four stakeholder questions that need answers before Phase 0 closes.

**No production application code, database migrations, or scaffolding has been produced.** No packages have been installed. No WordPress environment has been touched. No deployment has occurred.

This package — this document plus the five companions — is submitted for human review and approval. Per the task brief, implementation does not begin until that approval is given.
