import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const refreshMock = vi.fn();

vi.mock("next/navigation", () => ({
  useRouter: () => ({ refresh: refreshMock }),
}));

import { PageUrlsSection } from "../../components/page-urls-section.js";

const PROJECT_ID = "99999999-9999-9999-9999-999999999999";
const PAGE_ID = "11111111-1111-1111-1111-111111111111";
const BASE_PATH = `https://api.example.com/page-inventory/projects/${PROJECT_ID}/pages/${PAGE_ID}/urls`;

describe("PageUrlsSection", () => {
  const originalFetch = global.fetch;

  beforeEach(() => {
    process.env.NEXT_PUBLIC_API_BASE_URL = "https://api.example.com";
    refreshMock.mockReset();
  });

  afterEach(() => {
    global.fetch = originalFetch;
    vi.restoreAllMocks();
  });

  it("renders 'No URLs recorded yet.' when empty", () => {
    render(<PageUrlsSection projectId={PROJECT_ID} pageId={PAGE_ID} initialUrls={[]} />);
    expect(screen.getByText("No URLs recorded yet.")).toBeInTheDocument();
  });

  it("adds a URL — posts url/isCanonical to the project-scoped sub-resource route, no refresh needed", async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        success: true,
        data: {
          id: "url-1",
          pageId: PAGE_ID,
          projectId: PROJECT_ID,
          url: "https://example.com/pricing",
          isCanonical: true,
          createdAt: "2026-08-23T00:00:00.000Z",
          updatedAt: "2026-08-23T00:00:00.000Z",
        },
        correlationId: "corr-1",
      }),
    } as Response);
    global.fetch = fetchMock as unknown as typeof fetch;

    render(<PageUrlsSection projectId={PROJECT_ID} pageId={PAGE_ID} initialUrls={[]} />);
    fireEvent.change(screen.getByLabelText("URL"), {
      target: { value: "https://example.com/pricing" },
    });
    fireEvent.click(screen.getByLabelText("Canonical"));
    fireEvent.click(screen.getByRole("button", { name: "Add URL" }));

    await waitFor(() =>
      expect(fetchMock).toHaveBeenCalledWith(
        BASE_PATH,
        expect.objectContaining({
          method: "POST",
          credentials: "include",
          body: JSON.stringify({ url: "https://example.com/pricing", isCanonical: true }),
        }),
      ),
    );
    expect(await screen.findByText("https://example.com/pricing")).toBeInTheDocument();
    // "Canonical" appears twice: the row's own badge, and the always-visible add-form's checkbox
    // label — both are expected here, so this asserts at least one (the badge) rendered, not
    // exactly one.
    expect(screen.getAllByText("Canonical").length).toBeGreaterThan(0);
    // No other section on the detail page reads URL data, so no router.refresh() is expected.
    expect(refreshMock).not.toHaveBeenCalled();
  });

  it("rejects a javascript: URL client-side before ever calling fetch", async () => {
    const fetchMock = vi.fn();
    global.fetch = fetchMock as typeof fetch;

    render(<PageUrlsSection projectId={PROJECT_ID} pageId={PAGE_ID} initialUrls={[]} />);
    fireEvent.change(screen.getByLabelText("URL"), {
      target: { value: "javascript:alert(1)" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Add URL" }));

    expect(await screen.findByRole("alert")).toHaveTextContent(/valid http/);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("renders a javascript: URL already stored (from before the backend's own scheme validation existed) as inert text, not a clickable link", () => {
    render(
      <PageUrlsSection
        projectId={PROJECT_ID}
        pageId={PAGE_ID}
        initialUrls={[
          {
            id: "url-1",
            pageId: PAGE_ID,
            projectId: PROJECT_ID,
            url: "javascript:alert(1)",
            isCanonical: false,
            createdAt: "2026-08-23T00:00:00.000Z",
            updatedAt: "2026-08-23T00:00:00.000Z",
          },
        ]}
      />,
    );
    expect(screen.getByText("javascript:alert(1)")).toBeInTheDocument();
    expect(screen.queryByRole("link")).not.toBeInTheDocument();
  });

  it("deletes a URL — posts to the .../:id/delete route (not the DELETE method) and removes the row", async () => {
    const fetchMock = vi.fn().mockResolvedValue({ ok: true, status: 204 } as Response);
    global.fetch = fetchMock as typeof fetch;

    render(
      <PageUrlsSection
        projectId={PROJECT_ID}
        pageId={PAGE_ID}
        initialUrls={[
          {
            id: "url-1",
            pageId: PAGE_ID,
            projectId: PROJECT_ID,
            url: "https://example.com/pricing",
            isCanonical: false,
            createdAt: "2026-08-23T00:00:00.000Z",
            updatedAt: "2026-08-23T00:00:00.000Z",
          },
        ]}
      />,
    );
    fireEvent.click(screen.getByRole("button", { name: "Delete" }));

    await waitFor(() =>
      expect(fetchMock).toHaveBeenCalledWith(
        `${BASE_PATH}/url-1/delete`,
        expect.objectContaining({ method: "POST", credentials: "include" }),
      ),
    );
    await waitFor(() =>
      expect(screen.queryByText("https://example.com/pricing")).not.toBeInTheDocument(),
    );
  });

  it("shows the backend's error message on a failed add", async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: false,
      json: async () => ({
        success: false,
        error: {
          code: "BadRequestException",
          message: "A canonical URL already exists for this project: https://example.com/pricing",
        },
        correlationId: "corr-1",
      }),
    } as Response);
    global.fetch = fetchMock as unknown as typeof fetch;

    render(<PageUrlsSection projectId={PROJECT_ID} pageId={PAGE_ID} initialUrls={[]} />);
    fireEvent.change(screen.getByLabelText("URL"), {
      target: { value: "https://example.com/pricing" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Add URL" }));

    expect(await screen.findByRole("alert")).toHaveTextContent(/A canonical URL already exists/);
    expect(refreshMock).not.toHaveBeenCalled();
  });

  it("resyncs an open edit form's fields when the row's own updatedAt changes externally, but not on an unrelated re-render", () => {
    const base = {
      id: "url-1",
      pageId: PAGE_ID,
      projectId: PROJECT_ID,
      url: "https://old.example.com/",
      isCanonical: false,
      createdAt: "2026-08-23T00:00:00.000Z",
      updatedAt: "2026-08-23T00:00:00.000Z",
    };
    const { rerender } = render(
      <PageUrlsSection projectId={PROJECT_ID} pageId={PAGE_ID} initialUrls={[base]} />,
    );
    fireEvent.click(screen.getByRole("button", { name: "Edit" }));
    // Both the edit form and the always-visible add-form below it have a "URL" field — the edit
    // form's is the first one in DOM order. Same underlying component instance persists across the
    // rerenders below (React doesn't remount it, matching the real router.refresh() case this
    // guards against), so it's safe to keep this one reference.
    const [urlInput] = screen.getAllByLabelText("URL");
    expect(urlInput).toHaveValue("https://old.example.com/");

    // The user types an in-progress, unsaved edit.
    fireEvent.change(urlInput!, { target: { value: "https://typing.example.com/" } });
    expect(urlInput).toHaveValue("https://typing.example.com/");

    // An unrelated re-render (same URL, same updatedAt) must NOT wipe the in-progress edit.
    rerender(
      <PageUrlsSection projectId={PROJECT_ID} pageId={PAGE_ID} initialUrls={[{ ...base }]} />,
    );
    expect(urlInput).toHaveValue("https://typing.example.com/");

    // A genuine external update to this exact row (new updatedAt) DOES resync — the open form
    // picks up the newer server value instead of silently overwriting it on save.
    rerender(
      <PageUrlsSection
        projectId={PROJECT_ID}
        pageId={PAGE_ID}
        initialUrls={[
          {
            ...base,
            url: "https://new.example.com/",
            updatedAt: "2026-08-23T01:00:00.000Z",
          },
        ]}
      />,
    );
    expect(urlInput).toHaveValue("https://new.example.com/");
  });
});
