import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import type { ReleaseApproval } from "@webdesk/shared-types";

import { ReleaseApprovalsSection } from "../../components/release-approvals-section.js";

const RELEASE_ID = "11111111-1111-1111-1111-111111111111";
const PROJECT_ID = "22222222-2222-2222-2222-222222222222";
const APPROVAL_ID = "33333333-3333-3333-3333-333333333333";
const USER_ID = "44444444-4444-4444-4444-444444444444";

function approvalFixture(overrides: Partial<ReleaseApproval> = {}): ReleaseApproval {
  return {
    id: APPROVAL_ID,
    releaseId: RELEASE_ID,
    projectId: PROJECT_ID,
    approvalStage: "staging",
    decision: "approved",
    decidedByUserId: USER_ID,
    decidedAt: "2026-09-02T00:00:00.000Z",
    notes: null,
    createdAt: "2026-09-02T00:00:00.000Z",
    updatedAt: "2026-09-02T00:00:00.000Z",
    ...overrides,
  };
}

describe("ReleaseApprovalsSection", () => {
  it("shows an empty state with no approvals", () => {
    render(<ReleaseApprovalsSection approvals={[]} decidedByNameById={new Map()} />);
    expect(screen.getByText("No approval decisions recorded yet.")).toBeInTheDocument();
  });

  it("resolves a decider name from the map, falling back to the raw id", () => {
    render(
      <ReleaseApprovalsSection
        approvals={[approvalFixture()]}
        decidedByNameById={new Map([[USER_ID, "Jitesh D"]])}
      />,
    );
    expect(screen.getByText(/Jitesh D/)).toBeInTheDocument();
  });

  it("falls back to the raw id when the decider isn't in the map", () => {
    render(
      <ReleaseApprovalsSection approvals={[approvalFixture()]} decidedByNameById={new Map()} />,
    );
    expect(screen.getByText(new RegExp(USER_ID))).toBeInTheDocument();
  });

  it("renders notes as plain text, never as HTML", () => {
    render(
      <ReleaseApprovalsSection
        approvals={[approvalFixture({ notes: "<strong>should not be bold</strong>" })]}
        decidedByNameById={new Map()}
      />,
    );
    expect(screen.getByText("<strong>should not be bold</strong>")).toBeInTheDocument();
    expect(screen.queryByRole("strong")).not.toBeInTheDocument();
  });

  it("distinguishes rejected and hotfix_required decisions from approved", () => {
    render(
      <ReleaseApprovalsSection
        approvals={[
          approvalFixture({ id: "a1", decision: "rejected" }),
          approvalFixture({ id: "a2", decision: "hotfix_required", approvalStage: "production" }),
        ]}
        decidedByNameById={new Map()}
      />,
    );
    expect(screen.getByText("Rejected")).toBeInTheDocument();
    expect(screen.getByText("Hotfix Required")).toBeInTheDocument();
  });
});
