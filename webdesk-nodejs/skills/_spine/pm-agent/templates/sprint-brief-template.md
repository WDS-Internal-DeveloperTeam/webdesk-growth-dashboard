---
tier: 2
load_when: ["planning", "g4", "pm-active"]
description: Template the PM Agent fills to brief a sprint. Copy to <workspace>/sprint-briefs/<sprint-id>.md and fill every section.
---

# Sprint Brief Template (Node.js Delivery System)

> Copy to `<workspace>/sprint-briefs/<sprint-id>.md`. Every section filled before work starts. AC must be testable and trace to a spec deliverable. No integration/persistence sprint begins against a draft contract or unapproved schema.

---

# Sprint [S2.3] — [Inventory sync (Inform → BigCommerce)]

|                         |                                            |
| ----------------------- | ------------------------------------------ |
| **Milestone**           | [M2 — Scaffold + first sync entity]        |
| **Duration**            | [4 working days — YYYY-MM-DD → YYYY-MM-DD] |
| **Assigned**            | [Backend Dev (primary), QA (sprint close)] |
| **Estimated hours**     | [24]                                       |
| **Build context**       | [nodejs+bigcommerce]                       |
| **Spec deliverable(s)** | [D1 — Inventory sync engine]               |

## Scope

[2-3 sentences: what gets built this sprint and the boundary of what does NOT.]

## Outputs (max 3 — or 1 sync entity)

1. [Specific deliverable]
2. [Specific deliverable]
3. [Specific deliverable]

## Acceptance Criteria (3-7, testable)

- [ ] AC1: First run performs full sync; subsequent runs incremental from `sync_state` watermark.
- [ ] AC2: A run killed mid-sync resumes correctly from the last watermark (watermark-resume test passes).
- [ ] AC3: A slow run does not stack on the next tick (overlap policy: skip-if-running; overlapping-run test passes).
- [ ] AC4: Cron fires at [02:00] in `project.json.timezone`, not server local time.
- [ ] AC5: Re-processing the same source record is idempotent (no duplicate rows).
- [ ] AC6: ESLint/Prettier pass; no raw queries outside repositories; controller has no business logic (fitness checks pass).

## Inputs (read before starting)

- `spec.md` sections: [§6 Integrations, §8 Deliverable D1]
- `data-model.md` (G-Schema-approved): [sync_state, field_mappings, inventory tables]
- Integration contract: [`integration-contracts/ddi-inform.md` — must be `client-approved`]
- KB: [`nodejs/knowledge/01-coding-standards.md`, sync-engine knowledge, the ERP adapter pattern]

## Dependencies

- Depends on: [S2.1 scaffold, S2.2 scheduler/sync-engine core; G-Contracts + G-Schema passed]
- Blocks: [S2.4 sprint QA; M3 remaining entities]

## QA expectations (feeds G4)

- API contract tests (vs OpenAPI) pass.
- Integration/contract tests vs [DDI sandbox OR mock] pass.
- Sync tests: missed-run, overlapping-run, watermark-resume pass.
- Webhook idempotency/replay (if store webhooks involved) pass.
- Security baseline (authz scoping by tenant, no inline secrets).

## Git

- Branch: `feature/[S2.3-inventory-sync]`
- PR target: `develop`
- Required reviewers: 1 senior dev (+ Code Review Agent)

## Done definition

1. All AC checked off with evidence.
2. All required QA classes ran and reported.
3. Code Review Agent ran and posted; no open P1/P2.
4. PR merged to `develop` (or open with a stated reason).
5. **G4 confirmed by QA lead — not the dev who built (approver ≠ doer).**
6. `actual_hours` recorded in `project.json`.

---

Last reviewed: 2026-06-30 (initial Node.js build)
