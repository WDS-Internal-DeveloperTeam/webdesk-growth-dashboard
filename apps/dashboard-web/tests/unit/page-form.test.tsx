import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { Page } from "@webdesk/shared-types";

const pushMock = vi.fn();

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: pushMock }),
}));

import { PageForm } from "../../components/page-form.js";

const PROJECT_ID = "99999999-9999-9999-9999-999999999999";
const PAGE_ID = "11111111-1111-1111-1111-111111111111";

function createSuccessResponse(id: string): Response {
  return {
    ok: true,
    json: async () => ({
      success: true,
      data: { id },
      correlationId: "corr-1",
    }),
  } as Response;
}

function pageFixture(overrides: Partial<Page> = {}): Page {
  return {
    id: PAGE_ID,
    projectId: PROJECT_ID,
    publicId: "PG-1",
    pageName: "Home",
    pageType: null,
    existingOrProposed: "proposed",
    indexStatus: "unknown",
    template: null,
    roadmapPhaseId: null,
    workflowStage: "draft",
    lifecycleStage: "proposed",
    lifecyclePreviousStage: null,
    targetKeyword: null,
    designVersion: null,
    repositoryFiles: null,
    wordpressPageId: null,
    wordpressPostId: null,
    lastScanAt: null,
    lastDeploymentAt: null,
    classification: null,
    createdBy: null,
    updatedBy: null,
    createdAt: "2026-08-23T00:00:00.000Z",
    updatedAt: "2026-08-23T00:00:00.000Z",
    ...overrides,
  };
}

describe("PageForm", () => {
  const originalFetch = global.fetch;

  beforeEach(() => {
    process.env.NEXT_PUBLIC_API_BASE_URL = "https://api.example.com";
    pushMock.mockReset();
  });

  afterEach(() => {
    global.fetch = originalFetch;
    vi.restoreAllMocks();
  });

  it("create mode: publicId and pageName are real HTML required fields", () => {
    render(<PageForm mode="create" projectId={PROJECT_ID} />);
    expect(screen.getByLabelText("Public ID")).toBeRequired();
    expect(screen.getByLabelText("Page name")).toBeRequired();
  });

  it("renders every field as a plain input/select/textarea — no rich-text contenteditable — since repositoryFiles is deliberately excluded from the standing rich-text rule", () => {
    render(<PageForm mode="create" projectId={PROJECT_ID} />);
    expect(document.querySelectorAll('[contenteditable="true"]')).toHaveLength(0);
    expect(document.querySelectorAll("textarea")).toHaveLength(1);
  });

  it("edit mode: publicId is shown read-only, not as an editable field", () => {
    render(
      <PageForm mode="edit" projectId={PROJECT_ID} pageId={PAGE_ID} initial={pageFixture()} />,
    );
    expect(screen.queryByLabelText("Public ID")).not.toBeInTheDocument();
    expect(screen.getByText("PG-1")).toBeInTheDocument();
  });

  it("edit mode: no workflowStage field is rendered — only the dedicated status-actions route may change it", () => {
    render(
      <PageForm mode="edit" projectId={PROJECT_ID} pageId={PAGE_ID} initial={pageFixture()} />,
    );
    expect(screen.queryByLabelText(/workflow stage/i)).not.toBeInTheDocument();
  });

  it("create mode: submits publicId/pageName/select defaults, omitting untouched optional fields entirely, then navigates to the new page's detail route with projectId preserved", async () => {
    const fetchMock = vi.fn().mockResolvedValue(createSuccessResponse(PAGE_ID));
    global.fetch = fetchMock as typeof fetch;

    render(<PageForm mode="create" projectId={PROJECT_ID} />);
    fireEvent.change(screen.getByLabelText("Public ID"), { target: { value: "PG-NEW" } });
    fireEvent.change(screen.getByLabelText("Page name"), { target: { value: "Pricing" } });
    fireEvent.click(screen.getByRole("button", { name: "Create page" }));

    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(1));
    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toBe(`https://api.example.com/page-inventory/projects/${PROJECT_ID}/pages`);
    const body = JSON.parse(init.body as string);
    expect(body.publicId).toBe("PG-NEW");
    expect(body.pageName).toBe("Pricing");
    expect(body.existingOrProposed).toBe("proposed");
    expect(body.indexStatus).toBe("unknown");
    expect(body).not.toHaveProperty("pageType");
    expect(body).not.toHaveProperty("template");
    expect(body).not.toHaveProperty("roadmapPhaseId");
    expect(body).not.toHaveProperty("repositoryFiles");
    await waitFor(() =>
      expect(pushMock).toHaveBeenCalledWith(`/page-inventory/${PAGE_ID}?projectId=${PROJECT_ID}`),
    );
  });

  it("edit mode: never sends publicId/workflowStage, sends explicit null for a cleared optional field, then navigates using the props.pageId", async () => {
    const fetchMock = vi.fn().mockResolvedValue(createSuccessResponse(PAGE_ID));
    global.fetch = fetchMock as typeof fetch;

    render(
      <PageForm
        mode="edit"
        projectId={PROJECT_ID}
        pageId={PAGE_ID}
        initial={pageFixture({ pageType: "landing" })}
      />,
    );
    fireEvent.change(screen.getByLabelText("Page type"), { target: { value: "" } });
    fireEvent.click(screen.getByRole("button", { name: "Save changes" }));

    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(1));
    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toBe(
      `https://api.example.com/page-inventory/projects/${PROJECT_ID}/pages/${PAGE_ID}/update`,
    );
    const body = JSON.parse(init.body as string);
    expect(body).not.toHaveProperty("publicId");
    expect(body).not.toHaveProperty("workflowStage");
    expect(body.pageType).toBeNull();
    await waitFor(() =>
      expect(pushMock).toHaveBeenCalledWith(`/page-inventory/${PAGE_ID}?projectId=${PROJECT_ID}`),
    );
  });

  it("submits a filled-in date field as-is and an empty one as omitted (create) / null (edit)", async () => {
    const fetchMock = vi.fn().mockResolvedValue(createSuccessResponse(PAGE_ID));
    global.fetch = fetchMock as typeof fetch;

    render(<PageForm mode="create" projectId={PROJECT_ID} />);
    fireEvent.change(screen.getByLabelText("Public ID"), { target: { value: "PG-NEW" } });
    fireEvent.change(screen.getByLabelText("Page name"), { target: { value: "Pricing" } });
    fireEvent.change(screen.getByLabelText("Last scan date"), {
      target: { value: "2026-08-01" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Create page" }));

    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(1));
    const [, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    const body = JSON.parse(init.body as string);
    expect(body.lastScanAt).toBe("2026-08-01");
    expect(body).not.toHaveProperty("lastDeploymentAt");
  });

  it("shows the backend's error message and does not navigate on a failed submit", async () => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: false,
      status: 400,
      json: async () => ({
        success: false,
        error: { code: "BadRequestException", message: "publicId already in use: PG-NEW" },
        correlationId: "corr-1",
      }),
    } as Response) as typeof fetch;

    render(<PageForm mode="create" projectId={PROJECT_ID} />);
    fireEvent.change(screen.getByLabelText("Public ID"), { target: { value: "PG-NEW" } });
    fireEvent.change(screen.getByLabelText("Page name"), { target: { value: "Pricing" } });
    fireEvent.click(screen.getByRole("button", { name: "Create page" }));

    expect(await screen.findByRole("alert")).toHaveTextContent("publicId already in use: PG-NEW");
    expect(pushMock).not.toHaveBeenCalled();
  });

  it("cancel link (create) points back to the list page with projectId preserved", () => {
    render(<PageForm mode="create" projectId={PROJECT_ID} />);
    expect(screen.getByRole("link", { name: "Cancel" })).toHaveAttribute(
      "href",
      `/page-inventory?projectId=${PROJECT_ID}`,
    );
  });

  it("cancel link (edit) points back to the detail page with projectId preserved", () => {
    render(
      <PageForm mode="edit" projectId={PROJECT_ID} pageId={PAGE_ID} initial={pageFixture()} />,
    );
    expect(screen.getByRole("link", { name: "Cancel" })).toHaveAttribute(
      "href",
      `/page-inventory/${PAGE_ID}?projectId=${PROJECT_ID}`,
    );
  });
});
