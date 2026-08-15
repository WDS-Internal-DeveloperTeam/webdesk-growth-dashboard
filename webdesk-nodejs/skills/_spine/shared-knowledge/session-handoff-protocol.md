---
tier: 2
load_when: ["session-boundary"]
description: "How to write HANDOFF.md and resume in 30 seconds. The roll-across-sessions half of the context-budget discipline."
---

# Session Handoff Protocol

> Long projects roll across sessions without dragging full history. `HANDOFF.md` is written at session end and read first at session start. This is the partner to `context-budget.md`: when context nears the limit, you write the handoff and resume fresh rather than silently truncating state.

---

## Why this exists

The team hit the 200K window on a prior pilot; resuming via a lossy "compaction summary" lost state and forced re-explanation. The fix is a structured, persistent handoff file: resume becomes 30 seconds, not 5 minutes.

---

## Read order at session start

Per `_spine/orchestrator/knowledge/01-session-start-protocol.md` Step 0:

1. `CLAUDE.md` — project identity + the **Required skill files** allow-list (smallest, fastest).
2. `outputs/<client_slug>/spec.md` — ground-truth intake (if referenced).
3. `HANDOFF.md` — the most volatile file: what the **last** session was doing right before it stopped.

If a file is missing: `CLAUDE.md` missing → halt, run `tools/scripts/init-project.sh`. `spec.md` missing → PM Agent runs full intake at G0. `HANDOFF.md` missing → assume first session; start from `project.current_gate`.

---

## When HANDOFF.md is (re)written

1. On **context-limit warning** — write the **full** handoff IMMEDIATELY, before `/compact`. This is the critical trigger: never wait for compaction to start losing state (context-budget.md Rule 5).
2. On session end (explicit or detected inactivity).
3. On sprint completion and milestone transition (full update).
4. Lightweight current-state update every ~30 min of active work.

---

## What it captures

Use `_spine/shared-knowledge/handoff-template.md`. The load-bearing fields:

- Last session timestamp (in `project.json.timezone`), last active agent, active milestone/sprint/gate.
- **Where we left off** — 1–2 sentences. The answer to "what would the next session do FIRST with no other context?"
- Files committed this session / files pending commit (work in progress).
- **Next 3 tasks** (queued, concrete, actionable).
- Client blockers (G-Contracts/G-Schema/G2/G6 waits, days open).
- Open failure modes captured this session (feed back into KB).
- Decisions made this session (append to `CLAUDE.md` "Recent decisions" + `client-memory.md`).
- What NOT to do on resume.
- Token/context usage this session.

---

## What it is NOT

- Not a status report (that's for humans, on demand).
- Not the audit log (`project.json.audit_log` is the comprehensive record).
- Not the spec. `HANDOFF.md` is "where we are right now."
- Not optional. If a session ends with no `HANDOFF.md`, the orchestrator failed.

---

## "Where we left off" examples

GOOD:

> "Building the DDI inventory pull in `src/integrations/erp/ddi/inventory-sync.js`. Pull + normalize done and unit-tested; the watermark commit per batch is pending. Next: wrap the batch write + watermark update in one Sequelize transaction. No blockers."

GOOD:

> "Blocked on G-Schema. `data-model.md` drafted and sent to the human PM for client sign-off. Awaiting client approval evidence before any migration runs in staging."

BAD: "Working on the project." (uninformative)
BAD: a paragraph re-listing everything built this session (that's the audit log).

---

## Tie to context-budget

- Drop finished files from context as you go; the handoff records what's done so you don't need them loaded.
- At >90% budget: write the full handoff, `/compact`, drop finished files, resume fresh if still tight.
- Keep `HANDOFF.md` **≤ 200 lines**. If it grows, archive to `docs/session-handoffs/<date>-<slug>.md` and reset.

---

## File location + versioning

`outputs/<client_slug>/HANDOFF.md`. Single file per project, overwritten on regeneration; previous versions archived to `HANDOFF.versions/` (last 10 retained). Never delete — overwrite to update.

---

## Never in HANDOFF.md

Secrets, tokens, passwords, or full credential paths. Reference a secret by name; never embed it.

---

## Validation

A valid handoff has: header with timestamps/IDs, a non-empty "Where we left off", files committed/pending tables (may be empty), Next 3 tasks, and client blockers. Empty placeholders are treated as missing. Run `tools/scripts/validate-handoff.sh` at session start.

## Gate status is read from project.json — never from the handoff

The bug this prevents: a gate shows one status in `HANDOFF.md` and a different one in `project.json` (observed on the pilot — G2 read as _not passed_ on resume while `project.json.gates[]` had it CONFIRMed).

Rule: **`project.json.gates[]` is the single source of truth for every gate's status.** `HANDOFF.md` is a human-readable pointer, not an authority. On resume:

1. Read gate status ONLY from `project.json.gates[]` (find the entry by `id`; `status` ∈ open/passed/failed/blocked).
2. Never infer a gate's status from prose in `HANDOFF.md`, from `project.current_gate` alone, or by re-deriving it from stage. `current_gate` names the _active_ gate; it does not restate the status of already-decided gates.
3. If `HANDOFF.md` disagrees with `project.json`, **`project.json` wins.** Fix the handoff line and append an `audit_log` note; do not touch the gate entry.
4. Any surface that shows gate status (handoff, status report, the generated dashboard's gate/milestone view) derives it from `project.json.gates[]` at read time — it does not cache or hand-copy it.

---

Last reviewed: 2026-06-30 (initial Node.js build)
Next review due: 2026-09-30
