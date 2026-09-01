import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import type { CaseStudyApproval } from "@webdesk/shared-types";

import { CaseStudyApprovalsSection } from "../../components/case-study-approvals-section.js";

function approvalFixture(
  id: string,
  overrides: Partial<CaseStudyApproval> = {},
): CaseStudyApproval {
  return {
    id,
    caseStudyId: "cs-1",
    approvalType: "internal",
    decision: "approved",
    decidedByUserId: null,
    decidedAt: "2026-08-27T00:00:00.000Z",
    notes: null,
    createdAt: "2026-08-27T00:00:00.000Z",
    updatedAt: "2026-08-27T00:00:00.000Z",
    ...overrides,
  };
}

describe("CaseStudyApprovalsSection", () => {
  it("renders 'No approval decisions recorded yet.' when empty", () => {
    render(<CaseStudyApprovalsSection approvals={[]} decidedByNameById={new Map()} />);
    expect(screen.getByText("No approval decisions recorded yet.")).toBeInTheDocument();
  });

  it("renders the approval type, decision, and resolved decider name", () => {
    render(
      <CaseStudyApprovalsSection
        approvals={[approvalFixture("a1", { approvalType: "client", decidedByUserId: "user-1" })]}
        decidedByNameById={new Map([["user-1", "Jane Doe"]])}
      />,
    );
    expect(screen.getByText("Client")).toBeInTheDocument();
    expect(screen.getByText("Approved")).toBeInTheDocument();
    expect(screen.getByText(/Jane Doe/)).toBeInTheDocument();
  });

  it("falls back to the raw id when the decider's name can't be resolved", () => {
    render(
      <CaseStudyApprovalsSection
        approvals={[approvalFixture("a1", { decidedByUserId: "unresolved-user" })]}
        decidedByNameById={new Map()}
      />,
    );
    expect(screen.getByText(/unresolved-user/)).toBeInTheDocument();
  });

  it("shows 'Unknown' when decidedByUserId is null", () => {
    render(
      <CaseStudyApprovalsSection
        approvals={[approvalFixture("a1", { decidedByUserId: null })]}
        decidedByNameById={new Map()}
      />,
    );
    expect(screen.getByText(/Unknown/)).toBeInTheDocument();
  });

  it("renders sanitized notes as HTML, falling back to 'No notes.' when absent", () => {
    render(
      <CaseStudyApprovalsSection
        approvals={[
          approvalFixture("a1", { notes: "<p>Looks great</p>" }),
          approvalFixture("a2", { notes: null }),
        ]}
        decidedByNameById={new Map()}
      />,
    );
    expect(screen.getByText("Looks great")).toBeInTheDocument();
    expect(screen.getByText("No notes.")).toBeInTheDocument();
  });

  it("renders revision_requested and rejected decision labels correctly", () => {
    render(
      <CaseStudyApprovalsSection
        approvals={[
          approvalFixture("a1", { decision: "revision_requested" }),
          approvalFixture("a2", { decision: "rejected" }),
        ]}
        decidedByNameById={new Map()}
      />,
    );
    expect(screen.getByText("Revision Requested")).toBeInTheDocument();
    expect(screen.getByText("Rejected")).toBeInTheDocument();
  });
});
