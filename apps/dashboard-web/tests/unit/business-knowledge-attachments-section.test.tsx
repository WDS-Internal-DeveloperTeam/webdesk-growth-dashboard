import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { BusinessKnowledgeAttachment } from "@webdesk/shared-types";

const pushMock = vi.fn();
const refreshMock = vi.fn();
vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: pushMock, refresh: refreshMock }),
}));

const uploadMock = vi.fn();
vi.mock("@vercel/blob/client", () => ({
  upload: (...args: unknown[]) => uploadMock(...args),
}));

import { BusinessKnowledgeAttachmentsSection } from "../../components/business-knowledge-attachments-section.js";

const RECORD_ID = "11111111-1111-1111-1111-111111111111";

function attachment(
  overrides: Partial<BusinessKnowledgeAttachment> = {},
): BusinessKnowledgeAttachment {
  return {
    id: "attachment-1",
    recordId: RECORD_ID,
    filename: "report.pdf",
    mimeType: "application/pdf",
    sizeBytes: 12_345,
    checksumSha256: "a".repeat(64),
    extractedPreviewHtml: null,
    scanStatus: "scan_not_configured",
    uploadedBy: "user-1",
    createdAt: "2026-08-20T12:00:00.000Z",
    ...overrides,
  };
}

describe("BusinessKnowledgeAttachmentsSection", () => {
  const originalFetch = global.fetch;

  beforeEach(() => {
    process.env.NEXT_PUBLIC_API_BASE_URL = "https://api.example.com";
    pushMock.mockReset();
    refreshMock.mockReset();
    uploadMock.mockReset();
  });

  afterEach(() => {
    global.fetch = originalFetch;
    vi.restoreAllMocks();
  });

  it("shows an empty state when there are no attachments", () => {
    render(<BusinessKnowledgeAttachmentsSection recordId={RECORD_ID} initialAttachments={[]} />);
    expect(screen.getByText("No attachments")).toBeInTheDocument();
  });

  it("renders a PDF attachment as an embedded preview, not just a filename", () => {
    render(
      <BusinessKnowledgeAttachmentsSection
        recordId={RECORD_ID}
        initialAttachments={[attachment()]}
      />,
    );
    expect(screen.getByText("report.pdf")).toBeInTheDocument();
    const embed = document.querySelector("embed[type='application/pdf']");
    expect(embed?.getAttribute("src")).toBe(
      `https://api.example.com/business-knowledge/records/${RECORD_ID}/attachments/attachment-1/content`,
    );
  });

  it("renders a Markdown/DOCX/XLSX attachment's cached preview HTML inline", () => {
    render(
      <BusinessKnowledgeAttachmentsSection
        recordId={RECORD_ID}
        initialAttachments={[
          attachment({
            id: "attachment-2",
            filename: "notes.md",
            mimeType: "text/markdown",
            extractedPreviewHtml: "<h1>Heading</h1><p>Body text</p>",
          }),
        ]}
      />,
    );
    expect(screen.getByText("Heading")).toBeInTheDocument();
    expect(screen.getByText("Body text")).toBeInTheDocument();
  });

  it("shows a fallback message for a format with no generated preview", () => {
    render(
      <BusinessKnowledgeAttachmentsSection
        recordId={RECORD_ID}
        initialAttachments={[
          attachment({
            id: "attachment-3",
            filename: "weird.bin",
            mimeType: "application/octet-stream",
          }),
        ]}
      />,
    );
    expect(screen.getByText("No preview available for this file type.")).toBeInTheDocument();
  });

  it("uploads a file: calls upload() with the correct pathname prefix, then confirm(), then adds it to the list", async () => {
    uploadMock.mockResolvedValue({
      url: "https://x.blob.vercel-storage.com/business-knowledge/.../report.pdf",
      pathname: `business-knowledge/${RECORD_ID}/uuid-report.pdf`,
      contentType: "application/pdf",
    });
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ success: true, data: attachment(), correlationId: "test" }),
    } as Response);
    global.fetch = fetchMock as typeof fetch;

    render(<BusinessKnowledgeAttachmentsSection recordId={RECORD_ID} initialAttachments={[]} />);

    const file = new File(["pdf bytes"], "report.pdf", { type: "application/pdf" });
    const input = document.querySelector('input[type="file"]') as HTMLInputElement;
    fireEvent.change(input, { target: { files: [file] } });

    await waitFor(() => expect(uploadMock).toHaveBeenCalledTimes(1));
    const [pathname, , options] = uploadMock.mock.calls[0] as [
      string,
      File,
      Record<string, unknown>,
    ];
    expect(pathname).toContain(`business-knowledge/${RECORD_ID}/`);
    expect(options.access).toBe("private");
    expect(options.handleUploadUrl).toBe(
      `https://api.example.com/business-knowledge/records/${RECORD_ID}/attachments/upload-route`,
    );

    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(1));
    expect(fetchMock).toHaveBeenCalledWith(
      `https://api.example.com/business-knowledge/records/${RECORD_ID}/attachments/confirm`,
      expect.objectContaining({
        method: "POST",
        credentials: "include",
        body: JSON.stringify({
          pathname: `business-knowledge/${RECORD_ID}/uuid-report.pdf`,
          filename: "report.pdf",
        }),
      }),
    );
    await waitFor(() => expect(screen.getByText("report.pdf")).toBeInTheDocument());
    expect(refreshMock).toHaveBeenCalled();
  });

  it("rejects an unsupported file type before ever calling upload()", async () => {
    render(<BusinessKnowledgeAttachmentsSection recordId={RECORD_ID} initialAttachments={[]} />);
    const file = new File(["exe bytes"], "malware.exe", { type: "application/x-msdownload" });
    const input = document.querySelector('input[type="file"]') as HTMLInputElement;
    fireEvent.change(input, { target: { files: [file] } });

    await waitFor(() =>
      expect(screen.getByRole("alert")).toHaveTextContent(/Only PDF, DOCX, XLSX/),
    );
    expect(uploadMock).not.toHaveBeenCalled();
  });

  it("rejects an oversized file before ever calling upload()", async () => {
    render(<BusinessKnowledgeAttachmentsSection recordId={RECORD_ID} initialAttachments={[]} />);
    const oversized = new File([new Uint8Array(1)], "big.pdf", { type: "application/pdf" });
    Object.defineProperty(oversized, "size", { value: 26 * 1024 * 1024 });
    const input = document.querySelector('input[type="file"]') as HTMLInputElement;
    fireEvent.change(input, { target: { files: [oversized] } });

    await waitFor(() => expect(screen.getByRole("alert")).toHaveTextContent(/25 MB/));
    expect(uploadMock).not.toHaveBeenCalled();
  });

  it("shows the backend's error message when confirm() fails", async () => {
    uploadMock.mockResolvedValue({
      url: "x",
      pathname: `business-knowledge/${RECORD_ID}/x.pdf`,
      contentType: "application/pdf",
    });
    global.fetch = vi.fn().mockResolvedValue({
      ok: false,
      status: 400,
      json: async () => ({
        success: false,
        error: { code: "BadRequestException", message: "Unsupported file type: x" },
        correlationId: "test",
      }),
    } as Response) as typeof fetch;

    render(<BusinessKnowledgeAttachmentsSection recordId={RECORD_ID} initialAttachments={[]} />);
    const file = new File(["bytes"], "report.pdf", { type: "application/pdf" });
    const input = document.querySelector('input[type="file"]') as HTMLInputElement;
    fireEvent.change(input, { target: { files: [file] } });

    await waitFor(() =>
      expect(screen.getByRole("alert")).toHaveTextContent("Unsupported file type: x"),
    );
  });

  it("deletes an attachment: removes it from the list and refreshes", async () => {
    const fetchMock = vi.fn().mockResolvedValue({ ok: true, json: async () => ({}) } as Response);
    global.fetch = fetchMock as typeof fetch;

    render(
      <BusinessKnowledgeAttachmentsSection
        recordId={RECORD_ID}
        initialAttachments={[attachment()]}
      />,
    );
    fireEvent.click(screen.getByRole("button", { name: "Remove" }));

    await waitFor(() =>
      expect(fetchMock).toHaveBeenCalledWith(
        `https://api.example.com/business-knowledge/records/${RECORD_ID}/attachments/attachment-1`,
        expect.objectContaining({ method: "DELETE", credentials: "include" }),
      ),
    );
    await waitFor(() => expect(screen.getByText("No attachments")).toBeInTheDocument());
    expect(refreshMock).toHaveBeenCalled();
  });

  it("resyncs from initialAttachments when it changes (router.refresh() delivering fresh server data)", () => {
    const { rerender } = render(
      <BusinessKnowledgeAttachmentsSection recordId={RECORD_ID} initialAttachments={[]} />,
    );
    expect(screen.getByText("No attachments")).toBeInTheDocument();
    rerender(
      <BusinessKnowledgeAttachmentsSection
        recordId={RECORD_ID}
        initialAttachments={[attachment()]}
      />,
    );
    expect(screen.getByText("report.pdf")).toBeInTheDocument();
  });
});
