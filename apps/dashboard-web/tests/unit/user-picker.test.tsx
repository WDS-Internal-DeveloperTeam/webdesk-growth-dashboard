import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { useState, type ReactNode } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { UserSummary } from "@webdesk/shared-types";
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

/** A controlled wrapper mirroring how a real consumer (e.g. ProjectForm) feeds `onChange` back
 *  into `value` — needed to test flows that cross a select/remove boundary. */
function ControlledUserPicker(): ReactNode {
  const [value, setValue] = useState<UserSummary | null>(null);
  return <UserPicker id="owner" label="Owner" value={value} onChange={setValue} />;
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

  it("does not let a stale, out-of-order response overwrite fresher results", async () => {
    const janeResult = searchResponse([USER]);
    const johnResult = searchResponse([
      {
        id: "55555555-5555-5555-5555-555555555555",
        displayName: "John Doe",
        email: "john@example.com",
      },
    ]);
    // "Jane"'s request is slower and resolves AFTER "John"'s, even though it was fired first —
    // simulating the out-of-order network response this fix guards against.
    let resolveJane!: (value: Response) => void;
    const janePromise = new Promise<Response>((resolve) => {
      resolveJane = resolve;
    });
    const fetchMock = vi.fn((url: string) => {
      if (url.includes("search=Jane")) return janePromise;
      return Promise.resolve(johnResult);
    });
    global.fetch = fetchMock as unknown as typeof fetch;

    render(<UserPicker id="owner" label="Owner" value={null} onChange={vi.fn()} />);
    const input = screen.getByPlaceholderText("Search by name or email…");
    fireEvent.change(input, { target: { value: "Jane" } });
    await waitFor(() =>
      expect(fetchMock).toHaveBeenCalledWith(
        expect.stringContaining("search=Jane"),
        expect.anything(),
      ),
    );
    fireEvent.change(input, { target: { value: "John" } });
    expect(await screen.findByText("John Doe")).toBeInTheDocument();

    // Now let the stale "Jane" response finally resolve — it must NOT clobber "John"'s results.
    resolveJane(janeResult);
    await new Promise((resolve) => setTimeout(resolve, 0));
    expect(screen.getByText("John Doe")).toBeInTheDocument();
    expect(screen.queryByText("Jane Doe")).not.toBeInTheDocument();
  });

  it("clears a stale error when the query is emptied", async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: false,
      json: async () => ({
        success: false,
        error: { code: "BadRequestException", message: "search failed" },
        correlationId: "corr-1",
      }),
    } as Response);
    global.fetch = fetchMock as typeof fetch;

    render(<UserPicker id="owner" label="Owner" value={null} onChange={vi.fn()} />);
    const input = screen.getByPlaceholderText("Search by name or email…");
    fireEvent.change(input, { target: { value: "x" } });
    expect(await screen.findByRole("alert")).toHaveTextContent("search failed");

    fireEvent.change(input, { target: { value: "" } });
    fireEvent.focus(input);
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
  });

  it("clears a stale error across a select-then-remove cycle", async () => {
    const fetchMock = vi.fn((url: string) => {
      if (url.includes("search=fail")) {
        return Promise.resolve({
          ok: false,
          json: async () => ({
            success: false,
            error: { code: "BadRequestException", message: "search failed" },
            correlationId: "corr-1",
          }),
        } as Response);
      }
      return Promise.resolve(searchResponse([USER]));
    });
    global.fetch = fetchMock as unknown as typeof fetch;

    render(<ControlledUserPicker />);
    const input = screen.getByPlaceholderText("Search by name or email…");
    fireEvent.change(input, { target: { value: "fail" } });
    expect(await screen.findByRole("alert")).toHaveTextContent("search failed");

    // A later, successful search and selection replaces the search UI with the selected chip.
    fireEvent.change(input, { target: { value: "Jane" } });
    const option = await screen.findByRole("button", { name: /Jane Doe/ });
    fireEvent.mouseDown(option);
    expect(screen.getByText("Jane Doe")).toBeInTheDocument();

    // Removing it goes back to the search input — the stale error from the earlier failed search
    // must not resurface just because the input regains focus.
    fireEvent.click(screen.getByRole("button", { name: "Remove" }));
    fireEvent.focus(screen.getByPlaceholderText("Search by name or email…"));
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
  });
});
