---
tier: 2
load_when: ["designer-active", "design", "mockup-production"]
description: HTML-only mockup standard (D-DES-01) for the dashboard — structure, the preview server, production-quality rules, and the lint gate before G2.
---

# HTML Mockup Standards (D-DES-01)

> The G2 deliverable for any dashboard/tool UI is a **running HTML/CSS/JS mockup** served from the preview server. Not Figma, not Adobe XD, not PSD, not screenshots, not a PDF. The mockup is the production scaffold: the Frontend role converts it to React/Next, it does not rebuild it. The quality bar for mockup code equals the quality bar for production code.

---

## D-DES-01 — what is forbidden as the deliverable

Never deliver any of these _as the G2 deliverable_:

- Figma / Adobe XD / Sketch frames
- PSD / AI / static design files
- Screenshots or a slide deck of screens
- A PDF of mockups

These are fine as _human exploration_ or _client-supplied references_ (extract assets, then build HTML). They are never the thing the client approves at G2. What the client approves is a URL they can click through in a browser.

Why: a static design hides the things that break in build — focus states, keyboard nav, responsive reflow, empty/loading/error states, the permission-driven shell. An HTML mockup forces those decisions at G2, where they're cheap, instead of at G4, where they're bugs.

---

## Structure

```
/projects/[client]/mockups/
  login.html
  index.html              ← dashboard home
  users.html
  user-add.html
  roles.html
  settings.html
  logs.html
  theme-customizer.html
  master.html
  assets/
    tokens.css            ← CSS custom properties from design-tokens.json
    base.css              ← reset, typography, layout primitives, utilities
    components/
      sidebar.css
      appbar.css
      table.css
      form.css
      card.css
      kpi.css
      modal.css
      badge.css
    js/
      rbac-matrix.js      ← permission-driven nav + row actions (sample role)
      theme-customizer.js ← Skin/Mode/Primary/Layout/AppBar/Footer toggles
      password-toggle.js  ← show/hide password
      table-filter.js     ← list filter + search
      timezone-label.js   ← renders timestamps in the configured tz (display local, data UTC)
  README.md               ← how to preview + navigate + open questions
```

Shared shell: every authenticated page composes the same `sidebar` + `appbar` + content region. Build the shell once (e.g. as an HTML partial pattern or a small JS include) so the Frontend role inherits one shell component, not nine copies.

---

## Production-quality rules

1. **Semantic HTML.** `<nav>`, `<main>`, `<table>` for tabular data, `<button>` for actions (never a clickable `<div>`), `<form>` + `<label>` for every input, `<th scope>` on table headers.
2. **No inline `<style>` blocks.** Styles live in CSS files. No inline `style=` attributes except CSS-custom-property assignment for the live theme customizer.
3. **No inline `<script>` blocks.** JS lives in `assets/js/*.js`, loaded with `defer`.
4. **CSS custom properties for all themeable values.** Colors, spacing, radii, shadows read from `tokens.css`. The theme customizer changes custom properties at runtime — it does not swap stylesheets.
5. **Every interactive element has its states.** hover / focus-visible / active / disabled. Focus states are visible (never `outline: none` without a replacement).
6. **All five list/empty/loading/error/success states** are demonstrated for at least the Users list and one KPI card, so the Frontend build inherits them.
7. **Permission-driven shell.** Nav items and View/Edit/Delete buttons toggle off when the sample role lacks the flag (`rbac-matrix.js`). The mockup must make obvious that hiding a button is convenience, not security.
8. **Timezone-aware timestamps** via `timezone-label.js`: each timestamp carries the configured-timezone display with a UTC `data-` attribute.
9. **No real secrets.** Settings fields show placeholder/masked values; never embed a real API key or token in the mockup.
10. **No build step required to preview.** Plain HTML/CSS/vanilla JS that opens in a browser. (The React/Next build comes later — the mockup must be runnable with nothing but the preview server.)

---

## Preview server

Serve the mockup over HTTP (not `file://`, which breaks relative asset paths and some JS) so stakeholders review the real rendered thing:

```bash
# from /projects/[client]/mockups/
npx --yes http-server -p 4321 -c-1 .
# or, no-deps:
python3 -m http.server 4321
```

The preview URL (`http://localhost:4321/index.html`, or the tunnel URL if reviewed remotely) is what goes into the G2 gate's ARTIFACTS TO REVIEW block. The `README.md` lists every page URL and any open questions (e.g. unconfirmed master-dashboard hosting).

For remote client review, expose the preview via the same tunnel mechanism the project uses for local-first dev (e.g. a Cloudflare tunnel) — never deploy the mockup to a client production host.

---

## Lint gate before G2

Run before surfacing the mockup. Fail = fix, do not surface:

- **Semantic HTML check** — no clickable `<div>`/`<span>` with click handlers; every input has a `<label>`; tables use `<th scope>`.
- **No inline style/script** — grep the HTML for `<style`, `<script>` (inline), and `style=` (other than the customizer's custom-property hook).
- **Alt text** — every `<img>` has `alt`; decorative images use `alt=""`.
- **axe-core** — 0 violations on every page, in both Light and Dark mode.
- **Responsive** — no horizontal scroll at 375 / 768 / 1280; sidebar collapses to a drawer on mobile.
- **Contrast** — tokens validated per `04-wcag-and-responsive.md` (this is a token-level check done earlier, re-verified here on the rendered page).

This is the same output Code Review will check on the mockup — running it yourself first avoids a bounce.

---

## Handoff note for the Frontend role

The mockup is **read-only reference + authoritative tokens**. The Frontend role:

- Converts each HTML page to a React/Next route/component.
- Maps `tokens.css` custom properties to the app's theme system (the customizer axes become a theme context/provider).
- Wires real data (users, roles, sync status, health score, logs) to the same DOM structure.
- Preserves the design — a substantial structural rewrite is a failure mode, not a refactor.

---

Last reviewed: 2026-06-30 by Claude (initial Node.js build)
Next review due: 2026-09-30
