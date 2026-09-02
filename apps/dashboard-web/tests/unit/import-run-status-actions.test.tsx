import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const refreshMock = vi.fn();

vi.mock("next/navigation", () => ({
  useRouter: () => ({ refresh: refreshMock }),
}));

import {
  ImportRunStatusActions,
  importRunAllowedTargets,
} from "../../components/import-run-status-actions.js";

const RUN_ID = "22222222-2222-2222-2222-222222222222";
const STATUS_URL = `https://api.example.com/import-and-export-center/runs/${RUN_ID}/status`;

describe("importRunAllowedTargets", () => {
  it("draft: submitted or cancelled, regardless of isDryRun", () => {
    expect(importRunAllowedTargets("draft", true)).toEqual(["submitted", "cancelled"]);
    expect(importRunAllowedTargets("draft", false)).toEqual(["submitted", "cancelled"]);
  });

  it("submitted: approved, rejected, or cancelled", () => {
    expect(importRunAllowedTargets("submitted", true)).toEqual([
      "approved",
      "rejected",
      "cancelled",
    ]);
  });

  it("approved: validating or cancelled", () => {
    expect(importRunAllowedTargets("approved", false)).toEqual(["validating", "cancelled"]);
  });

  it("validating + isDryRun=true: dry_run_completed, failed, or cancelled — never importing directly", () => {
    expect(importRunAllowedTargets("validating", true)).toEqual([
      "dry_run_completed",
      "failed",
      "cancelled",
    ]);
  });

  it("validating + isDryRun=false: importing, failed, or cancelled — never dry_run_completed", () => {
    expect(importRunAllowedTargets("validating", false)).toEqual([
      "importing",
      "failed",
      "cancelled",
    ]);
  });

  it("dry_run_completed: only importing (the promote transition), regardless of isDryRun", () => {
    expect(importRunAllowedTargets("dry_run_completed", true)).toEqual(["importing"]);
    expect(importRunAllowedTargets("dry_run_completed", false)).toEqual(["importing"]);
  });

  it("importing: completed, partially_completed, failed, or cancelled", () => {
    expect(importRunAllowedTargets("importing", false)).toEqual([
      "completed",
      "partially_completed",
      "failed",
      "cancelled",
    ]);
  });

  it("completed/partially_completed: only rolled_back", () => {
    expect(importRunAllowedTargets("completed", false)).toEqual(["rolled_back"]);
    expect(importRunAllowedTargets("partially_completed", false)).toEqual(["rolled_back"]);
  });

  it.each(["failed", "cancelled", "rejected", "rolled_back"] as const)(
    "%s: no outbound transitions — terminal",
    (status) => {
      expect(importRunAllowedTargets(status, true)).toEqual([]);
      expect(importRunAllowedTargets(status, false)).toEqual([]);
    },
  );
});

describe("ImportRunStatusActions", () => {
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

  it("draft: renders Submit and Cancel run", () => {
    render(<ImportRunStatusActions runId={RUN_ID} status="draft" isDryRun={true} />);
    expect(screen.getByRole("button", { name: "Submit" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Cancel run" })).toBeInTheDocument();
    expect(screen.getAllByRole("button")).toHaveLength(2);
  });

  it("validating + isDryRun=true: renders Mark Dry Run Completed, not Start Import", () => {
    render(<ImportRunStatusActions runId={RUN_ID} status="validating" isDryRun={true} />);
    expect(screen.getByRole("button", { name: "Mark Dry Run Completed" })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Start Import" })).not.toBeInTheDocument();
  });

  it("validating + isDryRun=false: renders Start Import, not Mark Dry Run Completed", () => {
    render(<ImportRunStatusActions runId={RUN_ID} status="validating" isDryRun={false} />);
    expect(screen.getByRole("button", { name: "Start Import" })).toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: "Mark Dry Run Completed" }),
    ).not.toBeInTheDocument();
  });

  it.each(["failed", "cancelled", "rejected", "rolled_back"] as const)(
    "%s: renders nothing — a terminal state with no outbound transition",
    (status) => {
      const { container } = render(
        <ImportRunStatusActions runId={RUN_ID} status={status} isDryRun={false} />,
      );
      expect(container).toBeEmptyDOMElement();
    },
  );

  it("submitted -> approved submits immediately with no extra data, no CAS field, then refreshes", async () => {
    const fetchMock = vi.fn().mockResolvedValue({ ok: true } as Response);
    global.fetch = fetchMock as typeof fetch;

    render(<ImportRunStatusActions runId={RUN_ID} status="submitted" isDryRun={false} />);
    fireEvent.click(screen.getByRole("button", { name: "Approve" }));

    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(1));
    expect(fetchMock).toHaveBeenCalledWith(
      STATUS_URL,
      expect.objectContaining({
        method: "POST",
        credentials: "include",
        body: JSON.stringify({ status: "approved" }),
      }),
    );
    await waitFor(() => expect(refreshMock).toHaveBeenCalledTimes(1));
  });

  it("dry_run_completed -> importing (the promote transition) submits directly, with no rows form", async () => {
    const fetchMock = vi.fn().mockResolvedValue({ ok: true } as Response);
    global.fetch = fetchMock as typeof fetch;

    render(<ImportRunStatusActions runId={RUN_ID} status="dry_run_completed" isDryRun={true} />);
    fireEvent.click(screen.getByRole("button", { name: "Start Import" }));

    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(1));
    expect(fetchMock).toHaveBeenCalledWith(
      STATUS_URL,
      expect.objectContaining({ body: JSON.stringify({ status: "importing" }) }),
    );
  });

  it("validating -> dry_run_completed opens an inline rows form instead of submitting immediately", () => {
    global.fetch = vi.fn() as typeof fetch;
    render(<ImportRunStatusActions runId={RUN_ID} status="validating" isDryRun={true} />);
    fireEvent.click(screen.getByRole("button", { name: "Mark Dry Run Completed" }));
    expect(screen.getByText("Rows (optional)")).toBeInTheDocument();
    expect(global.fetch).not.toHaveBeenCalled();
  });

  it("validating -> failed opens an inline error-summary form instead of submitting immediately", () => {
    global.fetch = vi.fn() as typeof fetch;
    render(<ImportRunStatusActions runId={RUN_ID} status="validating" isDryRun={true} />);
    fireEvent.click(screen.getByRole("button", { name: "Mark Failed" }));
    expect(screen.getByLabelText("Error summary (optional)")).toBeInTheDocument();
    expect(global.fetch).not.toHaveBeenCalled();
  });

  it("rejects an invalid Row # in the inline rows form before ever calling fetch", () => {
    global.fetch = vi.fn() as typeof fetch;
    render(<ImportRunStatusActions runId={RUN_ID} status="validating" isDryRun={true} />);
    fireEvent.click(screen.getByRole("button", { name: "Mark Dry Run Completed" }));
    fireEvent.change(screen.getByLabelText("Row #"), { target: { value: "0" } });
    fireEvent.click(screen.getByRole("button", { name: /Confirm/ }));
    expect(screen.getByText(/must be a positive whole number/)).toBeInTheDocument();
    expect(global.fetch).not.toHaveBeenCalled();
  });

  it("rejects malformed JSON in a row's raw data before ever calling fetch", () => {
    global.fetch = vi.fn() as typeof fetch;
    render(<ImportRunStatusActions runId={RUN_ID} status="validating" isDryRun={true} />);
    fireEvent.click(screen.getByRole("button", { name: "Mark Dry Run Completed" }));
    fireEvent.change(screen.getByLabelText("Row #"), { target: { value: "1" } });
    fireEvent.change(screen.getByLabelText("Raw data (JSON, optional)"), {
      target: { value: "{not valid json" },
    });
    fireEvent.click(screen.getByRole("button", { name: /Confirm/ }));
    expect(screen.getByText(/raw data must be valid JSON/)).toBeInTheDocument();
    expect(global.fetch).not.toHaveBeenCalled();
  });

  it("submits a well-formed row with valid JSON raw data", async () => {
    const fetchMock = vi.fn().mockResolvedValue({ ok: true } as Response);
    global.fetch = fetchMock as typeof fetch;

    render(<ImportRunStatusActions runId={RUN_ID} status="validating" isDryRun={true} />);
    fireEvent.click(screen.getByRole("button", { name: "Mark Dry Run Completed" }));
    fireEvent.change(screen.getByLabelText("Row #"), { target: { value: "1" } });
    fireEvent.change(screen.getByLabelText("Raw data (JSON, optional)"), {
      target: { value: '{"a":1}' },
    });
    fireEvent.click(screen.getByRole("button", { name: /Confirm/ }));

    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(1));
    const body = JSON.parse((fetchMock.mock.calls[0]?.[1] as RequestInit).body as string) as {
      status: string;
      rows?: readonly unknown[];
    };
    expect(body.status).toBe("dry_run_completed");
    expect(body.rows).toEqual([expect.objectContaining({ rowNumber: 1, rawData: { a: 1 } })]);
  });

  it("drops a row with a blank Row # rather than submitting or erroring", async () => {
    const fetchMock = vi.fn().mockResolvedValue({ ok: true } as Response);
    global.fetch = fetchMock as typeof fetch;

    render(<ImportRunStatusActions runId={RUN_ID} status="validating" isDryRun={true} />);
    fireEvent.click(screen.getByRole("button", { name: "Mark Dry Run Completed" }));
    fireEvent.change(screen.getByLabelText("Row #"), { target: { value: "" } });
    fireEvent.click(screen.getByRole("button", { name: /Confirm/ }));

    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(1));
    const body = JSON.parse((fetchMock.mock.calls[0]?.[1] as RequestInit).body as string) as {
      rows?: readonly unknown[];
    };
    expect(body.rows).toBeUndefined();
  });

  it("prompts a confirmation for Cancel run and does not submit when declined", () => {
    const confirmSpy = vi.fn().mockReturnValue(false);
    window.confirm = confirmSpy;
    global.fetch = vi.fn() as typeof fetch;

    render(<ImportRunStatusActions runId={RUN_ID} status="draft" isDryRun={true} />);
    fireEvent.click(screen.getByRole("button", { name: "Cancel run" }));

    expect(confirmSpy).toHaveBeenCalledTimes(1);
    expect(global.fetch).not.toHaveBeenCalled();
  });

  it("completed -> rolled_back opens a rollback-notes form and includes rollbackNotes when set", async () => {
    const confirmSpy = vi.fn().mockReturnValue(true);
    window.confirm = confirmSpy;
    const fetchMock = vi.fn().mockResolvedValue({ ok: true } as Response);
    global.fetch = fetchMock as typeof fetch;

    render(<ImportRunStatusActions runId={RUN_ID} status="completed" isDryRun={false} />);
    fireEvent.click(screen.getByRole("button", { name: "Roll Back" }));
    expect(confirmSpy).toHaveBeenCalledTimes(1);

    fireEvent.change(screen.getByLabelText("Rollback notes (optional)"), {
      target: { value: "Reverted the theme change." },
    });
    fireEvent.click(screen.getByRole("button", { name: /Confirm/ }));

    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(1));
    expect(fetchMock).toHaveBeenCalledWith(
      STATUS_URL,
      expect.objectContaining({
        body: JSON.stringify({
          status: "rolled_back",
          rollbackNotes: "Reverted the theme change.",
        }),
      }),
    );
  });
});
