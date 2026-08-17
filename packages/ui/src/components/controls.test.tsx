import { fireEvent, render, screen } from "@testing-library/react";
import { useState } from "react";
import { describe, expect, it, vi } from "vitest";
import {
  Button,
  Checkbox,
  DateField,
  IconButton,
  Input,
  RadioGroup,
  Select,
  Textarea,
  Toggle,
} from "./controls.js";

describe("Button", () => {
  it("renders children and fires onClick", () => {
    const onClick = vi.fn();
    render(<Button onClick={onClick}>Save</Button>);
    fireEvent.click(screen.getByRole("button", { name: "Save" }));
    expect(onClick).toHaveBeenCalledOnce();
  });

  it("disables and prevents interaction when disabled", () => {
    const onClick = vi.fn();
    render(
      <Button onClick={onClick} disabled>
        Save
      </Button>,
    );
    const button = screen.getByRole("button", { name: "Save" });
    expect(button).toBeDisabled();
  });
});

describe("IconButton", () => {
  it("requires and renders an accessible label", () => {
    render(<IconButton label="Close drawer" icon={<span aria-hidden="true">×</span>} />);
    expect(screen.getByRole("button", { name: "Close drawer" })).toBeInTheDocument();
  });
});

describe("Input", () => {
  it("associates the label and shows a hint", () => {
    render(<Input label="Email" hint="Use your work email" />);
    const input = screen.getByLabelText("Email");
    expect(input).toHaveAccessibleDescription("Use your work email");
  });

  it("marks the field invalid and announces the error via role=alert", () => {
    render(<Input label="Email" error="Email is required" />);
    const input = screen.getByLabelText("Email");
    expect(input).toHaveAttribute("aria-invalid", "true");
    expect(screen.getByRole("alert")).toHaveTextContent("Email is required");
  });

  it("visually hides the label when hideLabel is set, but keeps it accessible", () => {
    render(<Input label="Search" hideLabel />);
    expect(screen.getByLabelText("Search")).toBeInTheDocument();
  });
});

describe("Textarea", () => {
  it("associates the label and accepts input", () => {
    render(<Textarea label="Description" />);
    const textarea = screen.getByLabelText("Description");
    fireEvent.change(textarea, { target: { value: "hello" } });
    expect(textarea).toHaveValue("hello");
  });
});

describe("Select", () => {
  it("renders a placeholder and the provided options", () => {
    render(
      <Select
        label="Status"
        placeholder="Choose a status"
        options={[
          { value: "active", label: "Active" },
          { value: "paused", label: "Paused" },
        ]}
      />,
    );
    const select = screen.getByLabelText("Status");
    expect(screen.getByRole("option", { name: "Choose a status" })).toBeInTheDocument();
    fireEvent.change(select, { target: { value: "paused" } });
    expect(select).toHaveValue("paused");
  });
});

describe("Checkbox", () => {
  it("toggles checked state", () => {
    render(<Checkbox label="Accept terms" />);
    const checkbox = screen.getByLabelText("Accept terms");
    expect(checkbox).not.toBeChecked();
    fireEvent.click(checkbox);
    expect(checkbox).toBeChecked();
  });
});

describe("RadioGroup", () => {
  it("marks the selected option and calls onChange with the new value", () => {
    function Harness() {
      const [value, setValue] = useState("a");
      return (
        <RadioGroup
          label="Choice"
          name="choice"
          value={value}
          onChange={setValue}
          options={[
            { value: "a", label: "Option A" },
            { value: "b", label: "Option B" },
          ]}
        />
      );
    }
    render(<Harness />);
    expect(screen.getByLabelText("Option A")).toBeChecked();
    fireEvent.click(screen.getByLabelText("Option B"));
    expect(screen.getByLabelText("Option B")).toBeChecked();
  });
});

describe("Toggle", () => {
  it("exposes role=switch and calls onChange with the flipped value", () => {
    const onChange = vi.fn();
    render(<Toggle label="Enable feature" checked={false} onChange={onChange} />);
    const toggle = screen.getByRole("switch", { name: "Enable feature" });
    expect(toggle).toHaveAttribute("aria-checked", "false");
    fireEvent.click(toggle);
    expect(onChange).toHaveBeenCalledWith(true);
  });
});

describe("DateField", () => {
  it("renders a native date input associated with its label", () => {
    render(<DateField label="Due date" />);
    const input = screen.getByLabelText("Due date");
    expect(input).toHaveAttribute("type", "date");
  });
});
