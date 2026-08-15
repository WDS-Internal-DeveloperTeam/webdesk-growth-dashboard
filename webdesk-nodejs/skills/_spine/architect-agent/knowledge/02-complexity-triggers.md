---
tier: 2
load_when: ["g1_5", "planning", "architect-active"]
description: The G1.5 complexity-trigger checklist and the 80hr threshold. How the PM decides to open G1.5, and what's in/out of an architecture pass. Read by the PM (to decide) and the architect (to confirm).
---

# 02 — Complexity Triggers (when G1.5 opens)

> G1.5 is conditional. It runs only when complexity warrants the cost of an architecture review. This file is the trigger checklist + how the **PM** decides to open G1.5 (the architect does not decide; it is invoked once the gate is open). Architecture-review budget = **80 hrs** (gate-format.md §G1.5).

---

## The trigger checklist (G1.5 fires if ANY hold)

Check each against the spec + estimate:

- [ ] **More than one external system** in `integration_targets` (e.g. an ERP _and_ a store).
- [ ] **A new datastore is introduced** (a project standing up PostgreSQL/Sequelize from scratch qualifies).
- [ ] **Async work:** queues, jobs, or **cron-scheduled sync**.
- [ ] **Multi-tenancy**, or **auth beyond a single static key** (JWT + per-module RBAC + per-tenant scoping qualifies).
- [ ] **Two-way sync with conflict resolution.**
- [ ] **Throughput needs caching / a rate-limit strategy.**
- [ ] **Estimate > 80 hrs.**

If none hold, **G1.5 is skipped** and the architect is not invoked. Record G1.5 `skipped` with the reason ("single system, one-way, no new datastore, single-key auth, <80hr"). Most maintenance and simple frontend-tool tickets skip it.

---

## How the PM decides (procedure)

At G1 planning, after estimating (`pm-agent/knowledge/04-estimation-framework.md`):

```
g1_5 = false
g1_5 |= integration_targets.length > 1
g1_5 |= new_datastore_introduced
g1_5 |= async_or_queue_or_cron_sync
g1_5 |= multitenant OR auth_beyond_single_key
g1_5 |= two_way_sync_with_conflict_resolution
g1_5 |= throughput_needs_caching_or_ratelimit
g1_5 |= total_estimate_hours > 80

if g1_5:
    open G1.5 BEFORE G-Contracts / G-Schema
    record which triggers fired in project.json + the G1 plan
else:
    record G1.5 skipped + reason
```

The 80hr line is **one trigger among several** — a 40hr project with two external systems and two-way sync still runs G1.5. The DDI Inform ↔ BigCommerce pilot fires several (two external systems, new datastore, cron sync, two-way sync, multi-tenant) regardless of hours.

---

## Sequencing

G1.5 sits between G1 and the client gates:
`G1 → [G1.5] → G-Contracts → G-Schema → ...`

This ordering is deliberate: the architecture (sync pattern, conflict rules, contracts, data-model) must be designed **before** the client approves the contracts and schema, because the architect's drafts are exactly what the client approves at G-Contracts / G-Schema.

---

## What's IN an architecture pass

- Context diagram, component breakdown, stack justification.
- Integration contracts per system (draft), data-flow + sync strategy, NFRs, risks.
- The first ADRs and the fitness-test plan.
- Draft `data-model.md` handed to Backend.

## What's OUT (don't gold-plate the architecture)

- Production code (Backend).
- Estimation/scope decisions (PM owns; the architect informs).
- Client approval of contracts/schema (human PM at G-Contracts/G-Schema).
- Designing for triggers that didn't fire — e.g. don't design a multi-region caching tier for a single-store, single-tenant, sub-80hr build.

---

## When a mid-project change newly trips G1.5

A trigger can appear after launch of work — e.g. an RFC adds a second external system or introduces two-way sync. In that case the RFC's Gate Impact (`pm-agent/knowledge/08-rfc-change-request.md`) re-opens G1.5; the architect is re-invoked for the changed scope only.

---

## Anti-patterns

1. **Running G1.5 on a project with no trigger** — wasted opus budget; record skipped instead.
2. **Skipping G1.5 because the estimate is < 80hr** while two external systems and two-way sync are in scope — the 80hr line is not the only trigger.
3. **Opening G-Contracts/G-Schema before G1.5** when G1.5 is required — the architecture must come first.
4. **The architect deciding whether G1.5 runs** — the PM decides from this checklist; the architect confirms and executes.

---

Last reviewed: 2026-06-30 (initial Node.js build)
Next review due: 2026-09-30
