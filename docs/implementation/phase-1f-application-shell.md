# Phase 1F — Application Shell (as-built)

**Status:** Records what was actually built for the authenticated application shell in
`dashboard-web` — brief §8–§10, §18, §34.

## 1. What exists

- **`apps/dashboard-web/app/(shell)/layout.tsx`** — the authenticated frame. A Next.js route group
  (`(shell)`, no URL segment) marked `export const dynamic = "force-dynamic"` — session state is
  per-request and must never be statically prerendered. Calls `getServerSession()`
  (`apps/dashboard-web/lib/server-session.ts`); on `null` it `redirect()`s to `/auth/sign-in`
  before rendering anything shell-related. Every route under `(shell)/` — currently only `home` —
  inherits this gate automatically; a new page added under `(shell)/` gets the redirect for free
  without repeating the check.
- **`apps/dashboard-web/components/app-shell.tsx`** — the shell chrome: skip-to-content link,
  header with mobile nav toggle, primary sidebar navigation (`aria-label="Primary"`,
  `aria-current="page"` on the active link), and a `<main id="main-content" tabIndex={-1}>` landmark
  the skip link targets. Client component (`"use client"`) — needs `usePathname()` for
  `aria-current` and `useState()` for the mobile-nav open/closed toggle, both client-only APIs.
- **`apps/dashboard-web/app/(shell)/home/page.tsx`** — the real Home landing page (brief §34):
  renders the signed-in user's identity and states plainly that Projects/reporting data isn't
  built yet, rather than fabricating placeholder business content.
- **`apps/dashboard-web/app/page.tsx`** — root path redirects to `/home`.
- **`apps/dashboard-web/app/layout.tsx`** — injects the design-system CSS custom properties (see
  `phase-1f-ui-foundation.md`) once, at the root, via a single `<style>` tag generated from
  `packages/ui`'s `toCssCustomProperties()`.
- **`apps/dashboard-web/lib/server-session.ts`** — `getServerSession()`: reads the session cookie
  via `next/headers`'s `cookies()`, then forwards it to `dashboard-api`'s new `GET /me` and
  `GET /me/navigation` endpoints (Phase 1F, `phase-1f-navigation-authorization.md`) in parallel via
  `Promise.all`. Returns `null` if no cookie is present or either call returns 401 (both are
  "signed out," not errors). **Throws** on any other failure (network error, 5xx, malformed
  response) — an API outage is never silently treated as "signed out," which would otherwise
  incorrectly bounce a real signed-in user to the sign-in page during a backend incident.

## 2. What was deliberately not built

- Full Projects/Users CRUD, project switcher UI beyond a minimal context read — out of scope per
  the brief's own §11 boundary (see the task package's "Conflict recorded" note).
- Any of the 43 modules' real business pages — the shell renders navigation entries for them
  (`phase-1f-navigation-authorization.md`), but every route besides `/home` and the pre-existing
  auth/health pages is unbuilt; visiting one 404s via Next.js's own not-found handling until that
  module is separately authorized and built.
- A design implementation beyond neutral, token-driven styling — no final visual design was
  approved for this phase, so the shell uses the design-system tokens' defaults rather than a
  bespoke look (brief §8: "neutral foundations where visual detail isn't yet approved").

## 3. Testing

- `apps/dashboard-web/tests/unit/app-shell.test.tsx` — 6 React Testing Library tests: renders
  navigation from a supplied entry list, marks the active route, respects `canView` filtering,
  mobile-toggle `aria-expanded` state, skip-link presence, main-landmark `tabIndex`.
- `apps/dashboard-web/tests/e2e/smoke.spec.ts` — 5 real Playwright tests against a real `next dev`
  server: unauthenticated `/` and `/home` both redirect to sign-in (never leak shell content to an
  unauthenticated request), `/health` renders, an unknown route 404s, secure default headers are
  present.
- `apps/dashboard-web/tests/e2e/accessibility.spec.ts` — see `phase-1f-observability.md`'s sibling
  doc note; automated WCAG 2.2 AA checks against every page reachable without a session.

**Known coverage gap, stated honestly:** the authenticated shell itself (home page, sidebar
navigation with real entries) has no Playwright coverage, because there is no test-only session
bypass — Phase 1C's session model is pre-provisioned-Google-SSO only (see `CLAUDE.md`), so
Playwright can never establish a real session in this CI environment. The RTL unit tests cover the
shell's rendering logic directly (supplying a fixture navigation list as a prop) as the closest
available substitute, but this is not equivalent to an end-to-end authenticated page load.
