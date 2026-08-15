---
tier: 2
load_when: ["delivery-head-active", "g6", "launch"]
description: The host-agnostic deploy/rollback abstraction — build → migrate → release → health-check → rollback — with per-target adapters across AWS/GCP/Cloudflare/Heroku/VPS/local-first. The same gates and runbooks apply to every target; only the adapter differs.
---

# Deploy / Rollback — Host-Agnostic Abstraction

> The deploy workflow and the deploy-recovery runbook are written against **one abstraction** so the same gates (G5.5/G6) and runbooks apply whether the target is Heroku, a VPS, AWS, GCP, Cloudflare, or local-first. Each target supplies an adapter that implements the five phases. The system is **local-first**: every project runs and is rehearsed locally (Docker Compose) before any cloud deploy. Never deploy without a **tested** rollback.

---

## The five phases (every target implements these)

```
build → migrate → release → health-check → rollback
```

1. **build** — produce the deployable artifact (install prod deps, build the dashboard if present, build the image/bundle). Reproducible; pinned versions.
2. **migrate** — run DB migrations. **Forward-only in production, but every migration is reversible** (a real `down` or a restore plan — `code-review-agent/04-sensitive-paths.md`). Migrations are gated by G-Schema; none runs in a shared env before that. A destructive migration is run behind a maintenance/read-only window.
3. **release** — cut traffic to the new version. Prefer a strategy that allows fast back-out (blue-green / rolling / new-release-then-promote) over in-place replace.
4. **health-check** — within minutes, hit a real readiness probe: the API responds, the DB is reachable, the queue is connected, a **sync dry-run** (or a no-op tick) succeeds, dependencies (ERP/store) reachable. Green → keep; **not green → rollback automatically**.
5. **rollback** — return to the prior known-good version (and the prior schema, via the reversible down-path or restore). After rollback the project **pauses for human investigation** — never auto-resume.

The abstraction is a thin interface (`deploy.build()`, `.migrate()`, `.release()`, `.healthCheck()`, `.rollback()`); the project's `tools/deploy/` holds one implementation per target. The deploy-recovery runbook references these by phase, so the runbook reads the same regardless of host.

---

## Per-target adapters

| Target          | build                      | migrate                          | release                                         | health-check                                       | rollback                                                                      |
| --------------- | -------------------------- | -------------------------------- | ----------------------------------------------- | -------------------------------------------------- | ----------------------------------------------------------------------------- |
| **local-first** | Docker Compose build       | `migrate` against local Postgres | `compose up`                                    | curl readiness + a sync dry-run on the local stack | `compose down` to prior tag; restore local DB volume                          |
| **Heroku**      | buildpack/CI build         | release-phase `migrate`          | new release (promote)                           | dyno health + readiness probe                      | `heroku releases:rollback` (+ migration down/restore)                         |
| **VPS**         | build artifact / image     | `migrate` via the runner         | systemd/PM2 swap or blue-green behind nginx     | readiness probe + dependency check                 | re-point to prior release dir/image (keep N releases); restore DB if migrated |
| **AWS**         | image to ECR / artifact    | migrate task (one-off)           | ECS/EB new task set, shift target group         | ALB health check + readiness                       | shift target group back to prior task set; restore via snapshot/PITR          |
| **GCP**         | image to Artifact Registry | migrate job                      | Cloud Run new revision                          | revision health + readiness                        | route traffic to prior revision; restore via PITR                             |
| **Cloudflare**  | build Workers/assets       | n/a at edge (DB elsewhere)       | `wrangler deploy` (+ tunnels to the origin app) | edge + origin readiness                            | `wrangler rollback` to prior version                                          |

**Cloudflare is edge/Workers + tunnels, not a full app host**, unless the spec says otherwise — the app + Postgres + queue live on one of the other targets and Cloudflare fronts/tunnels them. The observability **tooling** is also target-aware (CloudWatch / GCP Ops / self-hosted Prometheus-Grafana-Loki-Tempo) but the G5.5 checklist is constant.

---

## Local-first rule

- Every project runs locally first (Docker Compose: app + Postgres + a queue + mock ERP/store). Deploy + rollback are rehearsed locally before any cloud target.
- Local is also the cheapest place to run load/chaos (QA's capacity profile) — so the deploy abstraction and the test harness share the same Compose stack.
- The cloud target is captured at G0 and justified at G1.5 if non-trivial (e.g. an on-prem ERP behind a VPN changes connectivity and therefore the deploy/runbook design).

---

## Rules

1. **Rollback is tested before G6.** Rehearse it on the target (or its staging twin): deploy → force a bad health check → confirm automatic rollback. An untested rollback fails G6.
2. **Health check gates the release.** Automatic rollback on a failed health check — no wait-and-see.
3. **No auto-resume after rollback.** A human investigates and decides whether to retry; the project pauses.
4. **Migrations reversible.** Forward-only in prod, but a real down-path or a restore plan exists and is verified for every migration in the release.
5. **Same runbook everywhere.** The deploy-recovery runbook is written against the five phases; swapping targets swaps the adapter, not the procedure.
6. **First production sync is a full sync.** Plan for it (it's heavier and can hit rate limits); subsequent runs are incremental from the watermark.

---

Last reviewed: 2026-06-30 by Claude (initial Node.js build)
Next review due: 2026-09-30
