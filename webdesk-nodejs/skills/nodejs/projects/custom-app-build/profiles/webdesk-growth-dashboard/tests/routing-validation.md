---
tier: 2
load_when: ["webdesk-growth-dashboard", "skill-verification"]
description: "Confirms the project.project_type/project_profile routing extension works without replacing custom-app-build as a top-level project type, and that the loading hierarchy in SKILL.md §2 resolves correctly for representative project.json states."
---

# Routing Validation

> Confirms §15 of the skill-build task: the `project_profile` field routes to this profile **as an addition to** `custom-app-build`, never as a replacement top-level `project_type`.

---

## Check 1 — `project_type` remains `custom-app-build`

```json
{ "project": { "project_type": "custom-app-build", "project_profile": "webdesk-growth-dashboard" } }
```

**Pass condition:** `project_type` validates against the base schema's existing enum (`integration-middleware | custom-app-build | frontend-tool | version-upgrade | maintenance`) unchanged — no new top-level value was added to that enum. Confirmed by inspection: `contracts/project-profile.schema.json`'s `project.project_type` property is `"const": "custom-app-build"`, which can only ever equal a value already present in the base enum. **This is true by construction**, not something that needs a runtime test — the schema literally cannot express a new top-level project_type value because it constrains to a `const` matching an existing one.

## Check 2 — `project_profile` is additive, not required by the base schema

```bash
python3 -c "
import json
base = json.load(open('webdesk-nodejs/skills/_contracts/project-json.schema.json'))
required = base['properties']['project']['required']
assert 'project_profile' not in required, 'base schema must not require project_profile — it does not know this field exists'
print('PASS: base schema unmodified, does not require project_profile')
"
```

**Pass condition:** the base skill's canonical schema has no `project_profile` field at all (confirmed — this profile did not edit that file, per Base-skill protection). A `custom-app-build` project **without** this profile continues to validate against the base schema exactly as before this profile existed.

**Corrected 2026-08-05:** this check's original wording claimed the base schema is extended via JSON Schema `allOf` + `$ref` composition. That claim was wrong and has been removed — `allOf` is an intersection of constraints, not an override, so it could never actually relax the base schema's enums, and it produced 6+ real validation failures when tested (see `docs/skill-build/validation-report.md`). `project_profile` (and `vercel_execution`, `host_target: vercel`, `tech_stack.storage: vercel-blob`) are now validated by `../tools/validate-project-profile.py`, which deep-copies the base schema in memory, applies documented patches from `../contracts/project-profile.schema.json`, and validates against the patched copy — the base schema file itself is never touched. Run it directly:

```bash
python3 ../tools/validate-project-profile.py
```

## Check 3 — Loading hierarchy order — honest statement of the actual mechanism

**Corrected 2026-08-05.** The prior version of this check said "manual trace, since the orchestrator's actual loader is not implemented as executable code" and left it there — true, but incomplete: it didn't say what the _actual_ mechanism is, which reads as if step 5 (this profile) loads automatically when it does not. Restated plainly:

- Steps 1–4 (spine, active role, base Node.js skill, `custom-app-build` skill) load via the base orchestrator's **existing, real** behavior — it already reads `project.project_type` and `project.integration_targets` and scopes loading accordingly.
- **Step 5 (this profile) has no equivalent orchestrator behavior.** The base skill does not know `project.project_profile` exists. The only reason this profile ever loads is that the project's root `CLAUDE.md` — read first, every session, by the base orchestrator's own already-existing session-start protocol — explicitly lists `nodejs/projects/custom-app-build/profiles/webdesk-growth-dashboard/SKILL.md` in its "Required skill files" section, positioned after the `custom-app-build` skill path and before any integration path. This is a **file-content convention**, not orchestrator code.

This is now an executable check, not a manual trace — `tools/validate-all.py`'s "Profile loading contract" check parses `templates/CLAUDE.md.template` (the reference implementation; re-run this same check against a real project `CLAUDE.md` once Phase 0 creates one) and confirms, inside its fenced routing-list block specifically:

```bash
python3 ../tools/validate-all.py 2>&1 | grep -A2 "loading contract"
```

**Pass condition:** `project.project_type == "custom-app-build"` and `project.project_profile == "webdesk-growth-dashboard"` are both stated; the `custom-app-build` `SKILL.md` path appears before the profile's own `SKILL.md` path, which appears before any `integrations/*` path; and the excluded-integrations statement (`bigcommerce,shopify,erp`) is present. All checked by position, not just presence — a routing list with the right lines in the wrong order would still fail.

The remaining part of the original manual trace (which files exist at which documented path, per steps 1–7 of `SKILL.md §2`) remains a valid documentation-consistency spot-check, not a routing-mechanism claim:

| Step | Expected to exist                                                                                                           | Confirmed present                                                                                                                                                  |
| ---- | --------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| 1    | `_spine/orchestrator/SKILL.md`, `_spine/persona.md`, `_spine/shared-knowledge/{CONVENTIONS,context-budget,model-policy}.md` | Yes — base skill, unmodified                                                                                                                                       |
| 2    | The active software-delivery role's `SKILL.md` (e.g. `_spine/pm-agent/SKILL.md`)                                            | Yes — base skill, unmodified                                                                                                                                       |
| 3    | `nodejs/SKILL.md` + relevant `nodejs/knowledge/*`                                                                           | Yes — base skill, unmodified                                                                                                                                       |
| 4    | `nodejs/projects/custom-app-build/{SKILL.md,gates.md,knowledge/01-app-shapes.md}`                                           | Yes — base skill, unmodified                                                                                                                                       |
| 5    | This profile's `SKILL.md`, then `knowledge/00-15` on demand                                                                 | Yes — all 16 files present, **and now loaded only because `CLAUDE.md.template` says so, per the corrected check above**                                            |
| 6    | `integrations/{github,wordpress,google-workspace,vercel}/`                                                                  | Yes — all four directories present                                                                                                                                 |
| 7    | Canonical project documentation by path                                                                                     | Yes — `webdesk-dashboard-documentation-v1/`, `docs/implementation/`, and (as of 2026-08-05) `canonical-inputs/` all exist and are referenced by path, never copied |

## Check 4 — Context-budget discipline: integrations load only when needed

```bash
# Confirm no knowledge/*.md file in this profile unconditionally references (as a required
# read, not an optional pointer) more than one integrations/ subdirectory — each knowledge
# file should route to AT MOST the specific integration it's about.
grep -l 'integrations/github\|integrations/wordpress\|integrations/google-workspace\|integrations/vercel' \
  webdesk-nodejs/skills/nodejs/projects/custom-app-build/profiles/webdesk-growth-dashboard/knowledge/*.md
```

**Expected:** each matched file references only its own corresponding integration directory as a "what this file does not cover — see integrations/X" pointer (a deferred, on-demand reference), never as a required co-load. Manually confirmed: `06-github-app-integration.md` → `integrations/github/` only; `07-wordpress-integration.md` → `integrations/wordpress/` only; `05-google-workspace-sso-and-local-admin.md` → `integrations/google-workspace/` only; `04-serverless-queues-workflows-and-cron.md` and `08-vercel-blob-and-file-handling.md` → `integrations/vercel/` only. No file references more than its own integration.

---

## Results

See `docs/skill-build/validation-report.md` for the consolidated pass/fail record.
