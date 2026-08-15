---
tier: 2
load_when: ["pt-version-upgrade", "planning", "g1", "g4", "g5"]
description: The staged-bump upgrade methodology in detail — dependency-diff sources, Node LTS matrix + engines + lockfile, breaking-change report format, codemod suggestion (suggest never apply), the regression loop, and the no-auto-fix rule.
---

# 01 — Upgrade Flow

> The whole type is one disciplined loop run patiently. This file is the methodology: where the diff comes from, how to stage the bumps, the Node/engines/lockfile rules, the report formats, and — above all — **the no-auto-fix rule** that governs how a regression is resolved.

---

## The one rule that governs everything: no auto-fix

When a staged bump causes a regression, **the agent writes a bug report and stops. It does not fix.** A human reads the report and **commands** the fix; the agent applies **only** the commanded change, then a human reviews it. The agent never decides on its own initiative to edit application code to make a failing test pass after an upgrade.

Why this is strict:

- An upgrade regression is often a _correct_ upstream behavior change, not a bug — auto-"fixing" it can paper over a real semantic shift (a changed default, a stricter validation, a dropped coercion).
- Bundled auto-fixes destroy bisectability — you can no longer tell which bump or which fix caused what.
- The human owns the risk call. The agent's job is to make the break legible, not to make it disappear.

Everything below feeds this rule: clean diffs, precise reports, and isolated steps exist so the human can command fixes with full information.

---

## Dependency-diff sources

Three inputs, run at planning (G1) and re-run after each staged bump:

### `npm outdated`

The freshness diff — current vs wanted vs latest, per package, with how many majors behind. This drives the **staged-bump order**: group by patch/minor/major, list each major separately.

```
Package      Current   Wanted    Latest   Type        Majors behind
express      4.18.2    4.19.2    5.1.0    dependency   1
sequelize    6.32.0    6.37.3    7.0.1    dependency   1
...
```

### `npm audit`

Known advisories in the current tree, by severity. Captures what the upgrade should _clear_ (and warns if a bump would _introduce_ one).

### OSV-Scanner

Cross-checks against the OSV database (broader than npm's advisory feed). Run it alongside `npm audit` — they don't fully overlap. A high/critical from either is a flag.

> Output of this step: `upgrade/dependency-diff.md` and `upgrade/audit-report.md`. These are the raw material the staged-bump plan is built from.

---

## Node LTS matrix + `engines` + lockfile discipline

### Node LTS matrix

Only upgrade onto an **active or maintenance LTS** Node line (even-numbered). Never target an odd/current line for a client app, never an EOL line. Record the matrix:

| Node line  | Status                 | Use?                              |
| ---------- | ---------------------- | --------------------------------- |
| 22.x       | Active LTS             | **Target**                        |
| 20.x       | Maintenance LTS        | Acceptable (still supported)      |
| 18.x       | EOL approaching / past | **Do not target**                 |
| 23.x (odd) | Current, not LTS       | **Do not target for client apps** |

Write the chosen target and its EOL date in `upgrade/node-matrix.md`.

### `engines` field

`package.json` `engines.node` is set to the target line (e.g. `">=22 <23"`), and CI enforces it (`engine-strict` / a CI Node version that matches). The `engines` field is the contract for what the app runs on — keep it truthful.

### Lockfile discipline

- Each staged bump produces a **deliberate `package-lock.json` change, reviewed in isolation** — never mixed with unrelated edits.
- The lockfile is committed; CI installs with **`npm ci`** (reproducible, lockfile-exact) — never a bare `npm install` that could drift the tree.
- After a bump, the lockfile diff is part of the bug-report/review surface — a surprising transitive change is a signal, not noise.

---

## Staged-bump methodology: patch → minor → major, one major at a time

The order is the safety mechanism. You always go from least to most risky, and you isolate each risky step.

1. **Patch bumps first.** Lowest risk; clear easy advisories. One regression pass.
2. **Minor bumps next.** Backwards-compatible by semver contract — but regress anyway.
3. **Majors last, ONE AT A TIME.** Each major is its own staged step with its own breaking-change report, its own bump, its own regression, its own (human-commanded) fixes, before the next major starts.

> Never bump two majors in one step. If `express` and `sequelize` both have a major, do express → regress → review → then sequelize → regress → review. Bundling them makes a failure un-bisectable.

Each staged step = `bump → scan (audit + OSV) → Playwright regression → (if fail) bug report → human commands fix → apply commanded fix only → manual review → next step`.

---

## Breaking-change report format (per major)

One report per major bump (`upgrade/breaking-changes-<pkg>.md`). Format:

```markdown
# Breaking changes — <package> <from> → <to>

## Upstream breaking changes (from changelog / migration guide)

- [change] — <what upstream changed> (source: <link>)
- ...

## Affected in our code

- <file:symbol> — <how this change affects it> — [manual change | codemod-suggested]
- ...

## Suggested remediation

- Codemod available: `npx <codemod> ...` (SUGGESTED — not run)
- Manual changes: <list>

## Risk notes

- <semantic shifts, changed defaults, anything that is "working as intended" upstream but breaks us>
```

This report is what the human plans the fixes against. It is descriptive, not prescriptive — the human decides what to apply.

---

## Codemod suggestion — suggest, never apply

Many framework majors ship a codemod (an automated source transform). Claude:

- **Identifies** the codemod and the exact command.
- **Describes** what it would change (which files, which patterns).
- **Records** it in `upgrade/codemod-suggestions.md`.
- **Does not run it.**

The human decides whether to run a codemod. After a human runs (or commands running) it, the result is reviewed like any other change. Reason: a codemod is a bulk auto-edit — exactly the kind of unsupervised mutation the no-auto-fix rule exists to prevent.

---

## The regression loop

Per staged bump:

```
apply ONE staged bump (human-commanded)
        │
        ▼
re-scan: npm audit + OSV-Scanner  ──► new high/critical? → flag, surface
        │
        ▼
run Playwright / QA regression
        │
   ┌────┴─────┐
 PASS        FAIL
   │           │
   │           ▼
   │     write BUG REPORT (upgrade/bug-report-<step>.md) — DO NOT FIX
   │           │
   │           ▼
   │     human COMMANDS the fix
   │           │
   │           ▼
   │     agent applies ONLY the commanded fix
   │           │
   │           ▼
   │     manual review
   │           │
   └────►  advance to next staged bump
```

A bug report includes: which bump, the failing regression(s), the relevant breaking-change entry, the lockfile delta, and the agent's _analysis_ of likely cause — but no applied fix.

---

## Pre-flight checklist (before each staged bump)

- [ ] Diff + audit + OSV current for this step.
- [ ] Breaking-change report written if this step is a major.
- [ ] Codemod (if any) suggested, not run.
- [ ] Regression suite confirmed runnable and green _before_ the bump (establish the baseline).
- [ ] This step bumps **at most one major**.
- [ ] Lockfile change will be reviewable in isolation.

## Post-bump checklist

- [ ] `npm audit` + OSV-Scanner re-run; no new high/critical (or flagged if so).
- [ ] Playwright regression run; result recorded (`upgrade/regression-<step>.md`).
- [ ] If failed: bug report written, handed to human — **no auto-fix**.
- [ ] Fix (if any) applied only as commanded, then manually reviewed.
- [ ] Lockfile diff reviewed; `engines` updated if the Node target moved.

---

Last reviewed: 2026-06-30 by Claude (initial build)
