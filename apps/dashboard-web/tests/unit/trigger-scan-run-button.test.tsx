import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const pushMock = vi.fn();

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: pushMock }),
}));

import { TriggerScanRunButton } from "../../components/trigger-scan-run-button.js";

const PROJECT_ID = "11111111-1111-1111-1111-111111111111";
const DEFINITION_ID = "22222222-2222-2222-2222-222222222222";
const RUN_ID = "33333333-3333-3333-3333-333333333333";

describe("TriggerScanRunButton", () => {
  const originalFetch = global.fetch;

  beforeEach(() => {
    process.env.NEXT_PUBLIC_API_BASE_URL = "https://api.example.com";
    pushMock.mockReset();
  });

  afterEach(() => {
    global.fetch = originalFetch;
    vi.restoreAllMocks();
  });

  it("disables the button and shows a helper note when the definition is disabled", () => {
    render(
      <TriggerScanRunButton
        projectId={PROJECT_ID}
        scanDefinitionId={DEFINITION_ID}
        isEnabled={false}
      />,
    );
    expect(screen.getByRole("button", { name: "Trigger scan run" })).toBeDisabled();
    expect(screen.getByText(/Enable this definition first/)).toBeInTheDocument();
  });

  it("posts a manual run with a fresh RUN- prefixed publicId, then navigates to the new run", async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        success: true,
        data: { id: RUN_ID },
        correlationId: "corr-1",
      }),
    } as Response);
    global.fetch = fetchMock as unknown as typeof fetch;

    render(
      <TriggerScanRunButton projectId={PROJECT_ID} scanDefinitionId={DEFINITION_ID} isEnabled />,
    );
    fireEvent.click(screen.getByRole("button", { name: "Trigger scan run" }));

    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(1));
    const [url, options] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toBe(`https://api.example.com/scan-center/projects/${PROJECT_ID}/runs`);
    expect(options.method).toBe("POST");
    expect(options.credentials).toBe("include");
    const body = JSON.parse(options.body as string) as Record<string, unknown>;
    expect(body.scanDefinitionId).toBe(DEFINITION_ID);
    expect(body.triggerType).toBe("manual");
    expect(body.publicId).toMatch(/^RUN-/);

    await waitFor(() =>
      expect(pushMock).toHaveBeenCalledWith(`/scan-center/runs/${RUN_ID}?projectId=${PROJECT_ID}`),
    );
  });

  it("shows the backend's error message on failure, without navigating", async () => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: false,
      json: async () => ({
        success: false,
        error: {
          code: "BadRequestException",
          message: `Scan definition ${DEFINITION_ID} is disabled and cannot be run`,
        },
        correlationId: "corr-1",
      }),
    } as Response) as typeof fetch;

    render(
      <TriggerScanRunButton projectId={PROJECT_ID} scanDefinitionId={DEFINITION_ID} isEnabled />,
    );
    fireEvent.click(screen.getByRole("button", { name: "Trigger scan run" }));

    expect(await screen.findByRole("alert")).toHaveTextContent(/is disabled and cannot be run/);
    expect(pushMock).not.toHaveBeenCalled();
  });

  it("logs and shows a generic error, without navigating, when the fetch call itself throws", async () => {
    const consoleErrorSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    global.fetch = vi.fn().mockRejectedValue(new Error("network down")) as typeof fetch;

    render(
      <TriggerScanRunButton projectId={PROJECT_ID} scanDefinitionId={DEFINITION_ID} isEnabled />,
    );
    fireEvent.click(screen.getByRole("button", { name: "Trigger scan run" }));

    expect(await screen.findByRole("alert")).toHaveTextContent(
      "Something went wrong. Please try again.",
    );
    expect(pushMock).not.toHaveBeenCalled();
    expect(consoleErrorSpy).toHaveBeenCalled();
  });
});
