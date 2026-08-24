import { beforeEach, describe, expect, it, vi } from "vitest";
import type { ContentTemplate } from "@webdesk/shared-types";

const { redirectMock, notFoundMock } = vi.hoisted(() => ({
  redirectMock: vi.fn((url: string) => {
    throw new Error(`REDIRECT:${url}`);
  }),
  notFoundMock: vi.fn(() => {
    throw new Error("NOT_FOUND");
  }),
}));

vi.mock("next/navigation", () => ({
  redirect: redirectMock,
  notFound: notFoundMock,
}));

const getServerSessionMock = vi.fn();
vi.mock("@/lib/server-session", () => ({
  getServerSession: () => getServerSessionMock(),
}));

const getContentTemplateMock = vi.fn();
vi.mock("@/lib/content-template-library", () => ({
  getContentTemplate: (id: string) => getContentTemplateMock(id),
}));

import EditContentTemplatePage from "../../app/(shell)/content-template-library/[templateId]/edit/page.js";

const TEMPLATE_ID = "11111111-1111-1111-1111-111111111111";

function templateFixture(overrides: Partial<ContentTemplate> = {}): ContentTemplate {
  return {
    id: TEMPLATE_ID,
    publicId: "CT-1",
    pageType: "Service Page",
    purpose: null,
    requiredSections: null,
    optionalSections: null,
    proofRules: null,
    seoAeoGeoRequirements: null,
    schema: null,
    ctaRules: null,
    contentDepthGuidance: null,
    approvalStatus: "draft",
    version: 1,
    isPublished: false,
    publishedAt: null,
    createdBy: null,
    updatedBy: null,
    createdAt: "2026-08-24T00:00:00.000Z",
    updatedAt: "2026-08-24T00:00:00.000Z",
    ...overrides,
  };
}

function args() {
  return { params: Promise.resolve({ templateId: TEMPLATE_ID }) };
}

describe("EditContentTemplatePage", () => {
  beforeEach(() => {
    getServerSessionMock.mockReset();
    getContentTemplateMock.mockReset();
    redirectMock.mockClear();
    notFoundMock.mockClear();
  });

  it("calls notFound() when the template doesn't exist", async () => {
    getServerSessionMock.mockResolvedValue({ user: { id: "u1" } });
    getContentTemplateMock.mockResolvedValue(null);

    await expect(EditContentTemplatePage(args())).rejects.toThrow("NOT_FOUND");
  });

  it.each(["archived", "superseded"] as const)(
    "redirects back to the detail page for a %s template instead of rendering a form whose submit is guaranteed to fail (code-review finding: this route previously had no terminal-state guard at all)",
    async (terminalStatus) => {
      getServerSessionMock.mockResolvedValue({ user: { id: "u1" } });
      getContentTemplateMock.mockResolvedValue(templateFixture({ approvalStatus: terminalStatus }));

      await expect(EditContentTemplatePage(args())).rejects.toThrow(
        `REDIRECT:/content-template-library/${TEMPLATE_ID}`,
      );
    },
  );

  it("renders the form for a non-terminal template", async () => {
    getServerSessionMock.mockResolvedValue({ user: { id: "u1" } });
    getContentTemplateMock.mockResolvedValue(templateFixture({ approvalStatus: "draft" }));

    const element = await EditContentTemplatePage(args());
    expect(element).not.toBeNull();
  });

  it("returns null (no fetches) when there is no session", async () => {
    getServerSessionMock.mockResolvedValue(null);

    const element = await EditContentTemplatePage(args());
    expect(element).toBeNull();
    expect(getContentTemplateMock).not.toHaveBeenCalled();
  });
});
