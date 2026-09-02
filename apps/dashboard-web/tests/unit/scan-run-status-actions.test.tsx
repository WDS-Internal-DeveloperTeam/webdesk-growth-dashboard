import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const refreshMock = vi.fn();

vi.mock("next/navigation", () => ({
  useRouter: () => ({ refresh: refreshMock }),
}));

import { ScanRunStatusActions } from "../../components/scan-run-status-actions.js";

const PROJECT_ID = "11111111-1111-1111-1111-111111111111";
const RUN_ID = "22222222-2222-2222-2222-222222222222";
const STATUS_URL = `https://api.example.com/scan-center/projects/${PROJECT_ID}/runs/${RUN_ID}/status`;

describe("ScanRunStatusActions", () => {
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

  it("requested: renders Queue and Cancel run", () => {
    render(<ScanRunStatusActions projectId={PROJECT_ID} runId={RUN_ID} status="requested" />);
    expect(screen.getByRole("button", { name: "Queue" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Cancel run" })).toBeInTheDocument();
    expect(screen.getAllByRole("button")).toHaveLength(2);
  });

  it("running: renders all 5 outbound transitions", () => {
    render(<ScanRunStatusActions projectId={PROJECT_ID} runId={RUN_ID} status="running" />);
    expect(screen.getByRole("button", { name: "Mark Completed" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Mark Partially Completed" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Mark Failed" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Mark Timed Out" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Cancel run" })).toBeInTheDocument();
    expect(screen.getAllByRole("button")).toHaveLength(5);
  });

  it.each(["completed", "partially_completed", "failed", "timed_out", "cancelled"] as const)(
    "%s: renders nothing — a terminal state with no outbound transition",
    (status) => {
      const { container } = render(
        <ScanRunStatusActions projectId={PROJECT_ID} runId={RUN_ID} status={status} />,
      );
      expect(container).toBeEmptyDOMElement();
    },
  );

  it("queued -> running submits immediately with no extra data, then refreshes", async () => {
    const fetchMock = vi.fn().mockResolvedValue({ ok: true } as Response);
    global.fetch = fetchMock as typeof fetch;

    render(<ScanRunStatusActions projectId={PROJECT_ID} runId={RUN_ID} status="queued" />);
    fireEvent.click(screen.getByRole("button", { name: "Mark as Running" }));

    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(1));
    expect(fetchMock).toHaveBeenCalledWith(
      STATUS_URL,
      expect.objectContaining({
        method: "POST",
        credentials: "include",
        body: JSON.stringify({ status: "running" }),
      }),
    );
    await waitFor(() => expect(refreshMock).toHaveBeenCalledTimes(1));
    expect(screen.getByRole("button", { name: "Mark Completed" })).toBeInTheDocument();
  });

  it("never prompts a confirmation for a non-Cancel transition", async () => {
    const confirmSpy = vi.fn();
    window.confirm = confirmSpy;
    global.fetch = vi.fn().mockResolvedValue({ ok: true } as Response) as typeof fetch;

    render(<ScanRunStatusActions projectId={PROJECT_ID} runId={RUN_ID} status="requested" />);
    fireEvent.click(screen.getByRole("button", { name: "Queue" }));

    await waitFor(() => expect(refreshMock).toHaveBeenCalledTimes(1));
    expect(confirmSpy).not.toHaveBeenCalled();
  });

  it("does not submit the Cancel run transition when the confirmation is declined", () => {
    window.confirm = vi.fn().mockReturnValue(false);
    const fetchMock = vi.fn();
    global.fetch = fetchMock as typeof fetch;

    render(<ScanRunStatusActions projectId={PROJECT_ID} runId={RUN_ID} status="requested" />);
    fireEvent.click(screen.getByRole("button", { name: "Cancel run" }));

    expect(window.confirm).toHaveBeenCalledTimes(1);
    expect(fetchMock).not.toHaveBeenCalled();
    expect(refreshMock).not.toHaveBeenCalled();
  });

  it("failed: opens an inline form with an optional error summary, and includes it only if non-empty", async () => {
    const fetchMock = vi.fn().mockResolvedValue({ ok: true } as Response);
    global.fetch = fetchMock as typeof fetch;

    render(<ScanRunStatusActions projectId={PROJECT_ID} runId={RUN_ID} status="running" />);
    fireEvent.click(screen.getByRole("button", { name: "Mark Failed" }));

    expect(screen.queryByRole("button", { name: "Mark Completed" })).not.toBeInTheDocument();
    fireEvent.change(screen.getByLabelText("Error summary (optional)"), {
      target: { value: "Timeout connecting to the target host" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Confirm: Mark Failed" }));

    await waitFor(() =>
      expect(fetchMock).toHaveBeenCalledWith(
        STATUS_URL,
        expect.objectContaining({
          body: JSON.stringify({
            status: "failed",
            errorSummary: "Timeout connecting to the target host",
          }),
        }),
      ),
    );
    await waitFor(() => expect(refreshMock).toHaveBeenCalledTimes(1));
  });

  it("failed: omits errorSummary entirely when left blank", async () => {
    const fetchMock = vi.fn().mockResolvedValue({ ok: true } as Response);
    global.fetch = fetchMock as typeof fetch;

    render(<ScanRunStatusActions projectId={PROJECT_ID} runId={RUN_ID} status="running" />);
    fireEvent.click(screen.getByRole("button", { name: "Mark Failed" }));
    fireEvent.click(screen.getByRole("button", { name: "Confirm: Mark Failed" }));

    await waitFor(() =>
      expect(fetchMock).toHaveBeenCalledWith(
        STATUS_URL,
        expect.objectContaining({ body: JSON.stringify({ status: "failed" }) }),
      ),
    );
  });

  it("completed: opens a findings editor, drops rows with a blank title, and sends the rest", async () => {
    const fetchMock = vi.fn().mockResolvedValue({ ok: true } as Response);
    global.fetch = fetchMock as typeof fetch;

    render(<ScanRunStatusActions projectId={PROJECT_ID} runId={RUN_ID} status="running" />);
    fireEvent.click(screen.getByRole("button", { name: "Mark Completed" }));

    // No error-summary field for this target.
    expect(screen.queryByLabelText("Error summary (optional)")).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Add another finding" }));
    const titleInputs = screen.getAllByLabelText("Title");
    expect(titleInputs).toHaveLength(2);
    fireEvent.change(titleInputs[0]!, { target: { value: "Missing alt text" } });
    // Second row's title is left blank — should be dropped from the payload.

    fireEvent.click(screen.getByRole("button", { name: "Confirm: Mark Completed" }));

    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(1));
    const [, options] = fetchMock.mock.calls[0] as [string, RequestInit];
    const body = JSON.parse(options.body as string) as {
      status: string;
      findings?: readonly { title: string }[];
    };
    expect(body.status).toBe("completed");
    expect(body.findings).toHaveLength(1);
    expect(body.findings?.[0]?.title).toBe("Missing alt text");
  });

  it("completed: omits findings entirely when every row's title is blank", async () => {
    const fetchMock = vi.fn().mockResolvedValue({ ok: true } as Response);
    global.fetch = fetchMock as typeof fetch;

    render(<ScanRunStatusActions projectId={PROJECT_ID} runId={RUN_ID} status="running" />);
    fireEvent.click(screen.getByRole("button", { name: "Mark Completed" }));
    fireEvent.click(screen.getByRole("button", { name: "Confirm: Mark Completed" }));

    await waitFor(() =>
      expect(fetchMock).toHaveBeenCalledWith(
        STATUS_URL,
        expect.objectContaining({ body: JSON.stringify({ status: "completed" }) }),
      ),
    );
  });

  it("cancel button on the inline form aborts without submitting", () => {
    const fetchMock = vi.fn();
    global.fetch = fetchMock as typeof fetch;

    render(<ScanRunStatusActions projectId={PROJECT_ID} runId={RUN_ID} status="running" />);
    fireEvent.click(screen.getByRole("button", { name: "Mark Failed" }));
    fireEvent.click(screen.getByRole("button", { name: "Cancel" }));

    expect(screen.getByRole("button", { name: "Mark Failed" })).toBeInTheDocument();
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("shows the backend's 409 conflict message on a lost race", async () => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: false,
      json: async () => ({
        success: false,
        error: {
          code: "ConflictException",
          message: `Scan run ${RUN_ID} status changed concurrently (expected requested, now queued) — reload and retry`,
        },
        correlationId: "corr-1",
      }),
    } as Response) as typeof fetch;

    render(<ScanRunStatusActions projectId={PROJECT_ID} runId={RUN_ID} status="requested" />);
    fireEvent.click(screen.getByRole("button", { name: "Queue" }));

    expect(await screen.findByRole("alert")).toHaveTextContent(/changed concurrently/);
    expect(refreshMock).not.toHaveBeenCalled();
  });

  it("logs and shows a generic error, without refreshing, when the fetch call itself throws", async () => {
    const consoleErrorSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    global.fetch = vi.fn().mockRejectedValue(new Error("network down")) as typeof fetch;

    render(<ScanRunStatusActions projectId={PROJECT_ID} runId={RUN_ID} status="requested" />);
    fireEvent.click(screen.getByRole("button", { name: "Queue" }));

    expect(await screen.findByRole("alert")).toHaveTextContent(
      "Something went wrong. Please try again.",
    );
    expect(refreshMock).not.toHaveBeenCalled();
    expect(consoleErrorSpy).toHaveBeenCalled();
  });

  it("renders nothing for a status outside the known union, instead of throwing", () => {
    const unknownStatus = "not_a_real_status" as unknown as Parameters<
      typeof ScanRunStatusActions
    >[0]["status"];
    const { container } = render(
      <ScanRunStatusActions projectId={PROJECT_ID} runId={RUN_ID} status={unknownStatus} />,
    );
    expect(container).toBeEmptyDOMElement();
  });
});
