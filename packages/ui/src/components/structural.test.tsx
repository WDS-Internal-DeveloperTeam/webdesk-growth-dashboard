import { fireEvent, render, screen, within } from "@testing-library/react";
import { useState } from "react";
import { describe, expect, it, vi } from "vitest";
import { Accordion, Avatar, Badge, Card, Pagination, Table, Tabs } from "./structural.js";

describe("Badge", () => {
  it("encodes status via label text, not color alone", () => {
    render(<Badge bucket="blocked" label="Blocked" />);
    expect(screen.getByText("Blocked")).toBeInTheDocument();
  });
});

describe("Avatar", () => {
  it("renders initials from the name and exposes it as an accessible label", () => {
    render(<Avatar name="Jane Doe" />);
    expect(screen.getByRole("img", { name: "Jane Doe" })).toHaveTextContent("JD");
  });

  it("falls back to a single initial for a one-word name", () => {
    render(<Avatar name="Cher" />);
    expect(screen.getByRole("img", { name: "Cher" })).toHaveTextContent("C");
  });
});

describe("Card", () => {
  it("renders its children", () => {
    render(
      <Card>
        <p>Card content</p>
      </Card>,
    );
    expect(screen.getByText("Card content")).toBeInTheDocument();
  });
});

interface Row {
  readonly id: string;
  readonly name: string;
}

describe("Table", () => {
  const rows: Row[] = [
    { id: "1", name: "Alpha" },
    { id: "2", name: "Beta" },
  ];

  it("renders a caption, column headers, and row data", () => {
    render(
      <Table<Row>
        caption="Projects"
        columns={[{ key: "name", header: "Name", render: (row) => row.name }]}
        rows={rows}
        getRowKey={(row) => row.id}
      />,
    );
    expect(screen.getByRole("columnheader", { name: "Name" })).toBeInTheDocument();
    expect(screen.getByText("Alpha")).toBeInTheDocument();
    expect(screen.getByText("Beta")).toBeInTheDocument();
  });

  it("shows the empty message when there are no rows", () => {
    render(
      <Table<Row>
        caption="Projects"
        columns={[{ key: "name", header: "Name", render: (row) => row.name }]}
        rows={[]}
        getRowKey={(row) => row.id}
        emptyMessage="Nothing here"
      />,
    );
    expect(screen.getByText("Nothing here")).toBeInTheDocument();
  });

  it("renders sortable headers as real buttons and calls onSortChange", () => {
    const onSortChange = vi.fn();
    render(
      <Table<Row>
        caption="Projects"
        columns={[{ key: "name", header: "Name", sortable: true, render: (row) => row.name }]}
        rows={rows}
        getRowKey={(row) => row.id}
        sortKey="name"
        sortDirection="asc"
        onSortChange={onSortChange}
      />,
    );
    const header = screen.getByRole("columnheader", { name: /Name/ });
    expect(header).toHaveAttribute("aria-sort", "ascending");
    fireEvent.click(within(header).getByRole("button"));
    expect(onSortChange).toHaveBeenCalledWith("name");
  });
});

describe("Tabs", () => {
  function Harness() {
    const [activeId, setActiveId] = useState("a");
    return (
      <Tabs
        label="Record sections"
        activeId={activeId}
        onChange={setActiveId}
        items={[
          { id: "a", label: "Overview", panel: <p>Overview panel</p> },
          { id: "b", label: "Team", panel: <p>Team panel</p> },
        ]}
      />
    );
  }

  it("shows only the active panel and marks the active tab selected", () => {
    render(<Harness />);
    expect(screen.getByText("Overview panel")).toBeVisible();
    expect(screen.getByText("Team panel")).not.toBeVisible();
    expect(screen.getByRole("tab", { name: "Overview" })).toHaveAttribute("aria-selected", "true");
  });

  it("switches tabs on click", () => {
    render(<Harness />);
    fireEvent.click(screen.getByRole("tab", { name: "Team" }));
    expect(screen.getByText("Team panel")).toBeVisible();
    expect(screen.getByRole("tab", { name: "Team" })).toHaveAttribute("aria-selected", "true");
  });

  it("moves focus and selection with ArrowRight/ArrowLeft", () => {
    render(<Harness />);
    const first = screen.getByRole("tab", { name: "Overview" });
    first.focus();
    fireEvent.keyDown(first, { key: "ArrowRight" });
    expect(screen.getByRole("tab", { name: "Team" })).toHaveAttribute("aria-selected", "true");
    expect(screen.getByRole("tab", { name: "Team" })).toHaveFocus();
  });
});

describe("Accordion", () => {
  it("toggles a panel's visibility via aria-expanded", () => {
    function Harness() {
      const [expanded, setExpanded] = useState<Set<string>>(new Set());
      return (
        <Accordion
          expandedIds={expanded}
          onToggle={(id) =>
            setExpanded((prev) => {
              const next = new Set(prev);
              if (next.has(id)) {
                next.delete(id);
              } else {
                next.add(id);
              }
              return next;
            })
          }
          items={[{ id: "x", title: "Section X", content: <p>Section X body</p> }]}
        />
      );
    }
    render(<Harness />);
    const trigger = screen.getByRole("button", { name: "Section X" });
    expect(trigger).toHaveAttribute("aria-expanded", "false");
    fireEvent.click(trigger);
    expect(trigger).toHaveAttribute("aria-expanded", "true");
    expect(screen.getByText("Section X body")).toBeVisible();
  });
});

describe("Pagination", () => {
  it("disables Previous on the first page and calls onPageChange for Next", () => {
    const onPageChange = vi.fn();
    render(<Pagination page={1} hasNextPage onPageChange={onPageChange} />);
    expect(screen.getByRole("button", { name: "Previous" })).toBeDisabled();
    fireEvent.click(screen.getByRole("button", { name: "Next" }));
    expect(onPageChange).toHaveBeenCalledWith(2);
  });

  it("disables Next when there is no next page", () => {
    render(<Pagination page={2} hasNextPage={false} onPageChange={vi.fn()} />);
    expect(screen.getByRole("button", { name: "Next" })).toBeDisabled();
  });
});
