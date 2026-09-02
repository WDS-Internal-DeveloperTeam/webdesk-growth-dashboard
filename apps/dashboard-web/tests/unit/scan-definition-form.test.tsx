import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const pushMock = vi.fn();

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: pushMock }),
}));

import type { ScanDefinition } from "@webdesk/shared-types";
import { ScanDefinitionForm } from "../../components/scan-definition-form.js";

const PROJECT_ID = "11111111-1111-1111-1111-111111111111";
const DEFINITION_ID = "22222222-2222-2222-2222-222222222222";

function definitionFixture(overrides: Partial<ScanDefinition> = {}): ScanDefinition {
  return {
    id: DEFINITION_ID,
    projectId: PROJECT_ID,
    publicId: "SCAN-1",
    name: "Homepage accessibility scan",
    scanType: "accessibility",
    mode: "manual",
    target: null,
    environment: null,
    scheduleCron: null,
    isEnabled: true,
    createdBy: null,
    updatedBy: null,
    createdAt: "2026-09-02T00:00:00.000Z",
    updatedAt: "2026-09-02T00:00:00.000Z",
    ...overrides,
  };
}

describe("ScanDefinitionForm", () => {
  const originalFetch = global.fetch;

  beforeEach(() => {
    process.env.NEXT_PUBLIC_API_BASE_URL = "https://api.example.com";
    pushMock.mockReset();
  });

  afterEach(() => {
    global.fetch = originalFetch;
    vi.restoreAllMocks();
  });

  it("create mode: shows a Public ID field and a Scan type select", () => {
    render(<ScanDefinitionForm mode="create" projectId={PROJECT_ID} />);
    expect(screen.getByLabelText("Public ID")).toBeInTheDocument();
    expect(screen.getByLabelText("Scan type")).toBeInTheDocument();
  });

  it("edit mode: shows the Public ID and Scan type as read-only, not editable inputs", () => {
    render(<ScanDefinitionForm mode="edit" projectId={PROJECT_ID} initial={definitionFixture()} />);
    expect(screen.queryByLabelText("Public ID")).not.toBeInTheDocument();
    expect(screen.queryByLabelText("Scan type")).not.toBeInTheDocument();
    expect(screen.getByText("SCAN-1")).toBeInTheDocument();
  });

  it("create: submits to POST .../definitions with the publicId/scanType included", async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        success: true,
        data: definitionFixture(),
        correlationId: "corr-1",
      }),
    } as Response);
    global.fetch = fetchMock as unknown as typeof fetch;

    render(<ScanDefinitionForm mode="create" projectId={PROJECT_ID} />);
    fireEvent.change(screen.getByLabelText("Public ID"), { target: { value: "SCAN-2" } });
    fireEvent.change(screen.getByLabelText("Name"), {
      target: { value: "Full site scan" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Create definition" }));

    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(1));
    const [url, options] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toBe(`https://api.example.com/scan-center/projects/${PROJECT_ID}/definitions`);
    expect(options.method).toBe("POST");
    expect(options.credentials).toBe("include");
    const body = JSON.parse(options.body as string) as Record<string, unknown>;
    expect(body.publicId).toBe("SCAN-2");
    expect(body.scanType).toBe("full_website");
    expect(body.name).toBe("Full site scan");
    expect(body.isEnabled).toBe(true);

    await waitFor(() =>
      expect(pushMock).toHaveBeenCalledWith(
        `/scan-center/definitions/${DEFINITION_ID}?projectId=${PROJECT_ID}`,
      ),
    );
  });

  it("edit: submits to POST .../definitions/:id/update without publicId/scanType in the payload", async () => {
    const initial = definitionFixture({ name: "Old name" });
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ success: true, data: initial, correlationId: "corr-1" }),
    } as Response);
    global.fetch = fetchMock as unknown as typeof fetch;

    render(<ScanDefinitionForm mode="edit" projectId={PROJECT_ID} initial={initial} />);
    fireEvent.change(screen.getByLabelText("Name"), { target: { value: "New name" } });
    fireEvent.click(screen.getByRole("button", { name: "Save changes" }));

    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(1));
    const [url, options] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toBe(
      `https://api.example.com/scan-center/projects/${PROJECT_ID}/definitions/${DEFINITION_ID}/update`,
    );
    const body = JSON.parse(options.body as string) as Record<string, unknown>;
    expect(body.publicId).toBeUndefined();
    expect(body.scanType).toBeUndefined();
    expect(body.name).toBe("New name");

    await waitFor(() =>
      expect(pushMock).toHaveBeenCalledWith(
        `/scan-center/definitions/${DEFINITION_ID}?projectId=${PROJECT_ID}`,
      ),
    );
  });

  it("sends an explicit null for a cleared optional text field on edit, but omits it on create", async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ success: true, data: definitionFixture(), correlationId: "corr-1" }),
    } as Response);
    global.fetch = fetchMock as unknown as typeof fetch;

    render(
      <ScanDefinitionForm
        mode="edit"
        projectId={PROJECT_ID}
        initial={definitionFixture({ environment: "staging" })}
      />,
    );
    fireEvent.change(screen.getByLabelText("Environment"), { target: { value: "" } });
    fireEvent.click(screen.getByRole("button", { name: "Save changes" }));

    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(1));
    const [, options] = fetchMock.mock.calls[0] as [string, RequestInit];
    const body = JSON.parse(options.body as string) as Record<string, unknown>;
    expect(body.environment).toBeNull();
  });

  it("shows the backend's error message on failure, without navigating", async () => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: false,
      json: async () => ({
        success: false,
        error: { code: "BadRequestException", message: "publicId already in use: SCAN-2" },
        correlationId: "corr-1",
      }),
    } as Response) as typeof fetch;

    render(<ScanDefinitionForm mode="create" projectId={PROJECT_ID} />);
    fireEvent.change(screen.getByLabelText("Public ID"), { target: { value: "SCAN-2" } });
    fireEvent.change(screen.getByLabelText("Name"), { target: { value: "Full site scan" } });
    fireEvent.click(screen.getByRole("button", { name: "Create definition" }));

    expect(await screen.findByRole("alert")).toHaveTextContent(/already in use/);
    expect(pushMock).not.toHaveBeenCalled();
  });
});
