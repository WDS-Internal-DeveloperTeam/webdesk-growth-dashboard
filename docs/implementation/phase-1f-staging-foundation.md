# Phase 1F — Staging Environment Foundation

**Status:** Documentation only. No new Vercel, Neon, or other cloud resource was provisioned by
this work — per the Phase 1F brief §29–§32 ("use existing approved Vercel projects if present;
stop at the provisioning boundary and document what's missing rather than inventing resources")
and this project's own standing caution against Claude provisioning infrastructure unprompted (see
`CLAUDE.md`'s "Cautions"). This document records what exists today, what a real staging environment
would need, and who owns making each remaining decision — it does not create any of it.

## 1. What exists today

Two real Vercel projects exist (`docs/project-state/setup-input-register.md`, "Actual Vercel
project IDs / topology"), both created ad hoc by the user on 2026-08-11, both deploying directly
from `main`:

| Project                         | App             | Root directory       | Status                                                           |
| ------------------------------- | --------------- | -------------------- | ---------------------------------------------------------------- |
| `webdesk-growth-dashboard`      | `dashboard-web` | `apps/dashboard-web` | Live, serving real requests                                      |
| `webdesk-growth-dashboard-7v1u` | `dashboard-api` | `apps/dashboard-api` | Live, serving real requests (Google SSO login confirmed working) |

**Both of these are, in effect, the production environment.** A real Super Admin
(`jitesh@webdeskinc.com`) can sign in via Google Workspace SSO and the database holds real
production schema and data (see `CLAUDE.md`'s "Current state"). Neither project was set up as a
deliberate staging environment — they exist because the user deployed `main` directly to validate
the deployment pipeline, and that validation work then became the real production system. **There
is currently no separate staging environment, staging database, or staging Vercel project.**

## 2. What Vercel already gives us for free (zero provisioning)

Vercel's standard behavior — already active on both existing projects, no configuration needed —
is that **every push to a non-`main` branch, and every pull request, gets its own Preview
deployment** at a unique, automatically-generated URL. This is a real, working staging-like
capability today:

- Pushing any of this branch's ancestors (`phase-1a-...` through `phase-1f-application-shell`)
  already produced a live Preview URL for that branch on both projects, without any action beyond
  the `git push` itself.
- Preview deployments use the env vars configured for the "Preview" environment scope in each
  Vercel project's settings — distinct from "Production" scope, so a Preview deployment can in
  principle point at different values (e.g. a different `DATABASE_URL`) than production, **if**
  those Preview-scoped values are ever set. Today, `DATABASE_URL` and the other secrets recorded
  in `docs/project-state/setup-input-register.md` were set as "Production and Preview" scoped
  (per the 2026-08-12 decision entries in `CLAUDE.md`) — meaning **every Preview deployment today
  talks to the same real production Neon database** as `main`. This is the single most important
  gap: Preview deployments are not currently isolated from production data.

## 3. What a real, isolated staging environment would need

None of the below has been provisioned. Each is a distinct decision, typically requiring the
infrastructure/project owner's action (Vercel/Neon/Google Cloud console access this session does
not have, and per this project's standing rule, would not use unprompted even if it did):

1. **A staging database, isolated from production data.** Neon supports database branching (a
   cheap, fast copy-on-write branch of the production database) — this would be the natural choice
   given the project already uses Neon, but creating a branch is itself a provisioning action for
   the project owner to take, not something to invent here. The alternative — a second, fully
   separate Neon project — is also possible but more expensive and requires its own migration
   history to be kept in sync.
2. **Preview-scoped environment variables that actually differ from Production.** At minimum,
   `DATABASE_URL` would need a Preview-only value (pointing at the staging database from #1) so
   Preview deployments stop touching real production data. `GOOGLE_OAUTH_REDIRECT_URI` would also
   need a staging-specific value if any pre-merge SSO testing is wanted (see #3).
3. **A registered staging redirect URI on the real Google OAuth client**, if SSO needs to be
   testable pre-merge. Preview deployment URLs are non-deterministic (a new URL per deployment)
   unless a stable staging domain is set up (see #4), which makes registering a fixed
   `redirect_uri` with Google awkward without one. Until a stable staging URL exists, Google SSO
   is realistically only testable against the real production URL, same as it is today.
4. **A stable staging domain/branch topology**, if ad hoc per-branch Preview URLs aren't enough.
   The realistic option is a persistent `staging` branch that both Vercel projects treat as a
   second "production-like" branch (via Vercel's branch-based deployment targets), giving it one
   stable URL instead of a new one per push. This is a Vercel project-settings change, not
   something this branch's own code can configure.
5. **A promotion workflow decision** — how code moves from a merged PR into staging, and from
   staging into production. Today there is no staging step at all: PRs merge straight to `main`,
   which deploys straight to what is, in practice, production. Whether staging sits between those
   two, and what gates a promotion, is a process decision for the delivery lead, not an engineering
   default to assume.
6. **A staging-specific `SENTRY_DSN`** (see `docs/implementation/phase-1f-observability.md`), once
   a real Sentry project exists at all — so staging errors don't mix into the same event stream as
   production ones. Not blocking today since no real `SENTRY_DSN` exists yet for either
   environment.

## 4. Recommendation (not a decision — for the project/infrastructure owner)

Given the low current traffic and the fact that `main` already deploys directly to what functions
as production, the lowest-cost real staging setup would be: (a) create one Neon branch off the
production database, (b) set that branch's connection string as the Preview-scope `DATABASE_URL`
on both Vercel projects, and (c) treat ordinary Preview-deployment URLs as "staging" rather than
building a separate persistent staging domain — deferring #3/#4 above until SSO testing on
Preview URLs is actually needed. This keeps the existing "push a branch, get a URL" workflow
intact while finally isolating Preview traffic from real data. This is a recommendation only; no
part of it has been actioned.

## 5. Explicitly out of scope for this document

- Actually creating any Neon branch, Vercel environment variable, or Google OAuth redirect URI —
  all provisioning actions reserved for the project/infrastructure owner.
- A CI deploy job — `.github/workflows/ci.yml` has none today and this document does not propose
  adding one; Phase 1F's brief explicitly rules out an automatic production deploy.
- Custom domains for either project — an infrastructure-owner decision independent of staging.
