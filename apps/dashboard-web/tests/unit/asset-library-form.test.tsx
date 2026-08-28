import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { Asset } from "@webdesk/shared-types";

const pushMock = vi.fn();

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: pushMock }),
}));

import { AssetLibraryForm } from "../../components/asset-library-form.js";

const ASSET_ID = "11111111-1111-1111-1111-111111111111";

function successResponse(id: string): Response {
  return {
    ok: true,
    json: async () => ({ success: true, data: { id }, correlationId: "corr-1" }),
  } as Response;
}

function assetFixture(overrides: Partial<Asset> = {}): Asset {
  return {
    id: ASSET_ID,
    publicId: "ASSET-1",
    title: "Homepage hero image",
    description: null,
    fileReference: null,
    mimeType: null,
    fileSizeBytes: null,
    checksum: null,
    widthPx: null,
    heightPx: null,
    durationSeconds: null,
    licence: null,
    licenceHolder: null,
    consentReference: null,
    altTextGuidance: null,
    visibility: "internal",
    retentionNote: null,
    scanStatus: "not_configured",
    approvalStatus: "draft",
    version: 1,
    isPublished: false,
    publishedAt: null,
    createdBy: null,
    updatedBy: null,
    createdAt: "2026-08-28T00:00:00.000Z",
    updatedAt: "2026-08-28T00:00:00.000Z",
    ...overrides,
  };
}

describe("AssetLibraryForm", () => {
  const originalFetch = global.fetch;

  beforeEach(() => {
    process.env.NEXT_PUBLIC_API_BASE_URL = "https://api.example.com";
    pushMock.mockReset();
  });

  afterEach(() => {
    global.fetch = originalFetch;
    vi.restoreAllMocks();
  });

  it("create mode: publicId/title are real HTML required fields", () => {
    render(<AssetLibraryForm mode="create" />);
    expect(screen.getByLabelText("Public ID")).toBeRequired();
    expect(screen.getByLabelText("Title")).toBeRequired();
  });

  it("renders a rich-text editor (not a plain textarea) for every long-text field", () => {
    render(<AssetLibraryForm mode="create" />);
    expect(document.querySelectorAll("textarea")).toHaveLength(0);
    // description, licence, consentReference, altTextGuidance, retentionNote
    expect(document.querySelectorAll('[contenteditable="true"]')).toHaveLength(5);
  });

  it("create mode: submits publicId/title, omitting untouched fields entirely", async () => {
    const fetchMock = vi.fn().mockResolvedValue(successResponse(ASSET_ID));
    global.fetch = fetchMock as typeof fetch;

    render(<AssetLibraryForm mode="create" />);
    fireEvent.change(screen.getByLabelText("Public ID"), { target: { value: "ASSET-NEW" } });
    fireEvent.change(screen.getByLabelText("Title"), { target: { value: "New hero image" } });
    fireEvent.click(screen.getByRole("button", { name: "Create asset" }));

    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(1));
    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toBe("https://api.example.com/asset-library/assets");
    const body = JSON.parse(init.body as string);
    expect(body.publicId).toBe("ASSET-NEW");
    expect(body.title).toBe("New hero image");
    expect(body).not.toHaveProperty("fileReference");
    expect(body).not.toHaveProperty("description");
    expect(body).not.toHaveProperty("widthPx");
    expect(body.visibility).toBe("internal");
    await waitFor(() => expect(pushMock).toHaveBeenCalledWith(`/asset-library/${ASSET_ID}`));
  });

  it("edit mode: never sends approvalStatus/scanStatus/version/isPublished/publishedAt/publicId", async () => {
    const fetchMock = vi.fn().mockResolvedValue(successResponse(ASSET_ID));
    global.fetch = fetchMock as typeof fetch;

    render(
      <AssetLibraryForm
        mode="edit"
        assetId={ASSET_ID}
        initial={assetFixture({ title: "Was set" })}
      />,
    );
    fireEvent.change(screen.getByLabelText("Title"), { target: { value: "Renamed" } });
    fireEvent.click(screen.getByRole("button", { name: "Save changes" }));

    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(1));
    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toBe(`https://api.example.com/asset-library/assets/${ASSET_ID}/update`);
    const body = JSON.parse(init.body as string);
    expect(body.title).toBe("Renamed");
    expect(body).not.toHaveProperty("approvalStatus");
    expect(body).not.toHaveProperty("scanStatus");
    expect(body).not.toHaveProperty("version");
    expect(body).not.toHaveProperty("isPublished");
    expect(body).not.toHaveProperty("publishedAt");
    expect(body).not.toHaveProperty("publicId");
  });

  it("edit mode: clearing a previously-set file reference sends an explicit null, not an empty string", async () => {
    const fetchMock = vi.fn().mockResolvedValue(successResponse(ASSET_ID));
    global.fetch = fetchMock as typeof fetch;

    render(
      <AssetLibraryForm
        mode="edit"
        assetId={ASSET_ID}
        initial={assetFixture({ fileReference: "https://cdn.example.com/hero.png" })}
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

    render(<AssetLibraryForm mode="create" />);
    fireEvent.change(screen.getByLabelText("Public ID"), { target: { value: "ASSET-NEW" } });
    fireEvent.change(screen.getByLabelText("Title"), { target: { value: "X" } });
    fireEvent.change(screen.getByLabelText("File reference"), {
      target: { value: "javascript:alert(1)" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Create asset" }));

    expect(await screen.findByRole("alert")).toHaveTextContent(
      "File reference must be a valid http:// or https:// URL.",
    );
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("rejects a non-numeric file size client-side and never fires the request", async () => {
    const fetchMock = vi.fn();
    global.fetch = fetchMock as typeof fetch;

    render(<AssetLibraryForm mode="create" />);
    fireEvent.change(screen.getByLabelText("Public ID"), { target: { value: "ASSET-NEW" } });
    fireEvent.change(screen.getByLabelText("Title"), { target: { value: "X" } });
    fireEvent.change(screen.getByLabelText("File size (bytes)"), {
      target: { value: "not-a-number" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Create asset" }));

    expect(await screen.findByRole("alert")).toHaveTextContent(
      "File size (bytes) must be a non-negative whole number.",
    );
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("shows the backend's error message and does not navigate on a failed submit", async () => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: false,
      status: 400,
      json: async () => ({
        success: false,
        error: { code: "BadRequestException", message: "publicId already in use: ASSET-NEW" },
        correlationId: "corr-1",
      }),
    } as Response) as typeof fetch;

    render(<AssetLibraryForm mode="create" />);
    fireEvent.change(screen.getByLabelText("Public ID"), { target: { value: "ASSET-NEW" } });
    fireEvent.change(screen.getByLabelText("Title"), { target: { value: "X" } });
    fireEvent.click(screen.getByRole("button", { name: "Create asset" }));

    expect(await screen.findByRole("alert")).toHaveTextContent(
      "publicId already in use: ASSET-NEW",
    );
    expect(pushMock).not.toHaveBeenCalled();
  });

  it("edit mode: a rich-text field's initial HTML content loads into its editor", async () => {
    render(
      <AssetLibraryForm
        mode="edit"
        assetId={ASSET_ID}
        initial={assetFixture({ description: "<p>Use only above the fold</p>" })}
      />,
    );
    await waitFor(() => expect(screen.getByText("Use only above the fold")).toBeInTheDocument());
  });

  it("edit mode: publicId is shown read-only, not as an editable field", () => {
    render(
      <AssetLibraryForm
        mode="edit"
        assetId={ASSET_ID}
        initial={assetFixture({ publicId: "ASSET-READONLY" })}
      />,
    );
    expect(screen.queryByLabelText("Public ID")).not.toBeInTheDocument();
    expect(screen.getByText("ASSET-READONLY")).toBeInTheDocument();
  });

  it("edit mode: a restricted record with a redacted (omitted-key, i.e. undefined) consent reference shows an inert notice instead of an editable field, and omits it from the submit payload", async () => {
    const fetchMock = vi.fn().mockResolvedValue(successResponse(ASSET_ID));
    global.fetch = fetchMock as typeof fetch;

    // The real backend redacts by DELETING the key (AuthorizationService's
    // redactConfidentialFields()), so a genuinely redacted field reads back as `undefined`, not
    // `null` — this fixture mirrors that exactly, not a plain `null` (a null value would mean a
    // real, visible, genuinely-empty field instead).
    render(
      <AssetLibraryForm
        mode="edit"
        assetId={ASSET_ID}
        initial={assetFixture({ visibility: "restricted", consentReference: undefined })}
      />,
    );
    expect(screen.queryByLabelText("Consent reference")).not.toBeInTheDocument();
    expect(screen.getByText(/don.t have permission to view or change it/i)).toBeInTheDocument();

    fireEvent.change(screen.getByLabelText("Title"), { target: { value: "Renamed" } });
    fireEvent.click(screen.getByRole("button", { name: "Save changes" }));

    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(1));
    const [, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    const body = JSON.parse(init.body as string);
    expect(body).not.toHaveProperty("consentReference");
  });

  it("edit mode: a restricted record with a redacted (undefined) file reference shows an inert notice instead of an editable field, and omits it from the submit payload", async () => {
    const fetchMock = vi.fn().mockResolvedValue(successResponse(ASSET_ID));
    global.fetch = fetchMock as typeof fetch;

    render(
      <AssetLibraryForm
        mode="edit"
        assetId={ASSET_ID}
        initial={assetFixture({ visibility: "restricted", fileReference: undefined })}
      />,
    );
    expect(screen.queryByLabelText("File reference")).not.toBeInTheDocument();
    expect(screen.getByText(/don.t have permission to view or change it/i)).toBeInTheDocument();

    fireEvent.change(screen.getByLabelText("Title"), { target: { value: "Renamed" } });
    fireEvent.click(screen.getByRole("button", { name: "Save changes" }));

    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(1));
    const [, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    const body = JSON.parse(init.body as string);
    expect(body).not.toHaveProperty("fileReference");
  });

  it("edit mode: a restricted record with a genuinely-null (real, visible, never-set) consent reference is normally editable, not treated as redacted", async () => {
    const fetchMock = vi.fn().mockResolvedValue(successResponse(ASSET_ID));
    global.fetch = fetchMock as typeof fetch;

    render(
      <AssetLibraryForm
        mode="edit"
        assetId={ASSET_ID}
        initial={assetFixture({ visibility: "restricted", consentReference: null })}
      />,
    );
    expect(
      screen.queryByText(/don.t have permission to view or change it/i),
    ).not.toBeInTheDocument();
    // RichTextEditor is a contenteditable div, not a real form control with a native
    // label/for association — checking for the editor id directly, matching this codebase's own
    // established testing convention for rich-text fields (see the "renders a rich-text editor"
    // test above, which counts contenteditable elements rather than using getByLabelText).
    expect(document.getElementById("consentReference")).toBeInTheDocument();
  });

  it("edit mode: a restricted record whose consent reference is a real value (the caller genuinely holds view_confidential) shows the field as normally editable, not the redacted notice", async () => {
    const fetchMock = vi.fn().mockResolvedValue(successResponse(ASSET_ID));
    global.fetch = fetchMock as typeof fetch;

    render(
      <AssetLibraryForm
        mode="edit"
        assetId={ASSET_ID}
        initial={assetFixture({
          visibility: "restricted",
          consentReference: "<p>Signed release on file, ref #4471</p>",
        })}
      />,
    );
    expect(
      screen.queryByText(/don.t have permission to view or change it/i),
    ).not.toBeInTheDocument();
    await waitFor(() =>
      expect(screen.getByText("Signed release on file, ref #4471")).toBeInTheDocument(),
    );

    fireEvent.click(screen.getByRole("button", { name: "Save changes" }));

    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(1));
    const [, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    const body = JSON.parse(init.body as string);
    expect(body.consentReference).toContain("Signed release on file, ref #4471");
  });
});
