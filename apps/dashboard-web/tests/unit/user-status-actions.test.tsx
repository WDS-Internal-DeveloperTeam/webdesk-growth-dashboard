import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const refreshMock = vi.fn();

vi.mock("next/navigation", () => ({
  useRouter: () => ({ refresh: refreshMock }),
}));

import { UserStatusActions } from "../../components/user-status-actions.js";

const USER_ID = "22222222-2222-2222-2222-222222222222";

describe("UserStatusActions", () => {
  const originalFetch = global.fetch;

  beforeEach(() => {
    process.env.NEXT_PUBLIC_API_BASE_URL = "https://api.example.com";
    refreshMock.mockReset();
  });

  afterEach(() => {
    global.fetch = originalFetch;
    vi.restoreAllMocks();
  });

  it("active: shows Deactivate only", () => {
    render(<UserStatusActions userId={USER_ID} accountStatus="active" />);
    expect(screen.getByRole("button", { name: "Deactivate" })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Activate" })).not.toBeInTheDocument();
  });

  it("disabled: shows Activate only", () => {
    render(<UserStatusActions userId={USER_ID} accountStatus="disabled" />);
    expect(screen.queryByRole("button", { name: "Deactivate" })).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Activate" })).toBeInTheDocument();
  });

  it("Activate: posts status:active with no confirmation prompt, then refreshes", async () => {
    const confirmSpy = vi.fn();
    window.confirm = confirmSpy;
    const fetchMock = vi.fn().mockResolvedValue({ ok: true } as Response);
    global.fetch = fetchMock as typeof fetch;

    render(<UserStatusActions userId={USER_ID} accountStatus="disabled" />);
    fireEvent.click(screen.getByRole("button", { name: "Activate" }));

    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(1));
    expect(confirmSpy).not.toHaveBeenCalled();
    expect(fetchMock).toHaveBeenCalledWith(
      `https://api.example.com/users-roles-and-permissions/users/${USER_ID}/status`,
      expect.objectContaining({
        method: "POST",
        credentials: "include",
        body: JSON.stringify({ status: "active" }),
      }),
    );
    await waitFor(() => expect(refreshMock).toHaveBeenCalledTimes(1));
  });

  it("Deactivate: confirms first, then posts status:disabled and refreshes", async () => {
    const confirmSpy = vi.fn().mockReturnValue(true);
    window.confirm = confirmSpy;
    const fetchMock = vi.fn().mockResolvedValue({ ok: true } as Response);
    global.fetch = fetchMock as typeof fetch;

    render(<UserStatusActions userId={USER_ID} accountStatus="active" />);
    fireEvent.click(screen.getByRole("button", { name: "Deactivate" }));

    expect(confirmSpy).toHaveBeenCalledTimes(1);
    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(1));
    expect(fetchMock).toHaveBeenCalledWith(
      `https://api.example.com/users-roles-and-permissions/users/${USER_ID}/status`,
      expect.objectContaining({
        method: "POST",
        credentials: "include",
        body: JSON.stringify({ status: "disabled" }),
      }),
    );
    await waitFor(() => expect(refreshMock).toHaveBeenCalledTimes(1));
  });

  it("Deactivate: does nothing if the confirmation is declined", async () => {
    const confirmSpy = vi.fn().mockReturnValue(false);
    window.confirm = confirmSpy;
    const fetchMock = vi.fn();
    global.fetch = fetchMock as typeof fetch;

    render(<UserStatusActions userId={USER_ID} accountStatus="active" />);
    fireEvent.click(screen.getByRole("button", { name: "Deactivate" }));

    expect(confirmSpy).toHaveBeenCalledTimes(1);
    expect(fetchMock).not.toHaveBeenCalled();
    expect(refreshMock).not.toHaveBeenCalled();
  });

  it("shows the backend's error message on a failed transition and does not refresh", async () => {
    window.confirm = vi.fn().mockReturnValue(true);
    const fetchMock = vi.fn().mockResolvedValue({
      ok: false,
      json: () =>
        Promise.resolve({
          error: {
            code: "ConflictException",
            message: "Cannot deactivate the last active Super Admin account.",
          },
        }),
    } as Response);
    global.fetch = fetchMock as typeof fetch;

    render(<UserStatusActions userId={USER_ID} accountStatus="active" />);
    fireEvent.click(screen.getByRole("button", { name: "Deactivate" }));

    expect(
      await screen.findByText("Cannot deactivate the last active Super Admin account."),
    ).toBeInTheDocument();
    expect(refreshMock).not.toHaveBeenCalled();
  });
});
