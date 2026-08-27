import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const refreshMock = vi.fn();

vi.mock("next/navigation", () => ({
  useRouter: () => ({ refresh: refreshMock }),
}));

import { DesignReferenceLibraryStatusActions } from "../../components/design-reference-library-status-actions.js";

const RECORD_ID = "11111111-1111-1111-1111-111111111111";

describe("DesignReferenceLibraryStatusActions", () => {
  const originalFetch = global.fetch;
  const originalConfirm = window.confirm;

  beforeEach(() => {
    process.env.NEXT_PUBLIC_API_BASE_URL = "https://api.example.com";
    refreshMock.mockReset();
  });

  afterEach(() => {
    global.fetch = originalFetch;
    window.confirm = originalConfirm;
    vi.restoreAllMocks();
  });

  it("draft: renders Submit for Review and Archive", () => {
    render(<DesignReferenceLibraryStatusActions recordId={RECORD_ID} approvalStatus="draft" />);
    expect(screen.getByRole("button", { name: "Submit for Review" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Archive" })).toBeInTheDocument();
  });

  it("under_review: renders Approve, Request Revision, Reject, and Archive", () => {
    render(
      <DesignReferenceLibraryStatusActions recordId={RECORD_ID} approvalStatus="under_review" />,
    );
    expect(screen.getByRole("button", { name: "Approve" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Request Revision" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Reject" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Archive" })).toBeInTheDocument();
  });

  it("rejected: includes Revert to Draft — the fully-recoverable resubmit path, no confirmation needed", () => {
    render(<DesignReferenceLibraryStatusActions recordId={RECORD_ID} approvalStatus="rejected" />);
    expect(screen.getByRole("button", { name: "Revert to Draft" })).toBeInTheDocument();
  });

  it("archived: renders nothing — archived is a terminal state", () => {
    const { container } = render(
      <DesignReferenceLibraryStatusActions recordId={RECORD_ID} approvalStatus="archived" />,
    );
    expect(container).toBeEmptyDOMElement();
  });

  it("superseded: renders nothing — superseded is a terminal state", () => {
    const { container } = render(
      <DesignReferenceLibraryStatusActions recordId={RECORD_ID} approvalStatus="superseded" />,
    );
    expect(container).toBeEmptyDOMElement();
  });

  it("Submit for Review: posts {approvalStatus: submitted} with no confirmation prompt, then refreshes", async () => {
    const confirmSpy = vi.fn();
    window.confirm = confirmSpy;
    const fetchMock = vi.fn().mockResolvedValue({ ok: true } as Response);
    global.fetch = fetchMock as typeof fetch;

    render(<DesignReferenceLibraryStatusActions recordId={RECORD_ID} approvalStatus="draft" />);
    fireEvent.click(screen.getByRole("button", { name: "Submit for Review" }));

    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(1));
    expect(confirmSpy).not.toHaveBeenCalled();
    expect(fetchMock).toHaveBeenCalledWith(
      `https://api.example.com/design-reference-library/records/${RECORD_ID}/status`,
      expect.objectContaining({
        method: "POST",
        credentials: "include",
        body: JSON.stringify({ approvalStatus: "submitted" }),
      }),
    );
    await waitFor(() => expect(refreshMock).toHaveBeenCalledTimes(1));
  });

  it("Archive: asks for confirmation first, and does nothing if the user cancels", async () => {
    window.confirm = vi.fn().mockReturnValue(false);
    const fetchMock = vi.fn();
    global.fetch = fetchMock as typeof fetch;

    render(<DesignReferenceLibraryStatusActions recordId={RECORD_ID} approvalStatus="draft" />);
    fireEvent.click(screen.getByRole("button", { name: "Archive" }));

    await waitFor(() => expect(window.confirm).toHaveBeenCalledTimes(1));
    expect(fetchMock).not.toHaveBeenCalled();
    expect(refreshMock).not.toHaveBeenCalled();
  });

  it("shows the backend's 409 conflict message when the atomic status write loses a race", async () => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: false,
      json: async () => ({
        success: false,
        error: {
          code: "ConflictException",
          message: `Design reference record ${RECORD_ID} approval status changed concurrently (expected draft, now submitted) — reload and retry`,
        },
        correlationId: "corr-1",
      }),
    } as Response) as typeof fetch;

    render(<DesignReferenceLibraryStatusActions recordId={RECORD_ID} approvalStatus="draft" />);
    fireEvent.click(screen.getByRole("button", { name: "Submit for Review" }));

    expect(await screen.findByRole("alert")).toHaveTextContent(/changed concurrently/);
    expect(refreshMock).not.toHaveBeenCalled();
  });

  it("renders the new status's buttons immediately on success, without waiting on refresh", async () => {
    window.confirm = vi.fn();
    global.fetch = vi.fn().mockResolvedValue({ ok: true } as Response) as typeof fetch;

    render(<DesignReferenceLibraryStatusActions recordId={RECORD_ID} approvalStatus="draft" />);
    fireEvent.click(screen.getByRole("button", { name: "Submit for Review" }));

    await waitFor(() => expect(refreshMock).toHaveBeenCalledTimes(1));
    expect(screen.getByRole("button", { name: "Start Review" })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Submit for Review" })).not.toBeInTheDocument();
  });

  it("renders nothing for a status outside the known union, instead of throwing", () => {
    const unknownStatus = "not_a_real_status" as unknown as Parameters<
      typeof DesignReferenceLibraryStatusActions
    >[0]["approvalStatus"];
    const { container } = render(
      <DesignReferenceLibraryStatusActions recordId={RECORD_ID} approvalStatus={unknownStatus} />,
    );
    expect(container).toBeEmptyDOMElement();
  });

  it("re-syncs approvalStatus from a fresh prop (e.g. after a sibling DesignReferenceLibraryPublishActions transition triggers router.refresh()) without a remount", () => {
    const { rerender } = render(
      <DesignReferenceLibraryStatusActions recordId={RECORD_ID} approvalStatus="draft" />,
    );
    expect(screen.getByRole("button", { name: "Submit for Review" })).toBeInTheDocument();

    // Simulates the server-fetched prop changing on a re-render (a fresh `getServerSession()` read
    // after router.refresh(), not a remount).
    rerender(
      <DesignReferenceLibraryStatusActions recordId={RECORD_ID} approvalStatus="approved" />,
    );
    expect(screen.getByRole("button", { name: "Mark as Superseded" })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Submit for Review" })).not.toBeInTheDocument();
  });
});
