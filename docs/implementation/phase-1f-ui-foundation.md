# Phase 1F — UI Foundation: Design Tokens, Shared Page-Shell Components, Shared States (as-built)

**Status:** Records what was actually built for brief §14–§16 — an isolated dashboard design-system
foundation (tokens only), plus reusable page-shell and UI-state components every future module can
share instead of one-off markup.

## 1. Design tokens (`packages/ui/src/tokens.ts`)

Twelve token groups, each a plain object (not a runtime dependency on any CSS-in-JS library):
`colorTokens`, `typographyTokens`, `spacingTokens`, `layoutTokens`, `borderTokens`, `radiusTokens`,
`shadowTokens`, `focusTokens`, `statusTokens`, `controlSizeTokens`, `breakpointTokens`,
`zIndexTokens`, `motionTokens`. `toCssCustomProperties()` flattens all of them into one
`--webdesk-dashboard-*`-prefixed object.

**Deliberately isolated** (brief §16): no WordPress CSS/SCSS import, no dependency on any
WordPress-side design asset. This is a dashboard-only token set — not the full website Design
Token Library module (one of the 43 product modules, still `not_started`), which will one day
manage tokens for the _public marketing site_, a completely separate concern from this internal
tool's own UI.

**How it reaches the page:** `apps/dashboard-web/app/layout.tsx` calls
`toCssCustomProperties()` once and injects the result as a single `<style
dangerouslySetInnerHTML>` tag in the root layout — the one place these values are computed, so
every CSS Module (`app-shell.module.css`, etc.) and every inline style in `packages/ui`'s own
components reads from the same source of truth via `var(--webdesk-dashboard-*)`.

## 2. Shared page-shell components (`packages/ui/src/components/page-shell.tsx`)

`Breadcrumbs`, `PageHeader`, `StatusBadge`, `ContentContainer`, `FiltersBar` — five components a
future module's page can compose instead of rebuilding page chrome from scratch. Each accepts an
injectable `linkComponent` prop (default: a plain `<a>`) rather than importing Next.js's `<Link>`
directly — `packages/ui` has no framework dependency of its own, so it stays usable if this project
ever needs a non-Next.js consumer, and it makes the components trivially testable without a Next.js
router context.

Accessibility built in, not bolted on: `Breadcrumbs` renders a real `<nav aria-label="Breadcrumb">`
with `aria-current="page"` on the last (current) item; separators are `aria-hidden="true"` so a
screen reader doesn't announce literal slash characters.

## 3. Shared UI states (`packages/ui/src/components/states.tsx`)

Nine components covering every state brief §14 lists: `LoadingState`, `EmptyState`, `ErrorState`,
`ForbiddenState`, `NotFoundState`, `NotConfiguredState`, `DegradedState`, `BlockedState`,
`FeatureUnavailableState`. Each maps to a real ARIA role rather than being purely visual:
`LoadingState`/`DegradedState` use `role="status"` (`LoadingState` also sets
`aria-live="polite"` — announced to assistive technology without stealing keyboard focus);
`ErrorState`/`ForbiddenState` use `role="alert"` (announced immediately, appropriate for something
that blocks the user's task). `apps/dashboard-web/app/not-found.tsx` and `app/error.tsx` were
rewritten to use `NotFoundState`/`ErrorState` directly rather than duplicating equivalent markup.

`FeatureUnavailableState` and `NotConfiguredState` exist specifically so a future module can say
"this integration isn't wired yet" or "this feature isn't available in your plan" honestly,
instead of either hiding the feature entirely or rendering a broken-looking blank page — the same
honesty discipline `NotificationsModule`'s `UnconfiguredNotificationDeliveryAdapter` (Phase 1E)
already established at the backend layer, now with a matching frontend vocabulary.

## 4. Testing

- `packages/ui/src/tokens.test.ts` — token values are internally consistent and
  `toCssCustomProperties()` produces the expected flattened shape.
- `packages/ui/src/components/states.test.tsx` (React Testing Library) — every state component
  renders its expected role/text.
- `packages/ui/src/components/page-shell.test.tsx` — breadcrumb `aria-current`, active-state
  logic, injectable `linkComponent` behavior.

A real bug was fixed in `packages/ui`'s own test setup during this work: `vitest.config.mts`
didn't set `test.globals: true`, so `@testing-library/react`'s auto-cleanup (which relies on a
global `afterEach` existing) silently did nothing — DOM elements accumulated across tests in the
same file, producing `getMultipleElementsFoundError` for `role="alert"` once more than one
`ErrorState`/`ForbiddenState` test ran in sequence. Fixed by explicitly importing `cleanup` and
registering `afterEach(() => cleanup())` in `packages/ui/src/vitest.setup.ts` — the identical fix
was independently needed in `apps/dashboard-web/tests/unit/setup.ts` for the same reason.

## 5. What was deliberately not built

- No component library beyond these two files — the Component Library (one of the 43 product
  modules) is a separate, `not_started` module; this is shell-level infrastructure only, not a
  general-purpose design system product.
- No dark-mode token set — not requested for this phase, and no approved visual design exists yet
  to derive one from.
- No visual regression testing (e.g. screenshot diffing) — out of scope; RTL and Playwright cover
  structural/behavioral correctness, not pixel-level appearance.
