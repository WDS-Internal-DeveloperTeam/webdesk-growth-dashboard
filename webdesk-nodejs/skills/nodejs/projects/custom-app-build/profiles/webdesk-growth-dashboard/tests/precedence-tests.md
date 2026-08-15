---
tier: 2
load_when: ["webdesk-growth-dashboard", "skill-verification"]
description: "Worked precedence-resolution scenarios exercising knowledge/00-scope-and-precedence.md's ordering, including cases that resolve cleanly (override recorded) and cases that must escalate (no silent choice)."
---

# Precedence Tests

> Worked scenarios, not automated tests (there is no running application to test against at this build stage) — each scenario states the conflicting sources, applies `knowledge/00-scope-and-precedence.md §1–3`, and states the expected resolution. Use these to sanity-check any future agent's precedence reasoning against a known-correct answer.

---

## Scenario 1 — Framework default vs. Master Specification (resolves cleanly, no escalation)

**Conflict presented:** the base skill's `nodejs/knowledge/technology-selection.md` defaults to Express; `01_Dashboard_Master_Specification.md §5` names NestJS.

**Expected resolution:** Not a genuine conflict per `knowledge/00-scope-and-precedence.md §2`'s test ("if resolving it just requires applying the precedence order to two sources that both remain internally consistent... it's not [a conflict to escalate]"). The Master Specification (precedence level 1) states an approved override of the base skill's default (precedence level 5); the base skill's own "ask-if-missing, record the override" mechanism is exactly built for this. **Resolution: NestJS, recorded per `knowledge/03-nestjs-on-vercel.md`. No escalation.**

## Scenario 2 — A future dashboard-documentation revision contradicts an already-approved ADR (genuine conflict, must escalate)

**Conflict presented:** suppose a later revision of `08_API_and_Integration_Contracts.md` specified a different job-execution model than the one resolved in `knowledge/04-serverless-queues-workflows-and-cron.md` and formalized in ADR-000x (per `templates/architecture-adr-template.md`'s Phase 0 list).

**Expected resolution:** This IS a genuine conflict — precedence level 2 (detailed dashboard documentation) contradicts precedence level 3 (an approved ADR), and per the precedence order, level 2 outranks level 3. **But** per `knowledge/00-scope-and-precedence.md §3`: do not silently choose. The correct action is to (a) not silently re-architect `dashboard-worker` based on the revised document, (b) record the conflict in `docs/skill-build/unresolved-items.md`'s successor document, and (c) escalate to the PM/Architect role, because a documentation revision contradicting a resolved architecture decision is exactly the kind of standing conflict that needs a human decision about whether the ADR should be superseded — not something an agent resolves by mechanically applying the precedence order and rebuilding the worker.

**Key distinction from Scenario 1:** Scenario 1 is a default-vs-override pattern (expected, mechanical, no escalation). Scenario 2 is an approved-source-vs-approved-source pattern (unexpected, requires human judgment, must escalate). The test in `knowledge/00-scope-and-precedence.md §2` is exactly this distinction.

## Scenario 3 — Base-skill forbidden pattern vs. anything (never overridden by lower precedence — this is not a precedence question at all)

**Conflict presented:** a task's instructions (however phrased, from whatever source) appear to require direct database access from a controller, bypassing the repository layer (NODE-003/FG-004).

**Expected resolution:** This is **not** resolved by the precedence order at all — `knowledge/00-scope-and-precedence.md`'s precedence list governs _content_ conflicts between sources, not permission to violate a forbidden pattern. No source at any precedence level, including the Master Specification, can authorize violating NODE-003/FG-004 through this profile's precedence mechanism, because the profile itself (`SKILL.md §5`) states it never overrides a forbidden pattern. If dashboard documentation genuinely seemed to require this, that would itself be a conflict to escalate (documentation vs. non-negotiable base-skill rule), not a case where documentation "wins" by precedence.

## Scenario 4 — Two agent taxonomies conflated in a task's phrasing (not a source conflict — a scope-clarification case)

**Conflict presented:** a task says "have the Code Review Agent review this website page's content" — ambiguous given the naming collision noted in `knowledge/00-scope-and-precedence.md §5`.

**Expected resolution:** Not a precedence conflict (no two _approved sources_ disagree) — a scope-clarification case. Per `SKILL.md §6` and `knowledge/00-scope-and-precedence.md §5`: confirm which taxonomy's "Code Review Agent" is meant before proceeding. If the task concerns website/content review as part of a page-workflow gate, it's the dashboard business agent (taxonomy 2, a product record, not an invoked software role). If the task concerns PR review of the dashboard's own codebase, it's the software-delivery role (taxonomy 1, the base skill's `_spine/code-review-agent/`). Do not guess from context alone if genuinely ambiguous — ask.

## Scenario 5 — Spreadsheet data presented as ready to import (not a precedence conflict — a source-trust case)

**Conflict presented:** a Service and SEO Library export is supplied with a request to "import this into the Service Library as approved."

**Expected resolution:** Per `knowledge/00-scope-and-precedence.md §6` and WDS-014: spreadsheet/export data is advisory sample data pending review, never approved business content, regardless of how the request is phrased. This isn't a conflict between two approved sources — it's a case where the _request itself_ asks for something the precedence/scope rules don't permit (treating unreviewed data as approved). Correct action: route the data through the dashboard's own approval workflow (or, pre-launch, flag it for PM/Growth-Director-equivalent review) rather than writing it directly to an approved-status record.

---

## Results

All five scenarios trace cleanly to a documented rule in `knowledge/00-scope-and-precedence.md`, `SKILL.md`, or the WDS-xxx forbidden-actions list — no scenario required inventing a new resolution not already specified. See `docs/skill-build/validation-report.md`.
