---
tier: 2
load_when: ["agent-cascade-decision", "orchestrator-active"]
description: "How skills load each other. Cascade order + tier-aware load algorithm. This is where the context-budget discipline is enforced at the loader."
---

# 06 — Agent Cascade

> Cascade order matters: get it wrong and the invoked agent lacks the context it needs, or loads KB it must never see. This file ties the cascade to `_spine/shared-knowledge/context-budget.md`.

---

## The cascade order (universal)

```
1. Orchestrator (already loaded — you are here)
       ↓
2. Spine agent SKILL.md  (PM / Architect / Designer / QA / Code Review / Delivery Head)
       ↓
3. nodejs arm  (nodejs/SKILL.md) — always, for the Backend/Frontend roles + standards
       ↓
4. Integration targets — ONLY those in project.json.integration_targets
       (e.g. nodejs/integrations/bigcommerce/, nodejs/integrations/erp/ddi-inform.md + _erp-adapter-pattern.md)
       ↓
5. Project-type skill — ONLY project.project_type
       (nodejs/projects/<project_type>/SKILL.md)
       ↓
6. On-demand KB — Tier 2 files the agent reads explicitly when the task needs them
```

Each layer's SKILL.md is a lean entry point. Deeper KB is read on demand, not all at once. **Step 4 is the hard context boundary:** never load an integration target that isn't in `integration_targets`; never load a second project-type's arm. A `nodejs+bigcommerce` middleware project never touches Shopify files or `frontend-tool` KB.

---

## Tie to context-budget

This cascade IS the enforcement of context-budget.md:

- **Rule 1** (load by project_type + integration_targets only) → steps 4 and 5 above.
- **Rule 2** (honor tiers) → the load algorithm below.
- **Rule 3** (`CLAUDE.md` allow-list) → the session-start load set (`01-session-start-protocol.md`).
- **Rule 4** (size caps) → Code Review flags oversized files for split.
- **Rule 5** (90% guardrail) → `05-escalation-paths.md` § Budget.

Target: ~15–25K cached tokens/message, not 79K+.

---

## Tier-aware load algorithm (from CONVENTIONS §2/§3)

Every KB file declares `tier` + `load_when`. The loader honors them:

| Tier  | When loaded                                                    | Examples                                                                                                          |
| ----- | -------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------- |
| **0** | every message                                                  | persona.md, CONVENTIONS.md, context-budget.md, model-policy.md, orchestrator/SKILL.md                             |
| **1** | when a matching `load_when` task tag is active (or `"always"`) | agent SKILL.md, `forbidden-global.md` (code-production), `nodejs` forbidden, `ai-tool-rules.md` (file-production) |
| **2** | on demand — the agent calls `Read` explicitly                  | most knowledge files, the orchestrator's own knowledge/ files, state/gate/escalation                              |
| **3** | never auto-loaded (human reads)                                | docs, decision inventory, release notes                                                                           |

```python
def load_cascade(active_tags: set) -> list:
    loaded = []
    for file in kb_files_in_scope(project_type, integration_targets):  # scope FIRST (Rule 1)
        meta = read_frontmatter(file)
        tier = meta.get("tier", 3)               # default Tier 3 if missing
        when = set(meta.get("load_when", []))
        if tier == 0:
            loaded.append(file)
        elif tier == 1 and (when & active_tags or "always" in when):
            loaded.append(file)
        # tier 2 → NOT preloaded; agent reads on demand
        # tier 3 → never auto-loaded
    return loaded
```

`kb_files_in_scope(...)` excludes every project-type and integration target not in `project.json`. A Tier 0 file in an out-of-scope arm is still NOT loaded — scope is applied before tier.

---

## Active task tags (CONVENTIONS §3)

The orchestrator maintains the currently-active tag set. Tags come from:

- **Stage:** `discovery`, `intake`, `planning`, `g0`, `g1`, `g1_5`, `g_contracts`, `g_schema`, `design`, `scaffold`, `g4`, `g5`, `g5_5`, `g6`, `launch`, `monitoring`
- **Agent:** `orchestrator-active`, `pm-active`, `architect-active`, `designer-active`, `backend-active`, `frontend-active`, `qa-active`, `code-review-active`, `delivery-head-active`
- **Task type:** `code-production`, `code-review`, `mockup-production`, `bug-management`, `integration-work`, `schema-work`, `sync-engine`, `observability`, `security-topic`, `state-mutation`, `destructive-op`
- **Platform/target:** `nodejs` (always), `integration-bigcommerce-active`, `integration-shopify-active`, `integration-erp-active`
- **Project type:** `pt-integration-middleware`, `pt-custom-app-build`, `pt-frontend-tool`, `pt-version-upgrade`, `pt-maintenance`

A Tier 1 file loads only when its `load_when` intersects the active set. `integration-shopify-active` is never set on a BigCommerce project, so Shopify Tier 1 files never load.

---

## Frontmatter validation rule (Code Review enforces on every KB PR)

- `tier:` present, value ∈ {0,1,2,3}.
- `load_when:` array present (`["always"]` for Tier 0).
- Tier 0 files MUST include `"always"` and be < 15 KB.
- Tier 1 < 25 KB · Tier 2 < 50 KB. Over cap → split + pointer.

---

## Per-stage cascade examples

### Architecture review (Architect, integration-middleware pilot)

```
1. orchestrator/SKILL.md (you)
2. _spine/architect-agent/SKILL.md
3. nodejs/SKILL.md
4. nodejs/integrations/erp/ddi-inform.md + _erp-adapter-pattern.md + nodejs/integrations/bigcommerce/ (in integration_targets)
5. nodejs/projects/integration-middleware/SKILL.md
6. on demand: nodejs/knowledge/intelligence/{integration,sync-engine,failure-scenario}.md, _contracts/{adr-template,integration-contract.schema}.md
```

### Backend development — sync engine (sprint S2.1)

```
1. orchestrator/SKILL.md
2. nodejs/SKILL.md
3. nodejs/knowledge/backend/* + database/* + integration/* (active task tags)
4. nodejs/knowledge/.../forbidden (CRITICAL — never skip)
5. nodejs/integrations/erp/ddi-inform.md + _erp-adapter-pattern.md
6. on demand: data-model.md, the client-approved integration contract, spec.md acceptance criteria
```

Shopify integration files: never loaded on this BigCommerce project.

---

## Loading rules

**Eager** (before the agent acts): the agent's own SKILL.md, the `nodejs` forbidden file when producing code, the active `project.json`, the contracts referenced by the agent's SKILL.md.

**Lazy** (on demand): specific knowledge files, examples, templates, other project artifacts (spec.md, data-model.md).

**Never**: another project-type's arm, an integration target not in `integration_targets`, another project's state, multiple agents' deep KB at once.

---

## Prompt caching

Put stable content first (orchestrator SKILL.md, nodejs arm, in-scope KB, schemas) to maximize cache hits; put dynamic content last (`project.json` — changes per turn, never cache it; work-in-progress artifacts; user input).

---

## Anti-patterns

1. Loading everything upfront. 2. Skipping the spine (project-type skills assume spine context). 3. Loading multiple integration targets or project-types. 4. Caching `project.json`. 5. Loading a Tier 2 file eagerly "just in case." 6. Ignoring scope and relying on tier alone — scope (Rule 1) is applied first.

---

Last reviewed: 2026-06-30 (initial Node.js build)
Next review due: 2026-09-30
