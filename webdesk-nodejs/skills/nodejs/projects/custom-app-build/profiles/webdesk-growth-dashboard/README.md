---
tier: 3
load_when: ["never"]
description: "Human-read orientation for the WebDesk Growth Dashboard project profile. Not auto-loaded by any agent — read SKILL.md for the machine-facing loading hierarchy."
---

# WebDesk Growth Dashboard — Project Profile

## What this is

A **project-specific profile** on top of the WebDesk Node.js Delivery System's `custom-app-build` project type. It exists because this project's approved architecture overrides several of the base skill's _documented defaults_ (Express → NestJS, node-cron/BullMQ → Vercel Queues/Workflows/Cron, S3 → Vercel Blob, local JWT login → Google Workspace SSO) while keeping every one of the base skill's _rules_ (layering, forbidden patterns, gate discipline, no-auto-deploy) fully intact.

This directory is the output of a skill-build task run against:

1. WebDesk Node.js Delivery System skill v0.2.4 (the base skill, unmodified — see `../../../../../../SKILL.md` for the arm root, or `nodejs/SKILL.md` from the skill package root)
2. WebDesk Dashboard Documentation Pack (`webdesk-dashboard-documentation-v1/`)
   3–8. The six-document compatibility review (`docs/implementation/`)
3. **Current WordPress Technical Discovery** — `canonical-inputs/Current_WordPress_Technical_Discovery.md`, supplied across two rounds (Part 1: native Markdown, 2026-08-06; Part 2: fuller self-review, 2026-08-05).
4. **WebDesk Agent Specification Batch 1** — supplied and registered 2026-08-05, `canonical-inputs/agent-specifications-batch-1/`.
5. **Service and SEO Library workbook** — supplied and registered 2026-08-06, `canonical-inputs/WebDesk_Service_SEO_Library_Templates_v4.xlsm`. Status: Under Review — advisory sample/import structure, not approved business truth, per WDS-014.
6. **Owner Clarifications (2026-08-05)** — `canonical-inputs/Owner_Clarifications_2026-08-05.md`, a separate dated file recording the ACF current-state clarification, kept apart from the discovery document it clarifies.

**Remediated three times** (2026-08-05 ×2, 2026-08-06 ×1) following external verification reviews — real defects found and fixed each round (not disputed): a schema-composition bug, a routing-honesty gap, a forbidden-content-scanner design flaw, a packaging/export defect, and — most recently — registering the Service/SEO workbook and restructuring the ACF clarification into a separate file. Two previously-missing documents were supplied and registered along the way, surfacing and resolving one genuine architecture conflict (ACF). Full record: `docs/skill-build/validation-report.md` and `CHANGELOG.md`.

## What it is not

- Not a rewrite of the base skill. Nothing under `nodejs/` outside this `profiles/webdesk-growth-dashboard/` directory was touched.
- Not a second delivery system. The gate sequence (`Discovery(G0.5) → G0 → G1 → G1.5 → G-Contracts → G-Schema → G2 → G3 → G4×n → G5 → G5.5 → G6 → M6`), the software-delivery agent roster, and the orchestrator's session-start/routing/state-management behavior are all the base skill's, unchanged.
- Not application code. This profile does not scaffold Turborepo, install any package, create a migration, connect to WordPress or GitHub, or deploy anything. See `SKILL.md` §7 and `knowledge/15-project-specific-forbidden-actions.md`.

## How to use this profile

1. Set `project.project_type: custom-app-build` and `project.project_profile: webdesk-growth-dashboard` in the project's `project.json` (see `templates/project.json.example` — validates with `python3 tools/validate-project-profile.py`, which patches an in-memory copy of the base schema per `contracts/project-profile.schema.json`; the base schema file is never touched. See `docs/skill-build/proposed-upstream-patches.md` patches 09–10 for the optional upstream enum additions).
2. Every agent invoked on this project loads per the hierarchy in `SKILL.md` §2 — spine → role → base skill → custom-app-build → this profile → only the integrations the active task needs → canonical documents by path. **This routing is enforced by the project's own root `CLAUDE.md`, not by automatic base-orchestrator behavior** — see `SKILL.md` §2's honesty note and `templates/CLAUDE.md.template`.
3. When a decision conflicts across sources, resolve per `SKILL.md` §3 / `knowledge/00-scope-and-precedence.md` — never silently pick a side.
4. Before writing any code against an external system (GitHub, WordPress, Google Workspace), read the relevant `integrations/*/` module first and confirm the contract is `client-approved` at G-Contracts, per the base skill's NODE-008 verify-at-discovery rule — unchanged here.

## Where the "why" lives

Every resolved decision in this profile traces back to one of the six review documents in `docs/implementation/`. This profile is deliberately thin on _justification_ prose and thick on _operational_ instruction — if you want to know _why_ NestJS-on-Vercel was chosen over an alternative, read `docs/implementation/architecture-validation.md` §3/§9; this profile's `knowledge/03-nestjs-on-vercel.md` tells you _how_ to build it, assuming the decision is already made.

## Status

Skill-overlay build, remediated and re-validated 2026-08-05 (14/14 automated checks pass — `python3 tools/validate-all.py`). No Phase 0 application work (architecture ADRs, repository creation, contract drafting) has started. See `docs/skill-build/approval-checklist.md` for what must be signed off before Phase 0 begins.
