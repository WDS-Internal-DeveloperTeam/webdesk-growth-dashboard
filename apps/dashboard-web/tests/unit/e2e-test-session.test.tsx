import { afterEach, describe, expect, it, vi } from "vitest";
import {
  E2E_SESSION_COOKIE_NAME,
  e2eSessionCookieHeader,
  getE2eFixtureSession,
  isE2eSessionCookieValid,
  isE2eTestModeEnabled,
} from "../../lib/e2e-test-session.js";

afterEach(() => {
  vi.unstubAllEnvs();
});

describe("isE2eTestModeEnabled", () => {
  it("requires BOTH a non-production NODE_ENV and the explicit flag", () => {
    vi.stubEnv("NODE_ENV", "development");
    vi.stubEnv("PLAYWRIGHT_E2E_TEST_MODE", "1");
    expect(isE2eTestModeEnabled()).toBe(true);
  });

  it("is disabled when NODE_ENV is production, even if the flag is set", () => {
    vi.stubEnv("NODE_ENV", "production");
    vi.stubEnv("PLAYWRIGHT_E2E_TEST_MODE", "1");
    expect(isE2eTestModeEnabled()).toBe(false);
  });

  it("is disabled when the flag is unset, even in a non-production NODE_ENV", () => {
    vi.stubEnv("NODE_ENV", "development");
    vi.stubEnv("PLAYWRIGHT_E2E_TEST_MODE", undefined);
    expect(isE2eTestModeEnabled()).toBe(false);
  });

  it("is disabled when the flag has any value other than the exact string '1'", () => {
    vi.stubEnv("NODE_ENV", "development");
    vi.stubEnv("PLAYWRIGHT_E2E_TEST_MODE", "true");
    expect(isE2eTestModeEnabled()).toBe(false);
  });
});

describe("isE2eSessionCookieValid", () => {
  it("accepts only the exact expected fixture cookie value", () => {
    expect(isE2eSessionCookieValid(e2eSessionCookieHeader().split("=")[1])).toBe(true);
    expect(isE2eSessionCookieValid("anything-else")).toBe(false);
    expect(isE2eSessionCookieValid(undefined)).toBe(false);
    expect(isE2eSessionCookieValid("")).toBe(false);
  });
});

describe("e2eSessionCookieHeader", () => {
  it("names the cookie consistently with E2E_SESSION_COOKIE_NAME", () => {
    expect(e2eSessionCookieHeader()).toBe(
      `${E2E_SESSION_COOKIE_NAME}=${e2eSessionCookieHeader().split("=")[1]}`,
    );
  });
});

describe("getE2eFixtureSession", () => {
  it("returns a fixture covering all 10 approved navigation groups, including libraries clusters", () => {
    const session = getE2eFixtureSession();
    const groups = new Set(session.navigation.map((entry) => entry.navigationGroup));
    expect(groups).toEqual(
      new Set([
        "home",
        "projects",
        "pages",
        "libraries",
        "workflow",
        "scans",
        "technical",
        "releases",
        "help",
        "settings",
      ]),
    );
    const libraryKeys = session.navigation
      .filter((entry) => entry.navigationGroup === "libraries")
      .map((entry) => entry.key);
    expect(libraryKeys.length).toBeGreaterThanOrEqual(5);
  });

  it("returns a fixed, non-empty user profile and at least one project", () => {
    const session = getE2eFixtureSession();
    expect(session.me.displayName).toBeTruthy();
    expect(session.projects.length).toBeGreaterThan(0);
  });
});
