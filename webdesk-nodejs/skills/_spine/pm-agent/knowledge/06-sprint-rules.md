---
tier: 2
load_when: ["planning", "g4", "pm-active"]
description: Sprint scope discipline for Node.js delivery, plus how the PM verifies sprint work adheres to spec. Keeps sprints focused, achievable, and traceable.
---

# 06 — Sprint Rules

> What makes a good sprint in the Node.js Delivery System, and how the PM Agent verifies adherence vs the spec. Every sprint ends at a G4 sprint-QA gate (gate-format.md §G4).

---

## Hard sprint rules (do not violate)

1. **Duration: 3-5 working days.** If a unit doesn't fit, split or merge.
2. **Maximum 3 distinct outputs per sprint**, with these middleware-specific caps:
   - Backend services/endpoints: max 3 cohesive units.
   - **Sync: max 1 entity per sprint** (e.g. "inventory sync Inform→BigCommerce"). A two-way entity with conflict resolution counts as a full sprint on its own.
   - Dashboard: max 1 module (e.g. "Roles & Permissions VED matrix") or 3 closely related screens.
   - Adapter: one external system's pull/push/normalize/sync-state behind the common interface is a sprint (often more).
3. **3-7 testable acceptance criteria per sprint.** Fewer = too vague; more = split.
4. **Every AC is verifiable** by reading code, running a test, or clicking through. "Syncs correctly" is not testable; "first run performs full sync, subsequent runs incremental from watermark; a run killed mid-sync resumes from the last watermark" is.
5. **Each sprint maps to a specific spec deliverable.** If it doesn't trace back, it's scope creep.
6. **Each sprint has a G4 sprint-QA gate.** No exceptions.
7. **No integration/persistence sprint starts against a `draft` contract or unapproved schema.** G-Contracts / G-Schema must have passed.

---

## Sprint ID convention

`S{milestone}.{sprint}` — e.g. `S2.3` = third sprint of milestone 2. Appears in `milestones.json`, `project.json.gates[].scope`, git branches (`feature/S2.3-inventory-sync`), PR titles (`[S2.3] Inventory sync`), and bug reports.

---

## Acceptance-criteria patterns (Node middleware)

- **Sync behavior:** "First run = full sync; subsequent runs = incremental from `sync_state` watermark."
- **Resumability:** "Process killed mid-sync resumes correctly from the last watermark (watermark-resume test passes)."
- **Overlap policy:** "A slow run does not stack on the next tick (overlap policy: skip-if-running; overlapping-run test passes)."
- **Idempotency:** "Re-delivering the same webhook/event produces no duplicate record (idempotency key enforced)."
- **Timezone:** "Cron fires at 02:00 in `project.json.timezone`, not server local time."
- **Conflict resolution (two-way):** "When both sides change the same field, [source-of-record / last-write-wins] applies and parity test confirms convergence."
- **API contract:** "Endpoints conform to the OpenAPI spec; contract tests pass; upstream failures return 502/503/504 correctly."
- **RBAC:** "A Manager without Delete on the Users module receives 403 on DELETE /users/:id."
- **Tenancy:** "A query from tenant A cannot read tenant B's rows (authz scoping test passes)."
- **Code quality:** "ESLint + Prettier pass; no raw queries outside repositories; controller has no business logic (fitness check passes)."

---

## Sprint brief

When a sprint begins, generate `<workspace>/sprint-briefs/<sprint-id>.md` from `templates/sprint-brief-template.md`. It names scope, ≤3 outputs, 3-7 AC, inputs to read (spec sections, data-model.md, the relevant integration contract, coding standards), dependencies, QA expectations, git branch/PR target, and the done-definition.

---

## Adherence verification (PM duty)

The PM verifies that what was built matches what was scoped — at sprint close (G4) and milestone close (G5).

**At each sprint close, check:**

```
[ ] Every output traces to a spec deliverable (no unscoped additions)
[ ] Every AC checked off with evidence (test name / screenshot / log)
[ ] No integration code written against a draft contract or unapproved schema
[ ] Sync sprints: full-then-incremental, watermark-resume, overlapping-run, idempotency all evidenced
[ ] ESLint/Prettier + architecture fitness (controller/service/repository boundaries) green
[ ] Code Review ran and posted; no open P1/P2 against this sprint
[ ] G4 confirmed by QA lead (NOT the dev who built — approver ≠ doer)
[ ] actual_hours recorded in project.json (feeds estimate calibration)
```

**Scope-creep flag:** if a sprint shipped something not in the spec, raise it. Either it's removed, or it goes through the RFC flow (`08-rfc-change-request.md`) — it does not silently stay. Verbal additions never modify scope.

**At milestone close (G5)** additionally confirm: full milestone regression, architecture fitness tests, and the load/soak/chaos profile all present and green before advancing.

---

## Sprint size guidance

- **Too small (< 12h):** merge or it's a sub-task.
- **Right (16-32h):** most sprints.
- **Too large (> 40h):** split. Common splits: "scheduler core + first entity" → "scheduler core" + "entity"; "two-way pricing sync" → "pull side + parity" + "push side + conflict resolution".

---

## Sprint failure modes

- **Estimate exceeded > 25%:** likely missed complexity (often an unverified API). PM surfaces; dev decides extend vs split remaining work into a follow-up sprint.
- **Multiple P1/P2 in QA:** sprint reopens; dev revises; Code Review re-runs. Bug fixes don't get a new sprint.
- **AC can't be tested:** sprint pauses; PM revises the AC; resumes.
- **Sandbox unavailable mid-sprint:** integration AC are met against mocks; the sprint records a follow-up re-verification task gated on sandbox access.

---

## Anti-patterns

1. Sprint without AC — refuse to start.
2. Untestable AC ("sync works").
3. Open-ended sprints ("all the integrations") — split.
4. More than one sync entity in a sprint.
5. Skipping G4 — no exceptions, even small sprints.
6. Starting an integration sprint before G-Contracts/G-Schema pass.
7. Self-approval at G4 (doer approves own work).

---

Last reviewed: 2026-06-30 (initial Node.js build)
Next review due: 2026-09-30
