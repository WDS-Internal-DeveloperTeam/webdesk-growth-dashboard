---
tier: 2
load_when: ["pt-version-upgrade", "g1", "g4", "g5", "g6"]
description: Gate differences for the version-upgrade project-type (Node arm) vs the universal set — light Discovery, G1 carries the upgrade plan, regression gates at G4/G5, G6 gated launch, human-commanded fixes only.
---

# Gates — Version Upgrade (Node arm, vs Universal)

> Inherits the universal gate model and format from `_contracts/gate-format.md`. This file documents only the **differences**. Two things define the gate behavior of this type: **(1) fixes are human-commanded, never auto-applied**, and **(2) the Playwright/QA regression is what gates the launch.** There is no new feature design here, so the design/contract/schema gates mostly fall away; the weight moves to G1 (the upgrade plan) and the regression gates (G4/G5).

---

## Discovery (G0.5) — light

The app already exists and works; there's no client discovery of new scope. Discovery is **light** — confirm the current versions, the target (Node LTS line, which majors), the test surface that exists to regress against, and the risk appetite. Record it; don't run a full discovery cycle. (For a small, routine upgrade it may collapse toward intake.)

---

## G0 (Spec Validation) — per universal

Validates the upgrade intake: current versions, target versions, the regression suite's existence, rollback target. Thin but present.

---

## G1 (Plan + Estimate) — carries the upgrade plan

This is the heavy gate of the type. G1 here is the **upgrade plan**, not a feature plan. CONFIRM means the human has approved the staged-bump strategy. The plan deliverable:

- [ ] **Dependency diff** (`npm outdated`) — what's behind, by how many majors.
- [ ] **Vulnerability scan** (`npm audit` + **OSV-Scanner**) — current advisories.
- [ ] **Node LTS matrix + `engines` target** — the runtime line being moved to (LTS only).
- [ ] **Breaking-change report per major** — upstream changes + affected code.
- [ ] **Codemod suggestions** — exact commands, **suggested not applied**.
- [ ] **Staged-bump order** — patch → minor → major, one major at a time, with a regression pass between each.

The human decides which bumps proceed and in what order. RENEGOTIATE is available here (an upgrade that turns out to be a rewrite goes back to scope).

---

## G1.5 (Architecture Review) — usually skipped

An in-place upgrade doesn't change the architecture, so G1.5 normally records `skipped`. It fires only if a major bump _forces_ an architectural change (e.g. an ORM major that changes the data-access pattern) — then the affected design is reviewed.

---

## G-Contracts / G-Schema / G2 — N/A by default

No new external contracts, no new data model, no new UI. Record all three **`skipped`, reason "version upgrade — no new contract/schema/UI"** — unless a specific major bump introduces one (rare; e.g. a DB driver major requiring a migration → G-Schema applies to that change only).

---

## G3 (Scaffold) — N/A / branch setup

There's no new scaffold. In its place: the upgrade branch is set up, CI runs `npm ci` reproducibly against the new lockfile, and the existing test/regression harness (Playwright) is confirmed runnable. Record G3 as adapted or skipped accordingly.

---

## G4 (Sprint QA) — the regression gate, repeated per staged bump

**This is where the type's discipline lives, and it repeats once per staged bump.** Each staged bump gets its own G4 — never combine bumps into one gate.

Per universal G4, plus the upgrade-specific flow:

- [ ] The bump applied is **a single staged step** (one major at most).
- [ ] `npm audit` + OSV-Scanner re-run after the bump — no new high/critical.
- [ ] **Playwright / QA regression run** against the suite.
- [ ] If regression fails → **bug report written, handed to a human. The agent does NOT auto-fix.**
- [ ] Human **commands the fix**; the agent applies **only** the commanded fix.
- [ ] **Manual review** of the fix before the gate advances.
- [ ] Lockfile change reviewed in isolation.

A green install is **not** a pass — a pass is green regression + reviewed fix.

---

## G5 (Milestone Regression) — full regression on the upgraded stack

After the staged bumps land, G5 runs the **full Playwright regression** plus architecture **fitness tests** (the layering must still hold after the upgrade) and **load** on the upgraded runtime/dependency set (a major can change performance characteristics). The capacity profile is re-measured, not assumed unchanged.

---

## G5.5 (Observability) — re-verify, don't assume

Observability that worked on the old stack may have broken on the new one (a logging or tracing library major often does). Re-verify logs/metrics/tracing/alerts wire up on the upgraded stack before G6. Runbooks present.

---

## G6 (Pre-Launch) — GATED LAUNCH, regression-proven

The upgrade ships through a real pre-launch gate. **G6 will not open without green regression** (the launch is gated on QA, not on the bumps installing). Plus universal G6: rollback tested (and here, the rollback is "revert to the prior lockfile + Node line" — tested in staging), sign-off captured. No "it's just an upgrade" shortcut past G6.

---

## M6 — health-score recompute

Post-launch, recompute the Project Health Score (`_contracts/health-score.schema.json`). The **dependency_health** axis should jump (fewer majors behind, advisories cleared) — this is the visible win the upgrade bought, surfaced on the master dashboard.

---

## Human-commanded fix — the non-negotiable

Repeated here because it changes every regression gate: **the agent never auto-applies a fix to an upgrade regression.** The loop is always: regression fails → **agent writes a bug report** → **human commands the fix** → agent applies only the commanded fix → **manual review** → advance. An agent that quietly self-heals a regression has violated the type's core contract.

---

## Gates summary

| Gate             | Universal                | Version Upgrade (Node) behavior                                                                                                                        |
| ---------------- | ------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Discovery (G0.5) | Default                  | **Light** — confirm versions, target, regression surface                                                                                               |
| G0               | Spec validation          | Thin upgrade intake                                                                                                                                    |
| G1               | Plan + estimate          | **Heavy — the upgrade plan** (diff, audit/OSV, breaking-change report, codemod _suggestions_, staged-bump order)                                       |
| G1.5             | Conditional              | **Usually skipped**; fires only if a major forces an architecture change                                                                               |
| G-Contracts      | When integrations exist  | **N/A — skipped**                                                                                                                                      |
| G-Schema         | When a datastore changes | **N/A — skipped** (unless a DB-driver major needs a migration)                                                                                         |
| G2               | If UI                    | **N/A — skipped** (no new UI)                                                                                                                          |
| G3               | Scaffold                 | Adapted — upgrade branch + reproducible `npm ci` + harness check                                                                                       |
| G4               | Sprint QA (×n)           | **The regression gate, per staged bump** — audit/OSV, Playwright regression, **bug report → human-commanded fix → manual review**. One major per step. |
| G5               | Milestone regression     | Full Playwright regression + fitness + load on the upgraded stack                                                                                      |
| G5.5             | Observability            | **Re-verify** on the new stack — don't assume it survived                                                                                              |
| G6               | Pre-launch               | **Gated launch — won't open without green regression**; rollback = revert lockfile + Node line, tested                                                 |
| M6               | Health-score baseline    | **Recompute** — dependency_health should improve                                                                                                       |

---

Last reviewed: 2026-06-30 by Claude (initial build)
