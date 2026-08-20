import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const refreshMock = vi.fn();

vi.mock("next/navigation", () => ({
  useRouter: () => ({ refresh: refreshMock }),
}));

import { ProjectRoadmapSection } from "../../components/project-roadmap-section.js";

const PROJECT_ID = "11111111-1111-1111-1111-111111111111";

const ITEM_A = {
  id: "item-a",
  name: "Discovery",
  sequence: 0,
  status: "active" as const,
  createdAt: "2026-08-19T00:00:00.000Z",
  updatedAt: "2026-08-19T00:00:00.000Z",
};

const ITEM_B = {
  id: "item-b",
  name: "Build",
  sequence: 1,
  status: "not_started" as const,
  createdAt: "2026-08-19T00:00:00.000Z",
  updatedAt: "2026-08-19T00:00:00.000Z",
};

describe("ProjectRoadmapSection", () => {
  const originalFetch = global.fetch;

  beforeEach(() => {
    process.env.NEXT_PUBLIC_API_BASE_URL = "https://api.example.com";
    refreshMock.mockReset();
  });

  afterEach(() => {
    global.fetch = originalFetch;
    vi.restoreAllMocks();
  });

  it("renders 'No roadmap items yet.' when empty", () => {
    render(
      <ProjectRoadmapSection
        projectId={PROJECT_ID}
        initialRoadmapItems={[]}
        initialActivePhaseId={null}
      />,
    );
    expect(screen.getByText("No roadmap items yet.")).toBeInTheDocument();
  });

  it("adds a roadmap item — posting name and numeric sequence, and refreshing", async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        success: true,
        data: {
          id: "item-c",
          name: "Launch",
          sequence: 2,
          status: "not_started",
          createdAt: "2026-08-19T00:00:00.000Z",
          updatedAt: "2026-08-19T00:00:00.000Z",
        },
        correlationId: "corr-1",
      }),
    } as Response);
    global.fetch = fetchMock as unknown as typeof fetch;

    render(
      <ProjectRoadmapSection
        projectId={PROJECT_ID}
        initialRoadmapItems={[]}
        initialActivePhaseId={null}
      />,
    );
    fireEvent.change(screen.getByLabelText("Name"), { target: { value: "Launch" } });
    fireEvent.change(screen.getByLabelText("Sequence"), { target: { value: "2" } });
    fireEvent.click(screen.getByRole("button", { name: "Add roadmap item" }));

    await waitFor(() =>
      expect(fetchMock).toHaveBeenCalledWith(
        `https://api.example.com/projects/${PROJECT_ID}/roadmap-items`,
        expect.objectContaining({
          method: "POST",
          credentials: "include",
          body: JSON.stringify({ name: "Launch", sequence: 2 }),
        }),
      ),
    );
    expect(await screen.findByText("Launch")).toBeInTheDocument();
    await waitFor(() => expect(refreshMock).toHaveBeenCalledTimes(1));
  });

  it("edits a roadmap item — posts only {name, sequence}, never status", async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        success: true,
        data: { ...ITEM_B, name: "Build phase 1" },
        correlationId: "corr-1",
      }),
    } as Response);
    global.fetch = fetchMock as unknown as typeof fetch;

    render(
      <ProjectRoadmapSection
        projectId={PROJECT_ID}
        initialRoadmapItems={[ITEM_B]}
        initialActivePhaseId={null}
      />,
    );
    fireEvent.click(screen.getByRole("button", { name: "Edit" }));
    // Both the edit form and the always-visible add-form below it have a "Name" field — the edit
    // form's is the first one in DOM order.
    const [editNameInput] = screen.getAllByLabelText("Name");
    fireEvent.change(editNameInput!, { target: { value: "Build phase 1" } });
    fireEvent.click(screen.getByRole("button", { name: "Save" }));

    await waitFor(() =>
      expect(fetchMock).toHaveBeenCalledWith(
        `https://api.example.com/projects/${PROJECT_ID}/roadmap-items/item-b/update`,
        expect.objectContaining({
          method: "POST",
          credentials: "include",
          body: JSON.stringify({ name: "Build phase 1", sequence: 1 }),
        }),
      ),
    );
    expect(await screen.findByText(/Build phase 1/)).toBeInTheDocument();
    // No status field is ever rendered in the edit form.
    expect(screen.queryByLabelText("Status")).not.toBeInTheDocument();
  });

  it("sets an item as the active phase via POST /active-phase, then shows 'Active'", async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        success: true,
        data: { id: PROJECT_ID, activePhaseId: "item-b" },
        correlationId: "corr-1",
      }),
    } as Response);
    global.fetch = fetchMock as unknown as typeof fetch;

    render(
      <ProjectRoadmapSection
        projectId={PROJECT_ID}
        initialRoadmapItems={[ITEM_B]}
        initialActivePhaseId={null}
      />,
    );
    fireEvent.click(screen.getByRole("button", { name: "Set active" }));

    await waitFor(() =>
      expect(fetchMock).toHaveBeenCalledWith(
        `https://api.example.com/projects/${PROJECT_ID}/active-phase`,
        expect.objectContaining({
          method: "POST",
          credentials: "include",
          body: JSON.stringify({ roadmapItemId: "item-b" }),
        }),
      ),
    );
    expect(await screen.findByText("Active")).toBeInTheDocument();
  });

  it("clears the active phase via POST /active-phase with a null id", async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        success: true,
        data: { id: PROJECT_ID, activePhaseId: null },
        correlationId: "corr-1",
      }),
    } as Response);
    global.fetch = fetchMock as unknown as typeof fetch;

    render(
      <ProjectRoadmapSection
        projectId={PROJECT_ID}
        initialRoadmapItems={[ITEM_A]}
        initialActivePhaseId="item-a"
      />,
    );
    expect(screen.getByRole("button", { name: "Clear active phase" })).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Clear active phase" }));

    await waitFor(() =>
      expect(fetchMock).toHaveBeenCalledWith(
        `https://api.example.com/projects/${PROJECT_ID}/active-phase`,
        expect.objectContaining({
          method: "POST",
          credentials: "include",
          body: JSON.stringify({ roadmapItemId: null }),
        }),
      ),
    );
    // Once cleared, the "Clear active phase" toolbar and the row's own "Active" indicator both
    // disappear — the item's own status badge (independently labeled "Active" for status="active")
    // is left rendering, so this asserts on the toolbar/row control, not the ambiguous label text.
    await waitFor(() =>
      expect(screen.queryByRole("button", { name: "Clear active phase" })).not.toBeInTheDocument(),
    );
    expect(screen.getByRole("button", { name: "Set active" })).toBeInTheDocument();
  });

  it("disables Delete for the currently-active item", () => {
    render(
      <ProjectRoadmapSection
        projectId={PROJECT_ID}
        initialRoadmapItems={[ITEM_A, ITEM_B]}
        initialActivePhaseId="item-a"
      />,
    );
    const deleteButtons = screen.getAllByRole("button", { name: "Delete" });
    expect(deleteButtons[0]).toBeDisabled();
    expect(deleteButtons[1]).not.toBeDisabled();
  });

  it("deletes a non-active roadmap item — calls DELETE on its own id and refreshes", async () => {
    const fetchMock = vi.fn().mockResolvedValue({ ok: true, status: 204 } as Response);
    global.fetch = fetchMock as typeof fetch;

    render(
      <ProjectRoadmapSection
        projectId={PROJECT_ID}
        initialRoadmapItems={[ITEM_B]}
        initialActivePhaseId={null}
      />,
    );
    fireEvent.click(screen.getByRole("button", { name: "Delete" }));

    await waitFor(() =>
      expect(fetchMock).toHaveBeenCalledWith(
        `https://api.example.com/projects/${PROJECT_ID}/roadmap-items/item-b`,
        expect.objectContaining({ method: "DELETE", credentials: "include" }),
      ),
    );
    await waitFor(() => expect(screen.queryByText("Build")).not.toBeInTheDocument());
  });

  it("shows the backend's error message on a failed add", async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: false,
      json: async () => ({
        success: false,
        error: { code: "BadRequestException", message: "Name is required" },
        correlationId: "corr-1",
      }),
    } as Response);
    global.fetch = fetchMock as unknown as typeof fetch;

    render(
      <ProjectRoadmapSection
        projectId={PROJECT_ID}
        initialRoadmapItems={[]}
        initialActivePhaseId={null}
      />,
    );
    fireEvent.change(screen.getByLabelText("Name"), { target: { value: "x" } });
    fireEvent.click(screen.getByRole("button", { name: "Add roadmap item" }));

    expect(await screen.findByRole("alert")).toHaveTextContent("Name is required");
    expect(refreshMock).not.toHaveBeenCalled();
  });
});
