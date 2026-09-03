import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { ReleaseArtifact } from "@webdesk/shared-types";

import { ReleaseArtifactsSection } from "../../components/release-artifacts-section.js";

const PROJECT_ID = "11111111-1111-1111-1111-111111111111";
const RELEASE_ID = "22222222-2222-2222-2222-222222222222";
const ARTIFACT_ID = "33333333-3333-3333-3333-333333333333";
const BASE_PATH = `https://api.example.com/release-center/projects/${PROJECT_ID}/releases/${RELEASE_ID}/artifacts`;

function artifactFixture(overrides: Partial<ReleaseArtifact> = {}): ReleaseArtifact {
  return {
    id: ARTIFACT_ID,
    releaseId: RELEASE_ID,
    projectId: PROJECT_ID,
    repoOwner: "webdesk",
    repoName: "growth-dashboard",
    commitSha: "abc1234",
    prUrl: null,
    createdBy: null,
    createdAt: "2026-09-02T00:00:00.000Z",
    updatedAt: "2026-09-02T00:00:00.000Z",
    ...overrides,
  };
}

describe("ReleaseArtifactsSection", () => {
  const originalFetch = global.fetch;

  beforeEach(() => {
    process.env.NEXT_PUBLIC_API_BASE_URL = "https://api.example.com";
  });

  afterEach(() => {
    global.fetch = originalFetch;
    vi.restoreAllMocks();
  });

  it("shows an empty state with no artifacts", () => {
    render(
      <ReleaseArtifactsSection
        projectId={PROJECT_ID}
        releaseId={RELEASE_ID}
        initialArtifacts={[]}
        deletionBlocked={false}
      />,
    );
    expect(screen.getByText("No artifacts recorded yet.")).toBeInTheDocument();
  });

  it("renders an existing artifact row", () => {
    render(
      <ReleaseArtifactsSection
        projectId={PROJECT_ID}
        releaseId={RELEASE_ID}
        initialArtifacts={[artifactFixture()]}
        deletionBlocked={false}
      />,
    );
    expect(screen.getByText("webdesk/growth-dashboard @ abc1234")).toBeInTheDocument();
  });

  it("hides Delete once the parent release is completed/rolled back", () => {
    render(
      <ReleaseArtifactsSection
        projectId={PROJECT_ID}
        releaseId={RELEASE_ID}
        initialArtifacts={[artifactFixture()]}
        deletionBlocked
      />,
    );
    expect(screen.queryByRole("button", { name: "Delete" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Add artifact" })).not.toBeInTheDocument();
  });

  it("rejects an owner/name segment with a slash before ever calling fetch", () => {
    const fetchMock = vi.fn();
    global.fetch = fetchMock as typeof fetch;

    render(
      <ReleaseArtifactsSection
        projectId={PROJECT_ID}
        releaseId={RELEASE_ID}
        initialArtifacts={[]}
        deletionBlocked={false}
      />,
    );
    fireEvent.change(screen.getByLabelText("Repository owner"), {
      target: { value: "not/a-plain-segment" },
    });
    fireEvent.change(screen.getByLabelText("Repository name"), {
      target: { value: "growth-dashboard" },
    });
    fireEvent.change(screen.getByLabelText("Commit SHA"), { target: { value: "abc1234" } });
    fireEvent.click(screen.getByRole("button", { name: "Add artifact" }));

    expect(screen.getByRole("alert")).toHaveTextContent(/no slashes or spaces/);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("adds an artifact and appends it to the list", async () => {
    const created = artifactFixture({ id: "44444444-4444-4444-4444-444444444444" });
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ success: true, data: created, correlationId: "c1" }),
    } as Response) as typeof fetch;

    render(
      <ReleaseArtifactsSection
        projectId={PROJECT_ID}
        releaseId={RELEASE_ID}
        initialArtifacts={[]}
        deletionBlocked={false}
      />,
    );
    fireEvent.change(screen.getByLabelText("Repository owner"), { target: { value: "webdesk" } });
    fireEvent.change(screen.getByLabelText("Repository name"), {
      target: { value: "growth-dashboard" },
    });
    fireEvent.change(screen.getByLabelText("Commit SHA"), { target: { value: "abc1234" } });
    fireEvent.click(screen.getByRole("button", { name: "Add artifact" }));

    await waitFor(() =>
      expect(screen.getByText("webdesk/growth-dashboard @ abc1234")).toBeInTheDocument(),
    );
    const [url, options] = vi.mocked(global.fetch).mock.calls[0] as [string, RequestInit];
    expect(url).toBe(BASE_PATH);
    expect(options.method).toBe("POST");
  });

  it("deletes an artifact via a real HTTP DELETE request", async () => {
    global.fetch = vi.fn().mockResolvedValue({ ok: true, status: 204 } as Response) as typeof fetch;

    render(
      <ReleaseArtifactsSection
        projectId={PROJECT_ID}
        releaseId={RELEASE_ID}
        initialArtifacts={[artifactFixture()]}
        deletionBlocked={false}
      />,
    );
    fireEvent.click(screen.getByRole("button", { name: "Delete" }));

    await waitFor(() =>
      expect(screen.queryByText("webdesk/growth-dashboard @ abc1234")).not.toBeInTheDocument(),
    );
    const [url, options] = vi.mocked(global.fetch).mock.calls[0] as [string, RequestInit];
    expect(url).toBe(`${BASE_PATH}/${ARTIFACT_ID}`);
    expect(options.method).toBe("DELETE");
  });
});
