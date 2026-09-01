import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { ModuleRegistrySummary } from "@webdesk/shared-types";

const pushMock = vi.fn();

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: pushMock }),
}));

import { DesignReviewForm } from "../../components/design-review-form.js";

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
  moduleFixture("component_library", "Component Library"),
  moduleFixture("page_template_library", "Page Template Library"),
];

function successResponse(id: string): Response {
  return {
    ok: true,
    json: async () => ({
      success: true,
      data: { id, targetModuleKey: "component_library", targetId: VALID_TARGET_ID },
      correlationId: "corr-1",
    }),
  } as Response;
}

describe("DesignReviewForm", () => {
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
    render(<DesignReviewForm modules={MODULES} />);
    const select = screen.getByLabelText("Target module") as HTMLSelectElement;
    expect(select).toBeRequired();
    expect(screen.getByRole("option", { name: "Component Library" })).toBeInTheDocument();
    expect(screen.getByRole("option", { name: "Page Template Library" })).toBeInTheDocument();
  });

  it("populates the review type select with all 9 vocabulary values, defaulting to the first", () => {
    render(<DesignReviewForm modules={MODULES} />);
    const select = screen.getByLabelText("Review type") as HTMLSelectElement;
    expect(select).toBeRequired();
    expect(select.value).toBe("creative_direction");
    expect(screen.getByRole("option", { name: "Performance Impact" })).toBeInTheDocument();
    expect(screen.getByRole("option", { name: "Accessibility by Design" })).toBeInTheDocument();
  });

  it("shows a warning notice and disables the form when no modules are available", () => {
    render(<DesignReviewForm modules={[]} />);
    expect(screen.getByText(/list of target modules couldn't be loaded/)).toBeInTheDocument();
    expect(screen.getByLabelText("Target module")).toBeDisabled();
    expect(screen.getByRole("button", { name: "Submit design review" })).toBeDisabled();
  });

  it("submitting with a malformed Target ID shows an error and never calls fetch", async () => {
    const fetchMock = vi.fn();
    global.fetch = fetchMock as typeof fetch;

    render(<DesignReviewForm modules={MODULES} />);
    fireEvent.change(screen.getByLabelText("Target ID"), { target: { value: "not-a-uuid" } });
    fireEvent.click(screen.getByRole("button", { name: "Submit design review" }));

    expect(await screen.findByRole("alert")).toHaveTextContent("Target ID must be a valid UUID.");
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("submits targetModuleKey/targetId/reviewType with optional fields sent as null when left blank, then navigates to the new review", async () => {
    const fetchMock = vi.fn().mockResolvedValue(successResponse(REVIEW_ID));
    global.fetch = fetchMock as typeof fetch;

    render(<DesignReviewForm modules={MODULES} />);
    fireEvent.change(screen.getByLabelText("Target ID"), { target: { value: VALID_TARGET_ID } });
    fireEvent.click(screen.getByRole("button", { name: "Submit design review" }));

    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(1));
    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toBe("https://api.example.com/design-reviews");
    const body = JSON.parse(init.body as string);
    expect(body).toEqual({
      targetModuleKey: "component_library",
      targetId: VALID_TARGET_ID,
      targetLabel: null,
      reviewType: "creative_direction",
      assignedToUserId: null,
      versionALabel: null,
      versionBLabel: null,
    });
    await waitFor(() =>
      expect(pushMock).toHaveBeenCalledWith(`/design-review-center/${REVIEW_ID}`),
    );
  });

  it("includes a non-default reviewType and targetLabel/versionALabel/versionBLabel when filled in", async () => {
    const fetchMock = vi.fn().mockResolvedValue(successResponse(REVIEW_ID));
    global.fetch = fetchMock as typeof fetch;

    render(<DesignReviewForm modules={MODULES} />);
    fireEvent.change(screen.getByLabelText("Target ID"), { target: { value: VALID_TARGET_ID } });
    fireEvent.change(screen.getByLabelText("Review type"), {
      target: { value: "accessibility_by_design" },
    });
    fireEvent.change(screen.getByLabelText("Target label"), {
      target: { value: "Hero banner v2" },
    });
    fireEvent.change(screen.getByLabelText("Version A label"), { target: { value: "v3" } });
    fireEvent.change(screen.getByLabelText("Version B label"), { target: { value: "v4" } });
    fireEvent.click(screen.getByRole("button", { name: "Submit design review" }));

    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(1));
    const [, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    const body = JSON.parse(init.body as string);
    expect(body.reviewType).toBe("accessibility_by_design");
    expect(body.targetLabel).toBe("Hero banner v2");
    expect(body.versionALabel).toBe("v3");
    expect(body.versionBLabel).toBe("v4");
  });

  it("selects a different target module via the select and submits it", async () => {
    const fetchMock = vi.fn().mockResolvedValue(successResponse(REVIEW_ID));
    global.fetch = fetchMock as typeof fetch;

    render(<DesignReviewForm modules={MODULES} />);
    fireEvent.change(screen.getByLabelText("Target module"), {
      target: { value: "page_template_library" },
    });
    fireEvent.change(screen.getByLabelText("Target ID"), { target: { value: VALID_TARGET_ID } });
    fireEvent.click(screen.getByRole("button", { name: "Submit design review" }));

    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(1));
    const [, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(JSON.parse(init.body as string).targetModuleKey).toBe("page_template_library");
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

    render(<DesignReviewForm modules={MODULES} />);
    fireEvent.change(screen.getByLabelText("Target ID"), { target: { value: VALID_TARGET_ID } });
    fireEvent.change(screen.getByPlaceholderText("Search by name or email…"), {
      target: { value: "Jane" },
    });

    const option = await screen.findByRole("button", { name: /Jane Doe/ });
    fireEvent.mouseDown(option);
    expect(await screen.findByText("jane@example.com")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Submit design review" }));

    await waitFor(() =>
      expect(fetchMock).toHaveBeenCalledWith(
        "https://api.example.com/design-reviews",
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

    render(<DesignReviewForm modules={MODULES} />);
    fireEvent.change(screen.getByLabelText("Target ID"), { target: { value: VALID_TARGET_ID } });
    fireEvent.click(screen.getByRole("button", { name: "Submit design review" }));

    expect(await screen.findByRole("alert")).toHaveTextContent(
      "targetModuleKey does not resolve to a real module: x",
    );
    expect(pushMock).not.toHaveBeenCalled();
  });

  it("shows a generic error when the request itself fails (network error)", async () => {
    global.fetch = vi.fn().mockRejectedValue(new Error("network down")) as typeof fetch;

    render(<DesignReviewForm modules={MODULES} />);
    fireEvent.change(screen.getByLabelText("Target ID"), { target: { value: VALID_TARGET_ID } });
    fireEvent.click(screen.getByRole("button", { name: "Submit design review" }));

    expect(await screen.findByRole("alert")).toHaveTextContent(
      "Something went wrong. Please try again.",
    );
  });

  // postMutation()'s own documented contract: success data may degrade to undefined on a
  // missing/malformed response body — mirrors ReviewForm's own already-reviewed guard.
  it("shows a clear message and does not navigate when a successful response carries no data", async () => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ success: true, correlationId: "corr-1" }),
    } as Response) as typeof fetch;

    render(<DesignReviewForm modules={MODULES} />);
    fireEvent.change(screen.getByLabelText("Target ID"), { target: { value: VALID_TARGET_ID } });
    fireEvent.click(screen.getByRole("button", { name: "Submit design review" }));

    expect(await screen.findByRole("alert")).toHaveTextContent(
      "The design review was created, but its details couldn't be loaded. Please check the list.",
    );
    expect(pushMock).not.toHaveBeenCalled();
  });
});
