import { describe, expect, it } from "vitest";
import {
  buildPortfolioLibraryHref,
  parsePortfolioLibrarySearchParams,
  portfolioApprovalStatusBadge,
  portfolioPublishBadge,
} from "../../lib/portfolio-library-query.js";

describe("parsePortfolioLibrarySearchParams", () => {
  it("defaults to no filters, offset 0, pageSize 20 when nothing is provided", () => {
    expect(parsePortfolioLibrarySearchParams({})).toEqual({
      approvalStatus: null,
      isPublished: null,
      search: null,
      offset: 0,
      pageSize: 20,
    });
  });

  it("parses valid approvalStatus/isPublished/search/offset/pageSize values", () => {
    expect(
      parsePortfolioLibrarySearchParams({
        approvalStatus: "under_review",
        isPublished: "true",
        search: "acme",
        offset: "25",
        pageSize: "50",
      }),
    ).toEqual({
      approvalStatus: "under_review",
      isPublished: true,
      search: "acme",
      offset: 25,
      pageSize: 50,
    });
  });

  it("parses isPublished=false as literal false, not falling through to null", () => {
    expect(parsePortfolioLibrarySearchParams({ isPublished: "false" }).isPublished).toBe(false);
  });

  it("falls back to defaults for invalid/garbled enum values instead of passing them through", () => {
    expect(
      parsePortfolioLibrarySearchParams({
        approvalStatus: "not_a_real_status",
        isPublished: "maybe",
        offset: "not-a-number",
        pageSize: "37",
      }),
    ).toEqual({
      approvalStatus: null,
      isPublished: null,
      search: null,
      offset: 0,
      pageSize: 20,
    });
  });

  it("clamps a negative offset to 0", () => {
    expect(parsePortfolioLibrarySearchParams({ offset: "-10" }).offset).toBe(0);
  });

  it("clamps an overlong search term to 255 characters", () => {
    const overlong = "x".repeat(300);
    expect(parsePortfolioLibrarySearchParams({ search: overlong }).search).toHaveLength(255);
  });

  it("takes the first value when a param is duplicated in the URL", () => {
    expect(
      parsePortfolioLibrarySearchParams({ approvalStatus: ["draft", "approved"] }).approvalStatus,
    ).toBe("draft");
  });
});

describe("buildPortfolioLibraryHref", () => {
  const baseQuery = {
    approvalStatus: null,
    isPublished: null,
    search: null,
    offset: 0,
    pageSize: 20 as const,
  };

  it("returns the bare path when nothing is set", () => {
    expect(buildPortfolioLibraryHref(baseQuery, {})).toBe("/portfolio-library");
  });

  it("includes approvalStatus/isPublished/search and omits offset=0/the default pageSize", () => {
    expect(
      buildPortfolioLibraryHref(baseQuery, {
        approvalStatus: "draft",
        isPublished: true,
        search: "acme",
      }),
    ).toBe("/portfolio-library?approvalStatus=draft&isPublished=true&search=acme");
  });

  it("includes isPublished=false explicitly rather than omitting it", () => {
    expect(buildPortfolioLibraryHref(baseQuery, { isPublished: false })).toBe(
      "/portfolio-library?isPublished=false",
    );
  });

  it("resets offset to 0 when an override other than offset itself is applied", () => {
    const withOffset = { ...baseQuery, offset: 50 };
    expect(buildPortfolioLibraryHref(withOffset, { approvalStatus: "approved" })).toBe(
      "/portfolio-library?approvalStatus=approved",
    );
  });

  it("keeps a nonzero offset when explicitly set", () => {
    expect(buildPortfolioLibraryHref(baseQuery, { offset: 25 })).toBe(
      "/portfolio-library?offset=25",
    );
  });

  it("includes a non-default pageSize and resets offset to 0", () => {
    const withOffset = { ...baseQuery, offset: 50 };
    expect(buildPortfolioLibraryHref(withOffset, { pageSize: 50 })).toBe(
      "/portfolio-library?pageSize=50",
    );
  });
});

describe("portfolioApprovalStatusBadge", () => {
  it("maps under_review and revision_requested to the same degraded token, disambiguated by label", () => {
    expect(portfolioApprovalStatusBadge("under_review")).toEqual({
      token: "degraded",
      label: "Under Review",
    });
    expect(portfolioApprovalStatusBadge("revision_requested")).toEqual({
      token: "degraded",
      label: "Revision Requested",
    });
  });

  it("maps approved to healthy and rejected to unavailable", () => {
    expect(portfolioApprovalStatusBadge("approved").token).toBe("healthy");
    expect(portfolioApprovalStatusBadge("rejected").token).toBe("unavailable");
  });
});

describe("portfolioPublishBadge", () => {
  it("maps published to healthy and unpublished to notConfigured — notConfigured, not unknown, so 'Unpublished' doesn't collide with 'Draft'", () => {
    expect(portfolioPublishBadge(true)).toEqual({ token: "healthy", label: "Published" });
    expect(portfolioPublishBadge(false)).toEqual({
      token: "notConfigured",
      label: "Unpublished",
    });
  });
});
