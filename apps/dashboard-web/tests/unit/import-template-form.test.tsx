import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { ImportTemplate, ModuleRegistrySummary } from "@webdesk/shared-types";

const pushMock = vi.fn();

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: pushMock }),
}));

import { ImportTemplateForm } from "../../components/import-template-form.js";

const TEMPLATE_ID = "11111111-1111-1111-1111-111111111111";

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

function successResponse(data: Partial<ImportTemplate>): Response {
  return {
    ok: true,
    json: async () => ({ success: true, data, correlationId: "corr-1" }),
  } as Response;
}

function templateFixture(overrides: Partial<ImportTemplate> = {}): ImportTemplate {
  return {
    id: TEMPLATE_ID,
    publicId: "TPL-1",
    name: "Service import",
    targetModuleKey: "service_library",
    columnMapping: null,
    duplicateStrategyDefault: "skip",
    fileFormat: "csv",
    version: 1,
    isActive: true,
    createdBy: null,
    updatedBy: null,
    createdAt: "2026-09-02T00:00:00.000Z",
    updatedAt: "2026-09-02T00:00:00.000Z",
    ...overrides,
  };
}

describe("ImportTemplateForm", () => {
  const originalFetch = global.fetch;

  beforeEach(() => {
    process.env.NEXT_PUBLIC_API_BASE_URL = "https://api.example.com";
    pushMock.mockReset();
  });

  afterEach(() => {
    global.fetch = originalFetch;
    vi.restoreAllMocks();
  });

  it("create mode: rejects malformed JSON in Column mapping before ever calling fetch", () => {
    global.fetch = vi.fn() as typeof fetch;
    render(<ImportTemplateForm mode="create" modules={MODULES} />);

    fireEvent.change(screen.getByLabelText("Public ID"), { target: { value: "TPL-2" } });
    fireEvent.change(screen.getByLabelText("Name"), { target: { value: "New template" } });
    fireEvent.change(screen.getByLabelText("Target module"), {
      target: { value: "service_library" },
    });
    fireEvent.change(screen.getByLabelText("Column mapping (JSON, optional)"), {
      target: { value: "{not valid json" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Create template" }));

    expect(screen.getByText("Column mapping must be valid JSON (an object).")).toBeInTheDocument();
    expect(global.fetch).not.toHaveBeenCalled();
  });

  it("create mode: rejects a JSON array (not an object) in Column mapping", () => {
    global.fetch = vi.fn() as typeof fetch;
    render(<ImportTemplateForm mode="create" modules={MODULES} />);

    fireEvent.change(screen.getByLabelText("Public ID"), { target: { value: "TPL-2" } });
    fireEvent.change(screen.getByLabelText("Name"), { target: { value: "New template" } });
    fireEvent.change(screen.getByLabelText("Target module"), {
      target: { value: "service_library" },
    });
    fireEvent.change(screen.getByLabelText("Column mapping (JSON, optional)"), {
      target: { value: "[1, 2, 3]" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Create template" }));

    expect(screen.getByText("Column mapping must be valid JSON (an object).")).toBeInTheDocument();
    expect(global.fetch).not.toHaveBeenCalled();
  });

  it("create mode: omits columnMapping entirely when left blank", async () => {
    const fetchMock = vi.fn().mockResolvedValue(successResponse({ id: TEMPLATE_ID }));
    global.fetch = fetchMock as typeof fetch;
    render(<ImportTemplateForm mode="create" modules={MODULES} />);

    fireEvent.change(screen.getByLabelText("Public ID"), { target: { value: "TPL-2" } });
    fireEvent.change(screen.getByLabelText("Name"), { target: { value: "New template" } });
    fireEvent.change(screen.getByLabelText("Target module"), {
      target: { value: "service_library" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Create template" }));

    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(1));
    const body = JSON.parse((fetchMock.mock.calls[0]?.[1] as RequestInit).body as string) as Record<
      string,
      unknown
    >;
    expect(body.columnMapping).toBeUndefined();
    expect(body.publicId).toBe("TPL-2");
    expect(body.targetModuleKey).toBe("service_library");
    await waitFor(() =>
      expect(pushMock).toHaveBeenCalledWith(`/import-and-export-center/templates/${TEMPLATE_ID}`),
    );
  });

  it("create mode: submits a well-formed columnMapping object as real JSON", async () => {
    const fetchMock = vi.fn().mockResolvedValue(successResponse({ id: TEMPLATE_ID }));
    global.fetch = fetchMock as typeof fetch;
    render(<ImportTemplateForm mode="create" modules={MODULES} />);

    fireEvent.change(screen.getByLabelText("Public ID"), { target: { value: "TPL-2" } });
    fireEvent.change(screen.getByLabelText("Name"), { target: { value: "New template" } });
    fireEvent.change(screen.getByLabelText("Target module"), {
      target: { value: "service_library" },
    });
    fireEvent.change(screen.getByLabelText("Column mapping (JSON, optional)"), {
      target: { value: '{"csvColumn": "targetField"}' },
    });
    fireEvent.click(screen.getByRole("button", { name: "Create template" }));

    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(1));
    const body = JSON.parse((fetchMock.mock.calls[0]?.[1] as RequestInit).body as string) as Record<
      string,
      unknown
    >;
    expect(body.columnMapping).toEqual({ csvColumn: "targetField" });
  });

  it("edit mode: shows publicId and target module read-only, submits fileFormat as editable", async () => {
    const fetchMock = vi.fn().mockResolvedValue(successResponse({ id: TEMPLATE_ID }));
    global.fetch = fetchMock as typeof fetch;
    const initial = templateFixture();
    render(
      <ImportTemplateForm
        mode="edit"
        templateId={TEMPLATE_ID}
        initial={initial}
        modules={MODULES}
      />,
    );

    expect(screen.queryByLabelText("Public ID")).not.toBeInTheDocument();
    expect(screen.getByText("TPL-1")).toBeInTheDocument();
    expect(screen.queryByLabelText("Target module")).not.toBeInTheDocument();

    fireEvent.change(screen.getByLabelText("File format"), { target: { value: "xlsx" } });
    fireEvent.click(screen.getByRole("button", { name: "Save changes" }));

    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(1));
    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toBe(`https://api.example.com/import-and-export-center/templates/${TEMPLATE_ID}`);
    expect(init.method).toBe("PATCH");
    const body = JSON.parse(init.body as string) as Record<string, unknown>;
    expect(body.fileFormat).toBe("xlsx");
    // publicId/targetModuleKey are never present in an edit submission at all.
    expect(body.publicId).toBeUndefined();
    expect(body.targetModuleKey).toBeUndefined();
  });

  it("edit mode: sends an explicit null for columnMapping when cleared", async () => {
    const fetchMock = vi.fn().mockResolvedValue(successResponse({ id: TEMPLATE_ID }));
    global.fetch = fetchMock as typeof fetch;
    const initial = templateFixture({ columnMapping: { a: "b" } });
    render(
      <ImportTemplateForm
        mode="edit"
        templateId={TEMPLATE_ID}
        initial={initial}
        modules={MODULES}
      />,
    );

    fireEvent.change(screen.getByLabelText("Column mapping (JSON, optional)"), {
      target: { value: "" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Save changes" }));

    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(1));
    const body = JSON.parse((fetchMock.mock.calls[0]?.[1] as RequestInit).body as string) as Record<
      string,
      unknown
    >;
    expect(body.columnMapping).toBeNull();
  });
});
