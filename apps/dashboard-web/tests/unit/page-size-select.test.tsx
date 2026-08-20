import { fireEvent, render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const pushMock = vi.fn();

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: pushMock }),
}));

import { PageSizeSelect } from "../../components/page-size-select.js";
import { PAGE_SIZE_OPTIONS } from "../../lib/pagination.js";

describe("PageSizeSelect", () => {
  beforeEach(() => {
    pushMock.mockReset();
  });

  it("renders every allowed page-size option", () => {
    render(<PageSizeSelect value={20} buildHref={(size) => `/projects?pageSize=${size}`} />);
    const select = screen.getByLabelText("Records per page");
    for (const size of PAGE_SIZE_OPTIONS) {
      expect(screen.getByRole("option", { name: String(size) })).toBeInTheDocument();
    }
    expect(select).toHaveValue("20");
  });

  it("navigates to buildHref(newSize) on change, not the current value", () => {
    render(<PageSizeSelect value={20} buildHref={(size) => `/projects?pageSize=${size}`} />);
    fireEvent.change(screen.getByLabelText("Records per page"), { target: { value: "50" } });
    expect(pushMock).toHaveBeenCalledWith("/projects?pageSize=50");
  });
});
