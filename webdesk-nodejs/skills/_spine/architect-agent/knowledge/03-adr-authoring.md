---
tier: 2
load_when: ["g1_5", "architect-active"]
description: How to author ADRs per _contracts/adr-template.md — what decisions warrant an ADR, and the quality bar. ADRs are immutable once accepted; you supersede, not edit.
---

# 03 — ADR Authoring

> How the architect authors Architecture Decision Records at G1.5 (and how an accepted RFC produces one mid-project). One decision per ADR, with a real alternative and an enforcement. ADRs live in `decisions/ADR-NNNN-slug.md`, are numbered sequentially, and are **immutable once accepted** — you don't edit a decision, you supersede it with a new ADR. Use `_contracts/adr-template.md` verbatim.

---

## What warrants an ADR (the load-bearing decisions)

In Node middleware, author an ADR for each of these when the decision is non-obvious:

- **Sync pattern per source** — cron-pull/push vs webhook, per system (ERPs are usually poll/cron; the store may support webhooks for orders).
- **Queue choice** — node-cron vs BullMQ+Redis. Record the trigger to escalate (concurrency / retries / DLQ).
- **Conflict-resolution policy** for a two-way entity — source-of-record-wins / last-write-wins by timestamp / field-level merge.
- **Datastore / ORM selection** — PostgreSQL + Sequelize default; any deviation needs an ADR (approved at G-Schema).
- **Caching / rate-limit strategy** — when throughput pressures an upstream rate limit.
- **Tenancy data-model approach** — how per-client scoping and the master plane are modeled and enforced.
- **Idempotency strategy** — the key + processed-event log that makes re-processing and webhook replay safe.
- **Scheduler timezone source** — `project.json.timezone` as the single source of truth; reschedule-on-change behavior.
- **Host/connectivity** — e.g. on-prem ERP behind a VPN changing deploy + runbook design.

A decision that's just applying the default (Express, Postgres+Sequelize, node-cron for a single simple schedule) does **not** need an ADR — record it in `architecture.md` stack justification. ADR the choices that a future reader would otherwise ask "why?" about.

---

## How to author one (per the template)

Fill every section of `_contracts/adr-template.md`:

- **Title** — name the decision, not the topic. "Pull pricing from Inform on a 4h cron" not "Pricing".
- **Status** — `proposed` while G1.5 is open; `accepted` on Tech-lead CONFIRM.
- **Context** — the forces: requirements, constraints, load, cadence, and **explicitly flag unverified external-API assumptions** ("Inform rate limit unverified — confirm at discovery"). State facts neutrally.
- **Decision** — active and specific: "We will …" with the actionable specifics (the cron cadence, the retry cap, the conflict rule, the index, the pinned API version). **One decision per ADR.**
- **Consequences** — Positive / Negative / Risks. Every real decision has a cost — name it. Link the risk to its monitor/mitigation.
- **Alternatives Considered** — at least one real alternative with why it was rejected. "We considered nothing else" means the decision wasn't really made.
- **Related RFC** — link the RFC if the decision came from a change-request.
- **Enforcement** — how the system keeps the decision true: a fitness test (`architecture-tests/`), a CI check, a lint rule, or an alert. **A decision with no enforcement erodes.** This field ties the ADR to `04-fitness-test-planning.md`.

---

## Worked example (shape, not prescription)

```
ADR-0002: Use node-cron now; escalate to BullMQ+Redis when concurrency/retries/DLQ are needed
Status: accepted
Context: Pilot has 4 entities on simple per-entity schedules; no concurrency or DLQ need yet.
  Inform rate limits unverified (confirm at discovery). Over-building a queue now is wasted effort.
Decision: We will schedule sync with node-cron, one job per entity, skip-if-running overlap policy,
  timezone from project.json.timezone. We will migrate to BullMQ+Redis when any of: concurrent
  workers needed, retry-with-backoff + DLQ needed, or >N jobs. That migration is its own ADR.
Consequences:
  + Simplest thing that works; no Redis dependency yet.
  − No built-in retry/DLQ; a failed run waits for the next tick (acceptable at current cadence).
  Risks: a long Inform outage drops a run — mitigated by reconciliation catching the gap next run.
Alternatives: BullMQ+Redis now — rejected as premature for the current concurrency profile.
Enforcement: fitness test "queue retry caps / no unbounded retry"; alert on missed-run.
```

---

## Immutability & superseding

Once `accepted`, an ADR is not edited. If the decision changes (usually via an accepted RFC), write a **new** ADR that `Supersedes` the old one, and set the old one's `Superseded by`. This preserves the decision history — a future reader sees the evolution, not a rewritten past.

---

## Anti-patterns

1. **Multiple decisions in one ADR** — split them; each gets its own number and enforcement.
2. **No alternative** — usually means the decision wasn't actually made.
3. **No enforcement** — the ADR will erode; tie it to a fitness test or alert.
4. **Editing an accepted ADR** — supersede instead.
5. **ADR-ing the obvious default** — record defaults in `architecture.md`; reserve ADRs for the choices that need a "why".
6. **Hiding the cost** — every decision has a negative consequence; if you can't name one, you haven't analyzed it.

---

Last reviewed: 2026-06-30 (initial Node.js build)
Next review due: 2026-09-30
