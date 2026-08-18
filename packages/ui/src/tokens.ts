/**
 * Dashboard application design-token foundation (Phase 1F,
 * `docs/task-packages/phase-1f-application-shell.md` §16) — the dashboard
 * application's OWN isolated UI foundation, never derived from or copied
 * out of the WordPress theme's CSS (the two design systems stay isolated
 * by design). This is the application-shell foundation only — not the
 * full, separately-authorized website Design Token Library module.
 *
 * Values are deliberately neutral (brief §8: "use clean neutral
 * foundations rather than inventing a complete brand redesign" where
 * visual detail isn't yet approved) — a real brand pass is a future,
 * separately-authorized design task, not this phase's job.
 */

export const colorTokens = {
  background: "#ffffff",
  surface: "#f8fafc",
  surfaceRaised: "#ffffff",
  border: "#e2e8f0",
  borderStrong: "#cbd5e1",
  foreground: "#0f172a",
  foregroundMuted: "#475569",
  foregroundSubtle: "#94a3b8",
  primary: "#0f172a",
  primaryForeground: "#ffffff",
  accent: "#2563eb",
  accentForeground: "#ffffff",
  danger: "#dc2626",
  dangerSurface: "#fef2f2",
  warning: "#d97706",
  warningSurface: "#fffbeb",
  success: "#16a34a",
  successSurface: "#f0fdf4",
  info: "#0284c7",
  infoSurface: "#f0f9ff",
  muted: "#6b7280",
  mutedSurface: "#f1f5f9",
  focusRing: "#2563eb",
} as const;

export const typographyTokens = {
  fontFamilyBase:
    '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif',
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
  full: "9999px",
} as const;

export const shadowTokens = {
  none: "none",
  sm: "0 1px 2px 0 rgb(15 23 42 / 0.06)",
  md: "0 2px 8px 0 rgb(15 23 42 / 0.08)",
  lg: "0 8px 24px 0 rgb(15 23 42 / 0.12)",
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
      properties[`--webdesk-dashboard-${group}-${kebabKey}`] = String(value);
    }
  }
  return properties;
}
