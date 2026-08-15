---
name: pt-maintenance
description: "Maintenance project-type — ongoing retainer work. Small tickets, not full projects: each approved estimate runs a LIGHT cycle G1(ticket) → develop → G4 → G6. NO auto-fix. The monthly Project Health Score lives here, surfaced on the master dashboard. Loaded when project_type == maintenance. Use for retainer tickets and ongoing care of a delivered app — escalate a ticket to a full project-type when it outgrows the light cycle."
version: 1.0.0
tier: 1
load_when: ["pt-maintenance"]
tools: [Read, Write, Edit, Glob, Grep, Bash]
model: sonnet
color: green
---

# Maintenance — Project Type (retainer)

> **Ongoing retainer work** on a delivered app — small tickets, not full projects. Each ticket is estimated, approved, built, QA'd, and shipped on a **light gate cycle**: `G1(ticket) → develop → G4 → G6`. The heavy discovery/architecture/contract/schema/design machinery of a full project is **skipped for routine tickets** — the app already exists, the architecture is set, the contracts and schema are approved. Two things anchor this type: the **light cycle** (don't over-process a one-line fix) and the **monthly Project Health Score** (the retainer's instrument, surfaced on the master dashboard). And, as everywhere in this system: **no auto-fix.**

---

## When this is loaded

This is also where an **onboarded existing repo** lands: after the PM Agent reconstructs and the client validates the governance docs (`_spine/pm-agent/knowledge/10-onboard-existing-project.md`), the project runs here as maintenance.

The orchestrator loads this skill when:

- `project.project_type == "maintenance"` (a retainer engagement)

Cascade order (context-budget §1 — only what's in scope loads):

```
1. _spine/orchestrator/SKILL.md          (workflow + state)
2. relevant spine agent / role           (PM / Backend / QA / Code Review / Delivery)
3. nodejs/SKILL.md                       (the platform arm)
4. nodejs/projects/maintenance/SKILL.md  ← you are here
5. this skill's knowledge/* (read on demand, tier 2)
```

The delivered app's own project-type KB is **not** reloaded for routine tickets — the architecture is already known. It's reloaded only when a ticket escalates to a full project-type (see below).

---

## What this project type is — and is not

**Is:** the ongoing care of an app WebDesk already delivered. A stream of small tickets — a bug fix, a copy change, a small config or feature tweak, a dependency patch, a report adjustment — each estimated, approved by the client, built, QA'd, and shipped, then closed. Plus the **monthly health score** that tells the client (and us) whether the app is staying healthy.

**Is not:** a full build (`pt-custom-app-build`, `pt-integration-middleware`), a major runtime/dependency upgrade (`pt-version-upgrade` — a deliberate staged campaign, not a retainer ticket), or a storefront widget (`pt-frontend-tool`). When a "ticket" is actually one of those, it **escalates out** of maintenance.

---

## The light gate cycle

```
  INTAKE ESTIMATE  ──►  CLIENT APPROVAL  ──►  G1 (ticket recorded)
                                                   │
                                                   ▼
                                              DEVELOP (small change)
                                                   │
                                                   ▼
                                              G4 (sprint/ticket QA)
                                                   │
                                                   ▼
                                              G6 (gated ship)  ──►  CLOSE
```

For a routine ticket, **Discovery (G0.5), G0, G1.5, G-Contracts, G-Schema, G2, G3, G5, G5.5 are skipped** — the app already passed all of those at delivery and the ticket doesn't disturb them. What remains is the minimum that keeps quality honest: a recorded estimate (**G1**), QA (**G4**), and a gated ship (**G6**). See `gates.md` for the full contrast and the skip rules.

> The skips are the point. Running full discovery and an architecture review on a button-label change is waste. But the three gates that remain are not optional — every ticket is estimated, QA'd, and shipped through a gate.

---

## The monthly Project Health Score lives here

The retainer's headline instrument. Computed **monthly** (and on demand before a retainer review), it's a five-axis score surfaced on the **master dashboard** so health is watched across every retained client.

- Conforms exactly to `_contracts/health-score.schema.json`.
- Procedure, inputs, and bands are in `_spine/pm-agent/knowledge/09-health-score.md` — **read that to compute it.**
- Five axes, each 0-100 + GREEN/YELLOW/RED + a one-line basis: **architecture · test · dependency · security · delivery**.
- Rollup is **worst-of** the five (one RED forces a RED rollup — intentional).
- Bands: **GREEN ≥ 80 · YELLOW 60-79 · RED < 60**; an open critical security finding hard-caps security RED.
- A YELLOW or RED rollup is the signal to act before the client notices.

`knowledge/01-retainer-cycle.md` covers what feeds each axis from the retainer's running data.

---

## Knowledge in this skill — read on demand

| File                             | Read it when                                                      | What it gives you                                                                                                                                                                                                                                                |
| -------------------------------- | ----------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `knowledge/01-retainer-cycle.md` | Every ticket; monthly health computation; any escalation question | The ticket lifecycle (intake estimate → approval → light build → G4 → G6 → close), the monthly health-score computation and what feeds each axis, the escalation rules (when a ticket must leave maintenance for a full project-type), and the no-auto-fix rule. |
| `gates.md`                       | Every ticket                                                      | The light cycle vs the full sequence, with the skip rules.                                                                                                                                                                                                       |

Read alongside:

- `_spine/pm-agent/knowledge/09-health-score.md` — the canonical health-score procedure.
- `_contracts/health-score.schema.json` — the score's shape.
- `nodejs/SKILL.md` — the platform standards the ticket's change must still satisfy.

---

## Critical rules for this project type

1. **Run the light cycle for routine tickets — don't over-process.** `G1(ticket) → develop → G4 → G6`. Skipping Discovery/G1.5/contracts/schema/design for a small change is correct, not corner-cutting. The app already passed those.
2. **But never skip G4 or G6.** Every ticket is QA'd and shipped through a gate. "It's a tiny change" is exactly when an unreviewed regression slips in. G4 and G6 are floor, not ceiling.
3. **Every ticket is estimated and client-approved before work.** G1 records the estimate as a ticket (the audit anchor). No work on an unapproved estimate.
4. **NO auto-fix.** QA produces a bug report; the agent does not silently fix and re-ship. Fixes are human-commanded, exactly as everywhere else in the system.
5. **Escalate out when a ticket outgrows the cycle.** If a ticket touches the architecture, changes a contract or the schema, adds a UI surface, exceeds the size threshold (e.g. > ~16-24 hrs or the G1.5 triggers fire), or is really a runtime/dependency upgrade campaign — it is **not a maintenance ticket.** Re-estimate it as the right full project-type and run its full gate set. See `knowledge/01-retainer-cycle.md` for the threshold.
6. **The monthly health score is mandatory and surfaced.** Compute it monthly per `09-health-score.md`, write it where the master dashboard reads it, with a basis per axis. A score with no basis is not acceptable.
7. **Respect the existing architecture.** A ticket changes the app within its established shape — controllers/services/repositories, no DB access outside repositories, RBAC/timezone conventions intact. A ticket is not a license to drift the architecture (and if it needs to, it's escalating, see rule 5).
8. **Don't batch unrelated tickets into one gate.** Each ticket carries its own G1/G4/G6 so the audit trail and the rollback boundary stay clean — same spirit as "never combine sprints at G4".

---

## Output artifacts (where things land in the project workspace)

| Artifact                                       | Path                                                              |
| ---------------------------------------------- | ----------------------------------------------------------------- |
| Ticket estimate (recorded at G1)               | `tickets/<ticket-id>.md`                                          |
| Ticket QA / bug report                         | `tickets/<ticket-id>-qa.md`                                       |
| Monthly health score (full object)             | wherever the master dashboard reads it (per `09-health-score.md`) |
| Health score snapshot (lighter shape)          | `project.json.health_score`                                       |
| Escalation record (ticket → full project-type) | `tickets/<ticket-id>-escalation.md`                               |

---

## Tone

This is the long tail of the relationship — many small, fast, correct changes plus a monthly check-up. The temptation is to get sloppy because each ticket is tiny; resist it. The discipline is the opposite of the full-build's heavy ceremony: process _just enough_ (estimate, QA, gated ship) and no more, but never less. The health score is where you earn the retainer's trust — compute it honestly, surface YELLOW/RED early, and act before the client notices.

---

Last reviewed: 2026-06-30 by Claude (initial build)
