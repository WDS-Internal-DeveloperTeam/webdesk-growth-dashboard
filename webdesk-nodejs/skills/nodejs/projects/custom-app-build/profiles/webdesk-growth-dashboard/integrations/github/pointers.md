---
tier: 2
load_when: ["webdesk-growth-dashboard", "integration-work"]
description: "GitHub App / REST / webhooks doc anchors. Confirm current API version and exact scopes at build — GitHub's docs and rate-limit policy change over time."
---

# GitHub — Doc Pointers

> Anchored entry points, not a substitute for reading the live docs at build time (NODE-008). No project-specific App has been registered as of this skill build — every fact here is general-platform, not confirmed against this project's installation.

## API version

- REST API: currently versioned via the `X-GitHub-Api-Version` header (date-stamped versions, e.g. `2022-11-28`) — **confirm current version at build.**

## Doc anchors

- GitHub Apps overview: https://docs.github.com/en/apps
- Authenticating as a GitHub App: https://docs.github.com/en/apps/creating-github-apps/authenticating-with-a-github-app
- Installation access tokens: https://docs.github.com/en/apps/creating-github-apps/authenticating-with-a-github-app/authenticating-as-a-github-app-installation
- REST API reference: https://docs.github.com/en/rest
- Webhook events and payloads: https://docs.github.com/en/webhooks/webhook-events-and-payloads
- Webhook signature verification: https://docs.github.com/en/webhooks/using-webhooks/validating-webhook-deliveries
- Rate limits: https://docs.github.com/en/rest/using-the-rest-api/rate-limits-for-the-rest-api
- Octokit.js: https://github.com/octokit/octokit.js
- Branch protection API: https://docs.github.com/en/rest/branches/branch-protection
- Deployments API: https://docs.github.com/en/rest/deployments/deployments

## At-build checklist

- [ ] Confirm current REST API version header value.
- [ ] Confirm exact repository permission scopes for the App registration.
- [ ] Confirm webhook signing header/algorithm is still `X-Hub-Signature-256` / HMAC-SHA256.
- [ ] Read live rate-limit headers; do not hard-code limits.
