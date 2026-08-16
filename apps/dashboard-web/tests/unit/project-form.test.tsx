import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const pushMock = vi.fn();

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: pushMock }),
}));

import { ProjectForm } from "../../components/project-form.js";

const PROJECT_ID = "11111111-1111-1111-1111-111111111111";

function successResponse(id: string): Response {
  return {
    ok: true,
    json: async () => ({
      success: true,
      data: { id, publicId: "acme", name: "Acme", description: null, confidentiality: "internal" },
      correlationId: "corr-1",
    }),
  } as Response;
}

function errorResponse(status: number, message: string): Response {
  return {
    ok: false,
    status,
    json: async () => ({
      success: false,
      error: { code: "BadRequestException", message },
      correlationId: "corr-1",
    }),
  } as Response;
}

describe("ProjectForm", () => {
  const originalFetch = global.fetch;

  beforeEach(() => {
    process.env.NEXT_PUBLIC_API_BASE_URL = "https://api.example.com";
    pushMock.mockReset();
  });

  afterEach(() => {
    global.fetch = originalFetch;
    vi.restoreAllMocks();
  });

  it("create mode: submits publicId/name/description/confidentiality to POST /projects", async () => {
    const fetchMock = vi.fn().mockResolvedValue(successResponse(PROJECT_ID));
    global.fetch = fetchMock as typeof fetch;

    render(<ProjectForm mode="create" />);

    fireEvent.change(screen.getByLabelText("Public ID"), { target: { value: "acme" } });
    fireEvent.change(screen.getByLabelText("Name"), { target: { value: "Acme" } });
    fireEvent.change(screen.getByLabelText("Description"), { target: { value: "A project" } });
    fireEvent.click(screen.getByRole("button", { name: "Create project" }));

    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(1));
    expect(fetchMock).toHaveBeenCalledWith(
      "https://api.example.com/projects",
      expect.objectContaining({
        method: "POST",
        credentials: "include",
        body: JSON.stringify({
          publicId: "acme",
          name: "Acme",
          description: "A project",
          confidentiality: "internal",
        }),
      }),
    );
    await waitFor(() => expect(pushMock).toHaveBeenCalledWith(`/projects/${PROJECT_ID}`));
  });

  it("create mode: sends description as null when left blank", async () => {
    const fetchMock = vi.fn().mockResolvedValue(successResponse(PROJECT_ID));
    global.fetch = fetchMock as typeof fetch;

    render(<ProjectForm mode="create" />);
    fireEvent.change(screen.getByLabelText("Public ID"), { target: { value: "acme" } });
    fireEvent.change(screen.getByLabelText("Name"), { target: { value: "Acme" } });
    fireEvent.click(screen.getByRole("button", { name: "Create project" }));

    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(1));
    const body = JSON.parse((fetchMock.mock.calls[0]?.[1] as RequestInit).body as string);
    expect(body.description).toBeNull();
  });

  it("edit mode: shows the public ID as read-only text, not an input", () => {
    global.fetch = vi.fn() as typeof fetch;
    render(
      <ProjectForm
        mode="edit"
        projectId={PROJECT_ID}
        initial={{
          publicId: "acme",
          name: "Acme",
          description: "Existing description",
          confidentiality: "confidential",
        }}
      />,
    );

    expect(screen.getByText("acme")).toBeInTheDocument();
    expect(screen.queryByLabelText("Public ID")).not.toBeInTheDocument();
    expect(screen.getByLabelText("Name")).toHaveValue("Acme");
    expect(screen.getByLabelText("Description")).toHaveValue("Existing description");
    expect(screen.getByLabelText("Confidentiality")).toHaveValue("confidential");
  });

  it("edit mode: submits name/description/confidentiality (no publicId) to POST /projects/:id/update", async () => {
    const fetchMock = vi.fn().mockResolvedValue(successResponse(PROJECT_ID));
    global.fetch = fetchMock as typeof fetch;

    render(
      <ProjectForm
        mode="edit"
        projectId={PROJECT_ID}
        initial={{ publicId: "acme", name: "Acme", description: null, confidentiality: "internal" }}
      />,
    );

    fireEvent.change(screen.getByLabelText("Name"), { target: { value: "Acme Renamed" } });
    fireEvent.click(screen.getByRole("button", { name: "Save changes" }));

    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(1));
    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toBe(`https://api.example.com/projects/${PROJECT_ID}/update`);
    const body = JSON.parse(init.body as string);
    expect(body).toEqual({ name: "Acme Renamed", description: null, confidentiality: "internal" });
    await waitFor(() => expect(pushMock).toHaveBeenCalledWith(`/projects/${PROJECT_ID}`));
  });

  it("shows the backend's real error message on a non-OK response (e.g. duplicate publicId)", async () => {
    global.fetch = vi
      .fn()
      .mockResolvedValue(errorResponse(400, "publicId already in use: acme")) as typeof fetch;

    render(<ProjectForm mode="create" />);
    fireEvent.change(screen.getByLabelText("Public ID"), { target: { value: "acme" } });
    fireEvent.change(screen.getByLabelText("Name"), { target: { value: "Acme" } });
    fireEvent.click(screen.getByRole("button", { name: "Create project" }));

    expect(await screen.findByRole("alert")).toHaveTextContent("publicId already in use: acme");
    expect(pushMock).not.toHaveBeenCalled();
  });

  it("shows a generic error when the request itself fails (network error)", async () => {
    global.fetch = vi.fn().mockRejectedValue(new Error("network down")) as typeof fetch;

    render(<ProjectForm mode="create" />);
    fireEvent.change(screen.getByLabelText("Public ID"), { target: { value: "acme" } });
    fireEvent.change(screen.getByLabelText("Name"), { target: { value: "Acme" } });
    fireEvent.click(screen.getByRole("button", { name: "Create project" }));

    expect(await screen.findByRole("alert")).toHaveTextContent(
      "Something went wrong. Please try again.",
    );
  });
});
