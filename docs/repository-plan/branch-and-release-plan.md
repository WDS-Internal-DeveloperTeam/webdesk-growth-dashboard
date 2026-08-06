# Branch and Release Plan

**Status:** Planning document. No repository exists yet to apply branch protection to. This documents the intended workflow for both the dashboard monorepo and the WordPress theme repository, per ADR-0011, ADR-0013, and ADR-0018.

## Branch model (both repositories)

`feature branch → Pull Request → automated code-quality/security/build checks → staging deployment → QA and stakeholder approval → deploy the exact approved commit to production → post-deployment smoke testing`, per the registered Technical Discovery document's Git-workflow answer, applied consistently to both repositories.

- `main` (or equivalent default branch) — protected, no direct commits.
- `staging` — protected, receives merges from approved PRs, auto-deploys to the staging environment.
- Production deploys the exact approved commit SHA from `staging` after QA/stakeholder approval — never a re-built or re-merged variant.

## Pull request requirements

- Automated checks (lint, test, build, and — for the WordPress theme — PHP/SCSS checks) must pass before merge.
- At least one review required; the reviewer is never the PR's own author, per the separation-of-duties model (ADR-0010, restated here for release process specifically).
- The approved commit SHA, approver, deployment time, and smoke-test results are recorded for every deployment (per the Technical Discovery document's own requirement) — where this record lives (a dashboard-side Release Center record, once built, or an interim GitHub-native mechanism) is a Phase 1 decision.

## Rollback

Redeploy the previous verified commit; restore database/uploads only when the release changed data or media (not on every rollback). This applies to both the dashboard's own database (per `docs/contracts/database-contract.md`) and WordPress content, independently.

## Manual-execution boundary interaction

Per ADR-0018, no step in this pipeline — PR merge, staging deploy, production deploy — is triggered autonomously by Claude Code for V1. Every stage requires a distinct human action.

## What is NOT created in Phase 0

No GitHub repository, branch protection rule, or CI workflow file exists yet. This plan is the intended target for Phase 1's first task to implement, with explicit approval, not something Phase 0 configures directly.
