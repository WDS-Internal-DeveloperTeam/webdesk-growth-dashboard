---
tier: 2
load_when: ["monitoring", "observability", "g5_5", "launch", "delivery-head-active"]
description: "Fill-in deploy-recovery runbook: rollback a failed deploy (build→migrate→release→health-check→rollback), migration rollback, re-enable sync, health verify."
---

# Deploy Recovery Runbook — [FILL IN: project / client name]

**Deploy pipeline:** [FILL IN: CI/CD tool, stages] **Environments:** [FILL IN: staging, prod]
**Release mechanism:** [FILL IN: blue/green | rolling | tag] **Approver for rollback:** [FILL IN]

## When to use this

Use this when a deploy has failed or made things worse: health checks failing
after release, error/latency spike correlated with the release, a migration that
errored or corrupted data, or syncs misbehaving immediately post-deploy. Suspect
the **most recent release first** when symptoms start right after a deploy.

## The deploy abstraction

Our deploys move through these stages; recovery maps to where it broke:

```
build → migrate → release → health-check → (rollback)
```

- **build** — artifact built/tested. Failure here never reaches prod; just re-run.
- **migrate** — DB migrations applied (additive-first, reversible — see
  `migration-template.js`). Failure here is the dangerous one.
- **release** — new code serving traffic.
- **health-check** — automated probes (`/health`, sync canary). A red check
  should auto-hold/auto-rollback if configured.
- **rollback** — return to the last known-good release (and, if needed, reverse
  the migration).

## Steps

1. **Declare & pause sync.** Raise the incident. **Pause crons + queue workers**
   for affected tenants so a half-deployed/incompatible app doesn't write bad data
   while you recover.
2. **Locate the failure stage** (build / migrate / release / health-check) from
   pipeline + logs. This decides the path:
3. **If it broke at `release` or `health-check` (code, not schema):**
   - Roll back to the last known-good release: [FILL IN: rollback command /
     blue-green switch / redeploy previous tag].
   - This is the fast, safe path **iff** the migration was additive and backward-
     compatible (old code can run against the new schema) — which is why we do
     additive-first migrations.
4. **If it broke at `migrate` (schema):**
   - If the migration is **reversible and non-destructive**, run its `down`:
     [FILL IN: migration rollback command]. Then roll the code back to match.
   - If the migration was **destructive / not cleanly reversible**, do NOT force a
     down — go to **db-restore** (PITR to just before the migration) instead.
     Forcing a bad down can lose more data.
5. **Re-align code and schema.** After rollback, code version and DB schema must
   be compatible. Confirm the running release expects the schema now present.
6. **Re-enable sync, staged.** Bring crons/workers back **one tenant first**,
   watch, then the rest (see verification).

## Verification

- `/health` and the sync canary are green on the rolled-back release.
- Error rate / latency back to pre-deploy baseline on the dashboard.
- Schema matches the running code (no migration-mismatch errors in logs).
- A controlled manual sync for one tenant/entity completes correctly **before**
  full cron re-enable.
- `sync_state` watermarks advancing; DLQ not growing.
- No cross-tenant anomalies introduced by the bad release (NODE-104).

## If this doesn't work / escalate

- Rollback target is also unhealthy (the "last good" wasn't good) → escalate to
  [FILL IN: tech lead]; consider rolling back further or restoring.
- Migration left data corrupted and down won't fix it → **db-restore** (PITR),
  then reconcile.
- Repeated failed deploys → freeze deploys, escalate to [FILL IN: delivery head],
  and hold a fix-forward vs. stay-rolled-back decision before trying again.
- Capture for the postmortem: which stage failed, why the health-check didn't
  catch it earlier, and whether a missing fitness test or migration-reversibility
  gap allowed it.

Last reviewed: 2026-06-30 by Claude (initial build)
