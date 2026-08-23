import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const refreshMock = vi.fn();

vi.mock("next/navigation", () => ({
  useRouter: () => ({ refresh: refreshMock }),
}));

import { PageStatusActions } from "../../components/page-status-actions.js";

const PROJECT_ID = "99999999-9999-9999-9999-999999999999";
const PAGE_ID = "11111111-1111-1111-1111-111111111111";

describe("PageStatusActions", () => {
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
    render(<PageStatusActions projectId={PROJECT_ID} pageId={PAGE_ID} workflowStage="draft" />);
    expect(screen.getByRole("button", { name: "Submit for Review" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Archive" })).toBeInTheDocument();
  });

  it("under_review: renders Approve, Request Revision, Reject, and Archive", () => {
    render(
      <PageStatusActions projectId={PROJECT_ID} pageId={PAGE_ID} workflowStage="under_review" />,
    );
    expect(screen.getByRole("button", { name: "Approve" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Request Revision" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Reject" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Archive" })).toBeInTheDocument();
  });

  it("approved: renders Mark as Superseded and Archive — unlike WebsiteStrategyStatusActions, this module's own backend allows a direct approved -> superseded transition", () => {
    render(<PageStatusActions projectId={PROJECT_ID} pageId={PAGE_ID} workflowStage="approved" />);
    expect(screen.getByRole("button", { name: "Mark as Superseded" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Archive" })).toBeInTheDocument();
    expect(screen.getAllByRole("button")).toHaveLength(2);
  });

  it("rejected: includes Revert to Draft — the fully-recoverable resubmit path, no confirmation needed", () => {
    render(<PageStatusActions projectId={PROJECT_ID} pageId={PAGE_ID} workflowStage="rejected" />);
    expect(screen.getByRole("button", { name: "Revert to Draft" })).toBeInTheDocument();
  });

  it("archived: renders nothing — archived is a terminal stage", () => {
    const { container } = render(
      <PageStatusActions projectId={PROJECT_ID} pageId={PAGE_ID} workflowStage="archived" />,
    );
    expect(container).toBeEmptyDOMElement();
  });

  it("superseded: renders nothing — superseded is a terminal stage", () => {
    const { container } = render(
      <PageStatusActions projectId={PROJECT_ID} pageId={PAGE_ID} workflowStage="superseded" />,
    );
    expect(container).toBeEmptyDOMElement();
  });

  it("Submit for Review: posts {workflowStage: submitted} to the project-scoped workflow-stage route with no confirmation prompt, then refreshes", async () => {
    const confirmSpy = vi.fn();
    window.confirm = confirmSpy;
    const fetchMock = vi.fn().mockResolvedValue({ ok: true } as Response);
    global.fetch = fetchMock as typeof fetch;

    render(<PageStatusActions projectId={PROJECT_ID} pageId={PAGE_ID} workflowStage="draft" />);
    fireEvent.click(screen.getByRole("button", { name: "Submit for Review" }));

    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(1));
    expect(confirmSpy).not.toHaveBeenCalled();
    expect(fetchMock).toHaveBeenCalledWith(
      `https://api.example.com/page-inventory/projects/${PROJECT_ID}/pages/${PAGE_ID}/workflow-stage`,
      expect.objectContaining({
        method: "POST",
        credentials: "include",
        body: JSON.stringify({ workflowStage: "submitted" }),
      }),
    );
    await waitFor(() => expect(refreshMock).toHaveBeenCalledTimes(1));
  });

  it("Archive: asks for confirmation first, and does nothing if the user cancels", async () => {
    window.confirm = vi.fn().mockReturnValue(false);
    const fetchMock = vi.fn();
    global.fetch = fetchMock as typeof fetch;

    render(<PageStatusActions projectId={PROJECT_ID} pageId={PAGE_ID} workflowStage="draft" />);
    fireEvent.click(screen.getByRole("button", { name: "Archive" }));

    await waitFor(() => expect(window.confirm).toHaveBeenCalledTimes(1));
    expect(fetchMock).not.toHaveBeenCalled();
    expect(refreshMock).not.toHaveBeenCalled();
  });

  it("Mark as Superseded: also asks for confirmation first", async () => {
    window.confirm = vi.fn().mockReturnValue(false);
    const fetchMock = vi.fn();
    global.fetch = fetchMock as typeof fetch;

    render(<PageStatusActions projectId={PROJECT_ID} pageId={PAGE_ID} workflowStage="approved" />);
    fireEvent.click(screen.getByRole("button", { name: "Mark as Superseded" }));

    await waitFor(() => expect(window.confirm).toHaveBeenCalledTimes(1));
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("shows the backend's 409 conflict message when the atomic status write loses a race", async () => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: false,
      json: async () => ({
        success: false,
        error: {
          code: "ConflictException",
          message: `Page ${PAGE_ID} workflow stage changed concurrently (expected draft, now submitted) — reload and retry`,
        },
        correlationId: "corr-1",
      }),
    } as Response) as typeof fetch;

    render(<PageStatusActions projectId={PROJECT_ID} pageId={PAGE_ID} workflowStage="draft" />);
    fireEvent.click(screen.getByRole("button", { name: "Submit for Review" }));

    expect(await screen.findByRole("alert")).toHaveTextContent(/changed concurrently/);
    expect(refreshMock).not.toHaveBeenCalled();
  });

  it("renders the new stage's buttons immediately on success, without waiting on refresh", async () => {
    window.confirm = vi.fn();
    global.fetch = vi.fn().mockResolvedValue({ ok: true } as Response) as typeof fetch;

    render(<PageStatusActions projectId={PROJECT_ID} pageId={PAGE_ID} workflowStage="draft" />);
    fireEvent.click(screen.getByRole("button", { name: "Submit for Review" }));

    await waitFor(() => expect(refreshMock).toHaveBeenCalledTimes(1));
    expect(screen.getByRole("button", { name: "Start Review" })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Submit for Review" })).not.toBeInTheDocument();
  });

  it("renders nothing for a stage outside the known union, instead of throwing", () => {
    const unknownStage = "not_a_real_stage" as unknown as Parameters<
      typeof PageStatusActions
    >[0]["workflowStage"];
    const { container } = render(
      <PageStatusActions projectId={PROJECT_ID} pageId={PAGE_ID} workflowStage={unknownStage} />,
    );
    expect(container).toBeEmptyDOMElement();
  });
});
