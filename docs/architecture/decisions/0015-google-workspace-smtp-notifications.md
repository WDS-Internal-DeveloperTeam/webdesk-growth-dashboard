# ADR-0015 — Google Workspace SMTP Notifications

**Status:** Accepted (formalizing an already-resolved decision — see below)

## Context

The dashboard's Notification Center needs to send transactional email (approval requests, scan alerts, release notifications). The base skill's documented default is a transactional email API (e.g., Resend); the Master Specification requires Google Workspace SMTP instead, and this project carries an absolute rule against wiring any transactional-email API (WDS-004).

## Decision

All outbound dashboard email is sent via Google Workspace SMTP, using a dedicated sending account/app-password (not a personal mailbox), through `packages/integrations`'s SMTP adapter. No third-party transactional email API (Resend, SendGrid, Postmark, etc.) is wired anywhere in the codebase, under any circumstance — this is an absolute rule (WDS-004), not a default that can be revisited without a new approved decision superseding it.

## Alternatives considered

- **Resend or another transactional email API (base skill default)** — explicitly excluded by WDS-004; not reconsidered here.
- **A general-purpose Google Workspace mailbox instead of a dedicated sending account** — rejected: a dedicated sending account/app-password keeps notification email traffic auditable and separable from any individual's personal mailbox, and simplifies credential rotation.

## Consequences

Email deliverability, rate limits, and bounce handling are governed by Google Workspace's own SMTP limits, which are more conservative than a dedicated transactional-email provider's — high-volume notification scenarios (if the dashboard ever needs them) would need to be evaluated against these limits at implementation time.

## Security considerations

SMTP credentials (the dedicated account's app-password) are managed per `docs/security/secrets-management-plan.md`; no email credential is embedded in code or committed to any repository.

## Operational considerations

Bounce/failure handling for notification email is a Phase 1+ implementation detail, informed by the Notification Center's module spec, not designed here.

## Validation method

Reviewed against profile `knowledge/09-google-workspace-smtp.md` and WDS-004.

## Approval gate

G-Contracts (formalized into `docs/contracts/google-workspace-smtp-contract.md`).

## Related dashboard requirements

`03_Detailed_Module_Specifications.md` (Notification Center).

## Related skill rules

Profile `knowledge/09-google-workspace-smtp.md`; WDS-004 (absolute rule).

## Open setup values

Actual SMTP credentials and the dedicated sending account are unconfirmed setup-time inputs — see `docs/project-state/setup-input-register.md`.
