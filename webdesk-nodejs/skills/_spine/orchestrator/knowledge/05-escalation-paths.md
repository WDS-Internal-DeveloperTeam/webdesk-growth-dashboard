---
tier: 2
load_when: ["escalation-needed", "orchestrator-active"]
description: "When things don't go to plan: SLA breaches, model escalation, budget, schema/lock failures, human escalation."
---

# 05 — Escalation Paths

> Every escalation surfaces to a human. The orchestrator never acts unilaterally past a hard limit.

---

## Triggers

| Trigger                                      | Section                      |
| -------------------------------------------- | ---------------------------- |
| Gate SLA breached                            | § Gate SLA breaches          |
| Validator fails 3× on the same artifact      | § Repeated validator failure |
| Task escalates per the model ladder          | § Model escalation ladder    |
| Token/context budget approaching or exceeded | § Budget                     |
| Schema validation fails on write             | § Schema failure             |
| Lock cannot be acquired                      | § Lock contention            |
| Agent invocation fails (API error)           | § Agent invocation failure   |
| Post-launch health check fails (rollback)    | § Post-launch failure        |
| Override exercised                           | § Override audit             |
| 3+ bugs in one sprint                        | § Quality flag               |
| Client gate stalls (client unresponsive)     | § Human escalation           |

---

## Gate SLA breaches

Per-gate SLAs are in `_contracts/gate-format.md` (client-involved gates 72h; internal 24–48h). SLA timers compute against `project.json.timezone`.

- **+12h:** append `gate_reminder_sent`; remind the primary approver.
- **At SLA expiry:** append `gate_escalated`; record `escalation_log` entry; notify the backup approver; surface:
  > "Gate [G-id] expired [N]h ago. Primary: [name]. Backup: [name]. NOTIFY_BACKUP / ESCALATE / EXTEND [h] / OVERRIDE?"
- **+48h:** status → BLOCKED, page PM lead.
- **+72h:** escalation review.

Manual escalation model — you surface in chat; the human picks. You never auto-decide a gate.

---

## Repeated validator failure

Same validator fails 3× on the same artifact in a sprint:

1. Halt auto-retry (AI hallucinating non-fixes is a known failure mode).
2. Surface the last 3 errors and offer: `INSPECT` / `OVERRIDE` (senior, logged) / `ESCALATE_MODEL` (per ladder below) / `REOPEN_SPEC` (the spec/contract may be wrong → back to PM).

---

## Model escalation ladder

Reference: `_spine/shared-knowledge/model-policy.md`. Ladder: `haiku → sonnet → opus`.

Escalate the task one tier when any holds:

- the task failed twice,
- a complexity flag is set on the project (>1 external system, new datastore, async/cron sync, multi-tenancy, two-way sync w/ conflict resolution),
- Code Review rejects the same issue twice.

Pass `escalate: opus` to the agent **for that task only**; log `audit_log` with the reason (cost is visible). De-escalate to the default once the hard part is solved. Examples that escalate to Opus: a sync design that fails contract tests twice; a 3rd-retry debugging loop on a watermark-resume bug; an architectural review of a large PR. Never let a developer pin everything to Opus — explain the policy and decline.

---

## Budget

### Context budget (the 200K-error fix)

At >90% context usage: halt before invoking the next agent; write `HANDOFF.md` immediately; `/compact`; drop finished files. If still tight, end the session cleanly and resume fresh. Never silently truncate state. (context-budget.md Rule 5.)

### Token budget

- **≥80% used:** append `token_threshold_alert`; surface at next session start: "Token budget at [X%]. Remaining stages ~[Y]. CONTINUE / INCREASE_CAP / OPTIMIZE / HALT?"
- **≥90% used:** surface BEFORE invoking the next agent; do not proceed without explicit approval.
- **Exceeded** (`used + estimate > cap`): HALT, append `budget_exceeded`, surface: "Used [X]/[Y]. Cannot invoke [agent]. INCREASE_CAP / HALT / OPTIMIZE?"

API-console daily caps surface as API errors — relay cleanly, do not retry blindly.

---

## Schema failure

Write fails schema validation → ABORT the write (state stays consistent), append `schema_validation_failed` with the errors, surface: "Write to [artifact] rejected: [errors]. INSPECT_OUTPUT / RETRY_WITH_AGENT / MANUAL_FIX?"

---

## Lock contention

Held and not expired → wait 30s, retry once → still held → surface holder + expiry. Past expiry → safe takeover with a logged warning. Never force-acquire.

---

## Agent invocation failure

API error / timeout / rate limit → capture, append `agent_invocation_failed`, retry once with backoff → second failure → surface: "Agent [name] failed twice: [error]. WAIT [min] / RETRY_DIFFERENT_MODEL / ESCALATE?" Rate limit → WAIT; context-too-long → have the agent split the task; invalid key → ops issue, escalate (not a project issue).

---

## Post-launch failure

Delivery Head's post-deploy health check fails → auto-rollback runs (backup restored), append `auto_rollback_triggered`, surface immediately: "ROLLBACK EXECUTED for [project]. Health check failed: [details]. Previous release restored." Create a P1 bug; `project.status` stays `launching`; block further deploys until the P1 is resolved.

---

## Override audit

Each override logs full justification and flags the project for weekly review. >1 override on a project → surface proactively as a process signal.

---

## Quality flag

3+ bugs reported in one sprint → append `quality_flag_raised`, surface: "Sprint [id] has [N] bugs (>3). REWORK_SPRINT / ADJUST_ESTIMATES / INSPECT_AGENT_OUTPUT?" Process signal, not auto-action.

---

## Human escalation

Some things only a human resolves:

- **Client gate stalled** (G-Contracts / G-Schema / G2 / G6 — client unresponsive past SLA): the human PM owns chasing the client. Surface the stall, the days open, and what's blocked. Do not fabricate client approval to keep moving.
- **Unverified external-API surface** (e.g. DDI Inform endpoint/auth/rate-limit unknown): mark `verify-at-discovery`, build against the documented contract + a mock, and escalate to the PM to confirm sandbox credentials. Never code from a guessed endpoint.
- **API key invalid / infra down:** ops escalation, not a project decision.

---

## What the orchestrator NEVER does on its own

1. Auto-approve a gate. 2. Skip a prerequisite silently. 3. Auto-fix a bug. 4. Delete `audit_log` entries. 5. Decrement `project.version`. 6. Bypass schema validation. 7. Force-acquire a lock. 8. Proceed past the budget cap without approval. 9. Mark a client gate approved without captured client evidence. 10. Auto-deploy without a tested backup/rollback.

---

Last reviewed: 2026-06-30 (initial Node.js build)
Next review due: 2026-09-30
