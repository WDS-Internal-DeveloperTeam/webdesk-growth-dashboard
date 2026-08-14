# Phase 1F — Registry-Driven, Permission-Aware Navigation (as-built)

**Status:** Records what was actually built for brief §9/§10 — navigation derived from the module
registry plus the caller's real effective capabilities, with backend route authorization remaining
the actual enforcement point regardless of what navigation shows.

## 1. What exists

- **`apps/dashboard-api/src/authz/navigation.service.ts`** — `NavigationService.getNavigation(userId, projectId?)`.
  A module appears only when BOTH:
  1. `v1InclusionStatus === "included"` (today, all 43 rows — see `phase-1f-module-registry.md`).
  2. The caller's real effective capabilities
     (`AuthorizationService.getEffectiveCapabilities()`, Phase 1D-expanded — not re-derived or
     duplicated here) grant the module's own `viewPermissionAction` under the permission group it
     maps to.
- **`GET /me/navigation`** (`apps/dashboard-api/src/authz/navigation.controller.ts`) —
  `SessionGuard`-only (any authenticated user), returns the filtered list for the caller. Not
  `PermissionGuard`-gated by design — the endpoint's entire job is computing what the caller may
  see, so it can't itself require a permission the caller might not have.
- **`GET /me`** (`apps/dashboard-api/src/auth/me.controller.ts`) — returns
  `{id, email, displayName}` for the current session. Throws `InternalServerErrorException` (not a
  bare `Error`, consistent with `AllExceptionsFilter`'s error-shape contract) if the session
  references a user row that no longer exists — a real, if rare, integrity fault rather than a
  silently empty response.
- **`apps/dashboard-api/src/authz/module-registry.mapper.ts`** — `toModuleRegistrySummary()`, a
  single shared entity→DTO conversion used by both `CatalogService` (the pre-existing, unfiltered
  registry-browsing endpoint) and `NavigationService`, so the two never drift into two different
  ideas of what a `ModuleRegistrySummary` looks like. `canView` is deliberately left `undefined` by
  the shared mapper — only `NavigationService` sets it to `true` for entries it has confirmed.

## 2. The authorization decision this makes — and the one it deliberately does not make

`NavigationService` decides **discoverability** — whether a module shows up in the sidebar at all.
It does **not** decide **access** — whether a request to that module's actual API routes succeeds.
Those are enforced independently by `PermissionGuard`/`@RequirePermission` on each module's own
routes, once built (brief §9/§10/§28's own explicit instruction, repeated here because it is easy
to conflate the two). Today this distinction is only theoretical for 42 of the 43 modules — no
route exists yet for them to enforce on — but it is real and already exercised for the "Users,
Roles and Permissions" module, whose real HTTP surface (Phase 1D) has its own independent
`PermissionGuard` checks that this navigation filter neither replicates nor substitutes for.

## 3. Real verification against seeded data (not just a unit-test fixture)

`apps/dashboard-api/test/authz.e2e-spec.ts`'s `GET /me/navigation` block runs against a real
disposable database with the real seeded 7-role/21-group/458-grant RBAC matrix (migration `00013`)
and the real 43-row module registry (migrations `00015`/`00034`/`00035`):

- A `super_admin` session (which holds `view` on all 21 permission groups) sees **all 43** modules.
- A `read_only` session (missing `view` on 2 of the 21 groups — `users_roles` and
  `system_settings`) sees **36** modules: 43 minus the 1 module gated by `users_roles`
  (`users_roles_permissions`) minus the 6 modules gated by `system_settings`
  (`decision_and_activity_log`, `notification_center`, `integrations`, `system_settings` itself,
  `audit_logs_and_system_health`, plus one more — see the test file for the exact enumerated set).

This is the test that caught the real design bug described in §4.

## 4. A real bug this caught: `viewPermissionAction` was initially wrong

The first draft set `viewPermissionAction` to a per-module string (`"${key}_view"`, e.g.
`"page_inventory_view"`) — a plausible-looking design that turned out to match **nothing** in the
real seeded RBAC grants. Migration `00013` only ever grants a single, plain `"view"` action per
**permission group** (the 21-row table), shared by every product module under that group — this
directly matches brief §3's own framing ("multiple UI modules may map to the same permission
group"). The per-module string would have silently left navigation **empty for every role**,
including `super_admin`, since no such grant exists or was ever seeded. Caught before merge by
dispatching a research check against the real `role_permissions` grant data (not assumed from the
schema alone), then fixed in migration `00035` by setting `viewPermissionAction: "view"`
uniformly across all 43 rows, and confirmed by the real e2e counts in §3 above.

## 5. What was deliberately not built

- No caching of `getEffectiveCapabilities()` beyond what Phase 1D-expanded already does — brief
  §23/§24's session/cache-freshness strategy governs this and isn't re-litigated here.
- No per-request navigation customization (pinned items, reordering) — out of scope, not requested.
- No navigation entry for a module whose `v1InclusionStatus` isn't `included` — moot today since
  all 43 rows are `included`, but the filter exists and is tested
  (`navigation.service.spec.ts`) for when a future registry change introduces a `deferred`/
  `future` row.
