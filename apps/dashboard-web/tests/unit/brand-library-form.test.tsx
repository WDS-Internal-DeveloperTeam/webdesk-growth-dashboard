import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { BrandLibraryRecord } from "@webdesk/shared-types";

const pushMock = vi.fn();

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: pushMock }),
}));

import { BrandLibraryForm } from "../../components/brand-library-form.js";

const RECORD_ID = "11111111-1111-1111-1111-111111111111";

function successResponse(id: string): Response {
  return {
    ok: true,
    json: async () => ({ success: true, data: { id }, correlationId: "corr-1" }),
  } as Response;
}

function recordFixture(overrides: Partial<BrandLibraryRecord> = {}): BrandLibraryRecord {
  return {
    id: RECORD_ID,
    publicId: "BRAND-1",
    recordType: "logo",
    title: "Primary logo",
    description: null,
    fileReference: null,
    usageNotes: null,
    approvalStatus: "draft",
    version: 1,
    isPublished: false,
    publishedAt: null,
    createdBy: null,
    updatedBy: null,
    createdAt: "2026-08-27T00:00:00.000Z",
    updatedAt: "2026-08-27T00:00:00.000Z",
    ...overrides,
  };
}

describe("BrandLibraryForm", () => {
  const originalFetch = global.fetch;

  beforeEach(() => {
    process.env.NEXT_PUBLIC_API_BASE_URL = "https://api.example.com";
    pushMock.mockReset();
  });

  afterEach(() => {
    global.fetch = originalFetch;
    vi.restoreAllMocks();
  });

  it("create mode: publicId/recordType/title are real HTML required fields", () => {
    render(<BrandLibraryForm mode="create" />);
    expect(screen.getByLabelText("Public ID")).toBeRequired();
    expect(screen.getByLabelText("Record type")).toBeRequired();
    expect(screen.getByLabelText("Title")).toBeRequired();
  });

  it("renders a rich-text editor (not a plain textarea) for description/usage notes", () => {
    render(<BrandLibraryForm mode="create" />);
    expect(document.querySelectorAll("textarea")).toHaveLength(0);
    expect(document.querySelectorAll('[contenteditable="true"]')).toHaveLength(2);
  });

  it("create mode: submits publicId/recordType/title, omitting untouched fileReference/description/usageNotes entirely", async () => {
    const fetchMock = vi.fn().mockResolvedValue(successResponse(RECORD_ID));
    global.fetch = fetchMock as typeof fetch;

    render(<BrandLibraryForm mode="create" />);
    fireEvent.change(screen.getByLabelText("Public ID"), { target: { value: "BRAND-NEW" } });
    fireEvent.change(screen.getByLabelText("Record type"), { target: { value: "color" } });
    fireEvent.change(screen.getByLabelText("Title"), { target: { value: "Primary blue" } });
    fireEvent.click(screen.getByRole("button", { name: "Create record" }));

    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(1));
    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toBe("https://api.example.com/brand-library/records");
    const body = JSON.parse(init.body as string);
    expect(body.publicId).toBe("BRAND-NEW");
    expect(body.recordType).toBe("color");
    expect(body.title).toBe("Primary blue");
    expect(body).not.toHaveProperty("fileReference");
    expect(body).not.toHaveProperty("description");
    expect(body).not.toHaveProperty("usageNotes");
    await waitFor(() => expect(pushMock).toHaveBeenCalledWith(`/brand-library/${RECORD_ID}`));
  });

  it("edit mode: never sends approvalStatus/version/isPublished/publishedAt/publicId/recordType", async () => {
    const fetchMock = vi.fn().mockResolvedValue(successResponse(RECORD_ID));
    global.fetch = fetchMock as typeof fetch;

    render(
      <BrandLibraryForm
        mode="edit"
        recordId={RECORD_ID}
        initial={recordFixture({ title: "Was set" })}
      />,
    );
    fireEvent.change(screen.getByLabelText("Title"), { target: { value: "Renamed" } });
    fireEvent.click(screen.getByRole("button", { name: "Save changes" }));

    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(1));
    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toBe(`https://api.example.com/brand-library/records/${RECORD_ID}/update`);
    const body = JSON.parse(init.body as string);
    expect(body.title).toBe("Renamed");
    expect(body).not.toHaveProperty("approvalStatus");
    expect(body).not.toHaveProperty("version");
    expect(body).not.toHaveProperty("isPublished");
    expect(body).not.toHaveProperty("publishedAt");
    expect(body).not.toHaveProperty("publicId");
    expect(body).not.toHaveProperty("recordType");
  });

  it("edit mode: clearing a previously-set file reference sends an explicit null, not an empty string", async () => {
    const fetchMock = vi.fn().mockResolvedValue(successResponse(RECORD_ID));
    global.fetch = fetchMock as typeof fetch;

    render(
      <BrandLibraryForm
        mode="edit"
        recordId={RECORD_ID}
        initial={recordFixture({ fileReference: "https://cdn.example.com/logo.svg" })}
      />,
    );
    fireEvent.change(screen.getByLabelText("File reference"), { target: { value: "" } });
    fireEvent.click(screen.getByRole("button", { name: "Save changes" }));

    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(1));
    const [, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    const body = JSON.parse(init.body as string);
    expect(body.fileReference).toBeNull();
  });

  it("rejects an unsafe file reference scheme client-side and never fires the request", async () => {
    const fetchMock = vi.fn();
    global.fetch = fetchMock as typeof fetch;

    render(<BrandLibraryForm mode="create" />);
    fireEvent.change(screen.getByLabelText("Public ID"), { target: { value: "BRAND-NEW" } });
    fireEvent.change(screen.getByLabelText("Record type"), { target: { value: "logo" } });
    fireEvent.change(screen.getByLabelText("Title"), { target: { value: "X" } });
    fireEvent.change(screen.getByLabelText("File reference"), {
      target: { value: "javascript:alert(1)" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Create record" }));

    expect(await screen.findByRole("alert")).toHaveTextContent(
      "File reference must be a valid http:// or https:// URL.",
    );
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("shows the backend's error message and does not navigate on a failed submit", async () => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: false,
      status: 400,
      json: async () => ({
        success: false,
        error: { code: "BadRequestException", message: "publicId already in use: BRAND-NEW" },
        correlationId: "corr-1",
      }),
    } as Response) as typeof fetch;

    render(<BrandLibraryForm mode="create" />);
    fireEvent.change(screen.getByLabelText("Public ID"), { target: { value: "BRAND-NEW" } });
    fireEvent.change(screen.getByLabelText("Record type"), { target: { value: "logo" } });
    fireEvent.change(screen.getByLabelText("Title"), { target: { value: "X" } });
    fireEvent.click(screen.getByRole("button", { name: "Create record" }));

    expect(await screen.findByRole("alert")).toHaveTextContent(
      "publicId already in use: BRAND-NEW",
    );
    expect(pushMock).not.toHaveBeenCalled();
  });

  it("edit mode: a rich-text field's initial HTML content loads into its editor", async () => {
    render(
      <BrandLibraryForm
        mode="edit"
        recordId={RECORD_ID}
        initial={recordFixture({ description: "<p>Use only on light backgrounds</p>" })}
      />,
    );
    await waitFor(() =>
      expect(screen.getByText("Use only on light backgrounds")).toBeInTheDocument(),
    );
  });

  it("edit mode: publicId and recordType are both shown read-only, not as editable fields", () => {
    render(
      <BrandLibraryForm
        mode="edit"
        recordId={RECORD_ID}
        initial={recordFixture({ publicId: "BRAND-READONLY", recordType: "typography" })}
      />,
    );
    expect(screen.queryByLabelText("Public ID")).not.toBeInTheDocument();
    expect(screen.queryByLabelText("Record type")).not.toBeInTheDocument();
    expect(screen.getByText("BRAND-READONLY")).toBeInTheDocument();
    expect(screen.getByText("Typography")).toBeInTheDocument();
  });
});
