---
tier: 2
load_when: ["g1_5", "architecture", "architect-active", "webdesk-growth-dashboard"]
description: "Project-local pointer to the canonical ADR template (_contracts/adr-template.md), plus the pre-identified Phase 0 ADR list this project needs. Do not duplicate the template body — point, don't duplicate."
---

# Architecture ADR Template — Pointer

The **canonical ADR template lives at `_contracts/adr-template.md`** (base skill) — copy it to `docs/architecture/adr/ADR-NNNN-slug.md` and fill it in. Do not maintain a second copy of the template body here.

ADRs produced under this project are **precedence level 3** in `knowledge/00-scope-and-precedence.md`'s ordering — they sit above this project profile and below the approved dashboard documentation. An ADR cannot contradict the Master Specification or detailed dashboard documentation; it formalizes a decision _within_ the space those documents leave open (exactly the space `docs/implementation/architecture-validation.md` mapped).

---

## Pre-identified Phase 0 ADRs for this project

This profile has already resolved the substance of several of these (see `knowledge/14-implementation-phases.md` §"What this skill-build resolved for Phase 0") — Phase 0's job for those is to **formalize** the resolution into the canonical ADR format and record it, not to re-derive the decision from scratch.

| #   | ADR topic                                                              | Status entering Phase 0                                    | Primary reference                                                                        |
| --- | ---------------------------------------------------------------------- | ---------------------------------------------------------- | ---------------------------------------------------------------------------------------- |
| 1   | Turborepo monorepo structure and package boundaries                    | Guided, not fully formalized                               | `knowledge/02-turborepo-boundaries.md`                                                   |
| 2   | NestJS-on-Vercel adaptation                                            | Resolved in substance                                      | `knowledge/03-nestjs-on-vercel.md`                                                       |
| 3   | **Job execution model** (serverless, no permanent worker)              | **Resolved — formalize only**                              | `knowledge/04-serverless-queues-workflows-and-cron.md`                                   |
| 4   | **Google Workspace SSO/OIDC**, incl. first-login provisioning decision | **Resolved in substance — confirm JIT-vs-pre-provisioned** | `knowledge/05-google-workspace-sso-and-local-admin.md`                                   |
| 5   | Deployment model on Vercel (Staging→Production promotion gating)       | Substantially covered                                      | `knowledge/03`, `knowledge/04`, `docs/implementation/gap-analysis.md` item 15            |
| 6   | Threat model                                                           | **Not resolved by this profile — full Phase 0 scope**      | `knowledge/12-dashboard-security-controls.md` §"Threat modelling and CSRF/token-storage" |
| 7   | CSRF applicability / refresh-token storage mechanism                   | **Not resolved — depends on ADR 6's outcome**              | `knowledge/12-dashboard-security-controls.md`                                            |
| 8   | Postgres connection-pooling approach (depends on provider selection)   | Blocked on provider selection                              | `integrations/vercel/02-blob-and-postgres.md`                                            |

Use the canonical `_contracts/adr-template.md` format for each — "Context / Decision / Consequences / Alternatives Considered / Related RFC / Enforcement" — even for the "resolved" items, since the ADR's value is the durable record of _why_, which this profile's knowledge files summarize but don't replace as the formal decision record.

---

Last reviewed: 2026-08-05 (initial profile build)
