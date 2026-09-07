import { describe, expect, it } from "vitest";
import {
  buildIntegrationsHref,
  integrationActiveBadge,
  integrationStatusBadge,
  parseIntegrationsSearchParams,
  verificationResultBadge,
  webhookProcessingStatusBadge,
} from "../../lib/integrations-query.js";

describe("parseIntegrationsSearchParams", () => {
  it("defaults to no filters, offset 0, pageSize 20 when nothing is provided", () => {
    expect(parseIntegrationsSearchParams({})).toEqual({
      provider: null,
      status: null,
      isActive: null,
      search: null,
      offset: 0,
      pageSize: 20,
    });
  });

  it("parses valid provider/status/isActive/search/offset/pageSize values", () => {
    expect(
      parseIntegrationsSearchParams({
        provider: "github",
        status: "connected",
        isActive: "true",
        search: "prod",
        offset: "25",
        pageSize: "50",
      }),
    ).toEqual({
      provider: "github",
      status: "connected",
      isActive: true,
      search: "prod",
      offset: 25,
      pageSize: 50,
    });
  });

  it("parses isActive=false as literal false, not falling through to null", () => {
    expect(parseIntegrationsSearchParams({ isActive: "false" }).isActive).toBe(false);
  });

  it("falls back to defaults for invalid/garbled enum values instead of passing them through", () => {
    expect(
      parseIntegrationsSearchParams({
        provider: "not_a_real_provider",
        status: "not_a_real_status",
        isActive: "maybe",
        offset: "not-a-number",
        pageSize: "37",
      }),
    ).toEqual({
      provider: null,
      status: null,
      isActive: null,
      search: null,
      offset: 0,
      pageSize: 20,
    });
  });

  it("clamps a negative offset to 0", () => {
    expect(parseIntegrationsSearchParams({ offset: "-10" }).offset).toBe(0);
  });

  it("clamps an overlong search term to 255 characters", () => {
    const overlong = "x".repeat(300);
    expect(parseIntegrationsSearchParams({ search: overlong }).search).toHaveLength(255);
  });

  it("takes the first value when a param is duplicated in the URL", () => {
    expect(parseIntegrationsSearchParams({ provider: ["github", "wordpress"] }).provider).toBe(
      "github",
    );
  });
});

describe("buildIntegrationsHref", () => {
  const baseQuery = {
    provider: null,
    status: null,
    isActive: null,
    search: null,
    offset: 0,
    pageSize: 20 as const,
  };

  it("returns the bare path when nothing is set", () => {
    expect(buildIntegrationsHref(baseQuery, {})).toBe("/integrations");
  });

  it("includes provider/status/isActive/search and omits offset=0/the default pageSize", () => {
    expect(
      buildIntegrationsHref(baseQuery, {
        provider: "github",
        status: "connected",
        isActive: true,
        search: "prod",
      }),
    ).toBe("/integrations?provider=github&status=connected&isActive=true&search=prod");
  });

  it("includes isActive=false explicitly rather than omitting it", () => {
    expect(buildIntegrationsHref(baseQuery, { isActive: false })).toBe(
      "/integrations?isActive=false",
    );
  });

  it("resets offset to 0 when an override other than offset itself is applied", () => {
    const withOffset = { ...baseQuery, offset: 50 };
    expect(buildIntegrationsHref(withOffset, { status: "error" })).toBe(
      "/integrations?status=error",
    );
  });

  it("keeps a nonzero offset when explicitly set", () => {
    expect(buildIntegrationsHref(baseQuery, { offset: 25 })).toBe("/integrations?offset=25");
  });

  it("includes a non-default pageSize and resets offset to 0", () => {
    const withOffset = { ...baseQuery, offset: 50 };
    expect(buildIntegrationsHref(withOffset, { pageSize: 50 })).toBe("/integrations?pageSize=50");
  });
});

describe("integrationStatusBadge", () => {
  it("maps connected to healthy and error to unavailable", () => {
    expect(integrationStatusBadge("connected")).toEqual({ token: "healthy", label: "Connected" });
    expect(integrationStatusBadge("error")).toEqual({ token: "unavailable", label: "Error" });
  });

  it("maps disconnected and not_configured to distinct tokens", () => {
    expect(integrationStatusBadge("disconnected").token).toBe("degraded");
    expect(integrationStatusBadge("not_configured").token).toBe("notConfigured");
  });
});

describe("verificationResultBadge", () => {
  it("maps success to healthy and failure to unavailable", () => {
    expect(verificationResultBadge("success")).toEqual({ token: "healthy", label: "Success" });
    expect(verificationResultBadge("failure")).toEqual({ token: "unavailable", label: "Failure" });
  });

  it("maps a null result (never verified) distinctly from the 'unknown' result value", () => {
    expect(verificationResultBadge(null)).toEqual({ token: "unknown", label: "Never verified" });
    expect(verificationResultBadge("unknown")).toEqual({ token: "unknown", label: "Unknown" });
  });
});

describe("integrationActiveBadge", () => {
  it("maps true to healthy/Active and false to notConfigured/Inactive", () => {
    expect(integrationActiveBadge(true)).toEqual({ token: "healthy", label: "Active" });
    expect(integrationActiveBadge(false)).toEqual({ token: "notConfigured", label: "Inactive" });
  });
});

describe("webhookProcessingStatusBadge", () => {
  it("maps processed to healthy and failed to unavailable", () => {
    expect(webhookProcessingStatusBadge("processed")).toEqual({
      token: "healthy",
      label: "Processed",
    });
    expect(webhookProcessingStatusBadge("failed")).toEqual({
      token: "unavailable",
      label: "Failed",
    });
  });

  it("maps received to unknown (not yet processed)", () => {
    expect(webhookProcessingStatusBadge("received").token).toBe("unknown");
  });
});
