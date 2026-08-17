import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const refreshMock = vi.fn();

vi.mock("next/navigation", () => ({
  useRouter: () => ({ refresh: refreshMock }),
}));

import { ProjectStatusActions } from "../../components/project-status-actions.js";

const PROJECT_ID = "11111111-1111-1111-1111-111111111111";

describe("ProjectStatusActions", () => {
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

  it("active: renders Pause and Archive, not Resume", () => {
    render(<ProjectStatusActions projectId={PROJECT_ID} status="active" />);
    expect(screen.getByRole("button", { name: "Pause" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Archive" })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Resume" })).not.toBeInTheDocument();
  });

  it("paused: renders Resume and Archive, not Pause", () => {
    render(<ProjectStatusActions projectId={PROJECT_ID} status="paused" />);
    expect(screen.getByRole("button", { name: "Resume" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Archive" })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Pause" })).not.toBeInTheDocument();
  });

  it("archived: renders nothing — archived is a terminal state", () => {
    const { container } = render(<ProjectStatusActions projectId={PROJECT_ID} status="archived" />);
    expect(container).toBeEmptyDOMElement();
  });

  it("Pause: posts {status: paused} with no confirmation prompt, then refreshes", async () => {
    const confirmSpy = vi.fn();
    window.confirm = confirmSpy;
    const fetchMock = vi.fn().mockResolvedValue({ ok: true } as Response);
    global.fetch = fetchMock as typeof fetch;

    render(<ProjectStatusActions projectId={PROJECT_ID} status="active" />);
    fireEvent.click(screen.getByRole("button", { name: "Pause" }));

    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(1));
    expect(confirmSpy).not.toHaveBeenCalled();
    expect(fetchMock).toHaveBeenCalledWith(
      `https://api.example.com/projects/${PROJECT_ID}/status`,
      expect.objectContaining({
        method: "POST",
        credentials: "include",
        body: JSON.stringify({ status: "paused" }),
      }),
    );
    await waitFor(() => expect(refreshMock).toHaveBeenCalledTimes(1));
  });

  it("Archive: asks for confirmation first, and does nothing if the user cancels", async () => {
    window.confirm = vi.fn().mockReturnValue(false);
    const fetchMock = vi.fn();
    global.fetch = fetchMock as typeof fetch;

    render(<ProjectStatusActions projectId={PROJECT_ID} status="active" />);
    fireEvent.click(screen.getByRole("button", { name: "Archive" }));

    await waitFor(() => expect(window.confirm).toHaveBeenCalledTimes(1));
    expect(fetchMock).not.toHaveBeenCalled();
    expect(refreshMock).not.toHaveBeenCalled();
  });

  it("Archive: proceeds and posts {status: archived} once the user confirms", async () => {
    window.confirm = vi.fn().mockReturnValue(true);
    const fetchMock = vi.fn().mockResolvedValue({ ok: true } as Response);
    global.fetch = fetchMock as typeof fetch;

    render(<ProjectStatusActions projectId={PROJECT_ID} status="paused" />);
    fireEvent.click(screen.getByRole("button", { name: "Archive" }));

    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(1));
    const body = JSON.parse((fetchMock.mock.calls[0]?.[1] as RequestInit).body as string);
    expect(body).toEqual({ status: "archived" });
    await waitFor(() => expect(refreshMock).toHaveBeenCalledTimes(1));
  });

  it("shows the backend's error message on a non-OK response, without refreshing", async () => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: false,
      json: async () => ({
        success: false,
        error: {
          code: "BadRequestException",
          message: "Invalid project status transition: active -> active",
        },
        correlationId: "corr-1",
      }),
    } as Response) as typeof fetch;

    render(<ProjectStatusActions projectId={PROJECT_ID} status="active" />);
    fireEvent.click(screen.getByRole("button", { name: "Pause" }));

    expect(await screen.findByRole("alert")).toHaveTextContent(
      "Invalid project status transition: active -> active",
    );
    expect(refreshMock).not.toHaveBeenCalled();
  });

  it("shows a generic error when the request itself fails (network error)", async () => {
    global.fetch = vi.fn().mockRejectedValue(new Error("network down")) as typeof fetch;

    render(<ProjectStatusActions projectId={PROJECT_ID} status="active" />);
    fireEvent.click(screen.getByRole("button", { name: "Pause" }));

    expect(await screen.findByRole("alert")).toHaveTextContent(
      "Something went wrong. Please try again.",
    );
  });

  it("logs the real error to the console on a network failure", async () => {
    const consoleErrorSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    const networkError = new Error("network down");
    global.fetch = vi.fn().mockRejectedValue(networkError) as typeof fetch;

    render(<ProjectStatusActions projectId={PROJECT_ID} status="active" />);
    fireEvent.click(screen.getByRole("button", { name: "Pause" }));

    await screen.findByRole("alert");
    expect(consoleErrorSpy).toHaveBeenCalledWith("Failed to change project status", networkError);
    consoleErrorSpy.mockRestore();
  });

  it("renders the new status's buttons immediately on success, without waiting on refresh", async () => {
    // router.refresh() is a synchronous no-op mock here — this test's real assertion is that the
    // component updates its own button set from the confirmed transition (not from a `status`
    // prop that only a real Next.js refresh would ever change), closing the race window where
    // buttons could re-enable against a still-stale status before a real refresh had landed.
    window.confirm = vi.fn();
    global.fetch = vi.fn().mockResolvedValue({ ok: true } as Response) as typeof fetch;

    render(<ProjectStatusActions projectId={PROJECT_ID} status="active" />);
    fireEvent.click(screen.getByRole("button", { name: "Pause" }));

    await waitFor(() => expect(refreshMock).toHaveBeenCalledTimes(1));
    expect(screen.getByRole("button", { name: "Resume" })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Pause" })).not.toBeInTheDocument();
  });

  it("renders nothing for a status outside the known union, instead of throwing", () => {
    const unknownStatus = "on_hold" as unknown as Parameters<
      typeof ProjectStatusActions
    >[0]["status"];
    const { container } = render(
      <ProjectStatusActions projectId={PROJECT_ID} status={unknownStatus} />,
    );
    expect(container).toBeEmptyDOMElement();
  });
});
