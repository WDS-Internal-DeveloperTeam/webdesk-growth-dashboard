/**
 * Dashboard application design-token foundation (Phase 1F,
 * `docs/task-packages/phase-1f-application-shell.md` §16) — the dashboard
 * application's OWN isolated UI foundation, never derived from or copied
 * out of the WordPress theme's CSS (the two design systems stay isolated
 * by design). This is the application-shell foundation only — not the
 * full, separately-authorized website Design Token Library module.
 *
 * Values reflect the "Enterprise Plus" visual direction (a real indigo
 * brand accent, warm neutral surfaces, a filled dark header, Sora +
 * Public Sans typography) chosen 2026-08-19 from three mockups presented
 * on a design canvas — see `docs/implementation/dashboard-web-visual-refresh.md`.
 * Supersedes the original Phase 1F "clean neutral foundations" placeholder
 * palette. Semantic colors (danger/warning/success/info and their
 * surfaces) are deliberately UNCHANGED — they carry meaning, not brand,
 * and this refresh only restyles the brand-facing tokens.
 */

export const colorTokens = {
  background: "#faf8f4",
  surface: "#f5f1e9",
  surfaceRaised: "#ffffff",
  border: "#ece5d8",
  borderStrong: "#ddd2ba",
  foreground: "#1f1a12",
  foregroundMuted: "#6b6151",
  /** 3.88:1 against `surfaceRaised` — below the 4.5:1 AA text threshold (a real improvement over
   *  the prior value's 2.56:1, but still not AA-safe for small body text). Matches this codebase's
   *  existing discipline (see `app-shell.module.css`'s own comments): never use this token where
   *  AA-compliant text is required — use `foregroundMuted` there instead. Reserved for large/bold
   *  text, decorative or non-text use. */
  foregroundSubtle: "#8a8071",
  primary: "#1f1a12",
  primaryForeground: "#ffffff",
  accent: "#4338ca",
  /** Paired with `accent` in gradients (avatar, accent rules) — never used alone as a text/surface
   *  color, so it carries no independent contrast obligation of its own. */
  accentSecondary: "#7c3aed",
  accentForeground: "#ffffff",
  /** Light accent tint for active nav states and icon badges — 6.98:1 with `accent` as the
   *  foreground on top of it. */
  accentTint: "#eef0ff",
  danger: "#dc2626",
  dangerSurface: "#fef2f2",
  warning: "#d97706",
  warningSurface: "#fffbeb",
  success: "#16a34a",
  successSurface: "#f0fdf4",
  info: "#0284c7",
  infoSurface: "#f0f9ff",
  muted: "#6b7280",
  mutedSurface: "#f2efe9",
  focusRing: "#4338ca",
  /** The filled dark header (Enterprise Plus direction) — used only by the header bar and its
   *  own controls (`AppShell`, `ProjectSwitcher`), never by page content, which stays on the light
   *  `background`/`surfaceRaised` pair above. */
  headerBackground: "#201a3d",
  /** 16.45:1 on `headerBackground`. */
  headerForeground: "#ffffff",
  /** 6.80:1 on `headerBackground` — clears AA for real text (the header's muted labels), not just
   *  decorative use. */
  headerForegroundMuted: "#a79fe0",
  headerBorder: "#332a5c",
  /** Fill for header-hosted controls (the Project Switcher pill) — sits between `headerBackground`
   *  and `headerBorder` in lightness so those controls read as distinct, raised elements. */
  headerControlBackground: "#2b2454",
} as const;

export const typographyTokens = {
  /** Self-hosted via `next/font/google` in the root layout (`apps/dashboard-web/app/layout.tsx`),
   *  which sets the `--font-public-sans` custom property on `<html>` — the fallback stack after it
   *  only ever applies before that stylesheet loads, or if a future consumer renders outside the
   *  root layout's font-variable scope. */
  fontFamilyBase:
    'var(--font-public-sans), -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif',
  /** Headings and large numerals only (design canvas "Enterprise Plus" direction) — applied
   *  globally to `h1`/`h2`/`h3` in `globals.css` rather than per-component, so every heading across
   *  the app gets it without touching each component individually. Same self-hosting note as
   *  `fontFamilyBase` above, via `--font-sora`. */
  fontFamilyDisplay:
    'var(--font-sora), -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif',
  fontFamilyMono:
    'ui-monospace, SFMono-Regular, "SF Mono", Menlo, Consolas, "Liberation Mono", monospace',
  fontSizeXs: "0.75rem",
  fontSizeSm: "0.875rem",
  fontSizeMd: "1rem",
  fontSizeLg: "1.125rem",
  fontSizeXl: "1.375rem",
  fontSize2xl: "1.75rem",
  fontSize3xl: "2.25rem",
  fontWeightRegular: "400",
  fontWeightMedium: "500",
  fontWeightSemibold: "600",
  fontWeightBold: "700",
  lineHeightTight: "1.2",
  lineHeightNormal: "1.5",
  lineHeightRelaxed: "1.7",
} as const;

export const spacingTokens = {
  none: "0",
  xs: "0.25rem",
  sm: "0.5rem",
  md: "1rem",
  lg: "1.5rem",
  xl: "2rem",
  "2xl": "3rem",
  "3xl": "4rem",
} as const;

export const layoutTokens = {
  contentMaxWidth: "1280px",
  /** Wider content max-width for dense tables (design system §5.5) — e.g. Page Inventory, Ready for Claude Queue. */
  contentMaxWidthWide: "1600px",
  sidebarWidth: "260px",
  sidebarWidthCollapsed: "64px",
  headerHeight: "56px",
  /** Side-drawer panel width (design system §5.5) — e.g. notifications, record detail drawers. */
  drawerWidth: "420px",
} as const;

export const borderTokens = {
  widthThin: "1px",
  widthMedium: "2px",
} as const;

export const radiusTokens = {
  none: "0",
  sm: "0.25rem",
  md: "0.5rem",
  lg: "0.75rem",
  /** Raised-card rounding (design canvas "Enterprise Plus" direction) — deliberately its own step
   *  above `lg` rather than a bump to `md`/`lg` themselves, so small controls (buttons, inputs)
   *  keep their existing, tighter rounding. */
  xl: "1rem",
  full: "9999px",
} as const;

export const shadowTokens = {
  none: "none",
  sm: "0 1px 2px 0 rgb(15 23 42 / 0.06)",
  /** Two-layer shadow (design canvas "Enterprise Plus" direction) — a tight contact shadow plus a
   *  soft ambient one, warm-toned (`rgba(32,26,61,…)`, matching `headerBackground`) rather than
   *  the previous flat slate tone. `Card` (`structural.tsx`) uses this. */
  md: "0 1px 3px rgba(32,26,61,0.05), 0 8px 20px -8px rgba(32,26,61,0.10)",
  lg: "0 4px 6px rgba(32,26,61,0.06), 0 16px 32px -12px rgba(32,26,61,0.16)",
} as const;

export const focusTokens = {
  ringWidth: "2px",
  ringOffset: "2px",
  ringColor: colorTokens.focusRing,
} as const;

/**
 * Semantic status colors, deliberately separate from `colorTokens.accent`
 * (artifact-design guidance: semantic color is not the brand accent).
 */
export const statusTokens = {
  healthy: colorTokens.success,
  degraded: colorTokens.warning,
  unavailable: colorTokens.danger,
  notConfigured: colorTokens.muted,
  unknown: colorTokens.foregroundSubtle,
} as const;

/**
 * The 5-bucket business-record/workflow status-badge palette (design system
 * `10-status-and-workflow-system.md`) — every real status name from the
 * approved workflow-state-machine and module-specification documents maps
 * to one of these five buckets, never an invented status. Distinct from
 * `statusTokens` above (system/integration health only, unchanged). Each
 * bucket carries text/background/dot so status is encoded in form as well
 * as color (never color alone). Nested like `controlSizeTokens` — meant for
 * direct JS/inline-style consumption by badge components, not flattened
 * into CSS custom properties.
 */
export const statusBadgeTokens = {
  healthy: { text: "#166534", background: "#f0fdf4", dot: "#22c55e" },
  attention: { text: "#92400e", background: "#fffbeb", dot: "#f59e0b" },
  blocked: { text: "#991b1b", background: "#fef2f2", dot: "#ef4444" },
  informational: { text: "#075985", background: "#f0f9ff", dot: "#38bdf8" },
  neutral: { text: "#334155", background: "#f1f5f9", dot: "#94a3b8" },
} as const;

export const controlSizeTokens = {
  sm: { height: "1.75rem", paddingInline: spacingTokens.sm, fontSize: typographyTokens.fontSizeSm },
  md: { height: "2.25rem", paddingInline: spacingTokens.md, fontSize: typographyTokens.fontSizeMd },
  lg: { height: "2.75rem", paddingInline: spacingTokens.lg, fontSize: typographyTokens.fontSizeMd },
} as const;

/** Matches brief §18's minimum device coverage (desktop/laptop/tablet/mobile). */
export const breakpointTokens = {
  mobile: "480px",
  tablet: "768px",
  laptop: "1024px",
  desktop: "1280px",
} as const;

export const zIndexTokens = {
  base: 0,
  stickyHeader: 10,
  sidebar: 20,
  dropdown: 30,
  overlay: 40,
  modal: 50,
  toast: 60,
} as const;

export const motionTokens = {
  durationFast: "120ms",
  durationBase: "200ms",
  durationSlow: "320ms",
  easingStandard: "cubic-bezier(0.4, 0, 0.2, 1)",
} as const;

export type ColorToken = keyof typeof colorTokens;
export type TypographyToken = keyof typeof typographyTokens;
export type SpacingToken = keyof typeof spacingTokens;
export type LayoutToken = keyof typeof layoutTokens;
export type BorderToken = keyof typeof borderTokens;
export type RadiusToken = keyof typeof radiusTokens;
export type ShadowToken = keyof typeof shadowTokens;
export type StatusToken = keyof typeof statusTokens;
export type StatusBadgeToken = keyof typeof statusBadgeTokens;
export type ControlSizeToken = keyof typeof controlSizeTokens;
export type BreakpointToken = keyof typeof breakpointTokens;
export type ZIndexToken = keyof typeof zIndexTokens;
export type MotionToken = keyof typeof motionTokens;

/**
 * Flattens every token group into a single `--webdesk-dashboard-*` CSS
 * custom-property map, injected once by `dashboard-web`'s root layout.
 * Prefixed distinctly from anything WordPress-side to guarantee no
 * accidental collision if the two apps were ever rendered on the same
 * origin.
 */
export function toCssCustomProperties(): Readonly<Record<string, string>> {
  const properties: Record<string, string> = {};
  // `controlSizeTokens` is deliberately excluded — it's a nested per-size object
  // (`{sm: {height, paddingInline, fontSize}, ...}`), not a flat token group, and is meant to be
  // consumed directly in JS/inline styles by size-variant components, not as CSS custom properties.
  const groups: ReadonlyArray<readonly [string, Readonly<Record<string, string | number>>]> = [
    ["color", colorTokens],
    ["font", typographyTokens],
    ["space", spacingTokens],
    ["layout", layoutTokens],
    ["border", borderTokens],
    ["radius", radiusTokens],
    ["shadow", shadowTokens],
    ["status", statusTokens],
    ["focus", focusTokens],
    ["breakpoint", breakpointTokens],
    ["zindex", zIndexTokens],
    ["motion", motionTokens],
  ];
  for (const [group, tokens] of groups) {
    for (const [key, value] of Object.entries(tokens)) {
      const kebabKey = key.replace(/[A-Z]/g, (letter) => `-${letter.toLowerCase()}`);
      // Every `typographyTokens` key already starts with "font" (fontFamilyBase, fontSizeXs, …),
      // so blindly prepending the group name again produced doubled names like
      // `--webdesk-dashboard-font-font-family-base` — which no CSS consumer in this app ever
      // referenced (every one, correctly, expects the single-prefixed name). That silently broke
      // every font-family/font-size/font-weight custom-property lookup across the whole app; only
      // exposed once real, visually distinct fonts were wired up (this PR), since the old fallback
      // stack happened to already match the intended appearance. Skip the redundant prefix
      // whenever the kebab-cased key already starts with the group name, for any group.
      const propertyKey = kebabKey.startsWith(`${group}-`) ? kebabKey : `${group}-${kebabKey}`;
      properties[`--webdesk-dashboard-${propertyKey}`] = String(value);
    }
  }
  return properties;
}
