# Gap Analysis — WebDesk Website Growth Dashboard

**Status:** Draft for review. No application code, migrations, or scaffolding produced.
**Purpose:** Identify specifications that are missing, underspecified, or only partially resolved by either the Dashboard Documentation Pack or the WebDesk Node.js Delivery System skill, across the areas called out in the review brief. Each gap states what exists today, what's missing, why it matters, and who should close it.
**Companion documents:** `node-skill-compatibility-review.md`, `requirements-traceability-matrix.md`, `architecture-validation.md`, `phased-implementation-plan.md`, `open-questions.md`.

**How to read severity:**

- **Blocking** — implementation of the affected module/area cannot start correctly without this being resolved.
- **Gate-blocking** — doesn't block starting work generally, but blocks a specific gate (G1.5/G-Contracts/G-Schema/G2/G5.5/G6) from passing.
- **Deferred-safe** — can be resolved during implementation without rework risk, or is already explicitly deferred by the dashboard pack itself.

---

## 1. Authentication

**What exists:** Dashboard pack fully specifies the _policy_ (Google Workspace SSO for two verified domains, SSO-enforced MFA, TOTP local emergency accounts, two-person recovery, 7-day max session — `01 §14`, `08 §10`, `11 §2`). Skill fully specifies a _local-credential_ session/token mechanism (JWT access+refresh, rotation, server-side revocation — `security/02-authn-authz.md`) but has zero OIDC/SSO federation content.

**Gap:** No specification anywhere (dashboard pack or skill) of:

- The exact OIDC flow (authorization code + PKCE assumed but not stated), redirect URI handling per environment, and how the resulting Google identity token maps to a dashboard `users` record on first login (JIT provisioning vs. pre-provisioned users only).
- What happens when a user's Google Workspace account is suspended/removed mid-session — is the dashboard session revoked on next token refresh, or does it ride out the 7-day max?
- The TOTP secret provisioning/recovery flow for local emergency accounts (enrollment, backup codes, secret storage — presumably encrypted per NODE-103, but not stated).
- Exactly which of the "verified domain" checks happen at OIDC-callback time vs. are re-checked per-request.

**Severity:** Gate-blocking (G1.5 — this is explicitly a security-sensitive architecture decision per `requirements-traceability-matrix.md` DASH-ARCH-24).

**Recommended owner:** Architect role, in the SSO/OIDC ADR recommended in `architecture-validation.md` §12, with PM/security-owner sign-off given the sensitivity.

---

## 2. Permissions

**What exists:** Both sides specify the _mechanism_ well and it maps cleanly (`requirements-traceability-matrix.md` DASH-GOV-05) — extensible `role × module × action` matrix, deny-by-default, server-enforced.

**Gap:**

- The dashboard pack's action legend (V/C/E/S/R/A/P/L/X/M) is defined at the _matrix_ level (`06_Roles_and_Permissions.md §3`) but not decomposed per-module the way the skill's pattern expects (which actions apply to which of the 43 modules — e.g., does "Publish" apply to Page Workspace, or only Case Study/Portfolio?). The high-level matrix in `06 §3` gives combined action-letter strings per module row (e.g. `VCERAPX`) but doesn't enumerate them as discrete grantable rows the way the skill's `role_module_permissions` schema expects.
- Confidential-field permission checks (`06 §5`: view/edit/export/send-to-Claude-task-package/include-in-Git-artifact) are a five-way permission axis _per field_, which is a finer grain than the skill's module-level RBAC has ever modeled — the skill's pattern handles module+action, not module+action+field.
- No specification of what happens to outstanding grants when a module is added post-launch (does every existing role start with zero access to a new module, consistent with deny-by-default, or is there a migration/backfill decision needed?).

**Severity:** Gate-blocking (G-Schema — the `role_module_permissions`-equivalent table design needs the per-module action enumeration resolved before the schema is approved) for the module-decomposition gap; Blocking for confidential-field permissions specifically, since several modules (Business Knowledge, Case Studies, Security/QA) depend on field-level enforcement being correct from day one.

**Recommended owner:** PM Agent role (business rule enumeration) + Backend role (schema design), reviewed at G-Schema.

---

## 3. Database migrations

**What exists:** Skill's migration discipline (`database/02-migrations-and-rollback.md`) is thorough and directly applicable — reversible up/down, CI dry-run, expand/backfill/migrate/contract zero-downtime pattern. Dashboard pack's data model (`04_Data_Model_and_Ownership.md`) is detailed at the entity/index/ownership level.

**Gap:**

- Migration **ownership** across the Turborepo workspace is unresolved (`requirements-traceability-matrix.md` DASH-ARCH-05, `architecture-validation.md` §1) — which app/package runs `sequelize-cli db:migrate` against shared environments, and how `dashboard-worker`/`dashboard-web`(via its BFF routes) consume the same schema without a second migration path forming.
- No seed-data specification for the ~43-module reference data the dashboard needs at first boot (default roles matching `06`'s 7-role list, default System Settings values, default operational areas from `09 §8`). The skill's seed pattern (`database/02`: "idempotent upsert, never blind-insert... never seed real client data or secrets") is directly applicable but has nothing to seed against yet.
- The base-entity standard's extended columns (`public_id`, `lock_version`, `retention_category`, `confidentiality`, `audit_context_id`) need a single canonical migration helper/mixin so all ~70+ tables implementing it stay consistent — not specified by either source.

**Severity:** Gate-blocking (G-Schema) for ownership and the base-entity mixin; Deferred-safe for seed data (can be populated incrementally per `12_Open_Items §4`, which the dashboard pack itself already defers).

**Recommended owner:** Backend role / DBA verification at G-Schema.

---

## 4. Queue processing

**What exists:** Skill's job-property requirements (idempotency, capped retry+backoff+DLQ, overlapping-run prevention, timezone-aware scheduling) are exhaustive and directly applicable. Dashboard pack names the provider (Vercel Queues/Workflows/Cron, Upstash QStash fallback) and the adapter-interface shape (`08 §8`).

**Gap:** This is the architecture area flagged most heavily in `architecture-validation.md` §9 — the actual execution model (persistent worker vs. Functions-only) is unresolved, which cascades into several unspecified details:

- DLQ implementation specifics on Vercel Queues (does the platform provide a native DLQ primitive, or does the dashboard need to build one against `job_failures`/`background_job_attempts` per `04_Data_Model §2`?).
- Lock/overlapping-run-prevention mechanism when there's no persistent in-process worker to hold an advisory lock — likely a `sync_states`/`scan_runs`-style `locked_until` row per `integration/02-queues-and-jobs.md`'s "TTL row" option, but not confirmed.
- Fallback **trigger condition** from Vercel Queues/Workflows to Upstash QStash + Cron (operational failover vs. specific-job-type routing) is unstated in `01 §13`.

**Severity:** Blocking for `apps/dashboard-worker`, Scan Center, Import/Export Center, and Notification Center — all depend on this being resolved before their job-handling code can be written correctly.

**Recommended owner:** Architect role, resolved in the same ADR as `architecture-validation.md` §9 (G1.5).

---

## 5. Idempotency

**What exists:** Skill's idempotency discipline (NODE-102, unique-index-on-external-id, upsert-not-insert, jobId dedupe) is one of its strongest, most consistently applied rules, and the dashboard pack independently arrives at the identical requirement in every place it matters: imports (`04 §2` "Idempotency: source file checksum, template version, and row external ID"), webhooks (`08 §11`), releases (SHA-based), and notifications (retry states).

**Gap:** Small but real — the skill's idempotency pattern is keyed on an _external system's_ ID (ERP/store record ID). Several dashboard flows need idempotency keyed on a **dashboard-internal** action instead (e.g., "don't process the same Ready-for-Claude task twice if the operator double-clicks," "don't re-apply the same Change Center decision twice"). The skill has never needed this internal-action idempotency case, only external-sync idempotency — the _mechanism_ (unique constraint + upsert) transfers, but no worked example covers "idempotency key = a UI action + actor + target record," only "idempotency key = external record ID."

**Severity:** Deferred-safe — the pattern is a straightforward extension of NODE-102, buildable without new skill knowledge, just needs to be applied consistently by convention during implementation (flagged in Code Review checklists).

**Recommended owner:** Backend role, self-applied per module; spot-checked by Code Review per the existing NODE-102 checklist item.

---

## 6. Webhooks

**What exists:** Skill's three-control model (HMAC verify over raw body with constant-time compare, replay protection via timestamp window + event-ID dedupe, idempotent processing with fast-ack-then-async-work) is complete and directly reusable (`security/04-webhook-security.md`).

**Gap:** No dashboard-pack specification of:

- Which webhook **providers** actually exist in scope beyond GitHub (`08 §5` covers GitHub webhooks well; does WordPress emit any webhooks, e.g. via a custom REST hook on publish, or is all WordPress interaction poll/push-only through the REST API with no inbound webhook surface at all?).
- Webhook secret **rotation** cadence/process specific to GitHub App webhooks (the general secrets-rotation policy exists in `09_Security...md`, but not a per-integration rotation schedule).
- Whether Vercel Queues/Workflows/Cron themselves emit any webhook-shaped callbacks the dashboard needs to receive and verify (distinct from GitHub/WordPress webhooks) — unclear from the docs.

**Severity:** Gate-blocking (G-Contracts, per-integration) — cannot finalize the GitHub integration contract without confirming webhook scope and rotation policy; not blocking for the rest of the system.

**Recommended owner:** PM role at G-Contracts, verified against real GitHub App documentation per NODE-008.

---

## 7. Import / export

**What exists:** Dashboard pack is thorough on requirements (`03_Detailed_Module_Specifications.md §34`, `05_Workflow_State_Machines.md §9`, `11_Acceptance_Criteria...md §6`) — versioned templates, dry-run with row-level errors, duplicate policy, idempotency, partial-success reporting, rollback limitations shown before apply. Skill's async-job and idempotency patterns transfer directly for the _processing_ side.

**Gap:**

- No specification of the **file format(s)** supported (CSV only? XLSX? Both, per module?) or the versioned-template schema format itself (JSON Schema? A dashboard-native template definition?).
- "Rollback limitations must be shown before approval" (`05 §9`) implies imports are not fully reversible in the general case, but doesn't specify _which_ import types support rollback vs. which are apply-only — this materially affects the Change Center/Import Center's UI and the underlying transaction design.
- No specification of maximum import file size / row count, or whether large imports stream-process (per NODE-009's "no sync I/O in the request path" — implies background-job processing, consistent with the skill's guidance, but the dashboard pack doesn't state a size threshold).

**Severity:** Blocking for the Import and Export Center module specifically; Deferred-safe for the rest of the system (12_Open_Items §4 already treats populated data as post-launch-safe).

**Recommended owner:** PM role, resolved during Import/Export Center's module-level discovery (per-module G1/G1.5 as needed).

---

## 8. Git synchronization

**What exists:** Very well specified on both sides — dashboard pack's Git completion rule (`01 §11`), Release Center (`03 §36`), Ready for Claude Queue (`03 §30`) all map directly onto the skill's SHA-verification, branch-protection, and no-auto-merge/no-auto-deploy discipline (`git-branch-strategy.md`, FG-007). This is one of the strongest-aligned areas in the whole review.

**Gap:** The one real gap is the GitHub-specific adapter knowledge itself (see `architecture-validation.md` §14 / `requirements-traceability-matrix.md` DASH-ARCH-12) — not the _policy_, which is fully resolved, but the _mechanism_ (Octokit auth model, exact API calls for branch/PR/commit/deployment verification) has no skill precedent and needs authoring before G-Contracts.

**Severity:** Gate-blocking (G-Contracts) for the GitHub integration specifically; the policy layer above it is not a gap.

**Recommended owner:** Backend role authoring the new `nodejs/integrations/github/` module; approved at G-Contracts.

---

## 9. WordPress synchronization

**What exists:** The dashboard pack is unusually thorough here (`10_WordPress_Integration_and_Migration.md`, 281 lines) — theme structure, native structured-content architecture, existing plugin inventory (CaseStudy, Portfolio) with exact meta-key mappings, migration requirements, and deployment pipeline are all specified in detail.

**Gap:** The dashboard pack itself is explicit about what remains unverified (`10 §12`, `12_Open_Items §2`) — current WordPress/PHP versions, REST API restrictions, Application Password support, WP-CLI/SSH constraints, active theme and plugin state, GA4/GTM/Clarity IDs and consent configuration, Contact-Form-7-to-Podio mapping, and existing technical debt. This is a **dashboard-pack-acknowledged** gap, not one this review is newly discovering — but it's worth stating plainly that it blocks real implementation, not just documentation completeness.

Additionally, no source (dashboard pack or skill) specifies:

- The **direction and cadence** of WordPress↔dashboard synchronization for content that both systems can independently modify (e.g., if a page is edited directly in WordPress outside the dashboard's approved-drafts workflow, how/when does the dashboard detect and reconcile that — is this covered by the Scan Center's "WordPress health" scan type, and if so, at what frequency?).
- Conflict resolution when a WordPress-side edit and a dashboard-approved-draft-not-yet-published diverge.

**Severity:** Blocking for custom-theme development start (the pack's own rule: "Custom-theme development must not begin until the current site is audited" — `10 §9`); the reconciliation-cadence gap is Gate-blocking (G-Contracts) for the WordPress integration contract specifically.

**Recommended owner:** PM role for the audit (already scoped in `12_Open_Items §2`); Architect role for the reconciliation-cadence/conflict question, informed by `integration/01-sync-strategies.md`'s reconciliation pattern (periodic drift detection, heal + report, never silent-fix) even though that pattern was written for ERP sync.

---

## 10. Audit logging

**What exists:** Both sides agree strongly on _what_ triggers an audit event and the shape of an entry (actor, action, timestamp, before/after where applicable) — `06_Roles_and_Permissions.md §6`, `05_Workflow_State_Machines.md §12`, skill's `project.json.audit_log` schema and `security/02-authn-authz.md`'s "Audit" section.

**Gap:** The skill's own audit log is a **delivery-process** artifact with no retention policy of its own — it has never needed one, since it lives for the life of a project engagement, not for regulatory purposes. The dashboard's audit requirement is materially different in kind: a **7-year immutable retention** requirement (`09_Security...md §6`) for approval-related audit events specifically, with a separate, shorter retention for general audit records — no skill file anywhere addresses long-term immutable-record retention, legal holds, or a retention-aware deletion job design. This is the single largest genuine gap in the "Audit logging" area, not a mechanism gap (the _shape_ of an audit event is well agreed) but a **lifecycle** gap.

**Severity:** Gate-blocking (G-Schema, since the audit table's retention/legal-hold columns must be designed in from the start — retrofitting immutability and legal-hold exemptions onto an existing table is materially harder than designing them in).

**Recommended owner:** Backend role + DBA, informed by the Retention gap below (item 12); no existing skill pattern to lean on, needs original design work reviewed at G-Schema.

---

## 11. File handling

**What exists:** Well specified on the dashboard side (`01 §15`, `03 §12`, `08 §7`, `09 §3`, `11 §8`) — allowed/blocked types, size limits, checksum, direct-to-Blob upload, time-limited signed URLs, and the explicit "malware scanning deferred, must not claim clean" honesty rule. Skill's general input-validation and S3-shaped upload guidance (`security/01-owasp-api.md`, `intelligence/database-intelligence.md`) transfers directly since Vercel Blob is behaviorally S3-equivalent (`architecture-validation.md` §11).

**Gap:**

- No specification of **which modules** get direct-browser-to-Blob upload vs. proxy-through-API upload, or the exact size threshold that decides it ("above function request limits" per `08 §7` is stated qualitatively, not as a number — Vercel Functions' actual payload limit should set this threshold, but isn't cited).
- No specification of how a file's `Scan Not Configured` status is surfaced/tracked once a malware scanner _is_ eventually configured (post-V1) — does existing "Scan Not Configured" content get retroactively scanned, or only new uploads going forward? `01 §16`/`09 §3` describe the deferred state but not the eventual transition.

**Severity:** Deferred-safe — buildable with a reasonable default threshold recorded as an assumption, revisited if wrong; the retroactive-scan question is explicitly post-V1 per the pack's own exclusions list.

**Recommended owner:** Backend role, records the assumed upload-size threshold in `data-model.md`/Asset Library module spec at G-Schema.

---

## 12. Retention

**What exists:** The dashboard pack's retention matrix (`09_Security_Backup_Retention_Operations.md §6`) is exceptionally detailed — per-category retention periods for ~25 distinct data categories, a scheduled Cron-triggered deletion job with a defined record shape (`§7`), and legal-hold override behavior.

**Gap:** This is almost entirely a **skill-side** gap, not a dashboard-pack gap — the pack's specification is essentially complete. No skill file anywhere models a retention/deletion job, legal-hold exemption logic, or category-based purge scheduling; the closest skill concept is the generic "scheduled Cron Job" pattern from `integration/02-queues-and-jobs.md`, which covers the _scheduling_ mechanism but nothing about _what a compliant deletion run looks like_ (batched, resumable, legal-hold-aware, auditable per `09 §7`'s required run-record fields).

**Severity:** Gate-blocking (G-Schema and G6) — the retention job is an explicit item in the Production Launch Checklist (`11 §15`: "retention job enabled"), so it cannot be waved through to launch without being built and tested.

**Recommended owner:** Backend role, original design work (no skill pattern to extend beyond the generic Cron-job mechanism); reviewed at G5.5/G6 per the skill's own "runbooks present" gate discipline, since a retention job is operationally equivalent to the runbooks the skill already requires (queue-recovery, db-restore templates exist; a retention-run runbook does not).

---

## 13. Backups

**What exists:** Dashboard pack's backup policy (`09 §4`) is fully specified per data category (Database, Blob, WordPress) with concrete RPO/RTO targets (`09 §5`) and a quarterly restore-test cadence. Skill has generic runbook **templates** for this exact purpose: `nodejs/templates/operations/db-restore.template.md` and `deploy-recovery.template.md`.

**Gap:** The templates are generic placeholders, not filled in — they need the dashboard's specific RPO/RTO targets, the specific backup storage location/provider (East Coast, independent from the primary Vercel Postgres/Blob, per `09 §4`), and the specific restore-test procedure written into them. This is a **content** gap (fill in the template) rather than a **pattern** gap (the template's structure is sound and directly usable).

The one specification gap the dashboard pack itself leaves open: how the "manual logical exports... do not by themselves satisfy a 15-minute RPO" caveat (`09 §5`) is resolved — i.e., what _does_ satisfy the 15-minute production RPO target (point-in-time recovery via the Postgres provider? continuous WAL shipping?) is explicitly deferred to implementation ("Implementation must document the actual achieved RPO before launch").

**Severity:** Gate-blocking (G6 — "backups and restore test complete" is an explicit launch-checklist item, `11 §15`) for the RPO-satisfying-mechanism question; Deferred-safe for filling in the runbook templates (routine implementation work).

**Recommended owner:** Delivery Head role (owns runbooks per the skill's own agent-roster assignment), verified at G5.5/G6.

---

## 14. Testing

**What exists:** Very strong alignment — skill's testing stack (`testing/01-03`) and the dashboard's acceptance criteria (`11_Acceptance_Criteria_and_Test_Plan.md`) cover nearly identical ground: permission tests, workflow-stage-order tests, idempotency/webhook-replay tests, accessibility tests, and a production launch checklist.

**Gap:**

- The skill's contract/integration test layer assumes a **sandbox or mock behind an adapter interface** (`testing/01`: "sandboxes where they exist... mocks otherwise"). For GitHub and WordPress specifically, this requires either a real GitHub App test installation + a WordPress staging instance (the pack confirms one exists: `staging-7a61-wdsstage2.wpcomstaging.com`) wired into CI, or local mock servers analogous to the service-skeleton's `mock-erp`/`mock-store` pattern (`templates/service-skeleton/README.md`) — neither is specified yet for GitHub/WordPress.
- No specification of test-data isolation for the WordPress staging instance (can CI safely run destructive migration/import tests against the _shared_ staging site, or does the project need a third, CI-only WordPress environment beyond the pack's stated four: Development/Preview/Staging/Production, `01 §7`?).
- Load/chaos testing (`testing/02-load-and-chaos.md`) is written assuming a persistent process under test (k6/Artillery against a running server) — the same Vercel-execution-model question from Gap #4 affects how load testing against Vercel Functions/Queues is designed (cold-start behavior, concurrency limits are platform-managed, not something the skill's load-test guidance was written to account for).

**Severity:** Gate-blocking (G5 milestone regression) for the GitHub/WordPress mock/sandbox question specifically, once those integrations are in active development; Deferred-safe for the load-testing adaptation (resolvable once Gap #4's execution-model ADR lands).

**Recommended owner:** QA role, resolved per-integration as GitHub/WordPress work is scheduled (see `phased-implementation-plan.md`).

---

## 15. Deployment

**What exists:** Skill's deploy abstraction (`build → migrate → release → health-check → rollback`, FG-007) and branch/release model (`git-branch-strategy.md`) are solid conceptual scaffolding. Dashboard pack specifies environment count/isolation (`01 §7`) and the WordPress-side deployment pipeline in detail (`10 §11`).

**Gap:** As flagged repeatedly (`architecture-validation.md` §1, §9), **Vercel is not in the skill's `host_target` enum**, and none of the skill's deploy-adapter examples target a Git-integrated, preview-deployment-per-PR platform like Vercel (where "deploy" is largely automatic on push, which sits in tension with the skill's explicit "no auto-deploy without a tested backup/rollback" rule, FG-007 — Vercel's default behavior auto-deploys preview environments on every push, which is fine for Preview/Development but must be deliberately _not_ how Staging→Production promotion works). No specification of:

- How Vercel's automatic preview-deployment behavior is scoped so it never applies to the Staging→Production promotion path (which must remain the skill's gated, human-approved model).
- The dashboard-worker deployment path specifically, once Gap #4's persistent-vs-Functions question is resolved.
- How database migrations are sequenced relative to a Vercel deploy (Vercel's build step vs. a separate migration step — order matters for the skill's zero-downtime expand/contract pattern, `database/02`).

**Severity:** Gate-blocking (G1.5 for the ADR, G6 for the concrete deploy-adapter implementation and rollback rehearsal).

**Recommended owner:** Architect + Delivery Head roles jointly, same ADR track as Gap #4/#9.

---

## 16. Observability

**What exists:** Skill's observability guidance (`integration/04-observability.md`) is thorough — structured logs with correlation IDs, a specific metrics table (watermark lag, DLQ size, queue depth, etc.), tracing, alerting, and an explicit G5.5 checklist gating launch on all of it being present. Dashboard pack requires dependency health endpoints (`08 §12`) and lists monitoring ownership areas (`09 §8`).

**Gap:**

- The skill's metrics table (`sync_watermark_lag_seconds`, `reconciliation_drift_count`, etc.) is written for an ERP↔store sync engine; the dashboard's actual background work (scans, imports, notifications, the Ready for Claude Queue) needs an analogous but not identical metrics set that neither source has enumerated yet (e.g., "scan run duration," "import row-error rate," "notification delivery failure rate," "gate SLA breach rate" — the last one being a genuinely new metric category, since the skill's own SLA-escalation mechanism, `gate-format.md`, has never been instrumented as a _metric_ before, only as a workflow).
- No specification of where traces/metrics/logs are shipped to (which APM/observability backend) — neither source names one; the skill mentions OpenTelemetry/Prometheus-style generically, Sentry is named by the dashboard pack for errors only.

**Severity:** Gate-blocking (G5.5 — cannot pass "the full observability checklist present and wired" without a defined metrics set and a chosen backend).

**Recommended owner:** Delivery Head role, defining the dashboard-specific metrics table by analogy to `integration/04`'s structure; PM/ops decide the observability backend.

---

## 17. Security

**What exists:** Extremely strong alignment overall (see `requirements-traceability-matrix.md` Part B) — OWASP API Top 10 coverage, secrets handling, PII/confidentiality, deny-by-default, separation of duties are all well specified on both sides and largely identical in substance.

**Gap — the residual items not already covered above:**

- **Threat modelling** is required before production (`09_Security...md §2`) but no template/procedure for it exists in the skill (the Architect role's knowledge, `_spine/architect-agent/knowledge/01-architecture-review-protocol.md`, covers architecture review generally but doesn't include a threat-modelling method/template specifically).
- **CSRF protection "where applicable"** (`09 §2`) is unresolved — a JWT-bearer-token API (the skill's usual pattern) is typically CSRF-exempt by design (no ambient cookie auth), but if refresh tokens are stored in `httpOnly` cookies (as `frontend/01` recommends), CSRF protection _does_ become applicable for any cookie-authenticated route. Neither source resolves which token-storage approach the dashboard uses, so it's unclear whether CSRF protection is actually needed.
- **Rate limiting specifics** — `09 §2` requires it "through Upstash Redis" but doesn't specify per-route limits; the skill's guidance (`security/01-owasp-api.md`) is qualitative ("global + tighter on auth and bulk routes") without concrete numbers for this project.

**Severity:** Gate-blocking (G1.5 for threat modelling and the CSRF/token-storage decision, since `security/02`'s recommended token storage directly determines whether CSRF protection is in scope; G6 for finalized rate-limit numbers).

**Recommended owner:** Architect role for threat modelling and token-storage/CSRF decision at G1.5; Backend role for concrete rate-limit numbers at G6, informed by the load-testing capacity profile per `testing/02-load-and-chaos.md`.

---

## Summary — gaps by severity

| Severity                        | Areas                                                                                                                                                             |
| ------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Blocking**                    | Import/Export file-format specifics (7); WordPress current-state audit (9, pack-acknowledged); File-handling upload threshold (11, deferred-safe with assumption) |
| **Gate-blocking (G1.5)**        | Authentication/SSO (1); Queue execution model (4); Deployment on Vercel (15); Threat modelling + CSRF/token-storage (17)                                          |
| **Gate-blocking (G-Schema)**    | Permissions field-level model (2); Migration ownership (3); Audit logging retention/legal-hold design (10); Retention job design (12)                             |
| **Gate-blocking (G-Contracts)** | Webhook scope/rotation (6); Git sync adapter knowledge (8); WordPress reconciliation cadence (9)                                                                  |
| **Gate-blocking (G5/G5.5/G6)**  | Testing sandbox strategy for GitHub/WordPress (14); Backup RPO-satisfying mechanism (13); Observability metrics set + backend (16); Rate-limit numbers (17)       |
| **Deferred-safe**               | Idempotency internal-action convention (5); File-handling retroactive-scan question (11)                                                                          |

No gap identified above requires re-opening a decision already made in the dashboard pack or the skill — every gap is a **missing specification**, not a disagreement between the two sources.
