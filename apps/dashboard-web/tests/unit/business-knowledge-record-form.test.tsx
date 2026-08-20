import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const pushMock = vi.fn();

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: pushMock }),
}));

import { BusinessKnowledgeRecordForm } from "../../components/business-knowledge-record-form.js";

const RECORD_ID = "11111111-1111-1111-1111-111111111111";

function successResponse(id: string): Response {
  return {
    ok: true,
    json: async () => ({
      success: true,
      data: {
        id,
        recordType: "vto",
        title: "VTO",
        content: "Content",
        status: "draft",
        notes: null,
        createdAt: "2026-08-20T00:00:00.000Z",
        updatedAt: "2026-08-20T00:00:00.000Z",
      },
      correlationId: "corr-1",
    }),
  } as Response;
}

function errorResponse(status: number, message: string, code = "BadRequestException"): Response {
  return {
    ok: false,
    status,
    json: async () => ({ success: false, error: { code, message }, correlationId: "corr-1" }),
  } as Response;
}

describe("BusinessKnowledgeRecordForm", () => {
  const originalFetch = global.fetch;

  beforeEach(() => {
    process.env.NEXT_PUBLIC_API_BASE_URL = "https://api.example.com";
    pushMock.mockReset();
  });

  afterEach(() => {
    global.fetch = originalFetch;
    vi.restoreAllMocks();
  });

  it("create mode: submits recordType/title/content/notes to POST /business-knowledge/records", async () => {
    const fetchMock = vi.fn().mockResolvedValue(successResponse(RECORD_ID));
    global.fetch = fetchMock as typeof fetch;

    render(<BusinessKnowledgeRecordForm mode="create" />);
    fireEvent.change(screen.getByLabelText("Record type"), { target: { value: "competitor" } });
    fireEvent.change(screen.getByLabelText("Title"), { target: { value: "Acme Corp" } });
    fireEvent.change(screen.getByLabelText("Content"), { target: { value: "Their strengths." } });
    fireEvent.click(screen.getByRole("button", { name: "Create record" }));

    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(1));
    expect(fetchMock).toHaveBeenCalledWith(
      "https://api.example.com/business-knowledge/records",
      expect.objectContaining({
        method: "POST",
        credentials: "include",
        body: JSON.stringify({
          recordType: "competitor",
          title: "Acme Corp",
          content: "Their strengths.",
          notes: null,
        }),
      }),
    );
    await waitFor(() =>
      expect(pushMock).toHaveBeenCalledWith(`/business-knowledge-center/${RECORD_ID}`),
    );
  });

  it("edit mode: shows the record type as read-only text, not a select", () => {
    global.fetch = vi.fn() as typeof fetch;
    render(
      <BusinessKnowledgeRecordForm
        mode="edit"
        recordId={RECORD_ID}
        initial={{ recordType: "vto", title: "VTO", content: "Content", notes: null }}
      />,
    );

    expect(screen.getByText("VTO")).toBeInTheDocument();
    expect(screen.queryByLabelText("Record type")).not.toBeInTheDocument();
    expect(screen.getByLabelText("Title")).toHaveValue("VTO");
    expect(screen.getByLabelText("Content")).toHaveValue("Content");
  });

  it("edit mode: submits title/content/notes (no recordType) to POST .../:id/update", async () => {
    const fetchMock = vi.fn().mockResolvedValue(successResponse(RECORD_ID));
    global.fetch = fetchMock as typeof fetch;

    render(
      <BusinessKnowledgeRecordForm
        mode="edit"
        recordId={RECORD_ID}
        initial={{ recordType: "vto", title: "VTO", content: "Content", notes: null }}
      />,
    );

    fireEvent.change(screen.getByLabelText("Title"), { target: { value: "VTO Renamed" } });
    fireEvent.click(screen.getByRole("button", { name: "Save changes" }));

    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(1));
    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toBe(`https://api.example.com/business-knowledge/records/${RECORD_ID}/update`);
    expect(JSON.parse(init.body as string)).toEqual({
      title: "VTO Renamed",
      content: "Content",
      notes: null,
    });
  });

  it("edit mode with redacted content: renders an inert notice instead of a textarea, and omits content/notes from the submitted payload", async () => {
    const fetchMock = vi.fn().mockResolvedValue(successResponse(RECORD_ID));
    global.fetch = fetchMock as typeof fetch;

    render(
      <BusinessKnowledgeRecordForm
        mode="edit"
        recordId={RECORD_ID}
        initial={{
          recordType: "competitor",
          title: "Sensitive competitor",
          content: undefined,
          notes: undefined,
        }}
      />,
    );

    expect(screen.queryByLabelText("Content")).not.toBeInTheDocument();
    expect(screen.getAllByText(/isn't visible to you/).length).toBeGreaterThan(0);

    fireEvent.change(screen.getByLabelText("Title"), { target: { value: "Renamed" } });
    fireEvent.click(screen.getByRole("button", { name: "Save changes" }));

    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(1));
    const [, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    const body = JSON.parse(init.body as string);
    expect(body).toEqual({ title: "Renamed" });
    expect(body).not.toHaveProperty("content");
    expect(body).not.toHaveProperty("notes");
  });

  it("shows the backend's real error message for an allowlisted code", async () => {
    global.fetch = vi
      .fn()
      .mockResolvedValue(
        errorResponse(404, "Business knowledge record not found: x"),
      ) as typeof fetch;

    render(<BusinessKnowledgeRecordForm mode="create" />);
    fireEvent.change(screen.getByLabelText("Title"), { target: { value: "x" } });
    fireEvent.change(screen.getByLabelText("Content"), { target: { value: "y" } });
    fireEvent.click(screen.getByRole("button", { name: "Create record" }));

    expect(await screen.findByRole("alert")).toHaveTextContent(
      "Business knowledge record not found: x",
    );
    expect(pushMock).not.toHaveBeenCalled();
  });

  it("shows a generic error when the request itself fails (network error)", async () => {
    global.fetch = vi.fn().mockRejectedValue(new Error("network down")) as typeof fetch;

    render(<BusinessKnowledgeRecordForm mode="create" />);
    fireEvent.change(screen.getByLabelText("Title"), { target: { value: "x" } });
    fireEvent.change(screen.getByLabelText("Content"), { target: { value: "y" } });
    fireEvent.click(screen.getByRole("button", { name: "Create record" }));

    expect(await screen.findByRole("alert")).toHaveTextContent(
      "Something went wrong. Please try again.",
    );
  });

  it("logs the real error to the console on a network failure", async () => {
    const consoleErrorSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    const networkError = new Error("network down");
    global.fetch = vi.fn().mockRejectedValue(networkError) as typeof fetch;

    render(<BusinessKnowledgeRecordForm mode="create" />);
    fireEvent.change(screen.getByLabelText("Title"), { target: { value: "x" } });
    fireEvent.change(screen.getByLabelText("Content"), { target: { value: "y" } });
    fireEvent.click(screen.getByRole("button", { name: "Create record" }));

    await screen.findByRole("alert");
    expect(consoleErrorSpy).toHaveBeenCalledWith(
      "Failed to save business knowledge record",
      networkError,
    );
    consoleErrorSpy.mockRestore();
  });
});
