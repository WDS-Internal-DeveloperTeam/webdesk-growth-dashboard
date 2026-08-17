import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { UserPicker } from "../../components/user-picker.js";

const USER = {
  id: "44444444-4444-4444-4444-444444444444",
  displayName: "Jane Doe",
  email: "jane@example.com",
};

function searchResponse(data: readonly unknown[]): Response {
  return {
    ok: true,
    json: async () => ({ success: true, data, correlationId: "corr-1" }),
  } as Response;
}

describe("UserPicker", () => {
  const originalFetch = global.fetch;

  beforeEach(() => {
    process.env.NEXT_PUBLIC_API_BASE_URL = "https://api.example.com";
  });

  afterEach(() => {
    global.fetch = originalFetch;
    vi.restoreAllMocks();
  });

  it("shows the search input when no value is selected", () => {
    render(<UserPicker id="owner" label="Owner" value={null} onChange={vi.fn()} />);
    expect(screen.getByPlaceholderText("Search by name or email…")).toBeInTheDocument();
  });

  it("debounces a query, calls GET /users?search=..., and lists matches", async () => {
    const fetchMock = vi.fn().mockResolvedValue(searchResponse([USER]));
    global.fetch = fetchMock as typeof fetch;

    render(<UserPicker id="owner" label="Owner" value={null} onChange={vi.fn()} />);
    fireEvent.change(screen.getByPlaceholderText("Search by name or email…"), {
      target: { value: "Jane" },
    });

    await waitFor(() =>
      expect(fetchMock).toHaveBeenCalledWith(
        "https://api.example.com/users?search=Jane",
        expect.objectContaining({ credentials: "include" }),
      ),
    );
    expect(await screen.findByText("Jane Doe")).toBeInTheDocument();
    expect(screen.getByText("jane@example.com")).toBeInTheDocument();
  });

  it("calls onChange with the selected user and clears the query", async () => {
    const fetchMock = vi.fn().mockResolvedValue(searchResponse([USER]));
    global.fetch = fetchMock as typeof fetch;
    const onChange = vi.fn();

    render(<UserPicker id="owner" label="Owner" value={null} onChange={onChange} />);
    fireEvent.change(screen.getByPlaceholderText("Search by name or email…"), {
      target: { value: "Jane" },
    });

    const option = await screen.findByRole("button", { name: /Jane Doe/ });
    fireEvent.mouseDown(option);

    expect(onChange).toHaveBeenCalledWith(USER);
  });

  it("shows the selected value as a summary with a Remove action", () => {
    render(<UserPicker id="owner" label="Owner" value={USER} onChange={vi.fn()} />);
    expect(screen.getByText("Jane Doe")).toBeInTheDocument();
    expect(screen.getByText("jane@example.com")).toBeInTheDocument();
    expect(screen.queryByPlaceholderText("Search by name or email…")).not.toBeInTheDocument();
  });

  it("Remove calls onChange(null) and shows the search input again", () => {
    const onChange = vi.fn();
    render(<UserPicker id="owner" label="Owner" value={USER} onChange={onChange} />);
    fireEvent.click(screen.getByRole("button", { name: "Remove" }));
    expect(onChange).toHaveBeenCalledWith(null);
  });

  it("shows a 'No matches' status when a search returns nothing", async () => {
    const fetchMock = vi.fn().mockResolvedValue(searchResponse([]));
    global.fetch = fetchMock as typeof fetch;

    render(<UserPicker id="owner" label="Owner" value={null} onChange={vi.fn()} />);
    fireEvent.change(screen.getByPlaceholderText("Search by name or email…"), {
      target: { value: "Nobody" },
    });

    expect(await screen.findByText("No matches.")).toBeInTheDocument();
  });

  it("shows the backend's error message when the search request fails", async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: false,
      json: async () => ({
        success: false,
        error: {
          code: "BadRequestException",
          message: "search: String must contain at least 1 character(s)",
        },
        correlationId: "corr-1",
      }),
    } as Response);
    global.fetch = fetchMock as typeof fetch;

    render(<UserPicker id="owner" label="Owner" value={null} onChange={vi.fn()} />);
    fireEvent.change(screen.getByPlaceholderText("Search by name or email…"), {
      target: { value: "x" },
    });

    expect(await screen.findByRole("alert")).toHaveTextContent(
      "search: String must contain at least 1 character(s)",
    );
  });
});
