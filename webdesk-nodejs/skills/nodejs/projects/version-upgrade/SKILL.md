---
name: pt-version-upgrade
description: "Version upgrade project-type (Node arm) — major Node runtime and dependency upgrades on an existing Node app. Staged bumps, breaking-change report, codemod suggestions, Playwright/QA regression, gated launch. The agent PROPOSES; the human COMMANDS the fix — NO auto-fix. Loaded when project_type == version-upgrade. Not Shopify themes — this is the Node dependency/runtime arm."
version: 1.0.0
tier: 1
load_when: ["pt-version-upgrade"]
tools: [Read, Write, Edit, Glob, Grep, Bash]
model: sonnet
color: green
---

# Version Upgrade — Project Type (Node arm)

> A **major Node runtime or dependency upgrade** on an existing Node application — bumping Node LTS, jumping a framework major (Express, Sequelize, a build tool), or clearing a backlog of out-of-date packages. The deliverable is a **safe, staged upgrade with a regression-proven launch**, not new features. The load-bearing rule of this type: **the agent proposes, the human commands the fix.** Claude produces the upgrade plan, the breaking-change report, and codemod _suggestions_; it runs the regression; it writes the bug report. It does **not** auto-apply fixes. A human reads the report and issues the fix command.

> This is the **Node dependency/runtime arm**, not the Shopify theme version upgrade. No themes here — packages, the runtime, and the lockfile.

---

## When this is loaded

The orchestrator loads this skill when:

- `project.project_type == "version-upgrade"` (Node platform)

Cascade order (context-budget §1 — only what's in scope loads):

```
1. _spine/orchestrator/SKILL.md             (workflow + state)
2. relevant spine agent / role              (PM / Architect / Backend / QA / Code Review / Delivery)
3. nodejs/SKILL.md                          (the platform arm)
4. nodejs/projects/version-upgrade/SKILL.md ← you are here
5. this skill's knowledge/* (read on demand, tier 2)
```

It does not load integration or frontend-tool KB unless the upgrade specifically touches those surfaces.

---

## The flow — the spine of this type (NO AUTO-FIX)

```
  Discovery (light)
        │
        ▼
  ┌───────────────────────────────────────────────────────────────┐
  │ UPGRADE PLAN  (G1-style)                                        │
  │  • dependency diff   (npm outdated)                             │
  │  • vulnerability scan (npm audit + OSV-Scanner)                 │
  │  • breaking-change report (per major being bumped)             │
  │  • codemod SUGGESTIONS (suggested, never applied)             │
  │  • staged-bump order: patch → minor → major, one major at a time│
  └───────────────────────────────────────────────────────────────┘
        │
        ▼
   HUMAN DECIDES which bumps proceed, in which order
        │
        ▼
   apply ONE staged bump  (human-commanded)
        │
        ▼
   Playwright / QA REGRESSION  (G4 / G5)
        │
        ▼
   BUG REPORT  (agent writes it — does NOT auto-fix)
        │
        ▼
   HUMAN COMMANDS the fix  ──►  agent applies the commanded fix only
        │
        ▼
   manual review (G4 review)  ──►  loop back to next staged bump
        │
        ▼
   GATED LAUNCH (G6)  ──►  M6 (monitor + health-score)
```

The loop runs **one major at a time**. You never bump two majors in the same step, and you never let the agent silently fix a regression — the bug report goes to a human, the human commands the fix, the agent applies only what was commanded.

---

## Knowledge in this skill — read on demand

| File                           | Read it when                                | What it gives you                                                                                                                                                                                                                                                                                  |
| ------------------------------ | ------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `knowledge/01-upgrade-flow.md` | Planning, every bump, every regression loop | The staged-bump methodology in full: dependency-diff sources (`npm outdated`, `npm audit`, OSV-Scanner), the Node LTS matrix + `engines` field + lockfile discipline, the breaking-change report format, codemod suggestion (suggest, never apply), the regression loop, and the no-auto-fix rule. |
| `gates.md`                     | Every gate transition                       | The gate **differences** — Discovery is light, G1 carries the upgrade plan, regression gates at G4/G5, G6 is the gated launch.                                                                                                                                                                     |

Read alongside the arm:

- `nodejs/SKILL.md` — the platform standards the upgraded app must still satisfy.
- `nodejs/knowledge/...` — security/dependency and observability patterns referenced in the flow.

---

## Critical rules for this project type

1. **NO AUTO-FIX. The agent proposes; the human commands.** This is the rule that defines the type. Claude produces plans, reports, and codemod _suggestions_, and runs regression. It does **not** apply a fix to a regression on its own initiative. A human reads the bug report and issues the fix command; the agent applies **only** what was commanded. Silently auto-fixing an upgrade regression is the single worst failure mode here.
2. **One major at a time.** Never bump two majors in the same step. Stage them: patch → minor → major, and within majors, one package's major per cycle, with a regression pass between each. Bundling majors makes a failure un-bisectable.
3. **Codemods are suggested, never applied.** Where a tool offers a codemod (e.g. a framework migration codemod), Claude _suggests_ it with the exact command and what it would change — it does not run it. The human decides.
4. **Scan before and after every bump.** `npm audit` + **OSV-Scanner** run as part of the plan and after each staged bump. A bump that introduces a high/critical advisory is surfaced, not buried.
5. **Lockfile discipline.** Every staged bump produces a deliberate `package-lock.json` change reviewed in isolation. No mixing a lockfile churn with unrelated edits. The lockfile is committed; installs are reproducible (`npm ci` in CI).
6. **`engines` + Node LTS matrix.** The `engines.node` field reflects the target Node version; the supported-LTS matrix is explicit. Don't upgrade onto an EOL or odd (non-LTS) Node line. See `knowledge/01-upgrade-flow.md`.
7. **Regression gates the launch.** The **Playwright/QA regression** is what proves the upgrade is safe. A bump is not "done" because it installed — it's done when regression is green and a human has reviewed. G4/G5 carry the regression; G6 won't open without it.
8. **Breaking-change report per major.** Every major bump gets a breaking-change report (what changed upstream, what in our code is affected, the suggested codemod or manual change). The human plans against this report.
9. **Manual review after each fix.** A human-commanded fix is manually reviewed before the loop advances — no rubber-stamping.
10. **Gated launch only.** The upgraded app ships through G6 like any release — rollback tested, regression green, sign-off captured. No "it's just an upgrade, push it" shortcut.

---

## Milestones (typical shape — PM tunes per project)

| Milestone | Work                                                                                                      | Key gates            |
| --------- | --------------------------------------------------------------------------------------------------------- | -------------------- |
| M1        | Light Discovery + dependency diff + audit/OSV scan + breaking-change report + staged-bump plan            | G0.5 (light), G0, G1 |
| M2        | Patch + minor bumps applied (human-commanded), regression each                                            | G4                   |
| M3        | First major (human-commanded) + codemod-suggested changes + regression + bug report → human-commanded fix | G4                   |
| M4        | Remaining majors, one at a time, each with regression + human-commanded fixes                             | G4×n                 |
| M5        | Full regression (Playwright) + architecture fitness + load on the upgraded stack                          | G5                   |
| M6        | Observability re-verified; **gated launch**; health-score recompute                                       | G5.5, G6, M6         |

---

## Output artifacts (where things land in the project workspace)

| Artifact                             | Path                                |
| ------------------------------------ | ----------------------------------- |
| Dependency diff (`npm outdated`)     | `upgrade/dependency-diff.md`        |
| Vulnerability scan (npm audit + OSV) | `upgrade/audit-report.md`           |
| Node LTS matrix + `engines` decision | `upgrade/node-matrix.md`            |
| Breaking-change report (per major)   | `upgrade/breaking-changes-<pkg>.md` |
| Codemod suggestions                  | `upgrade/codemod-suggestions.md`    |
| Staged-bump plan                     | `upgrade/staged-bump-plan.md`       |
| Regression results (per bump)        | `upgrade/regression-<step>.md`      |
| Bug reports (handed to human)        | `upgrade/bug-report-<step>.md`      |

---

## Tone

Upgrades feel mechanical and are quietly dangerous — a transitive dependency changes a default and a payment path breaks at 2am. The discipline is patience: stage it, scan it, regress it, and **let a human command every fix**. The agent's job is to make the danger legible — a clean diff, a precise breaking-change report, a green-or-red regression — not to be clever and self-heal. When you're unsure whether a regression is a real break or a test flake, say so; don't paper over it.

---

Last reviewed: 2026-06-30 by Claude (initial build)
