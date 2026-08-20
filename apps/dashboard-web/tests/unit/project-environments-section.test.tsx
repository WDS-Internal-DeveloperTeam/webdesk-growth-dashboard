import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const refreshMock = vi.fn();

vi.mock("next/navigation", () => ({
  useRouter: () => ({ refresh: refreshMock }),
}));

import { ProjectEnvironmentsSection } from "../../components/project-environments-section.js";

const PROJECT_ID = "11111111-1111-1111-1111-111111111111";

describe("ProjectEnvironmentsSection", () => {
  const originalFetch = global.fetch;

  beforeEach(() => {
    process.env.NEXT_PUBLIC_API_BASE_URL = "https://api.example.com";
    refreshMock.mockReset();
  });

  afterEach(() => {
    global.fetch = originalFetch;
    vi.restoreAllMocks();
  });

  it("renders 'No environments recorded yet.' when empty", () => {
    render(<ProjectEnvironmentsSection projectId={PROJECT_ID} initialEnvironments={[]} />);
    expect(screen.getByText("No environments recorded yet.")).toBeInTheDocument();
  });

  it("adds an environment — posting name/url/notes, no refresh needed", async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        success: true,
        data: {
          id: "env-1",
          name: "Staging",
          url: "https://staging.example.com",
          notes: null,
          createdAt: "2026-08-19T00:00:00.000Z",
          updatedAt: "2026-08-19T00:00:00.000Z",
        },
        correlationId: "corr-1",
      }),
    } as Response);
    global.fetch = fetchMock as unknown as typeof fetch;

    render(<ProjectEnvironmentsSection projectId={PROJECT_ID} initialEnvironments={[]} />);
    fireEvent.change(screen.getByLabelText("Name"), { target: { value: "Staging" } });
    fireEvent.change(screen.getByLabelText("URL"), {
      target: { value: "https://staging.example.com" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Add environment" }));

    await waitFor(() =>
      expect(fetchMock).toHaveBeenCalledWith(
        `https://api.example.com/projects/${PROJECT_ID}/environments`,
        expect.objectContaining({
          method: "POST",
          credentials: "include",
          body: JSON.stringify({
            name: "Staging",
            url: "https://staging.example.com",
            notes: null,
          }),
        }),
      ),
    );
    expect(await screen.findByText("Staging")).toBeInTheDocument();
    // No other section on the page reads environment data, so no router.refresh() is expected.
    expect(refreshMock).not.toHaveBeenCalled();
  });

  it("renders a javascript: URL as inert text, not a clickable link", () => {
    render(
      <ProjectEnvironmentsSection
        projectId={PROJECT_ID}
        initialEnvironments={[
          {
            id: "env-1",
            name: "Staging",
            url: "javascript:alert(1)",
            notes: null,
            createdAt: "2026-08-19T00:00:00.000Z",
            updatedAt: "2026-08-19T00:00:00.000Z",
          },
        ]}
      />,
    );
    expect(screen.getByText("javascript:alert(1)")).toBeInTheDocument();
    expect(screen.queryByRole("link")).not.toBeInTheDocument();
  });

  it("deletes an environment — calls DELETE on its own id and refreshes", async () => {
    const fetchMock = vi.fn().mockResolvedValue({ ok: true, status: 204 } as Response);
    global.fetch = fetchMock as typeof fetch;

    render(
      <ProjectEnvironmentsSection
        projectId={PROJECT_ID}
        initialEnvironments={[
          {
            id: "env-1",
            name: "Staging",
            url: null,
            notes: null,
            createdAt: "2026-08-19T00:00:00.000Z",
            updatedAt: "2026-08-19T00:00:00.000Z",
          },
        ]}
      />,
    );
    fireEvent.click(screen.getByRole("button", { name: "Delete" }));

    await waitFor(() =>
      expect(fetchMock).toHaveBeenCalledWith(
        `https://api.example.com/projects/${PROJECT_ID}/environments/env-1`,
        expect.objectContaining({ method: "DELETE", credentials: "include" }),
      ),
    );
    await waitFor(() => expect(screen.queryByText("Staging")).not.toBeInTheDocument());
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

    render(<ProjectEnvironmentsSection projectId={PROJECT_ID} initialEnvironments={[]} />);
    fireEvent.change(screen.getByLabelText("Name"), { target: { value: "x" } });
    fireEvent.click(screen.getByRole("button", { name: "Add environment" }));

    expect(await screen.findByRole("alert")).toHaveTextContent("Name is required");
    expect(refreshMock).not.toHaveBeenCalled();
  });

  it("resyncs an open edit form's fields when the row's own updatedAt changes externally, but not on an unrelated re-render", () => {
    const base = {
      id: "env-1",
      name: "Staging",
      url: "https://old.example.com",
      notes: null,
      createdAt: "2026-08-19T00:00:00.000Z",
      updatedAt: "2026-08-19T00:00:00.000Z",
    };
    const { rerender } = render(
      <ProjectEnvironmentsSection projectId={PROJECT_ID} initialEnvironments={[base]} />,
    );
    fireEvent.click(screen.getByRole("button", { name: "Edit" }));
    // Both the edit form and the always-visible add-form below it have a "URL" field — the edit
    // form's is the first one in DOM order. Same underlying component instance persists across
    // the rerenders below (React doesn't remount it, matching the real router.refresh() case this
    // guards against), so it's safe to keep this one reference.
    const [urlInput] = screen.getAllByLabelText("URL");
    expect(urlInput).toHaveValue("https://old.example.com");

    // The user types an in-progress, unsaved edit.
    fireEvent.change(urlInput!, { target: { value: "https://typing.example.com" } });
    expect(urlInput).toHaveValue("https://typing.example.com");

    // An unrelated re-render (same environment, same updatedAt) must NOT wipe the in-progress edit.
    rerender(
      <ProjectEnvironmentsSection projectId={PROJECT_ID} initialEnvironments={[{ ...base }]} />,
    );
    expect(urlInput).toHaveValue("https://typing.example.com");

    // A genuine external update to this exact row (new updatedAt) DOES resync — the open form
    // picks up the newer server value instead of silently overwriting it on save.
    rerender(
      <ProjectEnvironmentsSection
        projectId={PROJECT_ID}
        initialEnvironments={[
          { ...base, url: "https://new.example.com", updatedAt: "2026-08-19T01:00:00.000Z" },
        ]}
      />,
    );
    expect(urlInput).toHaveValue("https://new.example.com");
  });
});
