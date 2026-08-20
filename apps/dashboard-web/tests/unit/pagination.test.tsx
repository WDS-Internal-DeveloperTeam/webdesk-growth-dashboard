import { describe, expect, it } from "vitest";
import { DEFAULT_PAGE_SIZE, PAGE_SIZE_OPTIONS, parsePageSize } from "../../lib/pagination.js";

describe("parsePageSize", () => {
  it("defaults to DEFAULT_PAGE_SIZE when nothing is provided", () => {
    expect(parsePageSize(undefined)).toBe(DEFAULT_PAGE_SIZE);
  });

  it.each(PAGE_SIZE_OPTIONS)("accepts %i, a real allowed option", (size) => {
    expect(parsePageSize(String(size))).toBe(size);
  });

  it("falls back to the default for a value outside the allowed set", () => {
    expect(parsePageSize("37")).toBe(DEFAULT_PAGE_SIZE);
  });

  it("falls back to the default for a non-numeric value", () => {
    expect(parsePageSize("not-a-number")).toBe(DEFAULT_PAGE_SIZE);
  });

  it("falls back to the default for a negative value", () => {
    expect(parsePageSize("-10")).toBe(DEFAULT_PAGE_SIZE);
  });
});
