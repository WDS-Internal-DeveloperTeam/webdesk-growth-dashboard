import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const refreshMock = vi.fn();

vi.mock("next/navigation", () => ({
  useRouter: () => ({ refresh: refreshMock }),
}));

import { SystemSettingActiveStateActions } from "../../components/system-setting-active-state-actions.js";

const SETTING_ID = "11111111-1111-1111-1111-111111111111";

describe("SystemSettingActiveStateActions", () => {
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
    render(<SystemSettingActiveStateActions settingId={SETTING_ID} isActive={true} />);
    expect(screen.getByRole("button", { name: "Deactivate" })).toBeInTheDocument();
  });

  it("inactive: shows an Activate button", () => {
    render(<SystemSettingActiveStateActions settingId={SETTING_ID} isActive={false} />);
    expect(screen.getByRole("button", { name: "Activate" })).toBeInTheDocument();
  });

  it("clicking Deactivate posts isActive: false with the current value as expectedIsActive, then refreshes", async () => {
    const fetchMock = vi.fn().mockResolvedValue({ ok: true } as Response);
    global.fetch = fetchMock as typeof fetch;

    render(<SystemSettingActiveStateActions settingId={SETTING_ID} isActive={true} />);
    fireEvent.click(screen.getByRole("button", { name: "Deactivate" }));

    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(1));
    expect(fetchMock).toHaveBeenCalledWith(
      `https://api.example.com/system-settings/settings/${SETTING_ID}/active-state`,
      expect.objectContaining({
        method: "POST",
        credentials: "include",
        body: JSON.stringify({ isActive: false, expectedIsActive: true }),
      }),
    );
    await waitFor(() => expect(refreshMock).toHaveBeenCalledTimes(1));
  });

  it("clicking Activate posts isActive: true with the current value as expectedIsActive", async () => {
    const fetchMock = vi.fn().mockResolvedValue({ ok: true } as Response);
    global.fetch = fetchMock as typeof fetch;

    render(<SystemSettingActiveStateActions settingId={SETTING_ID} isActive={false} />);
    fireEvent.click(screen.getByRole("button", { name: "Activate" }));

    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(1));
    expect(fetchMock).toHaveBeenCalledWith(
      expect.any(String),
      expect.objectContaining({
        body: JSON.stringify({ isActive: true, expectedIsActive: false }),
      }),
    );
  });

  it("after a successful toggle, the button label flips immediately, without waiting on refresh", async () => {
    global.fetch = vi.fn().mockResolvedValue({ ok: true } as Response) as typeof fetch;

    render(<SystemSettingActiveStateActions settingId={SETTING_ID} isActive={true} />);
    fireEvent.click(screen.getByRole("button", { name: "Deactivate" }));

    await waitFor(() => expect(refreshMock).toHaveBeenCalledTimes(1));
    expect(screen.getByRole("button", { name: "Activate" })).toBeInTheDocument();
  });

  it("shows a clean conflict message and does not flip the button when the backend rejects a stale expectedIsActive", async () => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: false,
      json: async () => ({
        success: false,
        error: {
          code: "ConflictException",
          message: `System setting ${SETTING_ID}'s active state changed concurrently — reload and retry`,
        },
        correlationId: "corr-1",
      }),
    } as Response) as typeof fetch;

    render(<SystemSettingActiveStateActions settingId={SETTING_ID} isActive={true} />);
    fireEvent.click(screen.getByRole("button", { name: "Deactivate" }));

    expect(await screen.findByRole("alert")).toHaveTextContent(/changed concurrently/);
    expect(screen.getByRole("button", { name: "Deactivate" })).toBeInTheDocument();
    expect(refreshMock).not.toHaveBeenCalled();
  });

  it("re-syncs isActive from a fresh prop without a remount", () => {
    const { rerender } = render(
      <SystemSettingActiveStateActions settingId={SETTING_ID} isActive={true} />,
    );
    expect(screen.getByRole("button", { name: "Deactivate" })).toBeInTheDocument();

    rerender(<SystemSettingActiveStateActions settingId={SETTING_ID} isActive={false} />);
    expect(screen.getByRole("button", { name: "Activate" })).toBeInTheDocument();
  });
});
