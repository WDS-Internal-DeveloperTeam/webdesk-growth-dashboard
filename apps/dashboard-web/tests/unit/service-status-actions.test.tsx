import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const refreshMock = vi.fn();

vi.mock("next/navigation", () => ({
  useRouter: () => ({ refresh: refreshMock }),
}));

import { ServiceStatusActions } from "../../components/service-status-actions.js";

const SERVICE_ID = "11111111-1111-1111-1111-111111111111";

describe("ServiceStatusActions", () => {
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

  it("draft: renders both reachable transitions", () => {
    render(<ServiceStatusActions serviceId={SERVICE_ID} approvalStatus="draft" />);
    expect(screen.getByRole("button", { name: "Submit for Review" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Archive" })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Approve" })).not.toBeInTheDocument();
  });

  it("under_review: renders all four reachable transitions (approve/revision_requested/rejected/archived)", () => {
    render(<ServiceStatusActions serviceId={SERVICE_ID} approvalStatus="under_review" />);
    expect(screen.getByRole("button", { name: "Approve" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Request Revision" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Reject" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Archive" })).toBeInTheDocument();
  });

  it("superseded: renders nothing — superseded is a terminal state", () => {
    const { container } = render(
      <ServiceStatusActions serviceId={SERVICE_ID} approvalStatus="superseded" />,
    );
    expect(container).toBeEmptyDOMElement();
  });

  it("archived: renders nothing — archived is a terminal state", () => {
    const { container } = render(
      <ServiceStatusActions serviceId={SERVICE_ID} approvalStatus="archived" />,
    );
    expect(container).toBeEmptyDOMElement();
  });

  it("Submit for Review: posts {approvalStatus: submitted} with no confirmation prompt, then refreshes", async () => {
    const confirmSpy = vi.fn();
    window.confirm = confirmSpy;
    const fetchMock = vi.fn().mockResolvedValue({ ok: true } as Response);
    global.fetch = fetchMock as typeof fetch;

    render(<ServiceStatusActions serviceId={SERVICE_ID} approvalStatus="draft" />);
    fireEvent.click(screen.getByRole("button", { name: "Submit for Review" }));

    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(1));
    expect(confirmSpy).not.toHaveBeenCalled();
    expect(fetchMock).toHaveBeenCalledWith(
      `https://api.example.com/service-library/services/${SERVICE_ID}/status`,
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

    render(<ServiceStatusActions serviceId={SERVICE_ID} approvalStatus="draft" />);
    fireEvent.click(screen.getByRole("button", { name: "Archive" }));

    await waitFor(() => expect(window.confirm).toHaveBeenCalledTimes(1));
    expect(fetchMock).not.toHaveBeenCalled();
    expect(refreshMock).not.toHaveBeenCalled();
  });

  it("Reject (a recoverable transition, not terminal) prompts no confirmation", async () => {
    const confirmSpy = vi.fn();
    window.confirm = confirmSpy;
    global.fetch = vi.fn().mockResolvedValue({ ok: true } as Response) as typeof fetch;

    render(<ServiceStatusActions serviceId={SERVICE_ID} approvalStatus="under_review" />);
    fireEvent.click(screen.getByRole("button", { name: "Reject" }));

    await waitFor(() => expect(global.fetch).toHaveBeenCalledTimes(1));
    expect(confirmSpy).not.toHaveBeenCalled();
  });

  it("shows the backend's 409 conflict message when the atomic status write loses a race", async () => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: false,
      json: async () => ({
        success: false,
        error: {
          code: "ConflictException",
          message: `Service ${SERVICE_ID} approval status changed concurrently (expected draft, now submitted) — reload and retry`,
        },
        correlationId: "corr-1",
      }),
    } as Response) as typeof fetch;

    render(<ServiceStatusActions serviceId={SERVICE_ID} approvalStatus="draft" />);
    fireEvent.click(screen.getByRole("button", { name: "Submit for Review" }));

    expect(await screen.findByRole("alert")).toHaveTextContent(/changed concurrently/);
    expect(refreshMock).not.toHaveBeenCalled();
  });

  it("renders the new status's buttons immediately on success, without waiting on refresh", async () => {
    window.confirm = vi.fn();
    global.fetch = vi.fn().mockResolvedValue({ ok: true } as Response) as typeof fetch;

    render(<ServiceStatusActions serviceId={SERVICE_ID} approvalStatus="draft" />);
    fireEvent.click(screen.getByRole("button", { name: "Submit for Review" }));

    await waitFor(() => expect(refreshMock).toHaveBeenCalledTimes(1));
    expect(screen.getByRole("button", { name: "Start Review" })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Submit for Review" })).not.toBeInTheDocument();
  });
});
