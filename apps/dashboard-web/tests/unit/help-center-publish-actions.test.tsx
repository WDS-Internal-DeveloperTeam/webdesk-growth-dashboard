import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const refreshMock = vi.fn();

vi.mock("next/navigation", () => ({
  useRouter: () => ({ refresh: refreshMock }),
}));

import { HelpCenterPublishActions } from "../../components/help-center-publish-actions.js";

const ARTICLE_ID = "11111111-1111-1111-1111-111111111111";

describe("HelpCenterPublishActions", () => {
  const originalFetch = global.fetch;

  beforeEach(() => {
    process.env.NEXT_PUBLIC_API_BASE_URL = "https://api.example.com";
    refreshMock.mockReset();
  });

  afterEach(() => {
    global.fetch = originalFetch;
    vi.restoreAllMocks();
  });

  it("unpublished: shows Publish only", () => {
    render(<HelpCenterPublishActions articleId={ARTICLE_ID} isPublished={false} />);
    expect(screen.getByRole("button", { name: "Publish" })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Unpublish" })).not.toBeInTheDocument();
  });

  it("published: shows Unpublish only", () => {
    render(<HelpCenterPublishActions articleId={ARTICLE_ID} isPublished={true} />);
    expect(screen.queryByRole("button", { name: "Publish" })).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Unpublish" })).toBeInTheDocument();
  });

  it("Publish: posts isPublished:true to the ordinary update route with no confirmation prompt, then refreshes", async () => {
    const confirmSpy = vi.fn();
    window.confirm = confirmSpy;
    const fetchMock = vi.fn().mockResolvedValue({ ok: true } as Response);
    global.fetch = fetchMock as typeof fetch;

    render(<HelpCenterPublishActions articleId={ARTICLE_ID} isPublished={false} />);
    fireEvent.click(screen.getByRole("button", { name: "Publish" }));

    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(1));
    expect(confirmSpy).not.toHaveBeenCalled();
    expect(fetchMock).toHaveBeenCalledWith(
      `https://api.example.com/help-center/articles/${ARTICLE_ID}/update`,
      expect.objectContaining({
        method: "POST",
        credentials: "include",
        body: JSON.stringify({ isPublished: true }),
      }),
    );
    await waitFor(() => expect(refreshMock).toHaveBeenCalledTimes(1));
  });

  it("Unpublish: posts isPublished:false to the ordinary update route with no confirmation prompt, then refreshes", async () => {
    const confirmSpy = vi.fn();
    window.confirm = confirmSpy;
    const fetchMock = vi.fn().mockResolvedValue({ ok: true } as Response);
    global.fetch = fetchMock as typeof fetch;

    render(<HelpCenterPublishActions articleId={ARTICLE_ID} isPublished={true} />);
    fireEvent.click(screen.getByRole("button", { name: "Unpublish" }));

    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(1));
    expect(confirmSpy).not.toHaveBeenCalled();
    expect(fetchMock).toHaveBeenCalledWith(
      `https://api.example.com/help-center/articles/${ARTICLE_ID}/update`,
      expect.objectContaining({
        method: "POST",
        credentials: "include",
        body: JSON.stringify({ isPublished: false }),
      }),
    );
    await waitFor(() => expect(refreshMock).toHaveBeenCalledTimes(1));
  });

  it("after a successful Publish, the button set flips to Unpublish immediately, without waiting on refresh", async () => {
    global.fetch = vi.fn().mockResolvedValue({ ok: true } as Response) as typeof fetch;

    render(<HelpCenterPublishActions articleId={ARTICLE_ID} isPublished={false} />);
    fireEvent.click(screen.getByRole("button", { name: "Publish" }));

    await waitFor(() => expect(refreshMock).toHaveBeenCalledTimes(1));
    expect(screen.getByRole("button", { name: "Unpublish" })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Publish" })).not.toBeInTheDocument();
  });

  it("shows the backend's error message on a failed request", async () => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: false,
      json: async () => ({
        success: false,
        error: { code: "NotFoundException", message: `Help article not found: ${ARTICLE_ID}` },
        correlationId: "corr-1",
      }),
    } as Response) as typeof fetch;

    render(<HelpCenterPublishActions articleId={ARTICLE_ID} isPublished={false} />);
    fireEvent.click(screen.getByRole("button", { name: "Publish" }));

    expect(await screen.findByRole("alert")).toHaveTextContent(/not found/);
    expect(refreshMock).not.toHaveBeenCalled();
  });

  it("re-syncs isPublished from a fresh prop without a remount", () => {
    const { rerender } = render(
      <HelpCenterPublishActions articleId={ARTICLE_ID} isPublished={true} />,
    );
    expect(screen.getByRole("button", { name: "Unpublish" })).toBeInTheDocument();

    // Simulates the server-fetched prop changing on a re-render (a fresh page fetch after
    // router.refresh(), not a remount).
    rerender(<HelpCenterPublishActions articleId={ARTICLE_ID} isPublished={false} />);
    expect(screen.getByRole("button", { name: "Publish" })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Unpublish" })).not.toBeInTheDocument();
  });
});
