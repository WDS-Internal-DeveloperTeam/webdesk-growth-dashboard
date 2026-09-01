import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("next/headers", () => ({
  cookies: vi.fn(),
}));

import { cookies } from "next/headers";
import type { WorkflowTaskTemplate } from "@webdesk/shared-types";
import {
  buildWorkflowTaskTemplateHref,
  getWorkflowTaskTemplate,
  getWorkflowTaskTemplates,
  parseWorkflowTaskTemplateSearchParams,
  workflowTaskTemplateApprovalStatusBadge,
} from "../../lib/workflow-and-task-template-library.js";

describe("parseWorkflowTaskTemplateSearchParams", () => {
  it("defaults to no filters, offset 0, pageSize 20 when nothing is provided", () => {
    expect(parseWorkflowTaskTemplateSearchParams({})).toEqual({
      templateType: null,
      approvalStatus: null,
      search: null,
      offset: 0,
      pageSize: 20,
    });
  });

  it("parses valid templateType/approvalStatus/search/offset/pageSize values", () => {
    expect(
      parseWorkflowTaskTemplateSearchParams({
        templateType: "content",
        approvalStatus: "under_review",
        search: "blog",
        offset: "25",
        pageSize: "50",
      }),
    ).toEqual({
      templateType: "content",
      approvalStatus: "under_review",
      search: "blog",
      offset: 25,
      pageSize: 50,
    });
  });

  it("falls back to defaults for invalid/garbled enum values instead of passing them through", () => {
    expect(
      parseWorkflowTaskTemplateSearchParams({
        templateType: "not_a_real_type",
        approvalStatus: "not_a_real_status",
        offset: "not-a-number",
        pageSize: "37",
      }),
    ).toEqual({
      templateType: null,
      approvalStatus: null,
      search: null,
      offset: 0,
      pageSize: 20,
    });
  });

  it("clamps a negative offset to 0", () => {
    expect(parseWorkflowTaskTemplateSearchParams({ offset: "-10" }).offset).toBe(0);
  });

  it("clamps an overlong search term to 255 characters", () => {
    const overlong = "x".repeat(300);
    expect(parseWorkflowTaskTemplateSearchParams({ search: overlong }).search).toHaveLength(255);
  });

  it("takes the first value when a param is duplicated in the URL", () => {
    expect(
      parseWorkflowTaskTemplateSearchParams({ templateType: ["content", "design"] }).templateType,
    ).toBe("content");
  });
});

describe("buildWorkflowTaskTemplateHref", () => {
  const baseQuery = {
    templateType: null,
    approvalStatus: null,
    search: null,
    offset: 0,
    pageSize: 20 as const,
  };

  it("returns the bare path when nothing is set", () => {
    expect(buildWorkflowTaskTemplateHref(baseQuery, {})).toBe(
      "/workflow-and-task-template-library",
    );
  });

  it("includes templateType/approvalStatus/search and omits offset=0/the default pageSize", () => {
    expect(
      buildWorkflowTaskTemplateHref(baseQuery, {
        templateType: "content",
        approvalStatus: "draft",
        search: "brief",
      }),
    ).toBe(
      "/workflow-and-task-template-library?templateType=content&approvalStatus=draft&search=brief",
    );
  });

  it("resets offset to 0 when an override other than offset itself is applied", () => {
    const withOffset = { ...baseQuery, offset: 50 };
    expect(buildWorkflowTaskTemplateHref(withOffset, { approvalStatus: "approved" })).toBe(
      "/workflow-and-task-template-library?approvalStatus=approved",
    );
  });

  it("keeps a nonzero offset when explicitly set", () => {
    expect(buildWorkflowTaskTemplateHref(baseQuery, { offset: 25 })).toBe(
      "/workflow-and-task-template-library?offset=25",
    );
  });

  it("includes a non-default pageSize and resets offset to 0", () => {
    const withOffset = { ...baseQuery, offset: 50 };
    expect(buildWorkflowTaskTemplateHref(withOffset, { pageSize: 50 })).toBe(
      "/workflow-and-task-template-library?pageSize=50",
    );
  });
});

describe("workflowTaskTemplateApprovalStatusBadge", () => {
  it("maps under_review and revision_requested to the same degraded token, disambiguated by label", () => {
    expect(workflowTaskTemplateApprovalStatusBadge("under_review")).toEqual({
      token: "degraded",
      label: "Under Review",
    });
    expect(workflowTaskTemplateApprovalStatusBadge("revision_requested")).toEqual({
      token: "degraded",
      label: "Revision Requested",
    });
  });

  it("maps approved to healthy and rejected to unavailable", () => {
    expect(workflowTaskTemplateApprovalStatusBadge("approved").token).toBe("healthy");
    expect(workflowTaskTemplateApprovalStatusBadge("rejected").token).toBe("unavailable");
  });
});

function templateFixture(
  id: string,
  overrides: Partial<WorkflowTaskTemplate> = {},
): WorkflowTaskTemplate {
  return {
    id,
    publicId: `WTT-${id}`,
    templateType: "content",
    title: "Blog Post Template",
    authorizedStage: "content_production",
    requiredInputs: null,
    expectedOutputs: null,
    restrictions: null,
    agentAssignment: null,
    validationCriteria: null,
    requiredApprovals: null,
    approvalStatus: "draft",
    version: 1,
    createdBy: null,
    updatedBy: null,
    createdAt: "2026-09-02T00:00:00.000Z",
    updatedAt: "2026-09-02T00:00:00.000Z",
    ...overrides,
  };
}

describe("getWorkflowTaskTemplates", () => {
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
      getWorkflowTaskTemplates({
        templateType: null,
        approvalStatus: null,
        search: null,
        offset: 0,
        pageSize: 20,
      }),
    ).rejects.toThrow(/Failed to load workflow task templates/);
  });

  it("requests one row past the chosen page size, to detect a real next page, including templateType", async () => {
    const requestedUrls: string[] = [];
    global.fetch = vi.fn((url: string) => {
      requestedUrls.push(url);
      return Promise.resolve({
        ok: true,
        json: async () => ({ success: true, data: [], correlationId: "test" }),
      } as Response);
    }) as typeof fetch;

    await getWorkflowTaskTemplates({
      templateType: "content",
      approvalStatus: "draft",
      search: "brief",
      offset: 25,
      pageSize: 20,
    });

    expect(requestedUrls[0]).toBe(
      "https://api.example.com/workflow-and-task-template-library/templates?templateType=content&approvalStatus=draft&search=brief&limit=21&offset=25",
    );
  });

  it("reports hasNextPage: true and trims the extra row when the backend returns one more than the page size", async () => {
    const items = Array.from({ length: 21 }, (_, i) => templateFixture(`t${i}`));
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ success: true, data: items, correlationId: "test" }),
    } as Response);

    const result = await getWorkflowTaskTemplates({
      templateType: null,
      approvalStatus: null,
      search: null,
      offset: 0,
      pageSize: 20,
    });

    expect(result.items).toHaveLength(20);
    expect(result.hasNextPage).toBe(true);
  });
});

describe("getWorkflowTaskTemplate", () => {
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
    const result = await getWorkflowTaskTemplate("not-a-uuid");
    expect(result).toBeNull();
    expect(global.fetch).not.toHaveBeenCalled();
  });

  it("returns null on a 404", async () => {
    global.fetch = vi.fn().mockResolvedValue({ ok: false, status: 404 } as Response);
    expect(await getWorkflowTaskTemplate(VALID_ID)).toBeNull();
  });

  it("throws on a non-404 non-OK response", async () => {
    global.fetch = vi.fn().mockResolvedValue({ ok: false, status: 403 } as Response);
    await expect(getWorkflowTaskTemplate(VALID_ID)).rejects.toThrow(
      /Failed to load workflow task template/,
    );
  });

  it("returns the workflow task template on a 200", async () => {
    const template = templateFixture(VALID_ID, { title: "Search Brief Template" });
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ success: true, data: template, correlationId: "test" }),
    } as Response);

    const result = await getWorkflowTaskTemplate(VALID_ID);
    expect(result?.id).toBe(VALID_ID);
    expect(result?.title).toBe("Search Brief Template");
  });
});
