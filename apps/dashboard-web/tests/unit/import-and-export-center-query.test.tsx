import { describe, expect, it } from "vitest";
import {
  buildExportRunsHref,
  buildImportRunsHref,
  buildImportTemplatesHref,
  exportRunStatusBadge,
  importRowStatusBadge,
  importRunStatusBadge,
  parseExportRunsSearchParams,
  parseImportRunsSearchParams,
  parseImportTemplatesSearchParams,
} from "../../lib/import-and-export-center-query.js";

describe("parseImportTemplatesSearchParams", () => {
  it("defaults to no filters, offset 0, pageSize 20 when nothing is provided", () => {
    expect(parseImportTemplatesSearchParams({})).toEqual({
      targetModuleKey: null,
      isActive: null,
      search: null,
      offset: 0,
      pageSize: 20,
    });
  });

  it("parses valid targetModuleKey/isActive/search/offset/pageSize values", () => {
    expect(
      parseImportTemplatesSearchParams({
        targetModuleKey: "service_library",
        isActive: "true",
        search: "acme",
        offset: "25",
        pageSize: "50",
      }),
    ).toEqual({
      targetModuleKey: "service_library",
      isActive: true,
      search: "acme",
      offset: 25,
      pageSize: 50,
    });
  });

  it("parses isActive=false as literal false, not falling through to null", () => {
    expect(parseImportTemplatesSearchParams({ isActive: "false" }).isActive).toBe(false);
  });

  it("clamps a negative offset to 0", () => {
    expect(parseImportTemplatesSearchParams({ offset: "-10" }).offset).toBe(0);
  });

  it("clamps an overlong search to 255 characters", () => {
    const overlong = "a".repeat(300);
    expect(parseImportTemplatesSearchParams({ search: overlong }).search).toHaveLength(255);
  });

  it("falls back to defaults for an invalid pageSize", () => {
    expect(parseImportTemplatesSearchParams({ pageSize: "37" }).pageSize).toBe(20);
  });
});

describe("buildImportTemplatesHref", () => {
  const base = parseImportTemplatesSearchParams({});

  it("builds a bare href when nothing is set", () => {
    expect(buildImportTemplatesHref(base, {})).toBe("/import-and-export-center");
  });

  it("includes targetModuleKey/isActive/search when set", () => {
    const href = buildImportTemplatesHref(base, {
      targetModuleKey: "service_library",
      isActive: false,
      search: "acme",
    });
    expect(href).toContain("targetModuleKey=service_library");
    expect(href).toContain("isActive=false");
    expect(href).toContain("search=acme");
  });

  it("resets offset to 0 when a non-offset field changes", () => {
    const withOffset = { ...base, offset: 40 };
    expect(buildImportTemplatesHref(withOffset, { search: "acme" })).not.toContain("offset=");
  });

  it("preserves an explicit offset override", () => {
    expect(buildImportTemplatesHref(base, { offset: 20 })).toContain("offset=20");
  });

  it("omits pageSize when it's the default", () => {
    expect(buildImportTemplatesHref(base, {})).not.toContain("pageSize=");
  });

  it("includes pageSize when it differs from the default", () => {
    expect(buildImportTemplatesHref(base, { pageSize: 50 })).toContain("pageSize=50");
  });
});

describe("parseImportRunsSearchParams", () => {
  it("defaults to no filters, offset 0, pageSize 20 when nothing is provided", () => {
    expect(parseImportRunsSearchParams({})).toEqual({
      importTemplateId: null,
      status: null,
      offset: 0,
      pageSize: 20,
    });
  });

  it("parses valid importTemplateId/status/offset/pageSize values", () => {
    expect(
      parseImportRunsSearchParams({
        importTemplateId: "11111111-1111-1111-1111-111111111111",
        status: "validating",
        offset: "10",
        pageSize: "30",
      }),
    ).toEqual({
      importTemplateId: "11111111-1111-1111-1111-111111111111",
      status: "validating",
      offset: 10,
      pageSize: 30,
    });
  });

  it("falls back to null for an invalid/garbled status instead of passing it through", () => {
    expect(parseImportRunsSearchParams({ status: "not_a_real_status" }).status).toBeNull();
  });
});

describe("buildImportRunsHref", () => {
  const base = parseImportRunsSearchParams({});

  it("builds a bare href when nothing is set", () => {
    expect(buildImportRunsHref(base, {})).toBe("/import-and-export-center/runs");
  });

  it("includes importTemplateId/status when set", () => {
    const href = buildImportRunsHref(base, {
      importTemplateId: "11111111-1111-1111-1111-111111111111",
      status: "failed",
    });
    expect(href).toContain("importTemplateId=11111111-1111-1111-1111-111111111111");
    expect(href).toContain("status=failed");
  });
});

describe("parseExportRunsSearchParams", () => {
  it("defaults to no filters, offset 0, pageSize 20 when nothing is provided", () => {
    expect(parseExportRunsSearchParams({})).toEqual({
      targetModuleKey: null,
      status: null,
      offset: 0,
      pageSize: 20,
    });
  });

  it("parses valid targetModuleKey/status/offset/pageSize values", () => {
    expect(
      parseExportRunsSearchParams({
        targetModuleKey: "service_library",
        status: "processing",
        offset: "5",
        pageSize: "10",
      }),
    ).toEqual({
      targetModuleKey: "service_library",
      status: "processing",
      offset: 5,
      pageSize: 10,
    });
  });

  it("has no search field, even if one is passed in raw params", () => {
    const result: unknown = parseExportRunsSearchParams({ search: "acme" });
    expect((result as Record<string, unknown>).search).toBeUndefined();
  });
});

describe("buildExportRunsHref", () => {
  const base = parseExportRunsSearchParams({});

  it("builds a bare href when nothing is set", () => {
    expect(buildExportRunsHref(base, {})).toBe("/import-and-export-center/exports");
  });

  it("includes targetModuleKey/status when set", () => {
    const href = buildExportRunsHref(base, {
      targetModuleKey: "service_library",
      status: "failed",
    });
    expect(href).toContain("targetModuleKey=service_library");
    expect(href).toContain("status=failed");
  });
});

describe("importRunStatusBadge", () => {
  it("maps every status to a real token/label pair", () => {
    expect(importRunStatusBadge("draft")).toEqual({ token: "notConfigured", label: "Draft" });
    expect(importRunStatusBadge("importing")).toEqual({ token: "degraded", label: "Importing" });
    expect(importRunStatusBadge("completed")).toEqual({ token: "healthy", label: "Completed" });
    expect(importRunStatusBadge("failed")).toEqual({ token: "unavailable", label: "Failed" });
    expect(importRunStatusBadge("rolled_back")).toEqual({
      token: "unavailable",
      label: "Rolled Back",
    });
  });
});

describe("importRowStatusBadge", () => {
  it("maps every status to a real token/label pair", () => {
    expect(importRowStatusBadge("pending")).toEqual({ token: "notConfigured", label: "Pending" });
    expect(importRowStatusBadge("valid")).toEqual({ token: "healthy", label: "Valid" });
    expect(importRowStatusBadge("invalid")).toEqual({ token: "unavailable", label: "Invalid" });
  });
});

describe("exportRunStatusBadge", () => {
  it("maps every status to a real token/label pair", () => {
    expect(exportRunStatusBadge("requested")).toEqual({
      token: "notConfigured",
      label: "Requested",
    });
    expect(exportRunStatusBadge("processing")).toEqual({ token: "degraded", label: "Processing" });
    expect(exportRunStatusBadge("completed")).toEqual({ token: "healthy", label: "Completed" });
    expect(exportRunStatusBadge("failed")).toEqual({ token: "unavailable", label: "Failed" });
  });
});
