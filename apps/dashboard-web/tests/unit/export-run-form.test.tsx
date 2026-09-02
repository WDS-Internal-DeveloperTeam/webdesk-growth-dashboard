import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { ExportRun, ModuleRegistrySummary } from "@webdesk/shared-types";

const pushMock = vi.fn();

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: pushMock }),
}));

import { ExportRunForm } from "../../components/export-run-form.js";

const EXPORT_RUN_ID = "11111111-1111-1111-1111-111111111111";

function moduleFixture(key: string, displayName: string): ModuleRegistrySummary {
  return {
    id: `module-${key}`,
    key,
    name: key,
    permissionGroupKey: key,
    displayName,
    description: null,
    navigationGroup: "libraries",
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
  moduleFixture("service_library", "Service Library"),
];

function successResponse(data: Partial<ExportRun>): Response {
  return {
    ok: true,
    json: async () => ({ success: true, data, correlationId: "corr-1" }),
  } as Response;
}

describe("ExportRunForm", () => {
  const originalFetch = global.fetch;

  beforeEach(() => {
    process.env.NEXT_PUBLIC_API_BASE_URL = "https://api.example.com";
    pushMock.mockReset();
  });

  afterEach(() => {
    global.fetch = originalFetch;
    vi.restoreAllMocks();
  });

  function fillRequiredFields(): void {
    fireEvent.change(screen.getByLabelText("Public ID"), { target: { value: "EXP-1" } });
    fireEvent.change(screen.getByLabelText("Target module"), {
      target: { value: "service_library" },
    });
  }

  it("rejects malformed JSON in Filter criteria before ever calling fetch", () => {
    global.fetch = vi.fn() as typeof fetch;
    render(<ExportRunForm modules={MODULES} />);
    fillRequiredFields();

    fireEvent.change(screen.getByLabelText("Filter criteria (JSON, optional)"), {
      target: { value: "{not valid json" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Create export run" }));

    expect(screen.getByText("Filter criteria must be valid JSON (an object).")).toBeInTheDocument();
    expect(global.fetch).not.toHaveBeenCalled();
  });

  it("rejects a JSON array (not an object) in Filter criteria", () => {
    global.fetch = vi.fn() as typeof fetch;
    render(<ExportRunForm modules={MODULES} />);
    fillRequiredFields();

    fireEvent.change(screen.getByLabelText("Filter criteria (JSON, optional)"), {
      target: { value: "[1, 2]" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Create export run" }));

    expect(screen.getByText("Filter criteria must be valid JSON (an object).")).toBeInTheDocument();
    expect(global.fetch).not.toHaveBeenCalled();
  });

  it("omits filterCriteria entirely when left blank", async () => {
    const fetchMock = vi.fn().mockResolvedValue(successResponse({ id: EXPORT_RUN_ID }));
    global.fetch = fetchMock as typeof fetch;
    render(<ExportRunForm modules={MODULES} />);
    fillRequiredFields();
    fireEvent.click(screen.getByRole("button", { name: "Create export run" }));

    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(1));
    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toBe("https://api.example.com/import-and-export-center/exports");
    const body = JSON.parse(init.body as string) as Record<string, unknown>;
    expect(body.filterCriteria).toBeUndefined();
    expect(body.publicId).toBe("EXP-1");
    expect(body.targetModuleKey).toBe("service_library");
    expect(body.format).toBe("csv");
    await waitFor(() =>
      expect(pushMock).toHaveBeenCalledWith(`/import-and-export-center/exports/${EXPORT_RUN_ID}`),
    );
  });

  it("submits a well-formed filterCriteria object as real JSON", async () => {
    const fetchMock = vi.fn().mockResolvedValue(successResponse({ id: EXPORT_RUN_ID }));
    global.fetch = fetchMock as typeof fetch;
    render(<ExportRunForm modules={MODULES} />);
    fillRequiredFields();
    fireEvent.change(screen.getByLabelText("Filter criteria (JSON, optional)"), {
      target: { value: '{"status": "active"}' },
    });
    fireEvent.click(screen.getByRole("button", { name: "Create export run" }));

    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(1));
    const body = JSON.parse((fetchMock.mock.calls[0]?.[1] as RequestInit).body as string) as Record<
      string,
      unknown
    >;
    expect(body.filterCriteria).toEqual({ status: "active" });
  });

  it("shows an error and does not navigate when the request fails", async () => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: false,
      json: async () => ({
        success: false,
        error: { code: "BadRequestException", message: "publicId already in use: EXP-1" },
        correlationId: "corr-1",
      }),
    }) as unknown as typeof fetch;
    render(<ExportRunForm modules={MODULES} />);
    fillRequiredFields();
    fireEvent.click(screen.getByRole("button", { name: "Create export run" }));

    await waitFor(() =>
      expect(screen.getByText("publicId already in use: EXP-1")).toBeInTheDocument(),
    );
    expect(pushMock).not.toHaveBeenCalled();
  });
});
