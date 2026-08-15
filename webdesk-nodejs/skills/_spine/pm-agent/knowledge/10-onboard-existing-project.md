---
tier: 2
load_when: ["pm-active", "onboarding", "pt-maintenance"]
description: How the PM Agent onboards an EXISTING repo into the delivery system using Graphify output — reconstruct spec/ADRs/project.json/contracts as validated drafts, then run as maintenance. Graphify is an input, never the source of truth.
---

# 10 — Onboard an Existing Project (from Graphify)

> Some projects arrive as an existing codebase, not a greenfield build — a legacy app WebDesk is taking over, or one built before this system existed. This is how you bring it under the delivery system. The developer runs `tools/scripts/init-project.sh --client X --onboard-existing --repo <path> --graphify <path>`; then you (PM Agent) reconstruct the governance docs the system runs on. This is the concrete procedure behind decision D-011 (Graphify is onboarding-only).

---

## The three things to keep straight

1. **The repo is the code. Graphify is a map of the code. The governance docs are the source of truth.** The skill's agents work on the **actual repo**. `graph.json` is a navigation index — you _query_ it to find the right files, you don't treat it as the code and you never auto-load it into context (it would blow the budget; see `context-budget.md`). The reconstructed `spec.md` / ADRs / `project.json` become the source of truth once validated.
2. **Graphify tells you what the code IS and HOW it's wired — not what it's SUPPOSED to do or WHY.** Business intent and past decisions are not in the graph. So everything you reconstruct is a **draft to validate with the client/team**, not ground truth.
3. **Onboarding is not a rebuild.** You are not running Discovery→G6 to build something. You are reverse-engineering enough governance to _maintain_ the app. It lands in the `maintenance` project-type.

---

## What to keep from the Graphify output

Graphify produces `graph.html`, `graph_report.md`, `graph.json`, and supporting folders. Keep only:

- **`graph_report.md`** — the human summary you read first.
- **`graph.json`** — the queryable index; keep it in the repo (Graphify's `graphify-out/` is fine). Query it to locate files/dependencies; do not paste it into context.

`graph.html` is a human viewer (optional). The other folders are Graphify's regenerable internals — ignore them for onboarding.

---

## Procedure

### Step 1 — Read the map, not the whole repo

Read `graph_report.md` end to end. Query `graph.json` for structure: entry points, modules, the dependency shape, the datastore/ORM in use, external calls (what the code talks to), and the HTTP surface. Read **selected** actual source files the report flags as central — scoped, on demand — to confirm. Do **not** read the whole repo; that's what the graph is for.

### Step 2 — Reconstruct `spec.md` (draft)

Write a draft `spec.md` from `_contracts/spec-template.md`, filled from the code:

- What the app does (inferred from routes/services/jobs).
- Tech Stack section — read the real runtime/framework/DB/ORM/frontend from the graph, not assumed defaults.
- Integrations section — every external system the code calls (each external API = **verify-at-discovery**, NODE-008).
- Timezone/tenancy if discernible.
  Mark the whole file **"RECONSTRUCTED FROM CODE — VERIFY WITH CLIENT"** at the top. Gaps (the _why_, the intended behavior, edge cases) are listed as open questions, not guessed.

### Step 3 — Reconstruct ADRs (draft)

For each load-bearing decision the code reveals (datastore choice, auth model, sync vs request/response integration, queue, module boundaries), write a draft ADR (`_contracts/adr-template.md`) with status `proposed` and a note "inferred from existing code — confirm rationale." You are recording _what was decided_; the team confirms _why_.

### Step 4 — Reconstruct `project.json` + integration contracts

Fill `project.json` tech_stack + `integration_targets` from the graph. For each external system, draft an integration contract (`_contracts/integration-contract.schema.json`) from the real call sites — endpoint, auth, direction, and whether it's **sync** or **request/response** (`custom-app-build/knowledge/01-app-shapes.md`). Everything unverified stays `null` + verify-at-discovery. These are **drafts** until validated.

### Step 5 — Human/client validation (the gate)

The reconstructed `spec.md` is validated by the client/team before any ticket is worked — the same "spec is real" bar as G0, sourced from code instead of a SOW. On sign-off: set `project.json.onboarding.docs_reconstructed = true` and `client_validated = true`, append an `audit_log` `onboarding_validated` entry, move `stage` to `maintenance`. Until then, no ticket proceeds.

### Step 6 — Hand to maintenance

The project now runs the normal `maintenance` flow (`nodejs/projects/maintenance/`): each approved estimate → ticket → develop → G4 → G6, health-scored. From here the skill has taken it over.

---

## Keeping Graphify fresh (do NOT do it per ticket)

The graph is a convenience index, never the source of truth, so staleness never affects correctness — a stale graph just means you fall back to reading the (always-authoritative) actual code. So:

- **Preferred:** install Graphify's **git post-commit hook** so the graph refreshes automatically on merges — zero manual effort, the map stays current.
- **Or:** regenerate on demand (before a large change, or when onboarding a new developer).
- **Do not** make "regenerate Graphify" a mandatory per-ticket step — that's overhead for no correctness gain.

What you **must** update every ticket is the governance docs, not the graph: `spec.md` if scope changed, a new ADR for a real decision (or an RFC first if it's a proposal — `08-rfc-change-request.md`), and `project.json` state. That discipline is the skill's job and is not optional.

---

## Anti-patterns

1. **Treating the graph as the source of truth.** It is an index. Code + validated governance docs are truth.
2. **Loading `graph.json` into context.** Query it to find files; never paste it in. It's large and will blow the budget.
3. **Shipping the reconstructed spec as fact.** It's a draft inferred from code; the client validates it before work starts.
4. **Importing Graphify output into the skill.** It belongs to the _project workspace/repo_, never the generic skill directory.
5. **Onboarding as a rebuild.** It's a maintenance takeover, not Discovery→G6.

---

Last reviewed: 2026-07-08 (v0.2.4 — onboarding-from-Graphify procedure)
