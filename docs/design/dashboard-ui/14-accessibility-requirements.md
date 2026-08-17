# Accessibility Requirements

**Status:** Proposed, pending approval. Target: **WCAG 2.2 AA**, matching Phase 1F's own stated
target and its existing (but narrow — see §8 below) automated baseline. This document specifies
what's already correctly built, what's newly required by this design system's own additions, and
the real, currently-undocumented coverage gap this phase inherits.

## 1. Already correct — kept, not redesigned

Confirmed live in the current shell (`16-existing-shell-gap-analysis.md`): a skip-link ("Skip to
main content"), `:focus-visible` outlines using `focusTokens` (`2px solid`, `2px` offset), real
ARIA roles on every state component (`role="status" aria-live="polite"` for Loading,
`role="alert"` for Error/Forbidden), a semantic `<nav aria-label="Breadcrumb">` with
`aria-current="page"`, and a real `@media (prefers-reduced-motion: reduce)` rule already present
in `app/globals.css`. These are kept exactly as-is and are the pattern every new component in
`06-dashboard-component-system.md` must match, not fall short of.

## 2. Keyboard navigation

Every interactive element in this design system — including new ones not yet built (`Dropdown`,
`Tabs`, `Accordion`, `Drawer`, `Modal`, `Command/action menu`, the `Stepper`) — must be fully
operable by keyboard alone: `Tab`/`Shift+Tab` between elements in visual order, `Enter`/`Space` to
activate, arrow keys within composite widgets (`Tabs`, `Select`-equivalent listboxes, the command
menu's result list), `Escape` to close any overlay (`Dropdown`, `Modal`, `Drawer`, `Tooltip`,
`Command/action menu`). No mouse-only interaction is introduced anywhere in this system — this
was already true of the pre-existing components and stays true.

## 3. Skip navigation

Kept exactly as-is; extended with one addition once the header grows (`04-navigation-system.md`):
a second skip target, "Skip to search," offered only when the header search input is present,
since a keyboard user reaching the header from the top of the page currently has to tab through
every sidebar link before ever reaching main content — the existing single skip-link handles that;
a second one prevents the same problem in reverse (reaching search from the very top without
tabbing through the whole nav first is already solved by skip-to-main; skip-to-search solves the
symmetric case for keyboard users who specifically want search first).

## 4. Visible focus

Kept exactly as-is (`focusTokens`) — extended to every new interactive component with no
exceptions, including inside `Drawer`/`Modal` overlays where focus is easy to lose track of
visually against a dimmed backdrop.

## 5. Semantic headings

Every page has exactly one `<h1>` (the `PageHeader` title, already correct); every subsequent
section heading (form sections, tab panels, card groups) follows a real, non-skipped heading
level (`<h2>`, then `<h3>`, never jumping from `<h2>` to `<h4>` for visual-size reasons — visual
size is a token/CSS concern, not a heading-level concern, and these must not be conflated).

## 6. Form labels and error association

Every field (`09-forms-and-validation.md`) has a real, programmatically-associated `<label>` —
never placeholder-as-label. Every inline validation error is connected to its field via
`aria-describedby`, and the field itself gets `aria-invalid="true"` while an error is present —
**this specific wiring does not exist yet in the current codebase and must be built as part of
the new `Input`/`Textarea`/`Select` components**, not assumed already correct.

## 7. Accessible tables

Every `Table` (`08-tables-and-filters.md`) uses real `<th scope="col">` headers, and sortable
column-header buttons announce their current sort state via `aria-sort` (`ascending`/
`descending`/`none`) — not a chevron icon alone. Row-selection checkboxes get an
`aria-label` naming the specific row they select (e.g. "Select row: Homepage"), not a bare
unlabeled checkbox repeated N times.

## 8. Modal and drawer focus management

**New requirement, not yet built anywhere in the current codebase** (no `Modal`/`Drawer` component
exists yet to have gotten this right or wrong): on open, focus moves to the first focusable
element inside the overlay (or the overlay's own heading if no field should be focused by
default); `Tab`/`Shift+Tab` are trapped within the overlay while open; on close, focus returns to
the exact element that triggered the overlay. This is a well-known, easy-to-get-subtly-wrong
pattern and is called out explicitly here rather than left implicit, since it's the single most
common real accessibility regression in dashboard-style UIs.

## 9. Status announcements

Any status change that happens without a full page navigation (a toast confirming "Draft saved,"
an inline approval-action result, a background job's status flipping from Running to Completed
while the user is on the page) is announced via an `aria-live="polite"` region — matching the
pattern `LoadingState` already correctly uses, extended to `Toast` and any live-updating status
badge specifically.

## 10. Contrast

Every core-palette color pair (text on background, button text on button fill) and the new
`statusBadgeTokens` (`05-dashboard-design-tokens.md` §1.2) must clear WCAG 2.2 AA's 4.5:1 (normal
text) / 3:1 (large text, ≥18pt or ≥14pt bold) thresholds. **Honestly flagged, not assumed:** the
new status-badge palette has not been run through an actual contrast-checking tool as part of this
design pass (per `05-dashboard-design-tokens.md` §1.2's own caveat) — verifying every pair is a
required step before or immediately after implementation.

## 11. Reduced motion

Kept as-is (the existing `prefers-reduced-motion` rule) — extended to cover every new motion-
token-driven transition specified in `05-dashboard-design-tokens.md` §6 (drawer slide, dropdown
open, toast enter/exit, stepper-stage transitions) as they're built, not just the one transition
that exists today.

## 12. Zoom and reflow

The design system's fixed sidebar width (`260px`) and the responsive table-to-card reflow
(`13-responsive-behavior.md` §5) together are what let this system meet WCAG 2.2's 400% zoom
reflow requirement without introducing two-dimensional scrolling — this is the reason
`08-tables-and-filters.md`'s "avoid horizontal scroll" rule is treated as an accessibility
requirement, not a purely aesthetic one.

## 13. Never color alone

The single rule repeated throughout this whole design package (design prompt §10, §24) —
`StatusBadge` always pairs color with text; form validation states pair color with an icon and a
text message; the AI-Draft marker (`12-ready-for-claude-ux.md` §5) uses a border style in addition
to color. No component in `06-dashboard-component-system.md` is approved for use if its only
signal for a meaningful state is a color change.

## 14. The real, currently-undocumented coverage gap this phase inherits

Confirmed in `16-existing-shell-gap-analysis.md` §4: Phase 1F's automated `@axe-core/playwright`
suite covers exactly **3 unauthenticated routes** (`/auth/sign-in`, `/health`, a 404 page) — the
entire authenticated shell (Home, sidebar nav, Project Switcher, every list/detail/form page) has
**never been run through automated axe-core checks**, because no test-only session bypass exists
to let Playwright establish a session in CI. This is not a defect introduced by this design
package, but implementing this design system without also closing that gap means every new
component above would ship with the same untested status as everything that already exists. This
design task does not build the session-bypass test infrastructure itself (implementation scope,
not design scope) but flags it here as a required, named prerequisite for genuinely verifying
this document's own requirements once real pages ship — see `16-existing-shell-gap-analysis.md`
§4 and `17-dashboard-ui-approval-checklist.md` for how this is carried forward.
