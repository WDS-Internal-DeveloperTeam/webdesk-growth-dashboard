---
tier: 2
load_when: ["intake", "g0", "pm-active"]
description: G0 intake for the Node.js Delivery System. Captures integration targets, data sensitivity, timezone, tenant mode, host target. If a spec.md exists, read its frontmatter first and ask only what's missing.
---

# 07 — G0 Intake Gate

> G0 validates that the spec carries the fields downstream agents need before any G1 plan. For the Node.js system the load-bearing intake fields are **integration targets, data sensitivity, timezone, tenant mode, and host target** — plus the tech-stack layers. **Step 0: if a `spec.md` exists, read its frontmatter first and only ask what's missing.** G0 is an auto gate (`validate-spec` runs), but the PM gathers what's missing.

---

## Step 0 — Read `spec.md` frontmatter first (do not re-ask)

At session start, check for the project's `spec.md` (produced from Discovery / the SOW builder).

1. If present, read the frontmatter + body and ingest:
   - `project_type`, `build_context`, `integration_targets`
   - `timezone`, `tenant.mode` / `tenant.master`, `host_target`, `data_sensitivity`
   - the Tech Stack table (§5) and Integrations table (§6)
2. Map ingested fields to the intake checklist below. **Do not re-ask anything the spec answers.**
3. If NOT present, run the abbreviated intake interview (below).

Surface to the developer:

```
spec.md detected. Pre-filled: N of M intake fields.
Outstanding: [the missing items only]
Proceed with abbreviated intake? [Y / full intake / cancel]
```

---

## Required intake fields (must be in the spec before G0 closes)

### Category 1 — Identity

- [ ] Project name, client slug, project ID
- [ ] `project_type` (integration-middleware / custom-app-build / frontend-tool / version-upgrade / maintenance)
- [ ] `build_context` (nodejs / nodejs+bigcommerce / nodejs+shopify)

### Category 2 — Integration targets _(load-bearing for middleware)_

- [ ] `integration_targets` — the exact external systems (e.g. `erp:ddi-inform`, `bigcommerce`)
- [ ] Per system: entities, direction(s), system-of-record, auth type, **sandbox availability (Y/N)**
- [ ] Conflict-resolution rule for any two-way entity
- [ ] Each unverified external-API specific flagged "verify-at-Discovery"

### Category 3 — Data sensitivity

- [ ] `data_sensitivity` (low / medium / high) — drives PII handling, secrets, encryption-at-rest depth

### Category 4 — Timezone

- [ ] `timezone` (IANA string, e.g. `America/Toronto`) — the operational clock for all cron, sync windows, timestamps, report boundaries. Stored UTC, displayed local; mirrors Dashboard Settings → Timezone.

### Category 5 — Tenant mode

- [ ] `tenant.mode` (per-client / master) and `tenant.master` (true if a cross-client master dashboard is in scope)
- [ ] If master: confirmed as a central app you host + where health data aggregates

### Category 6 — Host target

- [ ] `host_target` (local / aws / gcp / cloudflare / heroku / vps) — local-first by default; justified at G1.5 if non-trivial (e.g. on-prem ERP behind a VPN)

### Category 7 — Tech stack

- [ ] Every layer of the Tech Stack table filled, or written "TBD, decided at G-Schema/G1.5" — no blank layer

### Category 8 — Compliance / access

- [ ] Credentials handoff protocol (secure channel — 1Password / Vault / secure email)
- [ ] Repo + CI access plan; any "do not" rules specific to this client

---

## Hard-gate behavior

`validate-spec` runs at G0 (gate-format.md §G0). Completeness is judged against the categories above:

- **≥ 80% present** → G0 may close with an **Open Items** log (each item has owner + due date; auto-escalates if the due date passes). Categories 2, 4, 5 are usually hard requirements; sandbox access (Category 2) and some Category 8 items may lag but must arrive before G3 (scaffold).
- **< 80% present** → G0 stays open; **no G1 progression.**

No bypass via "we'll get it later." A bypass requires an explicit `OVERRIDE` in `audit_log` with reason, an approver who is not the requester (Tech Lead / Pilot Lead), an expiration date, and a risk acknowledgment. The override auto-revokes at expiration; if the item is still missing, the project halts.

---

## Abbreviated intake interview (when no spec exists, or "full intake")

One batched round, asking only missing items. Draw from `03-clarification-questions.md`. Skeleton:

```
WebDesk Node.js — Project Intake — [Client]
Internal PM: [name]   Date: [date]

IDENTITY
  - Project name / client slug / project type / build context?

INTEGRATION TARGETS
  - Which ERP/CRM + which store? Entities + direction + system-of-record per entity?
  - Auth type + credential location per system? Sandbox available now (Y/N)?
  - Conflict-resolution rule for any two-way entity?

DATA SENSITIVITY
  - low / medium / high?

TIMEZONE
  - IANA timezone (drives all cron + activity)?

TENANT MODE
  - per-client only, or per-client + master dashboard? If master: hosting + aggregation?

HOST TARGET
  - local / aws / gcp / cloudflare / heroku / vps? Any on-prem/VPN?

TECH STACK
  - Framework / DB / ORM / storage / queue / frontend — defaults OK or deviations?

COMPLIANCE / ACCESS
  - Secure credentials channel? Repo + CI access plan? Any client "do not" rules?
```

Saved as `<workspace>/intake/intake-interview-completed.md`.

---

## Validation on spec ingestion (before trusting the spec)

1. `timezone` is a valid IANA string (else flag — cron correctness depends on it).
2. `integration_targets` non-empty for an integration-middleware project (else the project type is wrong).
3. `tenant.mode` present; if `master: true`, master hosting confirmed.
4. Any UI deliverable is HTML-mockup-first (D-DES-01) — no Figma/PSD as the deliverable.
5. Tech Stack has no blank layer.
6. Every unverified external-API specific is flagged, not silently defaulted.

If any check fails: halt, surface to the developer, do NOT proceed to G1.

---

## Anti-patterns

1. "Start building, we'll get the sandbox later." Sandbox status is a Category-2 intake fact; lagging access becomes a gated, dated open item — not a silent assumption.
2. Placeholder values to pass the gate (lorem ipsum, empty `integration_targets`, "TBD" with no decided-at gate) — detect and reject.
3. Re-asking fields the spec already answers (Step 0 prevents this).
4. Closing G0 with a blank timezone or tenant mode — both are hard requirements here.
5. Treating Category 2 (integration targets/auth/sandbox) as optional — it is the spine of a middleware project.

---

Last reviewed: 2026-06-30 (initial Node.js build)
Next review due: 2026-09-30
