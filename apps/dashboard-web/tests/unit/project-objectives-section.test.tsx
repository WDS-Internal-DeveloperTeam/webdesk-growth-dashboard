import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const refreshMock = vi.fn();

vi.mock("next/navigation", () => ({
  useRouter: () => ({ refresh: refreshMock }),
}));

import { ProjectObjectivesSection } from "../../components/project-objectives-section.js";

const PROJECT_ID = "11111111-1111-1111-1111-111111111111";

describe("ProjectObjectivesSection", () => {
  const originalFetch = global.fetch;

  beforeEach(() => {
    process.env.NEXT_PUBLIC_API_BASE_URL = "https://api.example.com";
    refreshMock.mockReset();
  });

  afterEach(() => {
    global.fetch = originalFetch;
    vi.restoreAllMocks();
  });

  it("renders 'No objectives yet.' when empty", () => {
    render(<ProjectObjectivesSection projectId={PROJECT_ID} initialObjectives={[]} />);
    expect(screen.getByText("No objectives yet.")).toBeInTheDocument();
  });

  it("adds an objective — posting {description}, no refresh needed", async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        success: true,
        data: {
          id: "obj-1",
          description: "Ship v1",
          status: "open",
          createdAt: "2026-08-19T00:00:00.000Z",
          updatedAt: "2026-08-19T00:00:00.000Z",
        },
        correlationId: "corr-1",
      }),
    } as Response);
    global.fetch = fetchMock as unknown as typeof fetch;

    render(<ProjectObjectivesSection projectId={PROJECT_ID} initialObjectives={[]} />);
    fireEvent.change(screen.getByLabelText("Description"), { target: { value: "Ship v1" } });
    fireEvent.click(screen.getByRole("button", { name: "Add objective" }));

    await waitFor(() =>
      expect(fetchMock).toHaveBeenCalledWith(
        `https://api.example.com/projects/${PROJECT_ID}/objectives`,
        expect.objectContaining({
          method: "POST",
          credentials: "include",
          body: JSON.stringify({ description: "Ship v1" }),
        }),
      ),
    );
    expect(await screen.findByText("Ship v1")).toBeInTheDocument();
    // No other section on the page reads objective data, so no router.refresh() is expected.
    expect(refreshMock).not.toHaveBeenCalled();
  });

  it("edits an objective — posting {description, status} to .../:id/update", async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        success: true,
        data: {
          id: "obj-1",
          description: "Ship v1 GA",
          status: "complete",
          createdAt: "2026-08-19T00:00:00.000Z",
          updatedAt: "2026-08-19T01:00:00.000Z",
        },
        correlationId: "corr-1",
      }),
    } as Response);
    global.fetch = fetchMock as unknown as typeof fetch;

    render(
      <ProjectObjectivesSection
        projectId={PROJECT_ID}
        initialObjectives={[
          {
            id: "obj-1",
            description: "Ship v1",
            status: "open",
            createdAt: "2026-08-19T00:00:00.000Z",
            updatedAt: "2026-08-19T00:00:00.000Z",
          },
        ]}
      />,
    );
    fireEvent.click(screen.getByRole("button", { name: "Edit" }));
    // The edit form and the always-visible add-form below it both have a "Description" field —
    // the edit form's is the first one in DOM order. Only the edit form has a "Status" field.
    const [editDescriptionInput] = screen.getAllByLabelText("Description");
    fireEvent.change(editDescriptionInput!, {
      target: { value: "Ship v1 GA" },
    });
    fireEvent.change(screen.getByLabelText("Status"), { target: { value: "complete" } });
    fireEvent.click(screen.getByRole("button", { name: "Save" }));

    await waitFor(() =>
      expect(fetchMock).toHaveBeenCalledWith(
        `https://api.example.com/projects/${PROJECT_ID}/objectives/obj-1/update`,
        expect.objectContaining({
          method: "POST",
          credentials: "include",
          body: JSON.stringify({ description: "Ship v1 GA", status: "complete" }),
        }),
      ),
    );
    expect(await screen.findByText("Ship v1 GA")).toBeInTheDocument();
  });

  it("deletes an objective — calls DELETE on its own id and refreshes", async () => {
    const fetchMock = vi.fn().mockResolvedValue({ ok: true, status: 204 } as Response);
    global.fetch = fetchMock as typeof fetch;

    render(
      <ProjectObjectivesSection
        projectId={PROJECT_ID}
        initialObjectives={[
          {
            id: "obj-1",
            description: "Ship v1",
            status: "open",
            createdAt: "2026-08-19T00:00:00.000Z",
            updatedAt: "2026-08-19T00:00:00.000Z",
          },
        ]}
      />,
    );
    fireEvent.click(screen.getByRole("button", { name: "Delete" }));

    await waitFor(() =>
      expect(fetchMock).toHaveBeenCalledWith(
        `https://api.example.com/projects/${PROJECT_ID}/objectives/obj-1`,
        expect.objectContaining({ method: "DELETE", credentials: "include" }),
      ),
    );
    await waitFor(() => expect(screen.queryByText("Ship v1")).not.toBeInTheDocument());
    expect(screen.getByText("No objectives yet.")).toBeInTheDocument();
  });

  it("shows the backend's error message on a failed add", async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: false,
      json: async () => ({
        success: false,
        error: { code: "BadRequestException", message: "Description is required" },
        correlationId: "corr-1",
      }),
    } as Response);
    global.fetch = fetchMock as unknown as typeof fetch;

    render(<ProjectObjectivesSection projectId={PROJECT_ID} initialObjectives={[]} />);
    fireEvent.change(screen.getByLabelText("Description"), { target: { value: "x" } });
    fireEvent.click(screen.getByRole("button", { name: "Add objective" }));

    expect(await screen.findByRole("alert")).toHaveTextContent("Description is required");
    expect(refreshMock).not.toHaveBeenCalled();
  });
});
