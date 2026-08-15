# WebDesk Node.js Delivery System (v0.2.4)

> Standalone, Node-only AI delivery system for custom Node.js apps and integration middleware between ERP/CRM/supplier systems and BigCommerce / Shopify. Own spine, own contracts, no cross-technology router. Built per `nodejs-delivery-system-blueprint-v3.md`.

## What this is

A multi-agent delivery system that takes a custom-app or integration project from discovery to launch and maintenance, through human-gated stages. It is the Node.js sibling of the WebDesk Shopify system — same proven machinery (gates, state, audit log, context discipline, no-auto-fix, no self-approval), adapted for Node services, APIs, databases, and continuous ERP/store sync.

## Scope

- **Backend:** Node.js 22+ (ESM), Express. **DB:** PostgreSQL + Sequelize (default). **Storage:** S3 / Cloudinary / GCS.
- **Frontend:** React / Next.js dashboards and tools.
- **Integrations:** BigCommerce, Shopify (API only — never theme), and ERPs (DDI Inform, Fishbowl, Sage 300/100, NetSuite, Acctivate, pc/MRP) behind a common adapter interface.
- **Steady state for ERP/CRM:** continuous cron-scheduled sync, timezone-driven by Dashboard Settings.

## Layout

```
skills/
├── _spine/            # platform-agnostic agents + shared knowledge (CONVENTIONS, persona, model-policy, context-budget)
├── _contracts/        # schemas, gate-format, templates (project-json, integration-contract, rfc, adr, health-score)
├── _decisions/        # decision inventory (Tier 3, human-read)
└── nodejs/            # the technology arm
    ├── knowledge/     # coding standards, forbidden, intelligence modules (db/integration/api/failure)
    ├── integrations/  # bigcommerce, shopify, erp/* adapters
    ├── projects/      # integration-middleware (pilot), custom-app-build, frontend-tool, version-upgrade, maintenance
    ├── templates/     # service skeleton, runbooks, architecture-tests, contracts
    └── pointers/      # verified external doc anchors + API versions
tools/                 # github-actions, scripts, pilot workflow
```

## How a project runs

`Discovery → G0 → G1 → [G1.5] → G-Contracts → G-Schema → [G2 if UI] → G3 → G4×n → G5 → G5.5 → G6 → M6`

See `_contracts/gate-format.md` for gate mechanics and `_spine/orchestrator/SKILL.md` to start.

## Context discipline (read first)

This system is large on disk but loads narrowly. Each project's `CLAUDE.md` scopes which files load. The orchestrator refuses to load KB outside the active project-type and integration targets. See `_spine/shared-knowledge/context-budget.md`.

## Pilot

DDI System's Inform ERP ↔ Node middleware + dashboard ↔ BigCommerce. The DDI adapter is built against documented assumptions + mocks; every unverified API detail is marked **verify-at-discovery**.

## Status

v0.2.4 — adds onboard-existing-project: `init-project.sh --onboard-existing` + a PM procedure to reconstruct governance docs from Graphify output (as client-validated drafts), then run the repo as maintenance; Graphify stays a queried index, never source of truth. Also fixed a latent bug where the scaffolder's project.json was not schema-valid. v0.2.3 — pre-pilot hardening of custom-app-build (request/response + AI-platform integration made first-class, distinct from cron-sync) and frontend-tool (Shopify theme-system boundary defined); residual VED-only RBAC phrasing generalized. v0.2.2 — adds the Milestone QA modal as a delivery acceptance criterion in generated dashboards (master/oversight scope), closing the second reading of pilot feedback #1. v0.2.1 — pilot feedback + generalization hardening. v0.2.0 folded in the first DDI↔BigCommerce pilot feedback (milestone Dev→Review→QA→MD flow, gate-status single source of truth, SOW-driven dashboard standard + 9 module criteria). v0.2.1 self-audit fix: removed the same overfitting where it survived upstream — spec/discovery/estimation templates are now SOW-derived (no hardcoded ERP/store module list), and RBAC is an extensible per-module action set (VED seeded) enforced in backend authz + DB schema. The system now integrates ANY ERP with BigCommerce/Shopify, not just DDI. Still capture failure modes via `tools/pilot/`.
