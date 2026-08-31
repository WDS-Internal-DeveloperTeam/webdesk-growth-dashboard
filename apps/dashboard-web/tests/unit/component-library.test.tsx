import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("next/headers", () => ({
  cookies: vi.fn(),
}));

import { cookies } from "next/headers";
import type { ComponentRecord } from "@webdesk/shared-types";
import {
  buildComponentLibraryHref,
  componentApprovalStatusBadge,
  getComponent,
  getComponents,
  getComponentsForReplacementPicker,
  getComponentVersions,
  getDesignTokensForComponentPicker,
  parseComponentLibrarySearchParams,
} from "../../lib/component-library.js";

function designTokenFixture(id: string) {
  return {
    id,
    recordId: id,
    publicId: `DTL-${id}`,
    group: "colors" as const,
    versionNumber: 1,
    isCurrent: true,
    name: "Primary Brand Blue",
    value: "#1D4ED8",
    unit: null,
    semanticPurpose: null,
    responsiveVariation: null,
    themeVariation: null,
    usageReferences: [],
    approvalStatus: "draft" as const,
    createdBy: null,
    updatedBy: null,
    createdAt: "2026-08-23T00:00:00.000Z",
    updatedAt: "2026-08-23T00:00:00.000Z",
  };
}

function componentFixture(id: string, overrides: Partial<ComponentRecord> = {}): ComponentRecord {
  return {
    id,
    recordId: id,
    publicId: `CL-${id}`,
    category: "buttons",
    versionNumber: 1,
    isCurrent: true,
    name: "Primary Button",
    figmaReference: null,
    tokenIds: [],
    htmlStructure: null,
    phpPath: null,
    scssClassesPath: null,
    jsDependencies: null,
    states: null,
    responsiveBehavior: null,
    browserSupport: null,
    accessibility: null,
    schema: null,
    analytics: null,
    tests: null,
    replacementRecordId: null,
    approvalStatus: "draft",
    createdBy: null,
    updatedBy: null,
    createdAt: "2026-08-23T00:00:00.000Z",
    updatedAt: "2026-08-23T00:00:00.000Z",
    ...overrides,
  };
}

describe("parseComponentLibrarySearchParams", () => {
  it("defaults to no filters, offset 0, pageSize 20 when nothing is provided", () => {
    expect(parseComponentLibrarySearchParams({})).toEqual({
      category: null,
      approvalStatus: null,
      search: null,
      offset: 0,
      pageSize: 20,
    });
  });

  it("parses valid category/approvalStatus/search/offset/pageSize values", () => {
    expect(
      parseComponentLibrarySearchParams({
        category: "buttons",
        approvalStatus: "under_review",
        search: "primary",
        offset: "25",
        pageSize: "50",
      }),
    ).toEqual({
      category: "buttons",
      approvalStatus: "under_review",
      search: "primary",
      offset: 25,
      pageSize: 50,
    });
  });

  it("falls back to defaults for an invalid/garbled approvalStatus instead of passing it through", () => {
    expect(
      parseComponentLibrarySearchParams({
        approvalStatus: "not_a_real_status",
        offset: "not-a-number",
        pageSize: "37",
      }),
    ).toEqual({
      category: null,
      approvalStatus: null,
      search: null,
      offset: 0,
      pageSize: 20,
    });
  });

  it("clamps a negative offset to 0", () => {
    expect(parseComponentLibrarySearchParams({ offset: "-10" }).offset).toBe(0);
  });

  it("clamps an overlong category to 100 characters", () => {
    const overlong = "x".repeat(200);
    expect(parseComponentLibrarySearchParams({ category: overlong }).category).toHaveLength(100);
  });

  it("clamps an overlong search term to 255 characters", () => {
    const overlong = "x".repeat(300);
    expect(parseComponentLibrarySearchParams({ search: overlong }).search).toHaveLength(255);
  });

  it("takes the first value when a param is duplicated in the URL", () => {
    expect(parseComponentLibrarySearchParams({ category: ["buttons", "cards"] }).category).toBe(
      "buttons",
    );
  });
});

describe("buildComponentLibraryHref", () => {
  const baseQuery = {
    category: null,
    approvalStatus: null,
    search: null,
    offset: 0,
    pageSize: 20 as const,
  };

  it("returns the bare path when nothing is set", () => {
    expect(buildComponentLibraryHref(baseQuery, {})).toBe("/component-library");
  });

  it("includes category/approvalStatus/search and omits offset=0/the default pageSize", () => {
    expect(
      buildComponentLibraryHref(baseQuery, {
        category: "cards",
        approvalStatus: "draft",
        search: "hero",
      }),
    ).toBe("/component-library?category=cards&approvalStatus=draft&search=hero");
  });

  it("resets offset to 0 when an override other than offset itself is applied", () => {
    const withOffset = { ...baseQuery, offset: 50 };
    expect(buildComponentLibraryHref(withOffset, { approvalStatus: "approved" })).toBe(
      "/component-library?approvalStatus=approved",
    );
  });

  it("keeps a nonzero offset when explicitly set", () => {
    expect(buildComponentLibraryHref(baseQuery, { offset: 25 })).toBe(
      "/component-library?offset=25",
    );
  });

  it("includes a non-default pageSize and resets offset to 0", () => {
    const withOffset = { ...baseQuery, offset: 50 };
    expect(buildComponentLibraryHref(withOffset, { pageSize: 50 })).toBe(
      "/component-library?pageSize=50",
    );
  });
});

describe("componentApprovalStatusBadge", () => {
  it("maps under_review and revision_requested to the same degraded token, disambiguated by label", () => {
    expect(componentApprovalStatusBadge("under_review")).toEqual({
      token: "degraded",
      label: "Under Review",
    });
    expect(componentApprovalStatusBadge("revision_requested")).toEqual({
      token: "degraded",
      label: "Revision Requested",
    });
  });

  it("maps approved to healthy and rejected to unavailable", () => {
    expect(componentApprovalStatusBadge("approved").token).toBe("healthy");
    expect(componentApprovalStatusBadge("rejected").token).toBe("unavailable");
  });
});

describe("getComponents", () => {
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
      getComponents({
        category: null,
        approvalStatus: null,
        search: null,
        offset: 0,
        pageSize: 20,
      }),
    ).rejects.toThrow(/Failed to load components/);
  });

  it("requests one row past the chosen page size, to detect a real next page", async () => {
    const requestedUrls: string[] = [];
    global.fetch = vi.fn((url: string) => {
      requestedUrls.push(url);
      return Promise.resolve({
        ok: true,
        json: async () => ({ success: true, data: [], correlationId: "test" }),
      } as Response);
    }) as typeof fetch;

    await getComponents({
      category: "buttons",
      approvalStatus: "draft",
      search: "primary",
      offset: 25,
      pageSize: 20,
    });

    expect(requestedUrls[0]).toBe(
      "https://api.example.com/component-library/components?category=buttons&approvalStatus=draft&search=primary&limit=21&offset=25",
    );
  });

  it("reports hasNextPage: true and trims the extra row when the backend returns one more than the page size", async () => {
    const items = Array.from({ length: 21 }, (_, i) => componentFixture(`c${i}`));
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ success: true, data: items, correlationId: "test" }),
    } as Response);

    const result = await getComponents({
      category: null,
      approvalStatus: null,
      search: null,
      offset: 0,
      pageSize: 20,
    });

    expect(result.items).toHaveLength(20);
    expect(result.hasNextPage).toBe(true);
  });
});

describe("getComponent", () => {
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
    const result = await getComponent("not-a-uuid");
    expect(result).toBeNull();
    expect(global.fetch).not.toHaveBeenCalled();
  });

  it("returns null on a 404", async () => {
    global.fetch = vi.fn().mockResolvedValue({ ok: false, status: 404 } as Response);
    expect(await getComponent(VALID_ID)).toBeNull();
  });

  it("throws on a non-404 non-OK response", async () => {
    global.fetch = vi.fn().mockResolvedValue({ ok: false, status: 403 } as Response);
    await expect(getComponent(VALID_ID)).rejects.toThrow(/Failed to load component/);
  });

  it("returns the component on a 200", async () => {
    const component = componentFixture(VALID_ID, { name: "Secondary Button" });
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ success: true, data: component, correlationId: "test" }),
    } as Response);

    const result = await getComponent(VALID_ID);
    expect(result?.id).toBe(VALID_ID);
    expect(result?.name).toBe("Secondary Button");
  });
});

describe("getComponentVersions", () => {
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

  it("returns an empty array for a malformed id without ever calling fetch", async () => {
    global.fetch = vi.fn() as typeof fetch;
    expect(await getComponentVersions("not-a-uuid")).toEqual([]);
    expect(global.fetch).not.toHaveBeenCalled();
  });

  it("returns an empty array on a 404 instead of throwing", async () => {
    global.fetch = vi.fn().mockResolvedValue({ ok: false, status: 404 } as Response);
    expect(await getComponentVersions(VALID_ID)).toEqual([]);
  });

  it("throws on a non-404 non-OK response", async () => {
    global.fetch = vi.fn().mockResolvedValue({ ok: false, status: 500 } as Response);
    await expect(getComponentVersions(VALID_ID)).rejects.toThrow(
      /Failed to load component versions/,
    );
  });

  it("requests the /versions route and returns every version, oldest first (the backend's own order, unmodified)", async () => {
    const requestedUrls: string[] = [];
    const versions = [
      componentFixture("v1", { versionNumber: 1 }),
      componentFixture("v2", { versionNumber: 2 }),
    ];
    global.fetch = vi.fn((url: string) => {
      requestedUrls.push(url);
      return Promise.resolve({
        ok: true,
        json: async () => ({ success: true, data: versions, correlationId: "test" }),
      } as Response);
    }) as typeof fetch;

    const result = await getComponentVersions(VALID_ID);

    expect(requestedUrls[0]).toBe(
      `https://api.example.com/component-library/components/${VALID_ID}/versions`,
    );
    expect(result.map((v) => v.versionNumber)).toEqual([1, 2]);
  });
});

describe("getDesignTokensForComponentPicker", () => {
  const originalFetch = global.fetch;

  beforeEach(() => {
    process.env.NEXT_PUBLIC_API_BASE_URL = "https://api.example.com";
    vi.mocked(cookies).mockResolvedValue({ toString: () => "sid=abc" } as never);
  });

  afterEach(() => {
    global.fetch = originalFetch;
    vi.restoreAllMocks();
  });

  it("requests design tokens at the largest real page size (100), with no filters applied", async () => {
    const requestedUrls: string[] = [];
    global.fetch = vi.fn((url: string) => {
      requestedUrls.push(url);
      return Promise.resolve({
        ok: true,
        json: async () => ({ success: true, data: [], correlationId: "test" }),
      } as Response);
    }) as typeof fetch;

    await getDesignTokensForComponentPicker();

    expect(requestedUrls[0]).toBe(
      "https://api.example.com/design-token-library/tokens?limit=101&offset=0",
    );
  });

  it("returns the fetched design tokens, trimmed to the page size", async () => {
    const items = [designTokenFixture("t1"), designTokenFixture("t2")];
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ success: true, data: items, correlationId: "test" }),
    } as Response);

    expect(await getDesignTokensForComponentPicker()).toEqual(items);
  });

  it("degrades to an empty list instead of throwing when the fetch fails", async () => {
    const consoleErrorSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    global.fetch = vi.fn().mockResolvedValue({ ok: false, status: 500 } as Response);

    await expect(getDesignTokensForComponentPicker()).resolves.toEqual([]);
    expect(consoleErrorSpy).toHaveBeenCalledTimes(1);
  });

  it("degrades to an empty list instead of throwing on a network error", async () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    global.fetch = vi.fn().mockRejectedValue(new Error("network error"));

    await expect(getDesignTokensForComponentPicker()).resolves.toEqual([]);
  });
});

describe("getComponentsForReplacementPicker", () => {
  const originalFetch = global.fetch;

  beforeEach(() => {
    process.env.NEXT_PUBLIC_API_BASE_URL = "https://api.example.com";
    vi.mocked(cookies).mockResolvedValue({ toString: () => "sid=abc" } as never);
  });

  afterEach(() => {
    global.fetch = originalFetch;
    vi.restoreAllMocks();
  });

  it("requests components at the largest real page size (100), with no filters applied", async () => {
    const requestedUrls: string[] = [];
    global.fetch = vi.fn((url: string) => {
      requestedUrls.push(url);
      return Promise.resolve({
        ok: true,
        json: async () => ({ success: true, data: [], correlationId: "test" }),
      } as Response);
    }) as typeof fetch;

    await getComponentsForReplacementPicker();

    expect(requestedUrls[0]).toBe(
      "https://api.example.com/component-library/components?limit=101&offset=0",
    );
  });

  it("returns the fetched components, trimmed to the page size", async () => {
    const items = [componentFixture("c1"), componentFixture("c2")];
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ success: true, data: items, correlationId: "test" }),
    } as Response);

    expect(await getComponentsForReplacementPicker()).toEqual(items);
  });

  it("degrades to an empty list instead of throwing when the fetch fails", async () => {
    const consoleErrorSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    global.fetch = vi.fn().mockResolvedValue({ ok: false, status: 500 } as Response);

    await expect(getComponentsForReplacementPicker()).resolves.toEqual([]);
    expect(consoleErrorSpy).toHaveBeenCalledTimes(1);
  });

  it("degrades to an empty list instead of throwing on a network error", async () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    global.fetch = vi.fn().mockRejectedValue(new Error("network error"));

    await expect(getComponentsForReplacementPicker()).resolves.toEqual([]);
  });
});
