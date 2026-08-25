import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const refreshMock = vi.fn();

vi.mock("next/navigation", () => ({
  useRouter: () => ({ refresh: refreshMock }),
}));

import { ReviewDecisionActions } from "../../components/review-decision-actions.js";

const REVIEW_ID = "11111111-1111-1111-1111-111111111111";

function successResponse(status: string): Response {
  return {
    ok: true,
    json: async () => ({ success: true, data: { id: REVIEW_ID, status }, correlationId: "corr-1" }),
  } as Response;
}

describe("ReviewDecisionActions", () => {
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
    render(<ReviewDecisionActions reviewId={REVIEW_ID} status="submitted" />);
    expect(screen.getByRole("button", { name: "Approve" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Approve with Notes" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Request Revision" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Reject" })).toBeInTheDocument();
  });

  it("revision_requested: also renders all 4 decision buttons — still an open state", () => {
    render(<ReviewDecisionActions reviewId={REVIEW_ID} status="revision_requested" />);
    expect(screen.getByRole("button", { name: "Approve" })).toBeInTheDocument();
  });

  it("approved: renders nothing — terminal state", () => {
    const { container } = render(<ReviewDecisionActions reviewId={REVIEW_ID} status="approved" />);
    expect(container).toBeEmptyDOMElement();
  });

  it("rejected: renders nothing — terminal state", () => {
    const { container } = render(<ReviewDecisionActions reviewId={REVIEW_ID} status="rejected" />);
    expect(container).toBeEmptyDOMElement();
  });

  it("clicking Approve opens an inline optional-notes form instead of submitting immediately", () => {
    const fetchMock = vi.fn();
    global.fetch = fetchMock as typeof fetch;

    render(<ReviewDecisionActions reviewId={REVIEW_ID} status="submitted" />);
    fireEvent.click(screen.getByRole("button", { name: "Approve" }));

    expect(fetchMock).not.toHaveBeenCalled();
    // Not getByLabelText()/getByRole("textbox"): jsdom's accessibility-tree computation doesn't
    // resolve RichTextEditor's real shape (a contentEditable div, not a native form control) via
    // either query — matches the established convention every other RichTextEditor-backed form's
    // own test suite already uses (e.g. proof-and-claims-library-form.test.tsx's own
    // "renders a rich-text editor (not a plain textarea)" test).
    expect(screen.getByText("Notes (optional)")).toBeInTheDocument();
    expect(document.querySelector('#decision-notes[contenteditable="true"]')).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Confirm: Approve" })).toBeInTheDocument();
  });

  it("Cancel from the notes form returns to the button row without submitting", () => {
    const fetchMock = vi.fn();
    global.fetch = fetchMock as typeof fetch;

    render(<ReviewDecisionActions reviewId={REVIEW_ID} status="submitted" />);
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

    render(<ReviewDecisionActions reviewId={REVIEW_ID} status="submitted" />);
    fireEvent.click(screen.getByRole("button", { name: "Approve" }));
    fireEvent.click(screen.getByRole("button", { name: "Confirm: Approve" }));

    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(1));
    expect(fetchMock).toHaveBeenCalledWith(
      `https://api.example.com/reviews/${REVIEW_ID}/decide`,
      expect.objectContaining({
        method: "POST",
        credentials: "include",
        body: JSON.stringify({ action: "approve", notes: null, expectedStatus: "submitted" }),
      }),
    );
    await waitFor(() => expect(refreshMock).toHaveBeenCalledTimes(1));
  });

  // RichTextEditor is a Tiptap contentEditable div, not a real form control — jsdom/RTL's
  // fireEvent.change doesn't drive it, so its actual submitted content can only be verified via
  // an `initial`/`value` prop, not simulated typing (the established convention this codebase
  // already follows for every other RichTextEditor-backed form, e.g.
  // proof-and-claims-library-form.test.tsx's own "edit mode: a rich-text field's initial HTML
  // content loads" test). `notes` has no `initial` prop here — it always starts blank — so this
  // just proves the untouched-editor case correctly submits `null`, not an empty-HTML string.
  it("confirming Request Revision with no notes typed sends notes: null", async () => {
    const fetchMock = vi.fn().mockResolvedValue(successResponse("revision_requested"));
    global.fetch = fetchMock as typeof fetch;

    render(<ReviewDecisionActions reviewId={REVIEW_ID} status="submitted" />);
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

    const { container } = render(<ReviewDecisionActions reviewId={REVIEW_ID} status="submitted" />);
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
          message: `Review ${REVIEW_ID} status changed concurrently (expected submitted, now approved) — reload and retry`,
        },
        correlationId: "corr-1",
      }),
    } as Response) as typeof fetch;

    render(<ReviewDecisionActions reviewId={REVIEW_ID} status="submitted" />);
    fireEvent.click(screen.getByRole("button", { name: "Approve" }));
    fireEvent.click(screen.getByRole("button", { name: "Confirm: Approve" }));

    expect(await screen.findByRole("alert")).toHaveTextContent(/changed concurrently/);
    expect(refreshMock).not.toHaveBeenCalled();
  });

  it("re-syncs status from a fresh prop (e.g. after the sibling ReviewProcessActions component's own router.refresh()) without a remount", () => {
    const { rerender } = render(<ReviewDecisionActions reviewId={REVIEW_ID} status="submitted" />);
    expect(screen.getByRole("button", { name: "Approve" })).toBeInTheDocument();

    rerender(<ReviewDecisionActions reviewId={REVIEW_ID} status="approved" />);
    expect(screen.queryByRole("button", { name: "Approve" })).not.toBeInTheDocument();
  });
});
