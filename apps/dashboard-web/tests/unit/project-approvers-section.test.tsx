import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { UserSummary } from "@webdesk/shared-types";

const refreshMock = vi.fn();

vi.mock("next/navigation", () => ({
  useRouter: () => ({ refresh: refreshMock }),
}));

import { ProjectApproversSection } from "../../components/project-approvers-section.js";

const PROJECT_ID = "11111111-1111-1111-1111-111111111111";
const APPROVER_USER_ID = "22222222-2222-2222-2222-222222222222";
const ROLE_ID = "33333333-3333-3333-3333-333333333333";

function searchResponse(): Response {
  return {
    ok: true,
    json: async () => ({
      success: true,
      data: [{ id: APPROVER_USER_ID, displayName: "Ada Approver", email: "ada@example.com" }],
      correlationId: "corr-1",
    }),
  } as Response;
}

describe("ProjectApproversSection", () => {
  const originalFetch = global.fetch;

  beforeEach(() => {
    process.env.NEXT_PUBLIC_API_BASE_URL = "https://api.example.com";
    refreshMock.mockReset();
  });

  afterEach(() => {
    global.fetch = originalFetch;
    vi.restoreAllMocks();
  });

  it("renders 'No approvers assigned yet.' when the list is empty", () => {
    render(
      <ProjectApproversSection
        projectId={PROJECT_ID}
        initialApprovers={[]}
        approverRoleId={ROLE_ID}
      />,
    );
    expect(screen.getByText("No approvers assigned yet.")).toBeInTheDocument();
  });

  it("searches, selects, and assigns an approver — posting {userId} and refreshing", async () => {
    const fetchMock = vi.fn((url: string, init?: RequestInit) => {
      if (url.includes("/users?")) {
        return Promise.resolve(searchResponse());
      }
      if (init?.method === "POST") {
        return Promise.resolve({ ok: true, status: 204 } as Response);
      }
      throw new Error(`Unexpected fetch: ${url}`);
    });
    global.fetch = fetchMock as unknown as typeof fetch;

    render(
      <ProjectApproversSection
        projectId={PROJECT_ID}
        initialApprovers={[]}
        approverRoleId={ROLE_ID}
      />,
    );
    fireEvent.change(screen.getByPlaceholderText("Search by name or email…"), {
      target: { value: "Ada" },
    });
    const option = await screen.findByRole("button", { name: /Ada Approver/ });
    fireEvent.mouseDown(option);

    fireEvent.click(screen.getByRole("button", { name: "Add" }));

    await waitFor(() =>
      expect(fetchMock).toHaveBeenCalledWith(
        `https://api.example.com/projects/${PROJECT_ID}/approvers`,
        expect.objectContaining({
          method: "POST",
          credentials: "include",
          body: JSON.stringify({ userId: APPROVER_USER_ID }),
        }),
      ),
    );
    expect(await screen.findByText("Ada Approver")).toBeInTheDocument();
    await waitFor(() => expect(refreshMock).toHaveBeenCalledTimes(1));
  });

  it("removes an approver via the role-assignment revoke endpoint, with the project-scoped query param", async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ success: true, data: { revoked: true }, correlationId: "corr-1" }),
    } as Response);
    global.fetch = fetchMock as typeof fetch;

    render(
      <ProjectApproversSection
        projectId={PROJECT_ID}
        initialApprovers={[
          { id: APPROVER_USER_ID, displayName: "Ada Approver", email: "ada@example.com" },
        ]}
        approverRoleId={ROLE_ID}
      />,
    );
    fireEvent.click(screen.getByRole("button", { name: "Remove" }));

    await waitFor(() =>
      expect(fetchMock).toHaveBeenCalledWith(
        `https://api.example.com/authz/users/${APPROVER_USER_ID}/roles/${ROLE_ID}?projectId=${PROJECT_ID}`,
        expect.objectContaining({ method: "DELETE", credentials: "include" }),
      ),
    );
    await waitFor(() => expect(screen.queryByText("Ada Approver")).not.toBeInTheDocument());
    expect(screen.getByText("No approvers assigned yet.")).toBeInTheDocument();
    await waitFor(() => expect(refreshMock).toHaveBeenCalledTimes(1));
  });

  it("disables Remove (and never calls fetch) when approverRoleId is null", () => {
    const fetchMock = vi.fn();
    global.fetch = fetchMock as typeof fetch;

    render(
      <ProjectApproversSection
        projectId={PROJECT_ID}
        initialApprovers={[
          { id: APPROVER_USER_ID, displayName: "Ada Approver", email: "ada@example.com" },
        ]}
        approverRoleId={null}
      />,
    );
    const removeButton = screen.getByRole("button", { name: "Remove" });
    expect(removeButton).toBeDisabled();

    fireEvent.click(removeButton);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("shows an error and keeps the row when the revoke call returns revoked: false", async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ success: true, data: { revoked: false }, correlationId: "corr-1" }),
    } as Response);
    global.fetch = fetchMock as typeof fetch;

    render(
      <ProjectApproversSection
        projectId={PROJECT_ID}
        initialApprovers={[
          { id: APPROVER_USER_ID, displayName: "Ada Approver", email: "ada@example.com" },
        ]}
        approverRoleId={ROLE_ID}
      />,
    );
    fireEvent.click(screen.getByRole("button", { name: "Remove" }));

    expect(await screen.findByRole("alert")).toHaveTextContent(
      "That approver assignment was already removed.",
    );
    expect(screen.getByText("Ada Approver")).toBeInTheDocument();
    expect(refreshMock).not.toHaveBeenCalled();
  });

  it("resyncs from fresh initialApprovers props after a re-render (router.refresh())", () => {
    const first: readonly UserSummary[] = [
      { id: APPROVER_USER_ID, displayName: "Ada Approver", email: "ada@example.com" },
    ];
    const { rerender } = render(
      <ProjectApproversSection
        projectId={PROJECT_ID}
        initialApprovers={first}
        approverRoleId={ROLE_ID}
      />,
    );
    expect(screen.getByText("Ada Approver")).toBeInTheDocument();

    const second: readonly UserSummary[] = [
      {
        id: "44444444-4444-4444-4444-444444444444",
        displayName: "Bob Backup",
        email: "bob@example.com",
      },
    ];
    rerender(
      <ProjectApproversSection
        projectId={PROJECT_ID}
        initialApprovers={second}
        approverRoleId={ROLE_ID}
      />,
    );
    expect(screen.queryByText("Ada Approver")).not.toBeInTheDocument();
    expect(screen.getByText("Bob Backup")).toBeInTheDocument();
  });

  it("shows the backend's error message on a failed assignment", async () => {
    const fetchMock = vi.fn((url: string, init?: RequestInit) => {
      if (url.includes("/users?")) {
        return Promise.resolve(searchResponse());
      }
      if (init?.method === "POST") {
        return Promise.resolve({
          ok: false,
          json: async () => ({
            success: false,
            error: { code: "BadRequestException", message: "User is already an approver" },
            correlationId: "corr-1",
          }),
        } as Response);
      }
      throw new Error(`Unexpected fetch: ${url}`);
    });
    global.fetch = fetchMock as unknown as typeof fetch;

    render(
      <ProjectApproversSection
        projectId={PROJECT_ID}
        initialApprovers={[]}
        approverRoleId={ROLE_ID}
      />,
    );
    fireEvent.change(screen.getByPlaceholderText("Search by name or email…"), {
      target: { value: "Ada" },
    });
    const option = await screen.findByRole("button", { name: /Ada Approver/ });
    fireEvent.mouseDown(option);
    fireEvent.click(screen.getByRole("button", { name: "Add" }));

    expect(await screen.findByRole("alert")).toHaveTextContent("User is already an approver");
    expect(refreshMock).not.toHaveBeenCalled();
  });
});
