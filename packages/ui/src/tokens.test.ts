import { describe, expect, it } from "vitest";
import { colorTokens, spacingTokens } from "./tokens.js";

describe("design tokens (Phase 1A placeholders)", () => {
  it("exposes the expected color token keys", () => {
    expect(Object.keys(colorTokens)).toEqual(["background", "foreground", "primary", "muted"]);
  });

  it("exposes the expected spacing token keys", () => {
    expect(Object.keys(spacingTokens)).toEqual(["xs", "sm", "md", "lg", "xl"]);
  });
});
