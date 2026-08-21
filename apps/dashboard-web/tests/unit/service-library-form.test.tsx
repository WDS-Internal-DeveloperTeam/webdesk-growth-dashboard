import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { ServiceDetail } from "@webdesk/shared-types";

const pushMock = vi.fn();

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: pushMock }),
}));

import { ServiceLibraryForm } from "../../components/service-library-form.js";

const SERVICE_ID = "11111111-1111-1111-1111-111111111111";
const CATEGORY_ID = "22222222-2222-2222-2222-222222222222";
const DELIVERABLE_ID = "33333333-3333-3333-3333-333333333333";

const categories = [
  { id: CATEGORY_ID, publicId: "CAT-1", name: "E-Commerce", parentCategoryId: null },
];
const deliverables = [{ id: DELIVERABLE_ID, publicId: "DEL-1", name: "Onboarding" }];
const platforms: never[] = [];
const engagementModels: never[] = [];

function successResponse(id: string): Response {
  return {
    ok: true,
    json: async () => ({ success: true, data: { id }, correlationId: "corr-1" }),
  } as Response;
}

function serviceDetailFixture(overrides: Partial<ServiceDetail> = {}): ServiceDetail {
  return {
    id: SERVICE_ID,
    publicId: "SVC-1",
    canonicalName: "Headless Commerce",
    publicName: null,
    categoryId: CATEGORY_ID,
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
    deliverableIds: [],
    platformIds: [],
    engagementModelIds: [],
    ...overrides,
  };
}

describe("ServiceLibraryForm", () => {
  const originalFetch = global.fetch;

  beforeEach(() => {
    process.env.NEXT_PUBLIC_API_BASE_URL = "https://api.example.com";
    pushMock.mockReset();
  });

  afterEach(() => {
    global.fetch = originalFetch;
    vi.restoreAllMocks();
  });

  it("create mode: canonicalName/publicId/categoryId are real HTML required fields", () => {
    render(
      <ServiceLibraryForm
        mode="create"
        categories={categories}
        deliverables={deliverables}
        platforms={platforms}
        engagementModels={engagementModels}
      />,
    );
    expect(screen.getByLabelText("Canonical name")).toBeRequired();
    expect(screen.getByLabelText("Public ID")).toBeRequired();
    expect(screen.getByLabelText("Category")).toBeRequired();
  });

  it("create mode: submits publicId/canonicalName/categoryId, omitting untouched long-text fields entirely", async () => {
    const fetchMock = vi.fn().mockResolvedValue(successResponse(SERVICE_ID));
    global.fetch = fetchMock as typeof fetch;

    render(
      <ServiceLibraryForm
        mode="create"
        categories={categories}
        deliverables={deliverables}
        platforms={platforms}
        engagementModels={engagementModels}
      />,
    );
    fireEvent.change(screen.getByLabelText("Public ID"), { target: { value: "SVC-NEW" } });
    fireEvent.change(screen.getByLabelText("Canonical name"), {
      target: { value: "Headless Commerce" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Create service" }));

    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(1));
    const [, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    const body = JSON.parse(init.body as string);
    expect(body.publicId).toBe("SVC-NEW");
    expect(body.canonicalName).toBe("Headless Commerce");
    expect(body.categoryId).toBe(CATEGORY_ID);
    expect(body).not.toHaveProperty("publicName");
    expect(body).not.toHaveProperty("shortPublicDescription");
    expect(body).not.toHaveProperty("internalDescription");
    expect(body.icpIds).toEqual([]);
    await waitFor(() => expect(pushMock).toHaveBeenCalledWith(`/service-library/${SERVICE_ID}`));
  });

  it("edit mode: never sends approvalStatus, and clears an emptied text field to null (not omitted)", async () => {
    const fetchMock = vi.fn().mockResolvedValue(successResponse(SERVICE_ID));
    global.fetch = fetchMock as typeof fetch;

    render(
      <ServiceLibraryForm
        mode="edit"
        serviceId={SERVICE_ID}
        initial={serviceDetailFixture({ publicName: "Was set" })}
        categories={categories}
        deliverables={deliverables}
        platforms={platforms}
        engagementModels={engagementModels}
      />,
    );
    fireEvent.change(screen.getByLabelText("Public name"), { target: { value: "" } });
    fireEvent.click(screen.getByRole("button", { name: "Save changes" }));

    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(1));
    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toBe(`https://api.example.com/service-library/services/${SERVICE_ID}/update`);
    const body = JSON.parse(init.body as string);
    expect(body.publicName).toBeNull();
    expect(body).not.toHaveProperty("approvalStatus");
    expect(body.publicationStatus).toBe("draft");
  });

  it("edit mode: a redacted internalDescription renders an inert notice, and the field is omitted from the payload", async () => {
    const fetchMock = vi.fn().mockResolvedValue(successResponse(SERVICE_ID));
    global.fetch = fetchMock as typeof fetch;

    render(
      <ServiceLibraryForm
        mode="edit"
        serviceId={SERVICE_ID}
        initial={serviceDetailFixture({
          confidentiality: "restricted",
          internalDescription: undefined,
        })}
        categories={categories}
        deliverables={deliverables}
        platforms={platforms}
        engagementModels={engagementModels}
      />,
    );
    expect(screen.getByText(/restricted and its internal description/)).toBeInTheDocument();
    expect(screen.queryByLabelText("Internal description")).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Save changes" }));

    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(1));
    const [, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    const body = JSON.parse(init.body as string);
    expect(body).not.toHaveProperty("internalDescription");
  });

  it("selecting a deliverable via RelationshipPicker adds it to the submitted deliverableIds", async () => {
    const fetchMock = vi.fn().mockResolvedValue(successResponse(SERVICE_ID));
    global.fetch = fetchMock as typeof fetch;

    render(
      <ServiceLibraryForm
        mode="create"
        categories={categories}
        deliverables={deliverables}
        platforms={platforms}
        engagementModels={engagementModels}
      />,
    );
    fireEvent.change(screen.getByLabelText("Public ID"), { target: { value: "SVC-NEW" } });
    fireEvent.change(screen.getByLabelText("Canonical name"), { target: { value: "X" } });
    fireEvent.change(screen.getByRole("combobox", { name: "Deliverables" }), {
      target: { value: "Onboard" },
    });
    fireEvent.click(screen.getByText("Onboarding"));
    fireEvent.click(screen.getByRole("button", { name: "Create service" }));

    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(1));
    const [, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    const body = JSON.parse(init.body as string);
    expect(body.deliverableIds).toEqual([DELIVERABLE_ID]);
  });

  it("tag input: pressing Enter adds an ICP tag, and it's included in the submitted icpIds", async () => {
    const fetchMock = vi.fn().mockResolvedValue(successResponse(SERVICE_ID));
    global.fetch = fetchMock as typeof fetch;

    render(
      <ServiceLibraryForm
        mode="create"
        categories={categories}
        deliverables={deliverables}
        platforms={platforms}
        engagementModels={engagementModels}
      />,
    );
    fireEvent.change(screen.getByLabelText("Public ID"), { target: { value: "SVC-NEW" } });
    fireEvent.change(screen.getByLabelText("Canonical name"), { target: { value: "X" } });
    const icpInput = screen.getByLabelText("ICPs");
    fireEvent.change(icpInput, { target: { value: "ICP-1" } });
    fireEvent.keyDown(icpInput, { key: "Enter" });
    expect(screen.getByText("ICP-1")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Create service" }));

    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(1));
    const [, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    const body = JSON.parse(init.body as string);
    expect(body.icpIds).toEqual(["ICP-1"]);
  });

  it("shows the backend's error message and does not navigate on a failed submit", async () => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: false,
      status: 400,
      json: async () => ({
        success: false,
        error: { code: "BadRequestException", message: "publicId already in use: SVC-NEW" },
        correlationId: "corr-1",
      }),
    } as Response) as typeof fetch;

    render(
      <ServiceLibraryForm
        mode="create"
        categories={categories}
        deliverables={deliverables}
        platforms={platforms}
        engagementModels={engagementModels}
      />,
    );
    fireEvent.change(screen.getByLabelText("Public ID"), { target: { value: "SVC-NEW" } });
    fireEvent.change(screen.getByLabelText("Canonical name"), { target: { value: "X" } });
    fireEvent.click(screen.getByRole("button", { name: "Create service" }));

    expect(await screen.findByRole("alert")).toHaveTextContent("publicId already in use: SVC-NEW");
    expect(pushMock).not.toHaveBeenCalled();
  });
});
