import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("next/headers", () => ({
  cookies: vi.fn(),
}));

import { cookies } from "next/headers";
import type { BusinessKnowledgeRecord } from "@webdesk/shared-types";
import {
  buildBusinessKnowledgeHref,
  businessKnowledgeStatusBadge,
  getBusinessKnowledgeRecord,
  getBusinessKnowledgeRecords,
  parseBusinessKnowledgeSearchParams,
} from "../../lib/business-knowledge.js";

describe("parseBusinessKnowledgeSearchParams", () => {
  it("defaults to no filters, offset 0 when nothing is provided", () => {
    expect(parseBusinessKnowledgeSearchParams({})).toEqual({
      recordType: null,
      status: null,
      offset: 0,
    });
  });

  it("parses valid recordType/status/offset values", () => {
    expect(
      parseBusinessKnowledgeSearchParams({ recordType: "vto", status: "draft", offset: "25" }),
    ).toEqual({ recordType: "vto", status: "draft", offset: 25 });
  });

  it("falls back to defaults for invalid/garbled enum values instead of passing them through", () => {
    expect(
      parseBusinessKnowledgeSearchParams({
        recordType: "not_a_real_type",
        status: "deleted",
        offset: "not-a-number",
      }),
    ).toEqual({ recordType: null, status: null, offset: 0 });
  });

  it("clamps a negative offset to 0", () => {
    expect(parseBusinessKnowledgeSearchParams({ offset: "-10" }).offset).toBe(0);
  });

  it("takes the first value when a param is duplicated in the URL", () => {
    expect(
      parseBusinessKnowledgeSearchParams({ recordType: ["vto", "competitor"] }).recordType,
    ).toBe("vto");
  });
});

describe("buildBusinessKnowledgeHref", () => {
  const baseQuery = { recordType: null, status: null, offset: 0 };

  it("returns the bare path when nothing is set", () => {
    expect(buildBusinessKnowledgeHref(baseQuery, {})).toBe("/business-knowledge-center");
  });

  it("includes recordType/status and omits offset=0", () => {
    expect(buildBusinessKnowledgeHref(baseQuery, { recordType: "vto", status: "draft" })).toBe(
      "/business-knowledge-center?recordType=vto&status=draft",
    );
  });

  it("resets offset to 0 when an override other than offset itself is applied", () => {
    const withOffset = { ...baseQuery, offset: 50 };
    expect(buildBusinessKnowledgeHref(withOffset, { status: "mandatory" })).toBe(
      "/business-knowledge-center?status=mandatory",
    );
  });

  it("keeps a nonzero offset when explicitly set", () => {
    expect(buildBusinessKnowledgeHref(baseQuery, { offset: 25 })).toBe(
      "/business-knowledge-center?offset=25",
    );
  });
});

describe("businessKnowledgeStatusBadge", () => {
  it("maps mandatory and advisory to the same healthy token, disambiguated by label", () => {
    expect(businessKnowledgeStatusBadge("mandatory")).toEqual({
      token: "healthy",
      label: "Mandatory",
    });
    expect(businessKnowledgeStatusBadge("advisory")).toEqual({
      token: "healthy",
      label: "Advisory",
    });
  });

  it("maps draft/restricted/deprecated to distinct tokens", () => {
    expect(businessKnowledgeStatusBadge("draft").token).toBe("unknown");
    expect(businessKnowledgeStatusBadge("restricted").token).toBe("degraded");
    expect(businessKnowledgeStatusBadge("deprecated").token).toBe("notConfigured");
  });
});

function recordFixture(
  id: string,
  overrides: Partial<BusinessKnowledgeRecord> = {},
): BusinessKnowledgeRecord {
  return {
    id,
    recordType: "vto",
    title: id,
    content: "Some content",
    status: "draft",
    notes: null,
    createdAt: "2026-08-20T00:00:00.000Z",
    updatedAt: "2026-08-20T00:00:00.000Z",
    ...overrides,
  };
}

describe("getBusinessKnowledgeRecords", () => {
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
      getBusinessKnowledgeRecords({ recordType: null, status: null, offset: 0 }),
    ).rejects.toThrow(/Failed to load business knowledge records/);
  });

  it("requests one row past the display page size, to detect a real next page", async () => {
    const requestedUrls: string[] = [];
    global.fetch = vi.fn((url: string) => {
      requestedUrls.push(url);
      return Promise.resolve({
        ok: true,
        json: async () => ({ success: true, data: [], correlationId: "test" }),
      } as Response);
    }) as typeof fetch;

    await getBusinessKnowledgeRecords({ recordType: "vto", status: "draft", offset: 25 });

    expect(requestedUrls[0]).toBe(
      "https://api.example.com/business-knowledge/records?recordType=vto&status=draft&limit=26&offset=25",
    );
  });

  it("reports hasNextPage: true and trims the extra row when the backend returns one more than the page size", async () => {
    const items = Array.from({ length: 26 }, (_, i) => recordFixture(`r${i}`));
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ success: true, data: items, correlationId: "test" }),
    } as Response);

    const result = await getBusinessKnowledgeRecords({
      recordType: null,
      status: null,
      offset: 0,
    });

    expect(result.items).toHaveLength(25);
    expect(result.hasNextPage).toBe(true);
  });
});

describe("getBusinessKnowledgeRecord", () => {
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
    const result = await getBusinessKnowledgeRecord("not-a-uuid");
    expect(result).toBeNull();
    expect(global.fetch).not.toHaveBeenCalled();
  });

  it("returns null on a 404", async () => {
    global.fetch = vi.fn().mockResolvedValue({ ok: false, status: 404 } as Response);
    expect(await getBusinessKnowledgeRecord(VALID_ID)).toBeNull();
  });

  it("throws on a non-404 non-OK response", async () => {
    global.fetch = vi.fn().mockResolvedValue({ ok: false, status: 403 } as Response);
    await expect(getBusinessKnowledgeRecord(VALID_ID)).rejects.toThrow(
      /Failed to load business knowledge record/,
    );
  });

  it("returns the record on a 200, including a redacted record with content/notes absent", async () => {
    const redacted = recordFixture(VALID_ID, {
      status: "restricted",
      content: undefined,
      notes: undefined,
    });
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ success: true, data: redacted, correlationId: "test" }),
    } as Response);

    const result = await getBusinessKnowledgeRecord(VALID_ID);
    expect(result?.id).toBe(VALID_ID);
    expect(result?.content).toBeUndefined();
    expect(result?.notes).toBeUndefined();
  });
});
