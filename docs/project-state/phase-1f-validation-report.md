# Phase 1F Validation Report — Application Shell, Module Registry, Observability & Staging Foundation

**Status:** Full validation of all Phase 1F work on branch `phase-1f-application-shell`, not yet
pushed or gated. Follows the same discipline as `docs/project-state/phase-1a-validation-report.md`
through `phase-1e-validation-report.md`.

**Environment:** Node.js 22.18.0 (nvm-managed), pnpm 11.20.0 via corepack — same documented
Node-version note as every prior phase's report. Local PostgreSQL 17 (Homebrew), one fresh
disposable database per validation pass.

---

## 1. Scope — 13 commits on one branch, off `main` at the approved Phase 1E gate

Branch created from `main` at `dc94d9111fc7321ed2a717925676cdf5044a5227` (the G4-1E gate's approved
commit — see `docs/project-state/phase-1e-approval-checklist.md`'s "Sign-off"). Current branch HEAD:
`daaa29259e6ee650c76b03f871fe7b5e1185ccf6` before this document's own commit.

| #   | Commit    | Summary                                                                                |
| --- | --------- | -------------------------------------------------------------------------------------- |
| 1   | `f6ff367` | Phase 1F kickoff: task package, pre-implementation verification, conflict record       |
| 2   | `e9f0074` | Extend `module_registry` with the full Phase 1F field set (migrations `00034`/`00035`) |
| 3   | `ecb5151` | Module-registry and permission-mapping validation (brief §26/§27)                      |
| 4   | `bbc831d` | `GET /me/navigation` — registry-driven, permission-aware module list                   |
| 5   | `7245bf6` | `packages/ui` design tokens + shared page-shell/state components                       |
| 6   | `524445d` | `GET /me` — the caller's own basic identity                                            |
| 7   | `5dad812` | The authenticated application shell (`dashboard-web`)                                  |
| 8   | `4e91cc1` | Observability foundation: redaction coverage, build metadata, Sentry                   |
| 9   | `bffcaac` | Automated WCAG 2.2 AA accessibility checks (axe-core)                                  |
| 10  | `53189bf` | Staging environment foundation documentation (provisioning boundary)                   |
| 11  | `c974d72` | Module implementation roadmap + task-package template                                  |
| 12  | `9f68894` | Fixes from the independent code review (8-angle, high effort)                          |
| 13  | `daaa292` | 6 of 9 required implementation docs                                                    |
| 14  | `4085dc3` | Security review                                                                        |

Two migrations (`00034`, `00035`) — no other phase's migrations were touched. 86 files changed,
5746 insertions, 87 deletions (`git diff --stat main...HEAD` as of commit `daaa292`; this
document's own commit and the two remaining below add a small amount on top).

## 2. Final test counts (fresh disposable PostgreSQL 17, re-verified after the code-review fixes)

- **Monorepo typecheck/lint/format:** clean across all 14 packages (`pnpm typecheck`, `pnpm lint`,
  `pnpm format`) — zero errors, zero warnings.
- **Unit tests (all 14 packages, `pnpm test`):** all passing. `dashboard-api`: 294/294 (39 files).
  `dashboard-web`: 8/8 (2 files). `packages/ui`: 23/23 (3 files, +2 new since the token-wiring fix).
  `packages/configuration`: 18/18. `packages/shared-types`: 2/2. Every other package's existing
  suite unaffected.
- **Migration up/down round trip** (`packages/database`, fresh disposable database): clean, all 35
  migrations (33 pre-existing + `00034`/`00035`).
- **Database integration tests** (`packages/database`, real disposable Postgres): 108/108 passing
  (10 files) — unchanged count from Phase 1E, confirming no regression from the registry extension.
- **Module-registry and permission-mapping validation** (`pnpm --filter @webdesk/database
validate:module-registry`): passed — 43 modules, 21 permission groups, all references resolve.
- **`dashboard-api` e2e tests** (real disposable Postgres, real NestJS app): 79/79 passing (10
  files) — includes the new `GET /me`/`GET /me/navigation` blocks in `authz.e2e-spec.ts`
  (super_admin sees 43 modules, read_only sees 36) and the build-metadata assertions in
  `health.e2e-spec.ts`.
- **`dashboard-web` Playwright suite** (real `next dev` server): 9/9 passing (2 files) — 5 shell/
  redirect/header smoke tests + 3 axe-core WCAG 2.2 AA checks (sign-in, health, not-found pages —
  zero violations) + 1 additional security-header check added during the code-review fix pass.
- **Production build** (`pnpm build`, all 14 packages via Turborepo): clean.
- **`pnpm audit`:** 0 vulnerabilities.
- **Secret-pattern scan** (`node scripts/scan-secrets.mjs`): clean, 530 tracked files.
- **Workspace-boundary check** (`depcruise`): 0 errors, 4 pre-existing warnings (orphan-file
  warnings on setup/logger files not imported by any other module — same class already present
  before this phase, not a real boundary violation).

## 3. Independent code review — findings and disposition

Ran this project's own `code-review` skill (8 finder angles, high effort, recall-biased) against
the full branch diff (`git diff main...phase-1f-application-shell`) before writing this report —
the same discipline every prior phase has used. See the "Fix findings from independent code review
of Phase 1F" commit for the full diff.

**14 findings surfaced, deduplicated from the 8 angles' raw output; 9 fixed, 5 recorded as tracked
debt:**

| #   | Finding                                                                    | Verdict   | Disposition                                                                                    |
| --- | -------------------------------------------------------------------------- | --------- | ---------------------------------------------------------------------------------------------- |
| 1   | `globals.css` dropped `font-family` entirely outside the shell             | CONFIRMED | **Fixed**                                                                                      |
| 2   | 5 design-token groups never wired into `toCssCustomProperties()`           | CONFIRMED | **Fixed**                                                                                      |
| 3   | `API_VERSION` hand-duplicated across 3 files                               | CONFIRMED | **Fixed**                                                                                      |
| 4   | Sidebar nav groups rendered alphabetically, not the approved order         | CONFIRMED | **Fixed**                                                                                      |
| 5   | `error.tsx`/`not-found.tsx` rendered duplicate/conflicting headings        | CONFIRMED | **Fixed**                                                                                      |
| 6   | Missing `NEXT_PUBLIC_API_BASE_URL` silently became "signed out," no log    | CONFIRMED | **Fixed**                                                                                      |
| 7   | `getServerSession()` relied on implicit fetch memoization for dedup        | PLAUSIBLE | **Fixed**                                                                                      |
| 8   | Registry-mapper test weakened to `objectContaining`                        | CONFIRMED | **Fixed**                                                                                      |
| 9   | Security-header e2e test covered `/health`, not the real landing page      | CONFIRMED | **Fixed**                                                                                      |
| 10  | `NavigationService` reimplements capability-filter logic + redundant query | CONFIRMED | Tracked debt — architectural, not a vulnerability (see security review §4)                     |
| 11  | Sentry forwards unscrubbed exceptions, no `beforeSend` filter              | PLAUSIBLE | Tracked debt — currently inert (no DSN); must fix before one is set (see security review §2.1) |
| 12  | `GET /me` vs `GET /me/navigation` disagree on disabled accounts            | PLAUSIBLE | Tracked debt — narrow window, low severity (see security review §2.2)                          |
| 13  | `route` cast as non-null during a transient migration gap                  | PLAUSIBLE | Tracked debt — narrow window CI's own migration-together practice avoids                       |
| 14  | 43 module keys hand-duplicated across 3 files                              | CONFIRMED | Tracked debt — real DRY issue, deferred (touches a migration file)                             |

Full findings text, failure scenarios, and reasoning for each disposition: see the code-review fix
commit message and `docs/implementation/phase-1f-security-review.md` §2/§4.

## 4. Security review

See `docs/implementation/phase-1f-security-review.md` in full — a right-sized pass for this
phase's actual surface (no new business data model exists this phase). No Critical or High finding
blocks Phase 1F. One finding (unscrubbed Sentry exception forwarding) is explicitly flagged as a
precondition that must be closed before a real `SENTRY_DSN` is ever configured, not something this
review treats as validated.

## 5. Documentation and traceability

`docs/phase-plans/phase-1-foundation-plan.md` carries the Phase 1F kickoff addendum (commit
`f6ff367`). `outputs/webdesk-growth-dashboard/HANDOFF.md` and
`docs/traceability/phase-0-requirements-traceability.md` are updated in the commit immediately
following this report (see "Recent decisions" entries dated 2026-08-14).

## 6. What remains before a Phase 1F gate can be requested

- ~~Independent code review~~ — **complete** (§3).
- ~~Security review~~ — **complete** (§4).
- `docs/project-state/phase-1f-approval-checklist.md` — produced alongside this report.
- ~~Required second-role human review~~ — **complete**. Jitesh D and Brijesh D reviewed the full
  code-review disposition (9 fixed / 5 tracked as debt) and the full security review (no
  Critical/High finding; Sentry `beforeSend` precondition) — decision **Approved as-is**,
  2026-08-14, no disputes raised. See
  `docs/project-state/phase-1f-approval-checklist.md`'s "Sign-off" section.
- **A Phase 1F gate decision** — not yet requested; remains separate from the review above, per
  every prior phase's own pattern of keeping the review and the gate decision distinct.
- **Git workflow completion** — push the branch, open a PR. Per the brief's own explicit
  instruction (§49: "Stop after Phase 1F. Wait for human approval") and this project's standing
  rule, **no merge, no production deploy, and no Wave 1 / module-implementation start** happens
  automatically once this branch is pushed.
