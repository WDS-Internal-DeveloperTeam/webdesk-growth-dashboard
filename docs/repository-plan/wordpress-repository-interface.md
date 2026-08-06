# WordPress Repository Interface

**Status:** Planning document. No WordPress theme repository has been created. This documents the intended relationship between the dashboard monorepo and the separate WebDesk Custom Theme repository.

## Two separate repositories, not one

The dashboard application (Next.js/NestJS monorepo, `docs/repository-plan/dashboard-monorepo-plan.md`) and the WebDesk Custom Theme (the WordPress-side theme, per `canonical-inputs/Current_WordPress_Technical_Discovery.md`) are **separate repositories**, both under the WebDesk GitHub organization. They do not share a codebase, dependency tree, or deployment pipeline — the dashboard integrates with WordPress only through the REST API contract (`docs/contracts/wordpress-integration-contract.md`), never through shared code.

## Why separate

- Different languages/runtimes (PHP theme vs. TypeScript monorepo) with no meaningful code-sharing opportunity.
- Different deployment targets (WordPress.com GitHub Deployments vs. Vercel).
- Different review/ownership boundaries — WordPress theme changes and dashboard application changes are reviewed independently, even when a single feature requires both (e.g., a new Case Study field requires a theme-side field addition and a dashboard-side integration update, each reviewed in its own repository).

## The interface between them

The dashboard's WordPress adapter (`packages/integrations`, per `docs/contracts/wordpress-integration-contract.md`) is the entire integration surface — it calls the WordPress REST API using the meta-key mappings and custom post-type/taxonomy structure already confirmed in `canonical-inputs/Current_WordPress_Technical_Discovery.md`'s "Resolved: CaseStudy/Portfolio plugin conflict" section. Any change to the WordPress theme's post-type/taxonomy/meta-key structure requires a corresponding, coordinated update to this adapter — the two repositories are independently deployed but not independently evolvable at the data-contract level.

## What is NOT created in Phase 0

No WordPress theme repository is created by this Phase 0 task. Its creation and initial scaffold (per the folder structure documented in `canonical-inputs/Current_WordPress_Technical_Discovery.md`) is a separate workstream, gated on the Theme Migration and Reconciliation Report being complete first (per that document's own stated sequencing) — tracked in `docs/project-state/setup-input-register.md`, not executed here.
