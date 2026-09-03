import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import type { RollbackRecord } from "@webdesk/shared-types";

import { ReleaseRollbackRecord } from "../../components/release-rollback-record.js";

const PROJECT_ID = "11111111-1111-1111-1111-111111111111";
const RELEASE_ID = "22222222-2222-2222-2222-222222222222";
const RECORD_ID = "33333333-3333-3333-3333-333333333333";

function recordFixture(overrides: Partial<RollbackRecord> = {}): RollbackRecord {
  return {
    id: RECORD_ID,
    releaseId: RELEASE_ID,
    projectId: PROJECT_ID,
    rolledBackSha: "abc1234",
    reason: "The deploy broke the checkout flow",
    replacementReleaseId: null,
    rolledBackByUserId: "44444444-4444-4444-4444-444444444444",
    rolledBackAt: "2026-09-02T00:00:00.000Z",
    createdAt: "2026-09-02T00:00:00.000Z",
    updatedAt: "2026-09-02T00:00:00.000Z",
    ...overrides,
  };
}

describe("ReleaseRollbackRecord", () => {
  it("renders the rolled-back SHA, actor, and reason as plain text", () => {
    render(
      <ReleaseRollbackRecord
        projectId={PROJECT_ID}
        record={recordFixture()}
        rolledBackByName="Jitesh D"
      />,
    );
    expect(screen.getByText("abc1234")).toBeInTheDocument();
    expect(screen.getByText("Jitesh D")).toBeInTheDocument();
    expect(screen.getByText("The deploy broke the checkout flow")).toBeInTheDocument();
  });

  it("falls back to the raw actor id when the name doesn't resolve", () => {
    render(
      <ReleaseRollbackRecord
        projectId={PROJECT_ID}
        record={recordFixture()}
        rolledBackByName={null}
      />,
    );
    expect(screen.getByText("44444444-4444-4444-4444-444444444444")).toBeInTheDocument();
  });

  it("renders a link to the replacement release when present, and an em dash otherwise", () => {
    const { rerender } = render(
      <ReleaseRollbackRecord
        projectId={PROJECT_ID}
        record={recordFixture()}
        rolledBackByName={null}
      />,
    );
    expect(screen.getByText("—")).toBeInTheDocument();

    const replacementId = "55555555-5555-5555-5555-555555555555";
    rerender(
      <ReleaseRollbackRecord
        projectId={PROJECT_ID}
        record={recordFixture({ replacementReleaseId: replacementId })}
        rolledBackByName={null}
      />,
    );
    const link = screen.getByRole("link", { name: replacementId });
    expect(link).toHaveAttribute(
      "href",
      `/release-center/${replacementId}?projectId=${PROJECT_ID}`,
    );
  });
});
