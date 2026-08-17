# Tables and Filters

**Status:** Proposed, pending approval. Tables are, per the design prompt's own framing (§8), "a
major UI pattern" — this system has more dense tabular screens than any other single pattern
(Page Inventory, Ready for Claude Queue, every one of the 25 library modules, Scan/Change/Release
Center). One canonical table system, used identically everywhere — this document is the
concrete spec behind Principle 2.3 (Consistency) in `00-dashboard-design-principles.md`.

## 1. Anatomy

`PageHeader` (primary action) → `FiltersBar` (search + structured filters) → `Table` → footer row
(`Pagination` + result count, e.g. "Showing 1–25 of 118"). This exact shape is already live for
the Projects list page and is kept as the standard, not redesigned.

## 2. Column headers and sort

Every sortable column header is a button (not a bare label), showing a subtle chevron only on the
currently-active sort column (ascending/descending), and a neutral (no chevron) state otherwise —
avoids cluttering every header with an inactive icon. Sort state lives in the URL query string
(`?sortBy=updatedAt&sortOrder=DESC`), matching the already-live Projects list page's pattern
exactly — server-rendered, bookmarkable, no client-side sort state that can drift from what's
actually displayed.

## 3. Filters and search

Per design prompt §16: do not place every possible filter permanently on screen. Default visible:
a search input plus at most 2–3 of the module's most common filters (status is almost always one).
Additional filters (owner, type, date range, version, approval state) live behind a "More filters"
toggle that expands the `FiltersBar`. All filter state lives in the URL query string, same
reasoning as sort — a filtered view is a real, shareable/bookmarkable URL, not ephemeral client
state. **Saved/filter state** (design prompt's own optional mention) is deferred — no module spec
names a concrete requirement for it yet; add only when a specific module's task package identifies
a real need (e.g. an operator who reruns the same complex filter daily).

## 4. Row selection and bulk actions

Row-selection checkboxes appear only for modules whose own spec names a bulk operation — most of
the 43 modules don't. Where present: a checkbox column, a header "select all on this page"
checkbox (never silently "select all matching filter" without an explicit, separate "select all
118 results" affordance shown only after the page-level checkbox is checked — a well-known bulk-
action footgun this design avoids by construction). Selecting ≥1 row reveals a bulk-action bar in
place of the `FiltersBar` region, per `07-page-patterns.md` archetype A.

## 5. Status column

Always the `StatusBadge` component (`05-dashboard-design-tokens.md`'s `statusBadgeTokens`), never
a bare colored cell or colored text — the one column every table shares in common, and the
clearest place Principle 2.6 (approval visibility) has to hold up consistently across 43 modules.

## 6. Row actions

Collapse into a single trailing icon-button ("⋯") opening a `Dropdown`, per Direction A's density
stance (`01-visual-directions.md`) — not a row of separate visible buttons, which doesn't scale
past 2 actions without crowding. Exception: exactly one primary row action (usually "View" or
"Open") is the entire row's own click target (the whole `<tr>` navigates), so the dropdown only
needs to hold secondary actions (Edit, Archive, Duplicate).

## 7. Avoiding horizontal scroll (design prompt §8's explicit instruction)

Per-module discipline, not a single mechanical rule:

- **Default:** every table fits within the standard `1280px` `ContentMaxWidth`. Columns beyond
  what fits move to: row expansion (an inline-expand triangle revealing 2–3 secondary fields
  without leaving the table), a `Drawer` quick-preview (per `07-page-patterns.md`), the record's
  own detail page, or a `Tooltip` for a single short supplementary value only.
- **Wide exception:** Page Inventory and Ready for Claude Queue specifically (per
  `05-dashboard-design-tokens.md` §6) — both have enough genuinely primary columns (Page
  Inventory: page name, URL, type, index status, phase, stage, keyword, canonical, last scan,
  last release; Ready for Claude: ID, title, priority, agent, project, stage, PR status, reviewer,
  due date) that truncating them into row-expansion would hide information users need at a glance,
  not just secondary detail. These two screens use `contentMaxWidthWide` (`1600px`) instead of
  forcing artificial column reduction. This is a deliberate, named exception — not a default other
  modules should reach for without the same justification.
- **Never:** a table that scrolls horizontally by default on a standard laptop viewport. If a
  module's real column set doesn't fit even at `1600px`, that's a signal to apply row-expansion/
  drawer treatment to that module specifically, not to introduce horizontal scroll as a fallback.

## 8. Dense vs. comfortable

Default: **dense** (per Direction A, `01-visual-directions.md`) — `controlSizeTokens.sm`-height
rows, tight vertical padding. A comfortable-density toggle is not built by default; it's a genuine,
justified addition only if user feedback after real usage shows dense rows cause errors (e.g.
misclicking adjacent rows) for a specific module — not spec'd speculatively now.

## 9. States

- **Loading** — a skeleton row set matching real column structure (see `07-page-patterns.md`
  §"Loading states"), not a spinner replacing the whole table.
- **Empty** — `EmptyState`, module-specific message + authorized action, per
  `07-page-patterns.md` §"Empty states."
- **Error** — the table region itself renders `ErrorState` (correlation ID included) in place of
  rows; the `PageHeader` and `FiltersBar` stay visible and usable (a filter change might resolve
  the error) rather than the whole page collapsing to an error screen.

## 10. Responsive behavior

Below the tablet breakpoint (`768px`, per `05-dashboard-design-tokens.md`/`13-responsive-behavior.md`),
tables reflow to a stacked-card layout — each row becomes a small `Card` showing the same fields
as labeled key/value pairs, `StatusBadge` retained prominently. This is a real layout change, not
CSS-only column-hiding, since a data table genuinely doesn't work as a table on a narrow viewport.
See `13-responsive-behavior.md` for the exact breakpoint table.
