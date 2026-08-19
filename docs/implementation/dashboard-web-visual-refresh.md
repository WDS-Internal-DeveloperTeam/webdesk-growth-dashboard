# `dashboard-web` Visual Refresh — "Enterprise Plus" (as-built)

**Status:** Built and fully validated. Updates the actual, shared design tokens and shell
components every authenticated page renders through — not a page-local change.

## 1. Why

After the Home page widget grid (PR #39) shipped, the user reported the result still looked "very
very simple" — a fair reaction, since the widget grid was built exactly to spec against the
already-approved "Clean Enterprise" design system, which is genuinely restrained by design (thin
borders, minimal color, muted status pills). Rather than guess at a fix in code, three full visual
directions were drafted as a design canvas (Current, "Enterprise Plus," "Modern SaaS") and shown
side by side. The user picked **Enterprise Plus** and, when asked whether to scope the change to
the Home page alone or the whole app, chose **the whole app** — since the header and sidebar are
shared components every page renders through, and a Home-page-only reskin would have looked
inconsistent with the rest of the app.

## 2. What changed

### Design tokens (`packages/ui/src/tokens.ts`)

- **Color**: warm off-white background (`#faf8f4`, was pure white), warm-toned borders/surfaces, a
  real indigo brand accent (`#4338ca`, was a generic blue `#2563eb`) plus a violet
  `accentSecondary` (`#7c3aed`) for gradients, a light `accentTint` for active states and icon
  badges, and a dedicated dark `header*` token set (`headerBackground #201a3d`,
  `headerForeground`, `headerForegroundMuted`, `headerBorder`, `headerControlBackground`) used only
  by the header bar and its own controls — page content stays on the light palette. **Semantic
  colors (danger/warning/success/info and their surfaces) are deliberately unchanged** — they carry
  meaning, not brand.
- **Typography**: a new `fontFamilyDisplay` token (Sora) alongside the existing `fontFamilyBase`
  (now Public Sans, was a bare system-font stack), both self-hosted via `next/font/google` in the
  root layout (no runtime request to Google, no layout shift) and referenced by CSS custom property
  (`var(--font-public-sans)`/`var(--font-sora)`). The display font is applied to every `h1`–`h6`
  globally in `globals.css`, not per-component, so the whole app picks it up from one change.
- **Radius/shadow**: a new `radiusTokens.xl` (16px) for raised cards, kept separate from `md`/`lg`
  so small controls (buttons, inputs) keep their existing tighter rounding; `shadowTokens.md`/`lg`
  became two-layer, warm-toned shadows.

Every color/contrast pair was computed against the real WCAG 2.1 relative-luminance formula before
being chosen (not eyeballed) — see the inline doc comments on `colorTokens.foregroundSubtle` and
`headerForegroundMuted` for the exact ratios and which ones are (and are deliberately are not) AA
text-safe, matching this codebase's existing discipline after two prior real contrast bugs.

### Shared components (`packages/ui`)

- `Card` now uses `radiusTokens.xl`/`shadowTokens.md` (was `md`/`sm`) — every card across the whole
  app (Home widgets, module grid, project detail sections, forms, etc.) picks this up automatically
  since it's the one shared component.
- `Avatar` now renders a gradient fill (`accentSecondary` → `accent`) instead of a flat muted
  surface — white initials text clears AA against either end of the gradient (5.7:1 / 7.9:1).

### Real icons, finally wired up (`lucide-react`)

Every one of the 43 real seeded modules has carried a Lucide-convention `iconReference` string
(`"book-open"`, `"layout-grid"`, etc.) since migration `00035` — the icon _data_ has existed since
Phase 1F, but no icon library was ever installed to consume it (`docs/implementation/dashboard-web-home-widget-grid.md`
didn't need it; this refresh does). Added `lucide-react` as a `dashboard-web` dependency and a new
`lib/module-icons.tsx` mapping all 43 known values to their real icon component (verified against
the installed package version, not assumed), falling back to `LayoutGrid` for an unknown/null
value. Used in: the sidebar (every nav item, both expanded and icon-only-collapsed — replacing the
`initialsFor()` monogram fallback), and the Home page's module grid (an icon-tinted-circle per
card, replacing the previous plain-text-only row).

### Application shell (`components/app-shell.tsx` + `.module.css`)

- Header: filled dark background (`headerBackground`), light text/icons throughout. Every emoji
  icon (🔍, 🔔, «/») replaced with real `lucide-react` icons (`Search`, `Bell`, `HelpCircle`,
  `Menu`, `PanelLeftOpen`/`PanelLeftClose`) — matching this project's own "never use emoji as
  icons" discipline.
- Sidebar: active nav item now gets the `accentTint`/`accent` pair (a tinted pill) instead of the
  generic `mutedSurface`; every link (expanded and collapsed) shows its module's real icon.
- `ProjectSwitcher` (rendered only inside the header) restyled against the header's own dark
  palette rather than the light content-area tokens, since it's a single-call-site component.

### Home page (`app/(shell)/home/page.tsx`)

- Each widget card gained an icon-tinted-circle badge next to its title (`Activity`, `ClipboardList`,
  `AlertTriangle`, `GitBranch` — fixed icons, since these aren't real modules with their own
  `iconReference`).
- Project Health's status counts moved from small badge pills to large `fontFamilyDisplay` numerals
  (green/amber/subtle-grey by status) — still real counts, still `EmptyState` when there are zero
  projects, no fabricated data.
- Module grid cards gained the same icon-tinted-circle treatment, using each module's real
  `iconReference` via the new `lib/module-icons.tsx` helper.

## 3. What was deliberately not touched

- No RBAC/permission/module-registry schema change — this is presentation-layer only.
- No dark mode (still not V1, per the original approved design direction — this refresh changes
  the light palette, not whether a dark one exists).
- `/projects` and other business pages inherit the token/`Card`/typography changes automatically
  (they already consume the same shared tokens and components) but were not otherwise redesigned —
  no new icon or layout treatment was added to them specifically.
- The native `<select>` project-switcher control's own dropdown-options popup is unstyled browser
  chrome (light, regardless of the trigger's dark styling) — no cross-browser way to restyle it
  fully, not a bug.

## 4. Validation

- `pnpm --filter @webdesk/ui run build`/`lint`/`test` — clean, 79/79 unit tests passing (no
  hardcoded-value assertions broke — the token tests check structure/keys, not exact colors).
- `pnpm --filter @webdesk/dashboard-web run typecheck`/`lint` — clean.
- `pnpm --filter @webdesk/dashboard-web run test -- --run` — 157/157 passing. One existing
  assertion updated (`app-shell.test.tsx`'s collapse-toggle test previously asserted a monogram
  letter "H"; now asserts the real icon SVG is present instead — the same deliberate behavior
  change, not a regression).
- `pnpm --filter @webdesk/dashboard-web run build` (`next build`) — clean; fonts fetched and
  self-hosted successfully at build time.
- `pnpm --filter @webdesk/dashboard-web run test:integration` (Playwright) — **15/15 passing,
  including both authenticated-shell WCAG 2.2 AA axe-core scans** (header/sidebar/library
  clustering, and the collapsed-sidebar state) — zero automatically-detectable violations from the
  new dark header, tinted active-nav state, or icon usage.
- `pnpm audit` — 0 vulnerabilities (including the new `lucide-react` dependency).
- **Live-rendered in the Browser pane** via this project's sanctioned test-only session bypass —
  confirmed the dark header, warm background, indigo accents, real per-item sidebar/module icons,
  and large Project Health numerals all render as intended; confirmed the sidebar collapse toggle
  still works correctly (a real click-target quirk in the browser-automation tool itself — not a
  code bug — was ruled out by confirming a programmatic `.click()` on the real DOM button correctly
  toggled `localStorage` and the rendered icon-only state).

## 5. Files changed

- `packages/ui/src/tokens.ts` — palette, typography, radius, shadow tokens.
- `packages/ui/src/components/structural.tsx` — `Card`, `Avatar`.
- `apps/dashboard-web/app/layout.tsx` — `next/font/google` wiring.
- `apps/dashboard-web/app/globals.css` — global heading display-font rule.
- `apps/dashboard-web/components/app-shell.tsx` + `.module.css` — dark header, real icons, tinted
  active nav state.
- `apps/dashboard-web/components/project-switcher.module.css` — header-dark-palette restyle.
- `apps/dashboard-web/lib/module-icons.tsx` — new file, the `iconReference` → `lucide-react` map.
- `apps/dashboard-web/app/(shell)/home/page.tsx` — icon badges, display-font numerals.
- `apps/dashboard-web/package.json` — new `lucide-react` dependency.
- `apps/dashboard-web/tests/unit/app-shell.test.tsx` — one assertion updated for the new
  icon-not-monogram collapsed behavior.

## 6. Independent code review (2026-08-19)

This project's own `code-review` skill ran against the full PR #39 diff (both the Home widget grid
and this visual refresh) at high effort — 8 finder angles, 1-vote verification per deduped
candidate. 9 findings survived verification (7 CONFIRMED, 2 PLAUSIBLE); all 7 CONFIRMED findings
were fixed per the explicit "fix the confirmed findings" instruction, the 2 PLAUSIBLE ones left as
tracked debt (both real but low-severity, and one — an unguarded status lookup — matches an
already-accepted pattern on sibling functions elsewhere in this codebase, confirmed by the verifier
itself, not a new deviation this PR introduced).

### 6a. Typography CSS custom properties were double-prefixed — the whole point of the font

refresh silently didn't apply (fixed)

The single most severe finding: `toCssCustomProperties()` (`packages/ui/src/tokens.ts`) builds
each property name as `` `--webdesk-dashboard-${group}-${kebabKey}` ``. Every `typographyTokens`
key already starts with "font" (`fontFamilyBase`, `fontSizeXs`, …), and the group label for that
token set is also `"font"` — so the generator produced doubled names like
`--webdesk-dashboard-font-font-family-base`, never the single-prefixed name every CSS consumer in
the app (correctly) references. **Verified against the actual compiled `.next` output**: the
shipped CSS read `font-family:var(--webdesk-dashboard-font-family-base,-apple-system,...)` and
never resolved to `var(--font-public-sans)` — every heading and all body text app-wide was silently
rendering system fonts, not the new Sora/Public Sans this whole PR exists to ship. This bug
pre-dates this PR (the function itself was untouched) and was invisible before, since the old
`fontFamilyBase` value had no `var()` reference at all, so the broken lookup's fallback happened to
already equal the intended appearance — this PR is the first time the mismatch changes visible
output. Fixed by skipping the redundant prefix whenever the kebab-cased key already starts with the
group name, for any group (not hardcoded to "font" specifically, so any future token group with the
same self-prefixing shape is covered too). **Re-verified live**: `getComputedStyle(document.body)`
now resolves to `"Public Sans", "Public Sans Fallback", -apple-system, ...` and
`getComputedStyle(document.querySelector("h1"))` resolves to `Sora, "Sora Fallback", ...` — fonts
now genuinely apply.

### 6b. "Deployed" label showed cold-start time, not deploy time (fixed)

`systemStatus.release.deployedAt` was sourced from `/health`'s `processStartedAt` — a serverless
Function instance's cold-start (module-load) time, not a real deploy timestamp. Confirmed via the
field's own original doc comment (`packages/configuration/src/build-metadata.ts`), which already
warned against exactly this mislabeling. Under this project's Vercel Functions architecture (warm-
instance reuse, no permanent worker), two users hitting different instances of the same deployment
could see two different "Deployed" times, neither necessarily accurate. Fixed by renaming the field
to `instanceStartedAt` (both in `ServerSessionSystemStatus` and its construction site) and the UI
label to "Instance started", with a doc comment recording the full reasoning so a future reader
doesn't reintroduce the same mislabeling.

### 6c–6d. Two reuse gaps closed by promoting shared components (fixed)

The Home page's Project Health widget had its own `PROJECT_STATUS_LABEL`/
`PROJECT_STATUS_NUMERAL_COLOR` maps duplicating `lib/projects.ts`'s existing `projectStatusBadge()`
— now reuses it directly (`statusTokens[projectStatusBadge(status).token]` for the numeral color,
confirmed to resolve to the identical values the hand-rolled map used). The Git/Release Status
widget hand-rolled three `dt`/`dd` metadata rows duplicating the Project Detail page's existing
local `Fact` component — `Fact` is now promoted to `packages/ui/src/components/structural.tsx` and
both pages import the shared version; the Project Detail page's local copy (and its now-redundant
`factStyle`/`factLabelStyle`/`factValueStyle`) were removed. Promoting `Fact` also incidentally
closed a real, live WCAG AA contrast gap in its original implementation — its label used
`foregroundSubtle` (a raw CSS var string) at 12px bold, which doesn't clear the 4.5:1 threshold;
the shared version uses `colorTokens.foregroundMuted` instead, matching this token's own documented
usage discipline.

### 6e. `IconBadge` promoted to `packages/ui` (fixed) — and a real RSC bug found and fixed along

the way

`IconBadge`'s own doc comment already framed it as a reusable "Enterprise Plus" pattern, and it
structurally duplicated `Avatar`'s shape (a sized, centered, tinted-background box) — yet lived
unexported inside `home/page.tsx`, unreachable from the sidebar's own per-module icons in the same
PR. Promoted to `packages/ui/src/components/structural.tsx` alongside `Card`/`Badge`/`Avatar`.

Doing so surfaced a real bug the original page-local version never hit: `structural.tsx` is a
`"use client"` module, so passing a raw `lucide-react` component **reference** (e.g.
`icon={Activity}`) from `home/page.tsx` (a Server Component) across that boundary is invalid —
React Server Components can serialize rendered elements, not bare functions, and the app crashed
with `Functions cannot be passed directly to Client Components`. Fixed by changing `IconBadge`'s
`icon` prop from a component-reference type to `ReactNode` — matching the existing, already-correct
convention this codebase's own `IconButton` already uses (`icon={<Search size={18} />}`, not
`icon={Search}`) — so callers construct the sized/colored icon element themselves (still
server-side, before it crosses the boundary) rather than handing `IconBadge` a bare function.
Caught by live-rendering the actual page in the Browser pane, not just typecheck/build (which don't
catch RSC serialization-boundary violations — they're a runtime-only class of error).

### 6f. `ICON_MAP` had no compile-time link to real `iconReference` values (fixed, partially)

`ICON_MAP` (`lib/module-icons.tsx`) was typed as a generic `Record<string, LucideIcon>`, not tied
to any literal union, with 43 hand-copied keys matching the backend seed data by convention only —
unlike the sibling `MODULE_STATUS_BADGE` (`lib/modules.ts`), which is keyed by a real literal union
so TypeScript enforces every value has an entry. A full fix would mean turning
`ModuleRegistrySummary.iconReference` (`packages/shared-types`) into a literal-backed type shared
across both apps — a schema-level change out of scope for this frontend-only PR. Fixed the reachable
half instead: `moduleIcon()` now logs (`console.error`) when it falls back for a genuinely
unrecognized value (not for the routine `null` case), so a future drift is visible in server logs
instead of silently absorbed — the same "future value silently falls through" class of gap this
project has caught and fixed elsewhere (e.g. `AuthErrorReason`'s `isKnownReason()`). Added
`tests/unit/module-icons.test.tsx` covering the known-icon path, the null case (no log), and the
unrecognized-value case (logged).

### 6g. Icon-only sidebar lost its guaranteed per-module distinctiveness (fixed)

The collapsed/icon-only sidebar previously showed `initialsFor(label)`, guaranteeing every module
looked visually distinct even with no other information available. Replacing it with
`moduleIcon()`'s real icon meant any module with an unmapped `iconReference` would fall back to one
shared generic icon, indistinguishable from every other unmapped module (currently a forward-looking
risk only — all 43 real seeded modules are covered today). Fixed by widening `moduleIcon()`'s return
shape to `{ Icon, isFallback }`; the sidebar's icon-only branch now renders the module's own
monogram (`initialsFor(label)`) when `isFallback` is true, and the real icon otherwise — restoring
the distinctiveness guarantee for the fallback case specifically, while the expanded (labeled) view
keeps using the icon regardless of fallback status, since the label text already differentiates
there.

### Left as tracked debt (2 PLAUSIBLE findings, not fixed)

- `moduleImplementationStatusBadge()`'s unguarded lookup could theoretically crash the Home page on
  an out-of-union `implementationStatus` value — currently unreachable (the backend enforces a
  matching Postgres ENUM), and the verifier confirmed this exact unguarded-lookup shape is already
  established, accepted debt on sibling functions elsewhere in this codebase (`projectStatusBadge`,
  `roadmapItemStatusBadge`) — not a new deviation this PR introduced.
- `globals.css`'s `:focus-visible` fallback literal (`#2563eb`) is stale relative to the new
  `colorTokens.focusRing` (`#4338ca`) — real drift, but no currently-reachable path triggers the
  fallback (the real custom property is injected synchronously in every render path), and the same
  class of intentionally-stale fallback already exists elsewhere in the same file.

### Re-validation after fixes

79/79 `packages/ui` unit tests, 162/162 `dashboard-web` unit tests (4 new — `module-icons.test.tsx`
— plus 2 updated assertions for the icon-not-monogram-in-icon-only-mode behavior and the
`instanceStartedAt` rename), 15/15 Playwright tests (both authenticated-shell axe-core scans still
0 violations), typecheck/lint/`next build`/prettier all clean across both packages, `pnpm audit` 0
vulnerabilities. Live-rendered in the Browser pane again after every fix, not just re-typechecked —
confirmed real Sora/Public Sans fonts resolve via `getComputedStyle`, the widget/module-grid icon
badges render correctly (no RSC boundary crash), and 39 real `<svg>` icons render on the page
with no error-boundary text.

## 7. Post-merge fix: sidebar background and module-grid column count (2026-08-19)

After PR #39 merged and went live, the user reported two real divergences from the approved
design canvas mockup, pointing at a live screenshot vs. the "Home Visual Directions" canvas
screenshot side by side:

1. **The sidebar stayed on the light `surface` fill** instead of the dark `headerBackground` fill
   the approved mockup shows — item 24's own build only made the header dark and gave the sidebar's
   active-nav item a light `accentTint` highlight, but never actually matched the mockup's
   continuous dark rail spanning header + sidebar together. A genuine build-vs-mockup gap, not
   caught by the code review (which checks logic/correctness, not pixel fidelity against the design
   canvas) or the axe-core accessibility scans (which check contrast, not brand-direction
   adherence).
2. **The "Available to you" module grid rendered 5 columns at desktop width, not 4** — an
   `auto-fill, minmax(240px, 1fr)` grid against the 1280px `ContentContainer` max-width computes to
   `floor((1280+16)/(240+16)) = 5` columns; the mockup's tiles are visibly roomier.

Both fixed directly, reusing existing tokens rather than inventing new ones:

- **Module grid**: `minmax(240px, 1fr)` → `minmax(280px, 1fr)` in
  `app/(shell)/home/page.tsx`'s module-grid `gridTemplateColumns` — `floor((1280+16)/(280+16)) = 4`
  at the `ContentContainer` cap, with a comment recording the arithmetic so a future minmax edit
  doesn't silently reintroduce 5. `ContentContainer` never exceeds 1280px, so this is a real cap,
  not a lucky value at one specific viewport.
- **Sidebar**: `app-shell.module.css`'s `.sidebar` now uses `colorTokens.headerBackground`/
  `headerBorder` (the same fill/border the header already uses) instead of `surface`/`border`.
  `.sidebarLink` and the `.navGroupLabel`/`.clusterLabel` labels now use `headerForegroundMuted`
  (documented in `tokens.ts` as 6.80:1 against `headerBackground`, real AA-safe text, not just
  decorative) instead of the light-surface `foregroundMuted`. `.sidebarLink:hover` now uses
  `headerControlBackground`/`headerForeground` instead of the light-surface `mutedSurface`/
  `foreground`. `.sidebarLinkActive` switches from `accentTint` (a near-white tint meant for light
  surfaces — it would render as a stark white box on a dark sidebar) to `accent` itself: a real,
  clearly-visible indigo highlight against `headerBackground` (~2.1:1 luminance contrast between
  the two dark surfaces, vs. only ~1.16:1 if `headerControlBackground` had been reused instead —
  checked both before choosing `accent`), with `headerForeground` (white) text at 7.9:1 contrast,
  comfortably over AA. `colorTokens.accentTint`'s own doc comment updated to record it's no longer
  used for the sidebar's active-nav state.
- **A real accessibility regression this change would otherwise have introduced, caught and fixed
  in the same pass**: the shared `:focus-visible` rule (`.navToggle`/`.sidebarLink`/`.brand`/
  `.skipLink`) outlines with `colorTokens.focusRing` (`accent`, `#4338ca`) — fine against every
  surface it was originally written for, but only ~2.1:1 against the sidebar's new dark
  `headerBackground`, under WCAG 2.2 SC 1.4.11's 3:1 non-text-contrast minimum for a focus
  indicator. Added a `.sidebarLink:focus-visible { outline-color: headerForeground }` override
  (white clears every sidebar surface — background, hover fill, and the active `accent` fill alike,
  at 7.9:1–16.4:1) rather than leaving the regression in place.

Validated: 79/79 `packages/ui` unit tests, 162/162 `dashboard-web` unit tests (all pre-existing,
none needed updating — this PR touches only inline styles and CSS custom-property references, no
class names, DOM structure, or component props), `eslint`/`check-css-tokens.mjs`
(the token-lint script that ties `@media`/color literals back to real tokens)/typecheck/`next
build`/prettier all clean, `pnpm audit` unaffected. Live-rendered in the Browser pane (the
sanctioned `lib/e2e-test-session.ts` bypass, `PLAYWRIGHT_E2E_TEST_MODE=1` set temporarily in
`.env.local` and removed again afterward) — confirmed via `getComputedStyle` that the sidebar
background is exactly `headerBackground` (`rgb(32, 26, 61)`), the active nav item's background is
exactly `accent` (`rgb(67, 56, 202)`) with white text, inactive links are `headerForegroundMuted`
(`rgb(167, 159, 224)`), and the module grid computes to exactly 4 columns at desktop width — all
matching the design values directly, not eyeballed from a screenshot. A stale, unrelated console
error (`IconBadge`/RSC "Functions cannot be passed" from item 24's already-fixed bug) reappeared in
`read_console_messages`' output even after a full dev-server restart and a `.next` cache wipe,
with identical HMR chunk ids across restarts — ruled out as a real regression rather than assumed
fixed: the source code's `IconBadge` call sites in `home/page.tsx` were re-read and confirmed
unchanged (still pass rendered `<Icon .../>` elements, never a raw component reference), and a
direct DOM check found zero `"Something went wrong"` error-boundary text and 39 real `<svg>`
elements rendered — this matches the same class of Browser-pane automation-tool quirk this project's own history has
already ruled out once before (item 24's own build, a stale/misbehaving click event — see
`CLAUDE.md`), not a fresh bug.

## 8. Reversal: sidebar reverted to light theme, made compact (2026-08-19)

Immediately after §7 shipped, the user pasted a reference screenshot of the sidebar and said
directly: keep it light — not dark — and make it compact. A genuine direction change from §7's own
dark-sidebar fix (itself built to match the design canvas mockup), not a bug report; followed the
user's own explicit, most-recent instruction over the earlier mockup-matching one.

Reverted §7's `.sidebar`/`.clusterLabel`/`.navGroupLabel`/`.sidebarLink`/`.sidebarLink:hover`/
`.sidebarLinkActive` color changes back off the `header*` tokens — `.sidebar` now uses
`colorTokens.surfaceRaised` (pure white, `#ffffff`) rather than either the dark `headerBackground`
or the original pre-refresh `surface` (`#f5f1e9`, a warm cream) — `surfaceRaised` reads as a
distinct white panel against the slightly warmer `background` the main content sits on, matching
the crisp white look in the user's reference screenshot. `.sidebarLinkActive` reverts to
`accentTint`/`accent` (the same light-lavender-highlight-plus-indigo-text pairing from before §7,
which the reference screenshot shows exactly). Removed the `.sidebarLink:focus-visible` override
§7 added — no longer needed once the sidebar is back on a light surface, since the original
generic `:focus-visible` rule's `focusRing` color already has good contrast there. Reverted
`colorTokens.accentTint`'s doc comment back to noting it IS used for the sidebar's active-nav
state again.

For "compact": tightened every spacing value that controls the sidebar's vertical density rather
than shrinking type (font sizes deliberately untouched, to stay legible) — `.sidebar` padding
`space-md` → `space-sm`; `.navGroup` margin-bottom `space-lg` → `space-md`; `.navGroupLabel`/
`.clusterLabel` vertical padding cut to 2px; `.navList` item gap `2px` → `1px`; `.sidebarLink`
padding `space-sm` (uniform 0.5rem) → `space-xs space-sm` (0.25rem vertical, 0.5rem horizontal) —
this last one is the main lever, since it directly sets each nav row's height. Net effect,
confirmed live: the full 15-module navigation tree (every group, every cluster header) now fits
inside the viewport with no sidebar scrolling needed at a typical 900px-tall window, where it
previously required scrolling past "Settings."

Validated: 79/79 `packages/ui` unit tests, 162/162 `dashboard-web` unit tests (unchanged — again no
class names, DOM structure, or props touched, only CSS custom-property values), typecheck/lint/
`check-css-tokens.mjs`/`next build`/prettier all clean. Live-rendered in the Browser pane again —
confirmed via `getComputedStyle` that the sidebar background is exactly `surfaceRaised`
(`rgb(255, 255, 255)`), the active nav item's background/text are exactly `accentTint`/`accent`
(`rgb(238, 240, 255)`/`rgb(67, 56, 202)`), inactive links are `foregroundMuted`
(`rgb(107, 97, 81)`), and `.sidebarLink`'s computed padding is `4px 8px` (was `8px` uniform before
this change) — and confirmed zero error-boundary text with all 39 icons still rendering.

## 9. Independent code review (2026-08-19)

Medium effort, 8-angle finder pass against the full PR #40 diff (net of both §7/§8 commits). 6
findings survived verification (3 CONFIRMED, 3 PLAUSIBLE). All 8 angles independently converged on
the same two underlying issues, which meaningfully increased confidence in both.

**Most severe (CONFIRMED), and the only one with real functional impact**: the module grid's
`repeat(auto-fill, minmax(280px, 1fr))` fix from §7 only actually reaches 4 columns once the
available content width hits `ContentContainer`'s 1280px cap — which, accounting for the 260px
sidebar and 64px of `.main` padding, needs a viewport of roughly **1492px or wider**. At common
laptop resolutions (1366×768, 1440×900) it silently rendered **3** columns, not 4 — the exact
undershoot bug §7 was built to fix, just relocated to a lower number. This was missed by §7's own
live verification, which only checked 1280px and 1920px viewports (both ≥1280px in container terms
either by exact match or the 1280px cap), never a mid-range width like 1440px where the gap
actually shows. Independently recomputed the arithmetic with Python before trusting the finding.

Fixed by replacing the `auto-fill`/`minmax` approach with an explicit, breakpoint-driven CSS
Module (new `app/(shell)/home/page.module.css`): `repeat(N, minmax(0, 1fr))` at each of
`breakpointTokens`' four values (480/768/1024/1280px, enforced by `check-css-tokens.mjs`) — 1
column below 480px, 2 from 480px, 3 from 1024px, 4 from 1280px. `minmax(0, 1fr)` has no per-column
minimum floor, so exactly N columns render at each breakpoint regardless of how narrow the
container is, trading a hard per-card width floor for a deterministic column count — the more
robust pattern the altitude-angle finder recommended over hand-tuning a magic pixel value to one
specific container width. Verified live at the exact boundary: 1279px viewport → 3 columns,
1280px → 4 columns, 1440px → 4 columns (previously 3).

**Two CONFIRMED documentation-consistency findings**, both converged on independently by 3–4 of
the 8 angles: (1) the `.clusterLabel` contrast-ratio comment stated stale, wrong numbers —
`foregroundSubtle` claimed "2.45:1" (contradicting `tokens.ts`'s own documented 3.88:1 for the
identical pair) and `foregroundMuted` claimed "passes (7+:1)" (the real figure is 6.08:1,
independently recomputed with the real WCAG relative-luminance formula and confirmed live via
`getComputedStyle`) — fixed by correcting both numbers and resolving the cross-file contradiction.
(2) The §8 "compact" pass hardcoded `2px`/`1px` padding/gap literals instead of a spacing token —
unlike every other value in this file, and invisible to `check-css-tokens.mjs`, which only checks
`@media` breakpoints and transition durations, never spacing literals — fixed by adding a real
`spacingTokens["2xs"]` tier (`0.125rem`/2px, matching the existing `"2xl"`/`"3xl"` naming
convention) to `packages/ui/src/tokens.ts` and using it consistently across `.clusterLabel`
padding, `.navGroupLabel` padding, and `.navList` gap.

One PLAUSIBLE finding fixed: the `.sidebar` comment's phrase "after seeing the dark-sidebar
direction live" could be misread as a production incident, given this project's own CLAUDE.md
vocabulary — reworded to make explicit this was a local dev-preview render on an unmerged branch,
never deployed.

Two PLAUSIBLE findings left as tracked, out-of-scope debt, not fixed: (1) the new
`spacingTokens["2xs"]` (2px) is a _third_, numerically different "tight spacing" value alongside an
existing, undocumented `gap: 0.1rem` (1.6px) convention already used identically in
`project-roster-section.module.css` and `user-picker.module.css` — full reconciliation into one
real compact-density system is a larger, separate task than this scoped fix, not silently glossed
over. (2) `tests/unit/app-shell.test.tsx` has zero computed-style assertions for any of the sidebar
colors/spacing this branch touches, so a future custom-property typo would only be caught by a live
render — a genuine, pre-existing testing gap, not something this diff introduced or is obligated to
close on its own.

Re-validated after all fixes: 79/79 `packages/ui` unit tests (1 updated — the `spacingTokens` key
list), 162/162 `dashboard-web` unit tests, typecheck/lint/`check-css-tokens.mjs` (now checking 9
CSS Module files, up from 8)/`next build`/prettier all clean across both packages. Live-verified
the boundary behavior directly in the Browser pane (1279px → 3 columns, 1280px → 4 columns, 1440px
→ 4 columns) rather than trusting the arithmetic alone.

## 10. Sidebar spacing adapted to the Vercel dashboard nav reference; real active-link layout bug found and fixed (2026-08-19)

After PR #40 shipped, the user shared a screenshot of Vercel's own dashboard sidebar as a reference
and asked to adapt our sidebar's row spacing and selection styling toward it — specifically calling
out "the spacing between menu and selection." Read the reference's proportions directly (roomier
per-row padding producing ~36–40px rows, a rounder selection pill, clear separation between rows,
generous outer inset from the sidebar's own edge) and adapted our sidebar's spacing to match that
rhythm, keeping our own light palette and indigo accent (the ask was to match Vercel's _organization
and spacing_, not its colors).

Changes: `.sidebar` outer padding `space-sm` → `space-md` (8px → 16px); `.sidebarLink` padding
`space-xs space-sm` → `space-sm` uniform (4px 8px → 8px 8px, taller rows); `.sidebarLink`/
`.sidebarLinkActive` corner radius `radius-sm` → `radius-md` (4px → 8px, a rounder pill); `.navList`
row gap `space-2xs` → `space-xs` (2px → 4px, clearer per-row separation).

**While verifying this live (checking computed styles, not just a screenshot), found a real,
significant, pre-existing bug**: the currently-active sidebar link has never actually inherited any
of `.sidebarLink`'s layout properties. `app-shell.tsx` applied `styles.sidebarLinkActive` and
`styles.sidebarLink` as mutually exclusive alternatives (`isActive ? styles.sidebarLinkActive :
styles.sidebarLink`) — but `.sidebarLinkActive` in the CSS Module only ever declared
`background`/`color`/`font-weight` (the override properties), never `display`/`align-items`/`gap`/
`padding`/`border-radius`/`text-decoration`/`font-size` (the base layout, only declared on
`.sidebarLink`). Live-verified via `getComputedStyle` on the real active link (`aria-current="page"`)
before the fix: `display: inline` (not `flex`), `padding: 0px`, `border-radius: 0px`,
`text-decoration-line: underline` — the currently-active nav item, on every page, in every
deployment, has always rendered as a bare underlined inline link with a background color hugging
just the text/icon glyphs, not the padded, rounded, flex-aligned pill every screenshot in this
document's earlier sections appeared to show (those checks verified `background-color`/`color`
values, which _were_ correct, but never checked `display`/`padding`/`border-radius`, so the bug was
invisible to every prior verification pass, code review, and the axe-core WCAG scans — none of
which check layout correctness). Fixed at the source: `app-shell.tsx`'s two `className` assignments
now always apply `styles.sidebarLink`, with `styles.sidebarLinkActive` layered on conditionally
(`` `${styles.sidebarLink} ${isActive ? styles.sidebarLinkActive : ""}` ``) — the correct
base-class-plus-modifier composition, letting the CSS cascade apply `.sidebarLinkActive`'s
override properties on top of `.sidebarLink`'s full layout rather than replacing it entirely.
Re-verified live after the fix: `display: flex`, `align-items: center`, `gap: 8px`, `padding: 8px`,
`border-radius: 8px`, `text-decoration-line: none`, `height: 34px` — matching every other sidebar
link's layout exactly, just with the accent background/text/weight on top. The icon-only collapsed
state (`.sidebarIconOnly .sidebarLink, .sidebarIconOnly .sidebarLinkActive`) was unaffected (that
compound selector already matched via either class) and was re-verified live as well (36×36px tile,
correct radius/background).

Validated: 162/162 `dashboard-web` unit tests (unchanged — no test asserted the previous incorrect
layout), typecheck/lint/`check-css-tokens.mjs`/`next build`/prettier all clean; `next-env.d.ts`
confirmed unaffected by the local dev-server session. Live-rendered in the Browser pane both before
and after the active-link fix, in both expanded and icon-only-collapsed sidebar states, confirming
the exact computed-style values above rather than eyeballing a screenshot — the bug this section
describes was specifically the kind that a screenshot alone would not have reliably caught at a
quick glance.
