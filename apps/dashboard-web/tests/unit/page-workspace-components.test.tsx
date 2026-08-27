import { fireEvent, render, screen, waitFor } from "@testing-library/react";
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
    // Every mutation now real-fetches (fixed to prefix getApiBaseUrl() — code-review finding,
    // `dashboard-web-page-workspace`), so a successful response is stubbed for these tests; the
    // URL itself is asserted on directly in the dedicated "hits dashboard-api" test below.
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({ data: {} }),
      }),
    );
  });
  afterEach(() => vi.restoreAllMocks());

  it("fetches against dashboard-api's own origin, not a bare relative path", async () => {
    // Regression test: every mutation previously fetched a relative path, which resolves against
    // dashboard-web's own origin in production and 404s (code-review finding).
    panel(version({ status: "draft" }));
    fireEvent.click(screen.getByRole("button", { name: "Submitted" }));
    await waitFor(() => expect(fetch).toHaveBeenCalled());
    const [url] = (fetch as ReturnType<typeof vi.fn>).mock.calls[0]!;
    expect(url).toBe(
      "https://api.example.com/page-workspace/projects/" +
        `${PROJECT_ID}/pages/${PAGE_ID}/artifacts/${artifact().id}/versions/${version().id}/status`,
    );
  });

  it("re-renders the next legal actions immediately after a status change, without waiting for router.refresh()", async () => {
    // Regression test: the action buttons previously stayed derived from the stale `currentVersion`
    // prop until router.refresh() resolved — since refresh() is mocked as a no-op here, a real
    // production render would never update at all without this local mirror.
    panel(version({ status: "draft" }));
    expect(screen.getByRole("button", { name: "Submitted" })).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Submitted" }));
    await waitFor(() =>
      expect(screen.queryByRole("button", { name: "Submitted" })).not.toBeInTheDocument(),
    );
    // draft -> submitted; submitted's own legal next stages include "Under Review".
    expect(screen.getByRole("button", { name: "Under Review" })).toBeInTheDocument();
  });

  it("re-renders Reopen as unavailable and Edit as available immediately after reopening", async () => {
    panel(version({ status: "approved" }));
    expect(screen.getByRole("button", { name: "Reopen" })).toBeInTheDocument();
    // reopen() prompts for a reason.
    vi.spyOn(window, "prompt").mockReturnValue("needs a fix");
    fireEvent.click(screen.getByRole("button", { name: "Reopen" }));
    await waitFor(() =>
      expect(screen.queryByRole("button", { name: "Reopen" })).not.toBeInTheDocument(),
    );
    // reopen() always forks a fresh draft version, so Edit should now be offered.
    expect(screen.getByRole("button", { name: "Edit" })).toBeInTheDocument();
  });

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
  beforeEach(() => {
    process.env.NEXT_PUBLIC_API_BASE_URL = "https://api.example.com";
    refreshMock.mockReset();
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({ data: {} }),
      }),
    );
  });
  afterEach(() => vi.restoreAllMocks());

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

  it("offers the recorded resume point, the other interrupt stages, and archival — never an arbitrary main-path stage", () => {
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
    // Regression test: previously only the resume point and Archived were offered here — a real,
    // backend-supported interrupt-to-interrupt move (code-review finding).
    expect(screen.getByRole("button", { name: "Blocked" })).toBeInTheDocument();
    // Resuming to an arbitrary main-path stage would turn a pause into a way to skip every gate.
    expect(screen.queryByRole("button", { name: "Production approved" })).not.toBeInTheDocument();
  });

  it("hits dashboard-api's own origin, not a bare relative path, and re-renders the button set immediately after entering an interrupt stage", async () => {
    // Regression test for two fixes together: the missing getApiBaseUrl() prefix, and
    // setCurrentPrevious's dead-code ternary that unconditionally cleared the resume point instead
    // of capturing the stage just left (code-review findings).
    render(
      <PageLifecycleActions
        projectId={PROJECT_ID}
        pageId={PAGE_ID}
        stage="in_development"
        previousStage={null}
      />,
    );
    // "blocked" is one of the reasons LIFECYCLE_REASON_REQUIRED demands a reason for.
    vi.spyOn(window, "prompt").mockReturnValue("a real blocker");
    fireEvent.click(screen.getByRole("button", { name: "Blocked" }));
    await waitFor(() =>
      expect(screen.queryByRole("button", { name: "Code review" })).not.toBeInTheDocument(),
    );
    const [url] = (fetch as ReturnType<typeof vi.fn>).mock.calls[0]!;
    expect(url).toBe(
      `https://api.example.com/page-workspace/projects/${PROJECT_ID}/pages/${PAGE_ID}/lifecycle`,
    );
    // Without router.refresh() actually landing (it's mocked as a no-op), the button set should
    // already reflect that the page just entered "blocked" from "in_development" — offering resume
    // back to it, not requiring a second click to discover.
    expect(screen.getByRole("button", { name: "In development" })).toBeInTheDocument();
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
