---
tier: 2
load_when: ["webdesk-growth-dashboard", "planning", "g1", "g1_5"]
description: "Pointer to the canonical 10-phase implementation plan (docs/implementation/phased-implementation-plan.md), with this profile's role in de-risking Phase 0, and how the plan's phase boundaries map onto this project's gate sequence."
---

# 14 — Implementation Phases

> The canonical phased plan is `docs/implementation/phased-implementation-plan.md` (Phase 0–9) — this file does not duplicate it. What this file adds: how this skill-build changes Phase 0's starting conditions, and a quick-reference table of which `knowledge/*` file in this profile a Phase-0-and-later agent needs for each phase.

---

## What this skill-build resolved for Phase 0

`docs/implementation/phased-implementation-plan.md` Phase 0 was scoped to produce architecture ADRs resolving several open questions — this profile has **already resolved** two of the highest-leverage ones, so Phase 0's remaining scope is narrower than the phased plan originally anticipated:

| Phase 0 item (per the original phased plan)            | Status after this skill-build                                                                                                                                                                                             |
| ------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| ADR: Turborepo monorepo structure                      | Structural guidance provided (`knowledge/02-turborepo-boundaries.md`); Phase 0 still produces the formal ADR document (`templates/architecture-adr-template.md`), but is no longer starting from a blank page             |
| ADR: NestJS-on-Vercel adaptation                       | Resolved in substance (`knowledge/03-nestjs-on-vercel.md`); Phase 0 formalizes it as an ADR, not re-derives it                                                                                                            |
| **ADR: job execution model**                           | **Resolved, not merely guided** (`knowledge/04-serverless-queues-workflows-and-cron.md`) — per the skill-build task's explicit instruction, this is a decision, not an open question, for Phase 0 to ratify into ADR form |
| **ADR: Google Workspace SSO/OIDC**                     | **Resolved in substance** (`knowledge/05-google-workspace-sso-and-local-admin.md`) — Phase 0 formalizes as an ADR and confirms the JIT-vs-pre-provisioned first-login decision that this profile explicitly leaves open   |
| ADR: deployment model on Vercel                        | Substantially covered by `knowledge/03` + `knowledge/04` together; Phase 0 still confirms the concrete deploy-adapter mechanics once the Postgres provider (below) is chosen                                              |
| Threat model                                           | **Still open** (`knowledge/12-dashboard-security-controls.md` §"Threat modelling and CSRF/token-storage") — not resolved by this skill-build, remains full Phase 0 scope                                                  |
| `project.json` schema-valid, extended for this profile | Templated (`templates/project.json.example`, `contracts/project-profile.schema.json`) — Phase 0 instantiates it with real values, not designs it from scratch                                                             |

**Still fully open, unresolved by this skill-build, and correctly so** (per `docs/skill-build/unresolved-items.md` and this profile's own "genuine unresolved items" scope discipline): the exact Vercel Marketplace Postgres provider (`knowledge/01-approved-architecture.md` §"Database" stop-condition), real repository URLs, real Vercel project IDs, real SMTP credentials, real operational owner names/contacts, complete Service and SEO Library data, and a future malware-scanning provider. None of these block the skill-overlay build; several block specific Phase 0/1 gates as documented in `docs/implementation/gap-analysis.md`.

---

## Quick reference — which knowledge file per phase

| Phased-plan phase                                                       | This profile's relevant `knowledge/*` files                                                                |
| ----------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------- |
| Phase 0 (Discovery, ADRs)                                               | `00`, `01`, `02`, `03`, `04`, `05`, `12` (threat model)                                                    |
| Phase 1 (Auth, RBAC, Settings, scaffold)                                | `02`, `03`, `05`, `12`                                                                                     |
| Phase 2 (Workflow/audit/notification backbone)                          | `09`, `10`                                                                                                 |
| Phase 3 (Strategy & content libraries)                                  | `10`, `12` (confidential-field enforcement)                                                                |
| Phase 4 (Design/asset libraries)                                        | `08`, `10`                                                                                                 |
| Phase 5 (GitHub/WordPress/SMTP integrations)                            | `06`, `07`, `09`, plus `integrations/github/`, `integrations/wordpress/`, `integrations/google-workspace/` |
| Phase 6 (Ready for Claude / Release / Scan / Change / Technical Center) | `04`, `06`, `10`                                                                                           |
| Phase 7 (Import/Export, Help Center)                                    | `04`, `10`                                                                                                 |
| Phase 8 (Observability, security, backup/retention, pre-launch)         | `11`, `12`, `13`                                                                                           |
| Phase 9 (Launch, M6)                                                    | `06`, `07`, `11`                                                                                           |

This table is a navigation aid, not a gate — the actual gate sequence and per-phase acceptance criteria remain exactly as specified in `docs/implementation/phased-implementation-plan.md`.
