---
tier: 2
load_when: ["always"]
description: Canonical gate protocol — format, lifecycle, options, SLA, escalation. Every agent opening a gate uses this verbatim.
---

# Gate Protocol Specification (Node.js Delivery System)

> Every transition between stages passes through a gate. Gates are the system's defense against compounding errors — and in ERP↔store middleware, where the field mapping and the API contracts _are_ the product, the contract and schema gates are the single highest-leverage error-prevention step. This document defines the gate format, lifecycle, options, SLAs, and escalation paths. Every agent that opens a gate uses this exact format. Gate IDs are canonical per `CONVENTIONS.md §4` — do not invent or rename gates.

---

## The canonical gate set

| ID              | Name                                                     | Type              | Approver                       | Conditional?                                          |
| --------------- | -------------------------------------------------------- | ----------------- | ------------------------------ | ----------------------------------------------------- |
| **G0.5**        | Discovery                                                | Human             | PM + client                    | Default (skip only for trivial maintenance tickets)   |
| **G0**          | Spec Validation                                          | Auto              | system                         | Always                                                |
| **G1**          | Plan + Estimate (estimate→ticket recorded)               | Human             | PM lead                        | Always                                                |
| **G1.5**        | Architecture Review                                      | Human             | Tech lead                      | Conditional — see §G1.5 triggers                      |
| **G-Contracts** | Integration/API contract approval                        | Human             | PM **+ client**                | When `integration_targets` non-empty                  |
| **G-Schema**    | DB / data-model approval                                 | Human             | PM **+ client** (DBA verifies) | When a datastore is introduced                        |
| **G2**          | HTML design approval                                     | Human             | Design lead + client           | When the build has a UI (N/A for headless middleware) |
| **G3**          | Scaffold verification                                    | Auto + spot-check | Tech lead                      | Always                                                |
| **G4**          | Sprint QA (repeats per sprint)                           | Hybrid            | QA lead                        | Always (×n)                                           |
| **G5**          | Milestone regression + architecture fitness + load/chaos | Hybrid            | Tech lead + PM                 | Per milestone                                         |
| **G5.5**        | Observability approval (+ runbooks present)              | Human             | Delivery head + Tech lead      | Always before G6                                      |
| **G6**          | Pre-launch                                               | Human             | Delivery head + client         | Always                                                |
| **M6**          | Post-launch monitoring + health-score baseline           | —                 | Delivery head                  | Always                                                |

**Sequence:** `Discovery(G0.5) → G0 → G1 → [G1.5] → G-Contracts → G-Schema → [G2 if UI] → G3 → G4×n → G5 → G5.5 → G6 → M6`

### G1.5 triggers (architecture review fires if ANY hold)

Architecture-review budget = **80 hrs**. G1.5 runs when any of these are true:

- More than one external system in `integration_targets`.
- A new datastore is introduced.
- Async work: queues / jobs / **cron-scheduled sync**.
- Multi-tenancy, or auth beyond a single static key.
- Two-way sync with conflict resolution.
- Throughput needs caching / a rate-limit strategy.
- Estimate > 80 hrs.

The DDI Inform ↔ BigCommerce pilot fires several of these (two external systems, new datastore, cron sync, two-way sync, multi-tenant) — it runs G1.5.

### Why contracts and schema get their own _client_ gates

In ERP↔store middleware the deliverable is the mapping itself. Getting client sign-off on "this ERP field maps to this BigCommerce field, synced this often, in this direction" **before any integration code is written** is structural error prevention, not ceremony. Claude formalizes the kickoff/Discovery rough mappings into the Integration Contract Registry and `data-model.md`; the **human PM secures client approval**. No integration or persistence code starts until G-Contracts and G-Schema pass.

---

## Gate Lifecycle

```
[Stage N work completes]
    ↓
[Validator skill runs] ────→ FAIL ──→ [Return to agent for fix, gate not opened]
    ↓ PASS
[Gate opened]
    ↓
[Notification sent to approver(s)]
    ↓
[SLA timer starts] ── (timer reads project.json.timezone; "2am" means the client's 2am)
    ↓
    ├─ DECISION received within SLA → [Apply decision]
    │       ├─ CONFIRM → [Advance to stage N+1]
    │       ├─ REJECT → [Return to agent with reason — redo from scratch]
    │       ├─ REVISE → [Targeted change request, re-open same gate]
    │       └─ RENEGOTIATE → [Halt, escalate to scope review → re-enter G1 re-estimate]
    │
    └─ NO DECISION at SLA → [Escalation]
            ├─ At 12h: Reminder to primary approver
            ├─ At 24h: Notification to backup approver
            ├─ At 48h: Status → BLOCKED, page PM lead
            └─ At 72h: Project goes to escalation review
```

---

## Standard Gate Format

Every gate opens with this exact structured block. The agent does not deviate from this format.

```markdown
═════════════════════════════════════════════════════════════════
GATE [ID]: [Name]
═════════════════════════════════════════════════════════════════

Project: [Project Name] ([Project ID])
Stage: [Current stage] → [Next stage]
Build context: [nodejs | nodejs+bigcommerce | nodejs+shopify]
Opened at: [ISO datetime, UTC] (local: [datetime in project timezone])
SLA: [X hours]
Expires at: [ISO datetime, UTC]
Primary approver: [Name, role]
Backup approver: [Name, role]

─────────────────────────────────────────────────────────────────
WHAT WAS COMPLETED
─────────────────────────────────────────────────────────────────

[Concise description of work done in the prior stage. 3–5 bullets max.]

─────────────────────────────────────────────────────────────────
ARTIFACTS TO REVIEW
─────────────────────────────────────────────────────────────────

1. [artifact path] — [what it is]
2. [artifact path] — [what it is]
3. [URL] — [what to look for]

─────────────────────────────────────────────────────────────────
AUTOMATED CHECKS (if applicable)
─────────────────────────────────────────────────────────────────

[Validator skill results. Pass/fail per check. Shown for auto/hybrid gates.]

✓ ESLint + Prettier: PASS
✓ Unit + integration tests: 142/142 PASS
✓ API contract tests (vs OpenAPI): PASS
✓ Architecture fitness (controller/service/repository boundaries): PASS
✓ Dependency audit (OSV-Scanner): 0 high/critical
✗ Migration dry-run: 1 destructive change flagged (see report)

─────────────────────────────────────────────────────────────────
DECISION REQUIRED
─────────────────────────────────────────────────────────────────

[The specific question the approver is being asked. One sentence.]

Reply with one of:

CONFIRM
→ Advance to [next stage]
→ [Brief description of what happens next]

REJECT [reason]
→ Return all work in current stage to agent
→ Agent redoes from scratch (use for fundamental issues)

REVISE [specific change]
→ Targeted change without full redo
→ Agent addresses the specific item and re-opens this gate

RENEGOTIATE [reason] (available at G0.5, G1, G1.5, G-Contracts, G-Schema, G2)
→ Halt project
→ Escalate to scope review with client
→ Re-enters G1 for re-estimate; project status → on-hold

─────────────────────────────────────────────────────────────────
WHAT'S BLOCKED
─────────────────────────────────────────────────────────────────

[Subsequent stages that cannot start until this gate passes.]

─────────────────────────────────────────────────────────────────
NOTES
─────────────────────────────────────────────────────────────────

[Context the approver needs. Risk flags. Cost/token flags. External-API
uncertainty (e.g. unverified ERP rate limits). Anything anomalous.]

═════════════════════════════════════════════════════════════════
```

---

## SLA & Escalation per Gate

| Gate                 | Default SLA           | At 12h   | At 24h        | At 48h         | At 72h   |
| -------------------- | --------------------- | -------- | ------------- | -------------- | -------- |
| G0.5 (Discovery)     | 72h (client involved) | Reminder | Notify backup | Reminder again | Escalate |
| G0                   | Auto (no SLA)         | —        | —             | —              | —        |
| G1 (Plan)            | 48h                   | Reminder | Notify backup | Escalate       | Review   |
| G1.5 (Architecture)  | 48h                   | Reminder | Notify backup | Escalate       | Review   |
| G-Contracts          | 72h (client involved) | Reminder | Notify backup | Reminder again | Escalate |
| G-Schema             | 72h (client involved) | Reminder | Notify backup | Reminder again | Escalate |
| G2 (Design)          | 72h (client involved) | Reminder | Notify backup | Reminder again | Escalate |
| G3 (Scaffold)        | 24h                   | Reminder | Notify backup | Escalate       | Review   |
| G4 (Sprint QA)       | 24h                   | Reminder | Notify backup | Escalate       | Review   |
| G5 (Milestone)       | 48h                   | Reminder | Notify backup | Escalate       | Review   |
| G5.5 (Observability) | 48h                   | Reminder | Notify backup | Escalate       | Review   |
| G6 (Pre-Launch)      | 48h (client involved) | Reminder | Notify backup | Escalate       | Review   |

SLA timers compute against `project.json.timezone` (stored UTC, displayed local). Reminders are automated. Escalations are logged to `audit_log`.

---

## Decision Semantics

### CONFIRM

- Stage approved as-is; agent advances. Gate status `passed`.
- Records `decided_by`, `decided_at`, `decision: CONFIRM`, `ticket_id` (where applicable).

### REJECT [reason]

- Work in current stage is invalidated; agent redoes from scratch. Status `failed`, then re-opens after rework.
- Use for: fundamental misunderstanding, wrong direction, scope mismatch.
- **Reason required.** Empty REJECT is treated as REVISE with no detail.

### REVISE [specific change]

- Work mostly correct; specific change needed. Agent applies and re-opens the same gate.
- Use for: small fixes, field-mapping corrections, cadence adjustments, copy.
- **Specific change required.** Vague REVISE ("make it better") is rejected and the approver must clarify.

### RENEGOTIATE [reason]

- Available at the scope-shaping gates: **G0.5, G1, G1.5, G-Contracts, G-Schema, G2**.
- Indicates the spec/plan/contract/schema needs to go back to scope review with the client.
- Project status → `on-hold`; PM lead coordinates scope review; **work re-enters G1 for re-estimate** (a new estimate→ticket is recorded).
- **Reason required.** Logged for sales/scope review.

---

## Gate-specific guidance

### G0 — Spec Validation (auto)

Runs `validate-spec`. Required intake captured: `integration_targets`, data sensitivity, `timezone`, `tenant.mode`, host target, tech-stack layers (or explicit "TBD, decided at G-Schema/G1.5"). < 80% complete halts; ≥ 80% proceeds with documented open items.

### G1 — Plan + Estimate (estimate→ticket recorded)

On CONFIRM, the approved estimate is **recorded as a ticket** and `ticket_id` is written to the gate entry and to `project.json` (`gates[].ticket_id`). This is the audit anchor that change-requests (RFCs) re-estimate against. RENEGOTIATE anywhere downstream returns here.

### G1.5 — Architecture Review (conditional)

Produces `architecture.md` + ADRs (`decisions/`) + a fitness-test plan (`architecture-tests/`) + **draft** integration contracts and **draft** data-model. Drafts here are not yet client-approved — that happens at G-Contracts / G-Schema. Approver is Tech lead.

### G-Contracts — Integration/API contract approval (PM + client)

Claude formalizes Discovery/kickoff mappings into the Integration Contract Registry (`integration-contracts/_registry.md` + one file per system, each validating against `integration-contract.schema.json`). The **human PM secures client approval**. CONFIRM flips each contract's `status` to `client-approved` and records `approved_by` / `approved_at`. **No integration code may be written against a contract still in `draft`.**

### G-Schema — DB / data-model approval (PM + client, DBA verifies)

Claude formalizes the rough field mapping into `data-model.md` (Postgres + Sequelize default per blueprint §10). DB / ORM / storage choices are justified. **Human PM secures client approval; DBA/tech-lead verifies** migrations are reversible and indexes/constraints are sound. No migration runs in any shared environment until this passes.

### G2 — HTML design approval (if UI)

Per D-DES-01: the deliverable is a running **HTML/CSS/JS mockup** served from the preview server — not Figma frames, screenshots, or static design files. For the dashboard, the mockup must match the SOW-driven dashboard standard (`_spine/designer-agent/knowledge/01-dashboard-standards.md`): SOW-derived modules + Settings, plus the fixed contracts — JWT login, per-client+master tenancy, per-module RBAC (VED minimum, extended per module), Settings incl. Timezone. N/A for headless middleware with no UI — record the gate as `skipped` with reason "no UI in scope".

### G3 — Scaffold verification (auto + spot-check)

Auto-validates: repo builds, CI runs, migration runner works, `.env.example` complete, contract stubs present, Docker Compose (app + Postgres + queue + mock ERP/store) comes up healthy. Then a tech lead does a 15-minute spot-check. Auto-pass if both succeed.

### G4 — Sprint QA (repeats)

Auto-checks run before the human review opens: API contract tests, integration/contract tests vs ERP + store sandboxes, webhook idempotency/replay, security (OWASP-API, authz, CVE/secret/SAST/DAST), sync-parity, **missed-run / overlapping-run** tests, **watermark-resume** tests. Failed auto-checks bounce the work back to dev without bothering the human. Each sprint gets its own G4 — never combine sprints.

### G5 — Milestone regression + fitness + load/chaos

Adds architecture **fitness tests** (controller/service/repository boundaries; no DB access outside repositories; API-version enforcement; queue retry caps) and **load + soak + chaos/fault-injection** (the capacity profile feeds SLO/SLA).

### G5.5 — Observability approval (+ runbooks present)

CONFIRM requires the full observability checklist present and wired: **logs, metrics, tracing, alerts, dashboards, queue visibility, SLO/SLA defined** — and the **runbooks present** under `operations/{incident-runbooks,queue-recovery,webhook-replay,db-restore,deploy-recovery}/`. Missing any one blocks G6.

### G6 — Pre-launch

Secrets managed, rollback tested, runbooks complete, deploy adapter verified for the target host, sign-off captured. Client co-approves.

### M6 — Post-launch monitoring + health-score baseline

Establishes the Project Health Score (`health-score.schema.json`) baseline, surfaced on the Master dashboard for retainer monitoring.

---

## Required fields per decision

Every decision writes to `project.json.gates[]`:

```json
{
  "id": "G4-sprint-2.1",
  "type": "sprint-qa",
  "scope": "S2.1",
  "status": "passed",
  "opened_at": "2026-07-12T06:00:00Z",
  "expires_at": "2026-07-13T06:00:00Z",
  "approver": "qa-lead@webdesksolution.ca",
  "decided_by": "qa-lead@webdesksolution.ca",
  "decided_at": "2026-07-12T15:20:00Z",
  "decision": "CONFIRM",
  "ticket_id": null,
  "notes": "All AC met. Contract tests green. Watermark-resume verified.",
  "escalation_log": []
}
```

G1 additionally writes `ticket_id` (the recorded estimate ticket). G-Contracts / G-Schema write `approver` as the PM and reference the client approval evidence in `notes`.

---

## Gate Override Protocol

Gates can be overridden in true emergencies (e.g. critical production incident). Override requires:

1. `OVERRIDE [gate_id] [reason]` command.
2. Approval from a senior dev or owner named in `project.assigned_team`.
3. Logged to `audit_log` with full justification.
4. Reviewed at the next weekly delivery review.

Overrides do NOT change gate decision history — they create an `OVERRIDE` entry alongside the original `pending`/`open` gate. Average overrides per project should be **zero**; > 1 is a process-failure signal.

---

## Gate Anti-Patterns (do not do these)

1. **Vague REVISE.** "Make it better" is not actionable — reject and re-ask.
2. **CONFIRM that contradicts itself.** "CONFIRM but the cadence is wrong" → treat as REVISE.
3. **Skipping G0.5/G0.** Never run downstream agents on an unvalidated spec. #1 source of rework.
4. **Writing integration code against a `draft` contract.** G-Contracts must pass first.
5. **Running a migration before G-Schema.** Schema is client-approved before any shared-env migration.
6. **Combining gate decisions across sprints.** Each sprint gets its own G4.
7. **Self-approval.** A human can never approve a gate on their own work. Architect cannot approve their own G1.5; dev cannot approve their own G4. Approver ≠ doer.

---

## Audit log requirement

Every gate event is logged to `project.json.audit_log`: `gate_opened`, `gate_reminder_sent`, `gate_escalated`, `gate_decided`, `gate_overridden`, `gate_expired`. This log is the source of truth for SLA-compliance reviews.

---

Last reviewed: 2026-06-30 (initial Node.js build)
Next review due: 2026-09-30
