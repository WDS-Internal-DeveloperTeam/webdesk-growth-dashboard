---
tier: 2
load_when: ["g1_5", "architecture", "architect-active"]
description: Architecture Decision Record — the durable record of a final architecture decision. Produced at G1.5 (or from an accepted RFC).
---

# ADR Template — Architecture Decision Record

> An ADR records **one** architecture decision and the context that forced it, so future readers understand _why_ the system is shaped the way it is. ADRs are immutable once accepted — you don't edit a decision, you supersede it with a new ADR. They are produced at **G1.5** (Architecture Review) and may also result from an accepted **RFC**. ADRs live in the workspace under `decisions/` and are numbered sequentially.
>
> Copy this file to `decisions/ADR-NNNN-short-slug.md`, fill it in, set its `status`.

---

## ADR-[NNNN]: [Short title of the decision]

|                   |                                                      |
| ----------------- | ---------------------------------------------------- |
| **Number**        | ADR-[NNNN]                                           |
| **Title**         | [Short, specific — name the decision, not the topic] |
| **Date**          | [2026-06-30]                                         |
| **Status**        | [proposed                                            | accepted | deprecated | superseded] |
| **Supersedes**    | [ADR-NNNN, if any]                                   |
| **Superseded by** | [ADR-NNNN, if any]                                   |
| **Deciders**      | [tech lead / architect / names]                      |

---

## Context

[The forces at play: requirements, constraints, the problem this decision resolves. State the facts neutrally — what must be true, what we know, what we don't (flag unverified external-API assumptions explicitly). For middleware, name the systems, entities, cadence, and load that pressure the decision.]

Examples of decisions this records: sync pattern (cron vs webhook per source), queue choice (node-cron vs BullMQ+Redis), conflict-resolution policy for two-way sync, datastore/ORM selection, caching/rate-limit strategy, tenancy data-model approach, idempotency strategy for webhooks.

---

## Decision

[The decision, stated plainly and actively: "We will …". One decision per ADR. Include the specifics that make it actionable — the cron cadence, the retry cap, the conflict rule, the index, the API version pinned.]

---

## Consequences

### Positive

- [What gets better / easier / safer because of this]

### Negative

- [What gets harder / more expensive / constrained — every real decision has a cost; name it]

### Risks

- [What could go wrong, and how it's monitored/mitigated. Link risk IDs and any fitness test or alert that guards this decision.]

---

## Alternatives Considered

> At least one real alternative. "We considered nothing else" usually means the decision wasn't actually made.

### [Alternative 1]

- **What it was:** [ ]
- **Why rejected:** [ ]

### [Alternative 2]

- **What it was:** [ ]
- **Why rejected:** [ ]

---

## Related RFC

[If this decision came out of a change-request discussion, link the RFC that contains the full reasoning trail.]

- **RFC:** [rfcs/RFC-NNNN-... | none]

---

## Enforcement

[How the system keeps this decision true over time — e.g. an architecture fitness test (`architecture-tests/`), a CI check, a lint rule, an alert. A decision with no enforcement tends to erode.]

- **Fitness test / check:** [ ]

---

Last reviewed: 2026-06-30 (initial Node.js build)
