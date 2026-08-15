---
tier: 2
load_when: ["webdesk-growth-dashboard", "integration-work", "backend-active"]
description: "Configurable Google Workspace SMTP for the Notification Center — explicitly not Resend. Delivery-state machine, retry policy, multi-recipient/distribution-list support, and severity-specific routing, built on the base skill's generic retry/DLQ pattern."
---

# 09 — Google Workspace SMTP

> No base-skill file addresses outbound email specifically. The Notification Center's requirements are a direct restatement of the base skill's generic at-least-once external-side-effect pattern (`nodejs/knowledge/integration/02-queues-and-jobs.md`) applied to SMTP sends — this file states the email-specific instance of that pattern.

---

## Provider

**Configurable SMTP, initially Google Workspace/Gmail. Do not use Resend, or any other transactional-email API/provider, for this project.** This is an explicit exclusion, not merely an unstated preference — restated in `knowledge/15-project-specific-forbidden-actions.md`. "Configurable" means the dashboard's Settings module stores provider/host/port/encryption/auth-method as configuration (per `08_API_and_Integration_Contracts.md §9`), not that any provider is acceptable — Google Workspace SMTP is the approved provider for V1, and a future provider change is itself a new approved decision, not something an implementer substitutes because a transactional-email API seems more convenient.

## Secrets

SMTP credentials are environment variables / secret-manager references only. The dashboard's `integrations`/`secret_metadata` records store:

```
provider name, sender/reply-to address, host/port/encryption/auth method,
secret reference (never the secret value), allowed domains, last test result,
retry policy, last success/failure timestamp
```

Never the SMTP password/app-password itself — same rule as every other persisted credential (`nodejs/knowledge/security/03-secrets-and-config.md`, NODE-103).

---

## Delivery-state machine

```text
Queued → Sent to SMTP → Accepted → (delivered, outside the dashboard's direct visibility
                                     unless a delivery-event webhook/callback is available)
                       ↘ Failed → Retrying → Permanently Failed
```

Every notification's delivery attempt is a background job following `knowledge/04-serverless-queues-workflows-and-cron.md`'s required job-record properties: stable job ID, idempotency key (the notification's own ID, not its content — resending the _same_ notification ID never double-sends), capped retries with backoff, failure classification (an SMTP 4xx transient-rejection is retryable; a 5xx permanent-rejection or invalid-recipient error is terminal), attempt history, and audit trail.

**Idempotency note:** unlike ERP-sync idempotency (keyed on an external record's ID), notification idempotency is keyed on the _dashboard-internal_ notification-generation event (e.g., "Case Study CS-042 moved to Awaiting Internal Approval, notify assigned reviewer" happens once per transition, not once per retry of sending it) — this is the "internal-action idempotency" case flagged in `docs/implementation/gap-analysis.md` item 5, and the Notification Center is its clearest instance.

---

## Recipients

- **Multiple notification email addresses per operational area** (Dashboard, WordPress, DevOps, Security, Project Management, Database, Backups, GitHub, Email notifications — per `09_Security_Backup_Retention_Operations.md §8`), each supporting a **primary owner** and **multiple backup owners**.
- **Distribution lists** in addition to individual addresses.
- **Severity-specific notification rules** — a Critical finding (`09_Security_Backup_Retention_Operations.md §9`: 15-minute initial-response target) routes differently (more recipients, possibly an additional channel/escalation) than a Low-severity, scheduled-maintenance-tier item.

---

## Retry rules and delivery/failure history

Capped retry attempts with exponential backoff, terminating in `Permanently Failed` — never an unbounded retry loop (NODE-101, applied to SMTP transport failures specifically: a temporary SMTP server unavailability is retryable, an invalid recipient address is not). Every delivery attempt, success, and failure is retained per the delivery-event retention category (`knowledge/11-retention-backup-and-operations.md`: SMTP/webhook delivery events retained 30 days) and surfaced on the Notification Center module for operator visibility — a silently-failing notification path is exactly the kind of invisible failure the base skill's NODE-006 (no silent catch) exists to prevent, applied here to "did the escalation email actually go out."

---

## What this file does not cover

- Concrete SMTP client/library setup → `integrations/google-workspace/` (loaded only when implementing this integration).
- Emergency-admin login alert routing specifically → `knowledge/05-google-workspace-sso-and-local-admin.md` §"Emergency-admin access alerts" (uses this file's distribution-list mechanism as its delivery path).
