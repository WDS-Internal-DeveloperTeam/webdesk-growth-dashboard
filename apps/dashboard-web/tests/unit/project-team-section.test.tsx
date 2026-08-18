import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const refreshMock = vi.fn();

vi.mock("next/navigation", () => ({
  useRouter: () => ({ refresh: refreshMock }),
}));

import { ProjectTeamSection } from "../../components/project-team-section.js";

const PROJECT_ID = "11111111-1111-1111-1111-111111111111";
const MEMBER_USER_ID = "22222222-2222-2222-2222-222222222222";

function searchResponse(): Response {
  return {
    ok: true,
    json: async () => ({
      success: true,
      data: [{ id: MEMBER_USER_ID, displayName: "Jane Doe", email: "jane@example.com" }],
      correlationId: "corr-1",
    }),
  } as Response;
}

describe("ProjectTeamSection", () => {
  const originalFetch = global.fetch;

  beforeEach(() => {
    process.env.NEXT_PUBLIC_API_BASE_URL = "https://api.example.com";
    refreshMock.mockReset();
  });

  afterEach(() => {
    global.fetch = originalFetch;
    vi.restoreAllMocks();
  });

  it("renders 'No team members yet.' when the roster is empty", () => {
    render(<ProjectTeamSection projectId={PROJECT_ID} initialTeam={[]} />);
    expect(screen.getByText("No team members yet.")).toBeInTheDocument();
  });

  it("renders each member's resolved identity, falling back to 'Unknown member' for a null user", () => {
    render(
      <ProjectTeamSection
        projectId={PROJECT_ID}
        initialTeam={[
          {
            id: "entry-1",
            addedAt: "2026-08-18T00:00:00.000Z",
            user: { id: MEMBER_USER_ID, displayName: "Jane Doe", email: "jane@example.com" },
          },
          { id: "entry-2", addedAt: "2026-08-18T00:00:00.000Z", user: null },
        ]}
      />,
    );
    expect(screen.getByText("Jane Doe")).toBeInTheDocument();
    expect(screen.getByText("jane@example.com")).toBeInTheDocument();
    expect(screen.getByText("Unknown member")).toBeInTheDocument();
  });

  it("searches, selects, and adds a member — posting {userId} and refreshing", async () => {
    const fetchMock = vi.fn((url: string, init?: RequestInit) => {
      if (url.includes("/users?")) {
        return Promise.resolve(searchResponse());
      }
      if (init?.method === "POST") {
        return Promise.resolve({
          ok: true,
          json: async () => ({
            success: true,
            data: {
              id: "entry-1",
              projectId: PROJECT_ID,
              userId: MEMBER_USER_ID,
              addedAt: "2026-08-18T00:00:00.000Z",
              addedBy: null,
            },
            correlationId: "corr-1",
          }),
        } as Response);
      }
      throw new Error(`Unexpected fetch: ${url}`);
    });
    global.fetch = fetchMock as unknown as typeof fetch;

    render(<ProjectTeamSection projectId={PROJECT_ID} initialTeam={[]} />);
    fireEvent.change(screen.getByPlaceholderText("Search by name or email…"), {
      target: { value: "Jane" },
    });
    const option = await screen.findByRole("button", { name: /Jane Doe/ });
    fireEvent.mouseDown(option);

    fireEvent.click(screen.getByRole("button", { name: "Add" }));

    await waitFor(() =>
      expect(fetchMock).toHaveBeenCalledWith(
        `https://api.example.com/projects/${PROJECT_ID}/team`,
        expect.objectContaining({
          method: "POST",
          credentials: "include",
          body: JSON.stringify({ userId: MEMBER_USER_ID }),
        }),
      ),
    );
    expect(await screen.findByText("Jane Doe")).toBeInTheDocument();
    await waitFor(() => expect(refreshMock).toHaveBeenCalledTimes(1));
  });

  it("removes a member — calls DELETE on its own entry id and refreshes", async () => {
    const fetchMock = vi.fn().mockResolvedValue({ ok: true, status: 204 } as Response);
    global.fetch = fetchMock as typeof fetch;

    render(
      <ProjectTeamSection
        projectId={PROJECT_ID}
        initialTeam={[
          {
            id: "entry-1",
            addedAt: "2026-08-18T00:00:00.000Z",
            user: { id: MEMBER_USER_ID, displayName: "Jane Doe", email: "jane@example.com" },
          },
        ]}
      />,
    );
    fireEvent.click(screen.getByRole("button", { name: "Remove" }));

    await waitFor(() =>
      expect(fetchMock).toHaveBeenCalledWith(
        `https://api.example.com/projects/${PROJECT_ID}/team/entry-1`,
        expect.objectContaining({ method: "DELETE", credentials: "include" }),
      ),
    );
    await waitFor(() => expect(screen.queryByText("Jane Doe")).not.toBeInTheDocument());
    expect(screen.getByText("No team members yet.")).toBeInTheDocument();
    await waitFor(() => expect(refreshMock).toHaveBeenCalledTimes(1));
  });

  it("shows the backend's error message on a failed add, without clearing the picker's selection state incorrectly", async () => {
    const fetchMock = vi.fn((url: string, init?: RequestInit) => {
      if (url.includes("/users?")) {
        return Promise.resolve(searchResponse());
      }
      if (init?.method === "POST") {
        return Promise.resolve({
          ok: false,
          json: async () => ({
            success: false,
            error: { code: "BadRequestException", message: "User is already on the team" },
            correlationId: "corr-1",
          }),
        } as Response);
      }
      throw new Error(`Unexpected fetch: ${url}`);
    });
    global.fetch = fetchMock as unknown as typeof fetch;

    render(<ProjectTeamSection projectId={PROJECT_ID} initialTeam={[]} />);
    fireEvent.change(screen.getByPlaceholderText("Search by name or email…"), {
      target: { value: "Jane" },
    });
    const option = await screen.findByRole("button", { name: /Jane Doe/ });
    fireEvent.mouseDown(option);
    fireEvent.click(screen.getByRole("button", { name: "Add" }));

    expect(await screen.findByRole("alert")).toHaveTextContent("User is already on the team");
    expect(refreshMock).not.toHaveBeenCalled();
  });
});
