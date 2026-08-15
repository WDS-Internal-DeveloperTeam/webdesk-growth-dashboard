---
tier: 2
load_when: ["planning", "g1", "architect-active", "pm-active"]
description: "Project-local pointer to the canonical RFC template. Copy _contracts/rfc-template.md to rfcs/RFC-NNNN-slug.md and fill it in."
---

# RFC template — pointer

This is the project-local copy pointer. The **canonical RFC template lives at
`_contracts/rfc-template.md`** — copy it to `rfcs/RFC-NNNN-slug.md` and fill it
in. Point, don't duplicate.

**When an RFC is written:** raise an RFC _before deciding_ on any change to
**scope, architecture, an integration/API contract, the DB schema, or the stack**.
The RFC is where the trade-offs are argued and reviewed ahead of commitment. An
approved RFC typically produces an ADR (`adr-template.md`).

Because an RFC can change scope or estimate-bearing architecture, it may trigger
a **G1 RENEGOTIATE** — a re-estimate and re-approval of the plan rather than a
silent course change. Number sequentially (`RFC-0001`, `RFC-0002`, …).

Last reviewed: 2026-06-30 by Claude (initial build)
