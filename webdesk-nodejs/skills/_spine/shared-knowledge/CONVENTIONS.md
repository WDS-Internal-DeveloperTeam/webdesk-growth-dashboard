---
tier: 1
load_when: ["always"]
---

# System Conventions — read before authoring or editing any file

> This is the single source of truth for how files in the WebDesk Node.js Delivery System are structured. Every SKILL.md, knowledge file, and template obeys it. If you are an agent building or editing this system, follow this exactly so the system stays consistent and loadable within context limits.

---

## 1. Frontmatter (mandatory on every SKILL.md and KB file)

Every `SKILL.md`:

```yaml
---
name: <kebab-case-id>
description: <when to trigger + what it does — pushy, specific>
version: <semver>
tier: 0 | 1 | 2 | 3
load_when: ["task-tag", ...] # ["always"] for tier 0
tools: [Read, Write, Edit, Glob, Grep, Bash]
model: opus | sonnet | haiku
color: <any>
---
```

Every knowledge (`.md`) file:

```yaml
---
tier: 0 | 1 | 2 | 3
load_when: ["task-tag", ...]
description: <one line> # optional but encouraged
---
```

## 2. Tiers (context-budget discipline — non-negotiable)

| Tier | Loads                                            | Size cap | Examples                                          |
| ---- | ------------------------------------------------ | -------- | ------------------------------------------------- |
| 0    | Every message                                    | < 15 KB  | persona.md, orchestrator/SKILL.md, CONVENTIONS.md |
| 1    | When a matching task tag is active (or "always") | < 25 KB  | agent SKILL.md, forbidden, coding-standards       |
| 2    | On demand — agent reads explicitly               | < 50 KB  | most knowledge files                              |
| 3    | Never auto-loaded (human reads)                  | —        | docs, release-notes, decision-inventory           |

Default to Tier 2 for knowledge files. Only the agent's own SKILL.md and the truly always-needed files are Tier 0/1. **Keep files small.** If a file would exceed its cap, split it and add a pointer.

## 3. Task tags (drive load_when)

- Stage: `discovery`, `intake`, `planning`, `g0`, `g1`, `g1_5`, `g_contracts`, `g_schema`, `design`, `scaffold`, `g4`, `g5`, `g5_5`, `g6`, `launch`, `monitoring`
- Agent: `orchestrator-active`, `pm-active`, `architect-active`, `designer-active`, `backend-active`, `frontend-active`, `qa-active`, `code-review-active`, `delivery-head-active`
- Task type: `code-production`, `code-review`, `mockup-production`, `bug-management`, `integration-work`, `schema-work`, `sync-engine`, `observability`, `security-topic`, `state-mutation`, `destructive-op`
- Platform/target: `nodejs` (always for this skill), `integration-bigcommerce-active`, `integration-shopify-active`, `integration-erp-active`
- Project type: `pt-integration-middleware`, `pt-custom-app-build`, `pt-frontend-tool`, `pt-version-upgrade`, `pt-maintenance`

## 4. Gate IDs (canonical)

`Discovery(G0.5) → G0 → G1 → G1.5 → G-Contracts → G-Schema → G2 → G3 → G4(×n) → G5 → G5.5 → G6 → M6`

| ID          | Name                                                   | Type      | Approver                       |
| ----------- | ------------------------------------------------------ | --------- | ------------------------------ |
| G0.5        | Discovery                                              | Human     | PM + client                    |
| G0          | Spec Validation                                        | Auto      | system                         |
| G1          | Plan + Estimate (+ estimate→ticket)                    | Human     | PM lead                        |
| G1.5        | Architecture Review (conditional, >80hr or complexity) | Human     | Tech lead                      |
| G-Contracts | Integration/API contract approval                      | Human     | PM + **client**                |
| G-Schema    | DB / data-model approval                               | Human     | PM + **client** (DBA verifies) |
| G2          | HTML design approval (if UI)                           | Human     | Design lead + client           |
| G3          | Scaffold verification                                  | Auto+spot | Tech lead                      |
| G4          | Sprint QA (repeats)                                    | Hybrid    | QA lead                        |
| G5          | Milestone regression + fitness + load/chaos            | Hybrid    | Tech lead + PM                 |
| G5.5        | Observability approval (+ runbooks present)            | Human     | Delivery head + Tech lead      |
| G6          | Pre-launch                                             | Human     | Delivery head + client         |
| M6          | Post-launch monitoring + health score                  | —         | Delivery head                  |

Gate block format is defined in `_contracts/gate-format.md` — use it verbatim.

## 5. Model policy (the system picks, never the dev)

Declared per skill in frontmatter. Haiku = mechanical; Sonnet = production code + most agent work; Opus = planning, architecture, hard debugging. Escalation ladder Haiku→Sonnet→Opus on 2nd failure or complexity flag. Full matrix in `_spine/shared-knowledge/model-policy.md`.

## 6. Context-budget rules (the 200K-error fix)

- Load KB **only** for the active `project_type` + `integration_targets` from `project.json`. Never load another project-type's or platform's KB.
- Session start loads ~7 files via the project's `CLAUDE.md` "Required skill files" list.
- At >90% budget: halt, write `HANDOFF.md`, surface to dev. Never truncate silently.
- Full rules in `_spine/shared-knowledge/context-budget.md`.

## 7. Writing style (inherited operating contract)

Truthful, specific, no buttering, push back on bad decisions, cite sources, surface trade-offs, flag uncertainty explicitly (especially for external API surfaces we haven't verified — e.g. ERP APIs). See `_spine/persona.md`. Use imperative voice in instructions. Explain _why_, avoid heavy-handed ALL-CAPS MUSTs except for the few hard rules.

## 8. Tech stack defaults (per blueprint v3)

- Backend: **Node.js 22+, ES Modules, Express**. DB: **PostgreSQL + Sequelize** (default; alternatives MySQL/MongoDB, Prisma/TypeORM by justification). Storage: S3 / Cloudinary / GCS.
- Frontend: **React / Next.js**.
- ERP/CRM data flow: **continuous cron-scheduled sync**, timezone-driven by Dashboard Settings.
- Choices are per-project from the approved lists and justified at the relevant gate; agents read the tech stack from `spec.md` and ask if a layer is missing.

---

Last reviewed: 2026-06-30 (initial build)
