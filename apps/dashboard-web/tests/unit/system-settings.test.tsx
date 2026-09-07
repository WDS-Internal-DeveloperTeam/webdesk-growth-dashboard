import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("next/headers", () => ({
  cookies: vi.fn(),
}));

import { cookies } from "next/headers";
import type { SystemSetting } from "@webdesk/shared-types";
import {
  buildSystemSettingsHref,
  getSystemSetting,
  getSystemSettings,
  parseSystemSettingsSearchParams,
  systemSettingActiveBadge,
} from "../../lib/system-settings.js";

describe("parseSystemSettingsSearchParams", () => {
  it("defaults to no filters, offset 0, pageSize 20 when nothing is provided", () => {
    expect(parseSystemSettingsSearchParams({})).toEqual({
      settingType: null,
      isActive: null,
      search: null,
      offset: 0,
      pageSize: 20,
    });
  });

  it("parses valid settingType/isActive/search/offset/pageSize values", () => {
    expect(
      parseSystemSettingsSearchParams({
        settingType: "file_limit",
        isActive: "true",
        search: "upload",
        offset: "25",
        pageSize: "50",
      }),
    ).toEqual({
      settingType: "file_limit",
      isActive: true,
      search: "upload",
      offset: 25,
      pageSize: 50,
    });
  });

  it("parses isActive=false as literal false, not falling through to null", () => {
    expect(parseSystemSettingsSearchParams({ isActive: "false" }).isActive).toBe(false);
  });

  it("falls back to defaults for invalid/garbled enum values instead of passing them through", () => {
    expect(
      parseSystemSettingsSearchParams({
        settingType: "not_a_real_type",
        isActive: "maybe",
        offset: "not-a-number",
        pageSize: "37",
      }),
    ).toEqual({
      settingType: null,
      isActive: null,
      search: null,
      offset: 0,
      pageSize: 20,
    });
  });

  it("clamps a negative offset to 0", () => {
    expect(parseSystemSettingsSearchParams({ offset: "-10" }).offset).toBe(0);
  });

  it("clamps an overlong search term to 255 characters", () => {
    const overlong = "x".repeat(300);
    expect(parseSystemSettingsSearchParams({ search: overlong }).search).toHaveLength(255);
  });

  it("takes the first value when a param is duplicated in the URL", () => {
    expect(
      parseSystemSettingsSearchParams({ settingType: ["file_limit", "git_rule"] }).settingType,
    ).toBe("file_limit");
  });
});

describe("buildSystemSettingsHref", () => {
  const baseQuery = {
    settingType: null,
    isActive: null,
    search: null,
    offset: 0,
    pageSize: 20 as const,
  };

  it("returns the bare path when nothing is set", () => {
    expect(buildSystemSettingsHref(baseQuery, {})).toBe("/system-settings");
  });

  it("includes settingType/isActive/search and omits offset=0/the default pageSize", () => {
    expect(
      buildSystemSettingsHref(baseQuery, {
        settingType: "git_rule",
        isActive: true,
        search: "branch",
      }),
    ).toBe("/system-settings?settingType=git_rule&isActive=true&search=branch");
  });

  it("includes isActive=false explicitly rather than omitting it", () => {
    expect(buildSystemSettingsHref(baseQuery, { isActive: false })).toBe(
      "/system-settings?isActive=false",
    );
  });

  it("resets offset to 0 when an override other than offset itself is applied", () => {
    const withOffset = { ...baseQuery, offset: 50 };
    expect(buildSystemSettingsHref(withOffset, { settingType: "environment" })).toBe(
      "/system-settings?settingType=environment",
    );
  });

  it("keeps a nonzero offset when explicitly set", () => {
    expect(buildSystemSettingsHref(baseQuery, { offset: 25 })).toBe("/system-settings?offset=25");
  });

  it("includes a non-default pageSize and resets offset to 0", () => {
    const withOffset = { ...baseQuery, offset: 50 };
    expect(buildSystemSettingsHref(withOffset, { pageSize: 50 })).toBe(
      "/system-settings?pageSize=50",
    );
  });
});

describe("systemSettingActiveBadge", () => {
  it("maps active to healthy and inactive to notConfigured", () => {
    expect(systemSettingActiveBadge(true)).toEqual({ token: "healthy", label: "Active" });
    expect(systemSettingActiveBadge(false)).toEqual({
      token: "notConfigured",
      label: "Inactive",
    });
  });
});

function settingFixture(id: string, overrides: Partial<SystemSetting> = {}): SystemSetting {
  return {
    id,
    publicId: `SETTING-${id}`,
    settingType: "file_limit",
    key: "max_upload_bytes",
    value: { maxBytes: 10485760 },
    description: null,
    isActive: true,
    createdBy: null,
    updatedBy: null,
    createdAt: "2026-09-07T00:00:00.000Z",
    updatedAt: "2026-09-07T00:00:00.000Z",
    ...overrides,
  };
}

describe("getSystemSettings", () => {
  const originalFetch = global.fetch;

  beforeEach(() => {
    process.env.NEXT_PUBLIC_API_BASE_URL = "https://api.example.com";
    vi.mocked(cookies).mockResolvedValue({ toString: () => "sid=abc" } as never);
  });

  afterEach(() => {
    global.fetch = originalFetch;
    vi.restoreAllMocks();
  });

  it("throws on a non-OK response instead of silently returning an empty list", async () => {
    global.fetch = vi.fn().mockResolvedValue({ ok: false, status: 500 } as Response);
    await expect(
      getSystemSettings({
        settingType: null,
        isActive: null,
        search: null,
        offset: 0,
        pageSize: 20,
      }),
    ).rejects.toThrow(/Failed to load system settings/);
  });

  it("requests one row past the chosen page size, to detect a real next page, including settingType/isActive", async () => {
    const requestedUrls: string[] = [];
    global.fetch = vi.fn((url: string) => {
      requestedUrls.push(url);
      return Promise.resolve({
        ok: true,
        json: async () => ({ success: true, data: [], correlationId: "test" }),
      } as Response);
    }) as typeof fetch;

    await getSystemSettings({
      settingType: "git_rule",
      isActive: true,
      search: "branch",
      offset: 25,
      pageSize: 20,
    });

    expect(requestedUrls[0]).toBe(
      "https://api.example.com/system-settings/settings?settingType=git_rule&isActive=true&search=branch&limit=21&offset=25",
    );
  });

  it("reports hasNextPage: true and trims the extra row when the backend returns one more than the page size", async () => {
    const items = Array.from({ length: 21 }, (_, i) => settingFixture(`s${i}`));
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ success: true, data: items, correlationId: "test" }),
    } as Response);

    const result = await getSystemSettings({
      settingType: null,
      isActive: null,
      search: null,
      offset: 0,
      pageSize: 20,
    });

    expect(result.items).toHaveLength(20);
    expect(result.hasNextPage).toBe(true);
  });
});

describe("getSystemSetting", () => {
  const originalFetch = global.fetch;
  const VALID_ID = "11111111-1111-1111-1111-111111111111";

  beforeEach(() => {
    process.env.NEXT_PUBLIC_API_BASE_URL = "https://api.example.com";
    vi.mocked(cookies).mockResolvedValue({ toString: () => "sid=abc" } as never);
  });

  afterEach(() => {
    global.fetch = originalFetch;
    vi.restoreAllMocks();
  });

  it("returns null for a malformed id without ever calling fetch", async () => {
    global.fetch = vi.fn() as typeof fetch;
    const result = await getSystemSetting("not-a-uuid");
    expect(result).toBeNull();
    expect(global.fetch).not.toHaveBeenCalled();
  });

  it("returns null on a 404", async () => {
    global.fetch = vi.fn().mockResolvedValue({ ok: false, status: 404 } as Response);
    expect(await getSystemSetting(VALID_ID)).toBeNull();
  });

  it("throws on a non-404 non-OK response", async () => {
    global.fetch = vi.fn().mockResolvedValue({ ok: false, status: 403 } as Response);
    await expect(getSystemSetting(VALID_ID)).rejects.toThrow(/Failed to load system setting/);
  });

  it("returns the system setting on a 200", async () => {
    const setting = settingFixture(VALID_ID, { key: "allowed_mime_types" });
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ success: true, data: setting, correlationId: "test" }),
    } as Response);

    const result = await getSystemSetting(VALID_ID);
    expect(result?.id).toBe(VALID_ID);
    expect(result?.key).toBe("allowed_mime_types");
  });
});
