# Current-project context propagation fix — Approval Checklist

## Scope

Closes the long-deferred "current project" context propagation gap (item
13's gap (5) in `CLAUDE.md`, scoped and deliberately deferred on
2026-08-20 and again on 2026-08-22). Built directly after the user pointed
at a live Technical Center screenshot and said the in-page project
selector was "useless as we have already given the project selection on
the top bar." Scope confirmed directly with the user (`AskUserQuestion`):
fix Technical Center only, or all 6 project-scoped modules — the user
chose the broader fix. Page Workspace was added as a 7th/8th affected
file since it shares the identical pattern.

Two changes: (1) the header `ProjectSwitcher` now calls `router.refresh()`
after writing `CURRENT_PROJECT_COOKIE`; (2) all eight project-scoped
pages (Page Inventory, Scan Center, Technical Center, Change Center,
Internal Linking Library, Keyword & Entity Library's keywords and
entities routes, Page Workspace) resolve their project id as
`projectIdParam ?? defaultProjectId` instead of requiring the URL param
outright, and the dead "Switch project" link (it silently pointed at the
SAME project id, only ever clearing filters) was removed from the six
pages that had one. No backend change. See
`docs/implementation/current-project-context-propagation-fix.md` for the
full account.

## Independent verification

- `pnpm --filter dashboard-web typecheck` — clean.
- `pnpm --filter dashboard-web lint` (`eslint --max-warnings=0` +
  CSS-token-check, 99 files) — clean.
- `pnpm --filter dashboard-web test` — 1823/1823 tests passing, unchanged
  (no test asserted on the removed link or the old picker-first
  behavior).
- `pnpm --filter dashboard-web build` — clean, all touched routes
  present.
- `prettier --check` — clean.
- Live-rendered in the Browser pane: all seven affected routes
  (`/page-inventory`, `/scan-center`, `/technical-center`,
  `/change-center`, `/internal-linking-library`,
  `/keyword-and-entity-library`, `/keyword-and-entity-library/entities`,
  `/page-workspace`) redirect an unauthenticated visitor to
  `/auth/sign-in` cleanly, zero console errors. No local
  `dashboard-api`/database was available in this environment, so the
  authenticated success path (a project auto-resolving from the header
  cookie with no picker shown) wasn't visually confirmed — the same
  limitation several prior `dashboard-web` slices in this app have
  already noted for themselves.

## Review

Reviewed at **light tier**, per the 2026-08-27 "right-size the review
pipeline" standing rule — a frontend-only routing/UX fix touching no new
endpoint, no new RBAC/auth logic, and no new sink; every one of the eight
pages already fetches through its own already-reviewed, already-gated
fetch function, and only the origin of the `projectId` string (URL vs.
cookie) changes. A direct read-through pass covered the empty-string
cookie edge case (selecting "All projects" in the header writes an
empty-string cookie value, which the `effectiveProjectId ? ... : null`
truthy checks throughout correctly treat as "no project," falling
through to the picker exactly as a genuinely-unset cookie would) and
confirmed `clearFiltersHref` remains legitimately used for "Clear
filters" on every page after the "Switch project" link's removal
(verified via `grep -c` per file: 3 occurrences before and after — 1
declaration + 2 real uses). **0 findings.** No separate security review —
no new endpoint, no new sink, no auth-relevant code touched.

## Sign-off

Required second-role human review (ADR-0010): _pending._

Gate `G4-current-project-context-propagation`: _pending._

This checklist itself does not authorize pushing the branch, opening a
PR, or merging — each remains its own separate, not-yet-requested
authorization, per this project's standing "no auto-merge" rule.
