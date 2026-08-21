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

function errorResponse(
  status: number,
  message: string,
  code = "BadRequestException",
  issues?: readonly { path: string; message: string }[],
): Response {
  return {
    ok: false,
    status,
    json: async () => ({
      success: false,
      error: issues ? { code, message, issues } : { code, message },
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

  it("create mode: submits publicId/name/confidentiality to POST /projects", async () => {
    const fetchMock = vi.fn().mockResolvedValue(successResponse(PROJECT_ID));
    global.fetch = fetchMock as typeof fetch;

    render(<ProjectForm mode="create" />);

    fireEvent.change(screen.getByLabelText("Public ID"), { target: { value: "acme" } });
    fireEvent.change(screen.getByLabelText("Name"), { target: { value: "Acme" } });
    // Description isn't typed into here — RichTextEditor is a Tiptap contentEditable div, not a
    // real form control, so fireEvent.change doesn't drive it; its own empty-description behavior
    // is covered separately below. Matches business-knowledge-record-form.test.tsx's own
    // precedent of never simulating typing into a RichTextEditor field.
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
          description: "",
          confidentiality: "internal",
          ownerUserId: null,
        }),
      }),
    );
    await waitFor(() => expect(pushMock).toHaveBeenCalledWith(`/projects/${PROJECT_ID}`));
  });

  it("create mode: sends description as an empty string when left blank (never coerced to null)", async () => {
    const fetchMock = vi.fn().mockResolvedValue(successResponse(PROJECT_ID));
    global.fetch = fetchMock as typeof fetch;

    render(<ProjectForm mode="create" />);
    fireEvent.change(screen.getByLabelText("Public ID"), { target: { value: "acme" } });
    fireEvent.change(screen.getByLabelText("Name"), { target: { value: "Acme" } });
    fireEvent.click(screen.getByRole("button", { name: "Create project" }));

    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(1));
    const body = JSON.parse((fetchMock.mock.calls[0]?.[1] as RequestInit).body as string);
    expect(body.description).toBe("");
  });

  it("edit mode: shows the public ID as read-only text, not an input", async () => {
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
          owner: null,
          ownerUserId: null,
        }}
      />,
    );

    expect(screen.getByText("acme")).toBeInTheDocument();
    expect(screen.queryByLabelText("Public ID")).not.toBeInTheDocument();
    expect(screen.getByLabelText("Name")).toHaveValue("Acme");
    // RichTextEditor is a Tiptap contentEditable div, not a real form control — toHaveValue()
    // doesn't apply. Confirms the initial description loaded into the editor the same way
    // business-knowledge-record-form.test.tsx's own edit-mode test does.
    await waitFor(() => expect(screen.getByText("Existing description")).toBeInTheDocument());
    expect(screen.getByLabelText("Confidentiality")).toHaveValue("confidential");
  });

  it("edit mode: submits name/description/confidentiality (no publicId) to POST /projects/:id/update", async () => {
    const fetchMock = vi.fn().mockResolvedValue(successResponse(PROJECT_ID));
    global.fetch = fetchMock as typeof fetch;

    render(
      <ProjectForm
        mode="edit"
        projectId={PROJECT_ID}
        initial={{
          publicId: "acme",
          name: "Acme",
          description: null,
          confidentiality: "internal",
          owner: null,
          ownerUserId: null,
        }}
      />,
    );

    fireEvent.change(screen.getByLabelText("Name"), { target: { value: "Acme Renamed" } });
    fireEvent.click(screen.getByRole("button", { name: "Save changes" }));

    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(1));
    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toBe(`https://api.example.com/projects/${PROJECT_ID}/update`);
    const body = JSON.parse(init.body as string);
    // description stays "" (never coerced to null) since the user never touched that field.
    expect(body).toEqual({
      name: "Acme Renamed",
      description: "",
      confidentiality: "internal",
      ownerUserId: null,
    });
    await waitFor(() => expect(pushMock).toHaveBeenCalledWith(`/projects/${PROJECT_ID}`));
  });

  it("edit mode: loads a stored description and submits it unchanged", async () => {
    // Restores the coverage lost when the plain <textarea> (fireEvent.change-able) was replaced
    // by RichTextEditor, a Tiptap contentEditable div that can't be driven the same way in jsdom —
    // matches this file's own "renders a rich-text editor" test note and
    // business-knowledge-record-form.test.tsx's established convention: prove a value reaches the
    // submitted request body via the `initial` prop, not simulated typing (code-review finding,
    // test-coverage).
    const fetchMock = vi.fn().mockResolvedValue(successResponse(PROJECT_ID));
    global.fetch = fetchMock as typeof fetch;

    render(
      <ProjectForm
        mode="edit"
        projectId={PROJECT_ID}
        initial={{
          publicId: "acme",
          name: "Acme",
          description: "<p>Existing description</p>",
          confidentiality: "internal",
          owner: null,
          ownerUserId: null,
        }}
      />,
    );

    await waitFor(() => expect(screen.getByText("Existing description")).toBeInTheDocument());
    fireEvent.click(screen.getByRole("button", { name: "Save changes" }));

    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(1));
    const body = JSON.parse((fetchMock.mock.calls[0]?.[1] as RequestInit).body as string);
    expect(body.description).toBe("<p>Existing description</p>");
  });

  it("edit mode: normalizes a stored empty-document value ('<p></p>') to an empty string on submit", async () => {
    // A cleared RichTextEditor field serializes to "<p></p>", not "" — left unnormalized, this
    // renders as truthy on the detail page, permanently showing an empty content box instead of
    // "No description." (code-review finding, correctness).
    const fetchMock = vi.fn().mockResolvedValue(successResponse(PROJECT_ID));
    global.fetch = fetchMock as typeof fetch;

    render(
      <ProjectForm
        mode="edit"
        projectId={PROJECT_ID}
        initial={{
          publicId: "acme",
          name: "Acme",
          description: "<p></p>",
          confidentiality: "internal",
          owner: null,
          ownerUserId: null,
        }}
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: "Save changes" }));

    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(1));
    const body = JSON.parse((fetchMock.mock.calls[0]?.[1] as RequestInit).body as string);
    expect(body.description).toBe("");
  });

  it("edit mode: leaving a stored empty-string description untouched preserves it (never nulled)", async () => {
    const fetchMock = vi.fn().mockResolvedValue(successResponse(PROJECT_ID));
    global.fetch = fetchMock as typeof fetch;

    render(
      <ProjectForm
        mode="edit"
        projectId={PROJECT_ID}
        initial={{
          publicId: "acme",
          name: "Acme",
          description: "",
          confidentiality: "internal",
          owner: null,
          ownerUserId: null,
        }}
      />,
    );

    fireEvent.change(screen.getByLabelText("Confidentiality"), {
      target: { value: "confidential" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Save changes" }));

    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(1));
    const body = JSON.parse((fetchMock.mock.calls[0]?.[1] as RequestInit).body as string);
    expect(body.description).toBe("");
  });

  it("shows the backend's real error message for an allowlisted code (e.g. duplicate publicId)", async () => {
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

  it("shows field-level detail from a Zod validation failure's issues array", async () => {
    global.fetch = vi
      .fn()
      .mockResolvedValue(
        errorResponse(400, "Validation failed", "BadRequestException", [
          { path: "name", message: "String must contain at least 1 character(s)" },
        ]),
      ) as typeof fetch;

    render(<ProjectForm mode="create" />);
    fireEvent.change(screen.getByLabelText("Public ID"), { target: { value: "acme" } });
    fireEvent.change(screen.getByLabelText("Name"), { target: { value: "Acme" } });
    fireEvent.click(screen.getByRole("button", { name: "Create project" }));

    expect(await screen.findByRole("alert")).toHaveTextContent(
      "name: String must contain at least 1 character(s)",
    );
  });

  it("falls back to a generic message for a non-allowlisted error code (e.g. a guard misconfiguration)", async () => {
    global.fetch = vi
      .fn()
      .mockResolvedValue(
        errorResponse(
          500,
          "Route is guarded by PermissionGuard but declares no @RequirePermission",
          "InternalServerErrorException",
        ),
      ) as typeof fetch;

    render(<ProjectForm mode="create" />);
    fireEvent.change(screen.getByLabelText("Public ID"), { target: { value: "acme" } });
    fireEvent.change(screen.getByLabelText("Name"), { target: { value: "Acme" } });
    fireEvent.click(screen.getByRole("button", { name: "Create project" }));

    expect(await screen.findByRole("alert")).toHaveTextContent(
      "Something went wrong. Please try again.",
    );
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

  it("create mode: searching and selecting an owner includes their id in the submitted payload", async () => {
    const searchResponse = {
      ok: true,
      json: async () => ({
        success: true,
        data: [
          {
            id: "22222222-2222-2222-2222-222222222222",
            displayName: "Jane Doe",
            email: "jane@example.com",
          },
        ],
        correlationId: "corr-1",
      }),
    } as Response;
    const fetchMock = vi.fn((url: string) => {
      if (url.includes("/users?")) {
        return Promise.resolve(searchResponse);
      }
      return Promise.resolve(successResponse(PROJECT_ID));
    });
    global.fetch = fetchMock as unknown as typeof fetch;

    render(<ProjectForm mode="create" />);
    fireEvent.change(screen.getByLabelText("Public ID"), { target: { value: "acme" } });
    fireEvent.change(screen.getByLabelText("Name"), { target: { value: "Acme" } });
    fireEvent.change(screen.getByPlaceholderText("Search by name or email…"), {
      target: { value: "Jane" },
    });

    const option = await screen.findByRole("button", { name: /Jane Doe/ });
    fireEvent.mouseDown(option);

    expect(await screen.findByText("jane@example.com")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Create project" }));

    await waitFor(() =>
      expect(fetchMock).toHaveBeenCalledWith(
        "https://api.example.com/projects",
        expect.objectContaining({
          body: JSON.stringify({
            publicId: "acme",
            name: "Acme",
            description: "",
            confidentiality: "internal",
            ownerUserId: "22222222-2222-2222-2222-222222222222",
          }),
        }),
      ),
    );
  });

  it("edit mode: shows the initial owner and clears it via Remove, submitting ownerUserId: null", async () => {
    const fetchMock = vi.fn().mockResolvedValue(successResponse(PROJECT_ID));
    global.fetch = fetchMock as typeof fetch;

    render(
      <ProjectForm
        mode="edit"
        projectId={PROJECT_ID}
        initial={{
          publicId: "acme",
          name: "Acme",
          description: null,
          confidentiality: "internal",
          owner: {
            id: "33333333-3333-3333-3333-333333333333",
            displayName: "Jane Doe",
            email: "jane@example.com",
          },
          ownerUserId: "33333333-3333-3333-3333-333333333333",
        }}
      />,
    );

    expect(screen.getByText("Jane Doe")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Remove" }));
    expect(screen.queryByText("Jane Doe")).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Save changes" }));

    await waitFor(() =>
      expect(fetchMock).toHaveBeenCalledWith(
        `https://api.example.com/projects/${PROJECT_ID}/update`,
        expect.objectContaining({
          body: JSON.stringify({
            name: "Acme",
            description: "",
            confidentiality: "internal",
            ownerUserId: null,
          }),
        }),
      ),
    );
  });

  it("edit mode: preserves an unresolvable owner's id on save when the picker was never touched", async () => {
    const fetchMock = vi.fn().mockResolvedValue(successResponse(PROJECT_ID));
    global.fetch = fetchMock as typeof fetch;
    const UNRESOLVABLE_OWNER_ID = "44444444-4444-4444-4444-444444444444";

    render(
      <ProjectForm
        mode="edit"
        projectId={PROJECT_ID}
        initial={{
          publicId: "acme",
          name: "Acme",
          description: null,
          confidentiality: "internal",
          // owner resolution failed (e.g. a disabled account) — owner is null even though the
          // project genuinely has an assigned, just-unresolvable owner.
          owner: null,
          ownerUserId: UNRESOLVABLE_OWNER_ID,
        }}
      />,
    );

    // The picker itself shows as empty (no resolvable display summary) — but a note explains why.
    expect(screen.queryByText(/could not be resolved/)).toBeInTheDocument();

    // Editing an unrelated field and saving must NOT silently clear the owner assignment.
    fireEvent.change(screen.getByLabelText("Name"), { target: { value: "Acme Renamed" } });
    fireEvent.click(screen.getByRole("button", { name: "Save changes" }));

    await waitFor(() =>
      expect(fetchMock).toHaveBeenCalledWith(
        `https://api.example.com/projects/${PROJECT_ID}/update`,
        expect.objectContaining({
          body: JSON.stringify({
            name: "Acme Renamed",
            description: "",
            confidentiality: "internal",
            ownerUserId: UNRESOLVABLE_OWNER_ID,
          }),
        }),
      ),
    );
  });

  it("renders a rich-text editor (not a plain textarea) for Description", () => {
    global.fetch = vi.fn() as typeof fetch;
    render(<ProjectForm mode="create" />);
    expect(document.querySelectorAll("textarea")).toHaveLength(0);
    expect(document.querySelector('[contenteditable="true"]')).not.toBeNull();
  });
});
