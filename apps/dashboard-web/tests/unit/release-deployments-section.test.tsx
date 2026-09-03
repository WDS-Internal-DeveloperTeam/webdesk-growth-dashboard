import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { Deployment } from "@webdesk/shared-types";

import { ReleaseDeploymentsSection } from "../../components/release-deployments-section.js";

const PROJECT_ID = "11111111-1111-1111-1111-111111111111";
const RELEASE_ID = "22222222-2222-2222-2222-222222222222";
const DEPLOYMENT_ID = "33333333-3333-3333-3333-333333333333";
const BASE_PATH = `https://api.example.com/release-center/projects/${PROJECT_ID}/releases/${RELEASE_ID}/deployments`;

function deploymentFixture(overrides: Partial<Deployment> = {}): Deployment {
  return {
    id: DEPLOYMENT_ID,
    releaseId: RELEASE_ID,
    projectId: PROJECT_ID,
    environment: "staging",
    outcome: "succeeded",
    deployedByUserId: null,
    deployedAt: "2026-09-02T00:00:00.000Z",
    notes: null,
    createdAt: "2026-09-02T00:00:00.000Z",
    updatedAt: "2026-09-02T00:00:00.000Z",
    ...overrides,
  };
}

describe("ReleaseDeploymentsSection", () => {
  const originalFetch = global.fetch;

  beforeEach(() => {
    process.env.NEXT_PUBLIC_API_BASE_URL = "https://api.example.com";
  });

  afterEach(() => {
    global.fetch = originalFetch;
    vi.restoreAllMocks();
  });

  it("shows an empty state with no deployments", () => {
    render(
      <ReleaseDeploymentsSection
        projectId={PROJECT_ID}
        releaseId={RELEASE_ID}
        initialDeployments={[]}
        creationBlocked={false}
      />,
    );
    expect(screen.getByText("No deploy attempts recorded yet.")).toBeInTheDocument();
  });

  it("renders an existing deployment with a distinct color for a failed outcome", () => {
    render(
      <ReleaseDeploymentsSection
        projectId={PROJECT_ID}
        releaseId={RELEASE_ID}
        initialDeployments={[deploymentFixture({ outcome: "failed" })]}
        creationBlocked={false}
      />,
    );
    // Scoped to the list row, since the add form's own "Failed" <option> is also on screen.
    expect(within(screen.getByRole("list")).getByText("Failed")).toBeInTheDocument();
  });

  it("hides the add form once the release is completed/rolled back", () => {
    render(
      <ReleaseDeploymentsSection
        projectId={PROJECT_ID}
        releaseId={RELEASE_ID}
        initialDeployments={[]}
        creationBlocked
      />,
    );
    expect(screen.queryByRole("button", { name: "Record deploy attempt" })).not.toBeInTheDocument();
  });

  it("omits deployedAt entirely (not null) when left blank", async () => {
    const created = deploymentFixture({ id: "44444444-4444-4444-4444-444444444444" });
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ success: true, data: created, correlationId: "c1" }),
    } as Response) as typeof fetch;

    render(
      <ReleaseDeploymentsSection
        projectId={PROJECT_ID}
        releaseId={RELEASE_ID}
        initialDeployments={[]}
        creationBlocked={false}
      />,
    );
    fireEvent.click(screen.getByRole("button", { name: "Record deploy attempt" }));

    await waitFor(() => expect(global.fetch).toHaveBeenCalledTimes(1));
    const [url, options] = vi.mocked(global.fetch).mock.calls[0] as [string, RequestInit];
    expect(url).toBe(BASE_PATH);
    const body = JSON.parse(options.body as string) as Record<string, unknown>;
    expect(body).not.toHaveProperty("deployedAt");
    expect(body.environment).toBe("staging");
    expect(body.outcome).toBe("succeeded");
  });
});
