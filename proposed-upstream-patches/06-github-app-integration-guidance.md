# Proposed Patch 06 — Generic GitHub App Integration Guidance

**Status:** Proposed. Not merged. Not applied to the base skill by this task.

## Reason

The base skill's `integrations/` directory covers `bigcommerce/`, `shopify/`, `erp/*` — commerce and ERP systems the sync engine talks to — but has no module for GitHub-as-a-product-integration (distinct from the base skill's own use of GitHub for its delivery process, covered by `git-branch-strategy.md`). Any custom-app-build project whose *product* reads/writes GitHub state (a CI dashboard, a deployment-tracking tool, this project's Ready for Claude Queue/Release Center) needs this and currently has to build it from scratch, as this project did in `profiles/webdesk-growth-dashboard/knowledge/06-github-app-integration.md` and `integrations/github/*`.

## Current gap

No `nodejs/integrations/github/` directory. The base skill's webhook-security guidance (`security/04-webhook-security.md`) is provider-agnostic and applies directly, but GitHub-specific adapter knowledge (App auth, installation tokens, Octokit conventions, commit/PR/deployment-status reads) has no home.

## Proposed files changed

- **New directory:** `nodejs/integrations/github/` — `01-app-auth-and-octokit.md`, `02-webhooks-and-events.md`, `pointers.md`, generalized from this project's `integrations/github/*` with WebDesk-specific detail (the two-repository release-SHA-pairing rule, specifically) either removed or clearly marked as a project-pattern example rather than a universal rule.
- **Edit:** `nodejs/SKILL.md` — add `github` as a recognized `integration_targets` value alongside `bigcommerce`, `shopify`, `erp:*` in the "Identity" section's integration-modules description.

## Compatibility impact

Additive — a new integration module, loaded only when `github` is in a project's `integration_targets` (per the existing context-budget discipline, unchanged).

## Regression risk

Low. New directory; the one edit to `SKILL.md` is a documentation addition, not a behavior change.

## Reusability scope

**Generally reusable** — GitHub-as-a-product-integration is common across custom-app-build projects (deployment dashboards, CI-status tools, PR-review tools) well beyond this one project. The two-repository SHA-pairing rule specifically should be presented as a pattern example, not baked in as universal (most projects integrating GitHub have exactly one repository, not two).
