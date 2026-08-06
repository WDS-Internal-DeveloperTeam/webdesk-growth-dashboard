# Project Skill-Build Report — WebDesk Growth Dashboard

**Status:** Remediated and re-validated 2026-08-05, following an external verification review. This is the master narrative report for the skill-overlay build, per skill-build task §19. It explains what was reused, configured, extended, overridden, and excluded; why the base skill was not modified; how the project profile loads; and what must be approved before application development begins. Read this first among the `docs/skill-build/` reports; the other eight are its supporting detail.

## 0. Remediation summary (2026-08-05)

An external review found the initial build "approximately 85–90% ready" with four real blocking issues, all now fixed and re-verified — full detail in `docs/skill-build/validation-report.md`:

1. A JSON Schema `allOf`/`$ref` composition claim that didn't actually work (an intersection, not an override) — replaced with a patch-spec + offline validator (`tools/validate-project-profile.py`, `tools/validate-all.py`), both re-run and confirmed against deliberately-broken inputs, not just the happy path.
2. Profile-routing documentation that implied automatic orchestrator behavior that doesn't exist — corrected to state plainly that the project's own root `CLAUDE.md` is the actual V1 mechanism.
3. A forbidden-content scanner design flaw that reported its own teaching examples as violations — redesigned around file _role_ (structural data vs. policy prose vs. test fixtures) instead of blanket text search.
4. Packaging/manifest mechanics (a `sed` bug, two stray `.DS_Store` files, an export that apparently didn't include all three top-level pieces).

Separately, two of the three documents this build had marked as not-yet-supplied (WordPress Technical Discovery, Agent Specification Batch 1) were supplied in the same review cycle and are now registered — including surfacing and resolving one genuine architecture conflict (ACF) rather than applying either source silently. See `knowledge/07-wordpress-integration.md` §"ACF conflict — resolved" and `docs/skill-build/unresolved-items.md §D`.

---

## 1. What was built

A **project-specific skill overlay** at `webdesk-nodejs/skills/nodejs/projects/custom-app-build/profiles/webdesk-growth-dashboard/` — now 51 files (16 knowledge files, 4 integration-knowledge directories with 3 files each, 5 contract schemas, 7 templates, 5 test/validation documents, 2 executable validators, plus `SKILL.md`/`README.md`/`MANIFEST.txt`/`CHANGELOG.md`) — plus 12 files of proposed (unmerged) upstream improvements, this 9-file report suite, and 7 files of newly-registered canonical inputs, all outside the base skill's own tree.

**No application code was written.** No Turborepo workspace was scaffolded. No package was installed. No database migration was created. No connection to WordPress or GitHub was made. No deployment occurred. This is a documentation and knowledge-authoring deliverable only, exactly as scoped.

---

## 2. What was reused unchanged

The entire base skill's process machinery — the gate sequence, the software-delivery agent roster, the orchestrator's session-start/routing/state-management behavior, the context-budget discipline, the forbidden-pattern rules (NODE-xxx, FG-xxx), the controller/service/repository layering, the Sequelize/Postgres modeling and migration discipline, the OWASP-API security baseline, the webhook-security three-control model, the branch/release strategy — carries over to this project **without modification**. See `docs/skill-build/base-skill-reuse-map.md` for the file-by-file detail. This is the largest category by volume: most of what makes this project buildable through this skill system was already there.

## 3. What was configured

Base-skill decision points that exist specifically to be configured per-project (`technology-selection.md`'s "read the stack from spec.md," the `intelligence/*` decision tables, the multi-tenancy scoping-key choice) were configured with this project's already-approved answers: NestJS, PostgreSQL+Sequelize (the base default, needing no override at all), Turborepo, `project_id`-scoped repositories instead of `tenant_id`, Vitest over `node:test`, pnpm. See `docs/skill-build/project-overrides.md` for the full table.

## 4. What was extended

Four genuinely new integration surfaces (GitHub, WordPress, Google Workspace SSO, Google Workspace SMTP) and one genuinely new architectural surface (Vercel's serverless execution model) had no prior base-skill content to configure — these needed new knowledge authored _within_ the base skill's existing structural patterns (the adapter-behind-an-interface pattern from `integrations/erp/_erp-adapter-pattern.md`; the webhook three-control model from `security/04-webhook-security.md`; the required-job-properties list from `integration/01-02`). Sixteen `knowledge/*` files and twelve `integrations/*` files carry this new content. None of it required inventing a new _kind_ of rule — every extension follows an existing base-skill pattern, applied to a target the base skill hadn't reached yet.

## 5. What was overridden

Nine specific technology/architecture choices diverge from a base-skill _default_ (never a base-skill _rule_) — see `docs/skill-build/project-overrides.md` for the complete table with justification-basis citations. Every override was already approved in the skill-build task brief; this build's job was to record each one in the skill overlay so no future agent working this project re-derives or re-questions it.

## 6. What was excluded

`nodejs/integrations/{bigcommerce,shopify,erp}/*`, the other four project-type skills (`integration-middleware`, `frontend-tool`, `version-upgrade`, `maintenance`), and the ERP-sync-specific framing of `integration/01-sync-strategies.md` are all out of scope for this project and never load — restated explicitly in `SKILL.md §5` and enforced structurally by the orchestrator's existing context-budget rule (unchanged, not something this profile had to re-implement).

## 7. Why the base skill was not modified

Three reasons, in order of weight:

1. **The task required it** (§16: "Do not edit it in place during this task"). This alone would settle the question.
2. **It wasn't necessary.** Every gap this build hit was closeable by adding new files under `profiles/webdesk-growth-dashboard/` — nothing required changing an existing base-skill file's content or removing/relaxing a rule. Sections 9 and 10 of `docs/skill-build/proposed-upstream-patches.md` (the two schema-enum additions) are the closest thing to a "necessary" base-skill change, and even those were fully worked around locally via `contracts/project-profile.schema.json`'s composed extension.
3. **It protects other projects.** The base skill serves projects beyond this one. An in-place edit tuned to WebDesk's specifics (e.g., hardcoding the two SSO domains, or asserting ACF is universally forbidden) would silently narrow the base skill for everyone else — exactly the "overfitting" failure mode `_decisions/decision-inventory.md` D-013/D-015 already documents the base skill's maintainers fixing once before (the SOW-driven dashboard-standard rewrite). This build deliberately avoided reintroducing that failure mode in a new form.

## 8. How the project profile is loaded

Seven-step hierarchy, detailed in `SKILL.md §2` and verified in `tests/routing-validation.md`: spine → active software-delivery role → base Node.js skill → `custom-app-build` project-type skill → this profile's `SKILL.md` then `knowledge/*` on demand → only the integration(s) the active task needs → canonical project documentation by path. Routing is triggered by `project.project_type: "custom-app-build"` plus the new `project.project_profile: "webdesk-growth-dashboard"` field, validated via a project-local composed schema extension (`contracts/project-profile.schema.json`) rather than a change to the base skill's canonical schema — per the task's explicit preference for a local extension over a global schema edit.

## 9. What must be approved before application development begins

See `docs/skill-build/approval-checklist.md` for the complete, checkable list. In short: the skill profile must pass structural validation (`tests/profile-validation.md`, run and recorded in `validation-report.md`), no dashboard decision may have been silently changed (verified against `project-overrides.md` — every override traces to an already-approved source), the base skill must remain provably unmodified (`file-inventory.md §4`, `base-skill-reuse-map.md`'s "Confirmation of zero base-skill edits"), and the ten proposed upstream patches must be reviewed _separately_, on their own timeline, by whoever maintains the base skill — none of them gate this project's own Phase 0.

---

## 10. Recommendation

This skill overlay is ready for human review. Once approved, the next task should be **Phase 0 only** (per the task brief's closing instruction): create the project state (`project.json`, instantiated from `templates/project.json.example`), formalize the architecture ADRs (`templates/architecture-adr-template.md`'s pre-identified list), draft the four integration contracts (`templates/integration-contract-template.md`), and produce the repository plan — still not the full application, and still gated at G1.5 before any code is written.
