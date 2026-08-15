---
tier: 2
load_when: ["gate-decision", "orchestrator-active"]
description: "The orchestrator's enforcement view of gates. Full format/lifecycle lives in `_contracts/gate-format.md`."
---

# 03 — Gate Protocol (orchestrator's enforcement view)

> The canonical gate format, lifecycle, SLAs, and decision semantics live in `_contracts/gate-format.md` — use that block verbatim when opening a gate. This file is what the orchestrator specifically _does_ to open, evaluate, and close a gate. Gate IDs are canonical per CONVENTIONS §4 — never invent or rename.

---

## When a gate OPENS

Open a gate only when:

- the stage's work is complete and produced its required artifacts,
- all automated validators have run and **passed** (failed validators bounce work to the agent — don't bother the human with auto-detectable failures),
- the stage's prerequisites in the dependency graph (`04-state-management.md`) are met.

Action:

1. Acquire the lock on `project.json`.
2. Append to `project.json.gates[]`:
   ```json
   {
     "id": "G-Schema-ddi-systems",
     "type": "schema",
     "scope": "project",
     "status": "open",
     "opened_at": "<ISO UTC>",
     "sla_hours": 72,
     "expires_at": "<opened_at + sla, UTC>",
     "approver": "<role/email>",
     "backup_approver": "<role/email>",
     "ticket_id": null,
     "escalation_log": []
   }
   ```
3. Set `project.json.active.blocked_on` to the gate ID; set `project.current_gate`.
4. Append `audit_log`: `gate_opened`.
5. Release the lock.
6. Emit the **Standard Gate Format** block from `_contracts/gate-format.md` to the approver. SLA timers compute against `project.json.timezone` (stored UTC, displayed local) — "2am" means the client's 2am.

---

## While a gate is OPEN

Track the SLA timer (per-gate SLAs in `_contracts/gate-format.md`). Client-involved gates (G0.5, G-Contracts, G-Schema, G2, G6) default to 72h; internal gates 24–48h.

- +12h: append `gate_reminder_sent`, surface a reminder.
- At SLA expiry: append `gate_escalated`, notify the backup approver.
- At 48h/72h past open: status → BLOCKED, page PM lead / escalation review.

You **never auto-decide**. No auto-approval, ever.

---

## When a DECISION arrives

Triggers: `CONFIRM [id]` · `REJECT [id] [reason]` · `REVISE [id] [change]` · `RENEGOTIATE [id] [reason]` (only at G0.5, G1, G1.5, G-Contracts, G-Schema, G2).

Action:

1. Verify the gate exists and `status: open`.
2. **Self-approval check:** find the actor that produced the artifact (`audit_log` `artifact_created` for this scope). If `decided_by == that actor` → REFUSE: "Self-approval forbidden. [other role] must approve."
3. **Client-gate check (G-Contracts, G-Schema):** the decision is only valid if it carries **client sign-off captured by the human PM** (see below). Claude never self-marks these approved.
4. Validate required detail: REJECT needs a non-empty reason; REVISE needs a specific change; RENEGOTIATE needs a reason. Vague ("make it better") → bounce back for specifics.
5. Acquire lock; update the gate entry (`status`, `decided_by`, `decided_at`, `decision`, `notes`, and `ticket_id` where applicable).
6. Append `audit_log`: `gate_decided`.
7. Clear `active.blocked_on`; release lock.
8. Take the next action (below).

---

## Decision → next action

- **CONFIRM** → advance `project.stage` to the next stage per the dependency graph; invoke the next agent (`02-routing-table.md`). For parallel-track project types, advance all tracks waiting on this gate.
- **REJECT** → move the stage's artifacts to `project.json.versions/rejected/`; set stage back to the start of the current stage; re-invoke the producing agent with the rejection reason as context. Do not advance.
- **REVISE** → keep most of the work; pass the specific change to the producing agent; it applies the change and re-opens the **same** gate.
- **RENEGOTIATE** → halt; `project.status → on-hold`; append `renegotiation_requested`; work re-enters **G1** for re-estimate (new estimate→ticket). PM lead coordinates the client scope review.

---

## Client-approved gates: G-Contracts and G-Schema

These two are the highest-leverage error-prevention step in ERP↔store middleware — the field mapping and the API contracts _are_ the product. They are **client-signed**, not Claude-approved.

### G-Contracts — Integration/API contract approval (PM + client)

- Claude formalizes the Discovery/kickoff rough mappings into the Integration Contract Registry: `integration-contracts/_registry.md` + one file per system, each validating against `_contracts/integration-contract.schema.json` (entities, direction, cadence, conflict rule, field map, timezone).
- The gate opens for the **human PM**, who secures **client approval** out of band.
- On CONFIRM: flip each contract's `status` from `draft` to `client-approved`; record `approved_by` (PM), `approved_at`, and the **client approval evidence** (e.g. signed doc reference, email subject + date, meeting timestamp) in `gate.notes`. Empty evidence → treat as not approved; do not advance.
- **Hard rule:** no integration code may be written against a contract still in `draft`. If a dev role asks to build against a `draft` contract, refuse and point to G-Contracts.

### G-Schema — DB / data-model approval (PM + client; DBA verifies)

- Claude formalizes the rough field mapping into `data-model.md` (Postgres + Sequelize default; alternative DB/ORM/storage choices justified).
- The gate opens for the **human PM** (client sign-off) with the **DBA/tech-lead verifying** migrations are reversible and indexes/constraints are sound.
- On CONFIRM: record client approval evidence in `gate.notes` plus the DBA verification note.
- **Hard rule:** no migration runs in any shared/staging environment until G-Schema passes. Local-only dev migrations are fine before then.

For both: the producing artifact is a **draft** at G1.5 (Architect) — these gates are where the client turns drafts into signed contracts.

---

## Self-approval prohibition (hard enforcement)

| Gate               | Cannot approve                       | Must approve                   |
| ------------------ | ------------------------------------ | ------------------------------ |
| G0                 | (auto validator)                     | (auto)                         |
| G0.5 Discovery     | the agent that produced the report   | PM lead + client               |
| G1 Plan            | PM Agent                             | PM lead                        |
| G1.5 Architecture  | the Architect who wrote it           | Tech lead                      |
| G-Contracts        | the agent that drafted the contracts | PM **+ client**                |
| G-Schema           | the agent that drafted the model     | PM **+ client** (DBA verifies) |
| G2 Design          | Designer                             | Design lead + client           |
| G3 Scaffold        | the dev who scaffolded               | Tech lead                      |
| G4 Sprint QA       | the dev who built the sprint         | QA lead                        |
| G5 Milestone       | the dev who built the milestone      | Tech lead + PM                 |
| G5.5 Observability | the dev who wired it                 | Delivery head + Tech lead      |
| G6 Pre-launch      | Delivery Head                        | Delivery head + client         |

---

## Validators run BEFORE the human gate opens

| Gate        | Auto-validators                             | Checks                                                                                                                                                       |
| ----------- | ------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| G0          | `validate-spec`                             | intake completeness ≥ 80% (integration_targets, data sensitivity, timezone, tenant, host, tech-stack-or-TBD)                                                 |
| G0.5        | `validate-discovery-report`                 | required sections present                                                                                                                                    |
| G1          | `validate-plan`                             | schema, estimate vs scope, estimate→ticket recorded                                                                                                          |
| G1.5        | `validate-architecture`                     | `architecture.md` + ADRs + fitness-test plan + draft contracts/model present                                                                                 |
| G-Contracts | `validate-contracts`                        | each contract validates vs `integration-contract.schema.json`; no `draft` left when CONFIRMing                                                               |
| G-Schema    | `validate-data-model`, `migration-dry-run`  | model schema; migrations reversible; no destructive change unflagged                                                                                         |
| G3          | `validate-scaffold`                         | build passes, CI runs, migration runner works, `.env.example` complete, contract stubs present, Compose (app+Postgres+queue+mock ERP/store) comes up healthy |
| G4          | contract/integration/security/sync tests    | per-sprint suite incl. webhook idempotency, missed-run/overlapping-run, watermark-resume                                                                     |
| G5          | full regression + fitness + load/soak/chaos | cross-sprint                                                                                                                                                 |
| G5.5        | `observability-checklist`                   | logs/metrics/tracing/alerts/dashboards/queue-visibility/SLO-SLA + runbooks present                                                                           |
| G6          | `prelaunch-checklist-runner`                | secrets, tested rollback, runbooks complete, deploy adapter verified                                                                                         |

Validator fails → gate does NOT open; create `bugs[]` entry; route back to producer; re-run on fix; only then open the human gate.

---

## Conditional gates

- **G1.5** opens only if a G1.5 trigger holds (>1 external system, new datastore, async/cron sync, multi-tenancy/auth beyond a single key, two-way sync w/ conflict resolution, throughput needing caching/rate-limit, estimate >80h). Otherwise record `skipped` with reason.
- **G2** opens only when the build has a UI. For headless middleware with no UI, record `skipped`, reason "no UI in scope".
- **Discovery (G0.5)** is default; skip only for trivial maintenance tickets.

---

## Override (rare, audited)

`OVERRIDE [gate_id] [reason]` from a senior dev/owner in `project.assigned_team`. Append to `gate.escalation_log` and `audit_log` (`gate_overridden`) with full justification; mark `passed` with an OVERRIDE note; proceed as CONFIRM; flag for weekly review. Overrides per project should be **zero**; >1 is a process-failure signal — surface it. Overrides never apply to the client sign-off requirement on G-Contracts/G-Schema's client evidence — those still need real client approval; an override only bypasses the SLA/sequence in a genuine emergency, logged.

## Milestone closeout ordering (Dev → Review → QA → MD)

At milestone close the orchestrator enforces the sequence in `pm-agent/knowledge/05-milestone-framework.md`: Milestone Development → Milestone Code Review → Milestone QA (G5, writes `qa-reports/milestone-[id]-qa.md`) → PM generates the milestone summary MD. The milestone-MD step is **blocked** until the milestone QA report exists. If a "generate milestone MD" request arrives with no milestone QA report, do not route it to PM — route to QA to run G5 first, then to PM. This prevents the pilot failure where a milestone MD was produced without QA (feedback #1/#5).

---

Last reviewed: 2026-06-30 (initial Node.js build)
Next review due: 2026-09-30
