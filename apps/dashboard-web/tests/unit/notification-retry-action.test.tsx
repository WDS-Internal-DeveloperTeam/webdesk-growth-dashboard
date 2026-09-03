import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const refreshMock = vi.fn();

vi.mock("next/navigation", () => ({
  useRouter: () => ({ refresh: refreshMock }),
}));

import { NotificationRetryAction } from "../../components/notification-retry-action.js";

const NOTIFICATION_ID = "11111111-1111-1111-1111-111111111111";
const RETRY_URL = `https://api.example.com/notifications/${NOTIFICATION_ID}/attempt-delivery`;

describe("NotificationRetryAction", () => {
  const originalFetch = global.fetch;

  beforeEach(() => {
    process.env.NEXT_PUBLIC_API_BASE_URL = "https://api.example.com";
    refreshMock.mockReset();
  });

  afterEach(() => {
    global.fetch = originalFetch;
    vi.restoreAllMocks();
  });

  it.each(["queued", "retrying"] as const)(
    "%s + retryEligible: renders the Attempt delivery button",
    (deliveryState) => {
      render(
        <NotificationRetryAction
          notificationId={NOTIFICATION_ID}
          deliveryState={deliveryState}
          retryEligible={true}
        />,
      );
      expect(screen.getByRole("button", { name: "Attempt delivery" })).toBeInTheDocument();
    },
  );

  it.each(["accepted", "failed", "sent_to_smtp", "permanently_failed"] as const)(
    "%s: renders nothing, regardless of retryEligible",
    (deliveryState) => {
      const { container } = render(
        <NotificationRetryAction
          notificationId={NOTIFICATION_ID}
          deliveryState={deliveryState}
          retryEligible={true}
        />,
      );
      expect(container).toBeEmptyDOMElement();
    },
  );

  it("renders nothing when retryEligible is false, even in a retryable delivery state", () => {
    const { container } = render(
      <NotificationRetryAction
        notificationId={NOTIFICATION_ID}
        deliveryState="retrying"
        retryEligible={false}
      />,
    );
    expect(container).toBeEmptyDOMElement();
  });

  it("posts a no-body request to the attempt-delivery route, then refreshes", async () => {
    const fetchMock = vi.fn().mockResolvedValue({ ok: true } as Response);
    global.fetch = fetchMock as typeof fetch;

    render(
      <NotificationRetryAction
        notificationId={NOTIFICATION_ID}
        deliveryState="queued"
        retryEligible={true}
      />,
    );
    fireEvent.click(screen.getByRole("button", { name: "Attempt delivery" }));

    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(1));
    expect(fetchMock).toHaveBeenCalledWith(
      RETRY_URL,
      expect.objectContaining({
        method: "POST",
        credentials: "include",
        body: undefined,
      }),
    );
    await waitFor(() => expect(refreshMock).toHaveBeenCalledTimes(1));
  });

  it("shows the backend's error message on failure, without refreshing", async () => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: false,
      json: async () => ({
        success: false,
        error: { code: "BadRequestException", message: "Notification is not eligible for retry" },
        correlationId: "corr-1",
      }),
    } as Response) as typeof fetch;

    render(
      <NotificationRetryAction
        notificationId={NOTIFICATION_ID}
        deliveryState="queued"
        retryEligible={true}
      />,
    );
    fireEvent.click(screen.getByRole("button", { name: "Attempt delivery" }));

    expect(await screen.findByRole("alert")).toHaveTextContent(/not eligible for retry/);
    expect(refreshMock).not.toHaveBeenCalled();
  });

  it("logs and shows a generic error, without refreshing, when the fetch call itself throws", async () => {
    const consoleErrorSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    global.fetch = vi.fn().mockRejectedValue(new Error("network down")) as typeof fetch;

    render(
      <NotificationRetryAction
        notificationId={NOTIFICATION_ID}
        deliveryState="queued"
        retryEligible={true}
      />,
    );
    fireEvent.click(screen.getByRole("button", { name: "Attempt delivery" }));

    expect(await screen.findByRole("alert")).toHaveTextContent(
      "Something went wrong. Please try again.",
    );
    expect(refreshMock).not.toHaveBeenCalled();
    expect(consoleErrorSpy).toHaveBeenCalled();
  });
});
