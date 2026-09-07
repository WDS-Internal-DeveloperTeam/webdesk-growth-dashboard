import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const refreshMock = vi.fn();

vi.mock("next/navigation", () => ({
  useRouter: () => ({ refresh: refreshMock }),
}));

import { IntegrationActiveToggle } from "../../components/integration-active-toggle.js";

const INTEGRATION_ID = "11111111-1111-1111-1111-111111111111";

describe("IntegrationActiveToggle", () => {
  const originalFetch = global.fetch;

  beforeEach(() => {
    process.env.NEXT_PUBLIC_API_BASE_URL = "https://api.example.com";
    refreshMock.mockReset();
  });

  afterEach(() => {
    global.fetch = originalFetch;
    vi.restoreAllMocks();
  });

  it("active: shows a Deactivate button", () => {
    render(<IntegrationActiveToggle integrationId={INTEGRATION_ID} isActive={true} />);
    expect(screen.getByRole("button", { name: "Deactivate" })).toBeInTheDocument();
  });

  it("inactive: shows an Activate button", () => {
    render(<IntegrationActiveToggle integrationId={INTEGRATION_ID} isActive={false} />);
    expect(screen.getByRole("button", { name: "Activate" })).toBeInTheDocument();
  });

  it("clicking Deactivate posts isActive: false to the toggle-active route with no confirmation, then refreshes", async () => {
    const confirmSpy = vi.fn();
    window.confirm = confirmSpy;
    const fetchMock = vi.fn().mockResolvedValue({ ok: true } as Response);
    global.fetch = fetchMock as typeof fetch;

    render(<IntegrationActiveToggle integrationId={INTEGRATION_ID} isActive={true} />);
    fireEvent.click(screen.getByRole("button", { name: "Deactivate" }));

    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(1));
    expect(confirmSpy).not.toHaveBeenCalled();
    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toBe(`https://api.example.com/integrations/${INTEGRATION_ID}/toggle-active`);
    expect(init.method).toBe("POST");
    expect(init.credentials).toBe("include");
    expect(JSON.parse(init.body as string)).toEqual({ isActive: false });
    await waitFor(() => expect(refreshMock).toHaveBeenCalledTimes(1));
  });

  it("after a successful toggle, the button flips immediately without waiting on refresh", async () => {
    global.fetch = vi.fn().mockResolvedValue({ ok: true } as Response) as typeof fetch;

    render(<IntegrationActiveToggle integrationId={INTEGRATION_ID} isActive={false} />);
    fireEvent.click(screen.getByRole("button", { name: "Activate" }));

    await waitFor(() => expect(refreshMock).toHaveBeenCalledTimes(1));
    expect(screen.getByRole("button", { name: "Deactivate" })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Activate" })).not.toBeInTheDocument();
  });

  it("re-syncs isActive from a fresh prop without a remount", () => {
    const { rerender } = render(
      <IntegrationActiveToggle integrationId={INTEGRATION_ID} isActive={true} />,
    );
    expect(screen.getByRole("button", { name: "Deactivate" })).toBeInTheDocument();

    rerender(<IntegrationActiveToggle integrationId={INTEGRATION_ID} isActive={false} />);
    expect(screen.getByRole("button", { name: "Activate" })).toBeInTheDocument();
  });

  it("shows the backend's error message on a failed toggle and does not refresh", async () => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: false,
      json: async () => ({
        success: false,
        error: { code: "ForbiddenException", message: "denied" },
        correlationId: "corr-1",
      }),
    } as Response) as typeof fetch;

    render(<IntegrationActiveToggle integrationId={INTEGRATION_ID} isActive={true} />);
    fireEvent.click(screen.getByRole("button", { name: "Deactivate" }));

    expect(await screen.findByRole("alert")).toBeInTheDocument();
    expect(refreshMock).not.toHaveBeenCalled();
  });
});
