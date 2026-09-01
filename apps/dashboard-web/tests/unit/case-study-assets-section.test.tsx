import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { Asset, CaseStudyAsset } from "@webdesk/shared-types";

import { CaseStudyAssetsSection } from "../../components/case-study-assets-section.js";

const CASE_STUDY_ID = "11111111-1111-1111-1111-111111111111";
const ASSET_ID = "22222222-2222-2222-2222-222222222222";

function assetFixture(id: string, overrides: Partial<Asset> = {}): Asset {
  return {
    id,
    publicId: `ASSET-${id}`,
    title: "Homepage hero shot",
    description: null,
    mimeType: null,
    fileSizeBytes: null,
    checksum: null,
    widthPx: null,
    heightPx: null,
    durationSeconds: null,
    licence: null,
    licenceHolder: null,
    altTextGuidance: null,
    visibility: "public",
    retentionNote: null,
    scanStatus: "not_configured",
    approvalStatus: "draft",
    version: 1,
    isPublished: false,
    publishedAt: null,
    createdBy: null,
    updatedBy: null,
    createdAt: "2026-08-27T00:00:00.000Z",
    updatedAt: "2026-08-27T00:00:00.000Z",
    ...overrides,
  } as Asset;
}

function linkFixture(id: string, overrides: Partial<CaseStudyAsset> = {}): CaseStudyAsset {
  return {
    id,
    caseStudyId: CASE_STUDY_ID,
    assetId: ASSET_ID,
    role: "hero_screenshot",
    caption: null,
    createdAt: "2026-08-27T00:00:00.000Z",
    updatedAt: "2026-08-27T00:00:00.000Z",
    ...overrides,
  };
}

describe("CaseStudyAssetsSection", () => {
  const originalFetch = global.fetch;

  beforeEach(() => {
    process.env.NEXT_PUBLIC_API_BASE_URL = "https://api.example.com";
  });

  afterEach(() => {
    global.fetch = originalFetch;
    vi.restoreAllMocks();
  });

  it("renders 'No assets linked yet.' when empty", () => {
    render(
      <CaseStudyAssetsSection
        caseStudyId={CASE_STUDY_ID}
        initialAssets={[]}
        assets={[assetFixture(ASSET_ID)]}
      />,
    );
    expect(screen.getByText("No assets linked yet.")).toBeInTheDocument();
  });

  it("resolves a linked asset's real title from the assets prop", () => {
    render(
      <CaseStudyAssetsSection
        caseStudyId={CASE_STUDY_ID}
        initialAssets={[linkFixture("link-1")]}
        assets={[assetFixture(ASSET_ID)]}
      />,
    );
    expect(screen.getByText("Homepage hero shot")).toBeInTheDocument();
  });

  it("falls back to the raw asset id when it's outside the fetched assets list", () => {
    render(
      <CaseStudyAssetsSection
        caseStudyId={CASE_STUDY_ID}
        initialAssets={[linkFixture("link-1", { assetId: "99999999-9999-9999-9999-999999999999" })]}
        assets={[assetFixture(ASSET_ID)]}
      />,
    );
    expect(screen.getByText("99999999-9999-9999-9999-999999999999")).toBeInTheDocument();
  });

  it("adding: selecting an asset via the picker posts assetId/role/caption to the sub-resource route", async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        success: true,
        data: linkFixture("link-1", { role: "logo", caption: "Client logo" }),
        correlationId: "corr-1",
      }),
    } as Response);
    global.fetch = fetchMock as unknown as typeof fetch;

    render(
      <CaseStudyAssetsSection
        caseStudyId={CASE_STUDY_ID}
        initialAssets={[]}
        assets={[assetFixture(ASSET_ID)]}
      />,
    );
    fireEvent.change(screen.getByLabelText("Role"), { target: { value: "logo" } });
    fireEvent.change(screen.getByLabelText("Caption (optional)"), {
      target: { value: "Client logo" },
    });
    fireEvent.change(screen.getByRole("combobox", { name: "Asset" }), {
      target: { value: "Homepage" },
    });
    fireEvent.click(screen.getByText("Homepage hero shot"));

    await waitFor(() =>
      expect(fetchMock).toHaveBeenCalledWith(
        `https://api.example.com/case-study-studio/case-studies/${CASE_STUDY_ID}/assets`,
        expect.objectContaining({
          method: "POST",
          credentials: "include",
          body: JSON.stringify({ assetId: ASSET_ID, role: "logo", caption: "Client logo" }),
        }),
      ),
    );
    expect(await screen.findByText("Client logo", { exact: false })).toBeInTheDocument();
  });

  it("editing: Save posts role/caption to the .../:id/update route and updates the row", async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        success: true,
        data: linkFixture("link-1", { role: "video", caption: "Updated" }),
        correlationId: "corr-1",
      }),
    } as Response);
    global.fetch = fetchMock as unknown as typeof fetch;

    render(
      <CaseStudyAssetsSection
        caseStudyId={CASE_STUDY_ID}
        initialAssets={[linkFixture("link-1")]}
        assets={[assetFixture(ASSET_ID)]}
      />,
    );
    fireEvent.click(screen.getByRole("button", { name: "Edit" }));
    const roleSelect = screen.getAllByLabelText("Role")[0]!;
    fireEvent.change(roleSelect, { target: { value: "video" } });
    fireEvent.click(screen.getByRole("button", { name: "Save" }));

    await waitFor(() =>
      expect(fetchMock).toHaveBeenCalledWith(
        `https://api.example.com/case-study-studio/case-studies/${CASE_STUDY_ID}/assets/link-1/update`,
        expect.objectContaining({
          method: "POST",
          credentials: "include",
          body: JSON.stringify({ role: "video", caption: null }),
        }),
      ),
    );
    expect(await screen.findByText("Updated", { exact: false })).toBeInTheDocument();
  });

  it("removing: posts to the .../:id/delete route and removes the row", async () => {
    const fetchMock = vi.fn().mockResolvedValue({ ok: true, status: 204 } as Response);
    global.fetch = fetchMock as typeof fetch;

    render(
      <CaseStudyAssetsSection
        caseStudyId={CASE_STUDY_ID}
        initialAssets={[linkFixture("link-1")]}
        assets={[assetFixture(ASSET_ID)]}
      />,
    );
    fireEvent.click(screen.getByRole("button", { name: "Remove" }));

    await waitFor(() =>
      expect(fetchMock).toHaveBeenCalledWith(
        `https://api.example.com/case-study-studio/case-studies/${CASE_STUDY_ID}/assets/link-1/delete`,
        expect.objectContaining({ method: "POST", credentials: "include" }),
      ),
    );
    // "Homepage hero shot" still appears elsewhere on the page (it's back in the picker's own
    // option list now that it's unlinked) — the real signal that the row was removed is the
    // empty-state message reappearing.
    await waitFor(() => expect(screen.getByText("No assets linked yet.")).toBeInTheDocument());
  });

  it("shows the backend's error message on a failed add", async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: false,
      json: async () => ({
        success: false,
        error: { code: "BadRequestException", message: "assetId not found" },
        correlationId: "corr-1",
      }),
    } as Response);
    global.fetch = fetchMock as unknown as typeof fetch;

    render(
      <CaseStudyAssetsSection
        caseStudyId={CASE_STUDY_ID}
        initialAssets={[]}
        assets={[assetFixture(ASSET_ID)]}
      />,
    );
    fireEvent.change(screen.getByRole("combobox", { name: "Asset" }), {
      target: { value: "Homepage" },
    });
    fireEvent.click(screen.getByText("Homepage hero shot"));

    expect(await screen.findByRole("alert")).toHaveTextContent("assetId not found");
  });
});
