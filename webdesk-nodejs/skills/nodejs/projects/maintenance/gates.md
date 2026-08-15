---
tier: 2
load_when: ["pt-maintenance", "g1", "g4", "g6", "bug-management"]
description: Gate differences for the maintenance project-type vs the universal set — the LIGHT cycle G1(ticket) → develop → G4 → G6, the gates that skip for routine tickets, and when a ticket escalates to a full project-type.
---

# Gates — Maintenance (vs Universal)

> Inherits the universal gate model and format from `_contracts/gate-format.md`. This file documents only the **differences**. The defining difference: a routine retainer ticket runs a **light cycle** — `G1(ticket) → develop → G4 → G6` — because the app already exists and already passed the full sequence at delivery. The heavy front-of-pipeline gates **skip**. The three that remain (G1, G4, G6) are the floor and are never skipped.

---

## The light cycle

```
INTAKE ESTIMATE → CLIENT APPROVAL → G1 (ticket recorded) → DEVELOP → G4 (QA) → G6 (gated ship) → CLOSE
```

Skipped for a routine ticket: **Discovery (G0.5), G0, G1.5, G-Contracts, G-Schema, G2, G3, G5, G5.5.** Each is recorded `skipped` with reason "routine maintenance ticket — covered at original delivery". Skipping them is correct: the app's architecture, contracts, schema, and design were all client-approved when it was built, and a routine ticket doesn't disturb them.

---

## G1 (Plan + Estimate) — the ticket gate

G1 here is the **ticket estimate**, recorded and client-approved before any work. On CONFIRM the estimate is recorded as a ticket (`ticket_id` written to `project.json.gates[]`) — the audit anchor for the ticket, exactly per universal G1's estimate→ticket mechanic. No work starts on an unapproved estimate.

This is also the **escalation decision point**: if estimating reveals the ticket is too big or touches architecture/contracts/schema/UI, it escalates out of the light cycle (see below) rather than proceeding.

---

## Develop — within the existing shape

Not a gate, but constrained: the change is made within the app's established architecture (controllers/services/repositories, no DB access outside repositories, RBAC + timezone conventions intact). A ticket does not drift the architecture; if it must, it's escalating.

---

## G4 (Sprint/Ticket QA) — REQUIRED, never skipped

The ticket is QA'd per universal G4, sized to the change. Automated checks (lint, tests, contract tests if the touched area has them) run first. **If QA finds a problem, a bug report is written and handed to a human — the agent does NOT auto-fix.** A human commands the fix; the agent applies only the commanded change; it's re-QA'd. "It's a small ticket" is exactly when an unreviewed regression slips through — G4 is the floor.

---

## G6 (Pre-Launch / Ship) — REQUIRED, never skipped

The ticket ships through a gate per universal G6 — sized to the change, but present. Rollback path confirmed (for a small ticket this is usually a single revert), sign-off captured, client co-approves where the change is client-visible. No "tiny change, just push it" past G6.

---

## What stays skipped (and why)

| Gate             | Skipped for routine ticket? | Reason                                                                   |
| ---------------- | --------------------------- | ------------------------------------------------------------------------ |
| Discovery (G0.5) | **Yes**                     | App already discovered + delivered                                       |
| G0               | **Yes**                     | No new spec to validate                                                  |
| G1.5             | **Yes**                     | Architecture set at delivery; if a ticket needs it, it's escalating      |
| G-Contracts      | **Yes**                     | Contracts approved at delivery; if a ticket changes one, it's escalating |
| G-Schema         | **Yes**                     | Schema approved at delivery; if a ticket migrates, it's escalating       |
| G2               | **Yes**                     | No new UI; if a ticket adds a UI surface, it's escalating                |
| G3               | **Yes**                     | App is already scaffolded and running                                    |
| G5               | **Yes**                     | No milestone regression for a single small ticket                        |
| G5.5             | **Yes**                     | Observability established at delivery                                    |

A ticket that would _un-skip_ any of these is not a maintenance ticket — it escalates.

---

## Escalation — when a ticket graduates to a full project-type

A "ticket" is **not** a maintenance ticket (and must re-enter the full sequence as the right project-type) when any of these hold:

- It **touches the architecture** (new subsystem, new layering, structural change) → G1.5 territory.
- It **changes a contract or the data model** → needs G-Contracts / G-Schema (client-approved).
- It **adds a UI surface** → needs G2 (HTML mockup).
- It **exceeds the size threshold** (e.g. > ~16-24 hrs, or any G1.5 trigger fires: async/cron, multi-tenancy, new datastore, auth change).
- It's really a **runtime/dependency upgrade campaign** → `pt-version-upgrade`, not a ticket.
- It's really a **new feature build of substance** → `pt-custom-app-build` (or the relevant type).

At the G1 estimate, if any of the above is true, **record an escalation** (`tickets/<id>-escalation.md`), re-estimate as the correct project-type, and run that type's full gate set. Forcing a real project through the light cycle is the anti-pattern this rule exists to prevent.

---

## Health score at the gate cadence

Distinct from any single ticket: the **monthly Project Health Score** (`_contracts/health-score.schema.json`, computed per `_spine/pm-agent/knowledge/09-health-score.md`) runs on a monthly cadence (and on demand before a retainer review), not per ticket. It's surfaced on the master dashboard. A YELLOW/RED rollup is itself a signal that may generate tickets.

---

## Gates summary — light cycle vs full sequence

| Gate             | Full sequence (a build) | Maintenance (routine ticket)                             |
| ---------------- | ----------------------- | -------------------------------------------------------- |
| Discovery (G0.5) | Yes                     | **Skipped**                                              |
| G0               | Yes                     | **Skipped**                                              |
| G1               | Plan + estimate         | **Yes — the ticket estimate (recorded)**                 |
| G1.5             | Conditional             | **Skipped** (escalate if needed)                         |
| G-Contracts      | When integrations exist | **Skipped** (escalate if changed)                        |
| G-Schema         | When a datastore exists | **Skipped** (escalate if migrating)                      |
| G2               | If UI                   | **Skipped** (escalate if new UI)                         |
| G3               | Scaffold                | **Skipped** (already scaffolded)                         |
| G4               | Sprint QA (×n)          | **Yes — ticket QA, required, no auto-fix**               |
| G5               | Milestone regression    | **Skipped**                                              |
| G5.5             | Observability           | **Skipped**                                              |
| G6               | Pre-launch              | **Yes — gated ship, required**                           |
| M6               | Health-score baseline   | Replaced by the **monthly** recompute (master dashboard) |

The light cycle is `G1 → develop → G4 → G6`. Everything else is skipped for routine work — and any ticket that needs an un-skipped gate has, by definition, escalated out of maintenance.

---

Last reviewed: 2026-06-30 by Claude (initial build)
