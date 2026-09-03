import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const refreshMock = vi.fn();

vi.mock("next/navigation", () => ({
  useRouter: () => ({ refresh: refreshMock }),
}));

import { ReleaseStatusActions } from "../../components/release-status-actions.js";

const PROJECT_ID = "11111111-1111-1111-1111-111111111111";
const RELEASE_ID = "22222222-2222-2222-2222-222222222222";
const STATUS_URL = `https://api.example.com/release-center/projects/${PROJECT_ID}/releases/${RELEASE_ID}/status`;

describe("ReleaseStatusActions", () => {
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

  it("proposed: renders only Run Checks", () => {
    render(
      <ReleaseStatusActions projectId={PROJECT_ID} releaseId={RELEASE_ID} status="proposed" />,
    );
    expect(screen.getByRole("button", { name: "Run Checks" })).toBeInTheDocument();
    expect(screen.getAllByRole("button")).toHaveLength(1);
  });

  it("checks_running: renders both outbound transitions", () => {
    render(
      <ReleaseStatusActions
        projectId={PROJECT_ID}
        releaseId={RELEASE_ID}
        status="checks_running"
      />,
    );
    expect(screen.getByRole("button", { name: "Mark Ready for Staging" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Mark Checks Failed" })).toBeInTheDocument();
    expect(screen.getAllByRole("button")).toHaveLength(2);
  });

  it("completed: still renders two outbound transitions (a genuine re-entry, not terminal)", () => {
    render(
      <ReleaseStatusActions projectId={PROJECT_ID} releaseId={RELEASE_ID} status="completed" />,
    );
    expect(screen.getByRole("button", { name: "Flag Hotfix Required" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Roll Back" })).toBeInTheDocument();
  });

  it("rolled_back: renders nothing — the module's own fully terminal state", () => {
    const { container } = render(
      <ReleaseStatusActions projectId={PROJECT_ID} releaseId={RELEASE_ID} status="rolled_back" />,
    );
    expect(container).toBeEmptyDOMElement();
  });

  it("proposed -> checks_running submits immediately with no confirmation, then refreshes", async () => {
    const fetchMock = vi.fn().mockResolvedValue({ ok: true } as Response);
    global.fetch = fetchMock as typeof fetch;
    const confirmSpy = vi.fn();
    window.confirm = confirmSpy;

    render(
      <ReleaseStatusActions projectId={PROJECT_ID} releaseId={RELEASE_ID} status="proposed" />,
    );
    fireEvent.click(screen.getByRole("button", { name: "Run Checks" }));

    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(1));
    const [url, options] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toBe(STATUS_URL);
    expect(options.method).toBe("POST");
    expect(options.credentials).toBe("include");
    const body = JSON.parse(options.body as string) as Record<string, unknown>;
    expect(body.status).toBe("checks_running");
    expect(confirmSpy).not.toHaveBeenCalled();
    await waitFor(() => expect(refreshMock).toHaveBeenCalledTimes(1));
    expect(screen.getByRole("button", { name: "Mark Ready for Staging" })).toBeInTheDocument();
  });

  it("staging_deployed: Roll Back stays disabled until reason and SHA are both filled in", () => {
    render(
      <ReleaseStatusActions
        projectId={PROJECT_ID}
        releaseId={RELEASE_ID}
        status="staging_deployed"
      />,
    );
    const rollBackButton = screen.getByRole("button", { name: "Roll Back" });
    expect(rollBackButton).toBeDisabled();

    fireEvent.change(screen.getByLabelText("Reason"), { target: { value: "Bad deploy" } });
    expect(rollBackButton).toBeDisabled();

    fireEvent.change(screen.getByLabelText("Rolled-back commit SHA"), {
      target: { value: "abc1234" },
    });
    expect(rollBackButton).not.toBeDisabled();
  });

  it("rolls back with a confirmation prompt and the full rollback payload", async () => {
    window.confirm = vi.fn().mockReturnValue(true);
    const fetchMock = vi.fn().mockResolvedValue({ ok: true } as Response);
    global.fetch = fetchMock as typeof fetch;

    render(
      <ReleaseStatusActions
        projectId={PROJECT_ID}
        releaseId={RELEASE_ID}
        status="staging_deployed"
      />,
    );
    fireEvent.change(screen.getByLabelText("Reason"), { target: { value: "Bad deploy" } });
    fireEvent.change(screen.getByLabelText("Rolled-back commit SHA"), {
      target: { value: "abc1234" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Roll Back" }));

    expect(window.confirm).toHaveBeenCalledTimes(1);
    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(1));
    const [, options] = fetchMock.mock.calls[0] as [string, RequestInit];
    const body = JSON.parse(options.body as string) as Record<string, unknown>;
    expect(body.status).toBe("rolled_back");
    expect(body.reason).toBe("Bad deploy");
    expect(body.rolledBackSha).toBe("abc1234");
    expect(body.replacementReleaseId).toBeNull();
    await waitFor(() => expect(refreshMock).toHaveBeenCalledTimes(1));
  });

  it("does not submit the rollback when the confirmation is declined", () => {
    window.confirm = vi.fn().mockReturnValue(false);
    const fetchMock = vi.fn();
    global.fetch = fetchMock as typeof fetch;

    render(
      <ReleaseStatusActions
        projectId={PROJECT_ID}
        releaseId={RELEASE_ID}
        status="staging_deployed"
      />,
    );
    fireEvent.change(screen.getByLabelText("Reason"), { target: { value: "Bad deploy" } });
    fireEvent.change(screen.getByLabelText("Rolled-back commit SHA"), {
      target: { value: "abc1234" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Roll Back" }));

    expect(fetchMock).not.toHaveBeenCalled();
    expect(refreshMock).not.toHaveBeenCalled();
  });

  it("rejects a malformed replacement release id before ever calling fetch", () => {
    const fetchMock = vi.fn();
    global.fetch = fetchMock as typeof fetch;

    render(
      <ReleaseStatusActions
        projectId={PROJECT_ID}
        releaseId={RELEASE_ID}
        status="staging_deployed"
      />,
    );
    fireEvent.change(screen.getByLabelText("Reason"), { target: { value: "Bad deploy" } });
    fireEvent.change(screen.getByLabelText("Rolled-back commit SHA"), {
      target: { value: "abc1234" },
    });
    fireEvent.change(screen.getByLabelText("Replacement release ID (optional)"), {
      target: { value: "not-a-uuid" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Roll Back" }));

    expect(screen.getByText("Must be a valid UUID.")).toBeInTheDocument();
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("shows the backend's 409 conflict message on a lost race", async () => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: false,
      json: async () => ({
        success: false,
        error: {
          code: "ConflictException",
          message: `Release ${RELEASE_ID} status changed concurrently (expected proposed, now checks_running) — reload and retry`,
        },
        correlationId: "corr-1",
      }),
    } as Response) as typeof fetch;

    render(
      <ReleaseStatusActions projectId={PROJECT_ID} releaseId={RELEASE_ID} status="proposed" />,
    );
    fireEvent.click(screen.getByRole("button", { name: "Run Checks" }));

    expect(await screen.findByRole("alert")).toHaveTextContent(/changed concurrently/);
    expect(refreshMock).not.toHaveBeenCalled();
  });

  it("logs and shows a generic error, without refreshing, when the fetch call itself throws", async () => {
    const consoleErrorSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    global.fetch = vi.fn().mockRejectedValue(new Error("network down")) as typeof fetch;

    render(
      <ReleaseStatusActions projectId={PROJECT_ID} releaseId={RELEASE_ID} status="proposed" />,
    );
    fireEvent.click(screen.getByRole("button", { name: "Run Checks" }));

    expect(await screen.findByRole("alert")).toHaveTextContent(
      "Something went wrong. Please try again.",
    );
    expect(refreshMock).not.toHaveBeenCalled();
    expect(consoleErrorSpy).toHaveBeenCalled();
  });
});
