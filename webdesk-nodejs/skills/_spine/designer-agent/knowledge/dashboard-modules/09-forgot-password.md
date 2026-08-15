---
tier: 2
load_when: ["designer-active", "design", "mockup-production"]
description: Forgot Password page — same two-section style as Login; email-based reset request with security-conscious "if the account exists" messaging.
---

# Forgot Password Page

Purpose: a clean, modern, production-ready Forgot Password page for a web admin dashboard. Keep it simple, short, and user-friendly.

## Page objective

Allow users to reset their password by entering their registered work email address. The page should clearly guide the user through the password-reset request process.

## Layout

Use the same visual style as the Login Page (`08-login.md`):

- Two-section layout on desktop
- Left section for branding / short message
- Right section for the forgot-password form
- On tablet/mobile, stack sections vertically

## Left section (branding / help panel)

Include: logo; product/system name; short tagline; short helper text explaining password recovery; 2–3 short reassurance points.

Example content:

```text
Secure account recovery

Enter your registered email address and we'll send password reset
instructions if the account exists.
```

## Right section (reset-request form)

Consistent with the Login page style:

- Heading such as `Reset your password`
- Short subtext explaining the step
- Work Email field (required, valid-email validation)
- Primary button such as `Send reset instructions`
- `Back to sign in` link

## Security-conscious behavior

Show a generic confirmation that does not reveal whether the account exists (e.g. "If an account exists for this email, reset instructions have been sent"). This mirrors the Login page's generic-error posture.

## States

Provide design provision for: default state, loading state (on submit), success/confirmation state, and error state (e.g. request failed — retry). Keep the page minimal and not overloaded.
