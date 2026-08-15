---
tier: 2
load_when: ["designer-active", "design", "mockup-production"]
description: The design-token system for the dashboard theme customizer — token groups, the six customizer axes mapped to tokens, light/dark/semi-dark modes, and emission as CSS custom properties.
---

# Design Tokens — Dashboard Theme Customizer

> One token system drives the whole dashboard and powers the Theme Customizer's six axes (Skin, Mode, Primary color, Layout, AppBar, Footer). Tokens are authored as `design-tokens.json` (validated against `templates/design-tokens.schema.json`) and emitted as CSS custom properties in `tokens.css`. The customizer changes custom properties at runtime — it never swaps stylesheets. Every color combination is validated against WCAG AA (per `04-wcag-and-responsive.md`) **before** emission, in every mode.

---

## Token groups

| Group           | Examples                                                                                                    | Notes                                                                                                            |
| --------------- | ----------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------- |
| `color.brand`   | `primary`, `primary-hover`, `primary-contrast`                                                              | `primary` is the customizer's Primary color; `primary-contrast` is the text color that sits on it (must pass AA) |
| `color.surface` | `bg`, `surface`, `surface-2`, `border`                                                                      | mode-dependent (light/dark/semi-dark)                                                                            |
| `color.text`    | `text`, `text-muted`, `text-inverse`                                                                        | mode-dependent; validated against the surfaces they sit on                                                       |
| `color.status`  | `success`, `warning`, `danger`, `info`                                                                      | reused for health-score GREEN/YELLOW/RED and sync states — keep semantically stable across modes                 |
| `typography`    | `font-family`, `font-size-{xs..2xl}`, `line-height-{tight,base,loose}`, `font-weight-{regular,medium,bold}` |                                                                                                                  |
| `space`         | `space-{0,1,2,3,4,6,8,12,16}` (rem scale)                                                                   |                                                                                                                  |
| `radius`        | `radius-{sm,md,lg,full}`                                                                                    | `sm` vs larger reads differently per Skin                                                                        |
| `shadow`        | `shadow-{sm,md,lg}`                                                                                         | dampened in dark mode                                                                                            |
| `layout`        | `sidebar-width`, `appbar-height`, `content-max-width`, `footer-height`                                      | drives Layout/AppBar/Footer axes                                                                                 |
| `z`             | `z-appbar`, `z-sidebar`, `z-drawer`, `z-modal`                                                              |                                                                                                                  |

---

## The six customizer axes → tokens

1. **Skin: Default / Bordered**
   - Bordered raises `--border` opacity and applies `1px` borders on cards/tables (`--card-border-width: 1px`); Default uses `--shadow-sm` instead of borders. One boolean token `--skin-bordered: 0|1` plus the derived values.

2. **Mode: Light / Dark / Semi-Dark**
   - Swaps the `color.surface` and `color.text` groups. **Semi-Dark** = dark sidebar/appbar with a light content area (a distinct surface set, not just "dark minus content"). Implemented as a `data-mode` attribute on `<html>` that selects a custom-property block. Brand and status colors stay constant; only surfaces/text change.

3. **Primary color: swatches + hex**
   - Sets `--color-brand-primary`. The customizer recomputes `--color-brand-primary-hover` (darken ~8%) and selects `--color-brand-primary-contrast` (black or white, whichever passes AA against the chosen primary). If neither passes 4.5:1, the swatch is rejected in the picker.

4. **Layout: Content Full / Boxed**
   - Boxed caps the content region at `--content-max-width` and centers it; Full lets it span. One token `--layout-boxed: 0|1`.

5. **AppBar: Fixed / Static / Hidden**
   - `Fixed` = `position: sticky/fixed` top; `Static` = scrolls with content; `Hidden` = removed (content reclaims `--appbar-height`). Drives `--appbar-position` + a `data-appbar` attribute.

6. **Footer: Fixed / Static / Hidden**
   - Same pattern as AppBar via `--footer-position` + `data-footer`.

Persistence: the customizer stores the selected axis values per user (localStorage in the mockup; user-preference record in the real build). On load, the stored values are applied before first paint to avoid a flash.

---

## Modes in detail (the part that breaks contrast)

A token set can pass AA in Light and fail in Dark — so **validate every mode**.

- **Light:** `bg` near-white, `surface` white, `text` near-black, `text-muted` ~`#5b6472`.
- **Dark:** `bg` ~`#12161f`, `surface` ~`#1b2230`, `text` ~`#e6e9ef`, `text-muted` must still hit 4.5:1 on `surface` (don't let muted text drop below AA in dark — the most common failure).
- **Semi-Dark:** content uses the Light surfaces; sidebar/appbar use the Dark surfaces. Validate the sidebar's nav text against the dark sidebar surface separately from the content text against the light content surface.

Status colors (`success/warning/danger/info`) must remain legible on each mode's `surface`. Because they map to health-score and sync states on the master dashboard, their meaning must read identically in every mode.

---

## Emission as CSS custom properties

`tokens.css` is generated from `design-tokens.json`:

```css
:root {
  --color-brand-primary: #4f46e5;
  --color-brand-primary-hover: #443dc4;
  --color-brand-primary-contrast: #ffffff;

  --color-status-success: #1f9d55;
  --color-status-warning: #c79100;
  --color-status-danger: #d64545;
  --color-status-info: #2b6cb0;

  --font-family: "Inter", system-ui, sans-serif;
  --space-4: 1rem;
  --radius-md: 0.5rem;

  --sidebar-width: 260px;
  --appbar-height: 60px;
  --content-max-width: 1280px;
  --footer-height: 48px;
}

:root[data-mode="light"] {
  --color-bg: #f6f7fb;
  --color-surface: #ffffff;
  --color-surface-2: #f0f2f7;
  --color-border: #e3e6ee;
  --color-text: #1b2230;
  --color-text-muted: #5b6472;
}
:root[data-mode="dark"] {
  --color-bg: #12161f;
  --color-surface: #1b2230;
  --color-surface-2: #232b3b;
  --color-border: #2c3445;
  --color-text: #e6e9ef;
  --color-text-muted: #9aa3b5;
}
:root[data-mode="semi-dark"] {
  /* content surfaces = light; sidebar/appbar pull from --sd-* below */
  --color-bg: #f6f7fb;
  --color-surface: #ffffff;
  --color-surface-2: #f0f2f7;
  --color-border: #e3e6ee;
  --color-text: #1b2230;
  --color-text-muted: #5b6472;
  --sd-nav-bg: #1b2230;
  --sd-nav-text: #e6e9ef;
  --sd-nav-muted: #9aa3b5;
}
```

Component CSS only ever references custom properties (`background: var(--color-surface)`), never hard-coded colors. That is what makes the customizer live and the Frontend port mechanical.

---

## Rules

1. No hard-coded colors in component CSS — only `var(--…)`.
2. Validate WCAG AA for every text/surface pair in **every** mode before emitting (`04-wcag-and-responsive.md`). Reject failing primary swatches in the picker.
3. Brand + status colors are mode-invariant; only surface/text groups change per mode.
4. The token JSON validates against `templates/design-tokens.schema.json`; CI rejects an invalid token file.
5. Status colors map 1:1 to health-score GREEN/YELLOW/RED and sync OK/STALE/FAILED so the master dashboard is readable at a glance — keep that mapping stable.

---

Last reviewed: 2026-06-30 by Claude (initial Node.js build)
Next review due: 2026-09-30
