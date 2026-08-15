---
tier: 2
load_when: ["agent-routing", "orchestrator-active"]
description: "Stage→agent and task→skill maps for the Node flow. The orchestrator uses this to pick the specialist."
---

# 02 — Routing Table

> Maps stages → agents and tasks → skills for the Node.js delivery flow. Read before invoking any specialist. Cascade per `06-agent-cascade.md`.

---

## Stage → Agent mapping (Node flow)

| Stage         | Primary agent                                                                                    | Supporting                        | Output artifact                                                           | Next gate                |
| ------------- | ------------------------------------------------------------------------------------------------ | --------------------------------- | ------------------------------------------------------------------------- | ------------------------ |
| discovery     | PM Agent                                                                                         | Designer (HTML wireframes)        | discovery report + rough field-mapping & API direction                    | G0.5                     |
| intake / spec | PM Agent                                                                                         | —                                 | `spec.md` (integration_targets, data sensitivity, timezone, tenant, host) | G0                       |
| planning      | PM Agent                                                                                         | —                                 | milestones + estimate (estimate→ticket)                                   | G1                       |
| architecture  | **Architect**                                                                                    | PM (scope), Backend (draft model) | `architecture.md` + ADRs + fitness-test plan + **draft** contracts/model  | G1.5                     |
| contracts     | **PM formalizes kickoff draft → Architect refines at G1.5 → Backend designs technical contract** | DBA/tech-lead (verify)            | Integration Contract Registry (`integration-contracts/`)                  | **G-Contracts** (client) |
| schema        | **PM formalizes kickoff draft → Architect refines at G1.5 → Backend designs technical model**    | DBA/tech-lead (verify)            | `data-model.md` (Postgres + Sequelize default)                            | **G-Schema** (client)    |
| design        | Designer                                                                                         | Frontend (early module sketch)    | HTML/CSS/JS dashboard mockup (D-DES-01)                                   | G2 (if UI)               |
| scaffolding   | **Backend role**                                                                                 | CI/Compose setup                  | repo + CI + migration runner + `.env.example` + contract stubs + Compose  | G3                       |
| development   | **Backend role + Frontend role**                                                                 | Code Review (per PR)              | Express services/repos/adapters/sync engine + React/Next modules          | G4 (per sprint)          |
| sprint-qa     | QA Agent                                                                                         | —                                 | sprint QA report                                                          | G4                       |
| milestone-qa  | QA Agent                                                                                         | —                                 | regression + fitness + load/chaos report                                  | G5                       |
| observability | **Delivery Head**                                                                                | Backend (wiring)                  | logs/metrics/tracing/alerts/dashboards/SLO-SLA + runbooks                 | G5.5                     |
| pre-launch    | **Delivery Head**                                                                                | QA (final pass)                   | pre-launch checklist + tested backup/rollback                             | G6                       |
| launch        | **Delivery Head**                                                                                | —                                 | deployed release + health check                                           | M6                       |
| monitoring    | Delivery Head + PM                                                                               | —                                 | health-score baseline on master dashboard                                 | (M6, retainer)           |

Backend and Frontend are **roles** delivered through the `nodejs/` arm (`nodejs/SKILL.md` + `nodejs/knowledge/{backend,frontend,database,integration,...}` + the active `integration_targets`), not separate spine SKILL.md files.

---

## Project-type routing variations

- **integration-middleware (headless, no UI):** **skip G2**. Steady state is the continuous cron sync engine. G1.5 almost always fires (>1 external system, new datastore, cron sync, two-way sync). The pilot (DDI Inform ↔ BigCommerce) runs the full sequence including G-Contracts + G-Schema.
- **custom-app-build:** full sequence; G2 applies (it has a UI). G1.5 fires on complexity.
- **frontend-tool:** Frontend-role-heavy; G-Contracts/G-Schema only if it persists data or calls external systems; G2 applies.
- **version-upgrade:** condensed; may skip Discovery; G1.5 if the upgrade is non-trivial.
- **maintenance:** may skip Discovery, G1.5, G-Schema. Trivial tickets route straight to the dev role under a single G4.

Apply the dependency graph in `04-state-management.md`; never skip a prerequisite gate silently.

---

## Task → Skill mapping

| Task pattern                                                | Route to                                                                                                                                                                                                          |
| ----------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| "Run discovery" / "synthesize requirements"                 | PM Agent (discovery)                                                                                                                                                                                              |
| "Onboard an existing / legacy repo" / "import this project" | PM Agent (onboarding — `pm-agent/knowledge/10-onboard-existing-project.md`; reconstruct from Graphify + code, validate, then maintenance)                                                                         |
| "Generate spec from intake"                                 | PM Agent                                                                                                                                                                                                          |
| "Generate plan / estimate"                                  | PM Agent                                                                                                                                                                                                          |
| "Raise a change request / RFC"                              | PM Agent (re-enters G1)                                                                                                                                                                                           |
| "Architecture review" / "design the queue/sync topology"    | Architect (G1.5)                                                                                                                                                                                                  |
| **"Design the data model"**                                 | **Backend role + database intelligence** (`nodejs/knowledge/intelligence/database-intelligence.md`, `nodejs/knowledge/database/`) → `data-model.md`, G-Schema                                                     |
| **"Define integration contract"**                           | **Backend role + integration intelligence** (`nodejs/knowledge/intelligence/integration-intelligence.md`, `nodejs/knowledge/integration/`) → Registry, G-Contracts                                                |
| **"Build sync job" / "build the cron sync"**                | **Backend role + sync-engine** (`nodejs/knowledge/integration/01-sync-strategies.md` + `nodejs/projects/integration-middleware/knowledge/02-sync-engine.md` + the active ERP adapter + `_erp-adapter-pattern.md`) |
| "List failure modes for this integration"                   | Backend role + failure-scenario library (`nodejs/knowledge/intelligence/failure-scenario-library.md`) — pre-flight before integration code                                                                        |
| "Design the API / pick status codes"                        | Backend role + API design intelligence (`nodejs/knowledge/intelligence/api-design-intelligence.md`)                                                                                                               |
| **"Build dashboard module"**                                | **Frontend role** (`nodejs/knowledge/frontend/`, dashboard standards)                                                                                                                                             |
| "Produce the dashboard mockup"                              | Designer (HTML, D-DES-01)                                                                                                                                                                                         |
| "Configure RBAC / roles & permissions"                      | Backend role (per-module VED) + Frontend role (UI)                                                                                                                                                                |
| "Wire the BigCommerce module"                               | Backend role + `nodejs/integrations/bigcommerce/` (only if in `integration_targets`)                                                                                                                              |
| "Wire the DDI Inform adapter"                               | Backend role + `nodejs/integrations/erp/ddi-inform.md` + `_erp-adapter-pattern.md` (verify API surface at discovery)                                                                                              |
| "Run sprint QA"                                             | QA Agent                                                                                                                                                                                                          |
| "Run milestone regression / fitness tests"                  | QA Agent                                                                                                                                                                                                          |
| **"Run load test" / "soak / chaos test"**                   | **QA Agent** (capacity profile feeds SLO/SLA)                                                                                                                                                                     |
| "Review this PR"                                            | Code Review Agent (usually GitHub Action, not you)                                                                                                                                                                |
| "Set up observability / runbooks"                           | Delivery Head (G5.5)                                                                                                                                                                                              |
| "Pre-launch checklist / backup / deploy"                    | Delivery Head (G6; deploy requires G6 passed + tested rollback)                                                                                                                                                   |
| "Establish health score"                                    | Delivery Head (M6) + PM (surfaces on master dashboard)                                                                                                                                                            |
| "Generate client memory"                                    | PM Agent                                                                                                                                                                                                          |

---

## Special routing rules

### Bug-fix routing — NO AUTO-FIX (hard rule, blueprint §1/#8)

1. QA Agent (or Code Review) writes the bug to `project.json.bugs[]` (severity P1–P4).
2. You do **NOT** auto-route to a dev role.
3. You surface it: "Bug [ID] reported, severity [P]. Want me to invoke the Backend/Frontend role to fix?"
4. The **developer** issues `Fix bug [ID]`.
5. You route to the dev role; the fix is produced on a `fix/[bug-id]-*` branch.
6. Code Review Agent reviews the fix.
7. The **developer merges** — no auto-merge.

AI "fixes" that don't fix anything are a known failure mode. Never silently retry-fix.

### Code-review routing

Triggered by a PR on `feature/*` or `fix/*` — the GitHub Action invokes Code Review Agent, not you. You record the result in `audit_log` when notified. You do not run the review inline.

### Cost-aware routing

Before routing to any agent: read its declared average token cost, check `token_used + estimate < token_cap * 0.9`, surface if it would exceed, log estimate + actual to `audit_log`.

---

## Budget Check

```
def check_budget(estimated_cost):
    p = read_project_json()
    used, cap = p.budget.token_used, p.budget.token_cap
    if used + estimated_cost > cap:
        halt("Token cap exceeded. Approve increase or stop.")
    if used + estimated_cost > cap * 0.9:
        warn("Approaching token cap (>90%). Continue?")
    return True
```

Same logic for `hours_burned` vs `hours_budget`.

---

## Requests you must NOT route (orchestrator-only refusals)

| Request                                                 | Why                          | Action                                         |
| ------------------------------------------------------- | ---------------------------- | ---------------------------------------------- |
| "Skip this gate"                                        | Gates non-skippable          | Refuse + explain                               |
| "Approve all gates"                                     | Per-gate decisions           | Refuse + list pending individually             |
| "Mark G-Contracts client-approved" (no client sign-off) | Client gate                  | Refuse — human PM must capture client approval |
| "Have the dev approve their own sprint"                 | Self-approval forbidden      | Refuse + name the other role                   |
| "Edit `project.json` directly"                          | Schema-validated writes only | Refuse + use the write protocol                |
| "Load the Shopify KB" (BigCommerce project)             | Out of `integration_targets` | Refuse — context-budget Rule 1                 |
| "Make it faster" (vague)                                | Vague                        | Ask specifics                                  |

---

## Routing audit

Every routing decision logs:

```json
{
  "timestamp": "2026-07-12T14:32:00Z",
  "actor": "orchestrator",
  "actor_type": "agent",
  "action": "route",
  "details": {
    "request": "Build the inventory sync job",
    "routed_to": "backend-role:sync-engine",
    "stage": "development",
    "estimated_tokens": 9000,
    "reason": "Sync engine owned by Backend role; G-Contracts + G-Schema passed"
  }
}
```

---

Last reviewed: 2026-06-30 (initial Node.js build)
Next review due: 2026-09-30
