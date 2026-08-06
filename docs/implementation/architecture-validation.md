# Architecture Validation — Approved Dashboard Architecture vs. WebDesk Node.js Delivery System Skill

**Status:** Draft for review. No application code, migrations, or scaffolding produced.
**Ground rule applied throughout:** per the review brief, an approved technology is never replaced merely because the skill prefers a different default. Every item below is validated as **approved-and-kept**; the only question answered per item is _how it fits the skill's process_, not _whether it should be swapped out_.
**Companion documents:** `node-skill-compatibility-review.md`, `requirements-traceability-matrix.md`, `gap-analysis.md`, `phased-implementation-plan.md`, `open-questions.md`.

## How validation was performed

For each approved component, this document checks it against three things the skill actually constrains:

1. **Layering/forbidden-pattern compatibility** — does the component obstruct controller/service/repository separation, repository-only DB access (NODE-003/FG-004), or any other NODE-xxx/FG-xxx rule?
2. **Documented-alternative status** — is the component already named as an approved alternative in `technology-selection.md`, `project-json.schema.json`, or `intelligence/*` (in which case it needs only a recorded justification, per the skill's own "ask-if-missing" rule), or is it entirely outside the skill's vocabulary (in which case it needs new knowledge authored, not a rule change)?
3. **Gate impact** — which gate (G1.5, G-Contracts, G-Schema, G2) is the natural place to record and approve the choice, per `_contracts/gate-format.md`.

No item below was found to require _removing or weakening_ any skill rule (layering, validation-at-the-boundary, idempotency, tenant/project scoping, no-secrets, no-auto-deploy). Every approved technology is implementable **within** the skill's existing forbidden-pattern and layering discipline.

---

## 1. Turborepo monorepo

**Validation: Approved and kept. Structural extension to the skill required — not a conflict.**

The skill's canonical project layout (`nodejs/knowledge/01-coding-standards.md`) and service-skeleton template (`nodejs/templates/service-skeleton/`) both assume one deployable service per repository. Turborepo is not mentioned anywhere in the skill. This is a genuine structural gap, not friction with a documented default — the skill simply has never modeled a monorepo before.

What _does_ transfer cleanly into a Turborepo layout, unchanged:

- The controller/service/repository layering (`00-overview.md`) applies **per app** (`apps/dashboard-api`, `apps/dashboard-worker`) exactly as documented.
- The architecture-fitness enforcement (dependency-cruiser config, `nodejs/templates/architecture-tests/dependency-cruiser.config.cjs`) needs one config per app rather than one at repo root, but the _rule_ it enforces (no DB access outside `repositories/`, FG-004) is unchanged.
- Forbidden-pattern rules (NODE-xxx) apply uniformly across every package/app in the workspace — nothing in them is repo-topology-dependent.
- The single-package-manager rule (`backend/02-node-lts-and-engines.md`: "one manager per repo, no mixing") is satisfied trivially — a Turborepo workspace has exactly one root lockfile by design.

What needs new decisions, recorded at **G1.5**:

- Build/dependency graph between `packages/database`, `packages/shared-types`, `packages/validation`, `packages/ui`, `packages/integrations`, `packages/configuration` and the three apps (which packages are TypeScript-project-referenced vs. published-and-consumed; Turborepo pipeline `dependsOn` ordering).
- Migration ownership: exactly one app/package may run Sequelize migrations against a shared environment (see `requirements-traceability-matrix.md` DASH-ARCH-05) — the skill's "migrations are reviewed like code, CI dry-runs them" discipline (`database/02-migrations-and-rollback.md`) needs a single home to attach to.
- CI wiring: the skill's CI sequence (`testing/01-api-and-integration-tests.md`: install → lint → typecheck → test → audit → migration dry-run) needs to become Turborepo-pipeline-aware (`turbo run lint test build --filter=...`) so unaffected packages aren't rebuilt/retested on every PR.

**Recommended action:** Produce a short ADR at G1.5 ("Monorepo structure and build boundaries") using `_spine/architect-agent/knowledge/03-adr-authoring.md`'s format. No skill rule needs to change; the ADR documents how the existing rules map onto the new topology.

---

## 2. Next.js App Router frontend

**Validation: Approved and kept. Fully compatible — this is the skill's own default.**

`nodejs/knowledge/frontend/01-react-next-standards.md` is written specifically for a Next.js App Router dashboard: the directory layout example (`app/(auth)/`, `app/(dashboard)/`, `components/ui`, `components/modules`, `lib/api-client.js`) is directly usable. `frontend/02-admin-dashboards.md`'s RBAC-gated UI, theme customizer (CSS variables + `data-skin`/`data-mode` attributes), and master-vs-per-client scoping pattern (reinterpreted per project-scoping — see §9 below) all apply without modification.

No action needed beyond normal G2 (design approval) and G3 (scaffold) execution.

---

## 3. NestJS backend API

**Validation: Approved and kept. Anticipated alternative — needs a recorded justification and a small adaptation note, not a rule change.**

This is worth stating plainly: NestJS is **not** an unlisted, off-menu framework. `_contracts/project-json.schema.json`'s `tech_stack.framework` enum is `["express", "fastify", "nest", "next"]` — Nest is already a first-class, schema-recognized choice. Only the skill's _narrative_ text and worked examples default to Express; the schema itself already anticipated this exact override.

Everything the skill actually enforces maps onto Nest cleanly:

| Skill rule                                                                  | Express shape (skill's examples)                        | NestJS shape (same rule, different syntax)                                                                                                                                                                                    |
| --------------------------------------------------------------------------- | ------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Controllers HTTP-only, no business logic (NODE-003 companion)               | Express route handler                                   | Nest `@Controller()` class — arguably _easier_ to keep thin since Nest's convention already separates controllers from providers                                                                                              |
| Business logic in services, no `req`/`res` (`01-coding-standards.md`)       | plain service module                                    | Nest `@Injectable()` service — DI makes the "service never touches HTTP objects" rule structurally natural                                                                                                                    |
| Repository-only DB access (NODE-003, FG-004)                                | `repositories/*.js`                                     | Nest repository provider (e.g. injected `Repository`/custom provider wrapping Sequelize) — same isolation, enforced by the same dependency-cruiser fitness test pattern                                                       |
| Validate all external input at the boundary (NODE-005)                      | zod `.parse()` in the controller                        | Nest `ValidationPipe` — can be wired to the **same Zod schemas** (via a custom Zod-backed pipe) rather than parallel `class-validator` DTOs, keeping one schema source per `requirements-traceability-matrix.md` DASH-ARCH-10 |
| Centralized error handling, typed errors (NODE-006/007)                     | Express error-handling middleware (4-arg, mounted last) | Nest exception filters (`@Catch()`) — same centralization, Nest-native mechanism                                                                                                                                              |
| Middleware order incl. raw-body-before-JSON for webhook HMAC (`backend/01`) | explicit Express `app.use()` ordering                   | Nest middleware/guards/interceptors execution order — **order-sensitive in the same way**; raw-body capture must still precede JSON body-parsing for any webhook route (GitHub webhooks, DASH-ARCH-12)                        |
| Health endpoints (`backend/01`)                                             | `app.get('/healthz', ...)`                              | Nest controller equivalent, same liveness/readiness split                                                                                                                                                                     |

**Gap, not conflict:** the skill has no NestJS-specific worked example anywhere. This is a documentation gap the project will hit immediately at scaffold time, not an architectural obstacle.

**Recommended action:** Record the framework choice + one-line justification at **G1.5**, satisfying `technology-selection.md`'s "ask-if-missing" rule (already effectively satisfied — Nest is pre-approved in the schema). Author a short adaptation note (could live at `nodejs/knowledge/backend/03-nestjs-adaptation.md` or as a project-local doc) translating the Express-shaped middleware-order and error-handling examples into their Nest equivalents before scaffold (G3), so the webhook raw-body-ordering rule in particular isn't lost in translation.

---

## 4. Separate worker application

**Validation: Approved and kept. Directly maps to an existing skill shape.**

`nodejs/projects/custom-app-build/knowledge/01-app-shapes.md` Shape 3 ("Worker / jobs service") is written for exactly this: scheduler/queue-consumer → job handlers → services → repositories, no synchronous request surface (or a thin health/admin API only), idempotent and resumable jobs, capped retries, overlapping-run prevention, timezone-aware scheduling driven by Settings.

Shape 3 explicitly fires **G1.5** (async work is a listed trigger) and requires **queue visibility** at G5.5 observability — both already implied by the dashboard's own requirements (09, 08 §8).

The one adjustment needed is structural, not behavioral: Shape 3 assumes a standalone repo; here it's a workspace package sharing `packages/database` with `apps/dashboard-api` (see §1). The job-execution _properties_ Shape 3 requires (idempotency, capped retries+DLQ, no overlapping runs, watermark/lock discipline) apply unchanged regardless of whether the underlying execution mechanism is a persistent BullMQ worker or Vercel Queues/Workflows invocations (see §5).

**Recommended action:** Adopt Shape 3's gate set as-is for `apps/dashboard-worker`; resolve the shared-database-package structure as part of the §1 ADR.

---

## 5. TypeScript

**Validation: Approved and kept. Compatible — strengthens rather than weakens the skill's rules.**

None of the skill's forbidden patterns (NODE-001…NODE-104) are JavaScript-specific in a way TypeScript would break — if anything, `tsc --strict` mechanically enforces several of them harder than ESLint alone (e.g., catching an accidental `any`-typed DB row leaking past a repository boundary). The skill's own worked examples are plain ESM JS with JSDoc annotations (`01-coding-standards.md`); TypeScript is a strict superset of that intent, not a departure from it.

The one adaptation: the skill's `eslint.config.js` example in the service-skeleton template targets plain JS. A TypeScript project needs the `typescript-eslint` equivalents of the same rules (`no-var`✝, `prefer-const`, `no-console`-for-errors, etc. — ✝TypeScript disallows `var` less strictly than ESLint's `no-var`, so the rule still needs explicit configuration).

**Recommended action:** Record TypeScript as the project's language choice at G1.5; adapt the service-skeleton's lint config at scaffold (G3). No skill rule changes.

---

## 6. PostgreSQL (via Vercel, North America East Coast; Neon excluded)

**Validation: Approved and kept for the database engine choice. Provisioning path requires setup-time clarification — see `open-questions.md` OQ-01.**

PostgreSQL is the skill's own documented default (`intelligence/database-intelligence.md`: "choose unless there's a specific reason not to"), so the engine choice itself needs no justification at all — it's the path of least resistance, not an override.

The region requirement (North America East Coast) and the Neon exclusion are provisioning-detail constraints the skill has no opinion on (it is host/provider-agnostic on database hosting). These are legitimately resolvable only at setup time, as the dashboard pack itself acknowledges (`12_Open_Items_and_Implementation_Inputs.md §1`: "exact PostgreSQL provider record shown through Vercel" is listed as a setup-time input). The one thing worth flagging now rather than at setup time is the apparent tension between "provisioned through Vercel" and "Neon excluded," since Vercel's first-party Postgres product has historically been Neon-based — this is not resolvable from the documentation alone and is carried into `open-questions.md`.

**Recommended action:** No architecture change. Confirm the exact provisioning product at setup, before G-Schema, per the dashboard pack's own open-items list.

---

## 7. Sequelize ORM with version-controlled migrations

**Validation: Approved and kept. Exact match to the skill's default — the strongest alignment point in the entire stack.**

`intelligence/database-intelligence.md` and `database/01-modeling-and-indexing.md`/`02-migrations-and-rollback.md` describe Sequelize as the default ORM with a level of specificity that matches the dashboard pack almost line-for-line: `underscored: true` for camelCase↔snake_case mapping, UUID v4 primary keys via `gen_random_uuid()`, `timestamptz` columns always stored UTC, reversible `up`/`down` migrations dry-run in CI, and the expand→backfill→migrate→contract zero-downtime pattern for schema changes against a live system.

The dashboard's base-entity standard (`04_Data_Model_and_Ownership.md §1`) adds columns the skill doesn't mandate by default (`public_id`, `version`, `lock_version` for optimistic concurrency, `retention_category`, `confidentiality`, `audit_context_id`) — this is a **superset**, not a divergence, and fits the skill's own "record the choice, note the default you applied or extended" discipline (`technology-selection.md`).

**Recommended action:** None beyond normal G-Schema execution. Use `database/01`/`02` as the direct implementation reference; document the extended base-entity columns once in `data-model.md` at G-Schema so every subsequent migration follows the same extended standard.

---

## 8. Zod and NestJS validation

**Validation: Approved and kept. Fully compatible, and the pairing is a natural fit.**

Zod is the skill's own default validation library (`01-coding-standards.md` NODE-005: "validate with a schema — zod/joi"), so this half of the requirement needs no justification. Pairing it with NestJS's own validation pipes is a direct extension of the skill's existing client/server dual-validation pattern (`frontend/01`: React Hook Form + Zod on the client, re-validated server-side) — the third leg (NestJS pipes) should consume the **same** Zod schemas (via a Zod-aware pipe) rather than introducing a parallel `class-validator` DTO layer, to avoid the schema-drift risk this would otherwise create between `packages/validation` (shared) and Nest-specific DTOs.

**Recommended action:** Put Zod schemas in `packages/validation`; wire NestJS pipes to validate against them directly. No skill change needed.

---

## 9. Vercel Functions, Vercel Queues, Vercel Workflows, Vercel Cron Jobs

**Validation: Approved and kept. This is the architecture area with the most real skill-adaptation work — flagged as such, not as grounds for reconsidering the choice.**

This is the one place in the entire architecture where "approved technology, skill needs adaptation" is a substantial adaptation rather than a documentation nicety. The distinction matters:

- **What is fully compatible, unchanged:** every _property_ the skill requires of background work — idempotency keyed on a stable external/natural key (NODE-102), capped retries with exponential backoff and jitter terminating in a DLQ (NODE-101), overlapping-run prevention via a per-entity lock with a TTL, timezone-aware scheduling computed from Settings and stored UTC, and a watermark that only advances after durable persistence (`integration/01-sync-strategies.md`) — is a description of _required behavior_, not of _BullMQ or node-cron specifically_. Vercel Queues, Vercel Workflows, and Vercel Cron Jobs can each satisfy every one of these properties; they just satisfy them through a managed-service API surface instead of an in-process library.
- **What genuinely doesn't transfer:** the skill's worked _mechanism_ examples (`backend/01-runtime-and-frameworks.md`'s graceful-shutdown sequence — "stop scheduler, drain queue workers, close DB pool, then exit" — and `integration/02-queues-and-jobs.md`'s BullMQ `Worker` instantiation) assume a **persistent process** that can be told to stop accepting new work and finish in-flight work before exiting. A Vercel Cron Job invokes an HTTP endpoint; a Vercel Function is invoked per-request/per-message with no long-lived process to "drain." There is nothing wrong with this model, but it is a different one, and the skill's shutdown guidance simply does not apply to it as written.

The dashboard pack's own design already anticipates this: `08_API_and_Integration_Contracts.md §8` defines `JobQueueAdapter`/`WorkflowAdapter` interfaces (`enqueue()`, `cancel()`, `getStatus()`, `start()`, `signal()`, `cancel()`) with Vercel Queues/Workflows as the primary implementation and Upstash QStash + Vercel Cron as the documented fallback — this is precisely the adapter-behind-an-interface pattern the skill already uses for ERP integrations (`integrations/erp/_erp-adapter-pattern.md`), applied one layer down to the job-execution provider itself. That the dashboard pack arrived at the same isolation pattern independently is a strong compatibility signal, even though the skill has never modeled _this_ adapter before.

**Open question this creates (see `open-questions.md` OQ-02):** whether `apps/dashboard-worker` is a persistent process (in which case the skill's graceful-shutdown and BullMQ-worker guidance apply largely unmodified, with the worker itself calling into Vercel Queues as a client) or is itself decomposed into Vercel Function handlers with no persistent process at all (in which case that guidance doesn't apply, and the relevant skill content becomes only the _properties_ table above, not the _shutdown-sequence_ mechanism).

**Recommended action:** Produce an ADR at G1.5 ("Job execution model on Vercel") mapping each required property to its Vercel-native mechanism, and stating explicitly which of the two worker-execution models above is chosen. This is exactly the kind of decision `_spine/architect-agent/knowledge/02-complexity-triggers.md`-style architecture review exists for, and it is squarely inside G1.5's trigger list (async/cron work, new datastore, estimate likely >80hrs).

---

## 10. Upstash Redis

**Validation: Approved and kept. Fully compatible — a named provider satisfying an unnamed skill requirement.**

The skill's queue-escalation guidance (`technology-selection.md`, `intelligence/integration-intelligence.md`) already names "BullMQ + Redis" as the concurrency/retry/DLQ escalation target and Redis as the rate-limiting mechanism (`security/01-owasp-api.md`: "per-route rate limits"; `09_Security_Backup_Retention_Operations.md §2`: "rate limiting through Upstash Redis"). Upstash is simply the specific managed-Redis product satisfying that generic requirement — no behavioral gap exists.

**Recommended action:** None. Record `REDIS_URL` (Upstash connection string) in `.env.example` per environment at scaffold.

---

## 11. Vercel Blob

**Validation: Approved and kept. Fully compatible in behavior; needs to be named as an approved storage alternative.**

`intelligence/database-intelligence.md`'s object-storage table lists S3 (default) / Cloudinary / GCS. Vercel Blob is functionally equivalent to the properties the skill actually cares about — private authenticated storage, direct-to-storage upload authorization for large files, checksum verification, time-limited signed download URLs, environment isolation — and `08_API_and_Integration_Contracts.md §7` specifies exactly these properties for Vercel Blob. This is a naming gap, not a behavioral one.

**Recommended action:** Record Vercel Blob as the object-storage choice at G1.5 (or G-Schema, since file metadata lives in Postgres per `04 §2`); no skill rule changes, since the required properties are already satisfied by the dashboard pack's own contract.

---

## 12. Google Workspace SSO

**Validation: Approved and kept. Requires genuinely new skill knowledge — the single largest true knowledge gap in this validation.**

This is worth being direct about: the skill's authentication model, everywhere it appears — `security/02-authn-authz.md`, `frontend/01-react-next-standards.md`'s auth-handling section, and the login-page design module (`_spine/designer-agent/knowledge/dashboard-modules/08-login.md`) — is built around **local username/password credentials** (argon2/bcrypt hashing, a login form with show/hide password fields, "wrong password" vs. "user not found" non-leaking error messages). There is no OIDC, SAML, or SSO federation guidance anywhere in the ~200 files that make up this skill. The dashboard's requirement — Google Workspace SSO as the primary path for standard users, with MFA enforced by Workspace itself, and TOTP-secured local accounts reserved for emergency access only — is architecturally sound and well-specified in the dashboard pack (`01 §14`, `08 §10`, `11 §2`), but it inverts which path is primary versus emergency-only relative to everything the skill currently models.

What _does_ transfer directly, once Google Workspace OIDC has established identity:

- The skill's session model downstream of authentication — short-lived access token + rotating refresh token, server-side revocation via a `tokenVersion`/revocation list, role-change bumping the version to invalidate outstanding tokens (`security/02-authn-authz.md`) — is exactly the right shape for the dashboard's own first-party API session, minted _after_ Google Workspace SSO succeeds. The front door changes; the session/authorization layer behind it does not.
- Per-module RBAC enforcement (`security/02`, `frontend/02`) is entirely orthogonal to how identity was established and applies unmodified.
- Domain allowlisting (`webdesksolution.com`, `webdeskinc.com`) is a straightforward addition to the OIDC callback handler — a new but small piece of logic, not a new pattern.

What has no skill precedent at all: TOTP for the local emergency-admin path, and two-person approval for local-account recovery (`06_Roles_and_Permissions.md §4`, `11 §2`). These are genuinely new security patterns for this skill.

**Recommended action:** Author new skill knowledge (e.g. `nodejs/knowledge/security/06-sso-oidc.md`) covering Google Workspace OIDC verification and domain allowlisting, and a TOTP pattern for the local emergency path. Given the security sensitivity, review this at **G1.5** rather than deferring it to implementation-time improvisation.

---

## 13. Google Workspace SMTP

**Validation: Approved and kept. No direct skill file, but the delivery-reliability pattern transfers cleanly.**

No skill knowledge file addresses outbound email/SMTP specifically. However, the dashboard's Notification Center requirements — delivery-state tracking (queued/sent/accepted/failed/retrying/permanently-failed), retry policy, multi-recipient/distribution-list support — are a direct restatement of the skill's generic at-least-once external-side-effect pattern: capped retries with backoff terminating in a DLQ (NODE-101), idempotent dispatch keyed on notification ID rather than content (NODE-102's upsert-on-external-id pattern, applied to "don't send the same notification twice"), and delivery-event audit logging (`integration/02-queues-and-jobs.md`, `integration/04-observability.md`).

**Recommended action:** No architecture change needed; the pattern is directly buildable from `integration/02` even without a dedicated email-adapter knowledge file. Authoring one (see `requirements-traceability-matrix.md` DASH-ARCH-25) is a nice-to-have documentation improvement, not a blocker.

---

## 14. GitHub App and webhooks

**Validation: Approved and kept. Security/idempotency pattern fully compatible; GitHub-specific adapter knowledge does not yet exist in the skill.**

`security/04-webhook-security.md`'s three-control model — verify the HMAC signature over the _raw_ request body with a constant-time comparison, reject replays via a timestamp window and event-ID dedupe, and process idempotently via upsert-keyed-on-external-id with a fast `2xx` ack — applies to GitHub webhooks exactly as written; only the specific header names change (`X-Hub-Signature-256`, `X-GitHub-Delivery`). The existing `integrations/bigcommerce/04-webhooks.md` module is a usable structural template for a new GitHub-specific one.

What's missing is GitHub-specific _adapter_ knowledge: GitHub App installation-token auth, Octokit conventions, and the specific API shapes the dashboard needs (branch creation, PR metadata, commit-existence verification, check/review/deployment status) — none of which exist anywhere in `nodejs/integrations/`, since that directory currently only covers `bigcommerce/`, `shopify/`, and `erp/*`.

**Recommended action:** Author `nodejs/integrations/github/` (mirroring the `bigcommerce`/`shopify` module structure) before writing GitHub integration code, and get it client-approved at **G-Contracts** per the skill's "no integration code against a draft contract" rule (NODE-008 applies directly: GitHub's API surface and rate limits must be verified against real docs, never assumed).

---

## 15. WordPress REST API and controlled WP-CLI

**Validation: Approved and kept. Architecturally the best-prepared integration in the entire stack, despite having no dedicated skill module yet.**

Two things point the same direction here. First, the skill's ERP adapter pattern (`integrations/erp/_erp-adapter-pattern.md`: pull/push/normalize/sync-state behind a common interface) is a strong structural template for a WordPress adapter — REST reads/writes, Application Password auth, and a controlled WP-CLI command allowlist all fit behind that same interface shape. Second, and more notably, **the dashboard pack itself already applies the skill's verify-at-discovery discipline (NODE-008) to WordPress without having read the skill** — `10_WordPress_Integration_and_Migration.md §1` states current-state values "must be verified during implementation and must not be silently treated as independently confirmed," and `§12`/`12_Open_Items §2` list a concrete unverified-items checklist (REST API restrictions, Application Password support, WP-CLI/SSH constraints, active theme, plugin inventory). This is the same posture NODE-008 mandates, arrived at independently — a strong sign the two systems' operating philosophies are aligned even where specific knowledge files don't yet exist.

**Recommended action:** Author `nodejs/integrations/wordpress/` before integration code begins. Treat the Theme Migration & Reconciliation Report (`10 §7–§9`) as its own gated deliverable — the dashboard pack already requires it to complete before custom-theme development starts, which aligns naturally with a G-Contracts-style approval step.

---

## 16. Separate dashboard and WordPress repositories

**Validation: Approved and kept. Fully compatible with the skill's branch/release model.**

`_spine/shared-knowledge/git-branch-strategy.md`'s branch model (protected `main`, integration `staging`, `feature/*`/`fix/*`/`hotfix/*`/`chore/*`, PR-only merges, no force-push) applies independently and identically to each of the two repositories (`webdesk-growth-dashboard`, `webdesk-wordpress-website`). The dashboard pack's own requirement that "every release records the exact approved dashboard and WordPress commit SHAs" (`01 §6`) is a direct product-level application of the skill's own SHA-is-proof-of-completion discipline (`01 §11` git completion rule ↔ skill's FG-007 and the Release Center's commit-verification tests).

**Recommended action:** Apply `git-branch-strategy.md` to both repositories independently; no skill change needed. The Release Center module (dashboard #36) is the natural place to record the paired SHAs per release.

---

## Summary

| Component                              | Kept as approved? | Skill relationship                                                    |
| -------------------------------------- | ----------------- | --------------------------------------------------------------------- |
| Turborepo monorepo                     | Yes               | Structural gap — needs new knowledge/ADR, no rule conflict            |
| Next.js App Router                     | Yes               | Skill's own default                                                   |
| NestJS                                 | Yes               | Schema-anticipated alternative — needs adaptation note                |
| Separate worker app                    | Yes               | Matches existing Shape 3 directly                                     |
| TypeScript                             | Yes               | Compatible, strengthens existing rules                                |
| PostgreSQL via Vercel (Neon excluded)  | Yes               | Skill's own default; provisioning path needs setup-time confirmation  |
| Sequelize + migrations                 | Yes               | Exact match to skill default                                          |
| Zod + NestJS validation                | Yes               | Skill's own default, natural pairing                                  |
| Vercel Functions/Queues/Workflows/Cron | Yes               | Largest real adaptation — properties transfer, mechanism needs an ADR |
| Upstash Redis                          | Yes               | Named provider for an already-generic skill requirement               |
| Vercel Blob                            | Yes               | Behaviorally equivalent to skill's S3 default                         |
| Google Workspace SSO                   | Yes               | Largest true knowledge gap — new skill content needed                 |
| Google Workspace SMTP                  | Yes               | No dedicated file, but pattern transfers cleanly                      |
| GitHub App + webhooks                  | Yes               | Security pattern compatible; adapter knowledge needs authoring        |
| WordPress REST API + WP-CLI            | Yes               | Best-aligned integration; adapter knowledge needs authoring           |
| Separate repositories                  | Yes               | Fully compatible with existing branch/release model                   |

**No approved technology was found to be incompatible with the skill's non-negotiable rules** (layering, repository-only DB access, boundary validation, idempotency, no-secrets, no-auto-deploy, deny-by-default). Every item above is a "how," never a "whether."
