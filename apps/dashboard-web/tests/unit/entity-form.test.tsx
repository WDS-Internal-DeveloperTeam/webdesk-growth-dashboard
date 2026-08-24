import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { EntityRecord } from "@webdesk/shared-types";

const pushMock = vi.fn();

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: pushMock }),
}));

import { EntityForm } from "../../components/entity-form.js";

const PROJECT_ID = "99999999-9999-9999-9999-999999999999";
const ENTITY_ID = "22222222-2222-2222-2222-222222222222";

function successResponse(id: string): Response {
  return {
    ok: true,
    json: async () => ({ success: true, data: { id }, correlationId: "corr-1" }),
  } as Response;
}

function entityFixture(overrides: Partial<EntityRecord> = {}): EntityRecord {
  return {
    id: ENTITY_ID,
    projectId: PROJECT_ID,
    publicId: "ENT-1",
    name: "Acme Corp",
    entityType: "Organization",
    description: null,
    createdBy: null,
    updatedBy: null,
    createdAt: "2026-08-24T00:00:00.000Z",
    updatedAt: "2026-08-24T00:00:00.000Z",
    ...overrides,
  };
}

describe("EntityForm", () => {
  const originalFetch = global.fetch;

  beforeEach(() => {
    process.env.NEXT_PUBLIC_API_BASE_URL = "https://api.example.com";
    pushMock.mockReset();
  });

  afterEach(() => {
    global.fetch = originalFetch;
    vi.restoreAllMocks();
  });

  it("create mode: publicId/name are real HTML required fields", () => {
    render(<EntityForm mode="create" projectId={PROJECT_ID} />);
    expect(screen.getByLabelText("Public ID")).toBeRequired();
    expect(screen.getByLabelText("Name")).toBeRequired();
  });

  it("renders a rich-text editor (not a plain textarea) for description", () => {
    render(<EntityForm mode="create" projectId={PROJECT_ID} />);
    expect(document.querySelectorAll("textarea")).toHaveLength(0);
    expect(document.querySelectorAll('[contenteditable="true"]')).toHaveLength(1);
  });

  it("edit mode: publicId is shown read-only, not as an editable field", () => {
    render(
      <EntityForm
        mode="edit"
        projectId={PROJECT_ID}
        entityId={ENTITY_ID}
        initial={entityFixture()}
      />,
    );
    expect(screen.queryByLabelText("Public ID")).not.toBeInTheDocument();
    expect(screen.getByText("ENT-1")).toBeInTheDocument();
  });

  it("create mode: submits publicId/name, omitting untouched optional fields entirely, then navigates to the new entity's detail route with projectId preserved", async () => {
    const fetchMock = vi.fn().mockResolvedValue(successResponse(ENTITY_ID));
    global.fetch = fetchMock as typeof fetch;

    render(<EntityForm mode="create" projectId={PROJECT_ID} />);
    fireEvent.change(screen.getByLabelText("Public ID"), { target: { value: "ENT-NEW" } });
    fireEvent.change(screen.getByLabelText("Name"), { target: { value: "Beta Inc" } });
    fireEvent.click(screen.getByRole("button", { name: "Create entity" }));

    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(1));
    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toBe(
      `https://api.example.com/keyword-and-entity-library/projects/${PROJECT_ID}/entities`,
    );
    const body = JSON.parse(init.body as string);
    expect(body.publicId).toBe("ENT-NEW");
    expect(body.name).toBe("Beta Inc");
    expect(body).not.toHaveProperty("entityType");
    expect(body).not.toHaveProperty("description");
    await waitFor(() =>
      expect(pushMock).toHaveBeenCalledWith(
        `/keyword-and-entity-library/entities/${ENTITY_ID}?projectId=${PROJECT_ID}`,
      ),
    );
  });

  it("edit mode: never sends publicId, sends explicit null for a cleared optional field, then navigates using props.entityId", async () => {
    const fetchMock = vi.fn().mockResolvedValue(successResponse(ENTITY_ID));
    global.fetch = fetchMock as typeof fetch;

    render(
      <EntityForm
        mode="edit"
        projectId={PROJECT_ID}
        entityId={ENTITY_ID}
        initial={entityFixture()}
      />,
    );
    fireEvent.change(screen.getByLabelText("Entity type"), { target: { value: "" } });
    fireEvent.click(screen.getByRole("button", { name: "Save changes" }));

    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(1));
    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toBe(
      `https://api.example.com/keyword-and-entity-library/projects/${PROJECT_ID}/entities/${ENTITY_ID}/update`,
    );
    const body = JSON.parse(init.body as string);
    expect(body).not.toHaveProperty("publicId");
    expect(body.entityType).toBeNull();
    await waitFor(() =>
      expect(pushMock).toHaveBeenCalledWith(
        `/keyword-and-entity-library/entities/${ENTITY_ID}?projectId=${PROJECT_ID}`,
      ),
    );
  });

  it("shows the backend's error message and does not navigate on a failed submit", async () => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: false,
      status: 400,
      json: async () => ({
        success: false,
        error: { code: "BadRequestException", message: "publicId already in use: ENT-NEW" },
        correlationId: "corr-1",
      }),
    } as Response) as typeof fetch;

    render(<EntityForm mode="create" projectId={PROJECT_ID} />);
    fireEvent.change(screen.getByLabelText("Public ID"), { target: { value: "ENT-NEW" } });
    fireEvent.change(screen.getByLabelText("Name"), { target: { value: "Beta Inc" } });
    fireEvent.click(screen.getByRole("button", { name: "Create entity" }));

    expect(await screen.findByRole("alert")).toHaveTextContent("publicId already in use: ENT-NEW");
    expect(pushMock).not.toHaveBeenCalled();
  });

  it("cancel link (create) points back to the entities list page with projectId preserved", () => {
    render(<EntityForm mode="create" projectId={PROJECT_ID} />);
    expect(screen.getByRole("link", { name: "Cancel" })).toHaveAttribute(
      "href",
      `/keyword-and-entity-library/entities?projectId=${PROJECT_ID}`,
    );
  });

  it("cancel link (edit) points back to the detail page with projectId preserved", () => {
    render(
      <EntityForm
        mode="edit"
        projectId={PROJECT_ID}
        entityId={ENTITY_ID}
        initial={entityFixture()}
      />,
    );
    expect(screen.getByRole("link", { name: "Cancel" })).toHaveAttribute(
      "href",
      `/keyword-and-entity-library/entities/${ENTITY_ID}?projectId=${PROJECT_ID}`,
    );
  });
});
