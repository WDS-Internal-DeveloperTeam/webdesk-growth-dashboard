# Navigation System

**Status:** Proposed, pending approval alongside the rest of this package. Builds on — does not
replace — the live `AppShell` component (`apps/dashboard-web/components/app-shell.tsx`); see
`16-existing-shell-gap-analysis.md` for exactly what's kept as-is versus extended here.

## 1. Left / global navigation

### 1.1 Structure — kept as-is, extended for density

The sidebar keeps its existing mechanism exactly: render `GET /me/navigation`'s entries, grouped
by `navigationGroup`, ordered by the hardcoded `APPROVED_NAVIGATION_GROUPS` sequence (not the
API's alphabetical default), each group labeled from the existing `NAV_GROUP_LABELS` map. What's
added:

**`libraries` gets the 5-cluster sub-heading treatment from `03-information-architecture.md`**,
rendered as small, non-interactive, uppercase labels between module links inside that one group
only (every other group is small enough — 1 to 6 modules — to stay a flat list). Cluster
boundaries, by each module's real `navigationOrder`:

| Cluster                  | Modules (in seeded order)                                                                                                                                                                                                |
| ------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Strategy & Business      | Business Knowledge Center, Website Strategy Center                                                                                                                                                                       |
| Case Studies & Portfolio | Case Study Studio, Case Study Library, Portfolio Library                                                                                                                                                                 |
| Design System            | Brand Library, Design Reference Library, Asset Library, Design Token Library, Component Library, Section & Pattern Library, Page Template Library, Wireframe Library, Motion & Interaction Library, Design Review Center |
| Content & Search         | Service Library, Persona Library, Proof & Claims Library, Keyword & Entity Library, Internal Linking Library, Content Template Library                                                                                   |
| Agents & Knowledge       | Agent Directory, Agent Specification Library, Knowledge Library, Workflow & Task Template Library                                                                                                                        |

Worth noting: this cluster boundary falls out naturally from the seed data's own
`navigationOrder` sequence (1–2, 3–5, 6–15, 16–21, 22–25) — it is not an arbitrary re-sort, only a
labeling of a grouping the data already implies. A user with a reduced role (e.g. Read-Only sees
fewer than 25 library modules) sees the same clusters with fewer items, never an empty cluster
header — a cluster with zero visible modules for the current user is omitted entirely.

### 1.2 Collapsed state — genuinely new, not currently built

`layoutTokens.sidebarWidthCollapsed` (`64px`) already exists but is unused (confirmed in
`16-existing-shell-gap-analysis.md`). Add a persistent desktop collapse toggle (icon-only sidebar,
tooltip-on-hover module names, group labels hidden) — persisted client-side (a cookie or
`localStorage`, implementer's choice, no server round-trip needed since it's pure display
preference, not permission-relevant). Collapsed state hides the 5 library-cluster sub-headings
entirely (icon-only mode has no room for them); expanding restores them.

### 1.3 Active module

Kept exactly as today: `aria-current="page"` via `pathname === entry.route ||
pathname.startsWith(entry.route + "/")`. No change.

### 1.4 Permission-based visibility

Kept exactly as today: the server (`NavigationService`) already filters; the client never
re-derives that decision. See `03-information-architecture.md` §4.

### 1.5 Mobile/tablet behavior

Kept exactly as today for mobile (off-canvas slide-in below `768px`, hamburger toggle, `200ms`
transition) — this already works and is already covered by the RTL unit test
(`tests/unit/app-shell.test.tsx`). **New:** define the currently-undefined **tablet** breakpoint
behavior — see `13-responsive-behavior.md` for the full breakpoint table; in short, tablet
(768–1024px) gets the collapsed icon-only sidebar from §1.2 by default rather than either the full
expanded sidebar or the mobile off-canvas pattern, since neither of those two existing states fits
a tablet's actual width well.

## 2. Header / top bar

Current header (confirmed live): `[Mobile nav toggle] Logo | Project Switcher | [spacer] | User
name, Sign out`. The approved wireframe (`07_Low_Fidelity_Wireframes.md` §1) specifies: `Logo |
Project Switcher | Search | Notifications | User`. Closing that gap:

| Element               | Status               | Design decision                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                         |
| --------------------- | -------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Logo/brand link       | Live, kept           | No change — links to `/home`.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                           |
| Project Switcher      | Live, kept           | No change to its mechanism; see `16-existing-shell-gap-analysis.md` for the still-open "downstream consumer" gap (out of this design task's scope — a data-wiring problem, not a UI one).                                                                                                                                                                                                                                                                                                                                                                                               |
| Search                | **New**              | Global search per `03-information-architecture.md` §6 — a single input in the header, `⌘K`/`Ctrl+K` shortcut, opens a command-palette-style overlay (see `06-dashboard-component-system.md`'s Command/action menu entry) rather than navigating away from the current page.                                                                                                                                                                                                                                                                                                             |
| Notifications         | **New**              | A bell icon with an unread-count badge, opening a drawer (see `17-side-panels-and-drawers` pattern in `07-page-patterns.md`) listing recent notifications. Backend note: Phase 1E's `notifications` table and `NotificationService` already exist (`apps/dashboard-api/src/notifications/`) but have no delivery adapter configured and no `dashboard-web` consumer yet — this design task specifies the UI only; wiring it to real data is implementation, not design, scope.                                                                                                          |
| Help                  | **New**              | A `?` icon linking to the Help Center module (module #38, `help` nav group) — not a separate help system, just a fast entry point to the existing module.                                                                                                                                                                                                                                                                                                                                                                                                                               |
| User/account          | Live, extend         | Currently plain text + a "Sign out" link. Extend to a proper dropdown menu (avatar-or-initials, name, email, "Sign out") — see `06-dashboard-component-system.md`'s Avatar + Dropdown entries. No new backend data needed; `AuthenticatedUser` already carries `displayName`/`email`.                                                                                                                                                                                                                                                                                                   |
| Environment indicator | **New, conditional** | A small badge (e.g. "Staging") shown **only** when `NEXT_PUBLIC_...`/build metadata indicates a non-production environment — production shows nothing (an always-visible "Production" badge on every screen is noise; an indicator that only appears in staging/preview is the useful case, preventing an operator from mistaking a preview deploy for production). Data already exists: `HealthCheckBuildInfo.environment` (Phase 1F's build-metadata work) is already exposed via `/health`; this only requires surfacing it in the header when non-production, not new backend work. |
| System status         | **New, conditional** | A small status dot, visible only when system health is degraded (never shown as a routine "all clear" badge — absence of the indicator _is_ the all-clear state, avoiding a permanent, ignorable green dot). Links to the Audit Logs & System Health module once built; until then, links to `/health`.                                                                                                                                                                                                                                                                                 |

## 3. Main workspace

Current pattern (from the live Projects pages, kept as the standard): breadcrumbs → `<h1>` page
title + optional status badge → primary/secondary actions (top-right of the header row) → content.
This already matches `packages/ui`'s existing `PageHeader` component contract exactly
(`title`, `breadcrumbs`, `statusBadge`, `contextActions`) — no redesign needed, only consistent
application across all future module pages. See `07-page-patterns.md` for how this header pattern
composes with each of the 8 page archetypes.

**Primary vs. secondary action placement:** the primary action for a screen (the one action most
users take) renders as a filled/accent button, right-most in the action row. Secondary actions
(Edit, Export, etc.) render as outline/ghost buttons to its left. Destructive or approval-gated
actions never share this row undifferentiated — see `11-approval-patterns.md` and
`22-destructive-actions` treatment in `07-page-patterns.md` for why they get their own visual
weight.

## 4. What is explicitly not changed here

The `(shell)` route group's server-side session gate, the registry-driven data flow (`GET
/me/navigation`, `GET /me`), and the Project Switcher's cookie mechanism are all kept exactly as
Phase 1F built them — this document only specifies the sidebar's visual/organizational layer and
the header's new elements, not the underlying data-fetching architecture.
