# Existing Shell Gap Analysis

**Status:** Research findings, informing the rest of this package. Per design prompt §2: _"Inspect
what already exists before proposing replacement. Do not discard working Phase 1F foundations
without documenting why."_ This document is that inspection — grounded in direct reading of
`packages/ui`, `apps/dashboard-web`, and Phase 1F's own implementation docs, not assumption.

## 1. What Phase 1F got right — kept, not redesigned

- **`packages/ui`'s token architecture** (`tokens.ts`) — 12 well-structured token groups (color,
  typography, spacing, layout, border, radius, shadow, focus, status, control-size, breakpoint,
  z-index, motion), unit-tested, with a `toCssCustomProperties()` mechanism that's the actual
  single source of truth every CSS Module traces back to. This is a genuinely solid foundation —
  see `05-dashboard-design-tokens.md` for what's kept exactly, refined, or added.
- **`packages/ui`'s 9-component state system** (`states.tsx`) — `LoadingState`, `EmptyState`,
  `ErrorState`, `ForbiddenState`, `NotFoundState`, `NotConfiguredState`, `DegradedState`,
  `BlockedState`, `FeatureUnavailableState` — already correctly built with real ARIA roles
  (`role="status"`, `role="alert"`) and, notably, already encodes this system's own "never
  fabricate" principle (`FeatureUnavailableState` shows the real registry status, not a fake
  placeholder). Kept entirely as-is.
- **The registry-driven, permission-filtered navigation model** — `GET /me/navigation` already
  returns exactly what the caller may see; the shell renders it with no client-side re-filtering.
  This is the correct architecture and is kept exactly as-is; this design package only changes how
  the (already-correct) data is visually organized (`03-information-architecture.md`,
  `04-navigation-system.md`).
- **The framework-agnostic component contract** — `packages/ui` has zero Next.js dependency
  (`linkComponent` injection pattern); `dashboard-web` supplies `next/link` at each call site. A
  genuinely good decision, kept as the convention for every new component.
- **The mobile off-canvas navigation pattern** — already correct (slide-in, `200ms` transition,
  proper `aria-expanded`, already RTL-tested). Kept exactly as-is.
- **`PageHeader`'s contract** (`title`, `breadcrumbs`, `statusBadge`, `contextActions`) — already
  matches exactly what `07-page-patterns.md` needs for every archetype's header. No redesign.

## 2. What's inconsistent today — needs discipline, not a rewrite

Confirmed by direct file reading, not inferred:

- **Three coexisting styling idioms within Phase 1F's own pages** — `packages/ui` uses inline
  `style={{}}` objects; `apps/dashboard-web`'s CSS Modules use `var(--webdesk-dashboard-*)`; and
  individual pages (`app/(shell)/home/page.tsx`, `app/(shell)/projects/page.tsx`) mix token-object
  imports, hardcoded literal hex/rem values, and raw `var(--webdesk-dashboard-*)` strings typed
  directly into inline `style` objects — three different approaches even within pages built in
  the same phase. **Recommendation:** standardize on token-constant imports (never a raw hardcoded
  literal, never a hand-typed CSS-variable string) as new components ship under this design
  system — a lint rule enforcing this is worth considering during implementation, though building
  that rule is implementation scope, not this design task's.
- **The 5 pre-`packages/ui` auth pages use neither tokens nor shared components** —
  `app/auth/sign-in`, `/emergency`, `/emergency/totp`, `/error`, `/logout`, `/session-expired` all
  predate `packages/ui` (Phase 1C) and use independently hardcoded inline styles, including at
  least one confirmed color drift (`color: "#666"` and `color: "#b00020"` — the latter is _not_
  `colorTokens.danger` `#dc2626`, a real, already-existing inconsistency). **Recommendation:**
  these 6 pages should be re-skinned to the token system as part of implementing this design
  package — they're simple enough (login forms, error notices) that this is a low-risk, high-
  consistency-value cleanup, not a redesign of their actual flow or fields.

## 3. What's defined but never actually wired in — a real, if low-severity, gap

- **`breakpointTokens`** (`mobile`/`tablet`/`laptop`/`desktop`) — exported and tested, but the
  live shell hardcodes `768px` directly in `app-shell.module.css` rather than referencing this
  token (a real technical constraint, not an oversight — CSS custom properties can't appear
  inside a `@media` condition). Addressed in `05-dashboard-design-tokens.md` §6 with a build-time-
  constant approach.
- **`motionTokens`** — same situation; one real transition exists (`200ms`, coincidentally
  matching `durationBase`) but isn't sourced from the token. Same fix as breakpoints.
- **`controlSizeTokens`** — exported/tested, zero consumers anywhere in the app, because no
  `Button`/`Input`/`Select` component exists yet to consume them (see §4). Not a bug — the tokens
  were built ahead of the components that need them.
- **`layoutTokens.sidebarWidthCollapsed` (`64px`)** — defined, zero consumers, because no desktop
  collapse toggle exists yet. Genuinely new work, specified in `04-navigation-system.md` §1.2.

## 4. What's missing entirely — the real scope of this design package

**Component library:** `packages/ui` has 5 layout/display components and 9 state components — 14
total. The design prompt's own §27 inventory names 41 distinct components. **Roughly 30 of them
don't exist in any form yet**, including every basic form control (`Button`, `Input`, `Select`,
`Checkbox`, etc.) that every one of the 43 modules will need immediately. This is the single
largest real gap this design package addresses — see `06-dashboard-component-system.md`.

**Header elements:** the approved wireframe (`07_Low_Fidelity_Wireframes.md` §1) specifies `Logo |
Project Switcher | Search | Notifications | User`; only Logo, Project Switcher, and a bare-text
user indicator are actually built. Search, Notifications, Help, and a real user menu are new —
see `04-navigation-system.md` §2.

**Accessibility test coverage:** the automated `@axe-core/playwright` suite covers exactly 3
unauthenticated routes; the entire authenticated shell has never been automatically checked,
because no test-only session bypass exists for Playwright to establish a session in CI. This is a
real, previously-undocumented-as-a-named-gap finding from this research pass — flagged in full in
`14-accessibility-requirements.md` §14 as a prerequisite for genuinely verifying this design
system's own accessibility requirements once implemented.

**Dark mode:** zero foundation — no `[data-theme]`/`prefers-color-scheme` branching anywhere.
Deliberately not built now — see `02-recommended-direction.md` §"Dark mode recommendation."

**"Current project" downstream consumption:** the Project Switcher persists a cookie, but no
module reads it yet (a data-wiring gap, not a UI gap — out of this design task's scope, unchanged
from CLAUDE.md's own standing note on this).

## 5. Brand — none exists

Confirmed by a full-repo search: **no WebDesk Solution brand-identity material exists anywhere in
this repository** — no logo file, no approved hex color, no approved typeface, no brand guideline
document for the dashboard's own UI. `packages/ui`'s current palette is a deliberate neutral
placeholder (its own doc comment says so explicitly), not an approved brand rendering. Two module
specs that sound related — Brand Library (#10) and Design Token Library (#13) — are business
modules for managing **client websites'** and the **public marketing site's** brand/token assets
respectively, and must not be confused with, or sourced from for, this internal dashboard's own
UI (`docs/implementation/phase-1f-ui-foundation.md` already draws this distinction explicitly;
this design package inherits and restates it). If a real WebDesk brand reference is supplied later,
it's a token-value swap against the existing semantic token names (`colorTokens.accent`,
`typographyTokens.fontFamilyBase`, etc.), not a structural rework — this is a direct benefit of
Direction A's restraint, per `02-recommended-direction.md`.

## 6. CSP / security posture relevant to UI

No Content-Security-Policy exists anywhere in the codebase today (`dashboard-web`'s
`next.config.ts` sets only `X-Content-Type-Options`, `X-Frame-Options`, `Referrer-Policy`) and the
app currently ships zero web fonts. This design package's own recommendation (`05-dashboard-design-tokens.md`
§2) to add no new typeface sidesteps the question entirely for now; if a future phase does add one,
self-hosting via `next/font/local` is the safer default specifically because it needs no `font-src`
CSP allowlist entry, unlike a Google Fonts–style external load — worth stating now so a future
typography decision doesn't reopen this research.

## 7. Net assessment

Phase 1F's foundation is genuinely sound where it exists — the token architecture, the state
system, and the navigation data model are all kept with no structural changes. The real gap this
design package closes is **breadth, not correction**: about 30 missing components, a handful of
missing header elements, and a documented (not previously named) accessibility coverage hole —
not a rework of anything that's already live and working.
