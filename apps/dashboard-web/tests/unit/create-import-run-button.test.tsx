import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { ImportRun } from "@webdesk/shared-types";

const pushMock = vi.fn();

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: pushMock }),
}));

import { CreateImportRunButton } from "../../components/create-import-run-button.js";

const TEMPLATE_ID = "11111111-1111-1111-1111-111111111111";
const RUN_ID = "22222222-2222-2222-2222-222222222222";

function successResponse(data: Partial<ImportRun>): Response {
  return {
    ok: true,
    json: async () => ({ success: true, data, correlationId: "corr-1" }),
  } as Response;
}

describe("CreateImportRunButton", () => {
  const originalFetch = global.fetch;

  beforeEach(() => {
    process.env.NEXT_PUBLIC_API_BASE_URL = "https://api.example.com";
    pushMock.mockReset();
  });

  afterEach(() => {
    global.fetch = originalFetch;
    vi.restoreAllMocks();
  });

  it("is disabled with a helper note when the template is inactive", () => {
    render(<CreateImportRunButton importTemplateId={TEMPLATE_ID} isTemplateActive={false} />);
    expect(screen.getByRole("button", { name: "Create import run" })).toBeDisabled();
    expect(screen.getByText("Enable this template first to create a run.")).toBeInTheDocument();
  });

  it("reveals an inline form on click instead of submitting immediately", () => {
    global.fetch = vi.fn() as typeof fetch;
    render(<CreateImportRunButton importTemplateId={TEMPLATE_ID} isTemplateActive={true} />);
    fireEvent.click(screen.getByRole("button", { name: "Create import run" }));
    expect(screen.getByLabelText("Dry run")).toBeInTheDocument();
    expect(global.fetch).not.toHaveBeenCalled();
  });

  it("defaults to isDryRun=true and duplicateStrategy omitted (use template default)", async () => {
    const fetchMock = vi.fn().mockResolvedValue(successResponse({ id: RUN_ID }));
    global.fetch = fetchMock as typeof fetch;
    render(<CreateImportRunButton importTemplateId={TEMPLATE_ID} isTemplateActive={true} />);
    fireEvent.click(screen.getByRole("button", { name: "Create import run" }));
    fireEvent.click(screen.getByRole("button", { name: "Create import run" }));

    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(1));
    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toBe("https://api.example.com/import-and-export-center/runs");
    const body = JSON.parse(init.body as string) as Record<string, unknown>;
    expect(body.importTemplateId).toBe(TEMPLATE_ID);
    expect(body.isDryRun).toBe(true);
    expect(body.duplicateStrategy).toBeNull();
    expect(typeof body.publicId).toBe("string");
    expect((body.publicId as string).startsWith("RUN-")).toBe(true);
    await waitFor(() =>
      expect(pushMock).toHaveBeenCalledWith(`/import-and-export-center/runs/${RUN_ID}`),
    );
  });

  it("submits an explicit duplicateStrategy and isDryRun=false when set", async () => {
    const fetchMock = vi.fn().mockResolvedValue(successResponse({ id: RUN_ID }));
    global.fetch = fetchMock as typeof fetch;
    render(<CreateImportRunButton importTemplateId={TEMPLATE_ID} isTemplateActive={true} />);
    fireEvent.click(screen.getByRole("button", { name: "Create import run" }));

    fireEvent.click(screen.getByLabelText("Dry run"));
    fireEvent.change(screen.getByLabelText("Duplicate strategy"), {
      target: { value: "overwrite" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Create import run" }));

    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(1));
    const body = JSON.parse((fetchMock.mock.calls[0]?.[1] as RequestInit).body as string) as Record<
      string,
      unknown
    >;
    expect(body.isDryRun).toBe(false);
    expect(body.duplicateStrategy).toBe("overwrite");
  });

  it("Cancel closes the form without calling fetch", () => {
    global.fetch = vi.fn() as typeof fetch;
    render(<CreateImportRunButton importTemplateId={TEMPLATE_ID} isTemplateActive={true} />);
    fireEvent.click(screen.getByRole("button", { name: "Create import run" }));
    fireEvent.click(screen.getByRole("button", { name: "Cancel" }));
    expect(screen.queryByLabelText("Dry run")).not.toBeInTheDocument();
    expect(global.fetch).not.toHaveBeenCalled();
  });
});
