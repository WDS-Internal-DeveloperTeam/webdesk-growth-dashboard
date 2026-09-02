import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const refreshMock = vi.fn();

vi.mock("next/navigation", () => ({
  useRouter: () => ({ refresh: refreshMock }),
}));

import { ReadyForClaudeTaskStatusActions } from "../../components/ready-for-claude-task-status-actions.js";

const TASK_ID = "11111111-1111-1111-1111-111111111111";

describe("ReadyForClaudeTaskStatusActions", () => {
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

  it("draft: renders Mark Ready for Claude and Cancel", () => {
    render(<ReadyForClaudeTaskStatusActions taskId={TASK_ID} status="draft" />);
    expect(screen.getByRole("button", { name: "Mark Ready for Claude" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Cancel" })).toBeInTheDocument();
    expect(screen.getAllByRole("button")).toHaveLength(2);
  });

  it("in_progress: renders Pause, Mark Failed, and Submit for Review", () => {
    render(<ReadyForClaudeTaskStatusActions taskId={TASK_ID} status="in_progress" />);
    expect(screen.getByRole("button", { name: "Pause" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Mark Failed" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Submit for Review" })).toBeInTheDocument();
    expect(screen.getAllByRole("button")).toHaveLength(3);
  });

  it("awaiting_review: renders Request Changes and Approve", () => {
    render(<ReadyForClaudeTaskStatusActions taskId={TASK_ID} status="awaiting_review" />);
    expect(screen.getByRole("button", { name: "Request Changes" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Approve" })).toBeInTheDocument();
    expect(screen.getAllByRole("button")).toHaveLength(2);
  });

  it("approved: renders only Complete", () => {
    render(<ReadyForClaudeTaskStatusActions taskId={TASK_ID} status="approved" />);
    expect(screen.getByRole("button", { name: "Complete" })).toBeInTheDocument();
    expect(screen.getAllByRole("button")).toHaveLength(1);
  });

  it.each(["completed", "cancelled", "failed"] as const)(
    "%s: renders nothing — a terminal state with no outbound transition",
    (status) => {
      const { container } = render(
        <ReadyForClaudeTaskStatusActions taskId={TASK_ID} status={status} />,
      );
      expect(container).toBeEmptyDOMElement();
    },
  );

  it("posts BOTH status and expectedStatus to the status route, then refreshes", async () => {
    const fetchMock = vi.fn().mockResolvedValue({ ok: true } as Response);
    global.fetch = fetchMock as typeof fetch;

    render(<ReadyForClaudeTaskStatusActions taskId={TASK_ID} status="draft" />);
    fireEvent.click(screen.getByRole("button", { name: "Mark Ready for Claude" }));

    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(1));
    expect(fetchMock).toHaveBeenCalledWith(
      `https://api.example.com/ready-for-claude-queue/tasks/${TASK_ID}/status`,
      expect.objectContaining({
        method: "POST",
        credentials: "include",
        body: JSON.stringify({ status: "ready_for_claude", expectedStatus: "draft" }),
      }),
    );
    await waitFor(() => expect(refreshMock).toHaveBeenCalledTimes(1));
  });

  it("prompts a confirmation only for Cancel, the one destructive transition", async () => {
    const confirmSpy = vi.fn().mockReturnValue(true);
    window.confirm = confirmSpy;
    global.fetch = vi.fn().mockResolvedValue({ ok: true } as Response) as typeof fetch;

    render(<ReadyForClaudeTaskStatusActions taskId={TASK_ID} status="draft" />);
    fireEvent.click(screen.getByRole("button", { name: "Cancel" }));

    expect(confirmSpy).toHaveBeenCalledTimes(1);
    await waitFor(() => expect(refreshMock).toHaveBeenCalledTimes(1));
  });

  it("never prompts a confirmation for a non-Cancel transition", async () => {
    const confirmSpy = vi.fn();
    window.confirm = confirmSpy;
    global.fetch = vi.fn().mockResolvedValue({ ok: true } as Response) as typeof fetch;

    render(<ReadyForClaudeTaskStatusActions taskId={TASK_ID} status="draft" />);
    fireEvent.click(screen.getByRole("button", { name: "Mark Ready for Claude" }));

    await waitFor(() => expect(refreshMock).toHaveBeenCalledTimes(1));
    expect(confirmSpy).not.toHaveBeenCalled();
  });

  it("does not submit the Cancel transition when the confirmation is declined", async () => {
    window.confirm = vi.fn().mockReturnValue(false);
    const fetchMock = vi.fn().mockResolvedValue({ ok: true } as Response);
    global.fetch = fetchMock as typeof fetch;

    render(<ReadyForClaudeTaskStatusActions taskId={TASK_ID} status="draft" />);
    fireEvent.click(screen.getByRole("button", { name: "Cancel" }));

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
          message: `Ready for Claude task ${TASK_ID} status changed concurrently while editing — reload and retry`,
        },
        correlationId: "corr-1",
      }),
    } as Response) as typeof fetch;

    render(<ReadyForClaudeTaskStatusActions taskId={TASK_ID} status="draft" />);
    fireEvent.click(screen.getByRole("button", { name: "Mark Ready for Claude" }));

    expect(await screen.findByRole("alert")).toHaveTextContent(/changed concurrently/);
    expect(refreshMock).not.toHaveBeenCalled();
  });

  it("renders the new status's buttons immediately on success, without waiting on refresh", async () => {
    global.fetch = vi.fn().mockResolvedValue({ ok: true } as Response) as typeof fetch;

    render(<ReadyForClaudeTaskStatusActions taskId={TASK_ID} status="awaiting_review" />);
    fireEvent.click(screen.getByRole("button", { name: "Approve" }));

    await waitFor(() => expect(refreshMock).toHaveBeenCalledTimes(1));
    expect(screen.getByRole("button", { name: "Complete" })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Approve" })).not.toBeInTheDocument();
  });

  it("logs and shows a generic error, without refreshing, when the fetch call itself throws", async () => {
    const consoleErrorSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    global.fetch = vi.fn().mockRejectedValue(new Error("network down")) as typeof fetch;

    render(<ReadyForClaudeTaskStatusActions taskId={TASK_ID} status="draft" />);
    fireEvent.click(screen.getByRole("button", { name: "Mark Ready for Claude" }));

    expect(await screen.findByRole("alert")).toHaveTextContent(
      "Something went wrong. Please try again.",
    );
    expect(refreshMock).not.toHaveBeenCalled();
    expect(consoleErrorSpy).toHaveBeenCalled();
    consoleErrorSpy.mockRestore();
  });

  it("renders nothing for a status outside the known union, instead of throwing", () => {
    const unknownStatus = "not_a_real_status" as unknown as Parameters<
      typeof ReadyForClaudeTaskStatusActions
    >[0]["status"];
    const { container } = render(
      <ReadyForClaudeTaskStatusActions taskId={TASK_ID} status={unknownStatus} />,
    );
    expect(container).toBeEmptyDOMElement();
  });
});
