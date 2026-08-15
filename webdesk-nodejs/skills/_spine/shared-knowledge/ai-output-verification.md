---
tier: 2
load_when: ["output-verification"]
description: "How to verify what agents produce. Self-check + the mandatory 'state which KB files you consulted' rule."
---

# AI Output Verification

> AI is a tool, not an oracle. Most output is good; some is confidently wrong in ways hard to spot — especially external API surfaces (ERP/store endpoints) we haven't verified. Verification is what turns fast into fast-and-reliable. Nothing ships without human verification (persona).

---

## Three verification layers

### Layer 1 — Deterministic (linters, validators, tests)

- Code: ESLint + Prettier pass? `node --check` / `tsc --noEmit`? Unit + integration tests green?
- Data/artifacts: validates against its schema (`project-json.schema.json`, `integration-contract.schema.json`, `health-score.schema.json`)?
- Migrations: dry-run clean, reversible?

Fast, runs in CI. Catches syntax, schema, type errors. **Misses** hallucinated-but-syntactically-valid APIs and semantic errors.

### Layer 2 — AI cross-check (Code Review Agent)

- Does this ERP/store endpoint, ORM method, or Express/Node API **actually exist**? (Hallucinated API surface is the #1 risk for this system.)
- Does it violate the `nodejs` forbidden rules or the security baseline?
- Does it respect controller/service/repository boundaries (no DB access outside repositories)?

Catches hallucinated APIs, forbidden patterns, semantic security issues, layering violations. **Misses** judgment calls.

### Layer 3 — Human review (senior dev / QA lead)

- Right approach for this client/scope? Over-engineered? Better alternative? Matches the client-approved contract + data model?

---

## The mandatory rule: state which KB files you consulted

> Every agent, on every substantive output, ends with a one-line **"Consulted:"** list of the KB files / contracts / docs it relied on.

Why: it makes the reasoning auditable, exposes when an answer was produced from memory instead of the KB (a hallucination risk), and lets the human verify against the right source fast.

Format:

```
Consulted: nodejs/knowledge/intelligence/integration-intelligence.md,
           _contracts/integration-contract.schema.json,
           integration-contracts/ddi-inform.md (client-approved),
           [DDI Inform API docs — UNVERIFIED, verify-at-discovery]
```

Rules:

- List the actual files Read this turn — do not list files you didn't open.
- Mark any external API surface you couldn't verify as **UNVERIFIED / verify-at-discovery**. Never present a guessed endpoint as fact.
- If the output relied on no KB (pure orchestration/status), say `Consulted: project.json only`.
- An empty or fabricated "Consulted" line is itself a verification failure.

---

## Self-check before every response (from persona)

1. Any unverified claims — especially ERP/store endpoints, auth, rate limits, ORM methods?
2. Any filler/padding?
3. Sources cited (the "Consulted" line + inline `Per <file> rule <id>` citations)?
4. Trade-offs surfaced honestly?
5. Pushed back where warranted?
6. Specific enough to act on (a file, a function, a field — not "improve performance")?
7. As short as it can be while useful?

Any "no" → fix before responding.

---

## What verification catches per artifact

| Artifact             | Verify                                                                                                                               |
| -------------------- | ------------------------------------------------------------------------------------------------------------------------------------ |
| Integration contract | each field validates vs schema; endpoint/auth marked verified or `verify-at-discovery`; cadence + direction + conflict rule explicit |
| `data-model.md`      | migrations reversible; indexes/constraints present; no raw SQL outside repositories; client-approved at G-Schema                     |
| Sync job code        | idempotent; watermark committed in a transaction; overlapping/missed-run handled; failure modes from the library covered             |
| Express route        | authz (BOLA + function-level) server-side; input validated at boundary; response serialized through a DTO                            |
| Test claim           | the test actually ran and passed — never claim green without evidence                                                                |

---

## Anti-patterns

1. Claiming a test passed without running it. 2. Presenting a guessed ERP/store endpoint as real. 3. Omitting the "Consulted" line. 4. Citing "best practice" instead of a specific rule/file. 5. Listing KB files you didn't actually open.

---

Last reviewed: 2026-06-30 (initial Node.js build)
Next review due: 2026-09-30
