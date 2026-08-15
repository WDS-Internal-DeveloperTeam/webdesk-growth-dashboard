---
tier: 2
load_when: ["g1_5", "architect-active", "planning"]
description: "Project-local pointer to the canonical ADR template. Copy _contracts/adr-template.md to decisions/ADR-NNNN-slug.md and fill it in."
---

# ADR template — pointer

This is the project-local copy pointer. The **canonical ADR template lives at
`_contracts/adr-template.md`** — copy it to `decisions/ADR-NNNN-slug.md` and fill
it in. Do not maintain a second copy of the body here; point, don't duplicate.

**When/why an ADR is written:** record an Architecture Decision Record when a
non-trivial, hard-to-reverse choice is made — stack, data model, sync pattern,
queue runtime, tenancy approach, an ERP adapter's transport. Produced at **G1.5**
(Architecture Review) or when an **accepted RFC** lands a decision that needs a
durable record. Number sequentially (`ADR-0001`, `ADR-0002`, …) and keep
superseded ADRs in place, marked superseded — the trail is the value.

Last reviewed: 2026-06-30 by Claude (initial build)
