---
tier: 2
load_when: ["monitoring", "pm-active"]
description: How the PM Agent computes and maintains the 5-axis Project Health Score (GREEN/YELLOW/RED) per health-score.schema.json. Surfaced on the Master dashboard for retainer monitoring; recomputed monthly. New for the Node.js system.
---

# 09 — Project Health Score

> The Project Health Score is a five-axis snapshot of a delivered project's health, surfaced on the **Master dashboard** for retainer monitoring (blueprint §13-14, §8). The PM Agent owns computing and maintaining it. It is **new for the Node.js Delivery System** — there was no equivalent in the Shopify donor. It conforms exactly to `_contracts/health-score.schema.json`. Baselined at **M6** and recomputed **monthly** (or on demand before a retainer review).

---

## The five axes (each 0-100 + GREEN/YELLOW/RED + one-line basis)

Rating bands (default): **GREEN ≥ 80 · YELLOW 60-79 · RED < 60**. A hard cap may force RED regardless of the number (e.g. an open critical security finding).

### 1. architecture_health

How well the codebase holds its intended shape. Computed from:

- Architecture **fitness-test pass rate** (controller/service/repository boundaries, no DB access outside repositories, API-version enforcement, queue retry caps — see architect `04-fitness-test-planning.md`).
- Complexity hotspots (cyclomatic) and count of boundary violations.
- **GREEN** = all fitness tests pass, no new boundary debt.
- Basis example: `fitness 12/12 pass, 0 boundary violations, 1 complexity hotspot`.

### 2. test_health

Confidence the test suite gives. Computed from:

- Line/branch coverage vs target.
- Presence + green status of required test classes: API contract tests, integration/contract tests vs ERP+store sandboxes, webhook idempotency/replay, and the **sync-specific tests (missed-run, overlapping-run, watermark-resume)**.
- Flaky-test rate subtracts.
- **GREEN** = coverage at target and all required classes present and green.
- Basis example: `cov 84% (target 80), contract+integration+sync tests green, 0 flaky`.

### 3. dependency_health

Freshness and safety of the dependency tree. Computed from:

- Outdated-dependency count (majors behind).
- Known-vulnerability count from **OSV-Scanner / npm audit**.
- EOL runtime/library usage (e.g. Node version past LTS).
- **GREEN** = no high/critical advisories, few majors behind.
- Basis example: `0 high/critical (OSV), 3 majors behind, Node 22 LTS`.

### 4. security_health

Security posture. Computed from:

- OWASP-API check results.
- **Authz coverage** — every tenant-scoped query actually scoped by tenant.
- Secret-scan / SAST / DAST findings.
- Secrets-management correctness (no inline secrets, rotation in place).
- **Any open high/critical finding caps this RED** regardless of value.
- Basis example: `OWASP-API pass, authz scoped, 0 secrets inline, 0 open high/critical`.

### 5. delivery_health

Delivery / operational momentum. Computed from:

- Gate SLA adherence.
- Budget burn: `hours_burned` vs `hours_budget`, `token_used` vs `token_cap`.
- Open P1/P2 bug count and age.
- Sync error/alert rate.
- Runbook completeness (all five present) and SLO/SLA attainment in monitoring.
- **GREEN** = on-budget, no aged P1/P2s, SLOs met, runbooks present.
- Basis example: `on-budget, 0 aged P1/P2, SLO 99.5% met, runbooks 5/5`.

---

## Rollup rule

```
rollup = worst-of(the five sub-ratings)
one RED  → rollup RED
else one YELLOW → rollup YELLOW
else GREEN
```

A single RED forces a RED rollup. This is intentional — a healthy-looking project with one critical security finding is not healthy.

---

## How to compute (procedure)

1. **Gather inputs** (mostly from CI + `project.json`):
   - Fitness-test results, coverage report, test-class presence → axes 1, 2.
   - OSV-Scanner / npm audit, outdated report, Node version → axis 3.
   - OWASP-API + authz + secret-scan/SAST/DAST results → axis 4.
   - `project.json.gates[]` SLA adherence, `budget`, `bugs[]`, sync alert rate, `runbooks_status`, monitoring SLO data → axis 5.
2. **Score each axis 0-100**, assign rating by the bands, apply any hard caps (open critical security finding → axis 4 RED).
3. **Write a one-line `basis`** per axis — the explanation is required by the schema and is what makes the score trustworthy on the dashboard.
4. **Compute the worst-of rollup.**
5. **Write the snapshot** to `project.json.health_score` (the lighter shape) and the full object (conforming to `health-score.schema.json`, `schema_version: "1.0.0"`) wherever the master dashboard reads it. Set `computed_at`.
6. Optionally set `trend` (up/flat/down) per axis vs the previous computation.

Example `project.json.health_score`:

```json
"health_score": {
  "architecture": 92, "test": 84, "dependency": 88,
  "security": 100, "delivery": 71, "rollup": "YELLOW",
  "computed_at": "2026-08-01T06:00:00Z"
}
```

(Here delivery at 71 is YELLOW, which forces a YELLOW rollup even though four axes are GREEN.)

---

## Cadence

- **Baseline at M6** (post-launch) — the first computation establishes the reference.
- **Recompute monthly** thereafter for retainer monitoring (run at 06:00 in `project.json.timezone` so the boundary lines up with the client's business day).
- **On demand** before any retainer review or after a significant change (RFC landing, dependency bump, incident).
- Each recompute is a fresh `computed_at`; trends are vs the previous run.

---

## Surfacing on the Master dashboard

The master (super-admin) dashboard lists every client instance with its rollup color, the five sub-scores, sync status, and an alert rollup, with drill-in to the per-axis basis. This is where retainer health is monitored across clients. A YELLOW or RED rollup is the signal to act before the client notices.

---

## Anti-patterns

1. **A score with no basis.** The one-line basis per axis is mandatory — a bare number is not trustworthy.
2. **Averaging instead of worst-of.** The rollup is worst-of by design; don't dilute a RED.
3. **Ignoring the security hard cap.** An open critical finding caps axis 4 RED regardless of the computed value.
4. **Computing once and forgetting.** It's a monthly retainer instrument, not a launch checkbox.
5. **Hand-waving delivery_health.** It's concrete: SLA adherence, budget burn, aged P1/P2s, alert rate, runbook completeness, SLO attainment — read them from `project.json` and monitoring, don't estimate.

---

Last reviewed: 2026-06-30 (initial Node.js build)
Next review due: 2026-09-30
