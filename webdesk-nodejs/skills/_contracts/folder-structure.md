---
tier: 2
load_when: ["scaffold", "g3", "orchestrator-active"]
description: Canonical folder layout for the Node.js skill AND the per-project workspace. Every file has a defined home.
---

# WebDesk Node.js Delivery System — Folder Structure

This is the canonical layout for the entire Node.js skill and for each client project's workspace. Every skill, knowledge file, template, schema, and artifact has a defined home. Do not deviate without updating this document. This is a **standalone, Node-only** skill — its own spine, its own contracts, no cross-technology router.

---

## 1. Skill tree (lives in the repo / installed skill)

```
/skills/
├── _spine/                              # Universal Node-delivery machinery (no platform content)
│   ├── persona.md                       # Tier 0 — truth persona, operating contract
│   ├── orchestrator/                    # Master conductor: routing, state, gates, context budget
│   │   ├── SKILL.md
│   │   └── knowledge/                   # routing-table, gate-protocol, escalation, state-management
│   ├── pm-agent/                        # Discovery, intake, planning, estimation, RFC, health score, kickoff intake
│   │   ├── SKILL.md
│   │   ├── knowledge/
│   │   └── templates/
│   ├── architect-agent/                 # G1.5 only — architecture review, ADRs, fitness-test plan, draft contracts/model
│   │   ├── SKILL.md
│   │   ├── knowledge/
│   │   └── templates/
│   ├── designer-agent/                  # HTML dashboard mockups (D-DES-01), dashboard standards
│   │   ├── SKILL.md
│   │   ├── knowledge/                   # incl. dashboard-standards.md
│   │   └── templates/
│   ├── qa-agent/                        # API/contract/integration/security/load/chaos + sync-specific QA
│   │   ├── SKILL.md
│   │   ├── knowledge/                   # qa-modules, bug-severity-matrix, regression-protocol
│   │   └── templates/
│   ├── code-review-agent/               # PR review, standards enforcement, no-auto-fix
│   │   ├── SKILL.md
│   │   ├── knowledge/
│   │   └── templates/
│   ├── delivery-head/                   # Pre-launch (G6), observability sign-off (G5.5), handoff, M6
│   │   ├── SKILL.md
│   │   ├── knowledge/
│   │   └── templates/
│   └── shared-knowledge/                # Cross-cutting standards — NO platform/integration specifics
│       ├── CONVENTIONS.md               # Tier 1 — single source of truth for file structure
│       ├── context-budget.md            # The 200K-error fix (project-scoped loading, halt-at-90%)
│       └── model-policy.md              # The model-routing matrix (system picks, never the dev)
│
├── nodejs/                              # The one and only technology arm (Node primary)
│   ├── SKILL.md                         # Arm entry point — pointers only
│   ├── knowledge/
│   │   ├── 01-coding-standards.md       # Node 22, ESM, async/await, controller/service/repository layering
│   │   ├── 09-forbidden.md              # CRITICAL — what never to do
│   │   ├── technology-selection.md      # DB/ORM/storage/queue selection rationale
│   │   ├── backend/                     # Express patterns, error handling, repositories, transactions
│   │   ├── database/                    # Postgres + Sequelize (default): models, migrations, umzug
│   │   ├── frontend/                    # React/Next dashboard standards
│   │   ├── integration/                 # generic integration patterns (cron sync, idempotency, watermarks)
│   │   ├── intelligence/               # Database / Integration / Failure-Scenario / API-Design intelligence modules
│   │   ├── security/                    # OWASP-API baseline, JWT, secrets, RBAC scoping
│   │   └── testing/                     # contract/integration/load/chaos + sync-specific test patterns
│   ├── integrations/                    # Loaded ONLY when in project.integration_targets
│   │   ├── bigcommerce/                 # BigCommerce API module
│   │   ├── shopify/                     # Shopify API module (store-side only — no theme content)
│   │   └── erp/                         # _erp-adapter-pattern.md + per-ERP adapters (ddi-inform, ...)
│   ├── examples/
│   │   ├── api-service/
│   │   ├── embedded-dashboard/
│   │   └── middleware-sync/
│   ├── pointers/                        # Anchored external doc URLs + pinned API versions
│   ├── templates/
│   │   ├── service-skeleton/            # Express service scaffold (controllers/services/repositories)
│   │   ├── operations/                  # Runbook templates (seed the workspace operations/ tree)
│   │   └── architecture-tests/          # Fitness-test templates
│   └── projects/                        # Project-type arms — only the active one loads (pt-* tags)
│       ├── integration-middleware/      # The pilot type (DDI Inform ↔ BigCommerce)
│       │   ├── SKILL.md
│       │   ├── knowledge/
│       │   └── templates/
│       ├── custom-app-build/
│       ├── frontend-tool/
│       ├── version-upgrade/
│       └── maintenance/
│
└── _contracts/                          # Schemas + protocols (this folder)
    ├── gate-format.md                   # Gate protocol — used verbatim
    ├── spec-template.md                 # PM spec output (incl. Tech Stack, Integrations, Timezone)
    ├── folder-structure.md              # This file
    ├── project-json.schema.json         # Project state schema
    ├── integration-contract.schema.json # One Integration Contract Registry entry
    ├── health-score.schema.json         # Project Health Score
    ├── bug-tracker.schema.json          # QA bug lifecycle (Node/API/sync-oriented)
    ├── rfc-template.md                  # Request-for-Change (before ADR)
    └── adr-template.md                  # Architecture Decision Record
```

> **Note on dropped components:** there is no `content-migration-agent` and no standing Security Agent or Migration Agent. ERP/CRM data flow is a permanent **continuous cron-scheduled sync** owned by the Backend role + sync engine, not a one-time migration.

---

## 2. Per-project workspace (lives outside /skills/)

Each client project gets its own workspace folder. Agents **read** from `/skills/` and **write** to the project workspace. The folders below the dotted line (`integration-contracts/`, `rfcs/`, `decisions/`, `architecture-tests/`, `operations/`, `observability/`) are the Node-specific additions that make middleware delivery auditable.

```
/projects/[client-slug]/
├── CLAUDE.md                        # Per-project scoping — lists the exact "Required skill files" to load.
│                                    #   If this section is missing, the agent halts and adds it first.
├── project.json                     # State file (locked, versioned) — conforms to project-json.schema.json
├── project.json.lock                # Lock file (mutex for atomic writes)
├── project.json.versions/           # Auto-backup of every write
│   └── 2026-06-30T10-00-00.json
├── HANDOFF.md                       # Written at >90% context budget / session handoff; survives /compact
├── spec.md                          # PM output — conforms to spec-template.md
├── architecture.md                  # Produced at G1.5 (if it runs)
├── data-model.md                    # DB/data-model — client-approved at G-Schema
├── milestones.json                  # PM output
├── audit-log.jsonl                  # Append-only log of all state-changing actions
│
├── integration-contracts/           # The Integration Contract Registry — client-approved at G-Contracts
│   ├── _registry.md                 # Index of all contracts + their status
│   ├── ddi-inform.md                # One per system; each validates against integration-contract.schema.json
│   ├── ddi-inform.fields.md         # Row-by-row field-mapping the client signs off on
│   └── bigcommerce.md
│
├── rfcs/                            # Change-request proposals — conform to rfc-template.md
│   ├── RFC-0001-add-pricing-sync.md
│   └── ...
│
├── decisions/                       # Architecture Decision Records — conform to adr-template.md
│   ├── ADR-0001-cron-vs-webhook-per-source.md
│   ├── ADR-0002-conflict-resolution-policy.md
│   └── ...
│
├── architecture-tests/             # Architecture fitness tests — gated at G5
│   ├── controller-service-repository-boundaries.test.js
│   ├── no-db-access-outside-repositories.test.js
│   ├── api-version-enforcement.test.js
│   └── queue-retry-caps.test.js
│
├── operations/                      # Runbooks — must be present before G5.5 / G6
│   ├── incident-runbooks/           # Sev triage, on-call, escalation
│   ├── queue-recovery/              # Drain/replay DLQ, recover stuck/overlapping jobs
│   ├── webhook-replay/             # Re-deliver / dedupe webhooks safely (idempotency)
│   ├── db-restore/                  # Point-in-time restore, migration rollback
│   └── deploy-recovery/             # build → migrate → release → health-check → rollback
│
├── observability/                   # Approved at G5.5
│   ├── dashboards/                  # Metrics/queue-visibility dashboards (as code where possible)
│   ├── alerts/                      # Alert rules
│   ├── slo-sla.md                   # SLO/SLA definitions (fed by G5 load/soak capacity profile)
│   └── tracing.md                   # Tracing setup + sampling
│
├── qa-reports/
│   ├── bugs.json                    # Conforms to bug-tracker.schema.json
│   ├── sprint-2.1-qa.md
│   └── load-chaos-report.md
│
├── handoff-blocks/                  # Inter-agent handoffs
│   ├── pm-to-architect.md
│   ├── architect-to-backend.md
│   └── ...
│
├── health-score.json                # Conforms to health-score.schema.json — baselined at M6
│
└── final-deliverables/
    ├── client-report.pdf
    ├── handoff-guide.pdf
    └── archive.zip
```

---

## 3. Rules of the road

1. **Never put platform/integration content in `_spine/`.** If a file mentions BigCommerce, Shopify, an ERP name, Express, Sequelize, or any concrete tech, it belongs in `nodejs/`, not the spine.
2. **Never put universal logic in the `nodejs/` arm.** Cross-cutting rules (gates, persona, context budget, model policy, conventions) live in `_spine/`.
3. **Integration KB loads only when in scope.** `nodejs/integrations/<system>/` loads only if `<system>` is in `project.json.integration_targets`. A BigCommerce project never loads Shopify KB; a middleware project never loads `frontend-tool` KB.
4. **Project-type KB lives in `nodejs/projects/<type>/`** and loads only for the active `project_type` (`pt-*` tag).
5. **All schemas live in `_contracts/`.** Schema changes are versioned and reviewed.
6. **Workspace is write-target, skill is read-source.** Agents read `/skills/`, write `/projects/[client-slug]/`.
7. **No code before approval.** No integration code against a `draft` contract (G-Contracts); no shared-env migration before G-Schema; no UI build before G2.
8. **Examples beat rules.** Every knowledge file should reference at least one example under `nodejs/examples/`.

---

Last reviewed: 2026-06-30 (initial Node.js build)
Next review due: 2026-09-30
