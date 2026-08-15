---
tier: 2
load_when: ["webdesk-growth-dashboard", "integration-work", "git-decision"]
description: "GitHub App authentication, installation tokens, Octokit client conventions, and the adapter interface for the dashboard's own GitHub product integration (distinct from this delivery system's own CI usage of GitHub)."
---

# GitHub — App Auth and Octokit

> Loaded only when the active task implements or modifies the GitHub integration. Policy-level rules (what Claude must never do, release SHA pairing, audit requirements) live in `../../knowledge/06-github-app-integration.md` — read that first. This file is the concrete adapter-implementation reference.

---

## Verified vs. verify-at-discovery

No live GitHub App installation has been created for this project as of this skill build. Everything below marked **verify-at-discovery** is a documented GitHub platform capability as of general knowledge, not confirmed against this project's actual App registration, installation scope, or org policy — confirm at Discovery/G-Contracts before coding against it (NODE-008).

---

## Adapter interface

```ts
// packages/integrations/github/src/adapter.ts
export interface GitHubAdapter {
  // Auth
  getInstallationToken(installationId: string): Promise<{ token: string; expiresAt: string }>;

  // Commit / PR / branch reads
  verifyCommitExists(owner: string, repo: string, sha: string): Promise<boolean>;
  getPullRequest(owner: string, repo: string, number: number): Promise<PullRequestState>;
  getCheckRuns(owner: string, repo: string, sha: string): Promise<CheckRunSummary[]>;
  getDeploymentStatus(owner: string, repo: string, deploymentId: string): Promise<DeploymentState>;

  // Webhook verification (raw body in, verified event out)
  verifyWebhookSignature(rawBody: Buffer, signatureHeader: string, secret: string): boolean;

  // Health
  healthCheck(): Promise<{ ok: boolean; rateLimitRemaining: number; latencyMs: number }>;
}
```

Business logic (`dashboard-api` services, `dashboard-worker` handlers) calls only this interface — never the Octokit SDK directly — per `../../knowledge/04-serverless-queues-workflows-and-cron.md`'s adapter-interface discipline, applied here to the same principle for a different provider.

---

## Authentication (verify-at-discovery: exact scopes, installation model)

1. **GitHub App** registered under the WebDesk GitHub organization, with a generated private key stored per `nodejs/knowledge/security/03-secrets-and-config.md` (env/secret manager, never committed).
2. **App-level JWT** signed with the private key (short-lived, ~10 minutes), used only to request installation tokens — never used directly as an API credential.
3. **Installation access token** requested per-installation via the App JWT (`POST /app/installations/{installation_id}/access_tokens`), valid ~1 hour (**verify exact TTL at discovery**), cached and refreshed by the adapter, never persisted beyond its natural expiry.
4. **Repository permissions** — confirm the minimal actually-needed scope at G-Contracts (contents, pull_requests, checks, deployments, statuses — see `../../knowledge/06-github-app-integration.md` for which dashboard features drive which scope) and record it in the integration contract (`../../templates/integration-contract-template.md`).

---

## Octokit conventions

- One Octokit instance constructed per installation-token refresh cycle (not a single long-lived client reused past token expiry — the adapter's `getInstallationToken` handles refresh, and the Octokit client is re-instantiated or re-authenticated accordingly).
- **Rate-limit awareness** — read `X-RateLimit-Remaining`/`X-RateLimit-Reset` from every response; the adapter's `healthCheck()` surfaces current remaining quota for the dashboard's Integrations module. Apply the base skill's token-bucket/backoff pattern (`nodejs/knowledge/integration/03-rate-limits-and-backoff.md`) proactively rather than reactively — GitHub's secondary (abuse-detection) rate limits are stricter about burst behavior than the primary quota alone suggests; **verify exact thresholds at discovery.**
- **Pagination** — GitHub's REST API uses `Link` header pagination; the adapter paginates fully when listing (e.g., all check runs for a commit) rather than assuming a single page, consistent with the base skill's general pagination discipline (`nodejs/knowledge/intelligence/api-design-intelligence.md`).

---

## verify-at-discovery checklist

- [ ] Exact repository permission scopes actually required, confirmed against a real test installation.
- [ ] Installation-token TTL and refresh behavior.
- [ ] Primary and secondary (abuse-detection) rate-limit thresholds.
- [ ] Whether one App installation covers both repositories or two separate installations are used.
- [ ] Exact webhook event payload shapes for the events in scope (see `02-webhooks-and-events.md`).

See `pointers.md` for documentation anchors.
