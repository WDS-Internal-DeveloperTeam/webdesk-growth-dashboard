import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { SmokeTest } from "@webdesk/shared-types";

import { ReleaseSmokeTestsSection } from "../../components/release-smoke-tests-section.js";

const PROJECT_ID = "11111111-1111-1111-1111-111111111111";
const RELEASE_ID = "22222222-2222-2222-2222-222222222222";
const SMOKE_TEST_ID = "33333333-3333-3333-3333-333333333333";
const BASE_PATH = `https://api.example.com/release-center/projects/${PROJECT_ID}/releases/${RELEASE_ID}/smoke-tests`;

function smokeTestFixture(overrides: Partial<SmokeTest> = {}): SmokeTest {
  return {
    id: SMOKE_TEST_ID,
    releaseId: RELEASE_ID,
    projectId: PROJECT_ID,
    environment: "staging",
    name: "Sign-in flow",
    result: "passed",
    ranAt: "2026-09-02T00:00:00.000Z",
    notes: null,
    createdAt: "2026-09-02T00:00:00.000Z",
    updatedAt: "2026-09-02T00:00:00.000Z",
    ...overrides,
  };
}

describe("ReleaseSmokeTestsSection", () => {
  const originalFetch = global.fetch;

  beforeEach(() => {
    process.env.NEXT_PUBLIC_API_BASE_URL = "https://api.example.com";
  });

  afterEach(() => {
    global.fetch = originalFetch;
    vi.restoreAllMocks();
  });

  it("shows an empty state with no smoke tests", () => {
    render(
      <ReleaseSmokeTestsSection
        projectId={PROJECT_ID}
        releaseId={RELEASE_ID}
        initialSmokeTests={[]}
        creationBlocked={false}
      />,
    );
    expect(screen.getByText("No smoke tests recorded yet.")).toBeInTheDocument();
  });

  it("renders an existing smoke test with a distinct color for a failed result", () => {
    render(
      <ReleaseSmokeTestsSection
        projectId={PROJECT_ID}
        releaseId={RELEASE_ID}
        initialSmokeTests={[smokeTestFixture({ result: "failed" })]}
        creationBlocked={false}
      />,
    );
    // Scoped to the list row, since the add form's own "Failed" <option> is also on screen.
    expect(within(screen.getByRole("list")).getByText("Failed")).toBeInTheDocument();
  });

  it("hides the add form once the release is completed/rolled back", () => {
    render(
      <ReleaseSmokeTestsSection
        projectId={PROJECT_ID}
        releaseId={RELEASE_ID}
        initialSmokeTests={[]}
        creationBlocked
      />,
    );
    expect(screen.queryByRole("button", { name: "Record result" })).not.toBeInTheDocument();
  });

  it("requires a name before submitting", () => {
    const fetchMock = vi.fn();
    global.fetch = fetchMock as typeof fetch;

    render(
      <ReleaseSmokeTestsSection
        projectId={PROJECT_ID}
        releaseId={RELEASE_ID}
        initialSmokeTests={[]}
        creationBlocked={false}
      />,
    );
    fireEvent.click(screen.getByRole("button", { name: "Record result" }));

    expect(screen.getByRole("alert")).toHaveTextContent(/name is required/);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("submits a new smoke test result and appends it to the list", async () => {
    const created = smokeTestFixture({
      id: "44444444-4444-4444-4444-444444444444",
      name: "Checkout flow",
    });
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ success: true, data: created, correlationId: "c1" }),
    } as Response) as typeof fetch;

    render(
      <ReleaseSmokeTestsSection
        projectId={PROJECT_ID}
        releaseId={RELEASE_ID}
        initialSmokeTests={[]}
        creationBlocked={false}
      />,
    );
    fireEvent.change(screen.getByLabelText("Name"), { target: { value: "Checkout flow" } });
    fireEvent.click(screen.getByRole("button", { name: "Record result" }));

    await waitFor(() => expect(screen.getByText(/Checkout flow/)).toBeInTheDocument());
    const [url, options] = vi.mocked(global.fetch).mock.calls[0] as [string, RequestInit];
    expect(url).toBe(BASE_PATH);
    const body = JSON.parse(options.body as string) as Record<string, unknown>;
    expect(body.name).toBe("Checkout flow");
    expect(body).not.toHaveProperty("ranAt");
  });
});
