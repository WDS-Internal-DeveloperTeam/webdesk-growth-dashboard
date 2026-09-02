import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { ScanEvidenceSection } from "../../components/scan-evidence-section.js";

const PROJECT_ID = "11111111-1111-1111-1111-111111111111";
const FINDING_ID = "22222222-2222-2222-2222-222222222222";
const BASE_PATH = `https://api.example.com/scan-center/projects/${PROJECT_ID}/findings/${FINDING_ID}/evidence`;

describe("ScanEvidenceSection", () => {
  const originalFetch = global.fetch;

  beforeEach(() => {
    process.env.NEXT_PUBLIC_API_BASE_URL = "https://api.example.com";
  });

  afterEach(() => {
    global.fetch = originalFetch;
    vi.restoreAllMocks();
  });

  it("renders 'No evidence recorded yet.' when empty", () => {
    render(
      <ScanEvidenceSection projectId={PROJECT_ID} findingId={FINDING_ID} initialEvidence={[]} />,
    );
    expect(screen.getByText("No evidence recorded yet.")).toBeInTheDocument();
  });

  it("adds evidence — posts to the finding's own evidence route, no update/delete route exists", async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        success: true,
        data: {
          id: "ev-1",
          projectId: PROJECT_ID,
          publicId: "EVD-1",
          scanFindingId: FINDING_ID,
          evidenceType: "screenshot",
          reference: "https://example.com/evidence.png",
          notes: null,
          capturedAt: null,
          createdBy: null,
          createdAt: "2026-09-02T00:00:00.000Z",
          updatedAt: "2026-09-02T00:00:00.000Z",
        },
        correlationId: "corr-1",
      }),
    } as Response);
    global.fetch = fetchMock as unknown as typeof fetch;

    render(
      <ScanEvidenceSection projectId={PROJECT_ID} findingId={FINDING_ID} initialEvidence={[]} />,
    );
    fireEvent.change(screen.getByLabelText("Type"), { target: { value: "screenshot" } });
    fireEvent.change(screen.getByLabelText("Reference URL"), {
      target: { value: "https://example.com/evidence.png" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Add evidence" }));

    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(1));
    const [url, options] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toBe(BASE_PATH);
    expect(options.method).toBe("POST");
    expect(options.credentials).toBe("include");
    const body = JSON.parse(options.body as string) as Record<string, unknown>;
    expect(body.evidenceType).toBe("screenshot");
    expect(body.reference).toBe("https://example.com/evidence.png");
    expect(typeof body.publicId).toBe("string");

    expect(await screen.findByText(/https:\/\/example.com\/evidence.png/)).toBeInTheDocument();
  });

  it("rejects a javascript: reference client-side before ever calling fetch", async () => {
    const fetchMock = vi.fn();
    global.fetch = fetchMock as typeof fetch;

    render(
      <ScanEvidenceSection projectId={PROJECT_ID} findingId={FINDING_ID} initialEvidence={[]} />,
    );
    fireEvent.change(screen.getByLabelText("Reference URL"), {
      target: { value: "javascript:alert(1)" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Add evidence" }));

    expect(await screen.findByRole("alert")).toHaveTextContent(/valid http/);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("renders a stored javascript: reference as inert text, not a clickable link", () => {
    render(
      <ScanEvidenceSection
        projectId={PROJECT_ID}
        findingId={FINDING_ID}
        initialEvidence={[
          {
            id: "ev-1",
            projectId: PROJECT_ID,
            publicId: "EVD-1",
            scanFindingId: FINDING_ID,
            evidenceType: "note",
            reference: "javascript:alert(1)",
            notes: null,
            capturedAt: null,
            createdBy: null,
            createdAt: "2026-09-02T00:00:00.000Z",
            updatedAt: "2026-09-02T00:00:00.000Z",
          },
        ]}
      />,
    );
    expect(screen.getByText(/javascript:alert\(1\)/)).toBeInTheDocument();
    expect(screen.queryByRole("link")).not.toBeInTheDocument();
  });

  it("shows the backend's error message on a failed add", async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: false,
      json: async () => ({
        success: false,
        error: { code: "NotFoundException", message: "Scan finding not found" },
        correlationId: "corr-1",
      }),
    } as Response);
    global.fetch = fetchMock as unknown as typeof fetch;

    render(
      <ScanEvidenceSection projectId={PROJECT_ID} findingId={FINDING_ID} initialEvidence={[]} />,
    );
    fireEvent.click(screen.getByRole("button", { name: "Add evidence" }));

    expect(await screen.findByRole("alert")).toHaveTextContent(/Scan finding not found/);
  });
});
