import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { Release } from "@webdesk/shared-types";

const pushMock = vi.fn();

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: pushMock }),
}));

import { ReleaseForm } from "../../components/release-form.js";

const PROJECT_ID = "11111111-1111-1111-1111-111111111111";
const RELEASE_ID = "22222222-2222-2222-2222-222222222222";

function releaseFixture(overrides: Partial<Release> = {}): Release {
  return {
    id: RELEASE_ID,
    projectId: PROJECT_ID,
    publicId: "REL-1",
    releaseType: "staging",
    title: "Release the homepage redesign",
    status: "proposed",
    notes: null,
    hotfixReason: null,
    assignedDeveloperUserId: null,
    assignedReviewerUserId: null,
    productionApproverUserId: null,
    stagingDeployedAt: null,
    stagingVerifiedAt: null,
    productionDeployedAt: null,
    productionVerifiedAt: null,
    completedAt: null,
    hotfixRequiredAt: null,
    rolledBackAt: null,
    createdBy: null,
    updatedBy: null,
    createdAt: "2026-09-02T00:00:00.000Z",
    updatedAt: "2026-09-02T00:00:00.000Z",
    ...overrides,
  };
}

describe("ReleaseForm", () => {
  const originalFetch = global.fetch;

  beforeEach(() => {
    process.env.NEXT_PUBLIC_API_BASE_URL = "https://api.example.com";
    pushMock.mockReset();
  });

  afterEach(() => {
    global.fetch = originalFetch;
    vi.restoreAllMocks();
  });

  it("create mode: renders publicId and releaseType as real editable fields", () => {
    render(<ReleaseForm mode="create" projectId={PROJECT_ID} />);
    expect(screen.getByLabelText("Public ID")).toBeInTheDocument();
    expect(screen.getByLabelText("Release type")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Create release" })).toBeInTheDocument();
  });

  it("edit mode: shows publicId/releaseType as read-only, not inputs", () => {
    render(
      <ReleaseForm
        mode="edit"
        projectId={PROJECT_ID}
        releaseId={RELEASE_ID}
        initial={releaseFixture()}
        assignedDeveloper={null}
        assignedReviewer={null}
      />,
    );
    expect(screen.queryByLabelText("Public ID")).not.toBeInTheDocument();
    expect(screen.getByText("REL-1")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Save changes" })).toBeInTheDocument();
  });

  it("create: submits publicId/releaseType/title and omits blank notes/hotfixReason entirely", async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ success: true, data: { id: RELEASE_ID }, correlationId: "c1" }),
    } as Response);
    global.fetch = fetchMock as typeof fetch;

    render(<ReleaseForm mode="create" projectId={PROJECT_ID} />);
    fireEvent.change(screen.getByLabelText("Public ID"), { target: { value: "REL-2" } });
    fireEvent.change(screen.getByLabelText("Title"), { target: { value: "New release" } });
    fireEvent.click(screen.getByRole("button", { name: "Create release" }));

    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(1));
    const [url, options] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toBe(`https://api.example.com/release-center/projects/${PROJECT_ID}/releases`);
    const body = JSON.parse(options.body as string) as Record<string, unknown>;
    expect(body.publicId).toBe("REL-2");
    expect(body.releaseType).toBe("staging");
    expect(body.title).toBe("New release");
    expect(body.notes).toBeUndefined();
    expect(body.hotfixReason).toBeUndefined();
    await waitFor(() =>
      expect(pushMock).toHaveBeenCalledWith(
        `/release-center/${RELEASE_ID}?projectId=${PROJECT_ID}`,
      ),
    );
  });

  it("edit: preserves an untouched developer assignment on save rather than clearing it", async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ success: true, data: { id: RELEASE_ID }, correlationId: "c1" }),
    } as Response);
    global.fetch = fetchMock as typeof fetch;

    const initial = releaseFixture({ assignedDeveloperUserId: "developer-1" });
    render(
      <ReleaseForm
        mode="edit"
        projectId={PROJECT_ID}
        releaseId={RELEASE_ID}
        initial={initial}
        assignedDeveloper={null}
        assignedReviewer={null}
      />,
    );
    fireEvent.click(screen.getByRole("button", { name: "Save changes" }));

    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(1));
    const [, options] = fetchMock.mock.calls[0] as [string, RequestInit];
    const body = JSON.parse(options.body as string) as Record<string, unknown>;
    expect(body.assignedDeveloperUserId).toBe("developer-1");
  });
});
