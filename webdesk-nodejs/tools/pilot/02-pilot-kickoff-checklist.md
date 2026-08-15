# 02 — Pilot Kickoff Checklist

## Access & credentials (the long-lead items — start day 1)

- [ ] DDI Inform: confirm API/web-services surface, auth model, rate limits, **sandbox/test company availability**. (verify-at-discovery — do not assume)
- [ ] DDI Inform: confirm entity coverage needed (items, inventory, customers, orders, pricing) and direction per entity (pull/push)
- [ ] BigCommerce: store API account created (client id, access token, store hash); confirm scopes
- [ ] Confirm connectivity (is DDI on-prem behind a VPN/gateway? cloud?)

## Project setup

- [ ] `tools/scripts/init-project.sh --client <slug> --type integration-middleware --targets "bigcommerce,erp:ddi-inform" --timezone <client tz> --build-context nodejs+bigcommerce`
- [ ] Confirm tech stack in spec.md: Node 22 + Express, PostgreSQL + Sequelize, React/Next dashboard, JWT, per-module RBAC, per-client + master tenancy
- [ ] Capture the client's rough DB/field mapping + API-contract direction from the kickoff call (becomes draft data-model + draft contracts)

## Gate plan for this pilot

Discovery → G0 → G1 (estimate→ticket) → G1.5 (architecture) → G-Contracts (client) → G-Schema (client) → G2 (HTML dashboard) → G3 → G4×n → G5 (+load+chaos) → G5.5 (observability+runbooks) → G6 → M6 (health).

## Context discipline

- [ ] Verify `CLAUDE.md` lists only the required files; run `tools/scripts/context-budget-check.py --type integration-middleware --targets bigcommerce erp:ddi-inform`
