# Proposed Patch 02 — Generic Turborepo Monorepo Support

**Status:** Proposed. Not merged. Not applied to the base skill by this task.

## Reason

The base skill's canonical project layout and service-skeleton template assume one deployable service per repository — this is the single largest structural gap the WebDesk Dashboard skill-build hit (`docs/implementation/architecture-validation.md` §1). A growing share of custom-app-build projects (API + dashboard + worker, or API + multiple frontends) are natural Turborepo candidates, and each will otherwise independently re-derive package-ownership rules, migration-single-ownership, and per-app architecture-fitness scoping — as this project did in `profiles/webdesk-growth-dashboard/knowledge/02-turborepo-boundaries.md`.

## Current gap

No monorepo guidance anywhere in `nodejs/knowledge/` or `nodejs/projects/custom-app-build/`. `nodejs/projects/custom-app-build/knowledge/01-app-shapes.md`'s "Combining shapes" section assumes shared code within one deployable unit, not a formal package-boundary monorepo.

## Proposed files changed

- **New:** `nodejs/knowledge/backend/04-turborepo-monorepo.md` — workspace layout pattern, package-ownership rules (one migration owner, one validation-schema source), per-app dependency-cruiser scoping, and Turborepo pipeline/CI-filtering guidance, generalized from `profiles/webdesk-growth-dashboard/knowledge/02-turborepo-boundaries.md` with the WebDesk-specific package names replaced by placeholders.
- **Edit:** `nodejs/projects/custom-app-build/knowledge/01-app-shapes.md` — add a short "Monorepo variant" note under "Combining shapes" pointing to the new file, for when a combined shape is built as a Turborepo workspace rather than a single codebase.
- **Edit:** `nodejs/templates/service-skeleton/README.md` — add a note that the skeleton assumes single-repo deployment, with a pointer to the new monorepo file for the Turborepo case.

## Compatibility impact

Additive. Does not change the service-skeleton template itself (still valid for single-app projects) or any forbidden pattern. The architecture-fitness guidance is generalized (per-app config) rather than changed (the underlying rule — no DB access outside repositories — is identical).

## Regression risk

Low-medium. The edit to `01-app-shapes.md` touches an existing file's "Combining shapes" section — should be reviewed to confirm it doesn't alter the existing single-repo guidance's meaning, only adds an alternative.

## Reusability scope

**Generally reusable** — Turborepo (or any similar monorepo tool) is a common enough choice that this is worth generalizing rather than leaving as WebDesk-Dashboard-specific knowledge.
