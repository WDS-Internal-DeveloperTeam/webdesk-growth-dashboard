# Responsive Behavior

**Status:** Proposed, pending approval. Design prompt §23: _"This is primarily a professional
desktop application, but core workflows must remain accessible at smaller widths."_ This document
defines the four breakpoints (already tokenized, currently only one is actually wired into live
CSS — see `16-existing-shell-gap-analysis.md`) and exactly how each structural element adapts at
each one.

## 1. Breakpoints (from `05-dashboard-design-tokens.md` §6)

| Token     | Value  | Real device class               |
| --------- | ------ | ------------------------------- |
| `mobile`  | 480px  | Small phone                     |
| `tablet`  | 768px  | Large phone / small tablet      |
| `laptop`  | 1024px | Tablet landscape / small laptop |
| `desktop` | 1280px | Standard laptop and up          |

The live shell today has exactly one breakpoint (`768px`, hardcoded). This document adds real
behavior at `1024px` (currently identical to desktop) and treats `480px` as a floor for mobile
layout refinement, not a fully separate layout tier — mobile behavior is defined once, for
`< 768px`, with `480px` used only for a few specific tightenings noted below.

## 2. Navigation

| Range                        | Behavior                                                                                                                                                                                                                                                |
| ---------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `≥ 1024px` (laptop, desktop) | Full expanded sidebar (`260px`) by default; user's collapse preference (`04-navigation-system.md` §1.2, `64px` collapsed) persists across sessions.                                                                                                     |
| `768–1024px` (tablet)        | **New behavior** — sidebar defaults to the collapsed icon-only state automatically (not the user's laptop/desktop preference, since a tablet's viewport genuinely can't spare `260px` the way a laptop can) — expandable on demand via the same toggle. |
| `< 768px` (mobile)           | Off-canvas slide-in (already live, kept exactly as-is) — hamburger toggle, `200ms` transform transition, `min(80vw, 260px)` width.                                                                                                                      |

## 3. Header

Kept at a fixed `56px` height (`layoutTokens.headerHeight`) across all breakpoints — the one
element that does not restructure, only its contents adapt: below `768px`, the Project Switcher
and header actions may need to compress (e.g. the user menu collapses to an avatar-only trigger
below `480px`) but the header bar itself never grows taller or wraps to two rows.

## 4. Main content / `ContentContainer`

`≥ 1280px`: full `1280px` max-width (or `1600px` `wide` variant per the two named exceptions in
`08-tables-and-filters.md`), centered. Below `1280px`: fluid width with the existing page padding
(`2xl`/`32px` desktop, stepping down to `md`/`16px` below `768px`, matching the live shell's
already-established pattern exactly).

## 5. Tables

| Range     | Behavior                                                                                                                                                                                                                         |
| --------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `≥ 768px` | Standard `Table` component, dense rows, as specified in `08-tables-and-filters.md`.                                                                                                                                              |
| `< 768px` | Reflows to stacked cards — one `Card` per row, fields as labeled key/value pairs, `StatusBadge` retained prominently at the card's top. This is a genuine layout change (per `08-tables-and-filters.md` §10), not column-hiding. |

## 6. Forms

`≥ 768px`: sectioned single-column layout as specified in `09-forms-and-validation.md` (no
multi-column form layout is introduced at any breakpoint — Direction A stays single-column
throughout, avoiding the added complexity of a responsive multi-column form grid for a benefit
that isn't needed given this system's field-dense-but-narrow content shape). `< 768px`: identical
structure, only spacing tightens (form section padding steps from `lg`/`24px` to `md`/`16px`) and
the two-button save-state row (`07-page-patterns.md` archetype C's "Save draft"/"Submit for
review") stacks vertically rather than sitting side by side, so both remain full-width, easy
touch targets.

## 7. Drawers

`≥ 768px`: fixed-width panel (a new token, `drawerWidth: 420px`, added alongside the existing
layout tokens) sliding from the right, main content stays visible and dimmed behind it. `< 768px`:
full-width — a drawer below tablet width behaves like a full-screen sheet (there's no meaningful
"main content stays visible beside it" on a phone-width viewport), with a clear back/close
affordance at the top rather than relying on an edge-swipe or off-canvas metaphor.

## 8. Approval actions

The Approve / Request Revision / Reject action group (`11-approval-patterns.md`) never
compresses into a dropdown or overflow menu at any breakpoint, even mobile — these are the
system's highest-consequence actions and must stay directly visible and directly tappable
regardless of viewport, per Principle 2.6 (approval visibility). Below `768px`, the three buttons
stack vertically (full-width) rather than sitting in a horizontal row, preserving visibility over
saving vertical space.

## 9. Workflow stages (the Stepper component)

`≥ 1024px`: full horizontal stepper, all stages visible. `768–1024px`: horizontal stepper with the
non-adjacent-to-current stages compressed (only current stage + immediate neighbors show full
labels; others collapse to a numbered dot with a tooltip) — still one horizontal row, just denser.
`< 768px`: the stepper becomes a single-line "Stage 7 of 16: Code Review" summary with Previous/
Next-stage disclosure controls rather than attempting to render 16 stages horizontally on a phone
width, which would either be illegibly cramped or force horizontal scroll — neither acceptable per
`08-tables-and-filters.md` §7's general no-horizontal-scroll stance, which applies here too.

## 10. What does not change across breakpoints

Color tokens, typography scale, status-bucket mapping, and the fundamental information hierarchy
(title → status → actions → content) stay identical at every breakpoint — only layout density and
structural arrangement adapt. A user switching between a laptop and a tablet mid-session should
recognize every screen as the same product, not a simplified alternate version of it.
