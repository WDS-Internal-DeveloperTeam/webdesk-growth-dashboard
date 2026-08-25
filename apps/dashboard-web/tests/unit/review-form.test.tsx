import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { ModuleRegistrySummary } from "@webdesk/shared-types";

const pushMock = vi.fn();

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: pushMock }),
}));

import { ReviewForm } from "../../components/review-form.js";

const REVIEW_ID = "11111111-1111-1111-1111-111111111111";
const VALID_TARGET_ID = "22222222-2222-2222-2222-222222222222";
const OWNER_ID = "33333333-3333-3333-3333-333333333333";

function moduleFixture(key: string, displayName: string | null = null): ModuleRegistrySummary {
  return {
    id: `module-${key}`,
    key,
    name: key,
    permissionGroupKey: key,
    displayName,
    description: null,
    navigationGroup: "workflow",
    navigationOrder: 1,
    route: `/${key}`,
    iconReference: null,
    v1InclusionStatus: "included",
    implementationStatus: "available",
    viewPermissionAction: "view",
    actionPermissions: null,
    featureStatus: null,
    documentationReference: null,
    helpDocumentReference: null,
    owner: null,
    dependencies: null,
    confidentialityLevel: null,
    badgeSupport: false,
    deprecationReference: null,
  };
}

const MODULES: readonly ModuleRegistrySummary[] = [
  moduleFixture("business_knowledge", "Business Knowledge Center"),
  moduleFixture("service_library", "Service Library"),
];

function successResponse(id: string): Response {
  return {
    ok: true,
    json: async () => ({
      success: true,
      data: { id, targetModuleKey: "business_knowledge", targetId: VALID_TARGET_ID },
      correlationId: "corr-1",
    }),
  } as Response;
}

describe("ReviewForm", () => {
  const originalFetch = global.fetch;

  beforeEach(() => {
    process.env.NEXT_PUBLIC_API_BASE_URL = "https://api.example.com";
    pushMock.mockReset();
  });

  afterEach(() => {
    global.fetch = originalFetch;
    vi.restoreAllMocks();
  });

  it("populates the target module select from the modules prop, using displayName when set", () => {
    render(<ReviewForm modules={MODULES} />);
    const select = screen.getByLabelText("Target module") as HTMLSelectElement;
    expect(select).toBeRequired();
    expect(screen.getByRole("option", { name: "Business Knowledge Center" })).toBeInTheDocument();
    expect(screen.getByRole("option", { name: "Service Library" })).toBeInTheDocument();
  });

  it("shows a warning notice and disables the form when no modules are available", () => {
    render(<ReviewForm modules={[]} />);
    expect(screen.getByText(/list of target modules couldn't be loaded/)).toBeInTheDocument();
    expect(screen.getByLabelText("Target module")).toBeDisabled();
    expect(screen.getByRole("button", { name: "Submit review" })).toBeDisabled();
  });

  it("submitting with a malformed Target ID shows an error and never calls fetch", async () => {
    const fetchMock = vi.fn();
    global.fetch = fetchMock as typeof fetch;

    render(<ReviewForm modules={MODULES} />);
    fireEvent.change(screen.getByLabelText("Target ID"), { target: { value: "not-a-uuid" } });
    fireEvent.click(screen.getByRole("button", { name: "Submit review" }));

    expect(await screen.findByRole("alert")).toHaveTextContent("Target ID must be a valid UUID.");
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("submits targetModuleKey/targetId with optional fields sent as null when left blank, then navigates to the new review", async () => {
    const fetchMock = vi.fn().mockResolvedValue(successResponse(REVIEW_ID));
    global.fetch = fetchMock as typeof fetch;

    render(<ReviewForm modules={MODULES} />);
    fireEvent.change(screen.getByLabelText("Target ID"), { target: { value: VALID_TARGET_ID } });
    fireEvent.click(screen.getByRole("button", { name: "Submit review" }));

    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(1));
    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toBe("https://api.example.com/reviews");
    const body = JSON.parse(init.body as string);
    expect(body).toEqual({
      targetModuleKey: "business_knowledge",
      targetId: VALID_TARGET_ID,
      targetLabel: null,
      assignedToUserId: null,
      versionALabel: null,
      versionBLabel: null,
    });
    await waitFor(() =>
      expect(pushMock).toHaveBeenCalledWith(`/review-and-approval-center/${REVIEW_ID}`),
    );
  });

  it("includes targetLabel/versionALabel/versionBLabel when filled in", async () => {
    const fetchMock = vi.fn().mockResolvedValue(successResponse(REVIEW_ID));
    global.fetch = fetchMock as typeof fetch;

    render(<ReviewForm modules={MODULES} />);
    fireEvent.change(screen.getByLabelText("Target ID"), { target: { value: VALID_TARGET_ID } });
    fireEvent.change(screen.getByLabelText("Target label"), {
      target: { value: "Q4 landing copy" },
    });
    fireEvent.change(screen.getByLabelText("Version A label"), { target: { value: "v3" } });
    fireEvent.change(screen.getByLabelText("Version B label"), { target: { value: "v4" } });
    fireEvent.click(screen.getByRole("button", { name: "Submit review" }));

    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(1));
    const [, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    const body = JSON.parse(init.body as string);
    expect(body.targetLabel).toBe("Q4 landing copy");
    expect(body.versionALabel).toBe("v3");
    expect(body.versionBLabel).toBe("v4");
  });

  it("selects a different target module via the select and submits it", async () => {
    const fetchMock = vi.fn().mockResolvedValue(successResponse(REVIEW_ID));
    global.fetch = fetchMock as typeof fetch;

    render(<ReviewForm modules={MODULES} />);
    fireEvent.change(screen.getByLabelText("Target module"), {
      target: { value: "service_library" },
    });
    fireEvent.change(screen.getByLabelText("Target ID"), { target: { value: VALID_TARGET_ID } });
    fireEvent.click(screen.getByRole("button", { name: "Submit review" }));

    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(1));
    const [, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(JSON.parse(init.body as string).targetModuleKey).toBe("service_library");
  });

  it("searching and selecting an assignee via UserPicker includes their id in the submitted payload", async () => {
    const searchResponse = {
      ok: true,
      json: async () => ({
        success: true,
        data: [{ id: OWNER_ID, displayName: "Jane Doe", email: "jane@example.com" }],
        correlationId: "corr-1",
      }),
    } as Response;
    const fetchMock = vi.fn((url: string) => {
      if (url.includes("/users?")) {
        return Promise.resolve(searchResponse);
      }
      return Promise.resolve(successResponse(REVIEW_ID));
    });
    global.fetch = fetchMock as unknown as typeof fetch;

    render(<ReviewForm modules={MODULES} />);
    fireEvent.change(screen.getByLabelText("Target ID"), { target: { value: VALID_TARGET_ID } });
    fireEvent.change(screen.getByPlaceholderText("Search by name or email…"), {
      target: { value: "Jane" },
    });

    const option = await screen.findByRole("button", { name: /Jane Doe/ });
    fireEvent.mouseDown(option);
    expect(await screen.findByText("jane@example.com")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Submit review" }));

    await waitFor(() =>
      expect(fetchMock).toHaveBeenCalledWith(
        "https://api.example.com/reviews",
        expect.objectContaining({
          body: expect.stringContaining(`"assignedToUserId":"${OWNER_ID}"`) as unknown as string,
        }),
      ),
    );
  });

  it("shows the backend's error message and does not navigate on a failed submit", async () => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: false,
      status: 400,
      json: async () => ({
        success: false,
        error: {
          code: "BadRequestException",
          message: "targetModuleKey does not resolve to a real module: x",
        },
        correlationId: "corr-1",
      }),
    } as Response) as typeof fetch;

    render(<ReviewForm modules={MODULES} />);
    fireEvent.change(screen.getByLabelText("Target ID"), { target: { value: VALID_TARGET_ID } });
    fireEvent.click(screen.getByRole("button", { name: "Submit review" }));

    expect(await screen.findByRole("alert")).toHaveTextContent(
      "targetModuleKey does not resolve to a real module: x",
    );
    expect(pushMock).not.toHaveBeenCalled();
  });

  it("shows a generic error when the request itself fails (network error)", async () => {
    global.fetch = vi.fn().mockRejectedValue(new Error("network down")) as typeof fetch;

    render(<ReviewForm modules={MODULES} />);
    fireEvent.change(screen.getByLabelText("Target ID"), { target: { value: VALID_TARGET_ID } });
    fireEvent.click(screen.getByRole("button", { name: "Submit review" }));

    expect(await screen.findByRole("alert")).toHaveTextContent(
      "Something went wrong. Please try again.",
    );
  });
});
