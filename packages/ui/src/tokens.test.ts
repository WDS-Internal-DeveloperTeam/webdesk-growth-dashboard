import { describe, expect, it } from "vitest";
import {
  borderTokens,
  breakpointTokens,
  colorTokens,
  controlSizeTokens,
  focusTokens,
  layoutTokens,
  motionTokens,
  radiusTokens,
  shadowTokens,
  spacingTokens,
  statusBadgeTokens,
  statusTokens,
  toCssCustomProperties,
  typographyTokens,
  zIndexTokens,
} from "./tokens.js";

describe("design tokens (Phase 1F application-shell foundation)", () => {
  it("exposes color tokens including the semantic status/surface set", () => {
    expect(colorTokens.background).toBeTruthy();
    expect(colorTokens.danger).toBeTruthy();
    expect(colorTokens.focusRing).toBeTruthy();
  });

  it("exposes typography tokens", () => {
    expect(typographyTokens.fontFamilyBase).toContain("sans-serif");
    expect(Object.keys(typographyTokens)).toContain("fontSizeMd");
  });

  it("exposes spacing tokens", () => {
    expect(Object.keys(spacingTokens)).toEqual([
      "none",
      "2xs",
      "xs",
      "sm",
      "md",
      "lg",
      "xl",
      "2xl",
      "3xl",
    ]);
  });

  it("exposes layout, border, radius, shadow, and focus tokens", () => {
    expect(layoutTokens.sidebarWidth).toBeTruthy();
    expect(borderTokens.widthThin).toBe("1px");
    expect(radiusTokens.md).toBeTruthy();
    expect(shadowTokens.md).toBeTruthy();
    expect(focusTokens.ringColor).toBe(colorTokens.focusRing);
  });

  it("exposes status tokens distinct from the accent color", () => {
    expect(statusTokens.healthy).not.toBe(colorTokens.accent);
    expect(Object.keys(statusTokens)).toEqual([
      "healthy",
      "degraded",
      "unavailable",
      "notConfigured",
      "unknown",
    ]);
  });

  it("exposes wide-content and drawer layout tokens", () => {
    expect(layoutTokens.contentMaxWidthWide).toBe("1600px");
    expect(layoutTokens.drawerWidth).toBe("420px");
  });

  it("exposes the 5-bucket status-badge palette, distinct from statusTokens", () => {
    expect(Object.keys(statusBadgeTokens)).toEqual([
      "healthy",
      "attention",
      "blocked",
      "informational",
      "neutral",
    ]);
    for (const bucket of Object.values(statusBadgeTokens)) {
      expect(bucket.text).toBeTruthy();
      expect(bucket.background).toBeTruthy();
      expect(bucket.dot).toBeTruthy();
    }
    expect(statusBadgeTokens.healthy.text).not.toBe(statusTokens.healthy);
  });

  it("exposes control-size, breakpoint, z-index, and motion tokens", () => {
    expect(controlSizeTokens.md.height).toBeTruthy();
    expect(Object.keys(breakpointTokens)).toEqual(["mobile", "tablet", "laptop", "desktop"]);
    expect(zIndexTokens.modal).toBeGreaterThan(zIndexTokens.base);
    expect(motionTokens.easingStandard).toContain("cubic-bezier");
  });

  it("flattens every token group into prefixed CSS custom properties", () => {
    const properties = toCssCustomProperties();
    expect(properties["--webdesk-dashboard-color-background"]).toBe(colorTokens.background);
    expect(properties["--webdesk-dashboard-space-md"]).toBe(spacingTokens.md);
    expect(properties["--webdesk-dashboard-status-healthy"]).toBe(statusTokens.healthy);
    expect(Object.keys(properties).every((key) => key.startsWith("--webdesk-dashboard-"))).toBe(
      true,
    );
  });

  it("also flattens focus, breakpoint, z-index, and motion tokens (not just color/space/status)", () => {
    const properties = toCssCustomProperties();
    expect(properties["--webdesk-dashboard-focus-ring-color"]).toBe(focusTokens.ringColor);
    expect(properties["--webdesk-dashboard-breakpoint-tablet"]).toBe(breakpointTokens.tablet);
    expect(properties["--webdesk-dashboard-zindex-modal"]).toBe(String(zIndexTokens.modal));
    expect(properties["--webdesk-dashboard-motion-duration-base"]).toBe(motionTokens.durationBase);
  });
});
