import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { CommandMenu, Drawer, Dropdown, Modal, Tooltip } from "./overlay.js";

describe("Drawer", () => {
  it("renders nothing when closed", () => {
    render(
      <Drawer isOpen={false} onClose={vi.fn()} title="Notifications">
        <p>Body</p>
      </Drawer>,
    );
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });

  it("renders as a labeled dialog when open, and closes on Escape", () => {
    const onClose = vi.fn();
    render(
      <Drawer isOpen onClose={onClose} title="Notifications">
        <p>Body</p>
      </Drawer>,
    );
    const dialog = screen.getByRole("dialog", { name: "Notifications" });
    expect(dialog).toBeInTheDocument();
    fireEvent.keyDown(document, { key: "Escape" });
    expect(onClose).toHaveBeenCalledOnce();
  });

  it("closes when the close button is clicked", () => {
    const onClose = vi.fn();
    render(
      <Drawer isOpen onClose={onClose} title="Notifications">
        <p>Body</p>
      </Drawer>,
    );
    fireEvent.click(screen.getByRole("button", { name: "Close" }));
    expect(onClose).toHaveBeenCalledOnce();
  });
});

describe("Modal", () => {
  it("renders as a labeled dialog with optional footer", () => {
    render(
      <Modal
        isOpen
        onClose={vi.fn()}
        title="Confirm archive"
        footer={<button type="button">Archive</button>}
      >
        <p>Are you sure?</p>
      </Modal>,
    );
    expect(screen.getByRole("dialog", { name: "Confirm archive" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Archive" })).toBeInTheDocument();
  });

  it("closes on backdrop click but not on content click", () => {
    const onClose = vi.fn();
    render(
      <Modal isOpen onClose={onClose} title="Confirm">
        <p>Content</p>
      </Modal>,
    );
    fireEvent.click(screen.getByText("Content"));
    expect(onClose).not.toHaveBeenCalled();
  });
});

describe("Tooltip", () => {
  it("shows the label on focus and hides it on blur", () => {
    render(
      <Tooltip label="Collapse sidebar">
        <button type="button">Icon</button>
      </Tooltip>,
    );
    expect(screen.queryByRole("tooltip")).not.toBeInTheDocument();
    fireEvent.focus(screen.getByRole("button", { name: "Icon" }));
    expect(screen.getByRole("tooltip")).toHaveTextContent("Collapse sidebar");
    fireEvent.blur(screen.getByRole("button", { name: "Icon" }));
    expect(screen.queryByRole("tooltip")).not.toBeInTheDocument();
  });
});

describe("Dropdown", () => {
  it("opens the menu on trigger click and calls onSelect", () => {
    const onSelect = vi.fn();
    render(
      <Dropdown
        triggerLabel="Account menu"
        trigger={<span>Jane Doe</span>}
        items={[{ id: "signout", label: "Sign out", onSelect }]}
      />,
    );
    fireEvent.click(screen.getByRole("button", { name: "Account menu" }));
    expect(screen.getByRole("menu", { name: "Account menu" })).toBeInTheDocument();
    fireEvent.click(screen.getByRole("menuitem", { name: "Sign out" }));
    expect(onSelect).toHaveBeenCalledOnce();
  });

  it("renders optional non-interactive header content above the items", () => {
    render(
      <Dropdown
        triggerLabel="Account menu"
        trigger={<span>Jane Doe</span>}
        header={<span>jane@example.com</span>}
        items={[{ id: "signout", label: "Sign out", onSelect: vi.fn() }]}
      />,
    );
    fireEvent.click(screen.getByRole("button", { name: "Account menu" }));
    expect(screen.getByText("jane@example.com")).toBeInTheDocument();
  });
});

describe("CommandMenu", () => {
  it("filters items as the query changes", () => {
    render(
      <CommandMenu
        isOpen
        onClose={vi.fn()}
        items={[
          { id: "projects", label: "Projects", onSelect: vi.fn() },
          { id: "settings", label: "Settings", onSelect: vi.fn() },
        ]}
      />,
    );
    const input = screen.getByRole("combobox");
    fireEvent.change(input, { target: { value: "proj" } });
    expect(screen.getByRole("option", { name: /Projects/ })).toBeInTheDocument();
    expect(screen.queryByRole("option", { name: /Settings/ })).not.toBeInTheDocument();
  });

  it("selects the active item on Enter and closes", () => {
    const onSelect = vi.fn();
    const onClose = vi.fn();
    render(
      <CommandMenu
        isOpen
        onClose={onClose}
        items={[{ id: "projects", label: "Projects", onSelect }]}
      />,
    );
    const input = screen.getByRole("combobox");
    fireEvent.keyDown(input, { key: "Enter" });
    expect(onSelect).toHaveBeenCalledOnce();
    expect(onClose).toHaveBeenCalledOnce();
  });

  it("shows the empty message when nothing matches", () => {
    render(
      <CommandMenu
        isOpen
        onClose={vi.fn()}
        items={[{ id: "a", label: "Alpha", onSelect: vi.fn() }]}
        emptyMessage="Nothing found"
      />,
    );
    fireEvent.change(screen.getByRole("combobox"), { target: { value: "zzz" } });
    expect(screen.getByText("Nothing found")).toBeInTheDocument();
  });
});
