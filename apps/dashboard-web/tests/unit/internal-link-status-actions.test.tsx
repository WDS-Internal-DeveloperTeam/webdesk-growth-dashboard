import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const refreshMock = vi.fn();

vi.mock("next/navigation", () => ({
  useRouter: () => ({ refresh: refreshMock }),
}));

import { InternalLinkStatusActions } from "../../components/internal-link-status-actions.js";

const PROJECT_ID = "99999999-9999-9999-9999-999999999999";
const LINK_ID = "11111111-1111-1111-1111-111111111111";

describe("InternalLinkStatusActions", () => {
  const originalFetch = global.fetch;

  beforeEach(() => {
    process.env.NEXT_PUBLIC_API_BASE_URL = "https://api.example.com";
    refreshMock.mockReset();
  });

  afterEach(() => {
    global.fetch = originalFetch;
    vi.restoreAllMocks();
  });

  it("proposed: renders only Approve — no backward transition exists from the initial state", () => {
    render(<InternalLinkStatusActions projectId={PROJECT_ID} linkId={LINK_ID} status="proposed" />);
    expect(screen.getByRole("button", { name: "Approve" })).toBeInTheDocument();
    expect(screen.getAllByRole("button")).toHaveLength(1);
  });

  it("approved: renders Mark as Implemented and Revert to Proposed", () => {
    render(<InternalLinkStatusActions projectId={PROJECT_ID} linkId={LINK_ID} status="approved" />);
    expect(screen.getByRole("button", { name: "Mark as Implemented" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Revert to Proposed" })).toBeInTheDocument();
    expect(screen.getAllByRole("button")).toHaveLength(2);
  });

  it("implemented: renders Mark as Verified and Approve", () => {
    render(
      <InternalLinkStatusActions projectId={PROJECT_ID} linkId={LINK_ID} status="implemented" />,
    );
    expect(screen.getByRole("button", { name: "Mark as Verified" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Approve" })).toBeInTheDocument();
    expect(screen.getAllByRole("button")).toHaveLength(2);
  });

  it("verified: renders only Mark as Implemented — the one backward step, no forward transition exists", () => {
    render(<InternalLinkStatusActions projectId={PROJECT_ID} linkId={LINK_ID} status="verified" />);
    expect(screen.getByRole("button", { name: "Mark as Implemented" })).toBeInTheDocument();
    expect(screen.getAllByRole("button")).toHaveLength(1);
  });

  it("never shows a confirmation prompt for any transition — no state in this workflow is irreversible", async () => {
    const confirmSpy = vi.fn();
    window.confirm = confirmSpy;
    global.fetch = vi.fn().mockResolvedValue({ ok: true } as Response) as typeof fetch;

    render(<InternalLinkStatusActions projectId={PROJECT_ID} linkId={LINK_ID} status="proposed" />);
    fireEvent.click(screen.getByRole("button", { name: "Approve" }));

    await waitFor(() => expect(refreshMock).toHaveBeenCalledTimes(1));
    expect(confirmSpy).not.toHaveBeenCalled();
  });

  it("Approve: posts {status: approved} to the project-scoped status route, then refreshes", async () => {
    const fetchMock = vi.fn().mockResolvedValue({ ok: true } as Response);
    global.fetch = fetchMock as typeof fetch;

    render(<InternalLinkStatusActions projectId={PROJECT_ID} linkId={LINK_ID} status="proposed" />);
    fireEvent.click(screen.getByRole("button", { name: "Approve" }));

    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(1));
    expect(fetchMock).toHaveBeenCalledWith(
      `https://api.example.com/internal-linking-library/projects/${PROJECT_ID}/links/${LINK_ID}/status`,
      expect.objectContaining({
        method: "POST",
        credentials: "include",
        body: JSON.stringify({ status: "approved" }),
      }),
    );
    await waitFor(() => expect(refreshMock).toHaveBeenCalledTimes(1));
  });

  it("shows the backend's 409 conflict message when the atomic status write loses a race", async () => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: false,
      json: async () => ({
        success: false,
        error: {
          code: "ConflictException",
          message: `Internal link ${LINK_ID} status changed concurrently (expected proposed, now approved) — reload and retry`,
        },
        correlationId: "corr-1",
      }),
    } as Response) as typeof fetch;

    render(<InternalLinkStatusActions projectId={PROJECT_ID} linkId={LINK_ID} status="proposed" />);
    fireEvent.click(screen.getByRole("button", { name: "Approve" }));

    expect(await screen.findByRole("alert")).toHaveTextContent(/changed concurrently/);
    expect(refreshMock).not.toHaveBeenCalled();
  });

  it("renders the new status's buttons immediately on success, without waiting on refresh", async () => {
    global.fetch = vi.fn().mockResolvedValue({ ok: true } as Response) as typeof fetch;

    render(<InternalLinkStatusActions projectId={PROJECT_ID} linkId={LINK_ID} status="proposed" />);
    fireEvent.click(screen.getByRole("button", { name: "Approve" }));

    await waitFor(() => expect(refreshMock).toHaveBeenCalledTimes(1));
    expect(screen.getByRole("button", { name: "Mark as Implemented" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Revert to Proposed" })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Approve" })).not.toBeInTheDocument();
  });

  it("logs and shows a generic error, without refreshing, when the fetch call itself throws", async () => {
    const consoleErrorSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    global.fetch = vi.fn().mockRejectedValue(new Error("network down")) as typeof fetch;

    render(<InternalLinkStatusActions projectId={PROJECT_ID} linkId={LINK_ID} status="proposed" />);
    fireEvent.click(screen.getByRole("button", { name: "Approve" }));

    expect(await screen.findByRole("alert")).toHaveTextContent(
      "Something went wrong. Please try again.",
    );
    expect(refreshMock).not.toHaveBeenCalled();
    expect(consoleErrorSpy).toHaveBeenCalled();
    consoleErrorSpy.mockRestore();
  });

  it("renders nothing for a status outside the known union, instead of throwing", () => {
    const unknownStatus = "not_a_real_status" as unknown as Parameters<
      typeof InternalLinkStatusActions
    >[0]["status"];
    const { container } = render(
      <InternalLinkStatusActions projectId={PROJECT_ID} linkId={LINK_ID} status={unknownStatus} />,
    );
    expect(container).toBeEmptyDOMElement();
  });
});
