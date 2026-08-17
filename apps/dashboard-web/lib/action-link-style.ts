import { colorTokens, radiusTokens, spacingTokens, typographyTokens } from "@webdesk/ui";
import type { CSSProperties } from "react";

/**
 * The one shared "primary action" pill-link style for page-header actions (e.g. "New project",
 * "Edit") — built from the same design tokens `project-form.module.css`'s `.submitButton` class
 * already uses, so a page-header action link and the form's own submit button render identically.
 * Previously each consuming page defined its own byte-for-byte-identical inline copy with
 * hand-typed values that had already drifted from `.submitButton`'s token-derived ones.
 */
export const primaryActionLinkStyle: CSSProperties = {
  fontSize: typographyTokens.fontSizeSm,
  fontWeight: typographyTokens.fontWeightMedium,
  color: colorTokens.accentForeground,
  background: colorTokens.accent,
  borderRadius: radiusTokens.sm,
  padding: `${spacingTokens.sm} ${spacingTokens.md}`,
};
