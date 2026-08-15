---
tier: 2
load_when: ["session-start", "orchestrator-active"]
description: "Every time the orchestrator wakes up, follow this before any other action."
---

# 01 — Session Start Protocol

> Every time the orchestrator wakes up, run this in order before parsing intent or routing. The goal is a 30-second resume that loads ~7 files, not the whole skill.

---

## Step 0 — Minimal startup load (context-budget discipline)

Load ONLY these, in this order (per `_spine/persona.md` "Minimal startup load order"):

1. `CLAUDE.md` at project root — ALWAYS. It lists the **Required skill files for this project** (the per-project allow-list). If that section is missing, halt and add it before proceeding. If `CLAUDE.md` itself is missing, halt and tell the dev to run `tools/scripts/init-project.sh`.
2. `HANDOFF.md` at project root if present — ALWAYS. Last-session working state + queued tasks.
3. `outputs/<client_slug>/spec.md` if referenced by `CLAUDE.md`.
4. `_spine/persona.md`.
5. `_spine/shared-knowledge/CONVENTIONS.md` + `context-budget.md` + `model-policy.md`.
6. The active agent's `SKILL.md` (one agent at a time).
7. `nodejs/SKILL.md` + ONLY the `integration_targets` listed in `project.json`.

**Never** load another project-type's KB, an integration target not in `project.json.integration_targets`, or multiple agents' deep knowledge at once. If you start nearing the context limit: `/compact`, drop finished files, update `HANDOFF.md`, and if needed end the session and resume fresh.

---

## Step 1 — Environment pre-flight

Run the project's environment check before project work:

```bash
./tools/scripts/check-env.sh
```

Reports PASS / WARN / FAIL for: Node version (v22+), Docker + Docker Compose availability, `jq` (audit-log writes), `project.json` validity, lock file sanity, and that `CLAUDE.md` has its "Required skill files" section.

- All PASS → Step 2.
- WARN → continue, surface warnings in chat.
- FAIL → halt; do not proceed until resolved. If the dev overrides ("continue anyway"), log `audit_log` action `env_check_override` with reason.

---

## Step 2 — Detect intent

Classify the developer's input into ONE intent:

| Intent        | Example                                                  | Next                                                                                                                                        |
| ------------- | -------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------- |
| NEW_PROJECT   | "Start nodejs integration-middleware for DDI Systems"    | Step 3A                                                                                                                                     |
| RESUME        | "Resume DDI Systems" / "Continue project X"              | Step 3B                                                                                                                                     |
| ONBOARD       | "Onboard this existing repo" / "import a legacy project" | Step 3A (onboard-existing: workspace via `init-project.sh --onboard-existing`; PM runs `pm-agent/knowledge/10-onboard-existing-project.md`) |
| STATUS_CHECK  | "Status of DDI Systems?"                                 | Step 3B + report                                                                                                                            |
| GATE_DECISION | "CONFIRM G-Schema for DDI Systems"                       | Step 3B + `03-gate-protocol.md`                                                                                                             |
| OVERRIDE      | "OVERRIDE G3 DDI: emergency hotfix"                      | Step 3B + `05-escalation-paths.md`                                                                                                          |
| WORK_REQUEST  | "Build the inventory sync job"                           | REDIRECT (below)                                                                                                                            |
| UNCLEAR       | anything ambiguous                                       | ask ONE question                                                                                                                            |

**WORK_REQUEST redirect:**

> "I orchestrate; I don't write code. The Backend role (via the `nodejs` arm) builds the sync engine. Want me to invoke it on the active sprint? Tell me the project name or sprint ID."

**UNCLEAR:** ask one clarifying question. Never guess.

---

## Step 3A — New project initialization

1. Extract from input: `build_context` (`nodejs` / `nodejs+bigcommerce` / `nodejs+shopify`), `project_type`, client name, `integration_targets`.
2. If anything is missing, ask in ONE batched question:
   ```
   Setting up the project. Quick answers:
   - Build context: (nodejs / nodejs+bigcommerce / nodejs+shopify)
   - Project type: (integration-middleware / custom-app-build / frontend-tool / version-upgrade / maintenance)
   - Client name:
   - Integration targets: (e.g. bigcommerce, erp:ddi-inform)  [empty for none]
   - Timezone (IANA, e.g. America/Toronto):
   - Tenant mode: (per-client / master)
   - Spec path or paste raw intake:
   ```
3. Create workspace `outputs/<client_slug>/`.
4. Initialize `project.json` (`schema_version: 1.0.0`, `stage: discovery` or `intake`, `version: 1`). Default to **Discovery** stage unless this is a trivial maintenance ticket (blueprint §5 — Discovery is default).
5. Schema-validate the initialized `project.json` against `_contracts/project-json.schema.json`. Fail → halt and report.
6. Acquire lock (`04-state-management.md` § Acquiring lock).
7. Atomic write + version snapshot to `project.json.versions/`.
8. Release lock.
9. Append `audit_log`: `project_created`.
10. Route to PM Agent for Discovery (or G0 spec validation if Discovery is skipped). Cascade per `06-agent-cascade.md`.

---

## Step 3B — Resume / status / gate decision

1. Locate the workspace by client name or project ID. Not found → list close matches, ask; never guess.
2. Read full `project.json` (read-only — no lock needed for a read).
3. Validate against schema. Fail → HALT (`05-escalation-paths.md` § Schema validation failure). Do not proceed on corrupted state.
4. Determine current state: `project.stage`, `project.current_gate`, last active agent, most recent gate status (pending | open | passed | failed | expired).
5. Branch on intent:
   - RESUME → continue from `project.stage`, invoke the agent per `02-routing-table.md`.
   - STATUS_CHECK → produce the Status Report (below).
   - GATE_DECISION → apply per `03-gate-protocol.md` (lock acquired only when writing the decision).
   - OVERRIDE → `05-escalation-paths.md` § Override.

---

## Step 4 — Determine stage + next gate

Map `project.stage` → next gate using the canonical sequence (CONVENTIONS §4):

`Discovery(G0.5) → G0 → G1 → [G1.5] → G-Contracts → G-Schema → [G2 if UI] → G3 → G4×n → G5 → G5.5 → G6 → M6`

Apply the per-`project_type` dependency graph (`04-state-management.md`): e.g. a **headless integration-middleware** project with no UI **skips G2**; `maintenance` may skip Discovery, G1.5, G-Schema. Confirm prerequisites are met with `can_advance_to(stage)` before invoking any agent — if a prerequisite gate isn't passed, halt and name it.

---

## Status Report Format

```
═══════════════════════════════════════════════════════════
PROJECT STATUS: [Name] ([ID])
═══════════════════════════════════════════════════════════
Build context: [nodejs | nodejs+bigcommerce | nodejs+shopify]
Project type:  [type]
Integration targets: [list]
Timezone:      [IANA]   Tenant: [per-client | master]
Stage:         [stage]        Current gate: [gate id]
Created:       [date]         Last update: [ts]

─── Progress ────────────────────────────────────────────
Milestones:    [done]/[total]   Active sprint: [id|none] ([status])

─── Open gates ──────────────────────────────────────────
- G[ID]: [type] — opened [ago], SLA expires [time, local tz]

─── Blocked on ──────────────────────────────────────────
[blocked_on, else "Nothing — work in progress"]

─── Recent activity (last 5 audit_log) ──────────────────
[ts — actor — action]

─── Budget ──────────────────────────────────────────────
Tokens: [used]/[cap] ([%])    Hours: [burned]/[budget]

─── Next action ─────────────────────────────────────────
[what moves it forward, and who does it]
═══════════════════════════════════════════════════════════
```

Terse. No filler.

---

## Step 5 — Pre-action verification

Before invoking any agent:

1. Lock released (you don't hold it during agent work).
2. Budget check passes (`02-routing-table.md` § Budget Check).
3. The previous stage's gate is passed (no skipping).
4. Cascade order correct (`06-agent-cascade.md`: spine → nodejs arm → integration targets → project-type → on-demand KB).
5. No out-of-scope KB would be loaded (project_type + integration_targets only).

Any failure → halt, surface the specific reason.

---

## Cold vs warm start

- **Cold** (first time this session): re-read `project.json` and relevant KB; don't trust prior-session memory.
- **Warm** (already operating this session): re-read `project.json` if >5 min since last read (another actor may have written). Default to cold behavior unless confident state is fresh.

---

## Edge cases

- **`project.json` missing/corrupt:** do not auto-recreate. Halt. Report the latest snapshot path; restore manually.
- **Lock held (not expired):** wait 30s, retry once; still held → report holder + expiry.
- **Multiple matching projects:** list all, ask which. Never guess.
- **Token budget exceeded:** halt, surface used/cap, request increase or stop.
- **Context >90%:** write `HANDOFF.md` immediately, `/compact`, drop finished files; resume fresh if still tight.

---

Last reviewed: 2026-06-30 (initial Node.js build)
Next review due: 2026-09-30
