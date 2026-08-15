---
tier: 2
load_when: ["designer-active", "design", "mockup-production"]
description: Accessibility (WCAG 2.1 AA) and responsive standards for the dashboard mockup — contrast math, keyboard/focus, the data-table and form patterns, the five viewports, and the sidebar-to-drawer behavior.
---

# WCAG 2.1 AA + Responsive — Dashboard

> The dashboard is an operator tool used daily, often with a keyboard, sometimes by users with assistive tech. Accessibility here is not a marketing-site nicety — a sync operator who can't tab to the "retry job" button is blocked. Validate at the token level first (contrast math, no rendering needed), then at the rendered-page level (axe + keyboard + screen-reader spot check).

---

## 1. Contrast (validated before any markup)

| Element                                                      | Minimum ratio                        |
| ------------------------------------------------------------ | ------------------------------------ |
| Body text, labels, table cells                               | 4.5:1                                |
| Large text (≥ 24px, or ≥ 18.66px bold)                       | 3:1                                  |
| UI component borders, focus rings, icons that convey meaning | 3:1                                  |
| Status colors on their surface (success/warning/danger/info) | 4.5:1 for text, 3:1 for fills/badges |

Validate **every mode** (Light, Dark, Semi-Dark) — a pair that passes in Light commonly fails in Dark (muted text on dark surface is the usual culprit). Validate the chosen Primary swatch's `primary-contrast` (the text that sits on a primary button) at 4.5:1; reject swatches that can't reach it with black or white text.

This is deterministic math — run it as a Haiku-tier check on the token file before generating CSS.

---

## 2. Keyboard + focus

- **Everything operable is reachable by Tab** in a logical order. Sidebar nav, table row actions (View/Edit/Delete), form fields, modal controls, theme-customizer toggles.
- **Visible focus** on every interactive element. Never `outline: none` without a replacement focus ring (use `:focus-visible` + a `--focus-ring` token, 3:1 against the background).
- **Modals trap focus** (confirm-delete, add-user) and return focus to the trigger on close. Esc closes.
- **No keyboard traps.** The theme customizer drawer and the master-dashboard detail drawer must be escapable.
- **Skip link** to main content on each page.

## 3. Screen-reader semantics

- Landmarks: `<nav aria-label="Primary">`, `<main>`, `<header>` (appbar), `<footer>`.
- Data tables: `<table>` with `<th scope="col">` / `<th scope="row">`; a `<caption>` or `aria-label` naming the table (e.g. "Users").
- Forms: every input has an associated `<label>`; required fields marked with `aria-required`; validation errors tied via `aria-describedby` and announced.
- Password show/hide toggle is a `<button>` with `aria-pressed` and an accessible name ("Show password" / "Hide password").
- KPI cards: the metric value and its label are programmatically associated; a trend conveyed by color also carries text/icon (don't rely on color alone — see §4).
- Status / health: GREEN/YELLOW/RED is never color-only. Pair with a label ("Healthy" / "Degraded" / "Failing") and/or an icon.
- Live regions: a newly logged activity row or a sync-status change uses `aria-live="polite"` where the operator benefits from the announcement.

## 4. Don't rely on color alone

Health score, sync status, bug severity, and form validation all carry a **text or icon** companion to the color. A red dot alone fails; "RED — Failing" with a filled icon passes. This matters most on the master dashboard, the densest color-coded surface.

---

## 5. Responsive

### Viewports to validate

`mobile-375`, `mobile-414`, `tablet-768`, `desktop-1280`, `desktop-1920` (the same set used by QA's `affected_viewports`).

### Rules

- **No horizontal scroll** at any viewport (except deliberately scrollable wide tables — those scroll within a bounded container, not the whole page).
- **Sidebar → drawer.** At ≤ 768px the fixed sidebar collapses to an off-canvas drawer toggled from the appbar (hamburger). Drawer is focus-trapped and Esc-closable.
- **Data tables on small screens.** Either a horizontal scroll within a labeled container, or a stacked "card per row" pattern at ≤ 414px. Whichever — row actions (View/Edit/Delete) stay reachable and labeled.
- **Forms** go single-column at ≤ 768px; the Add User form's paired fields (First/Last, Password/Confirm) stack.
- **Touch targets** ≥ 44×44px on mobile.
- **The KPI grid** reflows from 4-up (desktop) → 2-up (tablet) → 1-up (mobile).
- **Boxed vs Full layout** (customizer): Boxed still goes full-bleed below the boxed breakpoint so mobile isn't double-gutter-ed.

### Master dashboard specifically

The instances table is the responsiveness stress test — many columns (health, sync, alerts, last-run). On tablet/mobile, prioritize health + alerts + instance name; move sync detail into the row's expand/drill-in rather than forcing a 9-column scroll.

---

## 6. Validation workflow (before G2)

1. Token-level contrast pass on `design-tokens.json` in all three modes (Haiku-tier math). Fail → adjust tokens, re-run.
2. Render pass: `axe-core` on every page, in Light and Dark. Target **0 violations**.
3. Keyboard pass: tab through each page; confirm focus order, visible focus, modal focus trap, Esc behavior.
4. Screen-reader spot check (VoiceOver or NVDA) on login, Users list + Add User, and the master dashboard.
5. Responsive pass: all five viewports; confirm sidebar→drawer, table behavior, no horizontal scroll.

Record the results in the mockup `README.md` and surface them in the G2 gate's AUTOMATED CHECKS block. Any axe violation or contrast failure blocks G2 — fix, don't waive.

---

Last reviewed: 2026-06-30 by Claude (initial Node.js build)
Next review due: 2026-09-30
