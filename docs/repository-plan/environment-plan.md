# Environment Plan

**Status:** Planning document. No environment has been provisioned yet. This documents the intended separation, per every integration contract's "Environment separation" section.

## Four environments

| Environment     | Purpose                                     | Deploys from                                                    |
| --------------- | ------------------------------------------- | --------------------------------------------------------------- |
| **Development** | Individual developer work, local or preview | Feature branches (Vercel preview deployments)                   |
| **Preview**     | Per-PR preview deployment for review        | Open pull requests                                              |
| **Staging**     | Pre-production QA and stakeholder approval  | `staging` branch                                                |
| **Production**  | Live system                                 | Approved commit SHA, deployed explicitly after staging sign-off |

## Separate per environment (restated from each integration contract, collected here for a single reference point)

- **Credentials:** database connection string, GitHub App installation, Google Workspace OAuth client, SMTP sending account, WordPress Application Password account, Vercel Blob token, job-queue credentials — every one of these is a distinct credential set per environment, never shared.
- **Databases:** fully separate PostgreSQL databases (ADR-0007, `docs/contracts/database-contract.md`) — no environment ever reads or writes another environment's database.
- **Storage:** separate Vercel Blob stores or clearly namespaced paths (`docs/contracts/vercel-blob-contract.md`).
- **Queues:** separate queue/workflow/cron configurations (`docs/contracts/vercel-background-jobs-contract.md`) — a development cron job must never trigger a production handler.
- **WordPress integration identities:** separate Application Password accounts per environment, with production writes additionally gated through the approved deployment workflow (ADR-0013) even when using a production-scoped credential.

## Why this matters enough to state explicitly

Every integration contract in `docs/contracts/` independently states its own environment-separation requirement; this document exists so there is one place a reviewer can confirm the _pattern_ is consistent across all seven integrations, rather than trusting each contract's restatement in isolation.

## What is NOT provisioned in Phase 0

No environment listed above has been created. Provisioning each (Vercel projects, database instances, credential sets) is a Phase 1 setup task — see `docs/project-state/setup-input-register.md` for the specific unconfirmed values each provisioning step depends on.
