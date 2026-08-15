---
tier: 2
load_when: ["project-init"]
description: "Per-project CLAUDE.md template. Includes the mandatory 'Required skill files' context allow-list."
---

# CLAUDE.md Template (per project)

> Copy to the project root as `CLAUDE.md`. Auto-loaded at session start, FIRST, every time. It carries project identity, current gate, and — critically — the **Required skill files** allow-list that scopes context loading (the 200K-error fix). If the "Required skill files" section is missing, the orchestrator halts and adds it before any work.

---

```markdown
# CLAUDE.md — {{Project Name}}

> Project memory. Read first at every session start. Keep it tight.

## Identity

- **Client:** {{Client Name}} ({{client-slug}})
- **Project:** {{Project Name}}
- **Build context:** {{nodejs | nodejs+bigcommerce | nodejs+shopify}}
- **Project type:** {{integration-middleware | custom-app-build | frontend-tool | version-upgrade | maintenance}}
- **Integration targets:** {{["bigcommerce", "erp:ddi-inform"]}} ← drives which integration KB loads
- **Timezone:** {{America/Toronto}} **Tenant:** {{per-client | master}}
- **Host target:** {{local | aws | gcp | cloudflare | heroku | vps}}
- **Tech stack:** {{Node 22 + Express + PostgreSQL + Sequelize; React/Next dashboard; JWT; per-module VED RBAC}}
- **State file:** `outputs/{{client-slug}}/project.json`

## Required skill files for this project ← MANDATORY. The context allow-list.

> Load ONLY these at session start (~7 files). Loading anything outside this list risks
> the 200K context wall. Never load another project_type's KB or an integration target
> not listed under "Integration targets" above. (See `_spine/shared-knowledge/context-budget.md`.)

Always (Tier 0):

- `_spine/persona.md`
- `_spine/shared-knowledge/CONVENTIONS.md`
- `_spine/shared-knowledge/context-budget.md`
- `_spine/shared-knowledge/model-policy.md`
- `_spine/orchestrator/SKILL.md`

Active agent (one at a time):

- `_spine/{{active-agent}}/SKILL.md` (e.g. `pm-agent`, `architect-agent`, `qa-agent`, `delivery-head`)

Node arm + this project's scope:

- `nodejs/SKILL.md`
- `nodejs/projects/{{project_type}}/SKILL.md`
- {{`nodejs/integrations/bigcommerce/01-management-api.md`}} (only if in integration_targets)
- {{`nodejs/integrations/erp/ddi-inform.md` + `nodejs/integrations/erp/_erp-adapter-pattern.md`}} (only if in integration_targets)

On demand (Tier 2 — Read when the task needs it; do NOT preload):

- `nodejs/knowledge/intelligence/{database,integration,sync-engine,failure-scenario,api-design}-*.md`
- `_spine/shared-knowledge/{security-baseline,git-branch-strategy,forbidden-global,...}.md`
- `outputs/{{client-slug}}/{spec.md, data-model.md, integration-contracts/*}`

Do NOT load: any other project_type arm; any integration target not listed; Shopify files on a BigCommerce project; multiple agents' deep KB at once.

## Current state

- **Stage:** {{schema}} **Current gate:** {{G-Schema (open)}}
- **Active milestone / sprint:** {{M1 / S1.1}}
- **Blocked on:** {{client sign-off on data-model.md}}

## Active tasks (this sprint)

1. {{...}}
2. {{...}}

## Recent decisions

- {{[2026-07-12] ADR-004 — BullMQ + Redis for the sync queue.}}
- {{[2026-07-11] PostgreSQL + Sequelize confirmed (system default).}}

## Open client blockers

- {{[2026-07-10] DDI Inform sandbox credentials — verify-at-discovery. Owner: human PM.}}

## Cautions

- {{Do NOT run migrations in staging before G-Schema passes.}}
- {{DDI Inform API surface is UNVERIFIED — code against the documented contract + mock.}}

---

Last touched: {{timestamp}} · by {{name-or-agent}}
```

---

Last reviewed: 2026-06-30 (initial Node.js build)
Next review due: 2026-09-30
