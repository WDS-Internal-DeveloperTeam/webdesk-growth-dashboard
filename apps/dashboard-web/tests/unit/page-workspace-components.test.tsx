import { render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { PageArtifact, PageArtifactVersion } from "@webdesk/shared-types";

const refreshMock = vi.fn();

vi.mock("next/navigation", () => ({
  useRouter: () => ({ refresh: refreshMock }),
}));

// The editor is a Tiptap contentEditable, not a form control — sibling suites stub it for the
// same reason (it cannot be driven with fireEvent.change, and these tests are about which
// controls appear, not about typing).
vi.mock("../../components/rich-text-editor", () => ({
  RichTextEditor: () => <div data-testid="rich-text-editor" />,
}));

import { PageArtifactPanel } from "../../components/page-artifact-panel.js";
import { PageLifecycleActions } from "../../components/page-lifecycle-actions.js";

const PROJECT_ID = "11111111-1111-1111-1111-111111111111";
const PAGE_ID = "22222222-2222-2222-2222-222222222222";

function artifact(): PageArtifact {
  return {
    id: "33333333-3333-3333-3333-333333333333",
    pageId: PAGE_ID,
    projectId: PROJECT_ID,
    artifactType: "content",
    currentVersionId: "44444444-4444-4444-4444-444444444444",
    createdBy: null,
    updatedBy: null,
    createdAt: "2026-08-26T00:00:00.000Z",
    updatedAt: "2026-08-26T00:00:00.000Z",
  };
}

function version(overrides: Partial<PageArtifactVersion> = {}): PageArtifactVersion {
  return {
    id: "44444444-4444-4444-4444-444444444444",
    artifactId: "33333333-3333-3333-3333-333333333333",
    pageId: PAGE_ID,
    projectId: PROJECT_ID,
    versionNumber: 1,
    status: "draft",
    content: "<p>draft</p>",
    notes: null,
    repository: null,
    path: null,
    branch: null,
    commitSha: null,
    contentChecksum: null,
    reopenedReason: null,
    reopenedFromVersionId: null,
    approvedByUserId: null,
    approvedAt: null,
    createdBy: null,
    updatedBy: null,
    createdAt: "2026-08-26T00:00:00.000Z",
    updatedAt: "2026-08-26T00:00:00.000Z",
    ...overrides,
  };
}

function panel(v: PageArtifactVersion | null, a: PageArtifact | null = artifact()) {
  return render(
    <PageArtifactPanel
      projectId={PROJECT_ID}
      pageId={PAGE_ID}
      artifactType="content"
      tabLabel="Content"
      artifact={a}
      currentVersion={v}
      readView={<div>read view</div>}
    />,
  );
}

describe("PageArtifactPanel", () => {
  beforeEach(() => {
    process.env.NEXT_PUBLIC_API_BASE_URL = "https://api.example.com";
    refreshMock.mockReset();
  });
  afterEach(() => vi.restoreAllMocks());

  it("offers creation when the tab has no artifact yet", () => {
    panel(null, null);
    expect(screen.getByRole("button", { name: /Create Content artifact/ })).toBeInTheDocument();
  });

  it("offers Edit only while the version is still a draft", () => {
    panel(version({ status: "draft" }));
    expect(screen.getByRole("button", { name: "Edit" })).toBeInTheDocument();
  });

  it("does not offer Edit once the version is approved — approved versions are immutable", () => {
    panel(version({ status: "approved" }));
    expect(screen.queryByRole("button", { name: "Edit" })).not.toBeInTheDocument();
  });

  it("offers Reopen for an approved version, and not for a draft", () => {
    const { unmount } = panel(version({ status: "approved" }));
    expect(screen.getByRole("button", { name: "Reopen" })).toBeInTheDocument();
    unmount();

    panel(version({ status: "draft" }));
    expect(screen.queryByRole("button", { name: "Reopen" })).not.toBeInTheDocument();
  });

  it("offers only the transitions legal from the current status", () => {
    panel(version({ status: "draft" }));
    // draft -> submitted | archived, and nothing else.
    expect(screen.getByRole("button", { name: "Submitted" })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Approved" })).not.toBeInTheDocument();
  });

  it("offers no transitions at all from a terminal version", () => {
    panel(version({ status: "superseded" }));
    expect(screen.queryByRole("button", { name: "Submitted" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Approved" })).not.toBeInTheDocument();
  });

  it("renders the server-supplied read view rather than raw HTML", () => {
    // SanitizedRichText is Node-only, so the read view must arrive already rendered.
    panel(version());
    expect(screen.getByText("read view")).toBeInTheDocument();
  });
});

describe("PageLifecycleActions", () => {
  beforeEach(() => refreshMock.mockReset());

  it("offers the next main-path stage and the interrupt states", () => {
    render(
      <PageLifecycleActions
        projectId={PROJECT_ID}
        pageId={PAGE_ID}
        stage="proposed"
        previousStage={null}
      />,
    );
    expect(screen.getByRole("button", { name: "Approved for planning" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Paused" })).toBeInTheDocument();
  });

  it("offers only the recorded resume point and archival from an interrupted stage", () => {
    render(
      <PageLifecycleActions
        projectId={PROJECT_ID}
        pageId={PAGE_ID}
        stage="paused"
        previousStage="in_development"
      />,
    );
    expect(screen.getByRole("button", { name: "In development" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Archived" })).toBeInTheDocument();
    // Resuming anywhere else would turn a pause into a way to skip every gate in between.
    expect(screen.queryByRole("button", { name: "Production approved" })).not.toBeInTheDocument();
  });

  it("renders nothing at all once the page is archived", () => {
    const { container } = render(
      <PageLifecycleActions
        projectId={PROJECT_ID}
        pageId={PAGE_ID}
        stage="archived"
        previousStage={null}
      />,
    );
    expect(container).toBeEmptyDOMElement();
  });
});
