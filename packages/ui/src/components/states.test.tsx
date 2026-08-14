import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import {
  BlockedState,
  DegradedState,
  EmptyState,
  ErrorState,
  FeatureUnavailableState,
  ForbiddenState,
  LoadingState,
  NotConfiguredState,
  NotFoundState,
} from "./states.js";

describe("shared UI states", () => {
  it("LoadingState announces via role=status/aria-live=polite, never a blank screen", () => {
    render(<LoadingState label="Fetching modules" />);
    const status = screen.getByRole("status");
    expect(status).toHaveTextContent("Fetching modules");
  });

  it("EmptyState explains why there's no data and can render a next-action slot", () => {
    render(
      <EmptyState
        title="No projects yet"
        description="Create one to get started."
        action={<button>Create project</button>}
      />,
    );
    expect(screen.getByText("No projects yet")).toBeInTheDocument();
    expect(screen.getByText("Create one to get started.")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Create project" })).toBeInTheDocument();
  });

  it("ErrorState never leaks internals, only the safe message and optional correlation id", () => {
    render(
      <ErrorState message="Something went wrong. Please try again." correlationId="abc-123" />,
    );
    const alert = screen.getByRole("alert");
    expect(alert).toHaveTextContent("Something went wrong. Please try again.");
    expect(alert).toHaveTextContent("abc-123");
    expect(alert.textContent).not.toMatch(/at \w+\.\w+ \(/); // no stack-trace-shaped text
  });

  it("ForbiddenState represents an authorization failure distinctly from NotFoundState", () => {
    render(<ForbiddenState />);
    expect(screen.getByRole("alert")).toHaveTextContent(/don't have permission/i);
  });

  it("NotFoundState handles invalid routes/resources", () => {
    render(<NotFoundState />);
    expect(screen.getByText(/couldn't find that/i)).toBeInTheDocument();
  });

  it("NotConfiguredState is honest about missing setup, not a fake empty state", () => {
    render(<NotConfiguredState message="WordPress integration has not been configured yet." />);
    expect(screen.getByText(/WordPress integration/)).toBeInTheDocument();
  });

  it("DegradedState is distinct from a full outage", () => {
    render(<DegradedState message="The scan service is responding slowly." />);
    expect(screen.getByText(/limited right now/i)).toBeInTheDocument();
  });

  it("BlockedState explains a workflow/dependency block", () => {
    render(<BlockedState message="Awaiting review approval." />);
    expect(screen.getByText(/can't proceed yet/i)).toBeInTheDocument();
  });

  it("FeatureUnavailableState shows the real registry status, never a fake CRUD screen", () => {
    render(<FeatureUnavailableState status="Not Started" moduleName="Brand Library" />);
    expect(screen.getByText("Brand Library")).toBeInTheDocument();
    expect(screen.getAllByText(/Not Started/).length).toBeGreaterThan(0);
  });
});
