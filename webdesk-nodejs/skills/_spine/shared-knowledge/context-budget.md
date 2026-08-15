---
tier: 0
load_when: ["always"]
description: "The rules that prevent the 200K context-window error. Loaded always."
---

# Context Budget — the 200K-error fix

> The team hit the 200K context-window wall on a prior multi-platform pilot. This file is the design response. These are hard rules, not suggestions. The orchestrator enforces them; every agent obeys them.

## Why this exists

A single skill that loads everything for every project blows the window and the session errors out mid-task, losing state. The fix is not "smaller skill" — it's **scoped loading**: only the files the active project needs are ever in context at once. The skill can be large on disk; what's loaded is small.

## The five rules

### Rule 1 — Load by project_type + integration_targets only

Read `project.json`. Load:

- the active agent's SKILL.md,
- `nodejs/SKILL.md`,
- the project-type skill for `project.project_type` ONLY,
- the integration modules in `project.integration_targets` ONLY.

Never load another project-type's KB. Never load an integration target that isn't listed. A `nodejs+bigcommerce` middleware project never loads Shopify files or `frontend-tool` knowledge.

### Rule 2 — Honor tiers

- Tier 0: always (persona, CONVENTIONS, context-budget, model-policy, orchestrator SKILL).
- Tier 1: load when a matching `load_when` task tag is active.
- Tier 2: do NOT preload — the agent reads with the Read tool when the task needs it.
- Tier 3: never auto-load (human-read docs).

### Rule 3 — CLAUDE.md is the per-project allow-list

Each project root has a `CLAUDE.md` with a "Required skill files for this project" section listing the exact files to load at session start (~7 files, ~80–150 KB). If it's missing that section, halt and add it before proceeding. If `CLAUDE.md` itself is missing, halt and tell the dev to run `tools/scripts/init-project.sh`.

### Rule 4 — File size caps (CI-enforced)

Tier 0 < 15 KB · Tier 1 < 25 KB · Tier 2 < 50 KB. A file over its cap is split, with a pointer from the parent. `tools/scripts/validate-frontmatter.sh` + Code Review enforce this on every PR.

### Rule 5 — Budget guardrail

Track context usage. At >90%: halt, run `/compact`, drop files you've finished reading, update `HANDOFF.md`. If still tight, end the session cleanly and resume in a fresh one. **Never** silently truncate state or guess at dropped context.

## Practical loading example (the pilot)

`project.json`: `project_type: integration-middleware`, `integration_targets: ["bigcommerce", "erp:ddi-inform"]`.

Session-start load set:

1. `CLAUDE.md`, `HANDOFF.md`, `spec.md`
2. `_spine/persona.md`, `shared-knowledge/{CONVENTIONS,context-budget,model-policy}.md`
3. active agent SKILL.md (e.g. `backend` role via `nodejs` arm, or `pm-agent/SKILL.md`)
4. `nodejs/SKILL.md`
5. `nodejs/projects/integration-middleware/SKILL.md`
6. `nodejs/integrations/bigcommerce/*` (entry) + `nodejs/integrations/erp/ddi-inform.md` + `_erp-adapter-pattern.md`

Everything else (other ERPs, other project-types, deep knowledge files) is read on demand or never. Shopify integration files are never touched on this project.

---

Last reviewed: 2026-06-30 (initial build)
