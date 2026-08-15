---
tier: 2
load_when: ["delivery-head-active"]
description: "Output template."
---

# Handoff Guide Template

> The package the Delivery Head produces at delivery so the client (and the retainer team) can operate the middleware + dashboard. For headless middleware there is no end-user UI guide — the handoff is operational. Fill the brackets; delete sections that are genuinely N/A (and say why).

---

## 1. What was delivered

- **Project:** [name] ([project id])
- **Build context:** [nodejs | nodejs+bigcommerce | nodejs+shopify]
- **Integration targets:** [e.g. erp:ddi-inform, bigcommerce]
- **Stack:** Node 22 + Express + PostgreSQL + Sequelize; [React/Next dashboard | headless, no UI]; JWT auth; per-module VED RBAC.
- **Scope summary:** [what the middleware syncs, which direction, which entities, cadence].
- **Out of scope / deferred:** [list, with the RFC/warranty reference].

## 2. Architecture at a glance

- [1-paragraph + a link to `architecture.md`]. The sync engine is cron-scheduled, idempotent, resumable from per-entity watermarks, with reconciliation per run.
- Entities + direction + cadence (from the client-approved Integration Contract Registry):

  | Entity    | Direction   | Cadence  | Conflict rule |
  | --------- | ----------- | -------- | ------------- |
  | items     | [ERP→store] | [hourly] | [ERP wins]    |
  | inventory | …           | …        | …             |
  | orders    | [store→ERP] | …        | …             |

## 3. Operating the dashboard (if a UI was delivered)

- **URL:** [per-client dashboard URL] · **Master dashboard:** [URL, if hosted]
- **Login:** JWT; show/hide password; sessions expire and re-auth.
- **Roles & Permissions:** per-module actions (View/Edit/Delete minimum, extended per module). Default roles: Admin (all), Manager ([scope]). How to add a role / a user.
- **Settings:** Store Name, Email, Store URL, API Key, Access Token, Client Secret, API Path, **Timezone**. Changing the timezone reschedules all cron syncs — confirm prompt explains this.
- **Sync / Queue module:** how to read sync status, last-synced-per-entity, and how to retry/replay a failed job (permission-gated).
- **Activity Logs:** the human-readable audit trail (timestamps in your configured timezone).

## 4. Operations (the runbooks)

The five runbooks live in `operations/`; the team is on-call per the rotation. Summary of when each is used:

- **incident-runbooks** — front door for any alert; severity + escalation.
- **queue-recovery** — queue backlog / DLQ / stuck jobs.
- **webhook-replay** — missed/duplicate webhooks.
- **db-restore** — data corruption / bad migration / loss.
- **deploy-recovery** — failed deploy / rollback.

## 5. Monitoring & SLOs

- **Dashboards:** [links]. **Alerts** page: [destination].
- **SLOs (internal target):** availability [99.9%], dashboard read p95 [<400ms], sync freshness [<15 min] — from the capacity profile.
- **SLA (client-facing):** [looser than the SLO; the contracted promise].
- **Health score:** baseline recorded at launch; surfaced on the Master dashboard for retainer monitoring.

## 6. Secrets & access

- Secrets live in [the target's secret store]; rotation procedure: [link]. Never in code/logs.
- Access handover: [who has what; how creds were transferred securely — not in this doc].

## 7. Deploy / rollback

- Host target: [Heroku/VPS/AWS/GCP/Cloudflare/local]. Deploy phases: build → migrate → release → health-check → rollback (`operations/deploy-recovery/`).
- Rollback was rehearsed on [target/staging] on [date] — evidence: [link].

## 8. Warranty

- Warranty period: [term]. Severity SLAs (warranty response): P1 4 business hrs, P2 1 business day, P3 3 business days, P4 best effort (computed in your timezone).
- In scope: agency-introduced defects. Out of scope: client-side edits, third-party outages, explicitly out-of-scope items. (Per the bug tracker's warranty rules.)
- How to report an issue: [channel].

## 9. Open items / known limitations

- [e.g. "DDI Inform ran against a sandbox + mocks; production credentials verified at G6 — watch the first full sync closely."]
- [Any flagged external-API uncertainty.]

---

Last reviewed: 2026-06-30 by Claude (initial Node.js build)
Next review due: 2026-09-30
