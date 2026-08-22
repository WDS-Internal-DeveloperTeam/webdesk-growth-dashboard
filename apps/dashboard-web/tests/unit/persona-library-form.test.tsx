import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { Persona, Service } from "@webdesk/shared-types";

const pushMock = vi.fn();

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: pushMock }),
}));

import { PersonaLibraryForm } from "../../components/persona-library-form.js";

const PERSONA_ID = "11111111-1111-1111-1111-111111111111";
const SERVICE_ID = "22222222-2222-2222-2222-222222222222";

const services: readonly Service[] = [
  {
    id: SERVICE_ID,
    publicId: "SVC-1",
    canonicalName: "Headless Commerce",
    publicName: null,
    categoryId: "cat-1",
    parentServiceId: null,
    shortPublicDescription: null,
    audience: null,
    problems: null,
    capabilities: null,
    outcomes: null,
    exclusions: null,
    internalDescription: null,
    icpIds: [],
    relatedPageIds: [],
    relatedCaseStudyIds: [],
    confidentiality: "internal",
    publicationStatus: "draft",
    approvalStatus: "draft",
    ownerUserId: null,
    createdAt: "2026-08-21T00:00:00.000Z",
    updatedAt: "2026-08-21T00:00:00.000Z",
  },
];

function successResponse(id: string): Response {
  return {
    ok: true,
    json: async () => ({ success: true, data: { id }, correlationId: "corr-1" }),
  } as Response;
}

function personaFixture(overrides: Partial<Persona> = {}): Persona {
  return {
    id: PERSONA_ID,
    publicId: "PERSONA-1",
    name: "Enterprise IT Director",
    buyerType: null,
    companySize: null,
    roles: [],
    industries: [],
    geography: null,
    goals: null,
    pains: null,
    triggers: null,
    objections: null,
    decisionCriteria: null,
    relatedServiceIds: [],
    badFitSignals: null,
    messagingTrack: null,
    ctaPreferences: null,
    approvalStatus: "draft",
    version: 1,
    createdBy: null,
    updatedBy: null,
    createdAt: "2026-08-22T00:00:00.000Z",
    updatedAt: "2026-08-22T00:00:00.000Z",
    ...overrides,
  };
}

describe("PersonaLibraryForm", () => {
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
    render(<PersonaLibraryForm mode="create" services={services} />);
    expect(screen.getByLabelText("Public ID")).toBeRequired();
    expect(screen.getByLabelText("Name")).toBeRequired();
  });

  it("renders every long-text field as a plain textarea, not a rich-text editor", () => {
    render(<PersonaLibraryForm mode="create" services={services} />);
    expect(document.querySelectorAll("textarea")).toHaveLength(8);
    expect(document.querySelectorAll('[contenteditable="true"]')).toHaveLength(0);
  });

  it("create mode: submits publicId/name, omitting untouched text fields entirely", async () => {
    const fetchMock = vi.fn().mockResolvedValue(successResponse(PERSONA_ID));
    global.fetch = fetchMock as typeof fetch;

    render(<PersonaLibraryForm mode="create" services={services} />);
    fireEvent.change(screen.getByLabelText("Public ID"), { target: { value: "PERSONA-NEW" } });
    fireEvent.change(screen.getByLabelText("Name"), {
      target: { value: "Enterprise IT Director" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Create persona" }));

    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(1));
    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toBe("https://api.example.com/persona-library/personas");
    const body = JSON.parse(init.body as string);
    expect(body.publicId).toBe("PERSONA-NEW");
    expect(body.name).toBe("Enterprise IT Director");
    expect(body).not.toHaveProperty("buyerType");
    expect(body).not.toHaveProperty("goals");
    expect(body.roles).toEqual([]);
    expect(body.relatedServiceIds).toEqual([]);
    await waitFor(() => expect(pushMock).toHaveBeenCalledWith(`/persona-library/${PERSONA_ID}`));
  });

  it("edit mode: never sends approvalStatus/version, and clears an emptied text field to null (not omitted)", async () => {
    const fetchMock = vi.fn().mockResolvedValue(successResponse(PERSONA_ID));
    global.fetch = fetchMock as typeof fetch;

    render(
      <PersonaLibraryForm
        mode="edit"
        personaId={PERSONA_ID}
        initial={personaFixture({ buyerType: "Was set" })}
        services={services}
      />,
    );
    fireEvent.change(screen.getByLabelText("Buyer type"), { target: { value: "" } });
    fireEvent.click(screen.getByRole("button", { name: "Save changes" }));

    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(1));
    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toBe(`https://api.example.com/persona-library/personas/${PERSONA_ID}/update`);
    const body = JSON.parse(init.body as string);
    expect(body.buyerType).toBeNull();
    expect(body).not.toHaveProperty("approvalStatus");
    expect(body).not.toHaveProperty("version");
    expect(body).not.toHaveProperty("publicId");
  });

  it("selecting a service via RelationshipPicker adds it to the submitted relatedServiceIds", async () => {
    const fetchMock = vi.fn().mockResolvedValue(successResponse(PERSONA_ID));
    global.fetch = fetchMock as typeof fetch;

    render(<PersonaLibraryForm mode="create" services={services} />);
    fireEvent.change(screen.getByLabelText("Public ID"), { target: { value: "PERSONA-NEW" } });
    fireEvent.change(screen.getByLabelText("Name"), { target: { value: "X" } });
    fireEvent.change(screen.getByRole("combobox", { name: "Related services" }), {
      target: { value: "Headless" },
    });
    fireEvent.click(screen.getByText("Headless Commerce"));
    fireEvent.click(screen.getByRole("button", { name: "Create persona" }));

    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(1));
    const [, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    const body = JSON.parse(init.body as string);
    expect(body.relatedServiceIds).toEqual([SERVICE_ID]);
  });

  it("tag input: pressing Enter adds a role tag, and it's included in the submitted roles", async () => {
    const fetchMock = vi.fn().mockResolvedValue(successResponse(PERSONA_ID));
    global.fetch = fetchMock as typeof fetch;

    render(<PersonaLibraryForm mode="create" services={services} />);
    fireEvent.change(screen.getByLabelText("Public ID"), { target: { value: "PERSONA-NEW" } });
    fireEvent.change(screen.getByLabelText("Name"), { target: { value: "X" } });
    const rolesInput = screen.getByLabelText("Roles");
    fireEvent.change(rolesInput, { target: { value: "VP Engineering" } });
    fireEvent.keyDown(rolesInput, { key: "Enter" });
    expect(screen.getByText("VP Engineering")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Create persona" }));

    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(1));
    const [, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    const body = JSON.parse(init.body as string);
    expect(body.roles).toEqual(["VP Engineering"]);
  });

  it("shows the backend's error message and does not navigate on a failed submit", async () => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: false,
      status: 400,
      json: async () => ({
        success: false,
        error: { code: "BadRequestException", message: "publicId already in use: PERSONA-NEW" },
        correlationId: "corr-1",
      }),
    } as Response) as typeof fetch;

    render(<PersonaLibraryForm mode="create" services={services} />);
    fireEvent.change(screen.getByLabelText("Public ID"), { target: { value: "PERSONA-NEW" } });
    fireEvent.change(screen.getByLabelText("Name"), { target: { value: "X" } });
    fireEvent.click(screen.getByRole("button", { name: "Create persona" }));

    expect(await screen.findByRole("alert")).toHaveTextContent(
      "publicId already in use: PERSONA-NEW",
    );
    expect(pushMock).not.toHaveBeenCalled();
  });

  it("edit mode: a plain-text field's initial content loads into its textarea", () => {
    render(
      <PersonaLibraryForm
        mode="edit"
        personaId={PERSONA_ID}
        initial={personaFixture({ goals: "Reduce onboarding friction" })}
        services={services}
      />,
    );
    expect(screen.getByLabelText("Goals")).toHaveValue("Reduce onboarding friction");
  });

  it("edit mode: a relatedServiceIds entry outside the fetched services list falls back to a raw-id chip instead of vanishing (code-review fix)", () => {
    const OUT_OF_WINDOW_SERVICE_ID = "99999999-9999-9999-9999-999999999999";
    render(
      <PersonaLibraryForm
        mode="edit"
        personaId={PERSONA_ID}
        initial={personaFixture({ relatedServiceIds: [SERVICE_ID, OUT_OF_WINDOW_SERVICE_ID] })}
        services={services}
      />,
    );
    // The known service resolves to its real display name; the unknown one still renders as its
    // own chip (the raw id), instead of being silently dropped from the "selected" list.
    expect(screen.getByText("Headless Commerce")).toBeInTheDocument();
    expect(screen.getByText(OUT_OF_WINDOW_SERVICE_ID)).toBeInTheDocument();
  });
});
