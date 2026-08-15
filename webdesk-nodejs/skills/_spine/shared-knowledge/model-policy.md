---
tier: 0
load_when: ["always"]
description: "Which model runs which task. The system decides; the developer never picks."
---

# Model Policy — the system chooses, not the dev

> Each skill declares its `model` in frontmatter. The orchestrator honors it. Developers do not select models. Principle: Haiku for mechanical work, Sonnet for production code and most agent work, Opus for thinking-heavy work (planning, architecture, hard debugging).

## Assignment matrix

| Agent / task                                    | Model        | Why                             |
| ----------------------------------------------- | ------------ | ------------------------------- |
| Orchestrator (routing/state)                    | sonnet       | Frequent, cheap decisions       |
| Validators, classifiers, audit/status writers   | haiku        | Mechanical, high-volume         |
| PM — discovery synthesis, planning, estimation  | **opus**     | Scope/risk/sequencing reasoning |
| PM — routine doc/status updates                 | haiku→sonnet | Templated                       |
| Architect (G1.5)                                | **opus**     | Hardest reasoning in the system |
| Designer — HTML mockups                         | sonnet       | Pattern-driven                  |
| Backend — coding                                | sonnet       | Production code                 |
| Backend — complex sync design / 3rd-retry debug | **opus**     | Escalation                      |
| Frontend — React/Next                           | sonnet       | Production code                 |
| QA — test authoring/reasoning                   | sonnet       | Judgment                        |
| QA — log parsing/classification                 | haiku        | Mechanical                      |
| Code Review — standard PR                       | sonnet       | Rule application                |
| Code Review — architectural review of large PR  | **opus**     | System-level reasoning          |
| Delivery Head — checklists/status               | haiku→sonnet | Templated                       |

## Escalation ladder

`haiku → sonnet → opus`

Escalate one tier when:

- a task fails twice,
- a complexity flag is set on the project (>1 external system, new datastore, async/cron sync, multi-tenancy, two-way sync with conflict resolution), or
- Code Review rejects the same issue twice.

Every escalation is logged to `audit_log` with the reason, so spend is visible. De-escalate back to default once the hard part is solved. Keep Opus on the work that needs it and nothing else.

## How an agent applies this

1. Read your own SKILL.md `model` field — that's your default.
2. If the orchestrator passes an `escalate: opus` flag (set per the ladder), use it for this task only.
3. Never let a developer's request override the policy; if asked "use Opus for everything," explain the policy and decline.

---

Last reviewed: 2026-06-30 (initial build)
