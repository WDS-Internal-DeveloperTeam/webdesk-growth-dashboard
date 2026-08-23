import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const refreshMock = vi.fn();

vi.mock("next/navigation", () => ({
  useRouter: () => ({ refresh: refreshMock }),
}));

import { ClaimSourcesSection } from "../../components/claim-sources-section.js";

const CLAIM_ID = "11111111-1111-1111-1111-111111111111";

describe("ClaimSourcesSection", () => {
  const originalFetch = global.fetch;

  beforeEach(() => {
    process.env.NEXT_PUBLIC_API_BASE_URL = "https://api.example.com";
    refreshMock.mockReset();
  });

  afterEach(() => {
    global.fetch = originalFetch;
    vi.restoreAllMocks();
  });

  it("renders 'No sources recorded yet.' when empty", () => {
    render(<ClaimSourcesSection claimId={CLAIM_ID} initialSources={[]} />);
    expect(screen.getByText("No sources recorded yet.")).toBeInTheDocument();
  });

  it("adds a source — posts source/sourceUrl to the sub-resource route, no refresh needed", async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        success: true,
        data: {
          id: "src-1",
          claimId: CLAIM_ID,
          source: "Q3 uptime report",
          sourceUrl: "https://example.com/report",
          createdAt: "2026-08-23T00:00:00.000Z",
          updatedAt: "2026-08-23T00:00:00.000Z",
        },
        correlationId: "corr-1",
      }),
    } as Response);
    global.fetch = fetchMock as unknown as typeof fetch;

    render(<ClaimSourcesSection claimId={CLAIM_ID} initialSources={[]} />);
    fireEvent.change(screen.getByLabelText("Source"), { target: { value: "Q3 uptime report" } });
    fireEvent.change(screen.getByLabelText("Source URL"), {
      target: { value: "https://example.com/report" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Add source" }));

    await waitFor(() =>
      expect(fetchMock).toHaveBeenCalledWith(
        `https://api.example.com/proof-and-claims-library/claims/${CLAIM_ID}/sources`,
        expect.objectContaining({
          method: "POST",
          credentials: "include",
          body: JSON.stringify({
            source: "Q3 uptime report",
            sourceUrl: "https://example.com/report",
          }),
        }),
      ),
    );
    expect(await screen.findByText("Q3 uptime report")).toBeInTheDocument();
    // No other section on the page reads source data, so no router.refresh() is expected.
    expect(refreshMock).not.toHaveBeenCalled();
  });

  it("renders a javascript: sourceUrl as inert text, not a clickable link", () => {
    render(
      <ClaimSourcesSection
        claimId={CLAIM_ID}
        initialSources={[
          {
            id: "src-1",
            claimId: CLAIM_ID,
            source: "Q3 uptime report",
            sourceUrl: "javascript:alert(1)",
            createdAt: "2026-08-23T00:00:00.000Z",
            updatedAt: "2026-08-23T00:00:00.000Z",
          },
        ]}
      />,
    );
    expect(screen.getByText("javascript:alert(1)")).toBeInTheDocument();
    expect(screen.queryByRole("link")).not.toBeInTheDocument();
  });

  it("deletes a source — posts to the .../:id/delete route (not the DELETE method) and removes the row", async () => {
    const fetchMock = vi.fn().mockResolvedValue({ ok: true, status: 204 } as Response);
    global.fetch = fetchMock as typeof fetch;

    render(
      <ClaimSourcesSection
        claimId={CLAIM_ID}
        initialSources={[
          {
            id: "src-1",
            claimId: CLAIM_ID,
            source: "Q3 uptime report",
            sourceUrl: null,
            createdAt: "2026-08-23T00:00:00.000Z",
            updatedAt: "2026-08-23T00:00:00.000Z",
          },
        ]}
      />,
    );
    fireEvent.click(screen.getByRole("button", { name: "Delete" }));

    await waitFor(() =>
      expect(fetchMock).toHaveBeenCalledWith(
        `https://api.example.com/proof-and-claims-library/claims/${CLAIM_ID}/sources/src-1/delete`,
        expect.objectContaining({ method: "POST", credentials: "include" }),
      ),
    );
    await waitFor(() => expect(screen.queryByText("Q3 uptime report")).not.toBeInTheDocument());
  });

  it("shows the backend's error message on a failed add", async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: false,
      json: async () => ({
        success: false,
        error: { code: "BadRequestException", message: "Source is required" },
        correlationId: "corr-1",
      }),
    } as Response);
    global.fetch = fetchMock as unknown as typeof fetch;

    render(<ClaimSourcesSection claimId={CLAIM_ID} initialSources={[]} />);
    fireEvent.change(screen.getByLabelText("Source"), { target: { value: "x" } });
    fireEvent.click(screen.getByRole("button", { name: "Add source" }));

    expect(await screen.findByRole("alert")).toHaveTextContent("Source is required");
    expect(refreshMock).not.toHaveBeenCalled();
  });

  it("resyncs an open edit form's fields when the row's own updatedAt changes externally, but not on an unrelated re-render", () => {
    const base = {
      id: "src-1",
      claimId: CLAIM_ID,
      source: "Q3 uptime report",
      sourceUrl: "https://old.example.com",
      createdAt: "2026-08-23T00:00:00.000Z",
      updatedAt: "2026-08-23T00:00:00.000Z",
    };
    const { rerender } = render(<ClaimSourcesSection claimId={CLAIM_ID} initialSources={[base]} />);
    fireEvent.click(screen.getByRole("button", { name: "Edit" }));
    // Both the edit form and the always-visible add-form below it have a "Source URL" field — the
    // edit form's is the first one in DOM order. Same underlying component instance persists
    // across the rerenders below (React doesn't remount it, matching the real router.refresh()
    // case this guards against), so it's safe to keep this one reference.
    const [urlInput] = screen.getAllByLabelText("Source URL");
    expect(urlInput).toHaveValue("https://old.example.com");

    // The user types an in-progress, unsaved edit.
    fireEvent.change(urlInput!, { target: { value: "https://typing.example.com" } });
    expect(urlInput).toHaveValue("https://typing.example.com");

    // An unrelated re-render (same source, same updatedAt) must NOT wipe the in-progress edit.
    rerender(<ClaimSourcesSection claimId={CLAIM_ID} initialSources={[{ ...base }]} />);
    expect(urlInput).toHaveValue("https://typing.example.com");

    // A genuine external update to this exact row (new updatedAt) DOES resync — the open form
    // picks up the newer server value instead of silently overwriting it on save.
    rerender(
      <ClaimSourcesSection
        claimId={CLAIM_ID}
        initialSources={[
          { ...base, sourceUrl: "https://new.example.com", updatedAt: "2026-08-23T01:00:00.000Z" },
        ]}
      />,
    );
    expect(urlInput).toHaveValue("https://new.example.com");
  });
});
