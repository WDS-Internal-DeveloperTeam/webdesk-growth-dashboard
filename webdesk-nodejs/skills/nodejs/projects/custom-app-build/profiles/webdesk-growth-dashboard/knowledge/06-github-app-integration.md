---
tier: 1
load_when: ["webdesk-growth-dashboard", "integration-work", "git-decision"]
description: "GitHub App as a product integration (not just this delivery system's own CI). App auth, installation tokens, webhook security, Octokit conventions, commit/PR/deployment verification, and the two-repository release-SHA pairing rule. Pointer to integrations/github/ for concrete adapter detail."
---

# 06 — GitHub App Integration

> The base skill's `git-branch-strategy.md` and `security/04-webhook-security.md` cover this delivery system's _own_ CI/branch discipline. This file covers GitHub as a **product integration** the dashboard itself calls — Ready for Claude Queue and Release Center need to read PR/commit/deployment state from GitHub programmatically, which is a different concern from how this delivery system's own PRs are reviewed.

---

## Scope

Two repositories under the WebDesk GitHub organization:

1. **`webdesk-growth-dashboard`** — the Turborepo monorepo (`knowledge/02-turborepo-boundaries.md`).
2. **The WordPress website repository** (`webdesk-wordpress-website` per the dashboard master spec's repository-structure section) — the WebDesk Custom Theme.

Both are integrated identically through one GitHub App installation covering both repositories (or two installations, one per repo — record the choice at G-Contracts; either satisfies the requirements below, the difference is operational granularity, not a behavioral one).

---

## Authentication

- **GitHub App**, not a personal access token or OAuth app — least-privilege, org-installable, auditable per-installation.
- **Installation tokens** — short-lived (GitHub's default ~1 hour), fetched fresh per use via the App's private key + JWT, never a long-lived static credential stored in the dashboard. The private key itself is the one long-lived secret, stored per `nodejs/knowledge/security/03-secrets-and-config.md` (env/secret manager, encrypted at rest if persisted anywhere beyond the runtime env, never logged).
- **Repository permissions** — least-privilege, scoped to exactly what Ready for Claude Queue and Release Center need: contents (read, and write only if the dashboard itself creates branches/commits — confirm this is actually required before granting write), pull requests (read/write for PR metadata and review status), checks (read), deployments (read/write for deployment-status sync), commit statuses (read). Do not grant repository-admin, org-admin, or any permission not exercised by a specific, named dashboard feature. Record the exact granted scope in the integration contract (`templates/integration-contract-template.md`) at G-Contracts.
- **NODE-008 (verify-at-discovery) applies directly** — exact GitHub App permission scopes, installation-token TTL, and rate-limit numbers (primary + secondary limits) are confirmed against real GitHub App documentation and a real test installation at discovery, not assumed from memory. Flag anything unverified explicitly rather than coding against a guess.

---

## Webhook security — the base skill's pattern, applied to GitHub's specifics

`nodejs/knowledge/security/04-webhook-security.md`'s three-control model applies exactly:

1. **Verify the signature** — `X-Hub-Signature-256` header, HMAC-SHA256 over the **raw** request body, compared with `crypto.timingSafeEqual`. In `dashboard-api` (NestJS on Vercel Functions), this means raw-body capture is configured **before** Nest's body-parsing middleware runs for the webhook route specifically (`knowledge/03-nestjs-on-vercel.md` §"Layering" table).
2. **Reject replays** — dedupe on `X-GitHub-Delivery` (GitHub's per-delivery event ID), recorded per `contracts/webhook-event.schema.json`'s unique index on `(provider, event_id)`.
3. **Process idempotently** — ack fast (return 2xx quickly), enqueue the actual processing work through the `JobQueueAdapter` (`knowledge/04-serverless-queues-workflows-and-cron.md`), and upsert on GitHub's stable IDs (PR number, commit SHA, deployment ID) rather than blind-inserting.

### Events actually needed

Scope the webhook subscription to what Ready for Claude Queue and Release Center consume — at minimum: `pull_request` (opened/closed/synchronize/review states), `check_suite`/`check_run` (CI status), `deployment_status`, `push` (for commit-existence/SHA tracking on protected branches). Do not subscribe to events with no dashboard consumer — each additional event type is additional attack surface and additional idempotency surface to maintain for no product value.

### Failed webhook recovery

A webhook whose processing fails after ack (e.g., the enqueued job later fails) follows the same job-record/retry/DLQ discipline as any other background job (`knowledge/04-serverless-queues-workflows-and-cron.md`'s required job-record properties) — never a silent drop. GitHub also offers webhook redelivery from its own UI/API for delivery failures at the transport level (distinct from processing failures after successful delivery); the integration contract should note whether the dashboard exposes a "replay this webhook" operator action (Ready for Claude Queue's failed-job retry surface, or a dedicated Integrations module control) or relies solely on GitHub's own redelivery.

---

## Octokit conventions

- One Octokit client instance per installation token (re-authenticated per the token's TTL, not reused past expiry).
- Wrap Octokit calls behind the `packages/integrations/github` adapter (never called ad hoc from a controller or job handler) — same adapter-interface discipline as `knowledge/04`'s `JobQueueAdapter`, so rate-limit handling, retry/backoff, and auth-refresh logic live in one place.
- **Rate-limit handling** — honor GitHub's `X-RateLimit-Remaining`/`X-RateLimit-Reset` response headers proactively (the base skill's token-bucket/backoff pattern from `nodejs/knowledge/integration/03-rate-limits-and-backoff.md` applies directly, substituting GitHub's specific headers for the generic pattern); GitHub's secondary rate limits (abuse-detection) require additional care around burst behavior — verify the exact thresholds at discovery (NODE-008).

---

## Commit SHA verification, PR status, deployment sync

These are the concrete GitHub reads Ready for Claude Queue and Release Center depend on:

- **Commit-existence verification** — before marking a Ready-for-Claude task or a release as complete, confirm the claimed commit SHA actually exists on the remote (`GET /repos/{owner}/{repo}/commits/{sha}`), never trusting a locally-reported SHA as proof (`01_Dashboard_Master_Specification.md §11`'s Git completion rule — "the dashboard confirms the SHA exists in the remote repository").
- **PR status sync** — PR open/merged/closed state, review status, and check-run results flow into the dashboard's `pull_requests`/`code_reviews` records via webhook (real-time) and are reconciled by a periodic scan (Scan Center's repository scan type) as a safety net against a missed/failed webhook, mirroring the base skill's reconciliation philosophy (`nodejs/knowledge/integration/01-sync-strategies.md`: heal drift, never silently trust one channel alone).
- **Deployment-status synchronization** — if GitHub Deployments API / WordPress.com's GitHub-based deployment mechanism (`knowledge/07-wordpress-integration.md`) reports deployment state, that state flows into the Release Center's `deployments` record via the `deployment_status` webhook event.

### Release SHA pairing (both repositories)

Per `01_Dashboard_Master_Specification.md §6`: **every release that involves both repositories records the exact approved dashboard and WordPress commit SHAs together**, not as two independently-tracked, loosely-associated facts. The Release Center's `releases` record (`docs/implementation/requirements-traceability-matrix.md` module #36) carries both SHAs as required fields on the same release entity — a release is not "complete" if only one repository's SHA is verified when the release's scope includes both.

---

## What Claude must never do (restated, project-specific instance of the base skill's own rules)

- **Never merge automatically.** Every merge to `staging` or `main` in either repository is a human action, per `nodejs/knowledge/... git-branch-strategy.md`'s PR-and-human-merge model — the dashboard's automation reads and reports GitHub state; it does not act on it unilaterally.
- **Never push directly to a protected branch.** Both repositories' `main` (and `staging`, for the dashboard monorepo) remain protected exactly per the base skill's branch-protection rules.
- **Never deploy production without approval.** GitHub Deployments/status sync is read/report-only from the dashboard's perspective for production; the actual production deployment trigger requires the dashboard's own Release Center production-approval action, itself gated per `knowledge/12-dashboard-security-controls.md`'s separation-of-duties rule.
- **Never treat a local commit as proof of completion.** Restated from above — remote SHA verification is mandatory, not optional, for any Ready-for-Claude task or release completion check.
- **Never mark a Git-changing task complete without verifying the remote commit SHA.** Same rule, stated as a completion-gate check rather than a general principle — this is the literal acceptance criterion for Ready for Claude Queue tests (`11_Acceptance_Criteria_and_Test_Plan.md §5`).

---

## Audit logging

Every GitHub-integration action that changes dashboard state (webhook processed, SHA verified, release recorded, PR status updated) produces an audit event per `knowledge/10-data-ownership-and-audit.md`. GitHub App installation/permission changes themselves (who authorized what scope, when) are also audited, consistent with the base skill's rule that authorization-authority changes are always audited (`06_Roles_and_Permissions.md §6`).

---

## What this file does not cover

- Concrete Octokit client setup, exact API endpoint list, and library version choice → `integrations/github/` (loaded only when implementing this integration).
- WordPress-side GitHub Deployments mechanics → `knowledge/07-wordpress-integration.md`.
- The `webhook_events`/`releases` table shapes → `contracts/webhook-event.schema.json`, `contracts/release-manifest.schema.json`.
