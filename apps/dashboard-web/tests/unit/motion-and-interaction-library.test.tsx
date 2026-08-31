import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("next/headers", () => ({
  cookies: vi.fn(),
}));

import { cookies } from "next/headers";
import type { ComponentRecord, MotionInteractionRecord } from "@webdesk/shared-types";
import {
  buildMotionAndInteractionLibraryHref,
  getComponentsForMotionInteractionPicker,
  getMotionInteractionRecord,
  getMotionInteractionRecords,
  getMotionInteractionRecordVersions,
  motionInteractionApprovalStatusBadge,
  parseMotionAndInteractionLibrarySearchParams,
} from "../../lib/motion-and-interaction-library.js";

function recordFixture(
  id: string,
  overrides: Partial<MotionInteractionRecord> = {},
): MotionInteractionRecord {
  return {
    id,
    recordId: id,
    publicId: `MIL-${id}`,
    category: "modal_drawer",
    versionNumber: 1,
    isCurrent: true,
    name: "Modal open/close",
    description: null,
    triggerAndBehavior: null,
    timingAndEasing: null,
    implementationSpec: null,
    accessibilityNotes: null,
    fallbackBehavior: null,
    designReference: null,
    relatedComponentIds: [],
    approvalStatus: "draft",
    createdBy: null,
    updatedBy: null,
    createdAt: "2026-08-31T00:00:00.000Z",
    updatedAt: "2026-08-31T00:00:00.000Z",
    ...overrides,
  };
}

function componentFixture(id: string): ComponentRecord {
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
    createdAt: "2026-08-31T00:00:00.000Z",
    updatedAt: "2026-08-31T00:00:00.000Z",
  };
}

describe("parseMotionAndInteractionLibrarySearchParams", () => {
  it("defaults to no filters, offset 0, pageSize 20 when nothing is provided", () => {
    expect(parseMotionAndInteractionLibrarySearchParams({})).toEqual({
      category: null,
      approvalStatus: null,
      search: null,
      offset: 0,
      pageSize: 20,
    });
  });

  it("parses valid category/approvalStatus/search/offset/pageSize values", () => {
    expect(
      parseMotionAndInteractionLibrarySearchParams({
        category: "tooltip",
        approvalStatus: "under_review",
        search: "modal",
        offset: "25",
        pageSize: "50",
      }),
    ).toEqual({
      category: "tooltip",
      approvalStatus: "under_review",
      search: "modal",
      offset: 25,
      pageSize: 50,
    });
  });

  it("falls back to defaults for an invalid/garbled category/approvalStatus instead of passing it through", () => {
    expect(
      parseMotionAndInteractionLibrarySearchParams({
        category: "not_a_real_category",
        approvalStatus: "not_a_real_status",
        offset: "not-a-number",
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
    expect(parseMotionAndInteractionLibrarySearchParams({ offset: "-10" }).offset).toBe(0);
  });

  it("clamps an overlong search term to 255 characters", () => {
    const overlong = "x".repeat(300);
    expect(parseMotionAndInteractionLibrarySearchParams({ search: overlong }).search).toHaveLength(
      255,
    );
  });

  it("takes the first value when a param is duplicated in the URL", () => {
    expect(
      parseMotionAndInteractionLibrarySearchParams({ category: ["tooltip", "menu"] }).category,
    ).toBe("tooltip");
  });
});

describe("buildMotionAndInteractionLibraryHref", () => {
  const baseQuery = {
    category: null,
    approvalStatus: null,
    search: null,
    offset: 0,
    pageSize: 20 as const,
  };

  it("returns the bare path when nothing is set", () => {
    expect(buildMotionAndInteractionLibraryHref(baseQuery, {})).toBe(
      "/motion-and-interaction-library",
    );
  });

  it("includes category/approvalStatus/search and omits offset=0/the default pageSize", () => {
    expect(
      buildMotionAndInteractionLibraryHref(baseQuery, {
        category: "menu",
        approvalStatus: "draft",
        search: "hero",
      }),
    ).toBe("/motion-and-interaction-library?category=menu&approvalStatus=draft&search=hero");
  });

  it("resets offset to 0 when an override other than offset itself is applied", () => {
    const withOffset = { ...baseQuery, offset: 50 };
    expect(buildMotionAndInteractionLibraryHref(withOffset, { approvalStatus: "approved" })).toBe(
      "/motion-and-interaction-library?approvalStatus=approved",
    );
  });

  it("keeps a nonzero offset when explicitly set", () => {
    expect(buildMotionAndInteractionLibraryHref(baseQuery, { offset: 25 })).toBe(
      "/motion-and-interaction-library?offset=25",
    );
  });
});

describe("motionInteractionApprovalStatusBadge", () => {
  it("maps under_review and revision_requested to the same degraded token, disambiguated by label", () => {
    expect(motionInteractionApprovalStatusBadge("under_review")).toEqual({
      token: "degraded",
      label: "Under Review",
    });
    expect(motionInteractionApprovalStatusBadge("revision_requested")).toEqual({
      token: "degraded",
      label: "Revision Requested",
    });
  });

  it("maps approved to healthy and rejected to unavailable", () => {
    expect(motionInteractionApprovalStatusBadge("approved").token).toBe("healthy");
    expect(motionInteractionApprovalStatusBadge("rejected").token).toBe("unavailable");
  });
});

describe("getMotionInteractionRecords", () => {
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
      getMotionInteractionRecords({
        category: null,
        approvalStatus: null,
        search: null,
        offset: 0,
        pageSize: 20,
      }),
    ).rejects.toThrow(/Failed to load motion\/interaction records/);
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

    await getMotionInteractionRecords({
      category: "menu",
      approvalStatus: "draft",
      search: "modal",
      offset: 25,
      pageSize: 20,
    });

    expect(requestedUrls[0]).toBe(
      "https://api.example.com/motion-and-interaction-library/records?category=menu&approvalStatus=draft&search=modal&limit=21&offset=25",
    );
  });

  it("reports hasNextPage: true and trims the extra row when the backend returns one more than the page size", async () => {
    const items = Array.from({ length: 21 }, (_, i) => recordFixture(`r${i}`));
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ success: true, data: items, correlationId: "test" }),
    } as Response);

    const result = await getMotionInteractionRecords({
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

describe("getMotionInteractionRecord", () => {
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
    expect(await getMotionInteractionRecord("not-a-uuid")).toBeNull();
    expect(global.fetch).not.toHaveBeenCalled();
  });

  it("returns null on a 404", async () => {
    global.fetch = vi.fn().mockResolvedValue({ ok: false, status: 404 } as Response);
    expect(await getMotionInteractionRecord(VALID_ID)).toBeNull();
  });

  it("throws on a non-404 non-OK response", async () => {
    global.fetch = vi.fn().mockResolvedValue({ ok: false, status: 403 } as Response);
    await expect(getMotionInteractionRecord(VALID_ID)).rejects.toThrow(
      /Failed to load motion\/interaction record/,
    );
  });

  it("returns the record on a 200", async () => {
    const record = recordFixture(VALID_ID, { name: "Drawer slide in" });
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ success: true, data: record, correlationId: "test" }),
    } as Response);

    const result = await getMotionInteractionRecord(VALID_ID);
    expect(result?.id).toBe(VALID_ID);
    expect(result?.name).toBe("Drawer slide in");
  });
});

describe("getMotionInteractionRecordVersions", () => {
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
    expect(await getMotionInteractionRecordVersions("not-a-uuid")).toEqual([]);
    expect(global.fetch).not.toHaveBeenCalled();
  });

  it("returns an empty array on a 404 instead of throwing", async () => {
    global.fetch = vi.fn().mockResolvedValue({ ok: false, status: 404 } as Response);
    expect(await getMotionInteractionRecordVersions(VALID_ID)).toEqual([]);
  });

  it("throws on a non-404 non-OK response", async () => {
    global.fetch = vi.fn().mockResolvedValue({ ok: false, status: 500 } as Response);
    await expect(getMotionInteractionRecordVersions(VALID_ID)).rejects.toThrow(
      /Failed to load motion\/interaction record versions/,
    );
  });

  it("requests the /versions route and returns every version, oldest first (the backend's own order, unmodified)", async () => {
    const requestedUrls: string[] = [];
    const versions = [
      recordFixture("v1", { versionNumber: 1 }),
      recordFixture("v2", { versionNumber: 2 }),
    ];
    global.fetch = vi.fn((url: string) => {
      requestedUrls.push(url);
      return Promise.resolve({
        ok: true,
        json: async () => ({ success: true, data: versions, correlationId: "test" }),
      } as Response);
    }) as typeof fetch;

    const result = await getMotionInteractionRecordVersions(VALID_ID);

    expect(requestedUrls[0]).toBe(
      `https://api.example.com/motion-and-interaction-library/records/${VALID_ID}/versions`,
    );
    expect(result.map((v) => v.versionNumber)).toEqual([1, 2]);
  });
});

describe("getComponentsForMotionInteractionPicker", () => {
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

    await getComponentsForMotionInteractionPicker();

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

    expect(await getComponentsForMotionInteractionPicker()).toEqual(items);
  });

  it("degrades to an empty list instead of throwing on a network error", async () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    global.fetch = vi.fn().mockRejectedValue(new Error("network error"));

    await expect(getComponentsForMotionInteractionPicker()).resolves.toEqual([]);
  });
});
