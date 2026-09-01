import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const refreshMock = vi.fn();

vi.mock("next/navigation", () => ({
  useRouter: () => ({ refresh: refreshMock }),
}));

import { CaseStudyStatusActions } from "../../components/case-study-status-actions.js";

const CASE_STUDY_ID = "11111111-1111-1111-1111-111111111111";

describe("CaseStudyStatusActions", () => {
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

  it("intake: renders Move to Upload and Archive", () => {
    render(
      <CaseStudyStatusActions
        caseStudyId={CASE_STUDY_ID}
        status="intake"
        clientApprovalRequired={false}
      />,
    );
    expect(screen.getByRole("button", { name: "Move to Upload" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Archive" })).toBeInTheDocument();
  });

  it("archived: renders nothing — archived is the module's only terminal state", () => {
    const { container } = render(
      <CaseStudyStatusActions
        caseStudyId={CASE_STUDY_ID}
        status="archived"
        clientApprovalRequired={false}
      />,
    );
    expect(container).toBeEmptyDOMElement();
  });

  it("internal_approval + clientApprovalRequired=false: offers Schedule, not Send to Client Approval", () => {
    render(
      <CaseStudyStatusActions
        caseStudyId={CASE_STUDY_ID}
        status="internal_approval"
        clientApprovalRequired={false}
      />,
    );
    expect(screen.getByRole("button", { name: "Schedule" })).toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: "Send to Client Approval" }),
    ).not.toBeInTheDocument();
  });

  it("internal_approval + clientApprovalRequired=true: offers Send to Client Approval, not Schedule", () => {
    render(
      <CaseStudyStatusActions
        caseStudyId={CASE_STUDY_ID}
        status="internal_approval"
        clientApprovalRequired={true}
      />,
    );
    expect(screen.getByRole("button", { name: "Send to Client Approval" })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Schedule" })).not.toBeInTheDocument();
  });

  it("published: the Unpublish button stays disabled until a reason is typed, then submits it", async () => {
    const fetchMock = vi.fn().mockResolvedValue({ ok: true } as Response);
    global.fetch = fetchMock as typeof fetch;

    render(
      <CaseStudyStatusActions
        caseStudyId={CASE_STUDY_ID}
        status="published"
        clientApprovalRequired={false}
      />,
    );
    const unpublishButton = screen.getByRole("button", { name: "Unpublish" });
    expect(unpublishButton).toBeDisabled();

    fireEvent.change(screen.getByLabelText(/Unpublish reason/), {
      target: { value: "Client requested a temporary takedown" },
    });
    expect(unpublishButton).not.toBeDisabled();

    fireEvent.click(unpublishButton);

    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(1));
    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toBe(
      `https://api.example.com/case-study-studio/case-studies/${CASE_STUDY_ID}/status`,
    );
    const body = JSON.parse(init.body as string);
    expect(body.status).toBe("unpublished");
    expect(body.unpublishReason).toBe("Client requested a temporary takedown");
    await waitFor(() => expect(refreshMock).toHaveBeenCalledTimes(1));
  });

  it("scheduled: no unpublish-reason field renders — it's not a reachable target from here", () => {
    render(
      <CaseStudyStatusActions
        caseStudyId={CASE_STUDY_ID}
        status="scheduled"
        clientApprovalRequired={false}
      />,
    );
    expect(screen.queryByLabelText(/Unpublish reason/)).not.toBeInTheDocument();
  });

  it("Archive: asks for confirmation first, and does nothing if the user cancels", async () => {
    window.confirm = vi.fn().mockReturnValue(false);
    const fetchMock = vi.fn();
    global.fetch = fetchMock as typeof fetch;

    render(
      <CaseStudyStatusActions
        caseStudyId={CASE_STUDY_ID}
        status="intake"
        clientApprovalRequired={false}
      />,
    );
    fireEvent.click(screen.getByRole("button", { name: "Archive" }));

    await waitFor(() => expect(window.confirm).toHaveBeenCalledTimes(1));
    expect(fetchMock).not.toHaveBeenCalled();
    expect(refreshMock).not.toHaveBeenCalled();
  });

  it("Move to Upload: posts {status: upload} with no confirmation prompt, then refreshes", async () => {
    const confirmSpy = vi.fn();
    window.confirm = confirmSpy;
    const fetchMock = vi.fn().mockResolvedValue({ ok: true } as Response);
    global.fetch = fetchMock as typeof fetch;

    render(
      <CaseStudyStatusActions
        caseStudyId={CASE_STUDY_ID}
        status="intake"
        clientApprovalRequired={false}
      />,
    );
    fireEvent.click(screen.getByRole("button", { name: "Move to Upload" }));

    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(1));
    expect(confirmSpy).not.toHaveBeenCalled();
    const [, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    const body = JSON.parse(init.body as string);
    expect(body).toEqual({ status: "upload", notes: null, unpublishReason: null });
    await waitFor(() => expect(refreshMock).toHaveBeenCalledTimes(1));
  });

  it("renders the new status's buttons immediately on success, without waiting on refresh", async () => {
    window.confirm = vi.fn();
    global.fetch = vi.fn().mockResolvedValue({ ok: true } as Response) as typeof fetch;

    render(
      <CaseStudyStatusActions
        caseStudyId={CASE_STUDY_ID}
        status="intake"
        clientApprovalRequired={false}
      />,
    );
    fireEvent.click(screen.getByRole("button", { name: "Move to Upload" }));

    await waitFor(() => expect(refreshMock).toHaveBeenCalledTimes(1));
    expect(
      screen.getByRole("button", { name: "Submit for Completeness Review" }),
    ).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Move to Upload" })).not.toBeInTheDocument();
  });

  it("shows the backend's 409 conflict message when the atomic status write loses a race", async () => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: false,
      json: async () => ({
        success: false,
        error: {
          code: "ConflictException",
          message: `Case study ${CASE_STUDY_ID} status changed concurrently (expected intake, now upload) — reload and retry`,
        },
        correlationId: "corr-1",
      }),
    } as Response) as typeof fetch;

    render(
      <CaseStudyStatusActions
        caseStudyId={CASE_STUDY_ID}
        status="intake"
        clientApprovalRequired={false}
      />,
    );
    fireEvent.click(screen.getByRole("button", { name: "Move to Upload" }));

    expect(await screen.findByRole("alert")).toHaveTextContent(/changed concurrently/);
    expect(refreshMock).not.toHaveBeenCalled();
  });

  it("includes a typed notes value (as HTML) in the submitted body", async () => {
    const fetchMock = vi.fn().mockResolvedValue({ ok: true } as Response);
    global.fetch = fetchMock as typeof fetch;

    render(
      <CaseStudyStatusActions
        caseStudyId={CASE_STUDY_ID}
        status="intake"
        clientApprovalRequired={false}
      />,
    );
    // RichTextEditor is a Tiptap contentEditable div, not a real form control — jsdom/RTL's
    // fireEvent doesn't drive Tiptap's own ProseMirror editing view, so notes content can't be
    // typed in via simulated events here (the same lesson every other rich-text-editor consumer's
    // own tests already document). This test only verifies the no-notes-typed case sends `null`.
    fireEvent.click(screen.getByRole("button", { name: "Move to Upload" }));

    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(1));
    const [, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    const body = JSON.parse(init.body as string);
    expect(body.notes).toBeNull();
  });
});
