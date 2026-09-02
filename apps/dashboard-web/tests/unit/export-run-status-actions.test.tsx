import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const refreshMock = vi.fn();

vi.mock("next/navigation", () => ({
  useRouter: () => ({ refresh: refreshMock }),
}));

import { ExportRunStatusActions } from "../../components/export-run-status-actions.js";

const EXPORT_RUN_ID = "33333333-3333-3333-3333-333333333333";
const STATUS_URL = `https://api.example.com/import-and-export-center/exports/${EXPORT_RUN_ID}/status`;

describe("ExportRunStatusActions", () => {
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

  it("requested: renders Mark as Processing and Cancel run", () => {
    render(<ExportRunStatusActions exportRunId={EXPORT_RUN_ID} status="requested" />);
    expect(screen.getByRole("button", { name: "Mark as Processing" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Cancel run" })).toBeInTheDocument();
    expect(screen.getAllByRole("button")).toHaveLength(2);
  });

  it("processing: renders all 3 outbound transitions", () => {
    render(<ExportRunStatusActions exportRunId={EXPORT_RUN_ID} status="processing" />);
    expect(screen.getByRole("button", { name: "Mark Completed" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Mark Failed" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Cancel run" })).toBeInTheDocument();
    expect(screen.getAllByRole("button")).toHaveLength(3);
  });

  it.each(["completed", "failed", "cancelled"] as const)(
    "%s: renders nothing — a terminal state with no outbound transition",
    (status) => {
      const { container } = render(
        <ExportRunStatusActions exportRunId={EXPORT_RUN_ID} status={status} />,
      );
      expect(container).toBeEmptyDOMElement();
    },
  );

  it("requested -> processing submits immediately with no extra data, no CAS field, then refreshes", async () => {
    const fetchMock = vi.fn().mockResolvedValue({ ok: true } as Response);
    global.fetch = fetchMock as typeof fetch;

    render(<ExportRunStatusActions exportRunId={EXPORT_RUN_ID} status="requested" />);
    fireEvent.click(screen.getByRole("button", { name: "Mark as Processing" }));

    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(1));
    expect(fetchMock).toHaveBeenCalledWith(
      STATUS_URL,
      expect.objectContaining({
        method: "POST",
        credentials: "include",
        body: JSON.stringify({ status: "processing" }),
      }),
    );
    await waitFor(() => expect(refreshMock).toHaveBeenCalledTimes(1));
  });

  it("processing -> completed opens an inline form for rowCount/fileReference, submits them when set", async () => {
    const fetchMock = vi.fn().mockResolvedValue({ ok: true } as Response);
    global.fetch = fetchMock as typeof fetch;

    render(<ExportRunStatusActions exportRunId={EXPORT_RUN_ID} status="processing" />);
    fireEvent.click(screen.getByRole("button", { name: "Mark Completed" }));
    expect(global.fetch).not.toHaveBeenCalled();

    fireEvent.change(screen.getByLabelText("Row count (optional)"), { target: { value: "42" } });
    fireEvent.change(screen.getByLabelText("File reference (optional)"), {
      target: { value: "s3://bucket/export.csv" },
    });
    fireEvent.click(screen.getByRole("button", { name: /Confirm/ }));

    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(1));
    expect(fetchMock).toHaveBeenCalledWith(
      STATUS_URL,
      expect.objectContaining({
        body: JSON.stringify({
          status: "completed",
          rowCount: 42,
          fileReference: "s3://bucket/export.csv",
        }),
      }),
    );
  });

  it("processing -> failed opens an inline error-summary form", async () => {
    const fetchMock = vi.fn().mockResolvedValue({ ok: true } as Response);
    global.fetch = fetchMock as typeof fetch;

    render(<ExportRunStatusActions exportRunId={EXPORT_RUN_ID} status="processing" />);
    fireEvent.click(screen.getByRole("button", { name: "Mark Failed" }));
    fireEvent.change(screen.getByLabelText("Error summary (optional)"), {
      target: { value: "Source module unavailable." },
    });
    fireEvent.click(screen.getByRole("button", { name: /Confirm/ }));

    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(1));
    expect(fetchMock).toHaveBeenCalledWith(
      STATUS_URL,
      expect.objectContaining({
        body: JSON.stringify({ status: "failed", errorSummary: "Source module unavailable." }),
      }),
    );
  });

  it("prompts a confirmation for Cancel run and does not submit when declined", () => {
    const confirmSpy = vi.fn().mockReturnValue(false);
    window.confirm = confirmSpy;
    global.fetch = vi.fn() as typeof fetch;

    render(<ExportRunStatusActions exportRunId={EXPORT_RUN_ID} status="requested" />);
    fireEvent.click(screen.getByRole("button", { name: "Cancel run" }));

    expect(confirmSpy).toHaveBeenCalledTimes(1);
    expect(global.fetch).not.toHaveBeenCalled();
  });

  it("never prompts a confirmation for Mark as Processing", async () => {
    const confirmSpy = vi.fn();
    window.confirm = confirmSpy;
    global.fetch = vi.fn().mockResolvedValue({ ok: true } as Response) as typeof fetch;

    render(<ExportRunStatusActions exportRunId={EXPORT_RUN_ID} status="requested" />);
    fireEvent.click(screen.getByRole("button", { name: "Mark as Processing" }));

    await waitFor(() => expect(refreshMock).toHaveBeenCalledTimes(1));
    expect(confirmSpy).not.toHaveBeenCalled();
  });
});
