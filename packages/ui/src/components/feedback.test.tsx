import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import {
  Alert,
  Progress,
  Timeline,
  ToastProvider,
  useToast,
  VersionIndicator,
} from "./feedback.js";

describe("Alert", () => {
  it("renders as role=alert for danger/warning and role=status otherwise", () => {
    const { rerender } = render(<Alert variant="danger" title="Blocked" />);
    expect(screen.getByRole("alert")).toHaveTextContent("Blocked");
    rerender(<Alert variant="info" title="Heads up" />);
    expect(screen.getByRole("status")).toHaveTextContent("Heads up");
  });
});

describe("Progress", () => {
  it("exposes a determinate progressbar with the correct aria values", () => {
    render(<Progress label="Scan progress" value={40} max={100} />);
    const bar = screen.getByRole("progressbar", { name: "Scan progress" });
    expect(bar).toHaveAttribute("aria-valuenow", "40");
    expect(bar).toHaveAttribute("aria-valuemax", "100");
  });

  it("omits aria-valuenow for indeterminate progress", () => {
    render(<Progress label="Working" />);
    expect(screen.getByRole("progressbar", { name: "Working" })).not.toHaveAttribute(
      "aria-valuenow",
    );
  });
});

describe("Timeline", () => {
  it("renders each entry's label, timestamp, and actor", () => {
    render(
      <Timeline
        entries={[
          { id: "1", label: "Submitted for review", timestamp: "2026-08-17", actor: "Jane Doe" },
        ]}
      />,
    );
    expect(screen.getByText("Submitted for review")).toBeInTheDocument();
    expect(screen.getByText(/2026-08-17.*Jane Doe/)).toBeInTheDocument();
  });
});

describe("VersionIndicator", () => {
  it("labels the current state distinctly from draft/previous", () => {
    render(<VersionIndicator state="current" label="v3" />);
    expect(screen.getByText("Current")).toBeInTheDocument();
    expect(screen.getByText("v3")).toBeInTheDocument();
  });
});

describe("ToastProvider / useToast", () => {
  function Trigger() {
    const { showToast } = useToast();
    return (
      <button type="button" onClick={() => showToast("Draft saved")}>
        Save
      </button>
    );
  }

  it("shows a toast message when triggered, announced via aria-live", () => {
    render(
      <ToastProvider>
        <Trigger />
      </ToastProvider>,
    );
    fireEvent.click(screen.getByRole("button", { name: "Save" }));
    expect(screen.getByText("Draft saved")).toBeInTheDocument();
  });

  it("throws when useToast is called outside a ToastProvider", () => {
    function Unwrapped() {
      useToast();
      return null;
    }
    expect(() => render(<Unwrapped />)).toThrow(/ToastProvider/);
  });
});
