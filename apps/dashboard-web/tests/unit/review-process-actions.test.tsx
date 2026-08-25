import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { UserSummary } from "@webdesk/shared-types";

const refreshMock = vi.fn();

vi.mock("next/navigation", () => ({
  useRouter: () => ({ refresh: refreshMock }),
}));

import { ReviewProcessActions } from "../../components/review-process-actions.js";

const REVIEW_ID = "11111111-1111-1111-1111-111111111111";
const CURRENT_ASSIGNEE_ID = "22222222-2222-2222-2222-222222222222";
const NEW_ASSIGNEE_ID = "33333333-3333-3333-3333-333333333333";

const CURRENT_ASSIGNEE: UserSummary = {
  id: CURRENT_ASSIGNEE_ID,
  displayName: "Jane Doe",
  email: "jane@example.com",
};

function reviewResponse(overrides: Record<string, unknown> = {}): Response {
  return {
    ok: true,
    json: async () => ({
      success: true,
      data: { id: REVIEW_ID, isPaused: false, assignedToUserId: null, ...overrides },
      correlationId: "corr-1",
    }),
  } as Response;
}

describe("ReviewProcessActions", () => {
  const originalFetch = global.fetch;

  beforeEach(() => {
    process.env.NEXT_PUBLIC_API_BASE_URL = "https://api.example.com";
    refreshMock.mockReset();
  });

  afterEach(() => {
    global.fetch = originalFetch;
    vi.restoreAllMocks();
  });

  it("submitted + not paused: shows Pause", () => {
    render(
      <ReviewProcessActions
        reviewId={REVIEW_ID}
        status="submitted"
        isPaused={false}
        assignedToUserId={null}
        assignedToUser={null}
      />,
    );
    expect(screen.getByRole("button", { name: "Pause" })).toBeInTheDocument();
  });

  it("submitted + paused: shows Resume", () => {
    render(
      <ReviewProcessActions
        reviewId={REVIEW_ID}
        status="submitted"
        isPaused={true}
        assignedToUserId={null}
        assignedToUser={null}
      />,
    );
    expect(screen.getByRole("button", { name: "Resume" })).toBeInTheDocument();
  });

  it("approved: renders nothing — terminal state", () => {
    const { container } = render(
      <ReviewProcessActions
        reviewId={REVIEW_ID}
        status="approved"
        isPaused={false}
        assignedToUserId={null}
        assignedToUser={null}
      />,
    );
    expect(container).toBeEmptyDOMElement();
  });

  it("rejected: renders nothing — terminal state", () => {
    const { container } = render(
      <ReviewProcessActions
        reviewId={REVIEW_ID}
        status="rejected"
        isPaused={false}
        assignedToUserId={null}
        assignedToUser={null}
      />,
    );
    expect(container).toBeEmptyDOMElement();
  });

  it("shows the currently-assigned user in the delegate picker when provided", () => {
    render(
      <ReviewProcessActions
        reviewId={REVIEW_ID}
        status="submitted"
        isPaused={false}
        assignedToUserId={CURRENT_ASSIGNEE_ID}
        assignedToUser={CURRENT_ASSIGNEE}
      />,
    );
    expect(screen.getByText("Jane Doe")).toBeInTheDocument();
  });

  it("Delegate is disabled until a genuinely different assignee is chosen", async () => {
    const searchResponse = {
      ok: true,
      json: async () => ({
        success: true,
        data: [{ id: NEW_ASSIGNEE_ID, displayName: "John Smith", email: "john@example.com" }],
        correlationId: "corr-1",
      }),
    } as Response;
    global.fetch = vi.fn((url: string) =>
      url.includes("/users?") ? Promise.resolve(searchResponse) : Promise.resolve(reviewResponse()),
    ) as unknown as typeof fetch;

    render(
      <ReviewProcessActions
        reviewId={REVIEW_ID}
        status="submitted"
        isPaused={false}
        assignedToUserId={null}
        assignedToUser={null}
      />,
    );
    expect(screen.getByRole("button", { name: "Delegate" })).toBeDisabled();

    fireEvent.change(screen.getByPlaceholderText("Search by name or email…"), {
      target: { value: "John" },
    });
    const option = await screen.findByRole("button", { name: /John Smith/ });
    fireEvent.mouseDown(option);

    expect(screen.getByRole("button", { name: "Delegate" })).not.toBeDisabled();
  });

  it("Pause: posts {isPaused: true, expectedIsPaused: false} and refreshes", async () => {
    const fetchMock = vi.fn().mockResolvedValue(reviewResponse({ isPaused: true }));
    global.fetch = fetchMock as typeof fetch;

    render(
      <ReviewProcessActions
        reviewId={REVIEW_ID}
        status="submitted"
        isPaused={false}
        assignedToUserId={null}
        assignedToUser={null}
      />,
    );
    fireEvent.click(screen.getByRole("button", { name: "Pause" }));

    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(1));
    expect(fetchMock).toHaveBeenCalledWith(
      `https://api.example.com/reviews/${REVIEW_ID}/pause`,
      expect.objectContaining({
        method: "POST",
        credentials: "include",
        body: JSON.stringify({ isPaused: true, expectedIsPaused: false }),
      }),
    );
    await waitFor(() => expect(refreshMock).toHaveBeenCalledTimes(1));
    expect(screen.getByRole("button", { name: "Resume" })).toBeInTheDocument();
  });

  it("Delegate posts {assignedToUserId, expectedAssignedToUserId} using the real current assignee id, not the resolved display value", async () => {
    const searchResponse = {
      ok: true,
      json: async () => ({
        success: true,
        data: [{ id: NEW_ASSIGNEE_ID, displayName: "John Smith", email: "john@example.com" }],
        correlationId: "corr-1",
      }),
    } as Response;
    const fetchMock = vi.fn((url: string) => {
      if (url.includes("/users?")) return Promise.resolve(searchResponse);
      return Promise.resolve(reviewResponse({ assignedToUserId: NEW_ASSIGNEE_ID }));
    });
    global.fetch = fetchMock as unknown as typeof fetch;

    render(
      <ReviewProcessActions
        reviewId={REVIEW_ID}
        status="submitted"
        isPaused={false}
        assignedToUserId={CURRENT_ASSIGNEE_ID}
        assignedToUser={CURRENT_ASSIGNEE}
      />,
    );
    // Jane Doe is already selected (the current assignee) — UserPicker shows her as a "selected"
    // chip with a Remove button, not the search input, until cleared.
    fireEvent.click(screen.getByRole("button", { name: "Remove" }));
    fireEvent.change(screen.getByPlaceholderText("Search by name or email…"), {
      target: { value: "John" },
    });
    const option = await screen.findByRole("button", { name: /John Smith/ });
    fireEvent.mouseDown(option);
    fireEvent.click(screen.getByRole("button", { name: "Delegate" }));

    await waitFor(() =>
      expect(fetchMock).toHaveBeenCalledWith(
        `https://api.example.com/reviews/${REVIEW_ID}/delegate`,
        expect.objectContaining({
          body: JSON.stringify({
            assignedToUserId: NEW_ASSIGNEE_ID,
            expectedAssignedToUserId: CURRENT_ASSIGNEE_ID,
          }),
        }),
      ),
    );
    await waitFor(() => expect(refreshMock).toHaveBeenCalledTimes(1));
  });

  it("shows the backend's error message on a failed pause request, without refreshing", async () => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: false,
      json: async () => ({
        success: false,
        error: { code: "ConflictException", message: "Review pause state changed concurrently" },
        correlationId: "corr-1",
      }),
    } as Response) as typeof fetch;

    render(
      <ReviewProcessActions
        reviewId={REVIEW_ID}
        status="submitted"
        isPaused={false}
        assignedToUserId={null}
        assignedToUser={null}
      />,
    );
    fireEvent.click(screen.getByRole("button", { name: "Pause" }));

    expect(await screen.findByRole("alert")).toHaveTextContent("changed concurrently");
    expect(refreshMock).not.toHaveBeenCalled();
  });

  it("re-syncs isPaused/assignedToUser from fresh props without a remount", () => {
    const { rerender } = render(
      <ReviewProcessActions
        reviewId={REVIEW_ID}
        status="submitted"
        isPaused={false}
        assignedToUserId={null}
        assignedToUser={null}
      />,
    );
    expect(screen.getByRole("button", { name: "Pause" })).toBeInTheDocument();

    rerender(
      <ReviewProcessActions
        reviewId={REVIEW_ID}
        status="submitted"
        isPaused={true}
        assignedToUserId={CURRENT_ASSIGNEE_ID}
        assignedToUser={CURRENT_ASSIGNEE}
      />,
    );
    expect(screen.getByRole("button", { name: "Resume" })).toBeInTheDocument();
    expect(screen.getByText("Jane Doe")).toBeInTheDocument();
  });
});
