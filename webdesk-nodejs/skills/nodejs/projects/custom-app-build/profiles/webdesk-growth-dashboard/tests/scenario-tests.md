---
tier: 2
load_when: ["webdesk-growth-dashboard", "skill-verification"]
description: "End-to-end worked scenarios exercising this profile as a whole, plus the forbidden-content grep sweep required by skill-build task §18 (ACF, Neon, Resend, Singapore/India, permanent-worker assumptions, secrets, pricing data, autonomous Claude execution)."
---

# Scenario Tests

> Worked, whole-profile scenarios (distinct from `precedence-tests.md`'s narrow precedence-resolution cases) plus the literal forbidden-content sweep required by the skill-build task's §18 checklist.

---

## Scenario A — A new agent onboarding to this project reads only what it needs

**Setup:** a fresh agent session starts with `project.json` stating `project_type: custom-app-build, project_profile: webdesk-growth-dashboard, stage: development, current_gate: G4-sprint-1.1`, and the task is "implement the confidential-field export check for the Business Knowledge Center module."

**Expected path:** orchestrator loads spine + PM/Backend role (whichever is active) + `nodejs/SKILL.md` + `custom-app-build/SKILL.md` + this profile's `SKILL.md` → reads `SKILL.md §8`'s file index, identifies `knowledge/12-dashboard-security-controls.md` as the relevant file (confidential-field permission axis) → reads it, finds the five independent checks (view/edit/export/task-package/Git-artifact) → implements the export check specifically, per `knowledge/10-data-ownership-and-audit.md`'s DTO/serializer guidance referenced from `knowledge/12` → no integration directory needed (this task touches no external system) → produces an audit event per `contracts/audit-event.schema.json` for the permission-change-adjacent action, if the check itself is a new grantable permission being added.

**Pass condition:** every file the agent needed exists at the path `SKILL.md §8` promised, and no step required guessing at content this profile doesn't actually contain. **Pass.**

## Scenario B — A task tries to design `dashboard-worker` as a BullMQ persistent worker (must be caught)

**Setup:** a task's draft implementation plan proposes `new Worker('scan-runs', handler, { connection: redisConnection })` (the base skill's own BullMQ worked example from `nodejs/knowledge/integration/02-queues-and-jobs.md`) for `dashboard-worker`.

**Expected outcome:** Code Review (or self-check, per the task-package template's completion checklist) catches this against WDS-005 ("Never assume `dashboard-worker` is, or design it as, a permanent process") and `knowledge/04-serverless-queues-workflows-and-cron.md`'s resolved model. The base skill's own worked example is exactly the kind of pattern this profile's forbidden-actions file exists to override for this specific project — a naive agent following only the base skill's `integration/02-queues-and-jobs.md` without also loading this profile's `knowledge/04` would produce exactly this violation. **This is the single most important scenario in this file** — it's the concrete case that justifies WDS-005 existing as an explicit, high-severity rule rather than trusting `knowledge/04` alone to be read every time.

## Scenario C — A task tries to add ACF to the WordPress repository "just for this one field" (must be caught)

**Setup:** a task implementing a new Case Study field proposes using ACF because "it's faster than registering native post meta for one field."

**Expected outcome:** blocked by WDS-001, absolute and non-negotiable regardless of the field count or time pressure — restated explicitly in `knowledge/07-wordpress-integration.md` and `knowledge/15-project-specific-forbidden-actions.md`'s Code Review checklist. **Pass, by design.**

## Scenario D — A release task tries to mark a Ready-for-Claude task complete from a local commit alone (must be caught)

**Setup:** a task reports "done, committed as `abc1234`" without a remote verification step.

**Expected outcome:** blocked by WDS-008 and the task-package-template's completion checklist ("If Git artifacts changed: pushed, and the remote commit SHA is confirmed to exist via a live GitHub read"). **Pass, by design.**

---

## Forbidden-content grep sweep (skill-build task §18)

Run from the profile root:

```bash
cd webdesk-nodejs/skills/nodejs/projects/custom-app-build/profiles/webdesk-growth-dashboard
PROFILE_DIR="."

echo "--- ACF (should find ZERO except in explicit exclusion-rule statements) ---"
grep -rn "ACF" $PROFILE_DIR --include='*.md' | grep -vi "no ACF\|not use ACF\|never use ACF\|no ACF plugin\|ACF-based\|ACF Local JSON\|ACF instructions\|WDS-001"

echo "--- Neon (should find ZERO except in explicit exclusion-rule statements) ---"
grep -rn "Neon\|neon" $PROFILE_DIR --include='*.md' --include='*.json' | grep -vi "exclud\|WDS-002\|stop.condition\|never.*neon\|not.*neon\|neon.based"

echo "--- Resend (should find ZERO except in explicit exclusion-rule statements) ---"
grep -rn "Resend" $PROFILE_DIR --include='*.md' | grep -vi "not use Resend\|WDS-004\|excluded\|do not use resend"

echo "--- Singapore / India (should find ZERO except in explicit exclusion-rule statements) ---"
grep -rn "Singapore\|India" $PROFILE_DIR --include='*.md' | grep -vi "no.*singapore\|no.*india\|outside.*singapore\|WDS-003\|not.*singapore\|not.*india"

echo "--- secret-looking values (API keys, tokens — should find ZERO real-looking values) ---"
grep -rnE "(sk_live|sk_test|AKIA[0-9A-Z]{16}|ghp_[0-9A-Za-z]{36}|-----BEGIN (RSA )?PRIVATE KEY-----)" $PROFILE_DIR

echo "--- pricing data (should find ZERO — no service pricing copied into the skill) ---"
grep -rniE '\$[0-9]+(,[0-9]{3})*(\.[0-9]{2})?\s*(/|\bper\b)|price list|pricing tier' $PROFILE_DIR --include='*.md'

echo "--- permanent-worker assumptions (should find ZERO outside WDS-005's own exclusion statement) ---"
grep -rn "app.listen\|new Worker(" $PROFILE_DIR --include='*.md' | grep -v "WDS-005\|NEVER\|forbidden\|does not carry over\|has no server.js"

echo "--- automatic production deployment / auto-merge (should find ZERO outside WDS-007/WDS-009's own exclusion statements) ---"
grep -rniE "auto-deploy production|automatically merge|auto-merge to (main|staging)" $PROFILE_DIR --include='*.md' | grep -v "WDS-007\|never\|forbidden\|no automation path"

echo "--- autonomous Claude/Anthropic API execution (should find ZERO outside the V1 boundary's own exclusion statements) ---"
grep -rniE "automatically (call|invoke) the anthropic api|autonomous.*claude" $PROFILE_DIR --include='*.md' | grep -v "WDS-009\|does not\|never\|no scheduled job"
```

**Expected result for every check above:** empty output (after the `grep -v` exclusion of the rule statements themselves, which necessarily _mention_ the forbidden term in order to forbid it). See `docs/skill-build/validation-report.md` for the actual run output.

---

## Results

See `docs/skill-build/validation-report.md` for the consolidated pass/fail record across all scenarios and the grep sweep.
