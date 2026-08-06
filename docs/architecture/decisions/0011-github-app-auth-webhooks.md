# ADR-0011 — GitHub App Authentication and Webhook Handling

**Status:** Accepted (formalizing an already-resolved decision — see below)

## Context

The dashboard's Release Center and Ready for Claude Queue modules depend on GitHub data (PRs, commit SHAs, deployment status) and need to react to GitHub events. GitHub integration can be built as a GitHub App (installation-based, fine-grained permissions) or as a personal-access-token-based integration — the choice affects permission scope, credential rotation, and multi-repository support.

## Decision

Use a GitHub App (not a personal access token) for all GitHub integration:

- Installed on the specific WebDesk GitHub organization repositories the dashboard needs (the dashboard's own monorepo and, once created, the separate WordPress theme repository).
- Authenticates via GitHub App installation tokens (short-lived, scoped to the installation), never a long-lived personal access token tied to an individual's account.
- Receives webhooks (PR events, push events, deployment events) at a `dashboard-api` endpoint, verified via GitHub's webhook signature (HMAC), per `packages/integrations`'s GitHub adapter (ADR-0001's package boundary).

## Alternatives considered

- **Personal access token (PAT) tied to an individual GitHub account** — rejected: ties the integration's continued function to one person's account/employment status, and PATs typically carry broader scopes than a GitHub App's fine-grained installation permissions.
- **OAuth App instead of GitHub App** — rejected: OAuth Apps act on behalf of a user, not an installation; a GitHub App's installation-scoped, repository-specific permission model is a better fit for a service integration that shouldn't inherit any one user's full account permissions.

## Consequences

Requires creating and configuring a GitHub App in the WebDesk GitHub organization before any GitHub-dependent feature can be implemented or tested — a Phase 1 setup dependency.

## Security considerations

Webhook signature verification is mandatory on every incoming webhook — an unverified webhook endpoint would let anyone who discovers the URL forge GitHub events. GitHub App private keys are secrets managed per `docs/security/secrets-management-plan.md`, never committed to any repository.

## Operational considerations

GitHub App installation tokens expire (typically within an hour) and must be refreshed by the adapter automatically — this is an adapter implementation detail (Phase 1), not designed further here.

## Validation method

Reviewed against profile `knowledge/06-github-app-integration.md`.

## Approval gate

G-Contracts (this ADR's decisions are formalized into `docs/contracts/github-integration-contract.md`).

## Related dashboard requirements

`08_API_and_Integration_Contracts.md`, `03_Detailed_Module_Specifications.md` (Release Center, Ready for Claude Queue).

## Related skill rules

Profile `knowledge/06-github-app-integration.md`.

## Open setup values

GitHub App creation (App ID, private key, installation ID) and the target repository list are unconfirmed setup-time inputs — see `docs/project-state/setup-input-register.md`.
