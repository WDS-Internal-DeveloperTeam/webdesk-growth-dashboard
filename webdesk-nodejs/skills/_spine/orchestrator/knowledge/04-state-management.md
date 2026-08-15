---
tier: 2
load_when: ["state-mutation", "orchestrator-active"]
description: "How every agent reads, locks, validates, writes, and versions `project.json`. Single source of truth, atomically managed. Per-project-type dependency graphs."
---

# 04 — State Management

> `project.json` is the single source of truth. Every agent reads it at start of turn and writes through this protocol. Skip a step → state corruption → the project breaks. Schema: `_contracts/project-json.schema.json`.

---

## The write cycle (every write, no exceptions)

1. READ `project.json`.
2. ACQUIRE the lock.
3. Apply changes to an in-memory copy.
4. VALIDATE the copy against the schema — fail → abort, do not write.
5. Increment `project.version`; set `project.updated_at` (ISO UTC).
6. Write to `project.json.tmp`.
7. Snapshot the current file to `project.json.versions/<YYYY-MM-DDTHH-MM-SS>.json`.
8. Atomic rename `project.json.tmp → project.json`.
9. Append the `audit_log` entry.
10. RELEASE the lock.

Read-only operations (status check, audit review) skip the lock. **Writes always lock.**

---

## Lock protocol

Lock file: `outputs/<client_slug>/project.json.lock`.

### Acquire

```
if exists(lock) and lock.expires_at > now():
    FAIL — "Locked by {lock.locked_by} until {lock.expires_at}"
else:
    # missing or expired lock — safe to take over (log a warning if stale)
    write(lock, { locked_by, locked_at: now(), expires_at: now()+5min })
```

Lock TTL is **5 minutes**. Work running longer refreshes `expires_at`. Stale locks (past expiry) are safe to take over.

### Release

`delete(lock)`.

### Contention

Held and not expired → wait 30s, retry once → still held → surface holder + expiry. **Never force-acquire** (corruption risk).

---

## Versioned backups

- Every write snapshots the _pre-write_ file to `project.json.versions/<timestamp>.json` (step 7) **before** the atomic rename. If the process dies mid-write, the original is intact and the snapshot exists.
- Snapshots are **append-only** — never deleted. Each file is small (<50 KB typically).
- Recovery: if `project.json` fails schema validation or is unreadable, **do not auto-recreate** — halt, report the latest snapshot path, let a human restore, then append `audit_log` `recovery_from_snapshot`.

---

## Audit log append rules

`project.json.audit_log[]` is **append-only**. Never delete an entry. Never decrement `project.version`. Format:

```json
{
  "timestamp": "2026-07-12T14:32:00Z",
  "actor": "pm-agent",
  "actor_type": "agent",
  "action": "spec_generated",
  "details": { "spec_version": 2, "open_items": 3 },
  "project_version_before": 5,
  "project_version_after": 6
}
```

Standard actions: `project_created`, `discovery_completed`, `spec_generated`, `spec_revised`, `plan_created`, `estimate_ticketed`, `architecture_reviewed`, `contract_drafted`, `contract_client_approved`, `data_model_drafted`, `schema_client_approved`, `gate_opened`, `gate_reminder_sent`, `gate_escalated`, `gate_decided`, `gate_overridden`, `gate_expired`, `artifact_created`, `artifact_revised`, `agent_invoked`, `route`, `bug_reported`, `bug_fixed`, `token_threshold_alert`, `budget_exceeded`, `renegotiation_requested`, `env_check_override`, `lock_acquired`, `lock_released`, `schema_validation_failed`, `recovery_from_snapshot`, `auto_rollback_triggered`.

This log is the source of truth for SLA-compliance and routing retros.

---

## Per-project-type dependency graphs

The orchestrator enforces stage prerequisites from the active `project_type`'s graph. A stage cannot start until its prerequisite stages are complete **and** their gates passed.

### integration-middleware (the pilot's type)

```
discovery → spec(G0) → planning(G1) → architecture(G1.5) →
   contracts(G-Contracts) → schema(G-Schema) →
   [design(G2) ONLY if a dashboard/UI is in scope] →
   scaffolding(G3) → development → sprint-qa(G4×n) →
   milestone-qa(G5) → observability(G5.5) → pre-launch(G6) → monitoring(M6)
```

**Headless middleware (no UI) skips G2.** G1.5 nearly always fires. The continuous cron sync engine is the load-bearing core; contracts + schema are client-signed before any integration/persistence code.

### custom-app-build

```
discovery → spec(G0) → planning(G1) → [architecture(G1.5) if complex] →
   [contracts/schema if it persists data or calls external systems] →
   design(G2) → scaffolding(G3) → development → G4×n → G5 → G5.5 → G6 → M6
```

Has a UI → **G2 applies**.

### frontend-tool

```
discovery → spec(G0) → planning(G1) → design(G2) →
   scaffolding(G3) → development → G4×n → G5 → G5.5 → G6 → M6
```

G-Contracts/G-Schema only if it talks to a datastore or external API. Frontend-role-heavy.

### version-upgrade

```
[discovery optional] → spec(G0) → planning(G1) → [architecture(G1.5) if non-trivial] →
   scaffolding(G3) → development → G4×n → G5 → G5.5 → G6 → M6
```

Condensed. G-Schema only if the upgrade changes the data model.

### maintenance

```
intake(G0) → development → sprint-qa(G4) → [G6 if it touches production]
```

May skip Discovery, G1, G1.5, G-Schema for trivial tickets. Each fix still gets a G4 and Code Review; **no auto-fix** (`02-routing-table.md`).

### Prerequisite enforcement

```
def can_advance_to(stage):
    g = load_dep_graph(project.project_type)
    for prereq in g.prerequisites_of(stage):
        if not is_stage_complete(prereq): return False
        if not gate_passed(prereq):       return False
    return True
```

Refuse to invoke an agent if `can_advance_to(target) == False`; name the unmet prerequisite.

---

## Concurrent writes

Sequential within a session, but if two actors collide: first acquires lock; second's acquire fails → waits 30s → re-reads the _updated_ `project.json` (not its stale copy) → re-applies its change against new state → aborts and surfaces if the change no longer makes sense. Optimistic concurrency.

---

## Cross-project state (client memory)

PM Agent writes `outputs/<client_slug>/client-memory.md` at closeout (preferences, decisions, what worked). It lives outside `project.json`, persists across projects, and is loaded when starting a NEW project for the same client. On new-project start, ask: "Have we worked with [client] before? If yes I'll load `client-memory.md`."

## Gate status: stored once, displayed everywhere by reference

`project.json.gates[]` holds each gate's `status` (open/passed/failed/blocked) and is the ONLY place that status is authoritative. Everything that _shows_ gate status — `HANDOFF.md`, status reports, the generated app's milestone/gate view — reads it from here at display time. Never hand-copy a gate status into another file as if it were truth; a copy drifts (this caused a pilot handoff to show G2 as not-passed while the gate entry was CONFIRMed). To read a gate's status: find the `gates[]` entry by `id` and read `status`. `project.current_gate` names the active gate only; it says nothing about already-decided gates.

---

Last reviewed: 2026-06-30 (initial Node.js build)
Next review due: 2026-09-30
