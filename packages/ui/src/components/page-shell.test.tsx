import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import {
  Breadcrumbs,
  ContentContainer,
  FiltersBar,
  PageHeader,
  StatusBadge,
} from "./page-shell.js";

describe("shared page-shell components", () => {
  it("Breadcrumbs renders a nav landmark with the current page marked aria-current", () => {
    render(
      <Breadcrumbs
        items={[
          { label: "Home", href: "/home" },
          { label: "Projects", href: "/projects" },
          { label: "Acme Co." },
        ]}
      />,
    );
    expect(screen.getByRole("navigation", { name: "Breadcrumb" })).toBeInTheDocument();
    expect(screen.getByText("Acme Co.")).toHaveAttribute("aria-current", "page");
    expect(screen.getByRole("link", { name: "Home" })).toHaveAttribute("href", "/home");
  });

  it("Breadcrumbs uses an injected link component (e.g. next/link) instead of a plain anchor", () => {
    function FakeLink({ href, children }: { href: string; children: React.ReactNode }) {
      return (
        <a href={href} data-fake-link="true">
          {children}
        </a>
      );
    }
    render(
      <Breadcrumbs
        items={[{ label: "Home", href: "/home" }, { label: "Current" }]}
        linkComponent={FakeLink}
      />,
    );
    expect(screen.getByRole("link", { name: "Home" })).toHaveAttribute("data-fake-link", "true");
  });

  it("PageHeader renders the title, optional status badge, and contextual actions", () => {
    render(
      <PageHeader
        title="Scan Center"
        statusBadge={<StatusBadge status="healthy" label="All systems normal" />}
        contextActions={<button>Run scan</button>}
      />,
    );
    expect(screen.getByRole("heading", { level: 1, name: "Scan Center" })).toBeInTheDocument();
    expect(screen.getByText("All systems normal")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Run scan" })).toBeInTheDocument();
  });

  it("ContentContainer renders its children", () => {
    render(
      <ContentContainer>
        <p>Body content</p>
      </ContentContainer>,
    );
    expect(screen.getByText("Body content")).toBeInTheDocument();
  });

  it("FiltersBar renders nothing when no children are given, an empty shell only", () => {
    const { container } = render(<FiltersBar />);
    expect(container).toBeEmptyDOMElement();
  });

  it("FiltersBar renders provided filter controls", () => {
    render(
      <FiltersBar>
        <label>
          Status
          <select>
            <option>All</option>
          </select>
        </label>
      </FiltersBar>,
    );
    expect(screen.getByText("Status")).toBeInTheDocument();
  });
});
