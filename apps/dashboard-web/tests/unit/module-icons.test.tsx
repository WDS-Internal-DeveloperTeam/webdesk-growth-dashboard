import { Home, LayoutGrid } from "lucide-react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { moduleIcon } from "../../lib/module-icons.js";

describe("moduleIcon", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("resolves a known iconReference to its real icon, not a fallback", () => {
    const result = moduleIcon("home");
    expect(result.Icon).toBe(Home);
    expect(result.isFallback).toBe(false);
  });

  it("falls back to LayoutGrid, flagged as a fallback, for a null iconReference", () => {
    const result = moduleIcon(null);
    expect(result.Icon).toBe(LayoutGrid);
    expect(result.isFallback).toBe(true);
  });

  it("falls back to LayoutGrid, flagged as a fallback and logged, for an unrecognized iconReference", () => {
    const consoleErrorSpy = vi.spyOn(console, "error").mockImplementation(() => {});

    const result = moduleIcon("not-a-real-icon-name");

    expect(result.Icon).toBe(LayoutGrid);
    expect(result.isFallback).toBe(true);
    expect(consoleErrorSpy).toHaveBeenCalledWith(expect.stringContaining("not-a-real-icon-name"));
  });

  it("does not log for a null iconReference — that's an expected, routine case, not a drift signal", () => {
    const consoleErrorSpy = vi.spyOn(console, "error").mockImplementation(() => {});

    moduleIcon(null);

    expect(consoleErrorSpy).not.toHaveBeenCalled();
  });
});
