# Proposed Patch 08 — Generic SMTP Adapter Guidance

**Status:** Proposed. Not merged. Not applied to the base skill by this task.

## Reason

No base-skill file addresses outbound email/SMTP at all, despite this being a near-universal requirement for any dashboard with notifications, password resets, or alerting. This project derived the pattern from the base skill's generic queue/retry/DLQ guidance applied to email specifically (`profiles/webdesk-growth-dashboard/knowledge/09-google-workspace-smtp.md`) — a reusable derivation, not a WebDesk-specific one.

## Current gap

No `nodejs/knowledge/integration/0X-email-delivery.md` or equivalent. The delivery-state-machine pattern (Queued → Sent → Accepted / Failed → Retrying → Permanently Failed) and the "idempotency key = the notification's own ID, not its content" distinction (this project's clearest instance of "internal-action idempotency" vs. the base skill's external-ID-keyed idempotency default) has no prior home.

## Proposed files changed

- **New:** `nodejs/knowledge/integration/05-email-delivery.md` (or `06-` if Patch 04's optional new file is also adopted, to keep numbering sequential — coordinate at merge time) — the delivery-state machine, retry/DLQ applied to SMTP transient-vs-permanent-rejection classification, and the internal-action-idempotency pattern generalized.
- **Edit:** `nodejs/knowledge/integration/02-queues-and-jobs.md`'s idempotency section — add a short note distinguishing "idempotency keyed on an external record's ID" (the existing, ERP-sync-oriented default) from "idempotency keyed on a dashboard-internal action" (the new pattern this file introduces), since both are valid and a reader should know which applies to their case.

## Compatibility impact

Additive. No existing guidance changes in substance — the idempotency-key note is a clarifying addition, not a correction.

## Regression risk

Low. New file plus a short clarifying addition to an existing one.

## Reusability scope

**Generally reusable** — nothing in this proposed content is Google-Workspace-specific or WebDesk-specific; it applies to any SMTP or transactional-email integration.
