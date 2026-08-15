---
tier: 2
load_when: ["webdesk-growth-dashboard", "ready-for-claude"]
description: "The Ready-for-Claude task package template — what an authorized operator hands to Claude Code for exactly one authorized stage, per the Version 1 Claude execution boundary (SKILL.md §7). Distinct from a gate block (_contracts/gate-format.md); this is the INPUT to a stage, a gate is the OUTPUT review."
---

# Ready-for-Claude Task Package — Fill-in Template

> Per `SKILL.md §7` (Version 1 Claude execution boundary): Claude never self-selects work on this project. An authorized human operator marks a dashboard task **Ready for Claude**, producing a package in this shape, and **manually invokes Claude Code** against it. Claude reads only this package, performs only the named stage, and stops for approval at the required gate. This template is what that package contains — whether the "dashboard" producing it is the eventual WebDesk Growth Dashboard application itself (post-launch, its own product feature) or, before that exists, a human-authored package following this same shape during this project's own build.

This is an **input** artifact (what Claude is authorized to do), distinct from a gate block (`_contracts/gate-format.md`, an **output** review of what was done). A task package is opened; a gate is passed.

---

## Package fields

```yaml
task_id: [FILL IN — UUID or human-readable stable ID]
title: [FILL IN — short, specific]
project_profile: webdesk-growth-dashboard
stage: [FILL IN — the exact authorized stage, e.g. "Backend: implement Notification Center
      SMTP adapter" — never "the whole module" or "whatever seems needed next"]

authorized_agent: [
    FILL IN — the specific software-delivery role this task is scoped to:
      pm | architect | backend | frontend | designer | qa | code-review |
      delivery-head. See knowledge/00-scope-and-precedence.md §5 — this is
      ALWAYS a software-delivery role,
    never a dashboard business agent
    (WDS-013 forbids conflating the two).,
  ]

record_reference: [
    FILL IN — the specific dashboard record/module this task concerns,
    if
    the dashboard application already exists and generated this package;
    "n/a — pre-launch skill-overlay/Phase-0 work" otherwise,
  ]

dependencies: [
    FILL IN — task IDs or gate IDs that must be complete before this one can start.
    An unresolved dependency blocks Ready status — see docs/implementation/
    phased-implementation-plan.md's phase dependency graph for the larger picture.,
  ]

required_inputs:
  - [
      FILL IN — exact file paths Claude is authorized to read for this stage. Per
      knowledge/00-scope-and-precedence.md §4,
      canonical documents are referenced by path,
      not duplicated into the package.,
    ]

allowed_files:
  - [
      FILL IN — the exact file paths/globs Claude is authorized to WRITE or EDIT for this
      stage. Anything outside this list is out of scope for this task,
      even if it seems
      related. A task package that needs a broader file set should be re-scoped,
      not
      silently expanded mid-task.,
    ]

expected_outputs:
  - [
      FILL IN — concrete,
      checkable deliverables: specific files,
      a specific test suite
      passing,

      a specific migration,
      a specific PR opened against a specific branch.,
    ]

restrictions:
  - "No merge to a protected branch without human action (WDS-007)."
  - "No production deployment (WDS-007)."
  - "No completion claim without a live remote-SHA verification where Git artifacts
    changed (WDS-008)."
  - [
      FILL IN — any stage-specific restriction,
      e.g. "Do not modify packages/database
      migrations in this task — repository-ownership rule,
      knowledge/02-turborepo-
      boundaries.md.",
    ]

validation:
  - [
      FILL IN — what proves this stage is done correctly: which test files,
      which lint/
      typecheck/architecture-fitness checks,

      which manual review.,
    ]

required_approvals:
  - [
      FILL IN — the gate this task's output feeds,
      e.g. "G4 sprint QA" or "G-Contracts
      (GitHub integration)" — per _contracts/gate-format.md's canonical gate set.,
    ]

operator: [FILL IN — the human who marked this Ready for Claude]
developer: [
    FILL IN — the human account under which Claude Code is invoked,
    if distinct
    from the operator,
  ]
due_date: [FILL IN or omit]
```

---

## Completion checklist (Claude self-checks before reporting done, per `ai-output-verification.md` + this profile's WDS-008)

- [ ] Every file touched is within `allowed_files` — nothing edited outside scope.
- [ ] Every `expected_outputs` item is actually present.
- [ ] `validation` checks pass (tests, lint, typecheck, architecture fitness).
- [ ] If Git artifacts changed: pushed, and the remote commit SHA is confirmed to exist via a live GitHub read (WDS-008) — never reported as complete from a local commit alone.
- [ ] No `restrictions` item was violated.
- [ ] The task stops here — the next stage (if any) is a new task package, not an automatic continuation.

---

Last reviewed: 2026-08-05 (initial profile build)
