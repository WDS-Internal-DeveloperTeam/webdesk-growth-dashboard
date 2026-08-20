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
    // A brand-new item is never the active phase, so nothing else on the page depends on it —
    // no router.refresh() is expected here (unlike handleSetActivePhase).
    expect(refreshMock).not.toHaveBeenCalled();
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

  it("sets an item as the active phase via POST /active-phase, updating both activePhaseId and the item's own status locally", async () => {
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
    // The "Set active" button disappears once the item becomes the active phase (the `isActive`
    // indicator flips) — a real backend response mirrors item.status to "active" too, so the
    // StatusBadge also now reads "Active", the same text as the row's own indicator span; querying
    // by the now-gone action button avoids that ambiguity while still proving activePhaseId
    // updated.
    await waitFor(() =>
      expect(screen.queryByRole("button", { name: "Set active" })).not.toBeInTheDocument(),
    );
    // Confirms the local roadmapItems status was also updated (not just activePhaseId) — the
    // fix for the code-review finding that this handler previously left a stale status badge.
    expect(screen.getAllByText("Active")).toHaveLength(2);
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

  it("deletes a non-active roadmap item — calls DELETE on its own id, no refresh needed", async () => {
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
    // The currently-active item can never reach Delete (disabled), so deleting a non-active item
    // never affects Overview's "Active phase" display — no router.refresh() needed.
    expect(refreshMock).not.toHaveBeenCalled();
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

  // Note: the parseSequence() guard added for the "non-empty, non-finite Sequence value silently
  // serializes to null" fix (code-review finding, this branch) has no dedicated regression test
  // here — jsdom's <input type="number"> value sanitization already rejects any non-finite value
  // at the DOM level (verified directly: both "-" and "1e1000" reset .value to "" the moment
  // it's assigned), so the real-browser transient-typing state that reaches this guard can't be
  // reproduced via fireEvent.change in this test environment. The guard itself remains as
  // defense-in-depth, confirmed correct at the code level during code review.

  it("refreshes when editing the currently-active item (its name is shown in Overview), but not otherwise", async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        success: true,
        data: { ...ITEM_A, name: "Discovery phase 1" },
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
    fireEvent.click(screen.getByRole("button", { name: "Edit" }));
    const [editNameInput] = screen.getAllByLabelText("Name");
    fireEvent.change(editNameInput!, { target: { value: "Discovery phase 1" } });
    fireEvent.click(screen.getByRole("button", { name: "Save" }));

    await waitFor(() =>
      expect(fetchMock).toHaveBeenCalledWith(
        `https://api.example.com/projects/${PROJECT_ID}/roadmap-items/item-a/update`,
        expect.objectContaining({ method: "POST" }),
      ),
    );
    await waitFor(() => expect(refreshMock).toHaveBeenCalledTimes(1));
  });
});
