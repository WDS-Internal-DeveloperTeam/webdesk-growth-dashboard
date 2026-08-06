# Proposed Patch 07 — Generic WordPress Integration Guidance

**Status:** Proposed. Not merged. Not applied to the base skill by this task.

## Reason

WordPress-as-a-CMS-integration is a plausible target for other custom-app-build projects (headless CMS dashboards, content-ops tools) beyond this one. The base skill's ERP adapter pattern (`integrations/erp/_erp-adapter-pattern.md`) is an excellent structural template but has no WordPress-specific instantiation. This project built one from scratch (`profiles/webdesk-growth-dashboard/knowledge/07-wordpress-integration.md`, `integrations/wordpress/*`).

## Current gap

No `nodejs/integrations/wordpress/` directory. No guidance on WordPress Application Password auth, `register_post_meta()`-based native structured content as an alternative to ACF, or a production WP-CLI allowlist-enforcement pattern (named actions, never a free-text command surface).

## Proposed files changed

- **New directory:** `nodejs/integrations/wordpress/` — `01-rest-api-and-app-passwords.md`, `02-wp-cli-and-deployment.md`, `pointers.md`, generalized from this project's equivalent files with the WebDesk-specific Case Study/Portfolio migration detail either removed or presented as a worked example of "migrating an existing plugin-dependent content type to native structured content" rather than universal guidance.
- **Edit:** `nodejs/SKILL.md` — add `wordpress` as a recognized `integration_targets` value.
- **Note on the no-ACF stance:** the _reason_ ACF is excluded in this project (an explicit client architecture decision, `01_Dashboard_Master_Specification.md`'s "Important exclusions") is project-specific — the upstream patch should present "native `register_post_meta()` vs. ACF" as a **documented choice with trade-offs**, not assert ACF is universally forbidden. Only this project's own `knowledge/15-project-specific-forbidden-actions.md` (WDS-001) makes it an absolute rule.

## Compatibility impact

Additive — a new integration module, loaded only when `wordpress` is in a project's `integration_targets`.

## Regression risk

Low. New directory; one documentation-index edit to `SKILL.md`.

## Reusability scope

**Generally reusable for the REST API / Application Password / WP-CLI-allowlist mechanics.** The no-ACF stance and the specific Case Study/Portfolio migration content are WebDesk-Dashboard-specific and should not be presented as universal in the upstream version — flag this explicitly during review so the patch doesn't silently make ACF-avoidance a system-wide default it was never approved to be.
