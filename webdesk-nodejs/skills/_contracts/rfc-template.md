---
tier: 2
load_when: ["planning", "g1", "g1_5", "pm-active", "architect-active"]
description: Request-for-Change proposal/discussion artifact. Sits BEFORE an ADR — an accepted RFC may produce one.
---

# RFC Template — Request for Change

> An RFC is a _proposal under discussion_. It is where a change to scope, architecture, contract, schema, or stack is reasoned about **before** anything is decided. An ADR records the final decision; an RFC is the conversation that leads to it. If the change shifts scope/effort, the RFC flags a **G1 RENEGOTIATE re-estimate**. RFCs live in the workspace under `rfcs/` and are referenced from `project.json.rfcs[]`.
>
> Copy this file to `rfcs/RFC-NNNN-short-slug.md`, fill it in, and set its `status`.

---

## RFC-[NNNN]: [Short title]

|                                |                                            |
| ------------------------------ | ------------------------------------------ |
| **ID**                         | RFC-[NNNN]                                 |
| **Title**                      | [Short, specific]                          |
| **Date**                       | [2026-06-30]                               |
| **Author**                     | [name / role]                              |
| **Status**                     | [proposed                                  | under-discussion | accepted | rejected | superseded] |
| **Supersedes / superseded-by** | [RFC-NNNN, if any]                         |
| **Affected gate(s)**           | [G1 / G1.5 / G-Contracts / G-Schema / ...] |

---

## 1. Context / Problem

[What situation prompts this? What is wrong, missing, or newly required? Be concrete — cite the failure, the client request, the bug ID, the constraint, or the discovery. State why the status quo is insufficient. For middleware, name the system(s) and entities affected (e.g. "Inform now exposes a pricing endpoint we should pull instead of computing locally").]

---

## 2. Proposed Change

[The change being proposed, in enough detail that a reviewer can evaluate it. What gets added/removed/altered — in the sync engine, a contract, the data model, the dashboard, the stack, or the scope.]

---

## 3. Options Considered (with trade-offs)

> Always present at least the proposed option and the do-nothing baseline. Trade-offs are required — an option with no downside listed is under-analyzed.

### Option A — [name] _(proposed)_

- **Summary:** [ ]
- **Pros:** [ ]
- **Cons / risks:** [ ]
- **Effort:** [rough hours]

### Option B — [name]

- **Summary:** [ ]
- **Pros:** [ ]
- **Cons / risks:** [ ]
- **Effort:** [rough hours]

### Option C — Do nothing / defer

- **Consequence of not acting:** [ ]

---

## 4. Impact

| Dimension                  | Assessment                                                    |
| -------------------------- | ------------------------------------------------------------- |
| **Scope**                  | [what moves in/out of scope]                                  |
| **Estimate (effort)**      | [+/- hours vs current G1 ticket]                              |
| **Timeline**               | [milestone shift, if any]                                     |
| **Risk**                   | [new/changed risks; link risk IDs]                            |
| **Contracts affected**     | [IC-… contract IDs that change; do they re-open G-Contracts?] |
| **Schema affected**        | [does data-model.md change → re-open G-Schema?]               |
| **Observability/runbooks** | [new alerts, dashboards, or runbook changes needed?]          |

---

## 5. Decision

[Filled when status → accepted/rejected. Who decided, when, and the one-line rationale. If accepted, list the concrete follow-ups (tickets, ADR, contract/schema re-approval).]

- **Decided by:** [ ]
- **Decided at:** [ ]
- **Outcome:** [accepted | rejected | superseded] — [rationale]

---

## 6. Resulting ADR

[If this RFC produced an architecture decision, link it. The ADR is the durable record; this RFC is the reasoning trail behind it.]

- **ADR:** [decisions/ADR-NNNN-... | none]

---

## 7. Gate Impact

> The load-bearing question: does this change re-open a gate?

- **Triggers G1 RENEGOTIATE re-estimate?** [Yes/No] — [if Yes, a new estimate→ticket is recorded and `project.json.rfcs[].triggers_reestimate = true`]
- **Re-opens G-Contracts?** [Yes/No]
- **Re-opens G-Schema?** [Yes/No]
- **Re-opens G1.5 (architecture)?** [Yes/No]

---

Last reviewed: 2026-06-30 (initial Node.js build)
