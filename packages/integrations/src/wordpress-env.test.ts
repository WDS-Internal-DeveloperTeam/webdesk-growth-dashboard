import { describe, expect, it } from "vitest";
import { loadWordPressEnv } from "./wordpress-env.js";

const validSource = {
  WORDPRESS_BASE_URL: "https://staging-7a61-wdsstage2.wpcomstaging.com",
  WORDPRESS_APP_USERNAME: "dashboard-integration",
  WORDPRESS_APP_PASSWORD: "abcd efgh ijkl mnop",
};

describe("loadWordPressEnv", () => {
  it("parses a valid source", () => {
    const env = loadWordPressEnv(validSource);
    expect(env.WORDPRESS_BASE_URL).toBe(validSource.WORDPRESS_BASE_URL);
    expect(env.WORDPRESS_APP_USERNAME).toBe(validSource.WORDPRESS_APP_USERNAME);
    expect(env.WORDPRESS_APP_PASSWORD).toBe(validSource.WORDPRESS_APP_PASSWORD);
  });

  it("rejects a base URL with a trailing slash", () => {
    expect(() =>
      loadWordPressEnv({
        ...validSource,
        WORDPRESS_BASE_URL: `${validSource.WORDPRESS_BASE_URL}/`,
      }),
    ).toThrow(/trailing slash/);
  });

  it("rejects a non-URL base URL", () => {
    expect(() => loadWordPressEnv({ ...validSource, WORDPRESS_BASE_URL: "not-a-url" })).toThrow();
  });

  it("requires a non-empty username", () => {
    expect(() => loadWordPressEnv({ ...validSource, WORDPRESS_APP_USERNAME: "" })).toThrow(
      /WORDPRESS_APP_USERNAME is required/,
    );
  });

  it("requires a non-empty password", () => {
    expect(() => loadWordPressEnv({ ...validSource, WORDPRESS_APP_PASSWORD: "" })).toThrow(
      /WORDPRESS_APP_PASSWORD is required/,
    );
  });

  it("throws listing every missing field when the source is empty", () => {
    expect(() => loadWordPressEnv({})).toThrow(/WORDPRESS_BASE_URL/);
  });
});
