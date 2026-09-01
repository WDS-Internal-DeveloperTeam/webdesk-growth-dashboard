import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const refreshMock = vi.fn();

vi.mock("next/navigation", () => ({
  useRouter: () => ({ refresh: refreshMock }),
}));

import { KnowledgeLibraryStatusActions } from "../../components/knowledge-library-status-actions.js";

const RECORD_ID = "11111111-1111-1111-1111-111111111111";

describe("KnowledgeLibraryStatusActions", () => {
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

  it("draft: renders Mark Mandatory, Mark Advisory, and Deprecate", () => {
    render(<KnowledgeLibraryStatusActions recordId={RECORD_ID} status="draft" />);
    expect(screen.getByRole("button", { name: "Mark Mandatory" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Mark Advisory" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Deprecate" })).toBeInTheDocument();
  });

  it("mandatory: renders Mark Advisory, Revert to Draft, and Deprecate", () => {
    render(<KnowledgeLibraryStatusActions recordId={RECORD_ID} status="mandatory" />);
    expect(screen.getByRole("button", { name: "Mark Advisory" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Revert to Draft" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Deprecate" })).toBeInTheDocument();
  });

  it("deprecated: renders nothing — deprecated is a terminal state", () => {
    const { container } = render(
      <KnowledgeLibraryStatusActions recordId={RECORD_ID} status="deprecated" />,
    );
    expect(container).toBeEmptyDOMElement();
  });

  it("Mark Mandatory: posts {status: mandatory} with no confirmation prompt, then refreshes", async () => {
    const confirmSpy = vi.fn();
    window.confirm = confirmSpy;
    const fetchMock = vi.fn().mockResolvedValue({ ok: true } as Response);
    global.fetch = fetchMock as typeof fetch;

    render(<KnowledgeLibraryStatusActions recordId={RECORD_ID} status="draft" />);
    fireEvent.click(screen.getByRole("button", { name: "Mark Mandatory" }));

    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(1));
    expect(confirmSpy).not.toHaveBeenCalled();
    expect(fetchMock).toHaveBeenCalledWith(
      `https://api.example.com/knowledge-library/records/${RECORD_ID}/status`,
      expect.objectContaining({
        method: "POST",
        credentials: "include",
        body: JSON.stringify({ status: "mandatory" }),
      }),
    );
    await waitFor(() => expect(refreshMock).toHaveBeenCalledTimes(1));
  });

  it("Deprecate: asks for confirmation first, and does nothing if the user cancels", async () => {
    window.confirm = vi.fn().mockReturnValue(false);
    const fetchMock = vi.fn();
    global.fetch = fetchMock as typeof fetch;

    render(<KnowledgeLibraryStatusActions recordId={RECORD_ID} status="draft" />);
    fireEvent.click(screen.getByRole("button", { name: "Deprecate" }));

    await waitFor(() => expect(window.confirm).toHaveBeenCalledTimes(1));
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
          message: `Knowledge library record ${RECORD_ID} status changed concurrently (expected draft, now mandatory) — reload and retry`,
        },
        correlationId: "corr-1",
      }),
    } as Response) as typeof fetch;

    render(<KnowledgeLibraryStatusActions recordId={RECORD_ID} status="draft" />);
    fireEvent.click(screen.getByRole("button", { name: "Mark Mandatory" }));

    expect(await screen.findByRole("alert")).toHaveTextContent(/changed concurrently/);
    expect(refreshMock).not.toHaveBeenCalled();
  });

  it("renders the new status's buttons immediately on success, without waiting on refresh", async () => {
    window.confirm = vi.fn();
    global.fetch = vi.fn().mockResolvedValue({ ok: true } as Response) as typeof fetch;

    render(<KnowledgeLibraryStatusActions recordId={RECORD_ID} status="draft" />);
    fireEvent.click(screen.getByRole("button", { name: "Mark Mandatory" }));

    await waitFor(() => expect(refreshMock).toHaveBeenCalledTimes(1));
    expect(screen.getByRole("button", { name: "Revert to Draft" })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Mark Mandatory" })).not.toBeInTheDocument();
  });

  it("renders nothing for a status outside the known union, instead of throwing", () => {
    const unknownStatus = "not_a_real_status" as unknown as Parameters<
      typeof KnowledgeLibraryStatusActions
    >[0]["status"];
    const { container } = render(
      <KnowledgeLibraryStatusActions recordId={RECORD_ID} status={unknownStatus} />,
    );
    expect(container).toBeEmptyDOMElement();
  });
});
