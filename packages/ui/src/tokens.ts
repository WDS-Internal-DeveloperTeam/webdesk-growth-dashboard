/**
 * Design token PLACEHOLDERS — Phase 1A. Real values come from
 * docs/architecture/decisions/ and the (not-yet-authorized) Design Token
 * Library module; these are structural placeholders proving the token
 * shape/export pattern, not approved brand values. Never derived from or
 * copied out of the WordPress theme's own styles — the two design systems
 * are isolated by design.
 */
export const colorTokens = {
  background: "#ffffff",
  foreground: "#111111",
  primary: "#0f172a",
  muted: "#6b7280",
} as const;

export const spacingTokens = {
  xs: "0.25rem",
  sm: "0.5rem",
  md: "1rem",
  lg: "1.5rem",
  xl: "2rem",
} as const;

export type ColorToken = keyof typeof colorTokens;
export type SpacingToken = keyof typeof spacingTokens;
