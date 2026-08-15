---
tier: 2
load_when: ["designer-active", "design", "mockup-production"]
description: Login page — two-section layout (branding + login form), demo credentials, form behavior and states. Models the JWT login UX (show/hide password, generic error).
---

# Login Page

Purpose: a clean, modern, production-ready Login Page for a web admin dashboard. Keep it simple, short, and clean. This models the JWT login UX (the token machinery is backend — see `01-dashboard-standards.md` §3.1).

---

## Layout — two-section

### Left section (branding / intro panel)

Include: logo; product/system name; short one-line tagline; short supporting description; 2–3 key highlights or feature bullets; optional status badge or small callout.

### Right section (login form panel)

Include: logo / brand name; heading `Sign in to your account`; short subtext; Work Email field; Password field; show/hide password icon; `Forgot password?` link; `Keep me signed in` checkbox; primary button `Sign in`.

## Demo credentials

Below the login button, add a small Demo Credentials box/card: Demo Email, Demo Password, and an optional quick action (`Use Demo Credentials` or `Copy Credentials`).

## Form behavior

- Required-field validation
- Invalid-email validation
- Error message for incorrect login (generic — no "user not found" vs "wrong password" leak)
- Loading state on sign in
- Disabled button state until valid input
- Success redirect behavior note

## States

Provide design provision for: default state, error state, loading state, forgot-password click state / link only.

## Style & responsive

Professional admin-dashboard look; clean spacing; modern typography; responsive; desktop-first two-column layout; tablet/mobile stack vertically. Keep the page minimal and not overloaded; make it look like a dashboard login page; include `Forgot password` and the Demo Credentials box below the login button; follow the two-section visual structure of the reference.
