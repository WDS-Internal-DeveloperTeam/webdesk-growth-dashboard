---
tier: 2
load_when: ["webdesk-growth-dashboard", "skill-verification"]
description: "Confirms context-budget compliance — this profile does not force loading outside the active project_type/integration scope, tier caps are respected, and a task touching one integration doesn't pull in the other three."
---

# Context-Loading Tests

> Exercises `_spine/shared-knowledge/context-budget.md`'s rules against this profile specifically — the "200K-error fix" the base skill was built around must survive this profile's addition, not be reintroduced by it.

---

## Test 1 — A GitHub-only task loads no WordPress/Google-Workspace/Vercel integration content

**Setup:** a task scoped to "implement the GitHub webhook signature verification handler."

**Expected load set:** spine (step 1) → active role (step 2) → base Node.js skill + relevant `nodejs/knowledge/security/04-webhook-security.md` (step 3) → `custom-app-build` (step 4) → this profile's `SKILL.md` + `knowledge/06-github-app-integration.md` (step 5) → `integrations/github/*` only (step 6) → any canonical doc referenced by path, e.g. `08_API_and_Integration_Contracts.md §5` (step 7).

**Must NOT load:** `integrations/wordpress/*`, `integrations/google-workspace/*`, `integrations/vercel/*`, or any `nodejs/integrations/{bigcommerce,shopify,erp}/*`.

**Verification method:** manual trace of `knowledge/06-github-app-integration.md`'s own cross-references (its "What this file does not cover" section points to `integrations/github/` only, plus sibling knowledge files by path — never another integration directory). **Pass.**

## Test 2 — A job-execution-model task loads Vercel integration content, not GitHub/WordPress/Google-Workspace

**Setup:** a task scoped to "implement the JobQueueAdapter against Vercel Queues."

**Expected load set:** ... → `knowledge/04-serverless-queues-workflows-and-cron.md` (step 5) → `integrations/vercel/01-functions-queues-workflows-cron.md` (step 6) → canonical `08_API_and_Integration_Contracts.md §8` (step 7).

**Must NOT load:** the other three `integrations/*` directories. **Pass** — `knowledge/04`'s own text references `integrations/vercel/` exclusively for implementation detail.

## Test 3 — `nodejs/integrations/{bigcommerce,shopify,erp}/*` is never loaded for this project

**Setup:** any task on this project, regardless of stage.

**Expected:** these three directories are never in the load path, because `project.integration_targets` for this project is `["github", "wordpress", "google-workspace"]` — none of `bigcommerce`, `shopify`, or any `erp:*` target. Per the base skill's own orchestrator rule (`_spine/orchestrator/SKILL.md` Critical Rule #10: "Refuse to load KB outside the active project_type + integration_targets"), these directories are excluded by the base skill's own mechanism, unchanged by this profile. `SKILL.md §5`"Excluded" restates this explicitly for this project. **Pass, by construction — no profile-specific enforcement needed beyond restating the existing rule.**

## Test 4 — Tier-2 knowledge files are read on demand, not preloaded en masse

**Setup:** a task scoped narrowly (e.g., "fix a typo in the Notification Center's retry-count display").

**Expected:** only `knowledge/09-google-workspace-smtp.md` (the specific relevant file) loads at tier-2 "on demand," not all 16 `knowledge/*.md` files preemptively. Per `CONVENTIONS.md §2`: "Default to Tier 2 for knowledge files... on demand — agent reads explicitly." **Pass** — every knowledge file in this profile is tier 1 or 2 (none is tier 0 "every message"), and `SKILL.md §8`'s file index is itself the on-demand lookup table an agent consults to find the _one_ relevant file rather than loading all sixteen.

## Test 5 — Size caps hold for every file in this profile

```bash
python3 webdesk-nodejs/tools/scripts/validate-frontmatter.py webdesk-nodejs/skills
```

**Expected:** no size-cap violation reported for any file under `profiles/webdesk-growth-dashboard/`. See `docs/skill-build/validation-report.md` for the actual run result — every knowledge file in this profile was authored with the tier-1 (25KB) / tier-2 (50KB) caps in mind, splitting content across the numbered files (16 knowledge files, four integration directories) specifically so no single file needed to exceed its cap.

---

## Results

See `docs/skill-build/validation-report.md`.
