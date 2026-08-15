---
tier: 2
load_when: ["qa-active", "frontend-active"]
description: "Dashboard UI testing — Playwright E2E, axe accessibility, responsive checks, Lighthouse."
---

# Testing 03 — Dashboard UI Tests

> QA for the React/Next dashboard. Aligns with the QA agent's dashboard-UI module (blueprint §7) and the dashboard standards (`frontend/02`). Lighthouse runs **only here** (it's a frontend metric, not relevant to headless middleware).

---

## Stack

- **E2E:** **Playwright** — real-browser flows, multi-browser, network mocking, traces on failure.
- **Component / unit:** React Testing Library (+ vitest or node:test) for component behavior in isolation.
- **Accessibility:** **axe** (`@axe-core/playwright`) wired into the E2E run.
- **Performance:** **Lighthouse** (CI via `lhci`) on key pages.
- Run against the local stack (Compose) — cheapest place (blueprint §15).

---

## E2E flows to cover

The critical paths of every dashboard instance:

- **Auth:** login (incl. show/hide password), access+refresh token flow, refresh-on-expiry, logout revokes, wrong password is handled. (`security/02`, `frontend/01`)
- **RBAC-gated UI:** a role without `users:view` doesn't see the Users module; without `users:edit` the Edit action is absent/disabled; deleting requires `users:delete`. Verify the **UI gate matches the server gate** (the server is the real control — don't only test the hidden button).
- **Users module:** list filter/search, Add User (validation: confirm-password mismatch, duplicate email → server 422 mapped to the field), edit, delete.
- **Roles & Permissions:** create a role, toggle the per-module VED matrix, confirm it takes effect for a user in that role.
- **Settings:** save store/API fields; **change Timezone and confirm schedules/displayed timestamps follow** (blueprint §6) — secrets shown masked, re-enter-to-change.
- **Theme Customizer:** Skin/Mode/Primary/Layout/AppBar/Footer changes apply and persist across reload (`frontend/02`).
- **Sync monitoring views:** sync status, watermark lag, queue/DLQ visibility render and update; DLQ replay action works.
- **Master dashboard** (if in scope): cross-instance list, health score, drill-in — and that a per-client role **cannot** reach master routes.

```js
// playwright sketch — RBAC gate
test("manager without delete cannot delete a user", async ({ page }) => {
  await loginAs(page, "manager");
  await page.goto("/users");
  await expect(page.getByRole("button", { name: "Delete" })).toHaveCount(0);
});
```

---

## Accessibility (axe)

- Run axe on every key page in the E2E suite; **no serious/critical violations** is the bar.
- Manual/assertion checks beyond axe: keyboard navigation through forms and menus, visible focus, labels tied to inputs, color contrast in all theme modes (Light/Dark/Semi-Dark — the customizer multiplies the surface to check).

```js
import AxeBuilder from "@axe-core/playwright";
const results = await new AxeBuilder({ page }).analyze();
expect(results.violations.filter((v) => ["serious", "critical"].includes(v.impact))).toEqual([]);
```

---

## Responsive

- Test the key breakpoints (mobile / tablet / desktop) — the dashboard must be usable on a tablet for floor/warehouse use. Assert nav collapses, tables become scannable, forms remain usable.

---

## Lighthouse

- `lhci` on login + dashboard home + a data-heavy module page. Track performance, accessibility, best-practices, SEO scores against a budget; regressions block.
- This is the **only** place Lighthouse applies — headless middleware has no UI to score.

---

## Gate alignment

These run at G4 (per-sprint, for UI work) and G5 (milestone regression). A11y violations and broken RBAC gates are blockers, not warnings.
