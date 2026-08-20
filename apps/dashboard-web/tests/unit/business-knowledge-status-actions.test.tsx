import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const refreshMock = vi.fn();

vi.mock("next/navigation", () => ({
  useRouter: () => ({ refresh: refreshMock }),
}));

import { BusinessKnowledgeStatusActions } from "../../components/business-knowledge-status-actions.js";

const RECORD_ID = "11111111-1111-1111-1111-111111111111";

describe("BusinessKnowledgeStatusActions", () => {
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

  it("draft: renders all four reachable transitions", () => {
    render(<BusinessKnowledgeStatusActions recordId={RECORD_ID} status="draft" />);
    expect(screen.getByRole("button", { name: "Approve as Mandatory" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Approve as Advisory" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Restrict" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Deprecate" })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Send to Draft" })).not.toBeInTheDocument();
  });

  it("mandatory: includes 'Send to Draft' (the symmetric fix), not 'Approve as Mandatory'", () => {
    render(<BusinessKnowledgeStatusActions recordId={RECORD_ID} status="mandatory" />);
    expect(screen.getByRole("button", { name: "Send to Draft" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Approve as Advisory" })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Approve as Mandatory" })).not.toBeInTheDocument();
  });

  it("deprecated: renders nothing — deprecated is a terminal state", () => {
    const { container } = render(
      <BusinessKnowledgeStatusActions recordId={RECORD_ID} status="deprecated" />,
    );
    expect(container).toBeEmptyDOMElement();
  });

  it("Approve as Mandatory: posts {status: mandatory} with no confirmation prompt, then refreshes", async () => {
    const confirmSpy = vi.fn();
    window.confirm = confirmSpy;
    const fetchMock = vi.fn().mockResolvedValue({ ok: true } as Response);
    global.fetch = fetchMock as typeof fetch;

    render(<BusinessKnowledgeStatusActions recordId={RECORD_ID} status="draft" />);
    fireEvent.click(screen.getByRole("button", { name: "Approve as Mandatory" }));

    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(1));
    expect(confirmSpy).not.toHaveBeenCalled();
    expect(fetchMock).toHaveBeenCalledWith(
      `https://api.example.com/business-knowledge/records/${RECORD_ID}/status`,
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

    render(<BusinessKnowledgeStatusActions recordId={RECORD_ID} status="draft" />);
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
          message: `Business knowledge record ${RECORD_ID} status changed concurrently (expected draft, now mandatory) — reload and retry`,
        },
        correlationId: "corr-1",
      }),
    } as Response) as typeof fetch;

    render(<BusinessKnowledgeStatusActions recordId={RECORD_ID} status="draft" />);
    fireEvent.click(screen.getByRole("button", { name: "Approve as Advisory" }));

    expect(await screen.findByRole("alert")).toHaveTextContent(/changed concurrently/);
    expect(refreshMock).not.toHaveBeenCalled();
  });

  it("renders the new status's buttons immediately on success, without waiting on refresh", async () => {
    window.confirm = vi.fn();
    global.fetch = vi.fn().mockResolvedValue({ ok: true } as Response) as typeof fetch;

    render(<BusinessKnowledgeStatusActions recordId={RECORD_ID} status="draft" />);
    fireEvent.click(screen.getByRole("button", { name: "Approve as Mandatory" }));

    await waitFor(() => expect(refreshMock).toHaveBeenCalledTimes(1));
    expect(screen.getByRole("button", { name: "Send to Draft" })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Approve as Mandatory" })).not.toBeInTheDocument();
  });

  it("renders nothing for a status outside the known union, instead of throwing", () => {
    const unknownStatus = "under_review" as unknown as Parameters<
      typeof BusinessKnowledgeStatusActions
    >[0]["status"];
    const { container } = render(
      <BusinessKnowledgeStatusActions recordId={RECORD_ID} status={unknownStatus} />,
    );
    expect(container).toBeEmptyDOMElement();
  });
});
