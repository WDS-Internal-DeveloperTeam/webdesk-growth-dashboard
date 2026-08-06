# Proposed Patch 11 — Generic `project_profile` Auto-Routing in the Orchestrator

**Status:** Proposed. Not merged. Not applied to the base skill by this task.

## Reason

This project's profile (`nodejs/projects/custom-app-build/profiles/webdesk-growth-dashboard/`) currently loads only because the project's root `CLAUDE.md` explicitly lists its `SKILL.md` path in the right position — a file-content convention, not orchestrator behavior. An external verification review (2026-08-05) correctly flagged that earlier drafts of this profile's own documentation implied the base orchestrator auto-routes on a `project_profile` field, which it does not: that field doesn't exist in the base schema and nothing in `_spine/orchestrator/` reads it. If a future `CLAUDE.md` for this project (or any other project using a profile) is ever regenerated without that line, the profile silently stops loading with no error from the base skill.

## Current gap

- `_contracts/project-json.schema.json` has no `project.project_profile` field at all.
- `_spine/orchestrator/knowledge/01-session-start-protocol.md` and `02-routing-table.md` have no concept of "project-type profiles" layered under a `nodejs/projects/<type>/profiles/<name>/` path — only `project_type` and `integration_targets` drive loading today.
- Any future project wanting a profile has to reinvent the "state it explicitly in CLAUDE.md, hope nobody removes the line" pattern this project uses, with no orchestrator-level safety net.

## Proposed files changed

- **Edit:** `_contracts/project-json.schema.json` — add an optional `project.project_profile` string field (pattern `^[a-z0-9][a-z0-9-]*$`, matching the existing `client_slug` convention), with a description clarifying it's optional and, when present, names a subdirectory under `nodejs/projects/<project_type>/profiles/`.
- **Edit:** `_spine/orchestrator/knowledge/01-session-start-protocol.md` — add a step: after resolving `project_type`, check whether `project.project_profile` is set and whether `nodejs/projects/<project_type>/profiles/<project_profile>/SKILL.md` exists; if both are true, load it immediately after the project-type skill and before any integration module (the same position this project's `CLAUDE.md.template` currently encodes manually). If `project_profile` is set but the path doesn't exist, fail loudly (per the base skill's own "never silently truncate/skip" philosophy) rather than silently proceeding without it.
- **Edit:** `_spine/orchestrator/knowledge/02-routing-table.md` — document the new profile-loading step in the routing table.

## Compatibility impact

Additive and backward-compatible: `project_profile` is optional; any existing project without it (the overwhelming majority) is entirely unaffected, since the new orchestrator step is a no-op when the field is absent.

## Regression risk

Low-medium. The orchestrator session-start protocol is a frequently-exercised path (every session, every project) — a bug here has broad blast radius even though the change itself is small. Recommend this patch gets more scrutiny than patches 09/10 (the pure enum additions) before being applied, and a dry-run against at least one existing non-profiled project to confirm the no-op case is genuinely a no-op.

## Reusability scope

**Generally reusable** — the profile pattern this project pioneered (a project-type skill with named, swappable sub-configurations) is a reasonable general capability, not WebDesk-Dashboard-specific. Once this patch lands, this project's own `CLAUDE.md.template` should be simplified to drop the manual routing-list line and rely on the new automatic behavior — but that simplification is itself a follow-up change to make _after_ the patch is reviewed and applied, not before.
