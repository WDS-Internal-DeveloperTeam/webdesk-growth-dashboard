import { fireEvent, render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const pushMock = vi.fn();

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: pushMock }),
}));

import { PageSizeSelect } from "../../components/page-size-select.js";
import { buildHrefBySize, PAGE_SIZE_OPTIONS } from "../../lib/pagination.js";

const hrefBySize = buildHrefBySize((size) => `/projects?pageSize=${size}`);

describe("PageSizeSelect", () => {
  beforeEach(() => {
    pushMock.mockReset();
  });

  it("renders every allowed page-size option", () => {
    render(<PageSizeSelect value={20} hrefBySize={hrefBySize} />);
    const select = screen.getByLabelText("Records per page");
    for (const size of PAGE_SIZE_OPTIONS) {
      expect(screen.getByRole("option", { name: String(size) })).toBeInTheDocument();
    }
    expect(select).toHaveValue("20");
  });

  it("navigates to hrefBySize[newSize] on change, not the current value", () => {
    render(<PageSizeSelect value={20} hrefBySize={hrefBySize} />);
    fireEvent.change(screen.getByLabelText("Records per page"), { target: { value: "50" } });
    expect(pushMock).toHaveBeenCalledWith("/projects?pageSize=50");
  });

  it("accepts hrefBySize as plain, JSON-serializable data — no function values anywhere in the prop, matching what a Server Component can actually pass across the RSC boundary", () => {
    // This is the regression this fix closes: PageSizeSelect previously took a `buildHref`
    // function prop, which React Server Components rejects when a Server Component page passes
    // it ("Functions cannot be passed directly to Client Components") -- a real production crash
    // on both /projects and /business-knowledge-center. Asserting the fixture round-trips through
    // JSON is a direct proxy for "this is safe to pass across that boundary."
    expect(() => JSON.parse(JSON.stringify(hrefBySize))).not.toThrow();
    for (const value of Object.values(hrefBySize)) {
      expect(typeof value).toBe("string");
    }
  });
});
