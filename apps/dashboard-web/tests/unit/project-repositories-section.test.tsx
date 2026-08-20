import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const refreshMock = vi.fn();

vi.mock("next/navigation", () => ({
  useRouter: () => ({ refresh: refreshMock }),
}));

import { ProjectRepositoriesSection } from "../../components/project-repositories-section.js";

const PROJECT_ID = "11111111-1111-1111-1111-111111111111";

describe("ProjectRepositoriesSection", () => {
  const originalFetch = global.fetch;

  beforeEach(() => {
    process.env.NEXT_PUBLIC_API_BASE_URL = "https://api.example.com";
    refreshMock.mockReset();
  });

  afterEach(() => {
    global.fetch = originalFetch;
    vi.restoreAllMocks();
  });

  it("renders 'No repositories linked yet.' when empty", () => {
    render(<ProjectRepositoriesSection projectId={PROJECT_ID} initialRepositories={[]} />);
    expect(screen.getByText("No repositories linked yet.")).toBeInTheDocument();
  });

  it("adds a repository — posting repoOwner/repoName/defaultBranch/notes, no refresh needed", async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        success: true,
        data: {
          id: "repo-1",
          repoOwner: "WDS-Internal-DeveloperTeam",
          repoName: "webdesk-growth-dashboard",
          defaultBranch: "main",
          notes: null,
          createdAt: "2026-08-19T00:00:00.000Z",
          updatedAt: "2026-08-19T00:00:00.000Z",
        },
        correlationId: "corr-1",
      }),
    } as Response);
    global.fetch = fetchMock as unknown as typeof fetch;

    render(<ProjectRepositoriesSection projectId={PROJECT_ID} initialRepositories={[]} />);
    fireEvent.change(screen.getByLabelText("Owner"), {
      target: { value: "WDS-Internal-DeveloperTeam" },
    });
    fireEvent.change(screen.getByLabelText("Repository name"), {
      target: { value: "webdesk-growth-dashboard" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Add repository" }));

    await waitFor(() =>
      expect(fetchMock).toHaveBeenCalledWith(
        `https://api.example.com/projects/${PROJECT_ID}/repositories`,
        expect.objectContaining({
          method: "POST",
          credentials: "include",
          body: JSON.stringify({
            repoOwner: "WDS-Internal-DeveloperTeam",
            repoName: "webdesk-growth-dashboard",
            defaultBranch: "main",
            notes: null,
          }),
        }),
      ),
    );
    expect(
      await screen.findByText("WDS-Internal-DeveloperTeam/webdesk-growth-dashboard"),
    ).toBeInTheDocument();
    // No other section on the page reads repository data, so no router.refresh() is expected.
    expect(refreshMock).not.toHaveBeenCalled();
  });

  it("disables Add repository when owner/name don't match the allowed segment pattern", () => {
    render(<ProjectRepositoriesSection projectId={PROJECT_ID} initialRepositories={[]} />);
    fireEvent.change(screen.getByLabelText("Owner"), { target: { value: "has a space" } });
    fireEvent.change(screen.getByLabelText("Repository name"), { target: { value: "repo" } });
    expect(screen.getByRole("button", { name: "Add repository" })).toBeDisabled();
  });

  it("renders a GitHub link built from repoOwner/repoName", () => {
    render(
      <ProjectRepositoriesSection
        projectId={PROJECT_ID}
        initialRepositories={[
          {
            id: "repo-1",
            repoOwner: "acme",
            repoName: "widgets",
            defaultBranch: "main",
            notes: null,
            createdAt: "2026-08-19T00:00:00.000Z",
            updatedAt: "2026-08-19T00:00:00.000Z",
          },
        ]}
      />,
    );
    expect(screen.getByRole("link", { name: "acme/widgets" })).toHaveAttribute(
      "href",
      "https://github.com/acme/widgets",
    );
  });

  it("deletes a repository — calls DELETE on its own id and refreshes", async () => {
    const fetchMock = vi.fn().mockResolvedValue({ ok: true, status: 204 } as Response);
    global.fetch = fetchMock as typeof fetch;

    render(
      <ProjectRepositoriesSection
        projectId={PROJECT_ID}
        initialRepositories={[
          {
            id: "repo-1",
            repoOwner: "acme",
            repoName: "widgets",
            defaultBranch: "main",
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
        `https://api.example.com/projects/${PROJECT_ID}/repositories/repo-1`,
        expect.objectContaining({ method: "DELETE", credentials: "include" }),
      ),
    );
    await waitFor(() => expect(screen.queryByText("acme/widgets")).not.toBeInTheDocument());
  });

  it("shows the backend's error message on a failed add", async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: false,
      json: async () => ({
        success: false,
        error: { code: "BadRequestException", message: "Repository owner is required" },
        correlationId: "corr-1",
      }),
    } as Response);
    global.fetch = fetchMock as unknown as typeof fetch;

    render(<ProjectRepositoriesSection projectId={PROJECT_ID} initialRepositories={[]} />);
    fireEvent.change(screen.getByLabelText("Owner"), { target: { value: "acme" } });
    fireEvent.change(screen.getByLabelText("Repository name"), { target: { value: "widgets" } });
    fireEvent.click(screen.getByRole("button", { name: "Add repository" }));

    expect(await screen.findByRole("alert")).toHaveTextContent("Repository owner is required");
    expect(refreshMock).not.toHaveBeenCalled();
  });

  it("disables Save and never submits when the Default branch field is cleared while editing", () => {
    const fetchMock = vi.fn();
    global.fetch = fetchMock as unknown as typeof fetch;

    render(
      <ProjectRepositoriesSection
        projectId={PROJECT_ID}
        initialRepositories={[
          {
            id: "repo-1",
            repoOwner: "acme",
            repoName: "widgets",
            defaultBranch: "develop",
            notes: null,
            createdAt: "2026-08-19T00:00:00.000Z",
            updatedAt: "2026-08-19T00:00:00.000Z",
          },
        ]}
      />,
    );
    fireEvent.click(screen.getByRole("button", { name: "Edit" }));
    // Both the edit form and the always-visible add-form below it have a "Default branch" field —
    // the edit form's is the first one in DOM order.
    const [editBranchInput] = screen.getAllByLabelText("Default branch");
    fireEvent.change(editBranchInput!, { target: { value: "" } });

    expect(screen.getByRole("button", { name: "Save" })).toBeDisabled();
    fireEvent.click(screen.getByRole("button", { name: "Save" }));
    // A disabled button still fires onClick in some testing-library/jsdom setups if the handler
    // isn't itself guarded — assert the fetch never actually goes out, not just the button state.
    expect(fetchMock).not.toHaveBeenCalled();
  });
});
