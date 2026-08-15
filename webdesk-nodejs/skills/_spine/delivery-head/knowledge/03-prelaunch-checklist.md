---
tier: 2
load_when: ["delivery-head-active", "g6", "launch"]
description: The G6 pre-launch checklist — how the Delivery Head composes and verifies it (secrets, rollback tested, runbooks complete, monitoring live, sign-off). Every item is verified or explicitly N/A; never silently skipped.
---

# G6 — Pre-Launch Checklist

> G6 is the final human gate before production, co-approved by the **client**. The Delivery Head **composes** the project-specific checklist and **verifies** each item; it does not approve it. Every item is either verified (with evidence) or marked **N/A with a reason** — nothing is silently skipped. G6 cannot pass with an open P1/P2 (inherited from QA) or with any G5.5 pillar/runbook missing.

---

## Composition

The checklist is assembled from: the spec's host target + integration targets, the G5.5 observability result, the bug tracker, and the runbooks. Base sections below; add project-specific items (e.g. "DDI Inform sandbox credentials rotated to production creds and verified").

---

## 1. Secrets & config

- [ ] All secrets (API Key, Access Token, Client Secret, DB creds, JWT signing keys) are in the **target's secret store**, read from env at runtime. None in code, none in the repo, none in logs (re-confirm the secret-scan result).
- [ ] `.env.example` complete and current; production env validated at startup (the app refuses to boot on a missing required var).
- [ ] JWT signing key is production-grade and rotated from any dev value; refresh-token rotation + revocation list active.
- [ ] Settings → **Timezone** set to the client's timezone (drives cron + activity); confirmed crons are scheduled in that tz.

## 2. Rollback (tested, not theoretical)

- [ ] The deploy/rollback abstraction is implemented for the **target host** (`04-rollback-and-deploy.md`).
- [ ] **Rollback rehearsed** end-to-end on the target (or its staging twin): deploy a version, force a bad health check, confirm automatic rollback to the prior version. Evidence captured.
- [ ] Migrations are reversible; the down-path (or a db-restore plan) is verified for any migration in this release.

## 3. Runbooks (complete)

- [ ] All five runbooks complete (not stubs): incident, queue-recovery, webhook-replay, db-restore, deploy-recovery (`02-runbooks.md`).
- [ ] Each runbook's prerequisites confirmed (backup location + restore path for db-restore; DLQ replay procedure for queue-recovery; provider replay window for webhook-replay).
- [ ] On-call rotation + escalation ladder set; alerts page the right destination (verified by a test alert).

## 4. Monitoring live

- [ ] All G5.5 pillars live in production config: structured logs, metrics, tracing, alerts, dashboards, queue visibility, SLO/SLA panels (`01-observability-gate.md`).
- [ ] A **test alert fires** to the on-call destination in the production setup.
- [ ] Synthetic/health-check monitor configured to run from launch.
- [ ] Master-dashboard health inputs emitting for this instance.

## 5. Quality & scope

- [ ] **Zero open P1/P2** in `bugs.json` (hard rule).
- [ ] Final G5 milestone passed (regression + fitness + load/chaos); capacity profile current; SLO/SLA agreed.
- [ ] Acceptance criteria for launch scope met; any deferred items are documented warranty/RFC, agreed with the client.
- [ ] Contracts (G-Contracts) and data-model (G-Schema) are the client-approved versions actually deployed — no drift.

## 6. Deploy readiness

- [ ] Deploy adapter verified for the target (build → migrate → release → health-check all green in a rehearsal).
- [ ] Maintenance/cutover plan if a window is needed; first-sync plan (the first run is a **full** sync — confirm it's scheduled/expected and won't trip rate limits).
- [ ] DNS/edge config ready if applicable (Cloudflare treated as edge/tunnel unless the spec says full host).

## 7. Sign-off

- [ ] Delivery head verification complete (this checklist, every item verified or N/A-with-reason).
- [ ] **Human Delivery head + client sign off** the G6 gate (`_contracts/gate-format.md`). The Delivery Head does not self-approve.

---

## Verification discipline

- Each item is verified with **evidence** (a link, a log, a rehearsal record) — not asserted.
- An item that genuinely doesn't apply is marked `N/A — <reason>` (e.g. "N/A — no DNS change, internal middleware only"). Silent skips are the #1 pre-launch failure mode.
- If any item fails: halt, route the fix via the orchestrator (dev role fixes on human command — no auto-fix here), re-verify. Do not "launch and fix after".

Write the composed + verified checklist to `/projects/[client]/prelaunch-checklist.md` and surface the G6 gate block for sign-off.

---

Last reviewed: 2026-06-30 by Claude (initial Node.js build)
Next review due: 2026-09-30
