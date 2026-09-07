import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const refreshMock = vi.fn();

vi.mock("next/navigation", () => ({
  useRouter: () => ({ refresh: refreshMock }),
}));

import { IntegrationVerifyAction } from "../../components/integration-verify-action.js";

const INTEGRATION_ID = "11111111-1111-1111-1111-111111111111";

describe("IntegrationVerifyAction", () => {
  const originalFetch = global.fetch;

  beforeEach(() => {
    process.env.NEXT_PUBLIC_API_BASE_URL = "https://api.example.com";
    refreshMock.mockReset();
  });

  afterEach(() => {
    global.fetch = originalFetch;
    vi.restoreAllMocks();
  });

  it("the result select is a real HTML required field", () => {
    render(<IntegrationVerifyAction integrationId={INTEGRATION_ID} />);
    expect(screen.getByLabelText("Verification result")).toBeRequired();
  });

  it("posts result/notes to the verify route, then refreshes and resets the form", async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ success: true, data: {}, correlationId: "corr-1" }),
    } as Response);
    global.fetch = fetchMock as typeof fetch;

    render(<IntegrationVerifyAction integrationId={INTEGRATION_ID} />);
    fireEvent.change(screen.getByLabelText("Verification result"), {
      target: { value: "success" },
    });
    fireEvent.change(screen.getByLabelText("Notes"), { target: { value: "Checked manually" } });
    fireEvent.click(screen.getByRole("button", { name: "Record verification" }));

    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(1));
    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toBe(`https://api.example.com/integrations/${INTEGRATION_ID}/verify`);
    expect(init.method).toBe("POST");
    expect(init.credentials).toBe("include");
    const body = JSON.parse(init.body as string);
    expect(body).toEqual({ result: "success", notes: "Checked manually" });

    await waitFor(() => expect(refreshMock).toHaveBeenCalledTimes(1));
    expect(screen.getByLabelText("Verification result")).toHaveValue("");
    expect(screen.getByLabelText("Notes")).toHaveValue("");
  });

  it("sends an explicit null when notes is left blank", async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ success: true, data: {}, correlationId: "corr-1" }),
    } as Response);
    global.fetch = fetchMock as typeof fetch;

    render(<IntegrationVerifyAction integrationId={INTEGRATION_ID} />);
    fireEvent.change(screen.getByLabelText("Verification result"), {
      target: { value: "failure" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Record verification" }));

    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(1));
    const [, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    const body = JSON.parse(init.body as string);
    expect(body).toEqual({ result: "failure", notes: null });
  });

  it("shows the backend's error message on a failed submit and does not refresh", async () => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: false,
      status: 403,
      json: async () => ({
        success: false,
        error: { code: "ForbiddenException", message: "denied" },
        correlationId: "corr-1",
      }),
    } as Response) as typeof fetch;

    render(<IntegrationVerifyAction integrationId={INTEGRATION_ID} />);
    fireEvent.change(screen.getByLabelText("Verification result"), {
      target: { value: "unknown" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Record verification" }));

    expect(await screen.findByRole("alert")).toBeInTheDocument();
    expect(refreshMock).not.toHaveBeenCalled();
  });
});
