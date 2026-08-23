import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("next/headers", () => ({
  cookies: vi.fn(),
}));

import { cookies } from "next/headers";
import type { WebsiteStrategyRecord } from "@webdesk/shared-types";
import {
  buildWebsiteStrategyCenterHref,
  getWebsiteStrategyRecord,
  getWebsiteStrategyRecords,
  getWebsiteStrategyRecordVersions,
  parseWebsiteStrategyCenterSearchParams,
  websiteStrategyApprovalStatusBadge,
} from "../../lib/website-strategy-center.js";

function recordFixture(
  id: string,
  overrides: Partial<WebsiteStrategyRecord> = {},
): WebsiteStrategyRecord {
  return {
    id,
    recordId: id,
    publicId: `WSC-${id}`,
    recordType: "navigation_plan",
    versionNumber: 1,
    isCurrent: true,
    title: "Primary Navigation Plan",
    content: null,
    notes: null,
    approvalStatus: "draft",
    createdBy: null,
    updatedBy: null,
    createdAt: "2026-08-23T00:00:00.000Z",
    updatedAt: "2026-08-23T00:00:00.000Z",
    ...overrides,
  };
}

describe("parseWebsiteStrategyCenterSearchParams", () => {
  it("defaults to no filters, offset 0, pageSize 20 when nothing is provided", () => {
    expect(parseWebsiteStrategyCenterSearchParams({})).toEqual({
      recordType: null,
      approvalStatus: null,
      search: null,
      offset: 0,
      pageSize: 20,
    });
  });

  it("parses valid recordType/approvalStatus/search/offset/pageSize values", () => {
    expect(
      parseWebsiteStrategyCenterSearchParams({
        recordType: "pillar_strategy",
        approvalStatus: "under_review",
        search: "pillar",
        offset: "25",
        pageSize: "50",
      }),
    ).toEqual({
      recordType: "pillar_strategy",
      approvalStatus: "under_review",
      search: "pillar",
      offset: 25,
      pageSize: 50,
    });
  });

  it("falls back to defaults for invalid/garbled enum values instead of passing them through", () => {
    expect(
      parseWebsiteStrategyCenterSearchParams({
        recordType: "not_a_real_type",
        approvalStatus: "not_a_real_status",
        offset: "not-a-number",
        pageSize: "37",
      }),
    ).toEqual({
      recordType: null,
      approvalStatus: null,
      search: null,
      offset: 0,
      pageSize: 20,
    });
  });

  it("clamps a negative offset to 0", () => {
    expect(parseWebsiteStrategyCenterSearchParams({ offset: "-10" }).offset).toBe(0);
  });

  it("clamps an overlong search term to 255 characters", () => {
    const overlong = "x".repeat(300);
    expect(parseWebsiteStrategyCenterSearchParams({ search: overlong }).search).toHaveLength(255);
  });

  it("takes the first value when a param is duplicated in the URL", () => {
    expect(
      parseWebsiteStrategyCenterSearchParams({ recordType: ["navigation_plan", "page_clusters"] })
        .recordType,
    ).toBe("navigation_plan");
  });
});

describe("buildWebsiteStrategyCenterHref", () => {
  const baseQuery = {
    recordType: null,
    approvalStatus: null,
    search: null,
    offset: 0,
    pageSize: 20 as const,
  };

  it("returns the bare path when nothing is set", () => {
    expect(buildWebsiteStrategyCenterHref(baseQuery, {})).toBe("/website-strategy-center");
  });

  it("includes recordType/approvalStatus/search and omits offset=0/the default pageSize", () => {
    expect(
      buildWebsiteStrategyCenterHref(baseQuery, {
        recordType: "conversion_plan",
        approvalStatus: "draft",
        search: "checkout",
      }),
    ).toBe(
      "/website-strategy-center?recordType=conversion_plan&approvalStatus=draft&search=checkout",
    );
  });

  it("resets offset to 0 when an override other than offset itself is applied", () => {
    const withOffset = { ...baseQuery, offset: 50 };
    expect(buildWebsiteStrategyCenterHref(withOffset, { approvalStatus: "approved" })).toBe(
      "/website-strategy-center?approvalStatus=approved",
    );
  });

  it("keeps a nonzero offset when explicitly set", () => {
    expect(buildWebsiteStrategyCenterHref(baseQuery, { offset: 25 })).toBe(
      "/website-strategy-center?offset=25",
    );
  });

  it("includes a non-default pageSize and resets offset to 0", () => {
    const withOffset = { ...baseQuery, offset: 50 };
    expect(buildWebsiteStrategyCenterHref(withOffset, { pageSize: 50 })).toBe(
      "/website-strategy-center?pageSize=50",
    );
  });
});

describe("websiteStrategyApprovalStatusBadge", () => {
  it("maps under_review and revision_requested to the same degraded token, disambiguated by label", () => {
    expect(websiteStrategyApprovalStatusBadge("under_review")).toEqual({
      token: "degraded",
      label: "Under Review",
    });
    expect(websiteStrategyApprovalStatusBadge("revision_requested")).toEqual({
      token: "degraded",
      label: "Revision Requested",
    });
  });

  it("maps approved to healthy and rejected to unavailable", () => {
    expect(websiteStrategyApprovalStatusBadge("approved").token).toBe("healthy");
    expect(websiteStrategyApprovalStatusBadge("rejected").token).toBe("unavailable");
  });
});

describe("getWebsiteStrategyRecords", () => {
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
      getWebsiteStrategyRecords({
        recordType: null,
        approvalStatus: null,
        search: null,
        offset: 0,
        pageSize: 20,
      }),
    ).rejects.toThrow(/Failed to load website strategy records/);
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

    await getWebsiteStrategyRecords({
      recordType: "conversion_plan",
      approvalStatus: "draft",
      search: "checkout",
      offset: 25,
      pageSize: 20,
    });

    expect(requestedUrls[0]).toBe(
      "https://api.example.com/website-strategy-center/records?recordType=conversion_plan&approvalStatus=draft&search=checkout&limit=21&offset=25",
    );
  });

  it("reports hasNextPage: true and trims the extra row when the backend returns one more than the page size", async () => {
    const items = Array.from({ length: 21 }, (_, i) => recordFixture(`r${i}`));
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ success: true, data: items, correlationId: "test" }),
    } as Response);

    const result = await getWebsiteStrategyRecords({
      recordType: null,
      approvalStatus: null,
      search: null,
      offset: 0,
      pageSize: 20,
    });

    expect(result.items).toHaveLength(20);
    expect(result.hasNextPage).toBe(true);
  });
});

describe("getWebsiteStrategyRecord", () => {
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
    const result = await getWebsiteStrategyRecord("not-a-uuid");
    expect(result).toBeNull();
    expect(global.fetch).not.toHaveBeenCalled();
  });

  it("returns null on a 404", async () => {
    global.fetch = vi.fn().mockResolvedValue({ ok: false, status: 404 } as Response);
    expect(await getWebsiteStrategyRecord(VALID_ID)).toBeNull();
  });

  it("throws on a non-404 non-OK response", async () => {
    global.fetch = vi.fn().mockResolvedValue({ ok: false, status: 403 } as Response);
    await expect(getWebsiteStrategyRecord(VALID_ID)).rejects.toThrow(
      /Failed to load website strategy record/,
    );
  });

  it("returns the record on a 200", async () => {
    const record = recordFixture(VALID_ID, { title: "Q4 Navigation Plan" });
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ success: true, data: record, correlationId: "test" }),
    } as Response);

    const result = await getWebsiteStrategyRecord(VALID_ID);
    expect(result?.id).toBe(VALID_ID);
    expect(result?.title).toBe("Q4 Navigation Plan");
  });
});

describe("getWebsiteStrategyRecordVersions", () => {
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
    expect(await getWebsiteStrategyRecordVersions("not-a-uuid")).toEqual([]);
    expect(global.fetch).not.toHaveBeenCalled();
  });

  it("returns an empty array on a 404 instead of throwing", async () => {
    global.fetch = vi.fn().mockResolvedValue({ ok: false, status: 404 } as Response);
    expect(await getWebsiteStrategyRecordVersions(VALID_ID)).toEqual([]);
  });

  it("throws on a non-404 non-OK response", async () => {
    global.fetch = vi.fn().mockResolvedValue({ ok: false, status: 500 } as Response);
    await expect(getWebsiteStrategyRecordVersions(VALID_ID)).rejects.toThrow(
      /Failed to load website strategy record versions/,
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

    const result = await getWebsiteStrategyRecordVersions(VALID_ID);

    expect(requestedUrls[0]).toBe(
      `https://api.example.com/website-strategy-center/records/${VALID_ID}/versions`,
    );
    expect(result.map((v) => v.versionNumber)).toEqual([1, 2]);
  });
});
