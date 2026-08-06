# Integration Contract — GitHub

**Status:** Draft. No adapter code exists yet; no GitHub App has been created. This contract defines the intended shape so implementation can proceed against an agreed interface, not so integration can begin.

## Purpose

Provide the dashboard's Release Center and Ready for Claude Queue modules with GitHub data (pull requests, commits, deployment status) and react to relevant GitHub events, per ADR-0011.

## Trust boundary

`dashboard-api`'s GitHub adapter (`packages/integrations`) is the only code in the monorepo that holds GitHub App credentials or calls the GitHub API directly. `dashboard-web` never calls GitHub directly.

## Authentication

GitHub App installation token, per ADR-0011 — short-lived, scoped to the installation, refreshed automatically by the adapter. No personal access token is used anywhere in this integration.

## Authorization

The GitHub App's installation permissions are the outer bound; `dashboard-api`'s own RBAC (ADR-0010) further restricts which dashboard users may trigger GitHub-affecting actions (e.g., approving a release), independent of what the App technically could do.

## Inputs and outputs

- **Inbound (webhooks):** PR opened/updated/merged, push events, deployment status changes, check-run completion — exact event list finalized at Phase 1 implementation against the specific module needs in `03_Detailed_Module_Specifications.md`.
- **Outbound (API calls):** read PR/commit/deployment data; the dashboard does not merge PRs or push commits on its own initiative, per ADR-0018's manual-execution boundary.

## Validation

Webhook payloads are validated against GitHub's documented event schema before processing; malformed or unrecognized events are logged and discarded, not silently ignored without a trace.

## Error handling

GitHub API errors (rate limiting, transient failures) are retried with backoff at the adapter level; persistent failures surface as a visible dashboard state (not a silent failure), per the operational requirements in `09_Security_Backup_Retention_Operations.md`.

## Retry and idempotency

Webhook processing is idempotent — receiving the same GitHub event twice (GitHub's own at-least-once delivery guarantee) must not create duplicate dashboard-side records. Idempotency keys derived from GitHub's own event/delivery IDs.

## Rate limits

GitHub API rate limits (per-installation) are respected by the adapter; the adapter backs off rather than exceeding them. Exact request-budget planning is a Phase 1 implementation detail.

## Audit events

Every GitHub-triggered dashboard action (e.g., a release marked ready from a merged PR) generates an audit event per ADR-0017 — actor recorded as the GitHub event source, not a generic "system" actor, so the audit trail remains traceable to its origin.

## Secret handling

GitHub App private key and installation ID are managed per `docs/security/secrets-management-plan.md` — environment variables only, never committed, independently rotatable per environment.

## Environment separation

Separate GitHub App installations (or at minimum separate credentials) per environment (development, staging, production) — a development-environment credential must never have access to trigger production-affecting webhooks.

## Failure recovery

Webhook delivery failures are recoverable via GitHub's own webhook redelivery mechanism; the adapter does not need to build a separate replay system for V1, but the webhook-replay runbook (`project.json.runbooks_status.webhook_replay`, currently "missing") is a Phase 1 operational deliverable.

## Test requirements

Adapter unit tests against recorded/mocked GitHub API responses; webhook signature verification specifically tested against both valid and forged payloads (the forged case must be rejected).

## Production approval requirements

Any change to the GitHub App's permissions or installed-repository list requires PM/infrastructure-owner sign-off, per the separation-of-duties model (ADR-0010).
