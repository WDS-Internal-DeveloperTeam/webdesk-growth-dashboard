# ADR-0019 — Dashboard Business Agents Versus Node.js Delivery Roles

**Status:** Accepted (formalizing an already-resolved decision — see below)

## Context

Two distinct concepts share overlapping vocabulary and have caused confusion before: the WebDesk Node.js Delivery System's own software-delivery roles (PM, Architect, Backend, Frontend, Designer, QA, Code Review, Delivery Head — the roles that build and review the dashboard application itself) and the dashboard's fifteen business/delivery agents (Website Growth Director, Site Intelligence and Inventory Agent, Search Strategy Agent, etc. — product data the finished dashboard stores and governs). This was flagged as open-question OQ-04 in the original compatibility review.

## Decision

These are two separate, never-merged taxonomies:

- **Software-delivery roles** (taxonomy 1) are defined by the base skill's `_spine/*/SKILL.md` files and build/review the dashboard application. This project profile configures how they work on this project; it does not add new roles or rename existing ones.
- **Dashboard business agents** (taxonomy 2) are product data — records the finished dashboard stores and governs through its own Agent Directory (module #26) and Agent Specification Library (module #27), in the approved nineteen-section specification format confirmed by the registered Agent Specification Batch 1.
- The naming collision between the two "Code Review Agent" concepts (one per taxonomy) is a known, documented ambiguity to actively watch for, not a merge signal — when a task mentions "Code Review Agent" without further context, which taxonomy is meant must be confirmed, never assumed.

This resolution is independently corroborated (not just asserted) by Agent Specification Batch 1's own `00_README.md`, which names the nineteen-section format explicitly and never attempts to fold its four supplied agents into the software-delivery roster.

## Alternatives considered

- **Merging the two into one taxonomy** — rejected: the two serve fundamentally different purposes (building the application vs. being product data the application manages) and merging them would create exactly the confusion this ADR exists to prevent.

## Consequences

Building the dashboard code that stores and displays business-agent records (taxonomy 2) is software-delivery-role work (taxonomy 1) — e.g., a Backend-role engineer implements the Agent Directory module; that engineer is not thereby "one of" the fifteen business agents.

## Security considerations

None specific to this ADR beyond the RBAC implications already covered in ADR-0010 — business-agent records are subject to the same access-control model as any other dashboard data.

## Operational considerations

None beyond standard module implementation for the Agent Directory/Specification Library modules.

## Validation method

Reviewed against `SKILL.md §6`, profile `knowledge/00-scope-and-precedence.md §5`, and `canonical-inputs/agent-specifications-batch-1/00_README.md`.

## Approval gate

G1 (architecture approval) — already effectively resolved prior to Phase 0; this ADR formalizes the resolution into the project's own decision record.

## Related dashboard requirements

`03_Detailed_Module_Specifications.md` (Agent Directory, Agent Specification Library modules).

## Related skill rules

`SKILL.md §6`; profile `knowledge/00-scope-and-precedence.md §5`.

## Open setup values

Batches 2–4 of the business-agent specifications (the remaining eleven of fifteen total) have not yet been supplied — a future-supply item, not an ambiguity about which taxonomy governs, and not blocking this ADR.
