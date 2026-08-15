---
tier: 2
load_when: ["planning", "g1", "pm-active"]
description: The RFC / change-request flow. A mid-project change → RFC (propose/discuss) → if accepted, emits an ADR and triggers a G1 RENEGOTIATE re-estimate. New for the Node.js system — did NOT exist in the Shopify donor.
---

# 08 — RFC / Change-Request Flow

> Any change to an approved spec, contract, schema, architecture, or stack **after** G1 goes through an RFC. The RFC is the proposal-and-discussion artifact; if it's accepted it produces an **ADR** (the durable decision record) and, if it shifts scope/effort, it **triggers a G1 RENEGOTIATE re-estimate** (a new estimate→ticket). This flow is **new for the Node.js Delivery System — it did not exist in the Shopify donor**, where change was handled informally. It exists because in ERP↔store middleware a change to one field mapping or sync cadence can ripple through contracts, schema, and the sync engine; that ripple must be reasoned about before it's built.

References: `_contracts/rfc-template.md`, `_contracts/adr-template.md`, `_contracts/gate-format.md` (decision semantics), `project-json.schema.json` (`rfcs[]`).

---

## When an RFC is required

Open an RFC for any of:

- A change to spec scope (add/remove/alter a deliverable).
- A change to an integration contract (a field mapping, a direction, a cadence, an auth model) — may re-open **G-Contracts**.
- A change to the data model (`data-model.md`) — may re-open **G-Schema**.
- A change to architecture (sync pattern, queue choice, conflict-resolution policy, caching) — may re-open **G1.5**.
- A stack change (DB/ORM/host/queue).
- A newly discovered constraint that invalidates a spec assumption (e.g. the ERP rate limit turns out stricter than assumed and "15-minute inventory" is no longer feasible).

Small in-scope corrections caught at a gate are handled by **REVISE** on that gate — they do not need an RFC. Use an RFC when the change moves scope, contract, schema, architecture, or effort.

---

## The flow

```
[change proposed]
   ↓
1. WRITE RFC  (copy _contracts/rfc-template.md → rfcs/RFC-NNNN-slug.md, status: proposed)
   - Context/problem, proposed change, options (incl. do-nothing) with trade-offs, impact table
   ↓
2. DISCUSS    (status: under-discussion) — reviewers weigh options
   ↓
3. DECIDE
   ├─ rejected  → status: rejected; log; done (status quo holds)
   └─ accepted  → status: accepted
        ↓
4. EMIT ADR   (copy _contracts/adr-template.md → decisions/ADR-NNNN-slug.md, status: accepted)
   - one decision, consequences, alternatives, enforcement (fitness test / alert)
   - link RFC ↔ ADR
        ↓
5. GATE IMPACT — if scope/effort moves:
   - TRIGGER G1 RENEGOTIATE re-estimate → new estimate→ticket recorded; project status → on-hold during scope review
   - re-open G-Contracts / G-Schema / G1.5 as the impact table indicates
        ↓
6. UPDATE spec version + project.json + audit_log
```

The PM Agent authors the RFC and the resulting ADR and records the gate impact. The PM Agent does **not** approve the RFC or the gate — a human decides (approver ≠ doer).

---

## Filling the RFC (the parts that matter most)

- **Options with trade-offs.** Always include the proposed option **and** the do-nothing baseline. An option with no downside listed is under-analyzed — reject and re-ask.
- **Impact table** (from the template): scope, estimate (+/- hours vs current G1 ticket), timeline, risk, **contracts affected** (which IC-… IDs; re-open G-Contracts?), **schema affected** (re-open G-Schema?), observability/runbooks. For middleware, name the systems, entities, and cadence touched.
- **Gate Impact section** — the load-bearing question: _does this re-open a gate?_ Answer Yes/No for G1 RENEGOTIATE, G-Contracts, G-Schema, G1.5 explicitly.

---

## When acceptance triggers G1 RENEGOTIATE

Set `triggers_reestimate = true` and re-enter G1 when the accepted change moves effort or scope materially. On RENEGOTIATE (gate-format.md decision semantics):

- Project status → `on-hold`; the human PM coordinates scope review with the client.
- A **new estimate→ticket** is recorded at G1 (the new audit anchor).
- Re-run `04-estimation-framework.md` for the changed scope, including the 80hr / G1.5-trigger check (a change can newly trip G1.5 — e.g. adding a second external system or two-way sync).

If the change is accepted but does **not** move effort/scope (e.g. a clarified conflict rule with the same hours), record the ADR and update the spec without a re-estimate — note `triggers_reestimate = false`.

---

## Recording to project.json

```json
"rfcs": [
  {
    "id": "RFC-0003",
    "title": "Pull pricing from Inform endpoint instead of computing locally",
    "status": "accepted",
    "ref": "rfcs/RFC-0003-inform-pricing-endpoint.md",
    "resulting_adr": "ADR-0007",
    "triggers_reestimate": true
  }
]
```

Plus an `audit_log` entry for the RFC open, decision, ADR emission, and any re-estimate ticket. If a contract changes, update the corresponding `integration_contracts[]` entry (back to `draft` until re-approved at G-Contracts).

---

## Anti-patterns

1. **Verbal scope change.** Verbal agreements never modify scope — write the RFC.
2. **Accepting an RFC with no ADR.** An accepted architecture/contract/schema change without an ADR loses the rationale.
3. **Skipping the re-estimate** when effort moved — the G1 ticket is the budget anchor; it must stay honest.
4. **One RFC bundling many unrelated changes.** One coherent change per RFC; split the rest.
5. **No do-nothing option.** Every RFC compares against the baseline of not acting.
6. **Forgetting downstream gates.** A contract or schema change re-opens G-Contracts / G-Schema; don't let the change land in code first.

---

Last reviewed: 2026-06-30 (initial Node.js build)
Next review due: 2026-09-30
