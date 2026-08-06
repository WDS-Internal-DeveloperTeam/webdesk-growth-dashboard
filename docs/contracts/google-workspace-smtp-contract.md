# Integration Contract — Google Workspace SMTP

**Status:** Draft. No adapter code exists yet; no dedicated sending account has been created. This contract defines the intended shape so implementation can proceed against an agreed interface, not so integration can begin.

## Purpose

Send all dashboard-originated transactional email (approval requests, scan alerts, release notifications) via Google Workspace SMTP, per ADR-0015. No third-party transactional email API is used, under WDS-004.

## Trust boundary

`dashboard-api`'s and `dashboard-worker`'s SMTP adapter (`packages/integrations`) is the only code that holds SMTP credentials or sends email.

## Authentication

Google Workspace SMTP with a dedicated sending account and app-password (not a personal mailbox), per ADR-0015.

## Authorization

Only server-side code (never `dashboard-web` directly) can trigger a send; the specific notification-triggering business logic lives in the relevant module (Notification Center), not in the adapter itself, which is a thin sending layer.

## Inputs and outputs

- **Inbound:** none (SMTP is send-only for this integration; no inbound-email processing is in scope for V1).
- **Outbound:** transactional email messages, templated per the Notification Center's module spec.

## Validation

Recipient addresses and message content are validated (well-formed address, required fields present) before a send attempt; template rendering failures block the send rather than sending a malformed message.

## Error handling

SMTP send failures (auth failure, quota exceeded, transient network error) are logged distinctly and surfaced to the triggering module, not silently swallowed — a failed notification should be visible as a failed notification, not indistinguishable from "no notification was needed."

## Retry and idempotency

Transient SMTP failures are retried with backoff; the adapter tracks a stable idempotency key per notification so a retried send doesn't duplicate an already-delivered message where avoidable.

## Rate limits

Google Workspace SMTP has documented per-account daily sending limits — the adapter should track approximate volume and surface an operational warning before those limits are hit, not discover the limit via failed sends in production.

## Audit events

Every notification send attempt (success or failure) is recorded as an audit event per ADR-0017.

## Secret handling

SMTP credentials (app-password) managed per `docs/security/secrets-management-plan.md` — environment variables only, independently rotatable per environment.

## Environment separation

Separate sending accounts (or at minimum clearly distinguishable "from" addresses/subject prefixes) per environment, so a development-environment test notification can never be mistaken for a real production notification by its recipient.

## Failure recovery

No separate dashboard-side outbound-email queue/replay system is built for V1 beyond the retry behavior above — if Google Workspace SMTP has an extended outage, notifications queue in the underlying job system (ADR-0005) until it recovers.

## Test requirements

Adapter tests against a test mailbox in a non-production environment; template rendering tested independently of the actual SMTP send.

## Production approval requirements

Any change to the sending account or notification templates that affects production-facing content requires the standard module-level review, not a separate approval process beyond normal code review.

## Open items

Actual SMTP credentials and the dedicated sending account are unconfirmed setup-time inputs — see `docs/project-state/setup-input-register.md`.
