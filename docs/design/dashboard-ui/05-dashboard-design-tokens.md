# Dashboard Design Tokens

**Status:** Proposed, pending approval. Builds directly on `packages/ui/src/tokens.ts`'s existing,
tested token set (see `16-existing-shell-gap-analysis.md` for its exact current contents) — this
document specifies what's **kept as-is**, what's **refined**, and what's **newly added and wired
into real CSS** (several existing token groups are currently exported but never consumed — see
§7). These tokens belong only to the dashboard application; they are never applied to, or derived
from, the public WebDesk website. No approved WebDesk brand reference exists to reconcile against
(see `16-existing-shell-gap-analysis.md` §6) — every value below is this design task's own
proposal under Direction A (`02-recommended-direction.md`), not a rendering of an existing brand.

## 1. Color

### 1.1 Core palette — kept exactly as-is

The existing 22 color tokens are sound, already unit-tested, and already live in production. No
changes:

```
background #ffffff · surface #f8fafc · surfaceRaised #ffffff
border #e2e8f0 · borderStrong #cbd5e1
foreground #0f172a · foregroundMuted #475569 · foregroundSubtle #94a3b8
primary #0f172a · primaryForeground #ffffff
accent #2563eb · accentForeground #ffffff
danger #dc2626 · dangerSurface #fef2f2
warning #d97706 · warningSurface #fffbeb
success #16a34a · successSurface #f0fdf4
info #0284c7 · infoSurface #f0f9ff
muted #6b7280 · mutedSurface #f1f5f9
focusRing #2563eb
```

These remain the palette for **buttons, links, alerts, borders, and form validation states** —
contexts where a saturated, attention-getting color is correct (a destructive-action confirmation
button should look urgent).

### 1.2 New: a dedicated status-badge palette (the "calmer status" refinement from `02-recommended-direction.md`)

The existing five `statusTokens` (`healthy`/`degraded`/`unavailable`/`notConfigured`/`unknown`)
just alias the core palette above — meaning a status badge that appears on nearly every screen in
the system is exactly as visually loud as a destructive-action button. Add a **separate,
three-part token per status**, tuned specifically for the sustained, low-urgency, everywhere-at-once
context a status badge lives in: a darker text color (for the label), a soft tint (for the badge
background), and a brighter dot (for the leading status indicator, which carries more of the
scan-at-a-glance signal than the text does):

```
statusBadgeTokens = {
  healthy:      { text: "#166534", background: "#f0fdf4", dot: "#22c55e" }
  attention:     { text: "#92400e", background: "#fffbeb", dot: "#f59e0b" }  // warning/degraded/review states
  blocked:       { text: "#991b1b", background: "#fef2f2", dot: "#ef4444" }  // danger/rejected/failed states
  informational: { text: "#075985", background: "#f0f9ff", dot: "#38bdf8" }  // in-progress/informational states
  neutral:       { text: "#334155", background: "#f1f5f9", dot: "#94a3b8" }  // draft/not-configured/unknown/archived
}
```

Text-on-background pairs use a 700–800-range text color against a 50-range tinted background —
the standard Tailwind-recommended pairing for reliable AA text contrast at this saturation. **This
has not been verified against a contrast-checking tool as part of this design pass** — flagged
honestly rather than claimed; running each pair through a real contrast checker (e.g. the
axe-core suite already in the codebase, extended to cover these badges once built) is a required
step before or immediately after implementation, not optional polish. See
`10-status-and-workflow-system.md` for the mapping from every real workflow status name to one of
these five buckets — no status in the system gets a bespoke sixth color; every status maps onto
one of these five.

### 1.3 Rule: color is never the only signal

Every status badge pairs its color with a text label and, per `10-status-and-workflow-system.md`,
a leading dot — never a bare colored chip with no text. This is a hard requirement (design prompt
§10, §24), not a style preference.

## 2. Typography

**No new typeface.** Keep the existing system-font stack for both body and headings — matches
Direction A's own reasoning (`01-visual-directions.md`) and avoids a real, unjustified cost
(self-hosting, load time, licensing) for a benefit that Direction A's own analysis doesn't
require. Existing tokens kept as-is:

```
fontFamilyBase '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif'
fontFamilyMono 'ui-monospace, SFMono-Regular, "SF Mono", Menlo, Consolas, "Liberation Mono", monospace'
fontSizeXs 0.75rem · fontSizeSm 0.875rem · fontSizeMd 1rem · fontSizeLg 1.125rem
fontSizeXl 1.375rem · fontSize2xl 1.75rem · fontSize3xl 2.25rem
fontWeightRegular 400 · fontWeightMedium 500 · fontWeightSemibold 600 · fontWeightBold 700
lineHeightTight 1.2 · lineHeightNormal 1.5 · lineHeightRelaxed 1.7
```

**Usage convention, newly specified** (per Direction B's borrowed idea in `02-recommended-direction.md`):
`fontFamilyMono` renders every task ID, commit SHA, branch name, PR number, and public/record ID
— in tables, in detail-page metadata, and inline in prose — not only in tables as today. This is a
usage rule, not a new token.

**Table/label/metadata sizing convention:** table body text and metadata labels use `fontSizeSm`
(`0.875rem`); page titles use `fontSize2xl`/`fontSize3xl` depending on context (record detail vs.
top-level module page); section headings use `fontSizeLg`/`fontSizeXl`. No size below `fontSizeXs`
is ever used for body content, to protect WCAG 2.2 AA reflow/zoom requirements.

## 3. Spacing

Kept exactly as-is — the existing 8-step scale already covers this system's needs:

```
none 0 · xs 0.25rem · sm 0.5rem · md 1rem · lg 1.5rem · xl 2rem · 2xl 3rem · 3xl 4rem
```

Direction A convention: `xs`/`sm`/`md` do in-component and in-row spacing; `lg`/`xl` separate
sections within a page; `2xl`/`3xl` are reserved for page-level top/bottom padding and rare
full-bleed section breaks only — not used for routine in-page rhythm, keeping density high per
Principle 2.2.

## 4. Radius

Kept as-is, usage clarified (the existing token set was defined but its usage wasn't fully
specified anywhere):

```
none 0 · sm 0.25rem · md 0.5rem · lg 0.75rem · full 9999px
```

- `sm` — form inputs, buttons, small badges.
- `md` — cards, panels, dropdowns, modals.
- `lg` — reserved, currently unused; kept for a future larger surface (e.g. a full-page card
  treatment) rather than removed, since removing a token is a breaking change for zero savings.
- `full` — status-badge dots, avatars, pill-shaped badges.

## 5. Shadows, borders, control heights — kept as-is

```
shadow: none · sm "0 1px 2px 0 rgb(15 23 42 / 0.06)" · md "0 2px 8px 0 rgb(15 23 42 / 0.08)" · lg "0 8px 24px 0 rgb(15 23 42 / 0.12)"
border: widthThin 1px · widthMedium 2px
control: sm 1.75rem · md 2.25rem · lg 2.75rem (height, each with paired padding-inline and font-size)
```

Direction A usage: `shadow.sm` for cards/panels resting on the page background; `shadow.md` for
menus/dropdowns; `shadow.lg` reserved for modals and the mobile off-canvas sidebar (already used
there today). Flat surfaces (tables, list rows) use a `border`, never a shadow, per
`01-visual-directions.md`'s Direction A surface treatment.

## 6. Navigation dimensions, container widths, breakpoints, z-index, motion

```
layout: sidebarWidth 260px · sidebarWidthCollapsed 64px · headerHeight 56px · contentMaxWidth 1280px
zIndex: base 0 · stickyHeader 10 · sidebar 20 · dropdown 30 · overlay 40 · modal 50 · toast 60
```

Kept as-is. **New addition:** a second container-width token for data-dense screens specifically —

```
contentMaxWidthWide: 1600px
```

used only by table-heavy screens where the standard `1280px` genuinely truncates useful columns
(Page Inventory, Ready for Claude Queue) — see `08-tables-and-filters.md` for exactly which
screens opt into this. Most module pages (record detail, forms, library lists with fewer columns)
stay at the standard `1280px`.

**Breakpoints, kept as values, newly wired in:**

```
breakpoint: mobile 480px · tablet 768px · laptop 1024px · desktop 1280px
```

These already exist but are currently decorative — the live shell hardcodes `768px` directly in
CSS rather than referencing this token (confirmed in `16-existing-shell-gap-analysis.md`; CSS
custom properties cannot appear inside a media-query condition, which is _why_ this happened, not
an oversight). The fix, specified for implementation: generate the four breakpoints as a small
shared SCSS/PostCSS-level constant (or a documented literal-value convention with a lint rule
enforcing it) so every `@media` rule in the app uses the same four numbers by construction, not by
each author remembering to match a hardcoded `768px` in a different file. This closes a real,
documented drift risk without requiring a new runtime mechanism. See `13-responsive-behavior.md`
for the full breakpoint-to-layout-behavior table.

**Motion, kept as values, newly wired in:**

```
motion: durationFast 120ms · durationBase 200ms · durationSlow 320ms · easingStandard cubic-bezier(0.4, 0, 0.2, 1)
```

Same situation as breakpoints — defined, currently only coincidentally matched by one hardcoded
transition. Implementation should reference these values directly in every future transition
(drawer slide-in, dropdown open, toast enter/exit) rather than each author picking their own
duration. Per WCAG 2.2 AA and this system's existing `@media (prefers-reduced-motion: reduce)`
handling (already present in `app/globals.css`), every motion token respects that media query —
no exception.

## 7. Control-size tokens

```
control: sm { height: 1.75rem, paddingInline: spacing.sm, fontSize: typography.fontSizeSm }
         md { height: 2.25rem, paddingInline: spacing.md, fontSize: typography.fontSizeMd }
         lg { height: 2.75rem, paddingInline: spacing.lg, fontSize: typography.fontSizeMd }
```

Kept as-is (already correctly scoped for JS/inline-style consumption, not CSS custom properties,
since a `height` value needs to pair consistently with a `fontSize` and `paddingInline` as one
unit per component instance). Newly specified usage: `md` is the default for all buttons, inputs,
and selects; `sm` is used only inside dense table rows (row-action buttons) and filter bars; `lg`
is reserved for a small number of primary, page-level call-to-action buttons (e.g. "Submit for
review" on a record detail page) — never used for routine form controls.

## 8. What is deliberately not introduced

No new CSS-in-JS runtime, no Tailwind, no external component-library token set — see
`16-existing-shell-gap-analysis.md` §28 for why (nothing in the current stack needs replacing to
achieve Direction A, and introducing one would need the explicit approval process the design
prompt's §28 itself requires before any major UI dependency is added).
