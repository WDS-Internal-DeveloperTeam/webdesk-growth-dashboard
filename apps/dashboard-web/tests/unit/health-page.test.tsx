import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import HealthPage from "../../app/health/page.js";

describe("HealthPage", () => {
  it("renders ok status for dashboard-web", () => {
    render(<HealthPage />);
    expect(screen.getByText("Status")).toBeInTheDocument();
    expect(screen.getByText("ok")).toBeInTheDocument();
    expect(screen.getByText("dashboard-web")).toBeInTheDocument();
  });
});
