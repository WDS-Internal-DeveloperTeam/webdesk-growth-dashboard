---
tier: 2
load_when: ["planning", "g1", "pm-active"]
description: How the PM Agent breaks an approved Node.js spec into milestones and sprints, following the canonical gate sequence. Each milestone has a client-visible outcome and (usually) a payment trigger.
---

# 05 — Milestone Framework

> How the PM Agent decomposes an approved `spec.md` into milestones and sprints for Node/Express/PostgreSQL/Sequelize middleware and custom-app builds. Milestone structure tracks the canonical gate sequence: `Discovery → G0 → G1 → [G1.5] → G-Contracts → G-Schema → [G2 if UI] → G3 → G4×n → G5 → G5.5 → G6 → M6`.

---

## Definitions

- **Milestone:** a meaningful chunk of delivery with a client-visible outcome and (usually) a payment trigger. E.g. "First sync entity end-to-end on staging" or "Observability + runbooks approved".
- **Sprint:** a 3-5 day focused unit within a milestone, with testable acceptance criteria, ending at a G4 sprint-QA gate. See `06-sprint-rules.md`.

---

## Milestone structure rules

1. **Each milestone has a client-visible outcome.** Not "set up Sequelize models" (internal). Yes "inventory syncs Inform→BigCommerce on staging, verifiable in the dashboard" (client-visible).
2. **Each milestone has a payment trigger** if milestone-billed. Note the percentage in `milestones.json`.
3. **Group sprints by outcome, not by layer.** "Inventory sync (engine + entity + dashboard status)" beats "all backend".
4. **Milestones are sequential by default** and gated; the contract/schema gates are client-approved and block all integration/persistence code.
5. **Duration typically 2-6 weeks.** < 1 week = overhead exceeds value; > 8 weeks = too much at one gate.
6. **Every project ends with a hardening milestone** (load/chaos + observability + runbooks) and a pre-launch milestone. Skipping = bad launch.

---

## Typical milestone structure — integration-middleware (the common case)

```
M1: Foundations approved
    Discovery report + spec (G0.5, G0) → Plan + estimate (G1, estimate→ticket)
    → [Architecture review (G1.5) if triggers fire: architecture.md + ADRs + fitness plan + draft contracts/model]
    → Contracts client-approved (G-Contracts) → Schema client-approved (G-Schema)
    Client-visible outcome: signed scope, approved field mapping + API contracts, approved data model.

M2: Scaffold + first sync entity end-to-end
    Scaffold + CI + Compose (app+Postgres+queue+mock ERP/store) + contract stubs (G3)
    + cron-scheduler/sync-engine core (timezone-aware, skip-if-running, watermark/resume, reconciliation)
    + first entity (e.g. inventory, one-way Inform→BigCommerce) through G4 sprint QA.
    Client-visible outcome: one entity syncing on staging, visible in the dashboard.

M3: Remaining sync entities + dashboard
    Remaining entities (items, pricing, customers, orders; two-way where required with conflict resolution)
    + per-client dashboard (SOW-derived modules + Settings sections/fields; fixed contracts: JWT,
      per-client+master tenancy, per-module RBAC [VED minimum, extended per module], Settings-timezone)
      [+ master dashboard if in scope]
    + [G2 HTML design approval if not already done]. Each sprint through G4.
    Client-visible outcome: full sync set + working dashboard on staging.

M4: Hardening
    Milestone regression + architecture fitness + load/soak/chaos (G5)
    + observability (logs/metrics/tracing/alerts/dashboards/queue visibility/SLO-SLA) and runbooks present (G5.5).
    Client-visible outcome: capacity profile, SLOs, runbooks, green fitness tests.

M5: Launch + monitoring
    Pre-launch (secrets, rollback tested, deploy adapter for the host) + client sign-off (G6)
    → post-launch monitoring + health-score baseline on the master dashboard (M6).
    Client-visible outcome: live system + health baseline for retainer monitoring.
```

This is the DDI Inform ↔ BigCommerce pilot shape (blueprint §16). G2 only appears if there's a UI; for headless middleware record G2 `skipped`.

---

## Custom-app-build (no ERP, has a dashboard/app)

```
M1: Discovery + Plan + [Architecture if triggers] + Schema approved (G-Contracts may be skipped if no external system)
M2: Scaffold + CI + Compose + auth/RBAC foundation (JWT, per-module RBAC [VED minimum, extended per module]) (G3, G4)
M3: Core feature modules + dashboard (HTML mockup → React/Next, G2)
M4: Hardening (G5) + observability + runbooks (G5.5)
M5: Pre-launch (G6) + monitoring baseline (M6)
```

## Version-upgrade / maintenance (shorter)

```
M1: Compatibility/deprecations audit + plan (G0, G1)
M2: Upgrade in a staging clone + regression (G4/G5)
M3: Cutover + verification (G6) + monitoring (M6)
```

Maintenance tickets may skip Discovery (record G0.5 `skipped`).

---

## Sprint structure within milestones

Per `06-sprint-rules.md`: sprint = 3-5 days, max 3 outputs (or **1 sync entity per sprint**), 3-7 testable AC, ends at G4. Example:

```
M2: Scaffold + first sync entity
  S2.1: Repo scaffold + CI + Docker Compose (app+Postgres+queue+mock ERP/store) + contract stubs
  S2.2: Cron-scheduler + sync-engine core (timezone-aware, skip-if-running, watermark/resume, reconciliation)
  S2.3: Inventory sync (Inform→BigCommerce): full-then-incremental, idempotent, dashboard sync-status
  S2.4: Sprint QA sweep (contract + integration vs mock/sandbox + missed-run/overlapping-run/watermark-resume)

Milestone QA (G5): full M2 regression + fitness + first load profile → advance to M3
```

---

## Payment-trigger milestones

For milestone-billed projects, note payment release per milestone in `milestones.json`:

```json
{
  "milestones": [
    {
      "id": "M1",
      "name": "Foundations approved",
      "payment_trigger": { "percent": 30, "released_on": "milestone_confirmed" }
    },
    { "id": "M2", "name": "First sync entity end-to-end", "payment_trigger": null },
    {
      "id": "M3",
      "name": "Full sync + dashboard",
      "payment_trigger": { "percent": 30, "released_on": "milestone_confirmed" }
    },
    {
      "id": "M5",
      "name": "Launch + monitoring",
      "payment_trigger": { "percent": 40, "released_on": "client_signoff_post_launch" }
    }
  ]
}
```

Typical pattern here: 30% on foundations (signed contracts/schema), 30% at full-sync midpoint, 40% on launch. Adapt to client; document in spec + milestones.json.

---

## Validation before writing milestones.json

```
for each milestone:
    [ ] Client-visible name (not internal jargon)
    [ ] Milestone-level acceptance criteria
    [ ] 1-5 sprints
    [ ] Payment trigger if milestone-billed
    [ ] Duration 2-6 weeks
    [ ] References specific spec deliverables
    [ ] At least one human gate (G4 sprint QA or G5 milestone QA)
    [ ] Contract/schema gates precede any integration/persistence sprint
```

---

## Output

`<workspace>/milestones.json` (full) + a lighter `project.json` reflection for orchestrator quick-access. Same structure as the donor (id, name, description, due_date, spec_deliverables_covered, sprints[], estimated_hours, payment_trigger, status), with the gate sequence above.

---

## Anti-patterns

1. Milestones too small ("init repo") or too large ("all development").
2. Milestones not client-visible ("refactor sync-state schema").
3. An integration/persistence sprint scheduled before G-Contracts / G-Schema pass — forbidden.
4. No hardening milestone (load/chaos + observability + runbooks).
5. Combining a sync entity and a dashboard module in one sprint — different agents, different AC. Split.
6. No milestone-level QA gate.

## Milestone completion sequence (mandatory order)

Pilot feedback (#1, #5): a milestone summary MD was generated **without** milestone QA having run, and the QA result was not surfaced. Root cause: the closeout order was implicit. It is now explicit and enforced.

Every milestone closes in exactly this order. Each step is a hard prerequisite for the next — the orchestrator does not advance until the prior step's artifact exists.

```
Milestone Development  →  Milestone Code Review  →  Milestone Testing / QA (G5)  →  Generate Milestone MD
   (sprints, each             (cross-sprint review        (QA Agent runs the full        (PM Agent writes the
    Dev → Code Review          by Code Review Agent;       milestone regression +          milestone summary MD
    per PR → G4 QA)            fitness tests green)        fitness + load/chaos;           ONLY after the QA
                                                           writes milestone-[id]-qa.md)    report exists & is
                                                                                           PASS/PASS_WITH_FLAGS)
```

Enforcement rules:

1. **Milestone QA is not optional and not implicit.** At milestone close the QA Agent MUST run the G5 milestone pass and write `qa-reports/milestone-[id]-qa.md` with a status of `PASS`, `PASS_WITH_FLAGS`, or `FAIL`. No milestone is "done" without this file.
2. **The Milestone MD is blocked until the QA report exists.** The PM Agent does not generate the milestone summary MD until `qa-reports/milestone-[id]-qa.md` is present. If a developer asks to "generate the milestone MD" and the QA report is missing, refuse and route to QA first: _"Milestone QA (G5) hasn't produced `milestone-[id]-qa.md` yet. Running milestone QA before the summary."_
3. **The QA result is surfaced, not buried.** The milestone MD embeds the QA report's status + summary at the top, and the generated dashboard renders the same record as the **Milestone QA modal** (`_spine/designer-agent/knowledge/01-dashboard-standards.md` §4) — this is the "popup"/visible result the pilot found missing. Both surfaces read the one `milestone-[id]-qa.md`; neither hand-copies status. A `FAIL` milestone MD is generated only to record the failure and the fix plan; the milestone does not pass on a FAIL.
4. **Code Review before QA.** Cross-sprint Milestone Code Review completes (fitness tests green) before milestone QA runs, so QA tests reviewed code, not a moving target.
5. **Generate the MD from the template** `_spine/pm-agent/templates/milestone-summary-template.md`, reading `project.json`, the sprint records, `milestone-[id]-qa.md`, and the audit log.

This sequence is the milestone-scoped mirror of the project-level gate flow; the project-close `master-doc` (`templates/master-doc-template.md`) is generated once at G6, the milestone MD once per milestone.

---

Last reviewed: 2026-06-30 (initial Node.js build)
Next review due: 2026-09-30
