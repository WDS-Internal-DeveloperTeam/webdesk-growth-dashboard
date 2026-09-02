import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const refreshMock = vi.fn();

vi.mock("next/navigation", () => ({
  useRouter: () => ({ refresh: refreshMock }),
}));

import { ScanFindingStatusActions } from "../../components/scan-finding-status-actions.js";

const PROJECT_ID = "11111111-1111-1111-1111-111111111111";
const FINDING_ID = "22222222-2222-2222-2222-222222222222";
const STATUS_URL = `https://api.example.com/scan-center/projects/${PROJECT_ID}/findings/${FINDING_ID}/status`;

describe("ScanFindingStatusActions", () => {
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

  it("open: renders Acknowledge, Resolve, and Dismiss", () => {
    render(
      <ScanFindingStatusActions projectId={PROJECT_ID} findingId={FINDING_ID} status="open" />,
    );
    expect(screen.getByRole("button", { name: "Acknowledge" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Resolve" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Dismiss" })).toBeInTheDocument();
    expect(screen.getAllByRole("button")).toHaveLength(3);
  });

  it("acknowledged: renders Reopen, Resolve, and Dismiss", () => {
    render(
      <ScanFindingStatusActions
        projectId={PROJECT_ID}
        findingId={FINDING_ID}
        status="acknowledged"
      />,
    );
    expect(screen.getByRole("button", { name: "Reopen" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Resolve" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Dismiss" })).toBeInTheDocument();
  });

  it.each(["resolved", "dismissed"] as const)(
    "%s: renders nothing — a terminal state with no outbound transition",
    (status) => {
      const { container } = render(
        <ScanFindingStatusActions projectId={PROJECT_ID} findingId={FINDING_ID} status={status} />,
      );
      expect(container).toBeEmptyDOMElement();
    },
  );

  it("posts the status to the finding status route, then refreshes", async () => {
    const fetchMock = vi.fn().mockResolvedValue({ ok: true } as Response);
    global.fetch = fetchMock as typeof fetch;

    render(
      <ScanFindingStatusActions projectId={PROJECT_ID} findingId={FINDING_ID} status="open" />,
    );
    fireEvent.click(screen.getByRole("button", { name: "Acknowledge" }));

    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(1));
    expect(fetchMock).toHaveBeenCalledWith(
      STATUS_URL,
      expect.objectContaining({
        method: "POST",
        credentials: "include",
        body: JSON.stringify({ status: "acknowledged" }),
      }),
    );
    await waitFor(() => expect(refreshMock).toHaveBeenCalledTimes(1));
  });

  it("prompts a confirmation for Resolve and Dismiss, and never for Acknowledge/Reopen", async () => {
    const confirmSpy = vi.fn().mockReturnValue(true);
    window.confirm = confirmSpy;
    global.fetch = vi.fn().mockResolvedValue({ ok: true } as Response) as typeof fetch;

    render(
      <ScanFindingStatusActions projectId={PROJECT_ID} findingId={FINDING_ID} status="open" />,
    );
    fireEvent.click(screen.getByRole("button", { name: "Acknowledge" }));
    await waitFor(() => expect(refreshMock).toHaveBeenCalledTimes(1));
    expect(confirmSpy).not.toHaveBeenCalled();

    refreshMock.mockReset();
    fireEvent.click(screen.getByRole("button", { name: "Resolve" }));
    expect(confirmSpy).toHaveBeenCalledTimes(1);
    await waitFor(() => expect(refreshMock).toHaveBeenCalledTimes(1));
  });

  it("does not submit when the confirmation is declined", async () => {
    window.confirm = vi.fn().mockReturnValue(false);
    const fetchMock = vi.fn();
    global.fetch = fetchMock as typeof fetch;

    render(
      <ScanFindingStatusActions projectId={PROJECT_ID} findingId={FINDING_ID} status="open" />,
    );
    fireEvent.click(screen.getByRole("button", { name: "Dismiss" }));

    expect(fetchMock).not.toHaveBeenCalled();
    expect(refreshMock).not.toHaveBeenCalled();
  });

  it("renders the new status's buttons immediately on success, without waiting on refresh", async () => {
    global.fetch = vi.fn().mockResolvedValue({ ok: true } as Response) as typeof fetch;

    render(
      <ScanFindingStatusActions projectId={PROJECT_ID} findingId={FINDING_ID} status="open" />,
    );
    fireEvent.click(screen.getByRole("button", { name: "Acknowledge" }));

    await waitFor(() => expect(refreshMock).toHaveBeenCalledTimes(1));
    expect(screen.getByRole("button", { name: "Reopen" })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Acknowledge" })).not.toBeInTheDocument();
  });

  it("shows the backend's error message on failure, without refreshing", async () => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: false,
      json: async () => ({
        success: false,
        error: { code: "BadRequestException", message: "Invalid scan finding status transition" },
        correlationId: "corr-1",
      }),
    } as Response) as typeof fetch;

    render(
      <ScanFindingStatusActions projectId={PROJECT_ID} findingId={FINDING_ID} status="open" />,
    );
    fireEvent.click(screen.getByRole("button", { name: "Acknowledge" }));

    expect(await screen.findByRole("alert")).toHaveTextContent(/Invalid scan finding status/);
    expect(refreshMock).not.toHaveBeenCalled();
  });

  it("logs and shows a generic error, without refreshing, when the fetch call itself throws", async () => {
    const consoleErrorSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    global.fetch = vi.fn().mockRejectedValue(new Error("network down")) as typeof fetch;

    render(
      <ScanFindingStatusActions projectId={PROJECT_ID} findingId={FINDING_ID} status="open" />,
    );
    fireEvent.click(screen.getByRole("button", { name: "Acknowledge" }));

    expect(await screen.findByRole("alert")).toHaveTextContent(
      "Something went wrong. Please try again.",
    );
    expect(refreshMock).not.toHaveBeenCalled();
    expect(consoleErrorSpy).toHaveBeenCalled();
  });

  it("renders nothing for a status outside the known union, instead of throwing", () => {
    const unknownStatus = "not_a_real_status" as unknown as Parameters<
      typeof ScanFindingStatusActions
    >[0]["status"];
    const { container } = render(
      <ScanFindingStatusActions
        projectId={PROJECT_ID}
        findingId={FINDING_ID}
        status={unknownStatus}
      />,
    );
    expect(container).toBeEmptyDOMElement();
  });
});
