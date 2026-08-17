# Page Patterns

**Status:** Proposed, pending approval. Defines the 8 reusable page archetypes from the design
prompt (§7), each grounded in a real module from `03_Detailed_Module_Specifications.md`, plus the
cross-cutting drawer/modal/empty/loading/error/destructive-action policies the prompt requests
alongside them (§17–22). Every archetype composes from `06-dashboard-component-system.md`'s
components and `05-dashboard-design-tokens.md`'s tokens — no archetype introduces a one-off visual
pattern.

## A. Library / list screen

**Real examples:** Service Library, Persona Library, Component Library, Asset Library, Agent
Directory — any of the 25 `libraries`-group modules, plus Page Inventory.

**Structure (top to bottom):** `PageHeader` (title + primary action, e.g. "New Service") →
`FiltersBar` (search input + structured filters, collapsed to a "Filters" toggle when more than
~3 filters exist, per design prompt §16's "do not place every possible filter permanently on
screen") → `Table` (see `08-tables-and-filters.md`) → `Pagination`.

**Already live, kept as the reference implementation:** the Projects list page
(`apps/dashboard-web/app/(shell)/projects/page.tsx`) already implements this exact shape — plain
`<form method="get">` filters, sortable columns, offset pagination via a limit+1 fetch. Every
future library screen follows this same server-rendered, no-client-JS-required approach unless a
specific interaction (e.g. bulk selection) genuinely requires a client component.

**Bulk actions:** only where the module's own spec approves a bulk operation (most library modules
don't name one) — rendered as a row of buttons that appears in the `FiltersBar` region once ≥1 row
is selected, never permanently visible.

## B. Record detail screen

**Real examples:** a single Service, a single Ready for Claude task, the already-live Project
Detail page.

**Structure:** `PageHeader` (title, ID, `StatusBadge`, primary/secondary actions) → a metadata
strip (owner, version, last updated — using `fontFamilyMono` for IDs per `05-dashboard-design-tokens.md`)
→ content sections (either plain sections with heading rules, or `Tabs` if the record has more
than ~4 logically distinct groups — Page Workspace's 16 tabs is the extreme case) → relationships
(rendered via the relationship-picker's read-only display form) → Activity (`Timeline` component,
not raw audit events — see `10-status-and-workflow-system.md`) → Approval block where the record
is subject to approval (`11-approval-patterns.md`).

**Already live, kept as the reference implementation:** the Project Detail page's section-not-tabs
approach (Overview/Roadmap/Objectives/Environments/Repositories) is the correct pattern for a
record with a moderate number of sections; Page Workspace's 16-tab case is dense enough to warrant
real `Tabs` instead — the archetype supports both, chosen per record complexity, not one mandated
universally.

## C. Record editor

**Real examples:** the create/edit form for any module, already live for Projects
(`ProjectForm`).

**Structure:** sectioned form (per `09-forms-and-validation.md`), a persistent save-state indicator
(Draft saved / Unsaved changes), and two distinct submit actions where the module has a review
workflow: **Save draft** (secondary button) vs. **Submit for review** (primary button) — never
collapsed into one "Save" button once a review state exists, since they have materially different
consequences (design prompt §9, §11). Confidential fields (per RBAC's confidential-field
mechanism, already built in Phase 1D-expanded) render with a visible lock icon + restricted-access
label rather than being silently hidden — a user without access sees that a field exists and is
restricted, not that the field doesn't exist, preserving the record's real shape.

**Unsaved-changes protection:** a browser-level `beforeunload` confirmation when a client-form
component has dirty state — matches the one existing client-mutation precedent
(`app/auth/emergency/page.tsx`'s pattern of direct `fetch()` + `credentials: "include"`, per
`CLAUDE.md`'s own established convention) without inventing a new submission mechanism.

## D. Workflow workspace

**Real examples:** Page Workspace (16 tabs), Case Study Studio.

**Structure:** the record-detail archetype (B) with `Tabs` mandatory, plus a `Stepper`
(`06-dashboard-component-system.md` §6) showing overall stage progression across tabs — current
stage highlighted, completed stages checked, future stages visually de-emphasized but still
navigable for reference (view-only) if the user has permission to view but not yet act on them.
Each tab shows: required inputs for that stage, outputs already produced, review comments if the
stage was returned for revision, and the specific next action authorized for the current user —
never a generic "Next" button that doesn't reflect real permission state. Matches the Recommended
Module Roadmap's own instruction for Page Workspace: _"Claude receives only one authorized stage.
No automatic progression through stages."_ — the UI enforces the same discipline for human users:
no auto-advance, an explicit action is always required to move stages.

## E. Review screen

**Real examples:** Review & Approval Center, Design Review Center.

**Structure:** proposed version (left or top) + current approved version (right or below) via the
`Diff viewer` component, `Approval block` (comments, evidence, approve/request-revision/reject
actions), all per `11-approval-patterns.md`. This is the archetype most dependent on
`11-approval-patterns.md`'s "approval actions are never visually equivalent to a routine edit"
rule — Approve/Reject/Request Revision render as a distinct, clearly-labeled action group,
separated visually from any other page action.

## F. Operations screen

**Real examples:** Ready for Claude Queue, Scan Center, Change Center, Release Center — the 5
pipeline-shaped modules named throughout this package.

**Structure:** `Table` (list view: status, progress where applicable, actor, timestamp) → a record
detail view following archetype B, extended with the scoped `Stepper`/`Progress` treatment from
`02-recommended-direction.md`'s Direction B borrowing, plus: errors (rendered via `Alert`, not
buried in a log dump), attempts/retry count, evidence links, and a Retry action gated by the same
permission/approval rules as any other mutating action.

## G. Settings / admin screen

**Real examples:** System Settings, Integrations, Users/Roles/Permissions.

**Structure:** the record-editor archetype (C) with one difference — settings fields commonly use
`Toggle` rather than `Checkbox` (per `06-dashboard-component-system.md` §2's distinction: a toggle
implies immediate effect) and changes to system-wide configuration should show a confirmation step
before applying (a lightweight `Modal`, per design-prompt §18) rather than saving silently on blur.
Secrets (Integrations' credential fields) are never rendered in the UI once saved — matches the
Recommended Module Roadmap's own instruction: _"Never display/store secret values"_ — the UI shows
only a masked "configured" state plus a "Replace" action, never the value itself, not even to a
Super Admin.

## H. Dashboard / overview screen

**Real example:** Home — the one module every role reaches first.

**Structure:** matches the approved wireframe exactly (`03_Detailed_Module_Specifications.md`
cross-reference, `07_Low_Fidelity_Wireframes.md` §1): a widget grid (`Card` components) for
Project Health, My Work, Critical Findings, Git/Release Status — each widget permission-filtered
(a role that can't see Releases doesn't get a Git/Release Status widget, not an empty/error one).
Per the Recommended Module Roadmap's explicit instruction: _"Do not fabricate traffic, SEO, leads,
citation metrics or approval counts"_ — every widget with no real data yet renders `EmptyState`,
never a placeholder number. See `15-representative-screen-specifications.md` for the full Home
spec.

---

## Cross-cutting policies (design prompt §17–22)

### Side panels and drawers

Use a `Drawer` for: quick record preview from a list (without losing list scroll position/filter
state), notifications, and short "quick edit" of 1–3 fields. **Do not** use a drawer for anything
requiring the record-editor archetype's full validation/save-state machinery, or for any workflow
archetype (D) — those need the user's full attention on a dedicated page, per design prompt §17's
own rule.

### Modal policy

Use a `Modal` only for: confirmations (especially destructive ones, see below), and short
single-purpose forms (e.g. "Rename this draft"). **Never** for a multi-step workflow or a record
editor with more than ~3 fields — those get their own page (archetype C), per design prompt §18.

### Empty states

Every list/library screen's empty state names the actual thing that's missing and, if the current
user is authorized to create one, offers that action directly — e.g. _"No services have been added
to this project yet."_ + a "New service" button, exactly the example the design prompt itself
gives (§19). A user without create permission sees the same message with no action — never a
disabled-but-visible button, which implies an action exists when it doesn't for them.

### Loading states

Page-level navigation: a full `LoadingState`. Table refresh (filter/sort/page change): a skeleton
row set matching the table's own column structure, not a full-page spinner. Save/submit actions:
the triggering `Button`'s own built-in loading state (per `06-dashboard-component-system.md` §2),
not a separate page-level indicator. Background job progress (the 5 pipeline-shaped modules): the
scoped `Progress` component, per archetype F.

### Error states

`packages/ui`'s existing 5 error-adjacent states (`ErrorState`, `ForbiddenState`, `NotFoundState`,
`NotConfiguredState`, `DegradedState`) already cover: generic API error, unauthorized/forbidden,
not found, integration-not-configured, and degraded/partial-outage — kept exactly as the standard
set. **New, specified here:** validation errors render inline at the field (`09-forms-and-validation.md`),
never as a page-level `ErrorState`; a background-job failure (archetype F) renders via `Alert`
within the record, not a page-level error. Every error surface that includes a correlation ID
(already a real, existing pattern — `ApiErrorResponse.correlationId`) displays it plainly as
"Reference: `<id>`" — never a raw stack trace, matching this project's own existing security
posture (`AllExceptionsFilter` already never leaks stack traces to the client).

### Destructive actions

Every destructive/high-impact action (delete, archive, unpublish, rollback, revoke, remove access)
follows one pattern: a `Modal` confirmation that states the actual consequence in plain language —
never a generic "Are you sure?" (design prompt §22's own explicit example of what to avoid). The
already-live `project-status-actions.tsx` component's own precedent (confirmation only on the
one truly irreversible transition, Archive; none needed for reversible Pause/Resume) is the
correct model, kept as the standard: **confirm only what's genuinely consequential, not every
mutation** — over-confirming trains users to click through dialogs without reading them, which
defeats the purpose. Prefer archive/soft-delete over hard delete wherever the module's own spec
allows it, matching this project's existing no-hard-delete precedent (Projects module, ADR-0016).
