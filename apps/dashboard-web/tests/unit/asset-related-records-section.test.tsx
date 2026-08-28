import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { ModuleRegistrySummary } from "@webdesk/shared-types";

import { AssetRelatedRecordsSection } from "../../components/asset-related-records-section.js";

const ASSET_ID = "11111111-1111-1111-1111-111111111111";
const RECORD_ID = "22222222-2222-2222-2222-222222222222";

function moduleFixture(key: string, displayName: string | null = null): ModuleRegistrySummary {
  return {
    id: key,
    key,
    name: key,
    permissionGroupKey: key,
    displayName,
    description: null,
    navigationGroup: "libraries",
    navigationOrder: 1,
    route: `/${key}`,
    iconReference: null,
  } as ModuleRegistrySummary;
}

describe("AssetRelatedRecordsSection", () => {
  const originalFetch = global.fetch;

  beforeEach(() => {
    process.env.NEXT_PUBLIC_API_BASE_URL = "https://api.example.com";
  });

  afterEach(() => {
    global.fetch = originalFetch;
    vi.restoreAllMocks();
  });

  it("renders 'No related records linked yet.' when empty", () => {
    render(
      <AssetRelatedRecordsSection
        assetId={ASSET_ID}
        initialRecords={[]}
        modules={[moduleFixture("projects", "Projects")]}
      />,
    );
    expect(screen.getByText("No related records linked yet.")).toBeInTheDocument();
  });

  it("shows a warning and disables submit when no modules are available (a failed navigation fetch)", () => {
    render(<AssetRelatedRecordsSection assetId={ASSET_ID} initialRecords={[]} modules={[]} />);
    expect(screen.getByText(/list of target modules couldn.t be loaded/i)).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Link record" })).not.toBeInTheDocument();
  });

  it("links a related record — posts moduleKey/recordId/note to the sub-resource route", async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        success: true,
        data: {
          id: "rel-1",
          assetId: ASSET_ID,
          moduleKey: "projects",
          recordId: RECORD_ID,
          note: "Used on the campaign page",
          createdBy: null,
          createdAt: "2026-08-28T00:00:00.000Z",
          updatedAt: "2026-08-28T00:00:00.000Z",
        },
        correlationId: "corr-1",
      }),
    } as Response);
    global.fetch = fetchMock as unknown as typeof fetch;

    render(
      <AssetRelatedRecordsSection
        assetId={ASSET_ID}
        initialRecords={[]}
        modules={[moduleFixture("projects", "Projects")]}
      />,
    );
    fireEvent.change(screen.getByLabelText("Record ID"), { target: { value: RECORD_ID } });
    fireEvent.change(screen.getByLabelText("Note"), {
      target: { value: "Used on the campaign page" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Link record" }));

    await waitFor(() =>
      expect(fetchMock).toHaveBeenCalledWith(
        `https://api.example.com/asset-library/assets/${ASSET_ID}/related-records`,
        expect.objectContaining({
          method: "POST",
          credentials: "include",
          body: JSON.stringify({
            moduleKey: "projects",
            recordId: RECORD_ID,
            note: "Used on the campaign page",
          }),
        }),
      ),
    );
    expect(
      await screen.findByText(/Projects.*22222222-2222-2222-2222-222222222222/),
    ).toBeInTheDocument();
  });

  it("rejects a malformed record id client-side and never fires the request", async () => {
    const fetchMock = vi.fn();
    global.fetch = fetchMock as typeof fetch;

    render(
      <AssetRelatedRecordsSection
        assetId={ASSET_ID}
        initialRecords={[]}
        modules={[moduleFixture("projects", "Projects")]}
      />,
    );
    fireEvent.change(screen.getByLabelText("Record ID"), { target: { value: "not-a-uuid" } });
    fireEvent.click(screen.getByRole("button", { name: "Link record" }));

    expect(await screen.findByRole("alert")).toHaveTextContent(/valid record ID/);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("edits a related record's note, and only sends the note field", async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        success: true,
        data: {
          id: "rel-1",
          assetId: ASSET_ID,
          moduleKey: "projects",
          recordId: RECORD_ID,
          note: "Updated note",
          createdBy: null,
          createdAt: "2026-08-28T00:00:00.000Z",
          updatedAt: "2026-08-28T00:01:00.000Z",
        },
        correlationId: "corr-1",
      }),
    } as Response);
    global.fetch = fetchMock as unknown as typeof fetch;

    render(
      <AssetRelatedRecordsSection
        assetId={ASSET_ID}
        initialRecords={[
          {
            id: "rel-1",
            assetId: ASSET_ID,
            moduleKey: "projects",
            recordId: RECORD_ID,
            note: "Original note",
            createdBy: null,
            createdAt: "2026-08-28T00:00:00.000Z",
            updatedAt: "2026-08-28T00:00:00.000Z",
          },
        ]}
        modules={[moduleFixture("projects", "Projects")]}
      />,
    );
    fireEvent.click(screen.getByRole("button", { name: "Edit note" }));
    // Both the still-visible add-form and the now-open edit-form each render their own "Note"
    // field, so `getByLabelText("Note")` alone is ambiguous — target the edit form's field by id.
    fireEvent.change(document.getElementById("edit-related-record-note-rel-1")!, {
      target: { value: "Updated note" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Save" }));

    await waitFor(() =>
      expect(fetchMock).toHaveBeenCalledWith(
        `https://api.example.com/asset-library/assets/${ASSET_ID}/related-records/rel-1/update`,
        expect.objectContaining({
          method: "POST",
          credentials: "include",
          body: JSON.stringify({ note: "Updated note" }),
        }),
      ),
    );
    expect(await screen.findByText("Updated note")).toBeInTheDocument();
  });

  it("unlinks a related record via POST .../:id/delete", async () => {
    const fetchMock = vi.fn().mockResolvedValue({ ok: true } as Response);
    global.fetch = fetchMock as unknown as typeof fetch;

    render(
      <AssetRelatedRecordsSection
        assetId={ASSET_ID}
        initialRecords={[
          {
            id: "rel-1",
            assetId: ASSET_ID,
            moduleKey: "projects",
            recordId: RECORD_ID,
            note: null,
            createdBy: null,
            createdAt: "2026-08-28T00:00:00.000Z",
            updatedAt: "2026-08-28T00:00:00.000Z",
          },
        ]}
        modules={[moduleFixture("projects", "Projects")]}
      />,
    );
    fireEvent.click(screen.getByRole("button", { name: "Unlink" }));

    await waitFor(() =>
      expect(fetchMock).toHaveBeenCalledWith(
        `https://api.example.com/asset-library/assets/${ASSET_ID}/related-records/rel-1/delete`,
        expect.objectContaining({ method: "POST", credentials: "include" }),
      ),
    );
    expect(screen.getByText("No related records linked yet.")).toBeInTheDocument();
  });

  it("falls back to the raw module key when the label lookup finds no match", () => {
    render(
      <AssetRelatedRecordsSection
        assetId={ASSET_ID}
        initialRecords={[
          {
            id: "rel-1",
            assetId: ASSET_ID,
            moduleKey: "some_unknown_module",
            recordId: RECORD_ID,
            note: null,
            createdBy: null,
            createdAt: "2026-08-28T00:00:00.000Z",
            updatedAt: "2026-08-28T00:00:00.000Z",
          },
        ]}
        modules={[moduleFixture("projects", "Projects")]}
      />,
    );
    expect(screen.getByText(/some_unknown_module/)).toBeInTheDocument();
  });
});
