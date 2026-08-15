---
tier: 2
load_when: ["pt-maintenance", "bug-management", "pm-active", "monitoring"]
description: The retainer ticket lifecycle (intake estimate → approval → light build → G4 → G6 → close), the monthly health-score computation and what feeds each axis, the escalation rules, and the no-auto-fix rule.
---

# 01 — Retainer Cycle

> Two rhythms run in a retainer: the **per-ticket rhythm** (many small changes, each on the light cycle) and the **monthly rhythm** (the Project Health Score). This file details both, plus the escalation rules that keep big work out of the light cycle and the no-auto-fix rule that governs how a ticket's QA failures are resolved.

---

## The ticket lifecycle

```
INTAKE → ESTIMATE → CLIENT APPROVAL → G1 (record ticket) → DEVELOP → G4 (QA) → G6 (ship) → CLOSE
```

### 1. Intake

A request arrives (client message, monitoring alert, a YELLOW/RED health axis). Capture it as a ticket stub: what, where, why, who asked.

### 2. Estimate

Size the work. This is also the **escalation check** (below) — if it's too big or touches architecture/contracts/schema/UI, stop and re-route. Otherwise produce a small, honest estimate.

### 3. Client approval

The client approves the estimate. **No work on an unapproved estimate.**

### 4. G1 — record the ticket

On approval, G1 records the estimate as a ticket (`ticket_id` to `project.json.gates[]`). This is the audit anchor.

### 5. Develop

Make the change **within the app's existing shape** — controllers/services/repositories, no DB access outside repositories, RBAC + timezone conventions intact. Small, surgical, no architecture drift.

### 6. G4 — QA

QA the change (sized to it). Automated checks first; then review. **If QA fails, write a bug report and hand it to a human — do not auto-fix** (see the rule below). Human commands the fix; agent applies only that; re-QA.

### 7. G6 — gated ship

Ship through the gate. Rollback path confirmed (usually a single revert for a small ticket); sign-off captured; client co-approves if the change is client-visible.

### 8. Close

Record the outcome on the ticket. If the change is relevant to the next health computation (a dependency bump, a security fix, a P1 cleared), note it — it feeds an axis.

---

## No auto-fix

When G4 QA finds a problem, **the agent writes a bug report and stops. It does not fix and re-ship.** A human reads the report and **commands** the fix; the agent applies **only** the commanded change; it's re-QA'd. This is identical to the rule across the whole system — a small ticket is not an exception. The reason a tiny change feels safe to auto-fix is exactly why it's dangerous: nobody's looking closely.

---

## The monthly Project Health Score

The retainer's headline instrument. Computed **monthly** (run at 06:00 in `project.json.timezone` so the boundary lines up with the client's business day) and **on demand** before a retainer review or after a significant change. It conforms to `_contracts/health-score.schema.json`; the canonical procedure is `_spine/pm-agent/knowledge/09-health-score.md` — **follow that to compute it.** This section summarizes what the retainer's running data feeds into each axis.

### The five axes (each 0-100 + GREEN/YELLOW/RED + a one-line basis)

| Axis                    | What feeds it (from the retainer's data)                                                                                                                                                                                                                |
| ----------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **architecture_health** | Architecture fitness-test pass rate (controller/service/repository boundaries, no DB access outside repositories, API-version enforcement, queue retry caps); complexity hotspots; boundary-violation count. Tickets that drift the shape show up here. |
| **test_health**         | Coverage vs target; presence + green status of required test classes (API contract, integration/contract, webhook idempotency/replay, and any sync tests the app has); flaky rate. Tickets shipped without tests erode this.                            |
| **dependency_health**   | Outdated count (majors behind) from `npm outdated`; vulnerabilities from `npm audit` + OSV-Scanner; EOL runtime/library use (Node past LTS). Patch tickets and upgrade campaigns move this.                                                             |
| **security_health**     | OWASP-API results; authz coverage (every tenant-scoped query scoped); secret-scan/SAST/DAST; secrets-management. **An open critical finding hard-caps this RED** regardless of value.                                                                   |
| **delivery_health**     | Gate SLA adherence; budget burn; open P1/P2 count and age; sync error/alert rate; runbook completeness; SLO/SLA attainment. The retainer's ticket flow and monitoring feed this directly.                                                               |

### Rollup

```
rollup = worst-of(the five)
one RED → RED ; else one YELLOW → YELLOW ; else GREEN
```

Bands: **GREEN ≥ 80 · YELLOW 60-79 · RED < 60.** A single RED forces a RED rollup — a healthy-looking app with one open critical finding is not healthy.

### Output

- Write the **full object** (`schema_version: "1.0.0"`, a `basis` per axis, `computed_at`) where the master dashboard reads it.
- Write the **lighter snapshot** to `project.json.health_score`.
- Each axis carries a **one-line basis** — a bare number is not trustworthy on the dashboard.
- Optionally set per-axis `trend` (up/flat/down) vs the previous month.

### Why it lives here

The retainer is where an app's health drifts over time — dependencies age, coverage erodes, P2s pile up. The monthly score makes that drift visible on the master dashboard before the client feels it. A YELLOW/RED rollup is a prompt to generate tickets — i.e. the score feeds the ticket flow, and the ticket flow feeds the score.

---

## Escalation — when a ticket must leave maintenance

A ticket is **not** a maintenance ticket, and must re-enter the full sequence as the correct project-type, when any of these hold. Check this at the **estimate** step.

| Trigger                                                                                                                      | Escalate to                                  |
| ---------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------- |
| Touches the architecture (new subsystem, structural change)                                                                  | Full type + G1.5                             |
| Changes a contract / integration                                                                                             | Full type + G-Contracts (client-approved)    |
| Changes the data model / needs a migration                                                                                   | Full type + G-Schema (client-approved)       |
| Adds a UI surface                                                                                                            | Full type + G2 (HTML mockup)                 |
| Exceeds the size threshold (≈ > 16-24 hrs) or any G1.5 trigger fires (async/cron, multi-tenancy, new datastore, auth change) | Full type + G1.5                             |
| Is really a runtime/dependency upgrade campaign                                                                              | `pt-version-upgrade`                         |
| Is really a feature build of substance                                                                                       | `pt-custom-app-build` (or the relevant type) |

When escalating: record it (`tickets/<id>-escalation.md`), re-estimate as the correct project-type at G1, and run **that type's full gate set**. Do not force a real project through the light cycle — that's the central anti-pattern of this type. Conversely, do not inflate a genuine one-line fix into a full project — right-size in both directions.

---

## Anti-patterns

1. **Skipping G4 or G6 because "it's tiny".** The floor is the floor. Tiny changes are where unreviewed regressions hide.
2. **Auto-fixing a ticket's QA failure.** Bug report → human commands fix → apply only that → re-QA. Always.
3. **Drifting the architecture via a ticket.** If the change needs to alter the shape, it's escalating, not a ticket.
4. **A health score with no basis.** Every axis needs its one-line basis; a bare number isn't trustworthy.
5. **Computing the score once and forgetting.** It's a monthly instrument, not a launch checkbox.
6. **Forcing a real project through the light cycle** — or inflating a one-line fix into a full project. Right-size.

---

Last reviewed: 2026-06-30 by Claude (initial build)
