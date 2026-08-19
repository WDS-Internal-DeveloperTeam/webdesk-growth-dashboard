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
