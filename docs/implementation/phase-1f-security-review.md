# Phase 1F — Security Review

**Status:** A lightweight, right-sized security pass for this phase's actual surface — the
application shell, module registry, navigation authorization, and observability foundation. Phase
1F builds no new business functionality and no new sensitive data model (see
`docs/implementation/phase-1f-module-registry.md` — every module's `implementation_status` is
`not_started`), so this is deliberately not a full STRIDE document on the scale of
`docs/security/threat-model-authorization-rbac.md` (Phase 1D) or
`docs/security/threat-model-phase-1e-operational-infrastructure.md` (Phase 1E) — those covered new
data models and permission grants; this phase's new surface is two read-only identity/discovery
endpoints, a navigation filter, and observability plumbing.

## 1. What's actually new, security-relevant

1. `GET /me` — the caller's own identity (id/email/displayName). `SessionGuard` only.
2. `GET /me/navigation` — the caller's permission-filtered module list. `SessionGuard` only.
3. `NavigationService`'s capability-based filtering logic.
4. `/health`/`/ready` now expose build metadata (`version`, `commitSha`, `environment`,
   `deploymentId`, `processStartedAt`) — both endpoints remain unauthenticated (no guard), same as
   Phase 1A.
5. Sentry error forwarding (currently inert — no real `SENTRY_DSN` exists).
6. Extended Pino redaction coverage.

## 2. Independent code review — findings with security relevance

The full independent code review (8-angle, high effort — see the commit "Fix findings from
independent code review of Phase 1F") surfaced two findings with real, if narrow, security
relevance. Both were left unfixed, deliberately, with reasoning recorded here rather than silently
resolved:

1. **Unscrubbed exceptions forwarded to Sentry — no `beforeSend` filter (PLAUSIBLE).**
   `AllExceptionsFilter` forwards every 5xx exception to `captureException()` with no PII/secret
   scrubbing. This project has a documented history (`CLAUDE.md`'s decision log) of errors that
   embedded sensitive detail — a Postgres connection error containing part of `DATABASE_URL`, an
   `openid-client` token-exchange error. **Currently zero real exposure**: Sentry is inert (no
   `SENTRY_DSN` configured anywhere — see `docs/project-state/setup-input-register.md`), so nothing
   has ever actually been sent anywhere. **This must be fixed before a real `SENTRY_DSN` is ever
   set** — tracked here explicitly as a precondition, not forgotten. The fix (a `beforeSend` hook
   scrubbing known-sensitive substrings, or at minimum never forwarding raw error messages/stack
   traces without a scrub pass) belongs in `apps/dashboard-api/src/observability/sentry.ts`.
2. **`GET /me` has no `accountStatus` check, unlike `GET /me/navigation` (PLAUSIBLE).**
   `MeController.getMe` loads the user purely by session-bound id and returns identity data without
   checking `user.accountStatus === "active"` — `AuthorizationService.getEffectiveCapabilities()`
   (which `GET /me/navigation` calls) explicitly treats a non-active account as no-access.
   **Accepted as tracked technical debt**, not fixed in this pass: the exposure is narrow (a
   disabled-but-not-yet-session-revoked caller sees only their own already-known identity — id,
   email, displayName — never another user's data, and never a capability grant), and the window
   only exists between an admin disabling an account and session revocation completing (both Phase
   1C mechanisms, unchanged here). Worth aligning in a future pass, not blocking Phase 1F.

Two more, lower-severity findings from the same review are cleanup/maintainability, not security,
so aren't repeated here (see the code-review fix commit for the full disposition of all 14
findings).

## 3. Build metadata on unauthenticated `/health`/`/ready` — a deliberate, bounded exposure

`build.commitSha`/`build.version`/`build.environment`/`build.deploymentId` are now returned by
both `/health` and `/ready`, neither of which requires authentication (unchanged from Phase 1A —
health probes must be reachable by infrastructure without credentials). This is a real information
disclosure (CWE-200 class) an external scanner would flag: an unauthenticated caller can learn the
exact deployed commit SHA and environment. This is a **deliberate, brief-authorized choice**, not
an oversight — Phase 1F brief §24 explicitly asks for "build/release metadata... safe to expose,"
and exposing build info on health endpoints is standard operational practice (Kubernetes, most
cloud platforms' own status endpoints do the same). The actual risk is low: a commit SHA alone
doesn't grant access to anything, and this repository isn't public. No change made here; recorded
so this is a documented, considered decision rather than something a future reviewer has to
rediscover.

## 4. Navigation authorization — correctness confirmed, not just built

`NavigationService`'s filter is a **discoverability** control, not an **access** control — this is
stated explicitly in its own doc comment and confirmed by real, seeded-data e2e tests (see
`phase-1f-navigation-authorization.md` §3): `super_admin` sees all 43 modules, `read_only` sees
exactly the 36 it's actually granted `view` on. Backend route authorization
(`PermissionGuard`/`@RequirePermission`) remains the real enforcement point for the one module that
already has real routes (Users/Roles/Permissions, Phase 1D) — Phase 1F does not touch that guard.

**Design debt, not a vulnerability, recorded for the roadmap:** the independent code review's
altitude-angle finding (`NavigationService` reimplements capability-filtering logic inline instead
of calling into `AuthorizationService`) is real but architectural, not a security hole — the filter
still produces correct deny-by-default results, confirmed by the e2e counts above. Generalizing
this into `AuthorizationService` itself (e.g. a `filterViewable()` method) is left as a candidate
for a future observability/navigation follow-up, not this phase.

## 5. Redaction coverage — verified against real field names, not assumed

See `phase-1f-observability.md` §2 for the full table. Every new redaction path was checked against
a real field name actually used in this codebase (not a category label that sounds right but
matches nothing) — this matters specifically because Pino's `fast-redact` `*.field` wildcard only
matches one level deep, a real limitation flagged by the code review's line-by-line pass but not
newly introduced by this phase (the same limited-depth pattern already existed for `*.password`
before Phase 1F; this phase extends the same mechanism to genuinely new sensitive fields, it
doesn't change the mechanism's own reach).

## 6. What this review does not cover

- No new business data model exists this phase — nothing to threat-model beyond what's above.
- Does not re-review Phase 1C/1D/1D-expanded/1E's own security surfaces — those have their own
  completed, second-role-reviewed threat models, unchanged by this phase.
- Sentry's real behavior once a DSN is configured is untested (necessarily — none exists). The
  `beforeSend` scrubbing gap (§2.1) must be closed before that day, not treated as validated by
  this review.

## 7. Disposition summary

| Finding                                                | Severity                          | Action                                                                            |
| ------------------------------------------------------ | --------------------------------- | --------------------------------------------------------------------------------- |
| Sentry forwards unscrubbed exceptions                  | Real but currently inert (no DSN) | **Must fix before any real `SENTRY_DSN` is set** — tracked, not blocking Phase 1F |
| `/me` vs `/me/navigation` accountStatus asymmetry      | Low, narrow window                | Accepted as tracked technical debt                                                |
| Build metadata on unauthenticated health endpoints     | Low, brief-authorized             | Documented as a deliberate choice, no action                                      |
| Navigation filter reimplements capability logic inline | Design debt, not a vulnerability  | Candidate for a future follow-up                                                  |

No Critical or High finding blocks Phase 1F. This document itself does not constitute the required
second-role human security review — that remains a separate, explicit step per this project's
established pattern (see `docs/project-state/phase-1f-approval-checklist.md`).
