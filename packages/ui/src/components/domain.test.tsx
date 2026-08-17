import { fireEvent, render, screen, within } from "@testing-library/react";
import { useState } from "react";
import { describe, expect, it, vi } from "vitest";
import {
  ApprovalBlock,
  Code,
  DiffViewer,
  FileAttachment,
  RelationshipPicker,
  Stepper,
} from "./domain.js";

describe("Code", () => {
  it("renders its children in a mono-font code element", () => {
    render(<Code>proj_8f2a</Code>);
    expect(screen.getByText("proj_8f2a").tagName).toBe("CODE");
  });
});

describe("ApprovalBlock", () => {
  const baseProps = {
    submitter: "Jane Doe",
    submittedAt: "2026-08-17",
    requiredApprovers: ["Security Owner"],
    statusBadge: <span>In review</span>,
  };

  it("renders submitter, required approvers, and status", () => {
    render(<ApprovalBlock {...baseProps} />);
    expect(screen.getByText(/Jane Doe/)).toBeInTheDocument();
    expect(screen.getByText("Security Owner")).toBeInTheDocument();
    expect(screen.getByText("In review")).toBeInTheDocument();
  });

  it("requires a typed reason before Reject can be confirmed", () => {
    const onReject = vi.fn();
    render(<ApprovalBlock {...baseProps} onReject={onReject} />);
    fireEvent.click(screen.getByRole("button", { name: "Reject" }));
    const dialog = screen.getByRole("dialog", { name: "Reject this submission?" });
    const confirmButton = within(dialog).getByRole("button", { name: "Reject" });
    expect(confirmButton).toBeDisabled();
    fireEvent.change(within(dialog).getByLabelText(/Reason/), {
      target: { value: "Missing evidence" },
    });
    expect(confirmButton).toBeEnabled();
    fireEvent.click(confirmButton);
    expect(onReject).toHaveBeenCalledWith("Missing evidence");
  });

  it("calls onApprove directly with no confirmation step", () => {
    const onApprove = vi.fn();
    render(<ApprovalBlock {...baseProps} onApprove={onApprove} />);
    fireEvent.click(screen.getByRole("button", { name: "Approve" }));
    expect(onApprove).toHaveBeenCalledOnce();
  });

  it("collapses previous approvals behind a disclosure once any exist", () => {
    render(
      <ApprovalBlock
        {...baseProps}
        previousApprovals={[
          {
            id: "1",
            version: "v1",
            approver: "Jitesh D",
            date: "2026-08-01",
            decision: "Approved",
          },
        ]}
      />,
    );
    expect(screen.getByText(/v1 · Jitesh D/)).not.toBeVisible();
    fireEvent.click(screen.getByRole("button", { name: /Previous approvals/ }));
    expect(screen.getByText(/v1 · Jitesh D/)).toBeVisible();
  });
});

describe("DiffViewer", () => {
  it("shows only changed fields, with before/after values", () => {
    render(
      <DiffViewer
        fields={[
          { fieldLabel: "Name", before: "Old Name", after: "New Name" },
          { fieldLabel: "Status", before: "active", after: "active" },
        ]}
      />,
    );
    expect(screen.getByText("Old Name")).toBeInTheDocument();
    expect(screen.getByText("New Name")).toBeInTheDocument();
    expect(screen.queryByText("active")).not.toBeInTheDocument();
  });

  it("shows a no-changes message when nothing differs", () => {
    render(<DiffViewer fields={[{ fieldLabel: "Name", before: "Same", after: "Same" }]} />);
    expect(screen.getByText("No field changes.")).toBeInTheDocument();
  });
});

describe("FileAttachment", () => {
  it("renders a link when href is provided", () => {
    render(
      <FileAttachment fileName="brief.pdf" fileType="PDF" href="https://blob.example/brief.pdf" />,
    );
    expect(screen.getByRole("link", { name: "brief.pdf" })).toHaveAttribute(
      "href",
      "https://blob.example/brief.pdf",
    );
  });

  it("renders a restricted message instead of a link when href is null", () => {
    render(
      <FileAttachment
        fileName="confidential.pdf"
        fileType="PDF"
        href={null}
        restrictedMessage="Restricted for your role."
      />,
    );
    expect(screen.queryByRole("link")).not.toBeInTheDocument();
    expect(screen.getByText("Restricted for your role.")).toBeInTheDocument();
  });
});

describe("RelationshipPicker", () => {
  it("adds a selected option via onSelect and removes it via onRemove", () => {
    function Harness() {
      const [selected, setSelected] = useState<{ id: string; displayName: string }[]>([]);
      const [query, setQuery] = useState("");
      return (
        <RelationshipPicker
          label="Related service"
          query={query}
          onQueryChange={setQuery}
          options={[{ id: "svc-1", displayName: "SEO Audit" }]}
          selected={selected}
          onSelect={(option) => setSelected((current) => [...current, option])}
          onRemove={(id) => setSelected((current) => current.filter((item) => item.id !== id))}
        />
      );
    }
    render(<Harness />);
    fireEvent.click(screen.getByRole("button", { name: "SEO Audit" }));
    fireEvent.click(screen.getByRole("button", { name: "Remove SEO Audit" }));
    expect(screen.queryByRole("button", { name: "Remove SEO Audit" })).not.toBeInTheDocument();
  });
});

describe("Stepper", () => {
  it("marks stages before the current one as complete via a checkmark", () => {
    render(
      <Stepper
        label="Release stages"
        currentStageId="deploy"
        stages={[
          { id: "build", label: "Build" },
          { id: "test", label: "Test" },
          { id: "deploy", label: "Deploy" },
        ]}
      />,
    );
    expect(screen.getAllByText("✓")).toHaveLength(2);
    expect(screen.getByText("Deploy").previousElementSibling).toHaveAttribute(
      "aria-current",
      "step",
    );
  });
});
