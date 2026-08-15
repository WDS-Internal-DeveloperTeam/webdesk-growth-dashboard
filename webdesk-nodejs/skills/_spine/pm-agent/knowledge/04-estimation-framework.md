---
tier: 2
load_when: ["planning", "g1", "pm-active"]
description: How the PM Agent estimates effort for Node.js middleware / custom-app builds and flags scope-vs-timeline mismatch. Includes the 80hr architecture-gate threshold check. Estimates are draft inputs for human review, not the final word.
---

# 04 — Estimation Framework

> How the PM Agent estimates effort for Node/Express/PostgreSQL/Sequelize middleware and custom-app builds, and flags scope-vs-timeline mismatches. Estimates carry a confidence level and are draft inputs the human PM calibrates against team velocity. The G1 CONFIRM records the estimate→ticket. **Always check the 80hr architecture-gate threshold** — crossing it (or any G1.5 trigger) means G1.5 runs before G-Contracts/G-Schema.

---

## What you estimate

Per deliverable / sprint / milestone:

- **Effort in hours** (total) + **confidence** (low / medium / high) + **breakdown by role** (backend / frontend / designer / QA / PM / architect).

Per project:

- **Total hours** → weeks (capacity model) → **vs promised timeline** (on-track / tight / overrun).
- **Architecture-gate check:** does the estimate or scope trip the 80hr threshold or any G1.5 trigger?
- **Renegotiation flag** if overrun > 10%.

---

## Estimation patterns (Node middleware / custom app)

These replace the Shopify section-build patterns. Baselines — adjust by complexity, then add buffers.

| Pattern                                             | Description                                                                                                                                                                                                         | Typical hours |
| --------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------- |
| **Per-integration adapter (standard)**              | One external system behind the common pull/push/normalize/sync-state interface, well-documented REST API, sandbox available                                                                                         | 24-48         |
| **Per-integration adapter (hard)**                  | Partner-gated / under-documented / on-prem / no sandbox (e.g. DDI Inform first build, pc/MRP file-ODBC)                                                                                                             | 48-100        |
| **Per-entity sync (one-way)**                       | One entity, pull or push, incremental from watermark, idempotent                                                                                                                                                    | 8-16          |
| **Per-entity sync (two-way + conflict resolution)** | Both directions with a conflict rule, parity checks                                                                                                                                                                 | 16-32         |
| **Cron-scheduler + sync engine core**               | Timezone-aware scheduler, skip-if-running overlap policy, watermark/resume, reconciliation                                                                                                                          | 24-48         |
| **Queue upgrade (node-cron → BullMQ+Redis)**        | When concurrency/retries/DLQ are needed                                                                                                                                                                             | 12-24         |
| **Dashboard — SOW-derived module set**              | Fixed contracts: Auth (JWT+refresh+rotation+revocation), per-client+master tenancy, per-module RBAC (VED minimum, extended per module), Settings-timezone; **plus** the modules + Settings sections the SOW defines | 60-120        |
| **Dashboard — module-specific (per module)**        | Sync-status view, mapping editor, reconciliation report                                                                                                                                                             | 8-24          |
| **Master dashboard (cross-client)**                 | Tenant rollup, per-instance health score, alert rollup, drill-in                                                                                                                                                    | 32-64         |
| **API design + OpenAPI + versioning**               | `/api/v1`, full status codes incl. 502/503/504, contract spec                                                                                                                                                       | 12-24         |
| **HTML mockup (per dashboard, D-DES-01)**           | Running HTML/CSS for G2                                                                                                                                                                                             | 16-40         |
| **Testing — sprint QA (per sprint)**                | API contract + integration vs sandboxes + webhook idempotency/replay + sync parity + missed-run/overlapping-run/watermark-resume                                                                                    | 8-16          |
| **Testing — load / soak / chaos (at G5)**           | Capacity profile → SLO/SLA; fault injection                                                                                                                                                                         | 16-40         |
| **Observability (G5.5)**                            | Logs, metrics, tracing, alerts, dashboards, queue visibility, SLO/SLA                                                                                                                                               | 16-40         |
| **Runbooks (per runbook)**                          | incident / queue-recovery / webhook-replay / db-restore / deploy-recovery                                                                                                                                           | 3-8 each      |
| **Scaffold + CI + Compose + sandboxes (G3)**        | Repo, CI (install/typecheck/test/audit/migration-dryrun), Docker Compose (app+Postgres+queue+mock ERP/store)                                                                                                        | 16-32         |
| **Architecture review (G1.5)**                      | architecture.md + ADRs + fitness-test plan + draft contracts/model                                                                                                                                                  | 16-40         |
| **Data model + migrations (G-Schema prep)**         | Core + domain entities, indexes, reversible migrations                                                                                                                                                              | 12-32         |
| **Code review (per PR)**                            | AI + human                                                                                                                                                                                                          | 1-3           |

Adjust for: ERP API quality (NetSuite REST < Sage < DDI partner-gated < pc/MRP file-ODBC), one-way vs two-way sync, number of entities, whether a sandbox exists, on-prem/VPN connectivity.

---

## Method

### Step 1 — Map deliverables to patterns and sum

For each sprint, identify patterns and sum hours.

### Step 2 — Add transparent buffers

- 15% sprint-coordination overhead.
- 10% QA cycles within sprint.
- 5% revision rounds.
- **Integration risk buffer:** +30-50% on any adapter built without a sandbox (built against docs + mocks, re-verified when access lands).

Show the buffers; never bury them.

### Step 3 — Milestone + project roll-up

Sum sprint hours + 10% milestone overhead (PM coordination, gate reviews, milestone regression).

### Step 4 — Convert to weeks

```
Effective capacity per dev/week = 28 hours (40 nominal − 6 meetings/admin − 6 context-switch)
Project capacity/week = num_devs × 28
weeks = total_hours / capacity  (round UP)
```

### Step 5 — Compare to promised timeline

```
ratio = estimated_weeks / promised_weeks
ratio <= 0.9   → on-track
0.9 < r <= 1.1 → tight (flag, don't block)
ratio > 1.1    → overrun → renegotiation_flagged = true
ratio > 1.5    → HALT, surface "timeline fundamentally unrealistic"
```

---

## The 80hr architecture-gate threshold (check every estimate)

Architecture-review budget = **80 hrs** (gate-format.md §G1.5). After Step 3, run this check explicitly:

```
g1_5_required = false
if total_estimate_hours > 80: g1_5_required = true
if integration_targets.length > 1: g1_5_required = true     # >1 external system
if any(new datastore introduced): g1_5_required = true
if any(async/queue/cron-scheduled sync): g1_5_required = true
if tenant.master OR auth beyond a single static key: g1_5_required = true
if any(two-way sync with conflict resolution): g1_5_required = true
if throughput needs caching / rate-limit strategy: g1_5_required = true
```

If `g1_5_required`, state in the G1 plan: **"G1.5 Architecture Review runs before G-Contracts/G-Schema"** and list which triggers fired. Most middleware (and the DDI Inform ↔ BigCommerce pilot) fires several — note that the 80hr line is one trigger among several, not the only one.

---

## Confidence levels

- **High** — pattern matches a prior WebDesk Node project; sandbox available; all scope clear.
- **Medium** — familiar pattern, 1-2 medium unknowns (new ERP adapter, new dashboard module).
- **Low** — novel ERP with no sandbox/docs, undefined conflict rules, multiple open integration questions. **Low confidence → ranges, not point estimates**, and recommend Discovery/architecture to narrow.

Example: High "Inventory sync: 14h" · Medium "Inventory sync: 14-22h" · Low "DDI adapter: 48-100h, recommend sandbox + G1.5 to narrow".

---

## What estimates DON'T include (state this in the output)

```
NOT INCLUDED:
- Client-side delays (sandbox/credential delivery, review turnaround)
- Holidays / team PTO
- Scope creep (handled via RFC → G1 RENEGOTIATE)
- Post-launch bugs (warranty period)
- External dependencies (ERP/store API changes, vendor delays, rate-limit surprises)
```

---

## Role distribution + output to project.json

Break each milestone down by role (backend / frontend / designer / qa / pm / architect) so resource conflicts surface. Write the roll-up to `project.json.budget` (`hours_budget` from the G1 ticket) and the per-milestone breakdown to `milestones.json`.

```json
{
  "estimated_hours_total": 360,
  "by_role": { "backend": 200, "frontend": 80, "designer": 24, "qa": 32, "pm": 16, "architect": 8 },
  "confidence": "medium",
  "g1_5_required": true,
  "g1_5_triggers": [
    ">1 external system",
    "new datastore",
    "cron sync",
    "two-way sync",
    "multi-tenant"
  ]
}
```

---

## Special-case multipliers (applied AFTER base pattern estimate)

- **No sandbox for an adapter:** +30-50% (docs+mocks build, then re-verify).
- **On-prem ERP behind VPN:** +20-40% (connectivity, deploy/runbook complexity — justified at G1.5).
- **Two-way sync with conflict resolution:** +30-50% on the affected entities (parity tests, edge cases).
- **Master dashboard in scope:** add the cross-client rollup pattern; it is not free.

---

## Renegotiation surface format

```
═════════════════════════════════════════════════════════════════
ESTIMATION FLAG — Scope vs Timeline Mismatch
═════════════════════════════════════════════════════════════════
Project: [name]
Promised timeline:  [X] weeks
Estimated timeline: [Y] weeks   Variance: +[Z]%   Confidence: [med/high]
G1.5 required:      [Yes — triggers: ...]

Driving the overrun:
- [DDI adapter, no sandbox]: [48-100h] vs implied [~30h]
- [Two-way pricing sync + conflict resolution]: [...]

Recommended action:
A. RENEGOTIATE timeline   B. RENEGOTIATE scope (drop [items])
C. INCREASE capacity      D. ACCEPT TIGHT (risk shown)
═════════════════════════════════════════════════════════════════
```

Decision is the human's. You present; you don't decide.

---

## Anti-patterns

1. Point estimates for low-confidence ERP adapters. Use ranges.
2. Burying buffers. Show them, including the integration-risk buffer.
3. Estimating without a confidence level — confidence is the most important field.
4. Skipping the 80hr / G1.5-trigger check. It decides whether the architect is invoked.
5. Ignoring "no sandbox" — it's the single biggest source of estimate error here.
6. Not flagging overrun. Hoping the team "makes it work" is how middleware projects fail.

---

Last reviewed: 2026-06-30 (initial Node.js build)
Next review due: 2026-09-30
