---
tier: 2
load_when: ["delivery-head-active", "monitoring", "launch"]
description: M6 post-launch monitoring — the first-window watch, synthetic/health checks, the health-score baseline, and surfacing the per-instance health on the Master dashboard for retainer monitoring.
---

# M6 — Post-Launch Monitoring + Health-Score Baseline

> M6 is where the project becomes a running system under watch. The Delivery Head activates monitoring at launch, watches the first window closely (especially the **first full sync**), establishes the **Project Health Score baseline**, and surfaces it on the **Master dashboard** so the retainer team sees this instance alongside every other client. After M6 the project is delivered and the warranty clock starts; ongoing health is a master-dashboard concern.

---

## 1. Activate at launch

- **Synthetic / health checks** run from launch: the readiness probe, a periodic API smoke (login → a read), and a **sync heartbeat** (is the cron firing on schedule in the client's timezone? is sync-lag within the freshness SLO?).
- Confirm alerts (G5.5 Pillar 4) are live and paging the right destination — re-fire one test alert in production.
- Confirm dashboards render real production data and the Master-dashboard inputs for this instance are emitting.

## 2. Watch the first window (the first 24–72h, and the first full sync)

The riskiest moment is the **first production sync**, which is a **full** sync (heavier, can hit ERP/store rate limits):

- Watch queue depth, DLQ, job durations, and sync-lag as the first full sync runs to completion.
- Reconcile after the first full window: counts/checksums between ERP and store agree within tolerance, no duplicates.
- Watch error rates + latency against the SLO; watch host saturation (the resource the soak test flagged).
- Spot-check the dashboard: operators can log in (JWT), see sync status, and the Activity Logs read correctly in the client's timezone.

Anything off → open the matching runbook (`02-runbooks.md`); a P1/P2 found here is a warranty bug through the normal lifecycle (no auto-fix).

## 3. Establish the health-score baseline

The **Project Health Score** rolls up the signals into GREEN / YELLOW / RED:

| Dimension        | Signal source                                                           |
| ---------------- | ----------------------------------------------------------------------- |
| **Architecture** | fitness suite green (Code Review / G5)                                  |
| **Test**         | regression + contract + sync-parity passing; coverage of critical paths |
| **Dependency**   | OSV/npm audit — open high/critical CVEs, staleness                      |
| **Security**     | OWASP-API pass, secret-scan clean, authz tests green                    |
| **Delivery**     | open P1/P2 count, SLO adherence, error-budget burn, DLQ state, sync-lag |

- Record the **baseline** at M6 (the agreed-good starting point) per the health-score schema.
- Map dimensions to GREEN/YELLOW/RED with the same status colors the dashboard tokens use (so it reads at a glance).
- The baseline is what future drift is measured against — a dependency CVE appearing, SLO burn, or rising DLQ moves the score off baseline and surfaces on the Master dashboard.

## 4. Surface on the Master dashboard

- Push this instance's health score, sync status, and alert rollup to the **Master dashboard** (the cross-client oversight surface — `designer-agent/01-dashboard-standards.md` §2.2).
- This is where **retainer monitoring** lives: the team watches all instances' health from one place, drills into any one, and acts on a YELLOW/RED before the client notices.

## 5. Handoff + close

- After the first window is stable: produce the client report (`templates/client-report.md`) and the handoff package (`templates/handoff-guide.md`).
- Project status → `delivered`; warranty clock starts (the bug-severity SLAs now apply to incoming warranty bugs).
- Ongoing: the Master dashboard health score + alerts drive proactive retainer work; a sustained RED is an escalation, not a surprise.

---

## Rules

1. Activate monitoring **at** launch, not after. The first full sync is the highest-risk event — watch it live.
2. Reconcile after the first full sync; a parity break here is P1/P2 through the normal lifecycle.
3. Establish and record the health baseline at M6; surface it on the Master dashboard.
4. No auto-fix post-launch — warranty bugs follow QA's lifecycle (report → human commands fix → dev fixes → review → human merges → QA verifies).
5. A sustained RED health score is an escalation; the Master dashboard exists so it's caught proactively.

---

Last reviewed: 2026-06-30 by Claude (initial Node.js build)
Next review due: 2026-09-30
