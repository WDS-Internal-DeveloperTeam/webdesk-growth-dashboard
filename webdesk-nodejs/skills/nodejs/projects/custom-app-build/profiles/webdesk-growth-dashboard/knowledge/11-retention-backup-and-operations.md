---
tier: 1
load_when: ["webdesk-growth-dashboard", "schema-work", "observability", "g5_5", "g6"]
description: "Category-based retention matrix, backup targets and RPO/RTO, the retention-deletion job design (no base-skill precedent to extend), and the runbook set required before G5.5/G6."
---

# 11 — Retention, Backup, and Operations

> Almost entirely new territory: the dashboard's retention/backup requirement (`09_Security_Backup_Retention_Operations.md`) is exceptionally detailed on the _what_; the base skill has never modeled a retention-deletion job or a legal-hold-aware purge at all. This file is where that gap is closed for this project specifically.

---

## Retention matrix (category → period)

Applied via each entity's `retention_category` column (`knowledge/10-data-ownership-and-audit.md`'s extended base-entity standard). Full source: `09_Security_Backup_Retention_Operations.md §6` — restated here as the operating table:

| Category                            |                                                     Retention |
| ----------------------------------- | ------------------------------------------------------------: |
| Active sessions                     |                               Until logout/expiry, max 7 days |
| Expired session records             |                                                       30 days |
| Authentication logs                 |                                                       30 days |
| General application logs            |                                                       90 days |
| Sentry error records                |                                                       90 days |
| **Audit records**                   |                                                   **7 years** |
| Approval history (operational view) |                                                        1 year |
| **Immutable approval audit events** |                                                   **7 years** |
| Notification history                |                                                       30 days |
| Completed jobs                      |                                                       30 days |
| Failed jobs                         |                                                      120 days |
| Scan reports                        |                                                       90 days |
| Scan evidence/screenshots           |                                                        1 year |
| Security logs                       |                                                        1 year |
| Closed security findings/incidents  |                                                       3 years |
| Malware findings/review decisions   |               3 years after closure, once scanning is enabled |
| Clean uploads                       | While active, then 90 days after closure/deletion/replacement |
| Rejected/infected uploads           |                    30-day quarantine, then permanent deletion |
| Import files                        |                                                        7 days |
| Export files                        |                                                        7 days |
| Soft-deleted records                |                                                       30 days |
| Daily database backups              |                                                       35 days |
| Monthly database backups            |                                                        1 year |
| Daily Blob backups                  |                                                       35 days |
| Monthly Blob backups                |                                                       90 days |
| SMTP/webhook delivery events        |                                                       30 days |
| Deployment logs                     |                                                       30 days |
| Deployment approvals/audit events   |                                                       7 years |

---

## The retention-deletion job

A **Vercel Cron Job**-triggered handler (per `knowledge/04-serverless-queues-workflows-and-cron.md`'s resolved execution model — this is a scheduled job like any other, with no permanent process), following every job-record requirement from that file (stable ID, idempotency, retries, audit trail) plus retention-specific behavior:

```text
deletion_runs
  run_id               UUID
  environment           the environment this run executed against
  data_category         which retention category this run processed
  retention_rule_version  which version of the retention matrix was applied
  cutoff_date            records/files older than this were eligible
  records_examined       count
  records_deleted        count
  legal_holds_skipped    count — records that matched the cutoff but were skipped due to a legal hold
  start_time / end_time
  result                 success | partial | failed
  failure_details        nullable
  application_commit_sha the dashboard code version that ran this deletion logic (accountability
                          for what deletion behavior actually executed, per the base skill's
                          SHA-is-proof discipline applied to operational jobs, not just releases)
```

**Legal holds override deletion, unconditionally.** A record with `legal_hold = true` is never deleted by the automated job regardless of how far past its retention cutoff it is — the job's query explicitly excludes held records (`WHERE retention_category = ? AND created_at < ? AND legal_hold = false`), and every skip is counted and auditable, never silently absent from the run record. Active investigations, contracts, and litigation holds are the business triggers for setting `legal_hold = true`; the mechanism itself doesn't judge whether a hold is justified, only that it is honored.

**Batched and resumable**, same discipline as any large background operation (`nodejs/knowledge/database/02-migrations-and-rollback.md`'s "backfills are batched + resumable" pattern, applied to deletions instead of backfills) — a deletion run processing millions of expired session records does not attempt one giant transaction.

---

## Backup policy

| Target          | Cadence                                                       | Location                                                            | Retention                                        |
| --------------- | ------------------------------------------------------------- | ------------------------------------------------------------------- | ------------------------------------------------ |
| **PostgreSQL**  | Encrypted logical export daily                                | North America East Coast, independent from the primary provisioning | 35 days daily, 1 year monthly, checksum-verified |
| **Vercel Blob** | Daily copy to independent encrypted East Coast object storage | Checksum-verified                                                   | 35 days daily, 90 days monthly                   |
| **WordPress**   | Daily WordPress.com backup + pre-deployment backup            | —                                                                   | Monthly off-platform encrypted backup, 1 year    |

**Quarterly restore test on staging** for both database and WordPress — a backup that has never been restored is not a verified backup.

**WordPress backup/security specifics, confirmed by the registered `canonical-inputs/Current_WordPress_Technical_Discovery.md` (2026-08-05):** the 35-day operational / 1-year off-platform figures above match the document's own approved-target numbers exactly — no discrepancy. Security tooling is named specifically: **Wordfence Free** (firewall, malware scanning, login-attempt limiting, 2FA), **WordPress.com CDN/platform security** (hosting-level), **WPScan via GitHub Actions** (scheduled vulnerability checks), **UptimeRobot Free** (availability monitoring). Security alerts route to the **WordPress Technical Lead**; the **Security Owner** manages confirmed incidents and escalation — these are the two named roles to configure in the "WordPress" and "Security" operational areas above. Whether Wordfence/WPScan/UptimeRobot are actually installed and configured (vs. approved-but-not-yet-provisioned) remains an open verification item per that same document.

### Recovery targets

- **Production:** RPO target 15 minutes where the operational provider and approved recovery design support it; RTO 4 hours. **Manual logical exports alone do not satisfy a 15-minute RPO** — the actual RPO-satisfying mechanism (point-in-time recovery via the selected Postgres provider, continuous WAL shipping, or an equivalent) is confirmed once the specific Vercel Marketplace Postgres provider is selected (`knowledge/01-approved-architecture.md` §"Database") and **documented as the actually-achieved RPO before launch**, per `09_Security_Backup_Retention_Operations.md §5`'s own explicit instruction — this file does not assert an RPO mechanism that hasn't been confirmed against the actual provider.
- **Staging:** RPO 24 hours; RTO 8 hours.

---

## Monitoring ownership

Configurable operational areas — Dashboard, WordPress, DevOps, Security, Project Management, Database, Backups, GitHub, Email notifications (`09_Security_Backup_Retention_Operations.md §8`) — each with a primary owner, multiple backup owners, multiple email addresses, escalation order, working hours/timezone, after-hours availability, vendor-support authority, and effective/last-confirmation dates. This is the data structure `knowledge/09-google-workspace-smtp.md`'s distribution-list mechanism routes notifications against.

### Incident response targets

| Severity | Initial response target |
| -------- | ----------------------: |
| Critical |              15 minutes |
| High     |                  1 hour |
| Medium   |        One business day |
| Low      |   Scheduled maintenance |

---

## Required runbooks (before G5.5)

The base skill ships generic runbook **templates** for this purpose (`nodejs/templates/operations/{incident-runbook,db-restore,deploy-recovery,queue-recovery,webhook-replay}.template.md`) — reused as-is, filled in with this project's specific targets, providers, and procedures. **One runbook has no base-skill template to extend: the retention-run runbook** (what to do when a deletion run fails partway, how to verify a legal hold was correctly honored, how to handle a retention-rule-version change mid-flight) — authored fresh for this project, following the same structure as the existing templates for consistency.

```
operations/
├── incident-runbooks/        (base-skill template, filled in)
├── queue-recovery/           (base-skill template, filled in — adapted for Vercel Queues/Workflows
                                per knowledge/04's adapter interface, not BullMQ-specific recovery steps)
├── webhook-replay/           (base-skill template, filled in — covers both GitHub and, if applicable,
                                WordPress webhook replay)
├── db-restore/               (base-skill template, filled in with the confirmed Postgres provider's
                                actual restore procedure)
├── deploy-recovery/          (base-skill template, filled in for the Vercel deploy-adapter model)
└── retention-run-recovery/   (NEW — no base-skill template; authored for this project)
```

All must be **present** (not merely drafted) before G5.5 passes, per the base skill's own gate requirement (`_contracts/gate-format.md` "G5.5 — Observability approval... CONFIRM requires... runbooks present").

---

## What this file does not cover

- The audit-event shape these operational runs write into → `knowledge/10-data-ownership-and-audit.md`.
- Observability metrics (distinct from retention/backup) → `knowledge/13-testing-and-acceptance.md` and `docs/implementation/gap-analysis.md` item 16 (still open — this profile does not invent a metrics catalog the review flagged as needing a dedicated design pass).
