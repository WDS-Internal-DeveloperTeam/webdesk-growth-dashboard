import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { ContentTemplate } from "@webdesk/shared-types";

const pushMock = vi.fn();

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: pushMock }),
}));

import { ContentTemplateLibraryForm } from "../../components/content-template-library-form.js";

const TEMPLATE_ID = "11111111-1111-1111-1111-111111111111";

function successResponse(id: string): Response {
  return {
    ok: true,
    json: async () => ({ success: true, data: { id }, correlationId: "corr-1" }),
  } as Response;
}

function templateFixture(overrides: Partial<ContentTemplate> = {}): ContentTemplate {
  return {
    id: TEMPLATE_ID,
    publicId: "TEMPLATE-1",
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

describe("ContentTemplateLibraryForm", () => {
  const originalFetch = global.fetch;

  beforeEach(() => {
    process.env.NEXT_PUBLIC_API_BASE_URL = "https://api.example.com";
    pushMock.mockReset();
  });

  afterEach(() => {
    global.fetch = originalFetch;
    vi.restoreAllMocks();
  });

  it("create mode: publicId/pageType are real HTML required fields", () => {
    render(<ContentTemplateLibraryForm mode="create" />);
    expect(screen.getByLabelText("Public ID")).toBeRequired();
    expect(screen.getByLabelText("Page type")).toBeRequired();
  });

  it("renders a rich-text editor (not a plain textarea) for all 6 Guidance fields", () => {
    render(<ContentTemplateLibraryForm mode="create" />);
    expect(document.querySelectorAll("textarea")).toHaveLength(0);
    expect(document.querySelectorAll('[contenteditable="true"]')).toHaveLength(6);
  });

  it("create mode: submits publicId/pageType, omitting untouched long-text/section fields entirely", async () => {
    const fetchMock = vi.fn().mockResolvedValue(successResponse(TEMPLATE_ID));
    global.fetch = fetchMock as typeof fetch;

    render(<ContentTemplateLibraryForm mode="create" />);
    fireEvent.change(screen.getByLabelText("Public ID"), {
      target: { value: "TEMPLATE-NEW" },
    });
    fireEvent.change(screen.getByLabelText("Page type"), {
      target: { value: "Blog Post" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Create template" }));

    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(1));
    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toBe("https://api.example.com/content-template-library/templates");
    const body = JSON.parse(init.body as string);
    expect(body.publicId).toBe("TEMPLATE-NEW");
    expect(body.pageType).toBe("Blog Post");
    expect(body).not.toHaveProperty("purpose");
    expect(body).not.toHaveProperty("requiredSections");
    expect(body).not.toHaveProperty("optionalSections");
    await waitFor(() =>
      expect(pushMock).toHaveBeenCalledWith(`/content-template-library/${TEMPLATE_ID}`),
    );
  });

  it("edit mode: never sends approvalStatus/version/isPublished/publishedAt/publicId", async () => {
    const fetchMock = vi.fn().mockResolvedValue(successResponse(TEMPLATE_ID));
    global.fetch = fetchMock as typeof fetch;

    render(
      <ContentTemplateLibraryForm
        mode="edit"
        templateId={TEMPLATE_ID}
        initial={templateFixture({ pageType: "Was set" })}
      />,
    );
    fireEvent.change(screen.getByLabelText("Page type"), { target: { value: "Renamed" } });
    fireEvent.click(screen.getByRole("button", { name: "Save changes" }));

    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(1));
    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toBe(
      `https://api.example.com/content-template-library/templates/${TEMPLATE_ID}/update`,
    );
    const body = JSON.parse(init.body as string);
    expect(body.pageType).toBe("Renamed");
    expect(body).not.toHaveProperty("approvalStatus");
    expect(body).not.toHaveProperty("version");
    expect(body).not.toHaveProperty("isPublished");
    expect(body).not.toHaveProperty("publishedAt");
    expect(body).not.toHaveProperty("publicId");
  });

  it("edit mode: clearing a previously-set section list sends an explicit null, not an empty array (data-integrity judgment call)", async () => {
    const fetchMock = vi.fn().mockResolvedValue(successResponse(TEMPLATE_ID));
    global.fetch = fetchMock as typeof fetch;

    render(
      <ContentTemplateLibraryForm
        mode="edit"
        templateId={TEMPLATE_ID}
        initial={templateFixture({ requiredSections: ["Hero"] })}
      />,
    );
    // Remove the one existing "Hero" tag chip, leaving the list empty.
    fireEvent.click(screen.getByRole("button", { name: /remove hero/i }));
    fireEvent.click(screen.getByRole("button", { name: "Save changes" }));

    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(1));
    const [, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    const body = JSON.parse(init.body as string);
    expect(body.requiredSections).toBeNull();
  });

  it("tag input: pressing Enter adds a required-section tag, and it's included in the submitted requiredSections", async () => {
    const fetchMock = vi.fn().mockResolvedValue(successResponse(TEMPLATE_ID));
    global.fetch = fetchMock as typeof fetch;

    render(<ContentTemplateLibraryForm mode="create" />);
    fireEvent.change(screen.getByLabelText("Public ID"), {
      target: { value: "TEMPLATE-NEW" },
    });
    fireEvent.change(screen.getByLabelText("Page type"), { target: { value: "X" } });
    const sectionsInput = screen.getByLabelText("Required sections");
    fireEvent.change(sectionsInput, { target: { value: "Hero" } });
    fireEvent.keyDown(sectionsInput, { key: "Enter" });
    expect(screen.getByText("Hero")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Create template" }));

    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(1));
    const [, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    const body = JSON.parse(init.body as string);
    expect(body.requiredSections).toEqual(["Hero"]);
  });

  it("shows the backend's error message and does not navigate on a failed submit", async () => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: false,
      status: 400,
      json: async () => ({
        success: false,
        error: { code: "BadRequestException", message: "publicId already in use: TEMPLATE-NEW" },
        correlationId: "corr-1",
      }),
    } as Response) as typeof fetch;

    render(<ContentTemplateLibraryForm mode="create" />);
    fireEvent.change(screen.getByLabelText("Public ID"), {
      target: { value: "TEMPLATE-NEW" },
    });
    fireEvent.change(screen.getByLabelText("Page type"), { target: { value: "X" } });
    fireEvent.click(screen.getByRole("button", { name: "Create template" }));

    expect(await screen.findByRole("alert")).toHaveTextContent(
      "publicId already in use: TEMPLATE-NEW",
    );
    expect(pushMock).not.toHaveBeenCalled();
  });

  it("edit mode: a rich-text field's initial HTML content loads into its editor", async () => {
    render(
      <ContentTemplateLibraryForm
        mode="edit"
        templateId={TEMPLATE_ID}
        initial={templateFixture({ purpose: "<p>Convert enterprise visitors</p>" })}
      />,
    );
    await waitFor(() =>
      expect(screen.getByText("Convert enterprise visitors")).toBeInTheDocument(),
    );
  });

  it("edit mode: publicId is shown read-only, not as an editable field", () => {
    render(
      <ContentTemplateLibraryForm
        mode="edit"
        templateId={TEMPLATE_ID}
        initial={templateFixture({ publicId: "TEMPLATE-READONLY" })}
      />,
    );
    expect(screen.queryByLabelText("Public ID")).not.toBeInTheDocument();
    expect(screen.getByText("TEMPLATE-READONLY")).toBeInTheDocument();
  });
});
