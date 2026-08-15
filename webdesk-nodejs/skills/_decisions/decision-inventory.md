---
tier: 3
load_when: ["never"]
description: "Human-read log of system design decisions (v1→v3). Not auto-loaded."
---

# Decision Inventory

> The durable record of _why_ the WebDesk Node.js Delivery System is shaped the way it is. Tier 3 — humans read this, agents do not auto-load it. Each entry: decision, rationale, date.

## D-001 — Standalone skill, not merged with Shopify

**Decision:** Build a separate Node-only delivery system with its own spine + contracts, rather than adding a `nodejs/` arm to the Shopify system.
**Rationale:** A prior single skill spanning Shopify + WordPress reached ~13 MB and the router drifted / blew context. Splitting by technology keeps each skill within a loadable budget. (2026-06-30)

## D-002 — Spine adapted from Shopify, not rebuilt from scratch

**Decision:** Copy the proven Shopify spine machinery (gates, state lock, audit log, handoff, tiered loading, no-auto-fix, no self-approval, truth persona) and replace platform content with Node.
**Rationale:** The machinery is platform-agnostic and battle-tested; only the platform knowledge differs. (2026-06-30)

## D-003 — Added gates G1.5, G-Contracts, G-Schema, G5.5

**Decision:** Extend the universal gate set with Architecture Review (G1.5, conditional), client-approved Integration/API Contract approval (G-Contracts), client-approved DB/data-model approval (G-Schema), and Observability approval (G5.5).
**Rationale:** Custom apps add a data layer and integration contracts the theme system never had; in ERP↔store middleware the field mapping and contracts _are_ the product, so they need client sign-off before code. Observability must be validated before launch, not just monitored after. (2026-06-30)

## D-004 — RFC layer before ADR

**Decision:** Add a Request-for-Change (proposal/discussion) artifact that precedes the ADR (final decision). A mid-project change → RFC → if accepted emits an ADR + triggers G1 RENEGOTIATE re-estimate.
**Rationale:** ADRs captured only final decisions; the proposal/discussion phase and mid-project scope changes had no home. Confirmed absent from the Shopify donor. (2026-06-30)

## D-005 — No standing Security Agent, no Migration Agent

**Decision:** Security folds into shared-knowledge baseline + a QA module + Code Review checks. No content-migration agent.
**Rationale:** A standing security agent adds handoff overhead without new enforcement power. App-to-app migration isn't a service we offer; ERP data flow is continuous sync, not migration. (2026-06-30)

## D-006 — ERP/CRM steady state is continuous cron-scheduled sync

**Decision:** Model the core as a permanent cron-scheduled sync engine (per-entity cadence, idempotent, resumable, watermark sync-state, reconciliation), not a one-time backfill. Webhooks only where the source supports them (store side).
**Rationale:** Client clarified the integration runs on decided intervals via cron; most target ERPs are poll-only. The scheduler + reconciliation is the load-bearing part. (2026-06-30)

## D-007 — Default DB/ORM = PostgreSQL + Sequelize

**Decision:** Documented default Postgres + Sequelize; alternatives (MySQL/MongoDB, Prisma/TypeORM) by per-project justification at G-Schema. Storage from S3/Cloudinary/GCS.
**Rationale:** Client's standard stack. Choices remain per-project but with a sensible default. (2026-06-30)

## D-008 — Dashboard: JWT, per-client + master, per-module RBAC, timezone-driven

**Decision:** JWT auth (access+refresh, rotation, revocation); one dashboard per client plus a Master dashboard for cross-client oversight; RBAC is per-module View/Edit/Delete; a Settings → Timezone field drives all cron/activity (UTC storage, configured-tz compute).
**Rationale:** Client's stated requirements. The master dashboard is where retainer monitoring + health scores surface. (2026-06-30)

## D-009 — Model policy: system chooses, dev doesn't

**Decision:** Opus for planning/architecture/hard-debug, Sonnet for code + most agent work, Haiku for mechanical tasks; Haiku→Sonnet→Opus escalation ladder. Declared per skill in frontmatter.
**Rationale:** Keeps Opus spend on the work that needs it; removes per-task model decisions from developers. (2026-06-30)

## D-010 — Context-budget rules are hard constraints

**Decision:** Load KB only by active project_type + integration_targets; tiered loading; per-project CLAUDE.md allow-list; size caps; halt+handoff at >90%.
**Rationale:** Direct response to the 200K context-window error hit on a prior pilot. The skill can be large on disk; what loads is scoped small. (2026-06-30)

## D-011 — Graphify is onboarding-only

**Decision:** Use Graphify only for project onboarding + repository understanding. It is not the system of record; `graph.json` is regenerable. Decisions/approvals/state/specs stay in spec.md, project.json, ADRs, project docs.
**Rationale:** It onboards developers to a codebase, not to the delivery system, and is a young single-maintainer tool — safe as a disposable index, not a foundation. (2026-06-30)

## D-012 — DDI Inform is the first pilot adapter

**Decision:** First real project is DDI Inform ERP ↔ middleware + dashboard ↔ BigCommerce. The DDI adapter is built behind the common ERP adapter interface, against documented assumptions + mocks, with every unverified API detail marked verify-at-discovery.
**Rationale:** Real client demand; exercises the hardest paths (dual integration, cron sync, new datastore, dashboard, client-approved gates) in one project. (2026-06-30)

## D-013 — Dashboard design is SOW-driven, not platform-hardcoded (pilot feedback #7)

**Decision:** The dashboard standard is a set of SOW-driven **minimum criteria**, not a fixed ERP/store module set. Designers analyze the SOW first and include only the modules/fields/KPIs/health-items/alerts it defines; JWT, per-client+master tenancy, per-module RBAC (VED minimum, extended per module), and Settings-timezone remain fixed system contracts. Nine module criteria files (Dashboard Home, Roles & Permissions, Settings, Notifications, Scheduled Jobs, Process History, Email Templates, Login, Forgot Password) capture the minimum bar.
**Rationale:** The pilot caught the v0.1 standard hardcoding ERP/store Settings fields and modules — overfitting to the DDI pilot. The client's canonical criteria require SOW-driven, platform-neutral dashboards. (2026-07-08)

## D-014 — Milestone QA-before-MD + gate status single source of truth (pilot feedback #1, #5, #6)

**Decision:** (a) Every milestone closes in the strict order Development → Code Review → Milestone QA (G5, writes `milestone-[id]-qa.md`) → Generate milestone MD; the MD is blocked until the QA report exists and carries its result at the top. (b) `project.json.gates[]` is the single source of truth for gate status; HANDOFF.md and all displays derive from it and never hand-copy it.
**Rationale:** Pilot generated a milestone MD without milestone QA and without surfacing the result (#1/#5), and a handoff showed G2 as not-passed while project.json had it CONFIRMed (#6). (2026-07-08)

## D-015 — Generalization hardening: overfitting removed from upstream layers (self-audit, v0.2.1)

**Decision:** The SOW-driven dashboard rule and the extensible RBAC model are enforced at EVERY layer, not just the designer arm. Spec/discovery/estimation/master-doc/gate templates no longer assert a fixed ERP/store module + Settings list; backend authz and the DB `role_module_permissions` schema store an extensible per-module action set (View/Edit/Delete seeded, plus Create/Approve/Export/Import/Run/Configure/Manage All as a module needs). The only fixed dashboard contracts remain JWT, per-client+master tenancy, per-module RBAC (VED minimum, extended), and Settings-timezone.
**Rationale:** A v0.2.0 self-audit found the dashboard overfitting fixed in the designer files still survived one layer upstream (spec/discovery re-injected the ERP fields; the RBAC extension never reached enforcement/persistence). Same defect class as pilot #7. Fixed so the system genuinely integrates ANY ERP with BigCommerce/Shopify, not just DDI. (2026-07-08)

## D-016 — Milestone QA modal in generated dashboards (pilot feedback #1, "popup")

**Decision:** Beyond surfacing milestone QA in the delivery MD (D-014), every generated dashboard implements a **Milestone QA modal** that reads the same `milestone-[id]-qa.md` record and shows the status/summary. It lives in the master/delivery-oversight dashboard (per-client only if the SOW asks for client milestone visibility); it never fabricates a pass when no report exists.
**Rationale:** The pilot's "popup not displayed" had two valid readings (delivery-side surfacing vs a UI modal in the app). Both are now covered — the spine surfaces it in the MD, and the dashboard/frontend module requires the modal — with one source of truth for the status. (2026-07-08)

## D-017 — Pre-pilot hardening of custom-app-build + frontend-tool (focused read, v0.2.3)

**Decision:** Before piloting the two lighter project-types, a focused read hardened three real gaps: (1) request/response external integration (AI platforms, third-party APIs) is now a first-class pattern in custom-app-build, distinct from ERP cron-sync — its G-Contracts contract carries timeout/retry/token-cost/output-validation, not watermark/cadence; (2) the frontend-tool ↔ Shopify theme-system boundary is defined — this skill owns the tool/app/extension, the WebDesk Shopify theme system (v1.11.3) owns any Liquid/theme edits, run as two tracks with a handoff recorded at G1; (3) residual VED-only RBAC phrasing in custom-app-build, security-baseline, and handoff-guide generalized to VED-minimum-extended.
**Rationale:** A read (cheaper than a pilot) found these before the custom-app-build and frontend-tool pilots. Pilots will harden the rest. (2026-07-08)

## D-018 — Onboard-existing-project capability (Graphify → maintenance), v0.2.4

**Decision:** Added a first-class onboarding path for existing repos: `init-project.sh --onboard-existing --repo --graphify` scaffolds a code-first takeover; PM Agent (`_spine/pm-agent/knowledge/10-onboard-existing-project.md`) reconstructs spec/ADRs/project.json/contracts from `graph_report.md` + `graph.json` as **validated drafts** (marked reconstructed-from-code), the client validates the spec, then the project runs as maintenance. Graphify stays an index (queried to find files, never auto-loaded, never the source of truth); its git post-commit hook keeps the map fresh — regeneration is NOT a per-ticket step. Wired into PM SKILL, orchestrator session-start (ONBOARD intent) + routing, and the maintenance project-type. New `onboarding` stage added to the project.json schema.
**Rationale:** The team runs Graphify on legacy repos and needed a repeatable one-command onboarding instead of improvising the read each time. (2026-07-08)

## D-019 — init-project.sh output made schema-valid (latent bug, v0.2.4)

**Decision:** Fixed init-project.sh so a freshly scaffolded `project.json` validates against `project-json.schema.json`: stage/current_gate/schema_version moved inside `project`, added `lock` + `audit_log`, `runbooks_status` written as its proper object, undecided tech_stack fields omitted; `health_score` made nullable in the schema (null = not computed yet).
**Rationale:** The onboarding smoke-test revealed the greenfield scaffolder had never produced schema-valid state — it would have failed the first real `init`. (2026-07-08)

---

Last reviewed: 2026-06-30 (initial build)
