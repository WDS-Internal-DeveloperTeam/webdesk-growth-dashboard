import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const refreshMock = vi.fn();

vi.mock("next/navigation", () => ({
  useRouter: () => ({ refresh: refreshMock }),
}));

import { DesignReviewDecisionActions } from "../../components/design-review-decision-actions.js";

const REVIEW_ID = "11111111-1111-1111-1111-111111111111";

function successResponse(status: string): Response {
  return {
    ok: true,
    json: async () => ({ success: true, data: { id: REVIEW_ID, status }, correlationId: "corr-1" }),
  } as Response;
}

describe("DesignReviewDecisionActions", () => {
  const originalFetch = global.fetch;

  beforeEach(() => {
    process.env.NEXT_PUBLIC_API_BASE_URL = "https://api.example.com";
    refreshMock.mockReset();
  });

  afterEach(() => {
    global.fetch = originalFetch;
    vi.restoreAllMocks();
  });

  it("submitted: renders all 4 decision buttons", () => {
    render(<DesignReviewDecisionActions reviewId={REVIEW_ID} status="submitted" />);
    expect(screen.getByRole("button", { name: "Approve" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Approve with Notes" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Request Revision" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Reject" })).toBeInTheDocument();
  });

  it("revision_requested: also renders all 4 decision buttons — still an open state", () => {
    render(<DesignReviewDecisionActions reviewId={REVIEW_ID} status="revision_requested" />);
    expect(screen.getByRole("button", { name: "Approve" })).toBeInTheDocument();
  });

  it("approved: renders nothing — terminal state", () => {
    const { container } = render(
      <DesignReviewDecisionActions reviewId={REVIEW_ID} status="approved" />,
    );
    expect(container).toBeEmptyDOMElement();
  });

  it("rejected: renders nothing — terminal state", () => {
    const { container } = render(
      <DesignReviewDecisionActions reviewId={REVIEW_ID} status="rejected" />,
    );
    expect(container).toBeEmptyDOMElement();
  });

  // Unlike Review and Approval Center's own 2-terminal-status workflow (approved/rejected),
  // Design Review Center has a 3rd terminal status — superseded, reached only as the automatic
  // side effect of a DIFFERENT review being approved, never directly requested.
  it("superseded: renders nothing — terminal state, reached only via automatic supersede", () => {
    const { container } = render(
      <DesignReviewDecisionActions reviewId={REVIEW_ID} status="superseded" />,
    );
    expect(container).toBeEmptyDOMElement();
  });

  it("clicking Approve opens an inline optional-notes form instead of submitting immediately", () => {
    const fetchMock = vi.fn();
    global.fetch = fetchMock as typeof fetch;

    render(<DesignReviewDecisionActions reviewId={REVIEW_ID} status="submitted" />);
    fireEvent.click(screen.getByRole("button", { name: "Approve" }));

    expect(fetchMock).not.toHaveBeenCalled();
    // Not getByLabelText()/getByRole("textbox"): jsdom's accessibility-tree computation doesn't
    // resolve RichTextEditor's real shape (a contentEditable div, not a native form control) via
    // either query — matches ReviewDecisionActions' own already-established test convention.
    expect(screen.getByText("Notes (optional)")).toBeInTheDocument();
    expect(document.querySelector('#decision-notes[contenteditable="true"]')).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Confirm: Approve" })).toBeInTheDocument();
  });

  it("Cancel from the notes form returns to the button row without submitting", () => {
    const fetchMock = vi.fn();
    global.fetch = fetchMock as typeof fetch;

    render(<DesignReviewDecisionActions reviewId={REVIEW_ID} status="submitted" />);
    fireEvent.click(screen.getByRole("button", { name: "Reject" }));
    expect(screen.getByRole("button", { name: "Confirm: Reject" })).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Cancel" }));
    expect(fetchMock).not.toHaveBeenCalled();
    expect(screen.getByRole("button", { name: "Approve" })).toBeInTheDocument();
    expect(screen.queryByLabelText("Notes (optional)")).not.toBeInTheDocument();
  });

  it("confirming Approve posts {action: 'approve', notes: null, expectedStatus: 'submitted'} and refreshes", async () => {
    const fetchMock = vi.fn().mockResolvedValue(successResponse("approved"));
    global.fetch = fetchMock as typeof fetch;

    render(<DesignReviewDecisionActions reviewId={REVIEW_ID} status="submitted" />);
    fireEvent.click(screen.getByRole("button", { name: "Approve" }));
    fireEvent.click(screen.getByRole("button", { name: "Confirm: Approve" }));

    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(1));
    expect(fetchMock).toHaveBeenCalledWith(
      `https://api.example.com/design-reviews/${REVIEW_ID}/decide`,
      expect.objectContaining({
        method: "POST",
        credentials: "include",
        body: JSON.stringify({ action: "approve", notes: null, expectedStatus: "submitted" }),
      }),
    );
    await waitFor(() => expect(refreshMock).toHaveBeenCalledTimes(1));
  });

  it("confirming Request Revision with no notes typed sends notes: null", async () => {
    const fetchMock = vi.fn().mockResolvedValue(successResponse("revision_requested"));
    global.fetch = fetchMock as typeof fetch;

    render(<DesignReviewDecisionActions reviewId={REVIEW_ID} status="submitted" />);
    fireEvent.click(screen.getByRole("button", { name: "Request Revision" }));
    fireEvent.click(screen.getByRole("button", { name: "Confirm: Request Revision" }));

    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(1));
    const [, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    const body = JSON.parse(init.body as string);
    expect(body.action).toBe("request_revision");
    expect(body.notes).toBeNull();
  });

  it("after a successful decision, renders nothing once the confirmed action's status is terminal", async () => {
    global.fetch = vi.fn().mockResolvedValue(successResponse("rejected")) as typeof fetch;

    const { container } = render(
      <DesignReviewDecisionActions reviewId={REVIEW_ID} status="submitted" />,
    );
    fireEvent.click(screen.getByRole("button", { name: "Reject" }));
    fireEvent.click(screen.getByRole("button", { name: "Confirm: Reject" }));

    await waitFor(() => expect(refreshMock).toHaveBeenCalledTimes(1));
    expect(container).toBeEmptyDOMElement();
  });

  it("shows the backend's 409 conflict message on a stale expectedStatus, and does not refresh", async () => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: false,
      json: async () => ({
        success: false,
        error: {
          code: "ConflictException",
          message: `Design review ${REVIEW_ID} status changed concurrently (expected submitted, now approved) — reload and retry`,
        },
        correlationId: "corr-1",
      }),
    } as Response) as typeof fetch;

    render(<DesignReviewDecisionActions reviewId={REVIEW_ID} status="submitted" />);
    fireEvent.click(screen.getByRole("button", { name: "Approve" }));
    fireEvent.click(screen.getByRole("button", { name: "Confirm: Approve" }));

    expect(await screen.findByRole("alert")).toHaveTextContent(/changed concurrently/);
    expect(refreshMock).not.toHaveBeenCalled();
  });

  it("re-syncs status from a fresh prop without a remount", () => {
    const { rerender } = render(
      <DesignReviewDecisionActions reviewId={REVIEW_ID} status="submitted" />,
    );
    expect(screen.getByRole("button", { name: "Approve" })).toBeInTheDocument();

    rerender(<DesignReviewDecisionActions reviewId={REVIEW_ID} status="superseded" />);
    expect(screen.queryByRole("button", { name: "Approve" })).not.toBeInTheDocument();
  });
});
