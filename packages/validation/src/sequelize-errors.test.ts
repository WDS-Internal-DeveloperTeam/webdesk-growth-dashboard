import { describe, expect, it } from "vitest";
import { isSequelizeUniqueConstraintError } from "./sequelize-errors.js";

describe("isSequelizeUniqueConstraintError", () => {
  it("returns true for an Error named SequelizeUniqueConstraintError", () => {
    const error = new Error("duplicate key value");
    error.name = "SequelizeUniqueConstraintError";
    expect(isSequelizeUniqueConstraintError(error)).toBe(true);
  });

  it("returns false for a differently-named Error", () => {
    expect(isSequelizeUniqueConstraintError(new TypeError("boom"))).toBe(false);
  });

  it("returns false for a non-Error value", () => {
    expect(isSequelizeUniqueConstraintError("not an error")).toBe(false);
    expect(isSequelizeUniqueConstraintError(null)).toBe(false);
    expect(isSequelizeUniqueConstraintError(undefined)).toBe(false);
  });
});
