import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const refreshMock = vi.fn();

vi.mock("next/navigation", () => ({
  useRouter: () => ({ refresh: refreshMock }),
}));

import { ContentTemplatePublishActions } from "../../components/content-template-library-publish-actions.js";

const TEMPLATE_ID = "11111111-1111-1111-1111-111111111111";

describe("ContentTemplatePublishActions", () => {
  const originalFetch = global.fetch;

  beforeEach(() => {
    process.env.NEXT_PUBLIC_API_BASE_URL = "https://api.example.com";
    refreshMock.mockReset();
  });

  afterEach(() => {
    global.fetch = originalFetch;
    vi.restoreAllMocks();
  });

  it("approved + unpublished: shows Publish only", () => {
    render(
      <ContentTemplatePublishActions
        templateId={TEMPLATE_ID}
        approvalStatus="approved"
        isPublished={false}
      />,
    );
    expect(screen.getByRole("button", { name: "Publish" })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Unpublish" })).not.toBeInTheDocument();
  });

  it("approved + published: shows Unpublish only", () => {
    render(
      <ContentTemplatePublishActions
        templateId={TEMPLATE_ID}
        approvalStatus="approved"
        isPublished={true}
      />,
    );
    expect(screen.queryByRole("button", { name: "Publish" })).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Unpublish" })).toBeInTheDocument();
  });

  it("non-approved + unpublished (draft): shows neither button, renders nothing", () => {
    const { container } = render(
      <ContentTemplatePublishActions
        templateId={TEMPLATE_ID}
        approvalStatus="draft"
        isPublished={false}
      />,
    );
    expect(container).toBeEmptyDOMElement();
  });

  it("non-approved + published (archived, D3): still shows Unpublish — no automatic unpublish on a later status transition", () => {
    render(
      <ContentTemplatePublishActions
        templateId={TEMPLATE_ID}
        approvalStatus="archived"
        isPublished={true}
      />,
    );
    expect(screen.getByRole("button", { name: "Unpublish" })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Publish" })).not.toBeInTheDocument();
  });

  it("under_review + unpublished: shows neither button", () => {
    const { container } = render(
      <ContentTemplatePublishActions
        templateId={TEMPLATE_ID}
        approvalStatus="under_review"
        isPublished={false}
      />,
    );
    expect(container).toBeEmptyDOMElement();
  });

  it("Publish: posts to the publish route with no confirmation prompt, then refreshes", async () => {
    const confirmSpy = vi.fn();
    window.confirm = confirmSpy;
    const fetchMock = vi.fn().mockResolvedValue({ ok: true } as Response);
    global.fetch = fetchMock as typeof fetch;

    render(
      <ContentTemplatePublishActions
        templateId={TEMPLATE_ID}
        approvalStatus="approved"
        isPublished={false}
      />,
    );
    fireEvent.click(screen.getByRole("button", { name: "Publish" }));

    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(1));
    expect(confirmSpy).not.toHaveBeenCalled();
    expect(fetchMock).toHaveBeenCalledWith(
      `https://api.example.com/content-template-library/templates/${TEMPLATE_ID}/publish`,
      expect.objectContaining({ method: "POST", credentials: "include" }),
    );
    await waitFor(() => expect(refreshMock).toHaveBeenCalledTimes(1));
  });

  it("Unpublish: posts to the unpublish route with no confirmation prompt, then refreshes", async () => {
    const confirmSpy = vi.fn();
    window.confirm = confirmSpy;
    const fetchMock = vi.fn().mockResolvedValue({ ok: true } as Response);
    global.fetch = fetchMock as typeof fetch;

    render(
      <ContentTemplatePublishActions
        templateId={TEMPLATE_ID}
        approvalStatus="approved"
        isPublished={true}
      />,
    );
    fireEvent.click(screen.getByRole("button", { name: "Unpublish" }));

    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(1));
    expect(confirmSpy).not.toHaveBeenCalled();
    expect(fetchMock).toHaveBeenCalledWith(
      `https://api.example.com/content-template-library/templates/${TEMPLATE_ID}/unpublish`,
      expect.objectContaining({ method: "POST", credentials: "include" }),
    );
    await waitFor(() => expect(refreshMock).toHaveBeenCalledTimes(1));
  });

  it("after a successful Publish, the button set flips to Unpublish immediately, without waiting on refresh", async () => {
    global.fetch = vi.fn().mockResolvedValue({ ok: true } as Response) as typeof fetch;

    render(
      <ContentTemplatePublishActions
        templateId={TEMPLATE_ID}
        approvalStatus="approved"
        isPublished={false}
      />,
    );
    fireEvent.click(screen.getByRole("button", { name: "Publish" }));

    await waitFor(() => expect(refreshMock).toHaveBeenCalledTimes(1));
    expect(screen.getByRole("button", { name: "Unpublish" })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Publish" })).not.toBeInTheDocument();
  });

  it("shows the backend's 400 message when publish is rejected because the template is no longer approved", async () => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: false,
      json: async () => ({
        success: false,
        error: {
          code: "BadRequestException",
          message: `Content template ${TEMPLATE_ID} cannot be published while its approval status is 'draft'`,
        },
        correlationId: "corr-1",
      }),
    } as Response) as typeof fetch;

    render(
      <ContentTemplatePublishActions
        templateId={TEMPLATE_ID}
        approvalStatus="approved"
        isPublished={false}
      />,
    );
    fireEvent.click(screen.getByRole("button", { name: "Publish" }));

    expect(await screen.findByRole("alert")).toHaveTextContent(/cannot be published/);
    expect(refreshMock).not.toHaveBeenCalled();
  });
});
